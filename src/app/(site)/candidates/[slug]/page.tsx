import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CandidatePhoto } from "@/components/CandidatePhoto";
import { CommentForm } from "@/components/CommentForm";
import { RichText } from "@/components/RichText";
import { positionContext, positionTitle, publishedCandidate } from "@/lib/candidates";
import { approvedComments, issueFormToken } from "@/lib/comments";
import { formatDate, plural } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/candidates/[slug]">): Promise<Metadata> {
  const candidate = await publishedCandidate((await params).slug);
  if (!candidate) return { title: "Candidate not found" };
  const posts = candidate.candidacies.map((c) => positionTitle(c.position)).join(", ");
  return { title: candidate.fullName, description: `${candidate.fullName}: candidate for ${posts} in the IEB Election 2027-2028.` };
}

const BACKGROUND_FIELDS = [
  ["education", "Educational background"],
  ["professionalExperience", "Professional experience"],
  ["institutionalRoles", "Institutional responsibilities"],
  ["achievements", "Achievements"],
  ["contributions", "Professional contributions"],
  ["additionalInfo", "Other information"],
] as const;

function NotProvided({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[var(--radius-md)] border border-dashed border-line-strong bg-canvas px-4 py-4 text-ink-muted">
      {children}
    </p>
  );
}

export default async function CandidatePage({ params }: PageProps<"/candidates/[slug]">) {
  await connection();
  const candidate = await publishedCandidate((await params).slug);
  if (!candidate) notFound();
  const comments = await approvedComments(candidate.id);

  const listedVariants = [...new Set(candidate.candidacies.map((c) => c.listedName))].filter((n) => n !== candidate.fullName);
  const background = BACKGROUND_FIELDS.filter(([key]) => candidate[key]?.trim());
  const designation = [candidate.designation, candidate.organization].filter(Boolean).join(", ");
  const facts: [string, string | null][] = [
    ["IEB membership no.", candidate.membershipNo],
    ["Academic qualification", candidate.education ? candidate.education.split("\n")[0] : null],
    ["Current designation", designation || null],
  ];

  return (
    <article className="container-site py-10">
      <nav aria-label="Breadcrumb" className="text-[0.9375rem] text-ink-muted">
        <ol className="flex flex-wrap gap-2">
          <li><Link href="/candidates" className="link">Candidates</Link></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="[overflow-wrap:anywhere]">{candidate.fullName}</li>
        </ol>
      </nav>

      {/* 1. Overview */}
      <header className="mt-6 grid gap-8 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-12 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
        <CandidatePhoto
          photoKey={candidate.photoKey}
          name={candidate.fullName}
          sizes="(min-width: 768px) 272px, 60vw"
          priority
          className="w-full max-w-[15rem] rounded-[var(--radius-lg)] border border-line md:max-w-none"
        />
        <div className="min-w-0">
          <h1 className="text-[2rem] sm:text-[2.5rem]">{candidate.fullName}</h1>
          {listedVariants.length > 0 && (
            <p className="mt-2 text-[0.9375rem] text-ink-muted">
              Also listed as {listedVariants.map((n, i) => <span key={n}>{i > 0 && " / "}{n}</span>)}
            </p>
          )}

          <h2 className="mt-6 font-sans text-[1rem] font-semibold text-ink-muted">
            Contesting {plural(candidate.candidacies.length, "post")}
          </h2>
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {candidate.candidacies.map((c) => {
              const context = positionContext(c.position);
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                  {c.ballotNo && <span className="ballot-no text-[1rem]">Ballot No. {c.ballotNo}</span>}
                  <span className="min-w-0">
                    <span className="font-semibold">{positionTitle(c.position)}</span>
                    {context && <span className="text-ink-muted">, {context}</span>}
                  </span>
                </li>
              );
            })}
          </ul>

          <dl className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt className="text-[0.9375rem] text-ink-muted">{label}</dt>
                <dd className={value ? "tabular font-semibold" : "text-ink-muted"}>{value ?? "Not provided yet"}</dd>
              </div>
            ))}
          </dl>

          <nav aria-label="On this page" className="mt-8 flex flex-wrap gap-2">
            <a href="#background" className="btn btn-secondary btn-sm">Background</a>
            <a href="#manifesto" className="btn btn-secondary btn-sm">Manifesto</a>
            <a href="#comments" className="btn btn-secondary btn-sm">Comments ({comments.length})</a>
          </nav>
        </div>
      </header>

      <div className="mt-16 max-w-[48rem] space-y-16">
        {/* 2. Background */}
        <section id="background" aria-labelledby="background-heading" className="scroll-mt-6">
          <h2 id="background-heading" className="border-b-2 border-brand pb-2 text-[1.625rem]">Background</h2>
          <div className="mt-6 space-y-8">
            {background.length === 0 ? (
              <NotProvided>Background information for this candidate has not been provided yet.</NotProvided>
            ) : (
              background.map(([key, label]) => (
                <div key={key}>
                  <h3 className="mb-2 font-sans text-[1.125rem] font-semibold">{label}</h3>
                  <RichText source={candidate[key]} />
                </div>
              ))
            )}
          </div>
        </section>

        {/* 3. Manifesto */}
        <section id="manifesto" aria-labelledby="manifesto-heading" className="scroll-mt-6">
          <h2 id="manifesto-heading" className="border-b-2 border-brand pb-2 text-[1.625rem]">Manifesto</h2>
          <div className="mt-6">
            {candidate.manifesto?.trim() ? (
              <>
                <RichText source={candidate.manifesto} />
                {candidate.manifestoUpdatedAt && (
                  <p className="mt-6 text-sm text-ink-muted">Last updated {formatDate(candidate.manifestoUpdatedAt)}</p>
                )}
              </>
            ) : (
              <NotProvided>This candidate’s manifesto has not been published yet.</NotProvided>
            )}
          </div>
        </section>

        {/* 4. Comments */}
        <section id="comments" aria-labelledby="comments-heading" className="scroll-mt-6">
          <h2 id="comments-heading" className="border-b-2 border-brand pb-2 text-[1.625rem]">Voter comments</h2>
          {comments.length === 0 ? (
            <p className="mt-6 text-ink-muted">No comments have been published for this candidate yet.</p>
          ) : (
            <ol className="mt-6 space-y-4">
              {comments.map((c) => (
                <li key={c.id} className="rounded-[var(--radius-lg)] border border-line p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className={`font-semibold ${c.author === "Anonymous" ? "text-ink-muted" : ""}`}>{c.author}</p>
                    <p className="text-sm text-ink-muted">
                      <time dateTime={c.submittedAt.toISOString().slice(0, 10)}>{formatDate(c.submittedAt)}</time>
                    </p>
                  </div>
                  <p className="mt-2 whitespace-pre-line [overflow-wrap:anywhere]">{c.body}</p>
                </li>
              ))}
            </ol>
          )}

          <div className="mt-10 rounded-[var(--radius-lg)] border border-line bg-surface p-5 shadow-[var(--shadow-card)] sm:p-7">
            <h3 className="text-[1.25rem]">Leave a comment</h3>
            <div className="mt-5">
              <CommentForm candidateId={candidate.id} candidateName={candidate.fullName} token={issueFormToken()} />
            </div>
          </div>
        </section>
      </div>
    </article>
  );
}
