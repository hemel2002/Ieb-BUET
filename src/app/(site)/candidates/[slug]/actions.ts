"use server";

import { submitComment } from "@/lib/comments";

export type CommentFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<"name" | "body", string>>;
  values?: { visibility: string; name: string; body: string };
  attempt: number;
};

const field = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
};

export async function postComment(prev: CommentFormState, fd: FormData): Promise<CommentFormState> {
  const values = { visibility: field(fd, "visibility"), name: field(fd, "name").slice(0, 200), body: field(fd, "body").slice(0, 5000) };
  const result = await submitComment({
    candidateId: field(fd, "candidateId"),
    visibility: values.visibility,
    name: values.name,
    body: values.body,
    honeypot: field(fd, "website"),
    token: field(fd, "token"),
  });
  if (result.ok) return { status: "success", attempt: prev.attempt + 1 };
  return { status: "error", message: result.message, fieldErrors: result.fieldErrors, values, attempt: prev.attempt + 1 };
}
