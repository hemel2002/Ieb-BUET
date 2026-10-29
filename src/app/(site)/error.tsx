"use client";

export default function SiteError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="container-site py-24">
      <div className="max-w-[var(--container-prose)]">
        <h1 className="text-[2.25rem]">Something went wrong</h1>
        <p className="mt-3 text-ink-muted">This page could not be loaded. Please try again in a moment.</p>
        <button type="button" onClick={reset} className="btn btn-primary mt-8">Try again</button>
      </div>
    </div>
  );
}
