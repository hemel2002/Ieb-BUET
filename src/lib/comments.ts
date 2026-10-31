import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { db } from "./db";
import { log } from "./log";
import { clientIp } from "./request";
import { hmac } from "./secret";

export const COMMENT_STATUSES = ["pending", "approved", "rejected"] as const;
export type CommentStatus = (typeof COMMENT_STATUSES)[number];

export const BODY_MIN = 5;
export const BODY_MAX = 1500;
export const NAME_MAX = 60;

const MIN_FILL_MS = 3_000;
const MAX_TOKEN_AGE_MS = 24 * 60 * 60 * 1000;
const LIMITS = [
  { windowMs: 10 * 60 * 1000, max: 3 },
  { windowMs: 24 * 60 * 60 * 1000, max: 20 },
];

/** Comment shape exposed to the public. Deliberately has no field that can identify an anonymous author. */
export type PublicComment = { id: string; author: string; body: string; submittedAt: Date };

/** A comment as plain JSON, for the browser (dates as ISO strings). */
export type CommentJson = { id: string; author: string; body: string; submittedAt: string };

export type SubmitResult =
  /** `comment` is what the commenter just wrote, handed back so they can see it at once while it awaits review. */
  | { ok: true; comment?: CommentJson }
  | { ok: false; message: string; fieldErrors?: Partial<Record<"name" | "body", string>> };

/** Signed render timestamp; rejects instant (bot) submissions and forged tokens. */
export function issueFormToken(): string {
  const ts = Date.now().toString();
  return `${ts}.${hmac("comment-form", ts)}`;
}

function checkFormToken(token: string): string | null {
  const [ts, sig] = token.split(".");
  if (!ts || !sig || sig !== hmac("comment-form", ts)) return "Your form has expired. Please reload the page and try again.";
  const age = Date.now() - Number(ts);
  if (age > MAX_TOKEN_AGE_MS) return "Your form has expired. Please reload the page and try again.";
  if (age < MIN_FILL_MS) return "That was very fast. Please wait a moment and submit again.";
  return null;
}

// Control characters, zero-width and bidirectional-override characters are stripped.
const INVISIBLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩﻿]/g;

export function normaliseBody(input: string): string {
  return input.replace(/\r\n?/g, "\n").replace(INVISIBLE, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

const nameSchema = z
  .string()
  .transform((s) => s.replace(INVISIBLE, "").replace(/\s+/g, " ").trim())
  .pipe(
    z
      .string()
      .min(2, "Please enter at least 2 characters, or choose to comment anonymously.")
      .max(NAME_MAX, `Please keep your name under ${NAME_MAX} characters.`)
      .regex(/^[\p{L}\p{M}][\p{L}\p{M}\s.'()-]*$/u, "Please use letters, spaces and . ' - only."),
  );

const bodySchema = z
  .string()
  .transform(normaliseBody)
  .pipe(
    z
      .string()
      .min(BODY_MIN, `Please write at least ${BODY_MIN} characters.`)
      .max(BODY_MAX, `Please keep your comment under ${BODY_MAX} characters.`)
      .refine((s) => !/<\/?[a-z!][^>]*>/i.test(s), "HTML or code is not allowed in comments.")
      .refine((s) => (s.match(/https?:\/\/|www\./gi) ?? []).length <= 2, "Please include no more than two links."),
  );

export type SubmitInput = {
  candidateId: string;
  visibility: string;
  name: string;
  body: string;
  honeypot: string;
  token: string;
};

export async function submitComment(input: SubmitInput): Promise<SubmitResult> {
  const candidate = await db.candidate.findFirst({
    where: { id: input.candidateId, isPublished: true },
    select: { id: true },
  });
  if (!candidate) return { ok: false, message: "This candidate could not be found." };

  const ipHash = hmac("ip", await clientIp());

  // Bots that fill the hidden field get the normal success response and nothing is stored.
  if (input.honeypot) {
    log("warn", "comment.honeypot", { candidateId: candidate.id, ipHash: ipHash.slice(0, 12) });
    return { ok: true };
  }
  const tokenError = checkFormToken(input.token);
  if (tokenError) return { ok: false, message: tokenError };

  const isAnonymous = input.visibility !== "public";
  const fieldErrors: Partial<Record<"name" | "body", string>> = {};
  const body = bodySchema.safeParse(input.body);
  if (!body.success) fieldErrors.body = body.error.issues[0].message;
  let displayName: string | null = null;
  if (!isAnonymous) {
    const name = nameSchema.safeParse(input.name);
    if (!name.success) fieldErrors.name = name.error.issues[0].message;
    else displayName = name.data;
  }
  if (!body.success || fieldErrors.name) {
    return { ok: false, message: "Please correct the highlighted fields.", fieldErrors };
  }

  for (const { windowMs, max } of LIMITS) {
    const recent = await db.comment.count({
      where: { ipHash, createdAt: { gt: new Date(Date.now() - windowMs) } },
    });
    if (recent >= max) {
      log("warn", "comment.rate_limited", { ipHash: ipHash.slice(0, 12), windowMs });
      return { ok: false, message: "You have submitted several comments recently. Please try again later." };
    }
  }

  const contentHash = createHash("sha256")
    .update(`${candidate.id}\n${body.data.toLowerCase().replace(/\s+/g, " ")}`)
    .digest("hex");
  if (await db.comment.findFirst({ where: { contentHash }, select: { id: true } })) {
    return { ok: false, message: "This comment has already been submitted for this candidate." };
  }

  const comment = await db.comment.create({
    data: { candidateId: candidate.id, isAnonymous, displayName, body: body.data, contentHash, ipHash, status: "pending" },
    select: { id: true, createdAt: true },
  });
  log("info", "comment.submitted", { commentId: comment.id, candidateId: candidate.id });
  return {
    ok: true,
    comment: { id: comment.id, author: displayName ?? "Anonymous", body: body.data, submittedAt: comment.createdAt.toISOString() },
  };
}

const commentSelect = { id: true, body: true, createdAt: true, isAnonymous: true, displayName: true } as const;

function toPublic(rows: { id: string; body: string; createdAt: Date; isAnonymous: boolean; displayName: string | null }[]): PublicComment[] {
  return rows.map((c) => ({
    id: c.id,
    author: c.isAnonymous || !c.displayName ? "Anonymous" : c.displayName,
    body: c.body,
    submittedAt: c.createdAt,
  }));
}

/** Approved comments only, oldest first. Anonymous comments never expose a name. */
export async function approvedComments(candidateId: string): Promise<PublicComment[]> {
  return toPublic(
    await db.comment.findMany({ where: { candidateId, status: "approved" }, orderBy: { createdAt: "asc" }, select: commentSelect }),
  );
}

/** Same as approvedComments, looked up by profile slug in one query, for the live-refresh endpoint. */
export async function approvedCommentsBySlug(slug: string): Promise<PublicComment[]> {
  return toPublic(
    await db.comment.findMany({
      where: { status: "approved", candidate: { slug, isPublished: true } },
      orderBy: { createdAt: "asc" },
      select: commentSelect,
    }),
  );
}

export const toCommentJson = (c: PublicComment): CommentJson => ({ ...c, submittedAt: c.submittedAt.toISOString() });

export function isCommentStatus(value: unknown): value is CommentStatus {
  return typeof value === "string" && (COMMENT_STATUSES as readonly string[]).includes(value);
}
