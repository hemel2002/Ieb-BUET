"use client";

import { motion } from "framer-motion";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { plural } from "@/lib/format";
import type { GroupWithPositions } from "@/lib/candidates";
import { CandidateCard } from "./CandidateCard";
import { EASE, Reveal } from "./motion";

const normalise = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/**
 * The candidate directory with live filtering: results update on every keystroke and every change of the
 * post selector, with no button to press. The filter is mirrored into the URL so a filtered view can be
 * shared, and the server renders the same filter from the URL, so the form also works without JavaScript.
 */
export function CandidateDirectory({
  groups,
  initialQuery,
  initialPosition,
}: {
  groups: GroupWithPositions[];
  initialQuery: string;
  initialPosition: string;
}) {
  const [q, setQ] = useState(initialQuery);
  const [position, setPosition] = useState(initialPosition);
  // Typing stays instant; filtering the list yields to it when the device is slow.
  const deferredQ = useDeferredValue(q);

  useEffect(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (position) params.set("position", position);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [q, position]);

  const filtered = useMemo(() => {
    const terms = normalise(deferredQ).split(" ").filter(Boolean);
    const matches = (name: string, membershipNo: string | null) => {
      const haystack = normalise(`${name} ${membershipNo ?? ""} ${membershipNo?.replace("/", "") ?? ""}`);
      return terms.every((t) => haystack.includes(t));
    };
    return groups
      .map((g) => ({
        ...g,
        positions: g.positions
          .filter((p) => !position || g.slug === position || p.slug === position)
          .map((p) => ({ ...p, entries: p.entries.filter((e) => matches(e.candidate.fullName, e.candidate.membershipNo)) }))
          .filter((p) => p.entries.length > 0),
      }))
      .filter((g) => g.positions.length > 0);
  }, [groups, deferredQ, position]);

  const entryCount = filtered.reduce((n, g) => n + g.positions.reduce((m, p) => m + p.entries.length, 0), 0);
  const people = new Set(filtered.flatMap((g) => g.positions.flatMap((p) => p.entries.map((e) => e.candidate.slug)))).size;
  const isFiltered = Boolean(q.trim() || position);
  const clear = () => {
    setQ("");
    setPosition("");
  };

  // Running card number across the page, so newly shown cards cascade in without a long delay.
  let cardIndex = 0;

  return (
    <>
      <Reveal immediate delay={0.08}>
        <form
          role="search"
          action="/candidates"
          // Enter keeps the live results instead of reloading the page.
          onSubmit={(e) => e.preventDefault()}
          className="mt-8 grid gap-4 rounded-[var(--radius-lg)] border border-line bg-canvas p-4 sm:p-5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] md:items-end"
        >
          <div>
            <label htmlFor="q" className="field-label">Search by name or membership number</label>
            <input
              id="q"
              name="q"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="input"
              placeholder="Start typing, e.g. Rahman or F/04266"
              autoComplete="off"
              enterKeyHint="search"
            />
          </div>
          <div>
            <label htmlFor="position" className="field-label">Position</label>
            <select id="position" name="position" value={position} onChange={(e) => setPosition(e.target.value)} className="input">
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
            </select>
          </div>
          <div className="flex gap-2 [&>*]:flex-1 md:[&>*]:flex-none">
            {/* Only needed without JavaScript; with it the list filters as you type. */}
            <noscript><button type="submit" className="btn btn-primary">Search</button></noscript>
            {isFiltered && <button type="button" onClick={clear} className="btn btn-secondary">Clear</button>}
          </div>
        </form>
      </Reveal>

      <p className="mt-6 text-[0.9375rem] text-ink-muted" aria-live="polite">
        {entryCount === 0
          ? "No candidates found."
          : `Showing ${plural(entryCount, "ballot entry", "ballot entries")} for ${plural(people, "candidate")}${isFiltered ? " matching your filters" : ""}.`}
      </p>

      {entryCount === 0 ? (
        <Reveal className="mt-6 rounded-[var(--radius-lg)] border border-dashed border-line-strong px-6 py-12 text-center">
          <h2 className="font-sans text-[1.125rem] font-semibold">No candidates match your search</h2>
          <p className="mt-2 text-ink-muted">Check the spelling, try part of the name, or search all positions.</p>
          <button type="button" onClick={clear} className="btn btn-secondary mt-5">Show all candidates</button>
        </Reveal>
      ) : (
        <div className="mt-4 space-y-12 sm:space-y-14">
          {filtered.map((g) => (
            <section key={g.id} aria-labelledby={`group-${g.slug}`}>
              <Reveal>
                <h2 id={`group-${g.slug}`} className="title-section border-b-2 border-brand pb-2">
                  {g.name}
                </h2>
              </Reveal>
              <div className="mt-6 space-y-10">
                {g.positions.map((p) => (
                  <div key={p.id}>
                    {(g.positions.length > 1 || p.title !== g.name) && (
                      <h3 className="mb-4 font-sans text-[1.125rem] font-semibold">
                        {p.title}
                        <span className="ml-2 font-normal text-ink-muted">({p.entries.length})</span>
                      </h3>
                    )}
                    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                      {p.entries.map((e) => (
                        // layout="position": cards glide to their new place as others are filtered out.
                        <motion.li
                          key={e.candidacyId}
                          layout="position"
                          initial={{ opacity: 0, y: 12 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true, margin: "0px 0px -6% 0px" }}
                          whileHover={{ y: -3, transition: { duration: 0.18 } }}
                          transition={{ duration: 0.4, ease: EASE, delay: Math.min(cardIndex++, 10) * 0.04 }}
                        >
                          <CandidateCard {...e.candidate} ballotNo={e.ballotNo} />
                        </motion.li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
