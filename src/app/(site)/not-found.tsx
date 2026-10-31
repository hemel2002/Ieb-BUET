import Link from "next/link";
import { Emoji, Float, Reveal } from "@/components/motion";

export default function NotFound() {
  return (
    <div className="container-site py-16 sm:py-24">
      <Reveal immediate className="max-w-[var(--container-prose)]">
        <Float className="text-[2.5rem]"><Emoji>🧭</Emoji></Float>
        <h1 className="title-page mt-2">Page not found</h1>
        <p className="mt-3 text-ink-muted">The page you are looking for does not exist or has moved.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/candidates" className="btn btn-primary">Browse candidates</Link>
          <Link href="/" className="btn btn-secondary">Go to the homepage</Link>
        </div>
      </Reveal>
    </div>
  );
}
