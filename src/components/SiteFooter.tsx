import Link from "next/link";
import { LogoMark } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line bg-canvas">
      <div className="container-site grid gap-10 py-12 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="max-w-md">
          <div className="flex items-center gap-3">
            <LogoMark size={30} />
            <span className="font-serif text-lg font-semibold">Vote 4 BUETian</span>
          </div>
          <p className="mt-3 text-[0.9375rem] text-ink-muted">
            BUET alumni candidates in the Institution of Engineers, Bangladesh (IEB) Election 2027-2028. Candidate names,
            posts, ballot numbers and membership numbers are taken from the published candidate list.
          </p>
        </div>
        <nav aria-label="Footer">
          <h2 className="font-sans text-[0.9375rem] font-semibold">Browse</h2>
          <ul className="mt-3 space-y-2 text-[0.9375rem]">
            <li><Link className="hover:text-brand" href="/candidates">Candidates</Link></li>
            <li><Link className="hover:text-brand" href="/manifestos">Manifestos</Link></li>
            <li><Link className="hover:text-brand" href="/about">About this site</Link></li>
          </ul>
        </nav>
        <div>
          <h2 className="font-sans text-[0.9375rem] font-semibold">Feedback</h2>
          <p className="mt-3 text-[0.9375rem] text-ink-muted">
            Comments on candidate pages are published only after review.
          </p>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="container-site flex flex-wrap items-center justify-between gap-3 py-5 text-sm text-ink-muted">
          <p>© {new Date().getFullYear()} Vote 4 BUETian campaign</p>
          <Link href="/admin/login" className="hover:text-ink">Administrator sign in</Link>
        </div>
      </div>
    </footer>
  );
}
