"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import type { CommentJson } from "@/lib/comments";
import { formatDate } from "@/lib/format";
import { CommentForm } from "./CommentForm";
import { EASE, Reveal } from "./motion";

const POLL_MS = 15_000;
const COUNT_EVENT = "comments:count";

type Props = {
  slug: string;
  candidateId: string;
  candidateName: string;
  token: string;
  initialComments: CommentJson[];
};

const sameComments = (a: CommentJson[], b: CommentJson[]) => a.length === b.length && a.every((c, i) => c.id === b[i].id);

/**
 * The comment list and form for a profile. Approved comments are fetched again every few seconds while the
 * page is open, so a comment appears as soon as an administrator approves it. A comment you have just sent
 * is shown to you straight away, marked as awaiting review (it is not public until it is approved).
 */
export function CommentSection({ slug, candidateId, candidateName, token, initialComments }: Props) {
  const [comments, setComments] = useState(initialComments);
  const [mine, setMine] = useState<CommentJson[]>([]);
  const reduceMotion = useReducedMotion();

  const refresh = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    try {
      const res = await fetch(`/api/candidates/${encodeURIComponent(slug)}/comments`, { cache: "no-store" });
      if (!res.ok) return;
      const data: { comments: CommentJson[] } = await res.json();
      setComments((prev) => (sameComments(prev, data.comments) ? prev : data.comments));
    } catch {
      // Offline or a brief server error: keep what is on screen and try again on the next tick.
    }
  }, [slug]);

  useEffect(() => {
    const timer = setInterval(refresh, POLL_MS);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [refresh]);

  // Keeps the "Comments (n)" shortcut near the top of the page in step with the list.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(COUNT_EVENT, { detail: comments.length }));
  }, [comments.length]);

  const onPosted = useCallback(
    (comment: CommentJson) => {
      setMine((prev) => [...prev, comment]);
      // Bring the new comment into view once it has rendered.
      requestAnimationFrame(() =>
        document.getElementById(`comment-${comment.id}`)?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" }),
      );
    },
    [reduceMotion],
  );

  // Once a comment of mine has been approved it arrives in the public list, so drop the preview.
  const pendingMine = mine.filter((m) => !comments.some((c) => c.id === m.id));
  const empty = comments.length === 0 && pendingMine.length === 0;

  return (
    <>
      <p className="mt-4 flex items-center gap-2 text-sm text-ink-muted">
        <span className="relative flex h-2 w-2" aria-hidden="true">
          <motion.span
            className="absolute inset-0 rounded-full bg-ok"
            animate={{ scale: [1, 2.6], opacity: [0.55, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
          />
          <span className="relative h-2 w-2 rounded-full bg-ok" />
        </span>
        New comments appear here automatically.
      </p>

      {empty ? (
        <p className="mt-4 text-ink-muted">No comments have been published for this candidate yet.</p>
      ) : (
        <ol className="mt-4 space-y-4">
          {/* initial={false}: comments already on the page do not animate; ones that arrive later do. */}
          <AnimatePresence initial={false}>
            {comments.map((c) => (
              <CommentItem key={c.id} comment={c} />
            ))}
            {pendingMine.map((c) => (
              <CommentItem key={c.id} comment={c} pending />
            ))}
          </AnimatePresence>
        </ol>
      )}

      <Reveal className="mt-10 rounded-[var(--radius-lg)] border border-line bg-surface p-4 shadow-[var(--shadow-card)] sm:p-7">
        <h3 className="text-[1.25rem]">Leave a comment</h3>
        <div className="mt-5">
          <CommentForm candidateId={candidateId} candidateName={candidateName} token={token} onPosted={onPosted} />
        </div>
      </Reveal>
    </>
  );
}

function CommentItem({ comment, pending }: { comment: CommentJson; pending?: boolean }) {
  return (
    <motion.li
      id={`comment-${comment.id}`}
      layout
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: EASE } }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      className={`rounded-[var(--radius-lg)] border p-4 sm:p-5 ${pending ? "border-accent bg-accent-soft" : "border-line"}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className={`font-semibold ${comment.author === "Anonymous" ? "text-ink-muted" : ""}`}>{comment.author}</p>
        {pending ? (
          <p className="rounded-[var(--radius-sm)] border border-accent bg-surface px-2 py-0.5 text-sm font-semibold">Awaiting review</p>
        ) : (
          <p className="text-sm text-ink-muted">
            <time dateTime={comment.submittedAt}>{formatDate(new Date(comment.submittedAt))}</time>
          </p>
        )}
      </div>
      <p className="mt-2 whitespace-pre-line [overflow-wrap:anywhere]">{comment.body}</p>
      {pending && (
        <p className="mt-3 text-sm text-ink-muted">Only you can see this for now. It appears for everyone once an administrator approves it.</p>
      )}
    </motion.li>
  );
}

/** The number in the "Comments (n)" shortcut, kept in step with the live list. */
export function CommentCount({ initial }: { initial: number }) {
  const [count, setCount] = useState(initial);
  useEffect(() => {
    const onCount = (e: Event) => setCount((e as CustomEvent<number>).detail);
    window.addEventListener(COUNT_EVENT, onCount);
    return () => window.removeEventListener(COUNT_EVENT, onCount);
  }, []);
  return <>{count}</>;
}
