"use server";

import { randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { releaseAttempts, reserveAttempts } from "@/lib/attempts";
import { audit, createSession, currentAdmin, destroySession, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { hashPassword, PASSWORD_MIN_LENGTH, verifyPassword } from "@/lib/password";
import { clientIp } from "@/lib/request";
import { hmac } from "@/lib/secret";

export type FormState = { error?: string; success?: string; fieldErrors?: Record<string, string> };

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const TOO_MANY = "Too many sign-in attempts. Please wait 15 minutes and try again.";

// A browser that has signed in to an account before carries a signed "known device" cookie.
// Its attempts are limited on their own counter instead of the shared per-email one, so a
// stranger's failed guesses for an address cannot lock the owner out of their own browser.
const DEVICE_COOKIE = "ieb_admin_device";
const DEVICE_MAX_AGE_S = 90 * 24 * 60 * 60;
const deviceTag = (email: string, nonce: string) => hmac("login-device", `${email}:${nonce}`);

async function knownDevice(email: string): Promise<string | null> {
  const [nonce, tag] = ((await cookies()).get(DEVICE_COOKIE)?.value ?? "").split(".");
  if (!nonce || !tag || !/^[0-9a-f]{32}$/.test(nonce)) return null;
  const expected = Buffer.from(deviceTag(email, nonce));
  const given = Buffer.from(tag);
  return given.length === expected.length && timingSafeEqual(given, expected) ? nonce : null;
}

// Verifying against a dummy hash keeps response time the same for unknown emails.
let dummyHash: Promise<string> | null = null;

export async function login(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase().slice(0, 200);
  const password = String(fd.get("password") ?? "").slice(0, 200);
  if (!email || !password) return { error: "Enter your email and password." };

  // Attempts are recorded before verifying and counted in the database, so the limits hold
  // under concurrent requests and across serverless instances.
  const device = await knownDevice(email);
  const attempt = await reserveAttempts(
    [
      { key: `ip:${hmac("ip", await clientIp())}`, max: 10 },
      device ? { key: `device:${device}`, max: 10 } : { key: `email:${email}`, max: 5 },
    ],
    LOGIN_WINDOW_MS,
  );
  if (attempt.exceeded) {
    await releaseAttempts(attempt.ids);
    log("warn", "admin.login_rate_limited", { email, limit: attempt.exceeded.split(":")[0] });
    return { error: TOO_MANY };
  }

  const admin = await db.admin.findUnique({ where: { email } });
  dummyHash ??= hashPassword("not-a-real-password");
  const valid = await verifyPassword(password, admin?.passwordHash ?? (await dummyHash));
  if (!admin || !valid) {
    // The reserved rows stay as the record of this failure.
    log("warn", "admin.login_failed", { email, knownDevice: Boolean(device) });
    return { error: "The email or password is incorrect." };
  }

  await db.loginAttempt.deleteMany({
    where: {
      OR: [
        { id: { in: attempt.ids } },
        { key: `email:${email}` },
        { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      ],
    },
  });
  const nonce = device ?? randomBytes(16).toString("hex");
  (await cookies()).set(DEVICE_COOKIE, `${nonce}.${deviceTag(email, nonce)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin",
    maxAge: DEVICE_MAX_AGE_S,
  });
  await db.admin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
  await createSession(admin.id);
  await audit(admin.id, "login");
  log("info", "admin.login", { adminId: admin.id });
  redirect("/admin");
}

export async function logout() {
  const admin = await currentAdmin();
  await destroySession();
  if (admin) log("info", "admin.logout", { adminId: admin.id });
  redirect("/admin/login");
}

const passwordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password."),
    next: z.string().min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`).max(200),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { path: ["confirm"], message: "The passwords do not match." });

export async function changePassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireAdmin("any");
  const parsed = passwordSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    return { fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  }
  // Limit guesses at the current password, so a stolen session cannot be used to find it.
  const attempt = await reserveAttempts([{ key: `password-change:${me.id}`, max: 5 }], LOGIN_WINDOW_MS);
  if (attempt.exceeded) {
    await releaseAttempts(attempt.ids);
    return { error: "Too many attempts. Please wait 15 minutes and try again." };
  }
  const admin = await db.admin.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await verifyPassword(parsed.data.current, admin.passwordHash))) {
    return { fieldErrors: { current: "Your current password is incorrect." } };
  }
  await db.loginAttempt.deleteMany({ where: { key: `password-change:${me.id}` } });
  await db.admin.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(parsed.data.next) } });
  // Sign out every other session for this account.
  await db.session.deleteMany({ where: { adminId: me.id } });
  await createSession(me.id);
  await audit(me.id, "password.change");
  return { success: "Your password has been changed. Other sessions were signed out." };
}
