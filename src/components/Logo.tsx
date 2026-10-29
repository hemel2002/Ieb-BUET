import Link from "next/link";

export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true" focusable="false">
      <rect width="36" height="36" rx="6" fill="var(--color-brand)" />
      <rect x="7" y="26" width="22" height="3" rx="1.5" fill="var(--color-accent)" />
      <path d="M11 15.5l4.5 4.5L25 10.5" fill="none" stroke="var(--color-surface)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-3 rounded-md">
      <LogoMark />
      <span className="flex flex-col leading-tight">
        <span className="font-serif text-lg font-semibold text-ink">Vote 4 BUETian</span>
        <span className="text-sm text-ink-muted">IEB Election 2027-2028</span>
      </span>
    </Link>
  );
}
