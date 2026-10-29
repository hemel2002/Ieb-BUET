import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { positionTitle, sortCandidacies, candidacyInclude } from "@/lib/candidates";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { parseRichText } from "@/lib/rich-text";

export const metadata: Metadata = { title: "Manifestos" };

function excerpt(source: string, max = 220) {
  const first = parseRichText(source).find((b) => b.type !== "heading");
  const text = !first ? "" : first.type === "list" ? first.items.join("; ") : first.text;
  return text.length > max ? `${text.slice(0, max).replace(/\s+\S*$/, "")}…` : text;
}

export default async function ManifestosPage() {
  await connection();
  const [candidates, total] = await Promise.all([
    db.candidate.findMany({
      where: { isPublished: true, manifesto: { not: null }, NOT: { manifesto: "" } },
      include: { candidacies: { include: candidacyInclude } },
      orderBy: { fullName: "asc" },
    }),
    db.candidate.count({ where: { isPublished: true } }),
  ]);

  return (
    <div className="container-site py-12">
      <h1 className="text-[2.25rem] sm:text-[2.75rem]">Manifestos</h1>
      <p className="mt-3 max-w-[var(--container-prose)] text-ink-muted">
        Manifestos are published here in each candidate’s own words as they are received.
        {candidates.length > 0 && ` ${candidates.length} of ${total} candidates have published one so far.`}
      </p>

      {candidates.length === 0 ? (
        <div className="mt-10 rounded-[var(--radius-lg)] border border-dashed border-line-strong px-6 py-14 text-center">
          <h2 className="font-sans text-[1.125rem] font-semibold">No manifestos have been published yet</h2>
          <p className="mx-auto mt-2 max-w-md text-ink-muted">
            Candidate manifestos will appear here once they are added. In the meantime you can browse candidate profiles.
          </p>
          <Link href="/candidates" className="btn btn-secondary mt-5">Browse candidates</Link>
        </div>
      ) : (
        <ul className="mt-10 grid gap-4 md:grid-cols-2">
          {candidates.map((c) => {
            const posts = sortCandidacies(c.candidacies);
            return (
              <li key={c.id}>
                <Link
                  href={`/candidates/${c.slug}#manifesto`}
                  className="group flex h-full flex-col rounded-[var(--radius-lg)] border border-line p-5 shadow-[var(--shadow-card)] transition-[border-color,box-shadow] duration-[var(--dur-short)] hover:border-line-strong hover:shadow-[var(--shadow-lift)]"
                >
                  <span className="font-semibold [overflow-wrap:anywhere] group-hover:text-brand">{c.fullName}</span>
                  <span className="mt-1 text-[0.9375rem] text-ink-muted">
                    {posts.map((p) => positionTitle(p.position)).join(", ")}
                  </span>
                  <span className="mt-3 text-ink">{excerpt(c.manifesto!)}</span>
                  <span className="mt-auto pt-4 text-sm text-ink-muted">
                    {c.manifestoUpdatedAt ? `Updated ${formatDate(c.manifestoUpdatedAt)}` : "Read the full manifesto"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
