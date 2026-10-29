import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";

export const SESSION_COOKIE = "ieb_admin_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export type Role = "admin" | "moderator";
export type AdminUser = { id: string; email: string; name: string; role: Role };

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(adminId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({ data: { id: hashToken(token), adminId, expiresAt } });
  await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

/** The signed-in administrator, or null. Cached per request. */
export const currentAdmin = cache(async (): Promise<AdminUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const session = await db.session.findUnique({
    where: { id: hashToken(token) },
    select: { expiresAt: true, admin: { select: { id: true, email: true, name: true, role: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  const role = session.admin.role === "admin" ? "admin" : "moderator";
  return { ...session.admin, role };
});

/**
 * Server-side gate for every admin page and action. Redirects to login when signed out;
 * when signed in without the required role, sends the user to the dashboard.
 * Moderators may only moderate comments; everything else requires "admin".
 */
export async function requireAdmin(role: Role | "any" = "admin"): Promise<AdminUser> {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");
  if (role === "admin" && admin.role !== "admin") redirect("/admin?denied=1");
  return admin;
}

export async function audit(adminId: string, action: string, target?: string, detail?: string) {
  await db.auditLog.create({ data: { adminId, action, target, detail } });
}
