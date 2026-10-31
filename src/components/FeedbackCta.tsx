import Link from "next/link";
import { Reveal } from "./motion";

/** Closing call to action shown above the footer on the landing page. */
export function FeedbackCta() {
  return (
    <Reveal className="mt-14 sm:mt-20">
      <section
        aria-labelledby="feedback-heading"
        className="grid gap-5 rounded-[var(--radius-lg)] bg-canvas p-5 sm:gap-6 sm:p-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-10"
      >
        <div className="max-w-[var(--container-prose)]">
          <h2 id="feedback-heading" className="title-section">Share your feedback</h2>
          <p className="mt-3 text-ink-muted">
            Every candidate page has a comment section. You can comment with your name or anonymously, and comments
            appear once an administrator has reviewed them.
          </p>
        </div>
        <Link href="/candidates" className="btn btn-primary w-full justify-self-start sm:w-auto">Find a candidate</Link>
      </section>
    </Reveal>
  );
}
