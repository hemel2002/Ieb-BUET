import "server-only";
import { headers } from "next/headers";

/**
 * Best-effort client IP. Behind a reverse proxy set TRUSTED_IP_HEADER to the header
 * the proxy overwrites (e.g. x-real-ip); otherwise the last X-Forwarded-For hop is used,
 * because earlier hops are supplied by the client and can be forged.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const trusted = process.env.TRUSTED_IP_HEADER?.trim().toLowerCase();
  if (trusted) {
    const value = h.get(trusted)?.trim();
    if (value) return value;
  }
  const hops = h.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean);
  return hops?.at(-1) ?? "unknown";
}
