import type { Metadata } from "next";
import Link from "next/link";
import { AdminCandidateList } from "@/components/admin/AdminCandidateList";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Candidates" };

export default async function AdminCandidatesPage({ searchParams }: PageProps<"/admin/candidates">) {
  await requireAdmin("admin");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  // The whole list is loaded (about a hundred rows) and filtered in the browser as the admin types.
  const candidates = await db.candidate.findMany({
    orderBy: { fullName: "asc" },
    select: {
      id: true, fullName: true, membershipNo: true, photoKey: true, manifesto: true, isPublished: true, dataNotes: true,
      _count: { select: { candidacies: true, comments: { where: { status: "pending" } } } },
    },
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-[1.75rem]">Candidates</h1>
        <Link href="/admin/candidates/new" className="btn btn-primary">Add candidate</Link>
      </div>
      {sp.deleted && <p role="status" className="mt-4 rounded-[var(--radius-md)] border border-ok bg-ok-soft px-4 py-3">Candidate deleted.</p>}

      <AdminCandidateList
        initialQuery={q}
        candidates={candidates.map((c) => ({
          id: c.id,
          fullName: c.fullName,
          membershipNo: c.membershipNo,
          isPublished: c.isPublished,
          needsCheck: Boolean(c.dataNotes),
          posts: c._count.candidacies,
          pendingComments: c._count.comments,
          hasPhoto: Boolean(c.photoKey),
          hasManifesto: Boolean(c.manifesto),
        }))}
      />
    </div>
  );
}
