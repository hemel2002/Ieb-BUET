"use client";

import { createContext, startTransition, useActionState, useContext } from "react";
import { PendingContext } from "../SubmitButton";
import type { FormState } from "@/app/admin/actions";

const FieldErrors = createContext<Record<string, string>>({});

/** Wraps a Server Action form and shows its result. Field components read errors from context. */
export function ActionForm({
  action,
  children,
  className = "space-y-5",
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction, isPending] = useActionState(action, {});
  return (
    <form
      action={formAction}
      className={className}
      // Dispatch manually so React does not reset the fields: on a validation error the
      // admin keeps what they typed. Without JavaScript the plain form action still works.
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        startTransition(() => formAction(fd));
      }}
    >
      <div aria-live="polite">
        {state.error && (
          <p role="alert" className="rounded-[var(--radius-md)] border border-brand bg-brand-soft px-4 py-3 text-brand-strong">
            {state.error}
          </p>
        )}
        {state.success && (
          <p role="status" className="rounded-[var(--radius-md)] border border-ok bg-ok-soft px-4 py-3">
            {state.success}
          </p>
        )}
      </div>
      <PendingContext.Provider value={isPending}>
        <FieldErrors.Provider value={state.fieldErrors ?? {}}>{children}</FieldErrors.Provider>
      </PendingContext.Provider>
    </form>
  );
}

type FieldProps = {
  name: string;
  label: string;
  hint?: string;
  defaultValue?: string | null;
  type?: string;
  required?: boolean;
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  autoComplete?: string;
};

export function Field({ name, label, hint, defaultValue, type = "text", required, multiline, rows = 6, maxLength, autoComplete }: FieldProps) {
  const error = useContext(FieldErrors)[name];
  const id = `f-${name}`;
  const described = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  const common = {
    id,
    name,
    required,
    maxLength,
    defaultValue: defaultValue ?? "",
    className: "input",
    "aria-invalid": error ? true : undefined,
    "aria-describedby": described,
  } as const;
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
        {!required && <span className="font-normal text-ink-muted"> (optional)</span>}
      </label>
      {hint && <p id={`${id}-hint`} className="field-hint -mt-1 mb-1.5">{hint}</p>}
      {multiline ? <textarea rows={rows} {...common} /> : <input type={type} autoComplete={autoComplete} {...common} />}
      {error && <p id={`${id}-error`} className="field-error">{error}</p>}
    </div>
  );
}
