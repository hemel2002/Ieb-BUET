import Link from "next/link";
import { connection } from "next/server";
import { CandidatePortraitCard } from "@/components/CandidateCard";
import { RichText } from "@/components/RichText";
import { ballot, siteContent, SITE_CONTENT_KEYS } from "@/lib/candidates";
import { db } from "@/lib/db";
import { plural } from "@/lib/format";

export default async function HomePage() {
  await connection();
  const [groups, candidateCount, content] = await Promise.all([
    ballot(),
    db.candidate.count({ where: { isPublished: true, candidacies: { some: {} } } }),
    siteContent(),
  ]);
  const positionCount = groups.reduce((n, g) => n + g.positions.length, 0);
  const [headquarters, ...rest] = groups;
  const featured = rest.find((g) => g.slug === "dhaka-center-executive") ?? rest[0];
  const vision = content[SITE_CONTENT_KEYS.vision]?.trim();

  return (
    <>
      {/* Hero: the title, one line, and the headquarters ballot as voters will see it. */}
      <section className="border-b border-line">
        <div className="container-site grid items-center gap-10 py-12 md:py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
          <div>
            <h1 className="text-[2.5rem] sm:text-[3.25rem] lg:text-[3.75rem]">Vote 4 BUETian</h1>
            <p className="mt-4 max-w-xl text-[1.1875rem] text-ink-muted sm:text-[1.3125rem]">
              BUET alumni candidates in the IEB Election 2027-2028.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/candidates" className="btn btn-primary">Explore candidates</Link>
              <Link href="/manifestos" className="btn btn-secondary">Read manifestos</Link>
            </div>
          </div>

          {headquarters && headquarters.positions.length > 0 && (
            <div className="rounded-[var(--radius-lg)] border border-line bg-surface shadow-[var(--shadow-card)]">
              <div className="flex items-baseline justify-between gap-4 border-b-2 border-brand px-5 py-3.5">
                <h2 className="font-sans text-[1.0625rem] font-semibold">{headquarters.name}</h2>
                <Link href={`/candidates?position=${headquarters.slug}`} className="link shrink-0 text-[0.9375rem]">
                  View all
                </Link>
              </div>
              <ol className="divide-y divide-line">
                {headquarters.positions.flatMap((p) =>
                  p.entries.map((e) => (
                    <li key={e.candidacyId}>
                      <Link
                        href={`/candidates/${e.candidate.slug}`}
                        className="group grid grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-4 px-5 py-3 transition-colors duration-[var(--dur-short)] hover:bg-canvas"
                      >
                        <span className="tabular flex h-12 items-center justify-center rounded-[var(--radius-md)] border border-accent bg-accent-soft font-serif text-[1.5rem] font-semibold" aria-label={`Ballot number ${e.ballotNo ?? "not listed"}`}>
                          {e.ballotNo ?? "–"}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-semibold leading-snug [overflow-wrap:anywhere] group-hover:text-brand">
                            {e.candidate.fullName}
                          </span>
                          <span className="block text-[0.9375rem] text-ink-muted">{p.title}</span>
                        </span>
                      </Link>
                    </li>
                  )),
                )}
              </ol>
            </div>
          )}
        </div>
      </section>

      {/* Introduction */}
      <section className="container-site py-16">
        <div className="max-w-[var(--container-prose)]">
          <h2 className="text-[1.75rem] sm:text-[2rem]">The candidates</h2>
          <p className="mt-4 text-ink-muted">
            {plural(candidateCount, "BUET alumnus", "BUET alumni")} {candidateCount === 1 ? "is" : "are"} contesting{" "}
            {plural(positionCount, "position")} across {plural(groups.length, "ballot section")}. Each candidate has a
            profile with their posts, ballot numbers and IEB membership number, along with their background and
            manifesto as they are published.
          </p>
        </div>
      </section>

      {/* Featured section */}
      {featured && (
        <section className="container-site" aria-labelledby="featured-heading">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="featured-heading" className="text-[1.5rem] sm:text-[1.75rem]">{featured.name}</h2>
            <Link href={`/candidates?position=${featured.slug}`} className="link text-[0.9375rem]">
              See this section in the directory
            </Link>
          </div>
          <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {featured.positions.flatMap((p) =>
              p.entries.map((e) => (
                <li key={e.candidacyId}>
                  <CandidatePortraitCard {...e.candidate} ballotNo={e.ballotNo} position={p.title} />
                </li>
              )),
            )}
          </ul>
        </section>
      )}

      {/* Positions overview */}
      <section className="container-site pt-20" aria-labelledby="positions-heading">
        <h2 id="positions-heading" className="text-[1.5rem] sm:text-[1.75rem]">Positions on the ballot</h2>
        <ul className="mt-6 grid gap-x-10 border-t border-line md:grid-cols-2">
          {groups.map((g) => {
            const entries = g.positions.reduce((n, p) => n + p.entries.length, 0);
            return (
              <li key={g.id} className="border-b border-line">
                <Link
                  href={`/candidates?position=${g.slug}`}
                  className="group flex items-baseline justify-between gap-4 py-4 transition-colors duration-[var(--dur-short)]"
                >
                  <span className="font-semibold group-hover:text-brand">{g.name}</span>
                  <span className="tabular shrink-0 text-[0.9375rem] text-ink-muted">
                    {g.positions.length > 1 ? `${plural(g.positions.length, "post")}, ` : ""}
                    {plural(entries, "candidate")}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {vision && (
        <section className="container-site pt-20" aria-labelledby="vision-heading">
          <div className="border-l-4 border-accent pl-6">
            <h2 id="vision-heading" className="text-[1.5rem] sm:text-[1.75rem]">Our shared vision</h2>
            <RichText source={vision} className="mt-4" />
          </div>
        </section>
      )}

      {/* Feedback */}
      <section className="container-site pt-20">
        <div className="grid gap-6 rounded-[var(--radius-lg)] bg-canvas p-6 sm:p-10 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="max-w-[var(--container-prose)]">
            <h2 className="text-[1.5rem]">Share your feedback</h2>
            <p className="mt-3 text-ink-muted">
              Every candidate page has a comment section. You can comment with your name or anonymously, and comments
              appear once an administrator has reviewed them.
            </p>
          </div>
          <Link href="/candidates" className="btn btn-primary justify-self-start">Find a candidate</Link>
        </div>
      </section>
    </>
  );
}
