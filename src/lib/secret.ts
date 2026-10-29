import "server-only";
import { createHmac } from "node:crypto";

function appSecret(): string {
  const secret = process.env.APP_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("APP_SECRET must be set to a random string of at least 32 characters");
  }
  return secret;
}

export function hmac(purpose: string, value: string): string {
  return createHmac("sha256", appSecret()).update(`${purpose}:${value}`).digest("hex");
}
