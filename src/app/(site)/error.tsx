"use client";

import { Emoji, Reveal } from "@/components/motion";

export default function SiteError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="container-site py-16 sm:py-24">
      <Reveal immediate className="max-w-[var(--container-prose)]">
        <Emoji className="text-[2.5rem]">⚠️</Emoji>
        <h1 className="title-page mt-2">Something went wrong</h1>
        <p className="mt-3 text-ink-muted">This page could not be loaded. Please try again in a moment.</p>
        <button type="button" onClick={reset} className="btn btn-primary mt-8">Try again</button>
      </Reveal>
    </div>
  );
}
