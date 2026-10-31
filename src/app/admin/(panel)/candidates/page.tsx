import type { Metadata } from "next";
import Link from "next/link";
import { StaggerItem, StaggerList } from "@/components/motion";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Candidates" };

export default async function AdminCandidatesPage({ searchParams }: PageProps<"/admin/candidates">) {
  await requireAdmin("admin");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const candidates = await db.candidate.findMany({
    where: q ? { OR: [{ fullName: { contains: q, mode: "insensitive" } }, { membershipNo: { contains: q, mode: "insensitive" } }] } : {},
    orderBy: { fullName: "asc" },
    select: {
      id: true, fullName: true, membershipNo: true, photoKey: true, manifesto: true, isPublished: true, dataNotes: true,
      _count: { select: { candidacies: true, comments: { where: { status: "pending" } } } },
    },
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem]">Candidates</h1>
          <p className="mt-1 text-ink-muted">{candidates.length} {q ? "matching" : "in total"}.</p>
        </div>
        <Link href="/admin/candidates/new" className="btn btn-primary">Add candidate</Link>
      </div>
      {sp.deleted && <p role="status" className="mt-4 rounded-[var(--radius-md)] border border-ok bg-ok-soft px-4 py-3">Candidate deleted.</p>}

      <form action="/admin/candidates" role="search" className="mt-6 flex max-w-lg gap-2">
        <label htmlFor="q" className="sr-only">Search candidates</label>
        <input id="q" name="q" type="search" defaultValue={q} placeholder="Name or membership number" className="input min-w-0" />
        <button type="submit" className="btn btn-secondary shrink-0">Search</button>
      </form>

      {/* Phones: one card per candidate. From 768px up: the full table. */}
      <StaggerList className="mt-6 space-y-3 md:hidden">
        {candidates.map((c) => (
          <StaggerItem key={c.id} className="rounded-[var(--radius-lg)] border border-line bg-surface p-4">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <Link href={`/admin/candidates/${c.id}`} className="link font-semibold [overflow-wrap:anywhere]">{c.fullName}</Link>
              {!c.isPublished && <span className="text-sm text-ink-muted">(hidden)</span>}
              {c.dataNotes && <span className="rounded-[var(--radius-sm)] bg-accent-soft px-1.5 py-0.5 text-xs font-semibold">Check data</span>}
            </div>
            <p className="tabular mt-1 text-[0.9375rem] text-ink-muted">{c.membershipNo ?? "No membership number"}</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[0.9375rem]">
              <div><dt className="text-sm text-ink-muted">Posts</dt><dd className="tabular font-semibold">{c._count.candidacies}</dd></div>
              <div>
                <dt className="text-sm text-ink-muted">Pending comments</dt>
                <dd className="tabular font-semibold">
                  {c._count.comments > 0 ? <Link href={`/admin/comments?candidate=${c.id}`} className="link">{c._count.comments}</Link> : "0"}
                </dd>
              </div>
              <div><dt className="text-sm text-ink-muted">Photo</dt><dd>{c.photoKey ? "Uploaded" : <span className="text-ink-muted">Placeholder</span>}</dd></div>
              <div><dt className="text-sm text-ink-muted">Manifesto</dt><dd>{c.manifesto ? "Published" : <span className="text-ink-muted">Not yet</span>}</dd></div>
            </dl>
          </StaggerItem>
        ))}
        {candidates.length === 0 && <li className="rounded-[var(--radius-lg)] border border-line bg-surface px-4 py-8 text-center text-ink-muted">No candidates match “{q}”.</li>}
      </StaggerList>

      <div className="mt-6 hidden overflow-x-auto rounded-[var(--radius-lg)] border border-line bg-surface md:block">
        <table className="w-full min-w-[44rem] text-left text-[0.9375rem]">
          <thead className="border-b border-line bg-canvas text-ink-muted">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-semibold">Name</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Membership</th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold">Posts</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Photo</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Manifesto</th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold">Pending comments</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {candidates.map((c) => (
              <tr key={c.id} className="hover:bg-canvas">
                <td className="px-4 py-2.5">
                  <Link href={`/admin/candidates/${c.id}`} className="link font-semibold">{c.fullName}</Link>
                  {!c.isPublished && <span className="ml-2 text-sm text-ink-muted">(hidden)</span>}
                  {c.dataNotes && <span className="ml-2 rounded-[var(--radius-sm)] bg-accent-soft px-1.5 py-0.5 text-xs font-semibold">Check data</span>}
                </td>
                <td className="tabular px-4 py-2.5">{c.membershipNo ?? "–"}</td>
                <td className="tabular px-4 py-2.5 text-right">{c._count.candidacies}</td>
                <td className="px-4 py-2.5">{c.photoKey ? "Uploaded" : <span className="text-ink-muted">Placeholder</span>}</td>
                <td className="px-4 py-2.5">{c.manifesto ? "Published" : <span className="text-ink-muted">Not yet</span>}</td>
                <td className="tabular px-4 py-2.5 text-right">
                  {c._count.comments > 0 ? (
                    <Link href={`/admin/comments?candidate=${c.id}`} className="link">{c._count.comments}</Link>
                  ) : (
                    <span className="text-ink-muted">0</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {candidates.length === 0 && <p className="px-4 py-8 text-center text-ink-muted">No candidates match “{q}”.</p>}
      </div>
    </div>
  );
}
