"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { postComment, type CommentFormState } from "@/app/(site)/candidates/[slug]/actions";
import { SubmitButton } from "./SubmitButton";

const BODY_MAX = 1500;
const initial: CommentFormState = { status: "idle", attempt: 0 };

export function CommentForm({ candidateId, candidateName, token }: { candidateId: string; candidateName: string; token: string }) {
  const [state, action] = useActionState(postComment, initial);
  const [visibility, setVisibility] = useState(state.values?.visibility ?? "public");
  const [length, setLength] = useState(0);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status === "idle") return;
    if (state.status === "success") {
      setVisibility("public");
      setLength(0);
    }
    statusRef.current?.focus();
  }, [state]);

  const errors = state.fieldErrors ?? {};
  const values = state.status === "error" ? state.values : undefined;

  return (
    <form action={action} noValidate className="space-y-5" aria-describedby="comment-policy">
      <div ref={statusRef} tabIndex={-1} aria-live="polite" className="outline-none">
        {state.status === "success" && (
          <p role="status" className="rounded-[var(--radius-md)] border border-ok bg-ok-soft px-4 py-3 text-ink">
            Thank you for your feedback. Your comment has been submitted for review and will appear after administrator
            approval.
          </p>
        )}
        {state.status === "error" && state.message && (
          <p role="alert" className="rounded-[var(--radius-md)] border border-brand bg-brand-soft px-4 py-3 text-brand-strong">
            {state.message}
          </p>
        )}
      </div>

      <input type="hidden" name="candidateId" value={candidateId} />
      <input type="hidden" name="token" value={token} />
      {/* Honeypot: hidden from people and assistive technology; bots tend to fill it. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      {/* key re-mounts the fields so failed submissions keep what the person typed. */}
      <div key={state.attempt} className="space-y-5">
        <fieldset>
          <legend className="field-label">How should your comment appear?</legend>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            {[
              { value: "public", title: "With my name", hint: "The name you enter is shown once approved." },
              { value: "anonymous", title: "Anonymously", hint: "Shown as “Anonymous”. Your name is not stored." },
            ].map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer gap-3 rounded-[var(--radius-md)] border p-3 transition-colors duration-[var(--dur-short)] ${visibility === opt.value ? "border-brand bg-brand-soft" : "border-line-strong hover:border-ink-muted"}`}
              >
                <input
                  type="radio"
                  name="visibility"
                  value={opt.value}
                  checked={visibility === opt.value}
                  onChange={() => setVisibility(opt.value)}
                  className="mt-1 h-4 w-4 accent-[var(--color-brand)]"
                />
                <span>
                  <span className="block font-semibold">{opt.title}</span>
                  <span className="field-hint block">{opt.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {visibility === "public" && (
          <div>
            <label htmlFor="comment-name" className="field-label">Your name</label>
            <input
              id="comment-name"
              name="name"
              className="input max-w-md"
              autoComplete="name"
              maxLength={60}
              required
              defaultValue={values?.name}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? "comment-name-error" : undefined}
            />
            {errors.name && <p id="comment-name-error" className="field-error">{errors.name}</p>}
          </div>
        )}

        <div>
          <label htmlFor="comment-body" className="field-label">Your comment about {candidateName}</label>
          <textarea
            id="comment-body"
            name="body"
            className="input"
            rows={5}
            maxLength={BODY_MAX}
            required
            defaultValue={values?.body}
            onChange={(e) => setLength(e.target.value.length)}
            aria-invalid={errors.body ? true : undefined}
            aria-describedby={`comment-body-count${errors.body ? " comment-body-error" : ""}`}
          />
          <div className="mt-1.5 flex justify-between gap-4">
            {errors.body ? <p id="comment-body-error" className="field-error mt-0">{errors.body}</p> : <span />}
            <span id="comment-body-count" className="field-hint tabular shrink-0">
              {length || values?.body.length || 0} / {BODY_MAX}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton pendingLabel="Submitting…">Submit comment</SubmitButton>
        <p id="comment-policy" className="field-hint max-w-md">
          All comments are reviewed before they are published. Please keep feedback respectful and relevant.
        </p>
      </div>
    </form>
  );
}
