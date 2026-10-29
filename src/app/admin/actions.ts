"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { audit, createSession, currentAdmin, destroySession, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { hashPassword, PASSWORD_MIN_LENGTH, verifyPassword } from "@/lib/password";
import { clientIp } from "@/lib/request";
import { hmac } from "@/lib/secret";

export type FormState = { error?: string; success?: string; fieldErrors?: Record<string, string> };

const LOGIN_WINDOW_MS = 15 * 60 * 1000;

// Verifying against a dummy hash keeps response time the same for unknown emails.
let dummyHash: Promise<string> | null = null;

export async function login(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase().slice(0, 200);
  const password = String(fd.get("password") ?? "").slice(0, 200);
  if (!email || !password) return { error: "Enter your email and password." };

  // Failed attempts are counted in the database so the limit holds across serverless instances.
  const keys = { email: `email:${email}`, ip: `ip:${hmac("ip", await clientIp())}` };
  const since = new Date(Date.now() - LOGIN_WINDOW_MS);
  const [byEmail, byIp] = await Promise.all(
    [keys.email, keys.ip].map((key) => db.loginAttempt.count({ where: { key, createdAt: { gt: since } } })),
  );
  if (byEmail >= 5 || byIp >= 10) {
    log("warn", "admin.login_rate_limited", { email });
    return { error: "Too many sign-in attempts. Please wait 15 minutes and try again." };
  }

  const admin = await db.admin.findUnique({ where: { email } });
  dummyHash ??= hashPassword("not-a-real-password");
  const valid = await verifyPassword(password, admin?.passwordHash ?? (await dummyHash));
  if (!admin || !valid) {
    await db.loginAttempt.createMany({ data: [{ key: keys.email }, { key: keys.ip }] });
    log("warn", "admin.login_failed", { email });
    return { error: "The email or password is incorrect." };
  }

  await db.loginAttempt.deleteMany({
    where: { OR: [{ key: keys.email }, { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }] },
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
  const admin = await db.admin.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await verifyPassword(parsed.data.current, admin.passwordHash))) {
    return { fieldErrors: { current: "Your current password is incorrect." } };
  }
  await db.admin.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(parsed.data.next) } });
  // Sign out every other session for this account.
  await db.session.deleteMany({ where: { adminId: me.id } });
  await createSession(me.id);
  await audit(me.id, "password.change");
  return { success: "Your password has been changed. Other sessions were signed out." };
}
