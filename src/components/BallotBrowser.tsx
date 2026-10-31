"use client";

import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useRef, useState } from "react";
import type { GroupWithPositions } from "@/lib/candidates";
import { Emoji } from "./motion";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Rows past the first dozen share one delay, so a 68-row list never feels slow. */
const rowDelay = (index: number) => Math.min(index, 12) * 0.03;

/**
 * Landing page: pick a ballot section, see who is standing for which post.
 * Only the name, ballot number and IEB membership ID are shown, no photos.
 */
export function BallotBrowser({ groups }: { groups: GroupWithPositions[] }) {
  const [activeId, setActiveId] = useState(groups[0]?.id);
  const active = groups.find((g) => g.id === activeId) ?? groups[0];
  const reduceMotion = useReducedMotion();
  const listRef = useRef<HTMLDivElement>(null);

  return (
    <MotionConfig reducedMotion="user">
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <h1 className="title-page">BUETians in IEB Election</h1>
        <p className="mt-3 max-w-xl text-[1.0625rem] text-ink-muted sm:text-[1.1875rem]">
          <Emoji>🗳️</Emoji> BUET alumni candidates, IEB Election 2027-2028. Choose a post to see who is standing.
        </p>
      </motion.header>

      {active ? (
        <>
          {/* Every post is always visible: the chips wrap onto as many lines as the screen needs, never scroll sideways. */}
          <motion.div
            role="group"
            aria-label="Posts"
            className="mt-6 flex flex-wrap gap-1.5 sm:gap-2"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08, ease: EASE }}
          >
            {groups.map((g) => {
              const selected = g.id === active.id;
              const total = g.positions.reduce((n, p) => n + p.entries.length, 0);
              return (
                <motion.button
                  key={g.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setActiveId(g.id);
                    // On a phone the chips can fill the screen, so bring the chosen list up under them.
                    const list = listRef.current;
                    if (list && list.getBoundingClientRect().top > window.innerHeight * 0.5) {
                      list.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
                    }
                  }}
                  whileTap={{ scale: 0.97 }}
                  className={`relative max-w-full rounded-full border px-3 py-1.5 text-left text-[0.875rem] font-medium leading-snug transition-colors duration-[var(--dur-short)] sm:px-4 sm:py-2 sm:text-[0.9375rem] ${
                    selected ? "border-brand text-white" : "border-line-strong text-ink hover:border-ink"
                  }`}
                >
                  {selected && (
                    <motion.span
                      layoutId="active-post"
                      className="absolute inset-0 rounded-full bg-brand"
                      transition={{ type: "spring", stiffness: 420, damping: 36 }}
                    />
                  )}
                  <span className="relative">
                    {g.name}
                    <span className={`tabular ml-2 ${selected ? "text-white/85" : "text-ink-muted"}`}>{total}</span>
                  </span>
                </motion.button>
              );
            })}
          </motion.div>

          <div ref={listRef} className="mt-8 scroll-mt-4 sm:mt-10">
            <AnimatePresence mode="wait" initial={false}>
              <motion.section
                key={active.id}
                aria-labelledby="active-post-heading"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } }}
                exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
              >
                <Panel group={active} />
              </motion.section>
            </AnimatePresence>
          </div>
        </>
      ) : (
        <p className="mt-10 text-ink-muted">No candidates have been published yet.</p>
      )}
    </MotionConfig>
  );
}

function Panel({ group }: { group: GroupWithPositions }) {
  const showTitles = (p: GroupWithPositions["positions"][number]) =>
    group.positions.length > 1 || p.title !== group.name;

  // Running row number across all posts in this section, for the entrance stagger.
  let rowIndex = 0;

  return (
    <>
      <h2 id="active-post-heading" className="title-section border-b-2 border-brand pb-2">
        {group.name}
      </h2>
      <div className="mt-6 space-y-10">
        {group.positions.map((p) => (
          <div key={p.id}>
            {showTitles(p) && (
              <h3 className="mb-2 px-3 font-sans text-[1.0625rem] font-semibold">
                {p.title}
                <span className="ml-2 font-normal text-ink-muted">({p.entries.length})</span>
              </h3>
            )}
            {/* Two rows per line from 1024px up. Each row is its own container, so it lays out by its own width. */}
            <ul className="grid border-t border-line lg:grid-cols-2 lg:gap-x-12">
              {p.entries.map((e) => (
                <motion.li
                  key={e.candidacyId}
                  className="@container border-b border-line"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: rowDelay(rowIndex++), ease: EASE }}
                >
                  <Link
                    href={`/candidates/${e.candidate.slug}`}
                    className="group flex items-center gap-4 px-3 py-3 transition-colors duration-[var(--dur-short)] hover:bg-canvas"
                  >
                    <span
                      className="tabular flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-accent bg-accent-soft font-serif text-[1.375rem] font-semibold"
                      aria-label={`Ballot number ${e.ballotNo ?? "not listed"}`}
                    >
                      {e.ballotNo ?? "–"}
                    </span>
                    <span className="min-w-0 flex-1 @xl:flex @xl:items-center @xl:justify-between @xl:gap-6">
                      <span className="block font-semibold leading-snug [overflow-wrap:anywhere] transition-colors duration-[var(--dur-short)] group-hover:text-brand">
                        {e.candidate.fullName}
                      </span>
                      {e.candidate.membershipNo && (
                        <span className="tabular block whitespace-nowrap text-[0.9375rem] text-ink-muted">
                          Membership ID <span className="font-medium text-ink">{e.candidate.membershipNo}</span>
                        </span>
                      )}
                    </span>
                  </Link>
                </motion.li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}
