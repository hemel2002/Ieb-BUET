import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { AutoSubmitSelect } from "@/components/AutoSubmitSelect";
import { CandidateCard } from "@/components/CandidateCard";
import { ballot } from "@/lib/candidates";
import { plural } from "@/lib/format";

export const metadata: Metadata = { title: "Candidates" };

const normalise = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export default async function CandidatesPage({ searchParams }: PageProps<"/candidates">) {
  await connection();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const position = typeof params.position === "string" ? params.position : "";
  const groups = await ballot();

  const terms = normalise(q).split(" ").filter(Boolean);
  const matches = (name: string, membershipNo: string | null) => {
    const haystack = normalise(`${name} ${membershipNo ?? ""} ${membershipNo?.replace("/", "") ?? ""}`);
    return terms.every((t) => haystack.includes(t));
  };

  const filtered = groups
    .map((g) => ({
      ...g,
      positions: g.positions
        .filter((p) => !position || g.slug === position || p.slug === position)
        .map((p) => ({ ...p, entries: p.entries.filter((e) => matches(e.candidate.fullName, e.candidate.membershipNo)) }))
        .filter((p) => p.entries.length > 0),
    }))
    .filter((g) => g.positions.length > 0);

  const entryCount = filtered.reduce((n, g) => n + g.positions.reduce((m, p) => m + p.entries.length, 0), 0);
  const people = new Set(filtered.flatMap((g) => g.positions.flatMap((p) => p.entries.map((e) => e.candidate.slug)))).size;
  const isFiltered = Boolean(q || position);

  return (
    <div className="container-site py-12">
      <h1 className="text-[2.25rem] sm:text-[2.75rem]">Candidates</h1>
      <p className="mt-3 max-w-[var(--container-prose)] text-ink-muted">
        Candidates are listed by ballot section and post, in ballot-number order. Several candidates contest more than
        one post and appear under each.
      </p>

      <form role="search" action="/candidates" className="mt-8 grid gap-4 rounded-[var(--radius-lg)] border border-line bg-canvas p-4 sm:p-5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] md:items-end">
        <div>
          <label htmlFor="q" className="field-label">Search by name or membership number</label>
          <input id="q" name="q" type="search" defaultValue={q} className="input" placeholder="e.g. Rahman or F/04266" />
        </div>
        <div>
          <label htmlFor="position" className="field-label">Position</label>
          <AutoSubmitSelect id="position" name="position" defaultValue={position} className="input">
            <option value="">All positions</option>
            {groups.map((g) =>
              g.positions.length === 1 ? (
                <option key={g.id} value={g.slug}>{g.name}</option>
              ) : (
                <optgroup key={g.id} label={g.name}>
                  <option value={g.slug}>All {g.name}</option>
                  {g.positions.map((p) => (
                    <option key={p.id} value={p.slug}>{p.title}</option>
                  ))}
                </optgroup>
              ),
            )}
          </AutoSubmitSelect>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary">Search</button>
          {isFiltered && <Link href="/candidates" className="btn btn-secondary">Clear</Link>}
        </div>
      </form>

      <p className="mt-6 text-[0.9375rem] text-ink-muted" aria-live="polite">
        {entryCount === 0
          ? "No candidates found."
          : `Showing ${plural(entryCount, "ballot entry", "ballot entries")} for ${plural(people, "candidate")}${isFiltered ? " matching your filters" : ""}.`}
      </p>

      {entryCount === 0 ? (
        <div className="mt-6 rounded-[var(--radius-lg)] border border-dashed border-line-strong px-6 py-12 text-center">
          <h2 className="font-sans text-[1.125rem] font-semibold">No candidates match your search</h2>
          <p className="mt-2 text-ink-muted">Check the spelling, try part of the name, or search all positions.</p>
          <Link href="/candidates" className="btn btn-secondary mt-5">Show all candidates</Link>
        </div>
      ) : (
        <div className="mt-4 space-y-14">
          {filtered.map((g) => (
            <section key={g.id} aria-labelledby={`group-${g.slug}`}>
              <h2 id={`group-${g.slug}`} className="border-b-2 border-brand pb-2 text-[1.5rem] sm:text-[1.75rem]">
                {g.name}
              </h2>
              <div className="mt-6 space-y-10">
                {g.positions.map((p) => (
                  <div key={p.id}>
                    {(g.positions.length > 1 || p.title !== g.name) && (
                      <h3 className="mb-4 font-sans text-[1.125rem] font-semibold">
                        {p.title}
                        <span className="ml-2 font-normal text-ink-muted">({p.entries.length})</span>
                      </h3>
                    )}
                    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {p.entries.map((e) => (
                        <li key={e.candidacyId}>
                          <CandidateCard {...e.candidate} ballotNo={e.ballotNo} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
