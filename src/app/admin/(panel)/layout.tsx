import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";
import { LogoMark } from "@/components/Logo";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { logout } from "../actions";

export const metadata: Metadata = { title: { default: "Administration", template: "%s | Administration" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin("any");
  const pending = await db.comment.count({ where: { status: "pending" } });
  const items =
    admin.role === "admin"
      ? [
          { href: "/admin", label: "Overview" },
          { href: "/admin/comments", label: "Comments", badge: pending },
          { href: "/admin/candidates", label: "Candidates" },
          { href: "/admin/positions", label: "Positions" },
          { href: "/admin/content", label: "Site text" },
          { href: "/admin/account", label: "Account" },
        ]
      : [
          { href: "/admin", label: "Overview" },
          { href: "/admin/comments", label: "Comments", badge: pending },
          { href: "/admin/account", label: "Account" },
        ];

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="h-1 bg-brand" aria-hidden="true" />
        <div className="container-site flex flex-wrap items-center justify-between gap-3 pt-3">
          <Link href="/admin" className="flex items-center gap-2.5 rounded-md">
            <LogoMark size={28} />
            <span className="font-semibold">Vote 4 BUETian administration</span>
          </Link>
          <div className="flex items-center gap-3 text-[0.9375rem]">
            <span className="hidden text-ink-muted sm:inline">
              {admin.name} ({admin.role})
            </span>
            <Link href="/" className="link">View site</Link>
            <form action={logout}>
              <button type="submit" className="btn btn-secondary btn-sm">Sign out</button>
            </form>
          </div>
        </div>
        <div className="container-site mt-2">
          <AdminNav items={items} />
        </div>
      </header>
      <main id="main" className="container-site py-8">{children}</main>
    </div>
  );
}
