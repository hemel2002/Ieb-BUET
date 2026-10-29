import { Logo } from "./Logo";
import { SiteNav } from "./SiteNav";

export function SiteHeader() {
  return (
    <header className="relative border-b border-line bg-surface">
      <div className="h-1 bg-brand" aria-hidden="true" />
      <div className="container-site flex min-h-[4.5rem] items-center justify-between gap-4">
        <Logo />
        <SiteNav />
      </div>
    </header>
  );
}
