import type { Metadata } from "next";
import Link from "next/link";
import { AutoRefresh } from "@/components/admin/AutoRefresh";
import { Reveal, StaggerItem, StaggerList } from "@/components/motion";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Overview" };

const ACTION_LABELS: Record<string, string> = {
  login: "Signed in",
  "comment.approved": "Approved a comment",
  "comment.rejected": "Rejected a comment",
  "comment.pending": "Returned a comment to pending",
  "comment.delete": "Deleted a comment",
  "candidate.create": "Added a candidate",
  "candidate.update": "Updated a candidate",
  "candidate.delete": "Deleted a candidate",
  "photo.upload": "Uploaded a photo",
  "photo.replace": "Replaced a photo",
  "photo.remove": "Removed a photo",
  "candidacy.add": "Added a position to a candidate",
  "candidacy.remove": "Removed a position from a candidate",
  "position.create": "Added a position",
  "position.update": "Updated a position",
  "position.delete": "Deleted a position",
  "content.update": "Updated site text",
  "password.change": "Changed their password",
};

export default async function AdminHome({ searchParams }: PageProps<"/admin">) {
  const admin = await requireAdmin("any");
  const denied = (await searchParams).denied;
  const [pending, approved, candidates, withPhoto, withManifesto, flagged, activity] = await Promise.all([
    db.comment.count({ where: { status: "pending" } }),
    db.comment.count({ where: { status: "approved" } }),
    db.candidate.count(),
    db.candidate.count({ where: { photoKey: { not: null } } }),
    db.candidate.count({ where: { manifesto: { not: null } } }),
    admin.role === "admin" ? db.candidate.findMany({ where: { dataNotes: { not: null } }, select: { id: true, fullName: true, membershipNo: true }, orderBy: { fullName: "asc" } }) : [],
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 12, include: { admin: { select: { name: true } } } }),
  ]);

  const stats = [
    { label: "Comments awaiting review", value: pending, href: "/admin/comments" },
    { label: "Approved comments", value: approved, href: "/admin/comments?status=approved" },
    ...(admin.role === "admin"
      ? [
          { label: "Candidates", value: candidates, href: "/admin/candidates" },
          { label: "Candidates with a photo", value: `${withPhoto} of ${candidates}`, href: "/admin/candidates" },
          { label: "Candidates with a manifesto", value: `${withManifesto} of ${candidates}`, href: "/admin/candidates" },
        ]
      : []),
  ];

  return (
    <div>
      <AutoRefresh />
      <Reveal immediate>
        <h1 className="text-[1.5rem] sm:text-[1.75rem]">Overview</h1>
      </Reveal>
      {denied && (
        <p role="alert" className="mt-4 rounded-[var(--radius-md)] border border-brand bg-brand-soft px-4 py-3 text-brand-strong">
          Your account can moderate comments only. Ask an administrator for anything else.
        </p>
      )}
      <StaggerList className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <StaggerItem key={s.label} lift>
            <Link href={s.href} className="block h-full rounded-[var(--radius-lg)] border border-line bg-surface p-3.5 transition-[border-color,box-shadow] duration-[var(--dur-short)] hover:border-line-strong hover:shadow-[var(--shadow-lift)] sm:p-4">
              <span className="tabular block text-[1.5rem] font-semibold leading-tight [overflow-wrap:anywhere] sm:text-[1.75rem]">{s.value}</span>
              <span className="mt-1 block text-[0.875rem] leading-snug text-ink-muted sm:text-[0.9375rem]">{s.label}</span>
            </Link>
          </StaggerItem>
        ))}
      </StaggerList>

      <Reveal className="mt-8 grid gap-6 lg:grid-cols-2">
        {flagged.length > 0 && (
          <section className="rounded-[var(--radius-lg)] border border-line bg-surface p-4 sm:p-5">
            <h2 className="font-sans text-[1.0625rem] font-semibold">Source data to confirm</h2>
            <p className="mt-1 text-[0.9375rem] text-ink-muted">These records had inconsistencies in the imported candidate list.</p>
            <ul className="mt-3 space-y-1.5">
              {flagged.map((c) => (
                <li key={c.id}><Link href={`/admin/candidates/${c.id}`} className="link">{c.fullName}</Link> <span className="tabular text-ink-muted">{c.membershipNo}</span></li>
              ))}
            </ul>
          </section>
        )}
        <section className="rounded-[var(--radius-lg)] border border-line bg-surface p-4 sm:p-5">
          <h2 className="font-sans text-[1.0625rem] font-semibold">Recent activity</h2>
          {activity.length === 0 ? (
            <p className="mt-2 text-ink-muted">No activity yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line text-[0.9375rem]">
              {activity.map((a) => (
                <li key={a.id} className="flex flex-wrap justify-between gap-x-4 py-2">
                  <span>
                    <span className="font-semibold">{a.admin?.name ?? "Deleted account"}</span> {(ACTION_LABELS[a.action] ?? a.action).toLowerCase()}
                    {a.detail && a.action.startsWith("candidate.") ? `: ${a.detail}` : ""}
                  </span>
                  <span className="text-ink-muted">{formatDateTime(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </Reveal>
    </div>
  );
}
