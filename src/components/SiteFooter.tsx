import Link from "next/link";
import { LogoMark } from "./Logo";
import { Emoji, Reveal } from "./motion";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-canvas sm:mt-24">
      <Reveal className="container-site grid gap-8 py-10 sm:grid-cols-2 sm:gap-10 sm:py-12 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
        <div className="max-w-md sm:col-span-2 md:col-span-1">
          <div className="flex items-center gap-3">
            <LogoMark size={30} />
            <span className="font-serif text-lg font-semibold">BUETians in IEB Election</span>
          </div>
          <p className="mt-3 text-[0.9375rem] text-ink-muted">
            BUET alumni candidates in the Institution of Engineers, Bangladesh (IEB) Election 2027-2028. Candidate names,
            posts, ballot numbers and membership numbers are taken from the published candidate list.
          </p>
        </div>
        <nav aria-label="Footer">
          <h2 className="font-sans text-[0.9375rem] font-semibold">Browse</h2>
          <ul className="mt-3 space-y-2 text-[0.9375rem]">
            <li><Link className="inline-block py-0.5 transition-colors hover:text-brand" href="/candidates">Candidates</Link></li>
            <li><Link className="inline-block py-0.5 transition-colors hover:text-brand" href="/manifestos">Manifestos</Link></li>
            <li><Link className="inline-block py-0.5 transition-colors hover:text-brand" href="/about">About this site</Link></li>
          </ul>
        </nav>
        <div>
          <h2 className="font-sans text-[0.9375rem] font-semibold">
            Feedback <Emoji>💬</Emoji>
          </h2>
          <p className="mt-3 text-[0.9375rem] text-ink-muted">
            Comments on candidate pages are published only after review.
          </p>
        </div>
      </Reveal>
      <div className="border-t border-line">
        <div className="container-site flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-sm text-ink-muted">
          <p>© {new Date().getFullYear()} BUETians in IEB Election</p>
          <Link href="/admin/login" className="transition-colors hover:text-ink">Administrator sign in</Link>
        </div>
      </div>
    </footer>
  );
}
