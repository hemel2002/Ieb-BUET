/**
 * Build-time database step for `vercel-build`.
 *
 * Migrations and the first-run import touch the database, so they run only for production
 * deployments (VERCEL_ENV=production) or when MIGRATE_ON_BUILD=true is set explicitly (for
 * example on a Preview environment that has its own Neon branch). Preview builds of
 * unmerged branches therefore never change the production database.
 */
import { execFileSync } from "node:child_process";

const env = process.env.VERCEL_ENV;
if (env !== "production" && process.env.MIGRATE_ON_BUILD !== "true") {
  console.log(`Skipping database migrations and import (VERCEL_ENV=${env ?? "unset"}, MIGRATE_ON_BUILD not "true").`);
  process.exit(0);
}
const run = (cmd, args) => execFileSync(cmd, args, { stdio: "inherit" });
run("npx", ["prisma", "migrate", "deploy"]);
run("npx", ["tsx", "prisma/seed.ts", "--if-empty"]);
