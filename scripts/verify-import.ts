/**
 * Checks that every entry in data/candidates.json exists in the database with the same
 * section, post, ballot number, membership number and name as printed.
 *   npm run data:verify
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

type Entry = { ballotNo: string | null; post: string | null; name: string; membershipNo: string | null };
const src: { sections: { name: string; entries: Entry[] }[] } = JSON.parse(
  readFileSync(join(__dirname, "../data/candidates.json"), "utf8"),
);

async function main() {
  const db = new PrismaClient();
  const rows = await db.candidacy.findMany({ include: { candidate: true, position: { include: { group: true } } } });
  await db.$disconnect();
  const key = (group: string, post: string, ballot: string | null, member: string | null, name: string) =>
    [group, post, ballot ?? "", member ?? "", name].join(" | ");
  const inDb = new Set(rows.map((r) => key(r.position.group.name, r.position.name, r.ballotNo, r.candidate.membershipNo, r.listedName)));

  const missing: string[] = [];
  let total = 0;
  for (const s of src.sections) {
    for (const e of s.entries) {
      total++;
      const k = key(s.name, e.post ?? s.name, e.ballotNo, e.membershipNo, e.name);
      if (!inDb.has(k)) missing.push(k);
    }
  }
  console.log(`${total - missing.length} of ${total} spreadsheet entries match the database exactly.`);
  if (rows.length !== total) console.log(`Note: the database has ${rows.length} ballot entries (spreadsheet: ${total}).`);
  for (const m of missing) console.log(`  missing or different: ${m}`);
  if (missing.length) process.exitCode = 1;
}

main();
