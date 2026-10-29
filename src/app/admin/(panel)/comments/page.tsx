import type { Metadata } from "next";
import Link from "next/link";
import { AutoSubmitSelect } from "@/components/AutoSubmitSelect";
import { SubmitButton } from "@/components/SubmitButton";
import { requireAdmin } from "@/lib/auth";
import { COMMENT_STATUSES, isCommentStatus } from "@/lib/comments";
import { db } from "@/lib/db";
import { formatDateTime, plural } from "@/lib/format";
import { moderateComment } from "./actions";

export const metadata: Metadata = { title: "Comments" };

const PAGE_SIZE = 25;
const STATUS_STYLE: Record<string, string> = {
  pending: "border-accent bg-accent-soft text-ink",
  approved: "border-ok bg-ok-soft text-ok",
  rejected: "border-brand bg-brand-soft text-brand-strong",
};
const STATUS_LABEL: Record<string, string> = { pending: "Pending", approved: "Approved", rejected: "Rejected" };

export default async function CommentsPage({ searchParams }: PageProps<"/admin/comments">) {
  const admin = await requireAdmin("any");
  const sp = await searchParams;
  const status = sp.status === "all" ? "all" : isCommentStatus(sp.status) ? sp.status : "pending";
  const candidateId = typeof sp.candidate === "string" ? sp.candidate : "";
  const page = Math.max(1, Number(sp.page) || 1);

  const where = {
    ...(status !== "all" && { status }),
    ...(candidateId && { candidateId }),
  };
  const [comments, total, counts, candidates] = await Promise.all([
    db.comment.findMany({
      where,
      orderBy: { createdAt: status === "pending" ? "asc" : "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, body: true, status: true, isAnonymous: true, displayName: true, createdAt: true, moderatedAt: true,
        moderatedBy: { select: { name: true } },
        candidate: { select: { id: true, slug: true, fullName: true } },
      },
    }),
    db.comment.count({ where }),
    db.comment.groupBy({ by: ["status"], _count: true, where: candidateId ? { candidateId } : {} }),
    db.candidate.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true, membershipNo: true } }),
  ]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (over: Record<string, string | number>) => {
    const p = new URLSearchParams({ status, ...(candidateId && { candidate: candidateId }), ...Object.fromEntries(Object.entries(over).map(([k, v]) => [k, String(v)])) });
    return `/admin/comments?${p}`;
  };

  return (
    <div>
      <h1 className="text-[1.75rem]">Comments</h1>
      <p className="mt-1 text-ink-muted">Only approved comments appear on the public site. Pending comments are listed oldest first.</p>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
          {[...COMMENT_STATUSES, "all" as const].map((s) => (
            <Link
              key={s}
              href={qs({ status: s, page: 1 })}
              aria-current={status === s ? "page" : undefined}
              className={`btn btn-sm ${status === s ? "btn-primary" : "btn-secondary"}`}
            >
              {s === "all" ? "All" : STATUS_LABEL[s]}
              <span className="tabular">({s === "all" ? COMMENT_STATUSES.reduce((n, x) => n + countOf(x), 0) : countOf(s)})</span>
            </Link>
          ))}
        </nav>
        <form action="/admin/comments" className="flex items-end gap-2">
          <input type="hidden" name="status" value={status} />
          <div>
            <label htmlFor="candidate" className="field-label">Candidate</label>
            <AutoSubmitSelect id="candidate" name="candidate" defaultValue={candidateId} className="input min-w-[16rem] max-w-[22rem]">
              <option value="">All candidates</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>{c.fullName}{c.membershipNo ? ` (${c.membershipNo})` : ""}</option>
              ))}
            </AutoSubmitSelect>
          </div>
          <noscript><button type="submit" className="btn btn-secondary">Filter</button></noscript>
        </form>
      </div>

      {comments.length === 0 ? (
        <div className="mt-6 rounded-[var(--radius-lg)] border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
          <h2 className="font-sans text-[1.0625rem] font-semibold">
            {status === "pending" ? "No comments are waiting for review" : "No comments match this filter"}
          </h2>
          <p className="mt-1 text-ink-muted">New submissions appear here as pending.</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="rounded-[var(--radius-lg)] border border-line bg-surface p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[0.9375rem] text-ink-muted">
                    On{" "}
                    {admin.role === "admin" ? (
                      <Link href={`/admin/candidates/${c.candidate.id}`} className="link font-semibold">{c.candidate.fullName}</Link>
                    ) : (
                      <span className="font-semibold text-ink">{c.candidate.fullName}</span>
                    )}
                    {" "}(<a href={`/candidates/${c.candidate.slug}#comments`} className="link" target="_blank" rel="noopener">public page</a>)
                  </p>
                  <p className="mt-1 font-semibold">
                    {c.isAnonymous ? <span className="text-ink-muted">Anonymous</span> : c.displayName}
                    <span className="ml-2 text-sm font-normal text-ink-muted">submitted {formatDateTime(c.createdAt)}</span>
                  </p>
                </div>
                <span className={`rounded-[var(--radius-sm)] border px-2 py-0.5 text-sm font-semibold ${STATUS_STYLE[c.status]}`}>
                  {STATUS_LABEL[c.status] ?? c.status}
                </span>
              </div>
              <p className="mt-3 whitespace-pre-line [overflow-wrap:anywhere]">{c.body}</p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                <p className="text-sm text-ink-muted">
                  {c.moderatedAt ? `${STATUS_LABEL[c.status]} ${formatDateTime(c.moderatedAt)}${c.moderatedBy ? ` by ${c.moderatedBy.name}` : ""}` : "Not yet reviewed"}
                </p>
                <form action={moderateComment} className="flex flex-wrap gap-2">
                  <input type="hidden" name="id" value={c.id} />
                  {c.status !== "approved" && <SubmitButton size="sm" name="op" value="approve">Approve</SubmitButton>}
                  {c.status !== "rejected" && <SubmitButton size="sm" variant="secondary" name="op" value="reject">Reject</SubmitButton>}
                  {c.status !== "pending" && <SubmitButton size="sm" variant="secondary" name="op" value="pending">Return to pending</SubmitButton>}
                  <SubmitButton size="sm" variant="danger" name="op" value="delete" confirm="Delete this comment permanently?">Delete</SubmitButton>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-between gap-4 text-[0.9375rem]">
          <span className="text-ink-muted">Page {page} of {pages}, {plural(total, "comment")}</span>
          <span className="flex gap-2">
            {page > 1 && <Link href={qs({ page: page - 1 })} className="btn btn-secondary btn-sm">Previous</Link>}
            {page < pages && <Link href={qs({ page: page + 1 })} className="btn btn-secondary btn-sm">Next</Link>}
          </span>
        </nav>
      )}
    </div>
  );
}
