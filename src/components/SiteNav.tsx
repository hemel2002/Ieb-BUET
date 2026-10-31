"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { EASE } from "./motion";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/candidates", label: "Candidates" },
  { href: "/manifestos", label: "Manifestos" },
  { href: "/about", label: "About" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

const linkClass =
  "relative rounded-md px-3 py-2 text-[1rem] font-medium transition-colors duration-[var(--dur-short)] hover:text-brand";

export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => setOpen(false), [pathname]);

  // Close the phone menu with Escape or a tap anywhere outside it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onPointer = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <>
      <nav aria-label="Main" className="hidden md:block">
        <ul className="flex items-center gap-1">
          {LINKS.map((l) => {
            const active = isActive(pathname, l.href);
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`${linkClass} ${active ? "text-brand" : "text-ink"}`}
                >
                  {l.label}
                  {active && (
                    <motion.span
                      layoutId="nav-active"
                      aria-hidden="true"
                      className="absolute inset-x-3 -bottom-1 h-[3px] rounded-full bg-accent"
                      transition={{ type: "spring", stiffness: 480, damping: 38 }}
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div ref={wrapRef} className="md:hidden">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
        >
          <motion.svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.25, ease: EASE }}>
            {open ? (
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            ) : (
              <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            )}
          </motion.svg>
          Menu
        </button>

        <AnimatePresence>
          {open && (
            <motion.nav
              id="mobile-nav"
              aria-label="Main"
              className="absolute inset-x-0 top-full z-20 origin-top border-b border-line bg-surface shadow-[var(--shadow-lift)]"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE } }}
              exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
            >
              <ul className="container-site flex flex-col py-2">
                {LINKS.map((l, i) => {
                  const active = isActive(pathname, l.href);
                  return (
                    <motion.li
                      key={l.href}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0, transition: { delay: 0.04 * i + 0.05, duration: 0.25, ease: EASE } }}
                    >
                      <Link
                        href={l.href}
                        aria-current={active ? "page" : undefined}
                        className={`block rounded-md px-3 py-3 font-medium ${active ? "bg-brand-soft text-brand-strong" : "text-ink hover:bg-canvas"}`}
                      >
                        {l.label}
                      </Link>
                    </motion.li>
                  );
                })}
              </ul>
            </motion.nav>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
