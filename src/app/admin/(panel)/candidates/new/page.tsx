import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, Field } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { requireAdmin } from "@/lib/auth";
import { createCandidate } from "../actions";

export const metadata: Metadata = { title: "Add candidate" };

export default async function NewCandidatePage() {
  await requireAdmin("admin");
  return (
    <div className="max-w-xl">
      <p className="text-[0.9375rem]"><Link href="/admin/candidates" className="link">Candidates</Link></p>
      <h1 className="mt-2 text-[1.75rem]">Add candidate</h1>
      <p className="mt-1 text-ink-muted">Start with the name and membership number. You can add positions, a photo, background and manifesto next.</p>
      <div className="mt-6 rounded-[var(--radius-lg)] border border-line bg-surface p-5">
        <ActionForm action={createCandidate}>
          <Field name="fullName" label="Full name" hint="As it appears in the candidate list, e.g. ENGR. MD. ABDUR ROUF" required maxLength={200} />
          <Field name="membershipNo" label="IEB membership number" hint="For example F/04266 or M/24563" maxLength={12} />
          <SubmitButton pendingLabel="Creating…">Create candidate</SubmitButton>
        </ActionForm>
      </div>
    </div>
  );
}
