import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, Field } from "@/components/admin/ActionForm";
import { CandidatePhoto } from "@/components/CandidatePhoto";
import { SubmitButton } from "@/components/SubmitButton";
import { requireAdmin } from "@/lib/auth";
import { candidacyInclude, positionTitle, sortCandidacies } from "@/lib/candidates";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { addCandidacy, deleteCandidate, removeCandidacy, removePhoto, updateCandidate, uploadPhoto } from "../actions";

export const metadata: Metadata = { title: "Edit candidate" };

const FORMAT_HINT = "Separate paragraphs with a blank line. Start a line with “- ” for a bullet point or “## ” for a heading.";

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-line bg-surface p-5">
      <h2 className="font-sans text-[1.0625rem] font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function EditCandidatePage({ params, searchParams }: PageProps<"/admin/candidates/[id]">) {
  await requireAdmin("admin");
  const { id } = await params;
  const sp = await searchParams;
  const [candidate, groups] = await Promise.all([
    db.candidate.findUnique({
      where: { id },
      include: { candidacies: { include: candidacyInclude }, _count: { select: { comments: true } } },
    }),
    db.positionGroup.findMany({ orderBy: { displayOrder: "asc" }, include: { positions: { orderBy: { displayOrder: "asc" } } } }),
  ]);
  if (!candidate) notFound();
  const candidacies = sortCandidacies(candidate.candidacies);

  return (
    <div>
      <p className="text-[0.9375rem]"><Link href="/admin/candidates" className="link">Candidates</Link></p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[1.75rem] [overflow-wrap:anywhere]">{candidate.fullName}</h1>
          <p className="mt-1 text-[0.9375rem] text-ink-muted">Last updated {formatDateTime(candidate.updatedAt)}</p>
        </div>
        {candidate.isPublished && (
          <a href={`/candidates/${candidate.slug}`} target="_blank" rel="noopener" className="btn btn-secondary btn-sm">View public profile</a>
        )}
      </div>
      {sp.created && <p role="status" className="mt-4 rounded-[var(--radius-md)] border border-ok bg-ok-soft px-4 py-3">Candidate created. Add their positions below.</p>}
      {candidate.dataNotes && (
        <div className="mt-4 rounded-[var(--radius-md)] border border-accent bg-accent-soft px-4 py-3">
          <p className="font-semibold">Source data needs checking</p>
          <p className="mt-1 whitespace-pre-line text-[0.9375rem]">{candidate.dataNotes}</p>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <ActionForm action={updateCandidate} className="space-y-6">
          <input type="hidden" name="id" value={candidate.id} />
          <Panel title="Overview">
            <div className="space-y-5">
              <Field name="fullName" label="Full name" defaultValue={candidate.fullName} required maxLength={200} />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field name="membershipNo" label="IEB membership number" defaultValue={candidate.membershipNo} maxLength={12} />
                <Field name="designation" label="Current professional designation" defaultValue={candidate.designation} maxLength={300} />
              </div>
              <Field name="organization" label="Organisation" defaultValue={candidate.organization} maxLength={300} />
              <div>
                <label htmlFor="visibility" className="field-label">Public visibility</label>
                <select id="visibility" name="visibility" defaultValue={candidate.isPublished ? "published" : "hidden"} className="input max-w-xs">
                  <option value="published">Shown on the public site</option>
                  <option value="hidden">Hidden from the public site</option>
                </select>
                <p className="field-hint mt-1.5">Hidden candidates are removed from the directory and their profile returns “not found”.</p>
              </div>
            </div>
          </Panel>

          <Panel title="Background">
            <div className="space-y-5">
              <p className="field-hint">{FORMAT_HINT} Empty sections are not shown publicly.</p>
              <Field name="education" label="Educational background" hint="The first line is shown as the academic qualification." defaultValue={candidate.education} multiline rows={3} />
              <Field name="professionalExperience" label="Professional experience" defaultValue={candidate.professionalExperience} multiline />
              <Field name="institutionalRoles" label="Previous institutional responsibilities" defaultValue={candidate.institutionalRoles} multiline />
              <Field name="achievements" label="Achievements" defaultValue={candidate.achievements} multiline />
              <Field name="contributions" label="Professional contributions" defaultValue={candidate.contributions} multiline />
              <Field name="additionalInfo" label="Other information" defaultValue={candidate.additionalInfo} multiline rows={4} />
            </div>
          </Panel>

          <Panel title="Manifesto">
            <Field
              name="manifesto"
              label="Manifesto text"
              hint={`Enter it as provided by the candidate. Suggested headings: Vision, Commitments, Key priorities, Proposed initiatives. ${FORMAT_HINT}`}
              defaultValue={candidate.manifesto}
              multiline
              rows={16}
            />
          </Panel>

          <Panel title="Internal notes">
            <Field name="dataNotes" label="Notes for administrators" hint="Never shown publicly." defaultValue={candidate.dataNotes} multiline rows={3} />
          </Panel>

          <div className="sticky bottom-0 -mx-1 border-t border-line bg-canvas px-1 py-3">
            <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
          </div>
        </ActionForm>

        <div className="space-y-6">
          <Panel title="Photograph">
            <CandidatePhoto photoKey={candidate.photoKey} name={candidate.fullName} sizes="320px" className="w-40 rounded-[var(--radius-md)] border border-line" />
            <ActionForm action={uploadPhoto} className="mt-4 space-y-3">
              <input type="hidden" name="id" value={candidate.id} />
              <div>
                <label htmlFor="photo" className="field-label">{candidate.photoKey ? "Replace photo" : "Upload photo"}</label>
                <input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" required className="block w-full text-[0.9375rem] file:mr-3 file:rounded-[var(--radius-md)] file:border file:border-line-strong file:bg-surface file:px-3 file:py-1.5 file:font-semibold" />
                <p className="field-hint mt-1.5">JPEG, PNG or WebP, up to 5 MB. Cropped to a 4:5 portrait automatically.</p>
              </div>
              <SubmitButton size="sm" pendingLabel="Uploading…">Upload</SubmitButton>
            </ActionForm>
            {candidate.photoKey && (
              <form action={removePhoto} className="mt-3">
                <input type="hidden" name="id" value={candidate.id} />
                <SubmitButton size="sm" variant="danger" confirm="Remove this photo? The placeholder will be shown instead.">Remove photo</SubmitButton>
              </form>
            )}
          </Panel>

          <Panel title="Contested positions">
            {candidacies.length === 0 ? (
              <p className="text-ink-muted">Not assigned to any position yet.</p>
            ) : (
              <ul className="divide-y divide-line border-y border-line">
                {candidacies.map((c) => (
                  <li key={c.id} className="flex items-start justify-between gap-3 py-2.5">
                    <div className="min-w-0 text-[0.9375rem]">
                      <p className="font-semibold">{positionTitle(c.position)}</p>
                      <p className="text-ink-muted">
                        {c.position.group.name}. Ballot No. {c.ballotNo ?? "not set"}
                      </p>
                      {c.listedName !== candidate.fullName && <p className="text-ink-muted">Listed as {c.listedName}</p>}
                    </div>
                    <form action={removeCandidacy}>
                      <input type="hidden" name="candidacyId" value={c.id} />
                      <SubmitButton size="sm" variant="secondary" confirm="Remove this position from the candidate?">Remove</SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <ActionForm action={addCandidacy} className="mt-4 space-y-3">
              <input type="hidden" name="candidateId" value={candidate.id} />
              <div>
                <label htmlFor="positionId" className="field-label">Add a position</label>
                <select id="positionId" name="positionId" required className="input" defaultValue="">
                  <option value="" disabled>Choose a position</option>
                  {groups.map((g) => (
                    <optgroup key={g.id} label={g.name}>
                      {g.positions.map((p) => (
                        <option key={p.id} value={p.id}>{p.name === "Member" ? g.name : p.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <Field name="ballotNo" label="Ballot number" maxLength={4} />
              <Field name="listedName" label="Name as listed on the ballot" hint="Leave empty to use the full name." maxLength={200} />
              <SubmitButton size="sm" pendingLabel="Adding…">Add position</SubmitButton>
            </ActionForm>
          </Panel>

          <Panel title="Delete candidate">
            <p className="text-[0.9375rem] text-ink-muted">
              Permanently removes the profile, its positions and its {candidate._count.comments} comment(s). This cannot be undone.
            </p>
            <form action={deleteCandidate} className="mt-3">
              <input type="hidden" name="id" value={candidate.id} />
              <SubmitButton size="sm" variant="danger" confirm={`Permanently delete ${candidate.fullName}?`}>Delete candidate</SubmitButton>
            </form>
          </Panel>
        </div>
      </div>
    </div>
  );
}
