/**
 * Create or reset an administrator account.
 *
 *   npm run admin:create -- --email you@example.org --name "Your Name" [--role admin|moderator]
 *
 * The password is read from the ADMIN_PASSWORD environment variable if set, otherwise
 * it is prompted for (input hidden). Re-running for an existing email resets the
 * password and role and signs out that account's sessions.
 */
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";
import { PrismaClient } from "@prisma/client";
import { hashPassword, PASSWORD_MIN_LENGTH } from "../src/lib/password";

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const write = (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput;
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) =>
      write.call(rl, s.startsWith(question) ? s : "");
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function main() {
  const { values } = parseArgs({
    options: { email: { type: "string" }, name: { type: "string" }, role: { type: "string", default: "admin" } },
  });
  const email = values.email?.trim().toLowerCase();
  const role = values.role;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Pass a valid --email");
  if (role !== "admin" && role !== "moderator") throw new Error("--role must be admin or moderator");

  const password = process.env.ADMIN_PASSWORD || (await promptHidden("Password: "));
  if (password.length < PASSWORD_MIN_LENGTH) throw new Error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  if (!process.env.ADMIN_PASSWORD && (await promptHidden("Repeat password: ")) !== password) throw new Error("Passwords do not match");

  const db = new PrismaClient();
  try {
    const passwordHash = await hashPassword(password);
    const name = values.name?.trim() || email.split("@")[0];
    const existing = await db.admin.findUnique({ where: { email } });
    if (existing) {
      await db.admin.update({ where: { email }, data: { passwordHash, role, ...(values.name && { name }) } });
      await db.session.deleteMany({ where: { adminId: existing.id } });
      console.log(`Updated ${email} (${role}). Existing sessions were signed out.`);
    } else {
      await db.admin.create({ data: { email, name, role, passwordHash } });
      console.log(`Created ${role} ${email}.`);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
