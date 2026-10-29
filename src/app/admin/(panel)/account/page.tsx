import type { Metadata } from "next";
import { ActionForm, Field } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { requireAdmin } from "@/lib/auth";
import { PASSWORD_MIN_LENGTH } from "@/lib/password";
import { changePassword } from "../../actions";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const admin = await requireAdmin("any");
  return (
    <div className="max-w-xl">
      <h1 className="text-[1.75rem]">Account</h1>
      <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-1 text-[0.9375rem]">
        <dt className="text-ink-muted">Name</dt><dd>{admin.name}</dd>
        <dt className="text-ink-muted">Email</dt><dd>{admin.email}</dd>
        <dt className="text-ink-muted">Role</dt><dd>{admin.role === "admin" ? "Administrator (full access)" : "Moderator (comments only)"}</dd>
      </dl>
      <div className="mt-6 rounded-[var(--radius-lg)] border border-line bg-surface p-5">
        <h2 className="font-sans text-[1.0625rem] font-semibold">Change password</h2>
        <ActionForm action={changePassword} className="mt-4 space-y-4">
          <Field name="current" label="Current password" type="password" autoComplete="current-password" required />
          <Field name="next" label="New password" hint={`At least ${PASSWORD_MIN_LENGTH} characters.`} type="password" autoComplete="new-password" required />
          <Field name="confirm" label="Repeat new password" type="password" autoComplete="new-password" required />
          <SubmitButton pendingLabel="Saving…">Change password</SubmitButton>
        </ActionForm>
      </div>
      <p className="mt-6 text-[0.9375rem] text-ink-muted">
        New administrator and moderator accounts are created from the server with <code>npm run admin:create</code>.
      </p>
    </div>
  );
}
