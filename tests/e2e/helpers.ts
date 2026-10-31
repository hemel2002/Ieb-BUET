/**
 * Helpers for the end-to-end suite. The suite drives the site exactly like a browser
 * without JavaScript: it fetches pages, reads the server-rendered <form> fields
 * (including the hidden Server Action fields) and posts them back as multipart.
 *
 * Safety: refuses to run unless both E2E_BASE_URL and DATABASE_URL point at
 * localhost, so it can never write test data into a deployed site or database.
 */
import { randomInt } from "node:crypto";
import { PrismaClient } from "@prisma/client";

export const BASE = (process.env.E2E_BASE_URL ?? "").replace(/\/$/, "");

export function assertLocalTarget() {
  const local = (u: string) => {
    try {
      return ["localhost", "127.0.0.1", "::1"].includes(new URL(u).hostname);
    } catch {
      return false;
    }
  };
  if (!local(BASE)) throw new Error("E2E_BASE_URL must be a localhost URL (e.g. http://127.0.0.1:3000)");
  if (!local(process.env.DATABASE_URL ?? "")) throw new Error("DATABASE_URL must point at a local database for the e2e suite");
}

export const db = new PrismaClient();

const ENTITIES: Record<string, string> = { "&quot;": '"', "&amp;": "&", "&lt;": "<", "&gt;": ">", "&#x27;": "'", "&#39;": "'" };
export const decode = (s: string) => s.replace(/&(quot|amp|lt|gt|#x27|#39);/g, (m) => ENTITIES[m]);

/** A visitor with its own cookie jar and simulated client IP. */
export class Client {
  cookies = new Map<string, string>();
  constructor(public ip: string) {}

  headers(extra: Record<string, string> = {}) {
    const h: Record<string, string> = { "x-real-ip": this.ip, ...extra };
    if (this.cookies.size) h.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
    return h;
  }

  store(res: Response) {
    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(";");
      const [name, value] = [pair.slice(0, pair.indexOf("=")), pair.slice(pair.indexOf("=") + 1)];
      const expired = attrs.some((a) => /expires=thu, 01 jan 1970/i.test(a.trim()) || /max-age=0/i.test(a.trim()));
      if (expired || value === "") this.cookies.delete(name.trim());
      else this.cookies.set(name.trim(), value);
    }
  }

  async get(path: string) {
    const res = await fetch(BASE + path, { headers: this.headers(), redirect: "manual" });
    this.store(res);
    return { res, html: await res.text() };
  }

  /** Posts a server-rendered form found on `path` (chosen by `pick`) with `fields` filled in. */
  async submit(path: string, pick: (formHtml: string) => boolean, fields: Record<string, string | Blob>, opts: { origin?: string; html?: string } = {}) {
    const html = opts.html ?? (await this.get(path)).html;
    const form = forms(html).find(pick);
    if (!form) throw new Error(`no matching form on ${path}`);
    const body = new FormData();
    for (const [name, value] of formFields(form)) body.append(name, value);
    for (const [name, value] of Object.entries(fields)) {
      body.delete(name);
      body.append(name, value);
    }
    const res = await fetch(BASE + path, {
      method: "POST",
      body,
      headers: this.headers({ origin: opts.origin ?? BASE }),
      redirect: "manual",
    });
    this.store(res);
    return { res, html: await res.text(), form };
  }
}

export function forms(html: string): string[] {
  return [...html.matchAll(/<form\b[\s\S]*?<\/form>/g)].map((m) => m[0]);
}

/** The values a browser would submit for a form as rendered: inputs, checked boxes, textareas, selects. */
export function formFields(form: string): [string, string][] {
  const out: [string, string][] = [];
  const attr = (attrs: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(attrs)?.[1];
  for (const m of form.matchAll(/<input\b([^>]*)\/?>/g)) {
    const attrs = m[1];
    const name = attr(attrs, "name");
    const type = attr(attrs, "type") || "text";
    if (!name || ["file", "submit", "button", "image", "reset"].includes(type)) continue;
    if ((type === "checkbox" || type === "radio") && !/\bchecked=""/.test(attrs)) continue;
    out.push([decode(name), decode(attr(attrs, "value") || (type === "checkbox" ? "on" : ""))]);
  }
  for (const m of form.matchAll(/<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/g)) {
    const name = attr(m[1], "name");
    if (name) out.push([decode(name), decode(m[2]).replace(/^\n/, "")]);
  }
  for (const m of form.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)) {
    const name = attr(m[1], "name");
    if (!name) continue;
    const options = [...m[2].matchAll(/<option\b([^>]*)>/g)].map((o) => o[1]);
    const chosen = options.find((o) => /\bselected=""/.test(o)) ?? options[0];
    if (chosen !== undefined) out.push([decode(name), decode(attr(chosen, "value") || "")]);
  }
  return out;
}

/** Visible text of an HTML document, for assertions that should not match attributes. */
export function text(html: string) {
  return decode(html.replace(/<script\b[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A random simulated client address, so rate-limit counters (kept in the database) never carry over between runs. */
export const freshIp = () => `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;
