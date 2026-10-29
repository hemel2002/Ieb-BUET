"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/app/admin/actions";
import { audit, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { deletePhoto, PhotoError, savePhoto } from "@/lib/images";
import { log } from "@/lib/log";
import { candidateSlug } from "@/lib/slug";

const optionalText = (max: number) =>
  z
    .string()
    .max(max, `Please keep this under ${max.toLocaleString()} characters.`)
    .transform((s) => s.replace(/\r\n?/g, "\n").trim() || null);

const membershipNo = z
  .string()
  .transform((s) => s.trim().toUpperCase())
  .refine((s) => s === "" || /^[A-Z]{1,3}\/\d{1,6}$/.test(s), "Use the IEB format, for example F/04266 or M/24563.")
  .transform((s) => s || null);

const fullName = z.string().trim().min(3, "Enter the candidate’s full name.").max(200);

const profileSchema = z.object({
  fullName,
  membershipNo,
  education: optionalText(5000),
  designation: optionalText(300),
  organization: optionalText(300),
  professionalExperience: optionalText(10000),
  institutionalRoles: optionalText(10000),
  achievements: optionalText(10000),
  contributions: optionalText(10000),
  additionalInfo: optionalText(10000),
  manifesto: optionalText(20000),
  dataNotes: optionalText(5000),
});

function fieldErrors(error: z.ZodError): FormState {
  return {
    error: "Please correct the highlighted fields.",
    fieldErrors: Object.fromEntries(error.issues.map((i) => [String(i.path[0]), i.message])),
  };
}

const isUniqueError = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
const str = (fd: FormData, key: string) => (typeof fd.get(key) === "string" ? (fd.get(key) as string) : "");

function refresh(slug?: string) {
  revalidatePath("/admin", "layout");
  if (slug) revalidatePath(`/candidates/${slug}`);
}

export async function createCandidate(_prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin("admin");
  const parsed = z.object({ fullName, membershipNo }).safeParse({ fullName: str(fd, "fullName"), membershipNo: str(fd, "membershipNo") });
  if (!parsed.success) return fieldErrors(parsed.error);

  const base = candidateSlug(parsed.data.fullName, parsed.data.membershipNo);
  let slug = base;
  for (let i = 2; await db.candidate.findUnique({ where: { slug } }); i++) slug = `${base}-${i}`;
  let id: string;
  try {
    ({ id } = await db.candidate.create({ data: { ...parsed.data, slug }, select: { id: true } }));
  } catch (e) {
    if (isUniqueError(e)) return { fieldErrors: { membershipNo: "Another candidate already has this membership number." } };
    throw e;
  }
  await audit(admin.id, "candidate.create", id, parsed.data.fullName);
  refresh();
  redirect(`/admin/candidates/${id}?created=1`);
}

export async function updateCandidate(_prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin("admin");
  const id = str(fd, "id");
  const existing = await db.candidate.findUnique({ where: { id } });
  if (!existing) return { error: "This candidate no longer exists." };

  const parsed = profileSchema.safeParse(Object.fromEntries(Object.keys(profileSchema.shape).map((k) => [k, str(fd, k)])));
  if (!parsed.success) return fieldErrors(parsed.error);
  const data = parsed.data;
  const visibility = str(fd, "visibility");
  try {
    await db.candidate.update({
      where: { id },
      data: {
        ...data,
        // A missing or unexpected value keeps the current setting rather than hiding the candidate.
        isPublished: visibility === "published" ? true : visibility === "hidden" ? false : existing.isPublished,
        ...(data.manifesto !== existing.manifesto && { manifestoUpdatedAt: data.manifesto ? new Date() : null }),
      },
    });
  } catch (e) {
    if (isUniqueError(e)) return { fieldErrors: { membershipNo: "Another candidate already has this membership number." } };
    throw e;
  }
  await audit(admin.id, "candidate.update", id, data.fullName);
  refresh(existing.slug);
  return { success: "Changes saved." };
}

export async function uploadPhoto(_prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin("admin");
  const id = str(fd, "id");
  const file = fd.get("photo");
  const candidate = await db.candidate.findUnique({ where: { id }, select: { photoKey: true, slug: true } });
  if (!candidate) return { error: "This candidate no longer exists." };
  if (!(file instanceof File)) return { error: "Please choose an image file." };

  let key: string;
  try {
    key = await savePhoto(file);
  } catch (e) {
    if (e instanceof PhotoError) return { error: e.message };
    log("error", "photo.upload_failed", { candidateId: id, error: String(e) });
    return { error: "The photo could not be processed. Please try a different image." };
  }
  await db.candidate.update({ where: { id }, data: { photoKey: key } });
  await deletePhoto(candidate.photoKey);
  await audit(admin.id, candidate.photoKey ? "photo.replace" : "photo.upload", id);
  refresh(candidate.slug);
  return { success: "Photo updated." };
}

export async function removePhoto(fd: FormData) {
  const admin = await requireAdmin("admin");
  const id = str(fd, "id");
  const candidate = await db.candidate.findUnique({ where: { id }, select: { photoKey: true, slug: true } });
  if (!candidate?.photoKey) return;
  await db.candidate.update({ where: { id }, data: { photoKey: null } });
  await deletePhoto(candidate.photoKey);
  await audit(admin.id, "photo.remove", id);
  refresh(candidate.slug);
}

export async function addCandidacy(_prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin("admin");
  const candidateId = str(fd, "candidateId");
  const positionId = Number(str(fd, "positionId"));
  const ballotNo = str(fd, "ballotNo").trim() || null;
  const candidate = await db.candidate.findUnique({ where: { id: candidateId }, select: { fullName: true, slug: true } });
  if (!candidate) return { error: "This candidate no longer exists." };
  if (!Number.isInteger(positionId) || !(await db.position.findUnique({ where: { id: positionId } }))) {
    return { error: "Choose a position." };
  }
  if (ballotNo && !/^\d{1,4}$/.test(ballotNo)) return { fieldErrors: { ballotNo: "Ballot numbers are whole numbers." } };
  const listedName = str(fd, "listedName").trim().slice(0, 200) || candidate.fullName;

  try {
    await db.candidacy.create({ data: { candidateId, positionId, ballotNo, listedName, source: "admin" } });
  } catch (e) {
    if (!isUniqueError(e)) throw e;
    const target = String((e as Prisma.PrismaClientKnownRequestError).meta?.target ?? "");
    return target.includes("ballotNo")
      ? { fieldErrors: { ballotNo: "Another candidate already has this ballot number for that position." } }
      : { error: "This candidate is already assigned to that position." };
  }
  await audit(admin.id, "candidacy.add", candidateId, `position ${positionId}, ballot ${ballotNo ?? "-"}`);
  refresh(candidate.slug);
  return { success: "Position added." };
}

export async function removeCandidacy(fd: FormData) {
  const admin = await requireAdmin("admin");
  const id = Number(str(fd, "candidacyId"));
  const candidacy = await db.candidacy.findUnique({ where: { id }, include: { candidate: { select: { slug: true } } } });
  if (!candidacy) return;
  await db.candidacy.delete({ where: { id } });
  await audit(admin.id, "candidacy.remove", candidacy.candidateId, `position ${candidacy.positionId}`);
  refresh(candidacy.candidate.slug);
}

export async function deleteCandidate(fd: FormData) {
  const admin = await requireAdmin("admin");
  const id = str(fd, "id");
  const candidate = await db.candidate.findUnique({ where: { id }, select: { fullName: true, photoKey: true } });
  if (candidate) {
    await db.candidate.delete({ where: { id } }); // candidacies and comments cascade
    await deletePhoto(candidate.photoKey);
    await audit(admin.id, "candidate.delete", id, candidate.fullName);
    log("info", "candidate.deleted", { candidateId: id, adminId: admin.id });
  }
  refresh();
  redirect("/admin/candidates?deleted=1");
}
