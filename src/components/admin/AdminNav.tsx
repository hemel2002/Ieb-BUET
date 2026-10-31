"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; badge?: number };

export function AdminNav({ items }: { items: Item[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Administration" className="-mb-px flex flex-wrap gap-x-1">
      {items.map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2 border-b-[3px] px-2.5 py-2.5 text-[0.9375rem] sm:px-3 sm:py-3 font-medium transition-colors duration-[var(--dur-short)] ${active ? "border-brand text-brand-strong" : "border-transparent text-ink-muted hover:text-ink"}`}
          >
            {item.label}
            {item.badge ? (
              <span className="tabular rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-ink" aria-label={`${item.badge} pending`}>
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
