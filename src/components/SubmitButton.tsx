"use client";

import { createContext, useContext } from "react";
import { useFormStatus } from "react-dom";

/** Set by forms that dispatch their action manually, where useFormStatus cannot see the submission. */
export const PendingContext = createContext(false);

type Props = {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger";
  size?: "sm";
  confirm?: string;
  name?: string;
  value?: string;
};

export function SubmitButton({ children, pendingLabel, variant = "primary", size, confirm, name, value }: Props) {
  const status = useFormStatus();
  const manualPending = useContext(PendingContext);
  const pending = status.pending || manualPending;
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      aria-disabled={pending}
      className={`btn btn-${variant} ${size ? `btn-${size}` : ""}`}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? (pendingLabel ?? "Working…") : children}
    </button>
  );
}
