/**
 * Imports data/candidates.json (produced from the spreadsheet by scripts/extract_xlsx.py).
 *
 * Run on every Vercel deploy with --if-empty (imports only into an empty database).
 * Safe to re-run manually: groups, positions, candidates and candidacies are matched on their
 * natural keys and only created when missing. Existing rows, including anything an
 * administrator has edited, are never overwritten. Conflicts are reported, not applied.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { candidateSlug, slugify } from "../src/lib/slug";
import { hashPassword, PASSWORD_MIN_LENGTH } from "../src/lib/password";

type Entry = {
  ballotNo: string | null;
  post: string | null;
  name: string;
  membershipNo: string | null;
  sourceRow: number;
  sourceSide: "left" | "right";
};
type Source = { title: string; subtitle: string; sections: { name: string; entries: Entry[] }[] };

const db = new PrismaClient();

async function main() {
  // Deploys pass --if-empty so records an administrator deleted are not re-imported.
  if (process.argv.includes("--if-empty") && (await db.candidate.count()) > 0) {
    console.log("Candidates already imported; skipping spreadsheet import (--if-empty).");
    await seedFirstAdmin();
    return;
  }
  const src: Source = JSON.parse(readFileSync(join(__dirname, "../data/candidates.json"), "utf8"));
  const stats = { groups: 0, positions: 0, candidates: 0, candidacies: 0, skipped: 0, conflicts: 0 };

  // Flatten in sheet order: each section's left table first, then its right table.
  const rows = src.sections.flatMap((section, groupIndex) =>
    [...section.entries]
      .sort((a, b) => (a.sourceSide === b.sourceSide ? a.sourceRow - b.sourceRow : a.sourceSide === "left" ? -1 : 1))
      .map((e) => ({ ...e, group: section.name, groupIndex, post: e.post ?? section.name })),
  );

  // Data-quality notes per membership number, kept for administrators only.
  const byMember = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = r.membershipNo ?? `name:${r.name}`;
    byMember.set(key, [...(byMember.get(key) ?? []), r]);
  }
  const notes = new Map<string, string[]>();
  const addNote = (key: string, note: string) => notes.set(key, [...(notes.get(key) ?? []), note]);
  for (const [key, list] of byMember) {
    const names = [...new Set(list.map((r) => r.name))];
    if (names.length > 1) addNote(key, `Name is spelled differently across entries in the source list: ${names.map((n) => `"${n}"`).join(" / ")}`);
    const perGroup = new Map<string, string[]>();
    for (const r of list) perGroup.set(r.group, [...(perGroup.get(r.group) ?? []), r.post]);
    for (const [group, posts] of perGroup) {
      if (posts.length > 1) addNote(key, `Listed for more than one post in "${group}": ${posts.join(", ")}. Please confirm.`);
    }
  }
  const byName = new Map<string, Set<string>>();
  for (const r of rows) {
    const n = r.name.replace(/,\s*PEng\.?$/i, "");
    byName.set(n, (byName.get(n) ?? new Set()).add(r.membershipNo ?? "?"));
  }
  for (const [name, members] of byName) {
    if (members.size < 2) continue;
    for (const m of members) {
      addNote(m, `Another entry with the same name ("${name}") has a different membership number (${[...members].filter((x) => x !== m).join(", ")}). Treated as separate people; please confirm.`);
    }
  }

  const positionOrder = new Map<string, number>();
  for (const r of rows) {
    const group = await upsertGroup(r.group, r.groupIndex + 1, stats);
    const posKey = `${r.group}::${r.post}`;
    if (!positionOrder.has(posKey)) positionOrder.set(posKey, positionOrder.size + 1);
    const position = await upsertPosition(group.id, group.slug, r.post, positionOrder.get(posKey)!, stats);

    const memberKey = r.membershipNo ?? `name:${r.name}`;
    let candidate = r.membershipNo
      ? await db.candidate.findUnique({ where: { membershipNo: r.membershipNo } })
      : await db.candidate.findFirst({ where: { fullName: r.name, membershipNo: null } });
    if (!candidate) {
      candidate = await db.candidate.create({
        data: {
          fullName: r.name,
          membershipNo: r.membershipNo,
          slug: await uniqueSlug(candidateSlug(r.name, r.membershipNo)),
          dataNotes: notes.get(memberKey)?.join("\n") ?? null,
        },
      });
      stats.candidates++;
    }

    const existing = await db.candidacy.findUnique({
      where: { candidateId_positionId: { candidateId: candidate.id, positionId: position.id } },
    });
    if (existing) {
      if (existing.ballotNo !== r.ballotNo) {
        stats.conflicts++;
        console.warn(`! Ballot no. differs for ${r.name} / ${r.post}: database has ${existing.ballotNo}, sheet has ${r.ballotNo}. Left unchanged.`);
      } else stats.skipped++;
      continue;
    }
    const ballotTaken = r.ballotNo
      ? await db.candidacy.findUnique({ where: { positionId_ballotNo: { positionId: position.id, ballotNo: r.ballotNo } } })
      : null;
    if (ballotTaken) {
      stats.conflicts++;
      console.warn(`! Ballot no. ${r.ballotNo} for ${r.post} is already used by another candidate. Skipped ${r.name}.`);
      continue;
    }
    await db.candidacy.create({
      data: {
        candidateId: candidate.id,
        positionId: position.id,
        ballotNo: r.ballotNo,
        listedName: r.name,
        source: `xlsx row ${r.sourceRow} (${r.sourceSide})`,
      },
    });
    stats.candidacies++;
  }

  await seedFirstAdmin();
  console.log(
    `Import complete. Created: ${stats.groups} groups, ${stats.positions} positions, ${stats.candidates} candidates, ` +
      `${stats.candidacies} ballot entries. Already present: ${stats.skipped}. Conflicts: ${stats.conflicts}.`,
  );
}

async function upsertGroup(name: string, order: number, stats: { groups: number }) {
  const found = await db.positionGroup.findUnique({ where: { name } });
  if (found) return found;
  stats.groups++;
  return db.positionGroup.create({ data: { name, slug: slugify(name), displayOrder: order } });
}

async function upsertPosition(groupId: number, groupSlug: string, name: string, order: number, stats: { positions: number }) {
  const found = await db.position.findUnique({ where: { groupId_name: { groupId, name } } });
  if (found) return found;
  stats.positions++;
  const slug = name === "Member" || slugify(name) === groupSlug ? groupSlug : `${groupSlug}--${slugify(name)}`;
  return db.position.create({ data: { groupId, name, slug, displayOrder: order } });
}

async function uniqueSlug(base: string) {
  let slug = base;
  for (let i = 2; await db.candidate.findUnique({ where: { slug } }); i++) slug = `${base}-${i}`;
  return slug;
}

async function seedFirstAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  if ((await db.admin.count()) > 0) {
    console.log("Administrators already exist; ADMIN_EMAIL/ADMIN_PASSWORD ignored.");
    return;
  }
  if (password.length < PASSWORD_MIN_LENGTH) throw new Error(`ADMIN_PASSWORD must be at least ${PASSWORD_MIN_LENGTH} characters`);
  await db.admin.create({ data: { email, name: "Administrator", role: "admin", passwordHash: await hashPassword(password) } });
  console.log(`Created administrator ${email}. Remove ADMIN_PASSWORD from the environment now.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
