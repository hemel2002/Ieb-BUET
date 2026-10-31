import type { Metadata } from "next";
import { ActionForm, Field } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { requireAdmin } from "@/lib/auth";
import { siteContent, SITE_CONTENT_KEYS } from "@/lib/candidates";
import { saveSiteContent } from "./actions";

export const metadata: Metadata = { title: "Site text" };

export default async function ContentPage() {
  await requireAdmin("admin");
  const content = await siteContent();
  return (
    <div className="max-w-3xl">
      <h1 className="text-[1.75rem]">Site text</h1>
      <p className="mt-1 text-ink-muted">
        Optional campaign-wide text. Sections left empty are not shown. Separate paragraphs with a blank line and start
        a line with “- ” for a bullet point.
      </p>
      <div className="mt-6 rounded-[var(--radius-lg)] border border-line bg-surface p-5">
        <ActionForm action={saveSiteContent}>
          <Field name={SITE_CONTENT_KEYS.vision} label="Shared vision (About page)" hint="Shown on the About page under “Our shared vision”. Only add text the campaign has agreed." defaultValue={content[SITE_CONTENT_KEYS.vision]} multiline rows={8} />
          <Field name={SITE_CONTENT_KEYS.about} label="About the campaign (About page)" defaultValue={content[SITE_CONTENT_KEYS.about]} multiline rows={8} />
          <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
        </ActionForm>
      </div>
    </div>
  );
}
