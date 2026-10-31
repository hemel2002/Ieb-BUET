"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { StaggerItem, StaggerList } from "../motion";

export type AdminCandidateRow = {
  id: string;
  fullName: string;
  membershipNo: string | null;
  isPublished: boolean;
  needsCheck: boolean;
  posts: number;
  pendingComments: number;
  hasPhoto: boolean;
  hasManifesto: boolean;
};

const normalise = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Candidate list with live search: it filters as you type, so no Search button is needed. */
export function AdminCandidateList({ candidates, initialQuery }: { candidates: AdminCandidateRow[]; initialQuery: string }) {
  const [q, setQ] = useState(initialQuery);
  const deferredQ = useDeferredValue(q);

  useEffect(() => {
    const trimmed = q.trim();
    window.history.replaceState(null, "", trimmed ? `?q=${encodeURIComponent(trimmed)}` : window.location.pathname);
  }, [q]);

  const shown = useMemo(() => {
    const terms = normalise(deferredQ).split(" ").filter(Boolean);
    if (terms.length === 0) return candidates;
    return candidates.filter((c) => {
      const haystack = normalise(`${c.fullName} ${c.membershipNo ?? ""} ${c.membershipNo?.replace("/", "") ?? ""}`);
      return terms.every((t) => haystack.includes(t));
    });
  }, [candidates, deferredQ]);

  const filtered = q.trim() !== "";

  return (
    <>
      <form action="/admin/candidates" role="search" onSubmit={(e) => e.preventDefault()} className="mt-6 flex max-w-lg gap-2">
        <label htmlFor="q" className="sr-only">Search candidates</label>
        <input
          id="q"
          name="q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Type a name or membership number"
          autoComplete="off"
          enterKeyHint="search"
          className="input min-w-0"
        />
        <noscript><button type="submit" className="btn btn-secondary shrink-0">Search</button></noscript>
        {filtered && <button type="button" onClick={() => setQ("")} className="btn btn-secondary shrink-0">Clear</button>}
      </form>
      <p className="mt-3 text-ink-muted" aria-live="polite">{shown.length} {filtered ? "matching" : "in total"}.</p>

      {/* Phones: one card per candidate. From 768px up: the full table. */}
      <StaggerList className="mt-4 space-y-3 md:hidden">
        {shown.map((c) => (
          <StaggerItem key={c.id} className="rounded-[var(--radius-lg)] border border-line bg-surface p-4">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <Link href={`/admin/candidates/${c.id}`} className="link font-semibold [overflow-wrap:anywhere]">{c.fullName}</Link>
              {!c.isPublished && <span className="text-sm text-ink-muted">(hidden)</span>}
              {c.needsCheck && <span className="rounded-[var(--radius-sm)] bg-accent-soft px-1.5 py-0.5 text-xs font-semibold">Check data</span>}
            </div>
            <p className="tabular mt-1 text-[0.9375rem] text-ink-muted">{c.membershipNo ?? "No membership number"}</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[0.9375rem]">
              <div><dt className="text-sm text-ink-muted">Posts</dt><dd className="tabular font-semibold">{c.posts}</dd></div>
              <div>
                <dt className="text-sm text-ink-muted">Pending comments</dt>
                <dd className="tabular font-semibold">
                  {c.pendingComments > 0 ? <Link href={`/admin/comments?candidate=${c.id}`} className="link">{c.pendingComments}</Link> : "0"}
                </dd>
              </div>
              <div><dt className="text-sm text-ink-muted">Photo</dt><dd>{c.hasPhoto ? "Uploaded" : <span className="text-ink-muted">Placeholder</span>}</dd></div>
              <div><dt className="text-sm text-ink-muted">Manifesto</dt><dd>{c.hasManifesto ? "Published" : <span className="text-ink-muted">Not yet</span>}</dd></div>
            </dl>
          </StaggerItem>
        ))}
        {shown.length === 0 && (
          <li className="rounded-[var(--radius-lg)] border border-line bg-surface px-4 py-8 text-center text-ink-muted">No candidates match “{q.trim()}”.</li>
        )}
      </StaggerList>

      <div className="mt-4 hidden overflow-x-auto rounded-[var(--radius-lg)] border border-line bg-surface md:block">
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
            {shown.map((c) => (
              <tr key={c.id} className="hover:bg-canvas">
                <td className="px-4 py-2.5">
                  <Link href={`/admin/candidates/${c.id}`} className="link font-semibold">{c.fullName}</Link>
                  {!c.isPublished && <span className="ml-2 text-sm text-ink-muted">(hidden)</span>}
                  {c.needsCheck && <span className="ml-2 rounded-[var(--radius-sm)] bg-accent-soft px-1.5 py-0.5 text-xs font-semibold">Check data</span>}
                </td>
                <td className="tabular px-4 py-2.5">{c.membershipNo ?? "–"}</td>
                <td className="tabular px-4 py-2.5 text-right">{c.posts}</td>
                <td className="px-4 py-2.5">{c.hasPhoto ? "Uploaded" : <span className="text-ink-muted">Placeholder</span>}</td>
                <td className="px-4 py-2.5">{c.hasManifesto ? "Published" : <span className="text-ink-muted">Not yet</span>}</td>
                <td className="tabular px-4 py-2.5 text-right">
                  {c.pendingComments > 0 ? (
                    <Link href={`/admin/comments?candidate=${c.id}`} className="link">{c.pendingComments}</Link>
                  ) : (
                    <span className="text-ink-muted">0</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className="px-4 py-8 text-center text-ink-muted">No candidates match “{q.trim()}”.</p>}
      </div>
    </>
  );
}
