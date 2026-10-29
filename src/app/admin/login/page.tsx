import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ActionForm, Field } from "@/components/admin/ActionForm";
import { LogoMark } from "@/components/Logo";
import { SubmitButton } from "@/components/SubmitButton";
import { currentAdmin } from "@/lib/auth";
import { login } from "../actions";

export const metadata: Metadata = { title: "Administrator sign in", robots: { index: false } };

export default async function LoginPage() {
  if (await currentAdmin()) redirect("/admin");
  return (
    <main id="main" className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-sm rounded-[var(--radius-lg)] border border-line bg-surface p-7 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-3">
          <LogoMark size={32} />
          <span className="font-serif text-lg font-semibold">Vote 4 BUETian</span>
        </div>
        <h1 className="mt-6 text-[1.5rem]">Administrator sign in</h1>
        <div className="mt-6">
          <ActionForm action={login}>
            <Field name="email" label="Email" type="email" autoComplete="username" required />
            <Field name="password" label="Password" type="password" autoComplete="current-password" required />
            <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
          </ActionForm>
        </div>
        <p className="mt-6 text-sm text-ink-muted"><a href="/" className="link">Return to the public site</a></p>
      </div>
    </main>
  );
}
