import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { compareBallot } from "./format";

export const candidacyInclude = {
  position: { include: { group: true } },
} satisfies Prisma.CandidacyInclude;

export type CandidacyWithPosition = Prisma.CandidacyGetPayload<{ include: typeof candidacyInclude }>;
type PositionWithGroup = CandidacyWithPosition["position"];

/** "Member" positions read better under their group's name, e.g. "Civil Engineering Division - Member". */
export function positionTitle(position: PositionWithGroup): string {
  return position.name === "Member" ? position.group.name : position.name;
}

/** The group shown under a position title, or null when the title already says it. */
export function positionContext(position: PositionWithGroup): string | null {
  const title = positionTitle(position);
  return title === position.group.name ? null : position.group.name;
}

export function sortCandidacies<T extends CandidacyWithPosition>(list: T[]): T[] {
  return [...list].sort(
    (a, b) =>
      a.position.group.displayOrder - b.position.group.displayOrder ||
      a.position.displayOrder - b.position.displayOrder ||
      compareBallot(a.ballotNo, b.ballotNo),
  );
}

export type BallotEntry = {
  candidacyId: number;
  ballotNo: string | null;
  candidate: { slug: string; fullName: string; membershipNo: string | null; photoKey: string | null };
};

export type PositionWithEntries = {
  id: number;
  slug: string;
  title: string;
  context: string | null;
  entries: BallotEntry[];
};

export type GroupWithPositions = {
  id: number;
  slug: string;
  name: string;
  positions: PositionWithEntries[];
};

/** The whole published ballot, grouped by section and position, in source order. */
export async function ballot(): Promise<GroupWithPositions[]> {
  const groups = await db.positionGroup.findMany({
    orderBy: { displayOrder: "asc" },
    include: {
      positions: {
        orderBy: { displayOrder: "asc" },
        include: {
          candidacies: {
            where: { candidate: { isPublished: true } },
            include: {
              candidate: { select: { slug: true, fullName: true, membershipNo: true, photoKey: true } },
            },
          },
        },
      },
    },
  });
  return groups.map((g) => ({
    id: g.id,
    slug: g.slug,
    name: g.name,
    positions: g.positions.map((p) => {
      const withGroup = { ...p, group: g };
      return {
        id: p.id,
        slug: p.slug,
        title: positionTitle(withGroup),
        context: positionContext(withGroup),
        entries: p.candidacies
          .sort((a, b) => compareBallot(a.ballotNo, b.ballotNo))
          .map((c) => ({ candidacyId: c.id, ballotNo: c.ballotNo, candidate: c.candidate })),
      };
    }),
  }));
}

export async function publishedCandidate(slug: string) {
  const candidate = await db.candidate.findFirst({
    where: { slug, isPublished: true },
    include: { candidacies: { include: candidacyInclude } },
  });
  if (!candidate) return null;
  return { ...candidate, candidacies: sortCandidacies(candidate.candidacies) };
}

export async function siteContent(): Promise<Record<string, string>> {
  const rows = await db.siteContent.findMany();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export const SITE_CONTENT_KEYS = {
  vision: "campaignVision",
  about: "aboutCampaign",
} as const;
