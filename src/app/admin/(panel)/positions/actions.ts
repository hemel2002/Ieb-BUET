"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/app/admin/actions";
import { audit, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { slugify } from "@/lib/slug";

const name = z.string().trim().min(2, "Enter a name.").max(150);
const order = z.coerce.number().int().min(0).max(9999);
const isUnique = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

async function uniqueSlug(base: string, taken: (slug: string) => Promise<unknown>) {
  let slug = base || "position";
  for (let i = 2; await taken(slug); i++) slug = `${base}-${i}`;
  return slug;
}

export async function createPosition(_prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin("admin");
  const parsed = z
    .object({ groupId: z.string(), newGroup: z.string().trim().max(150), name, displayOrder: order })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { newGroup, displayOrder } = parsed.data;

  let group = parsed.data.groupId === "new" ? null : await db.positionGroup.findUnique({ where: { id: Number(parsed.data.groupId) } });
  if (!group) {
    if (newGroup.length < 2) return { error: "Choose a section, or enter a name for a new one." };
    const last = await db.positionGroup.aggregate({ _max: { displayOrder: true } });
    try {
      group = await db.positionGroup.create({
        data: {
          name: newGroup,
          slug: await uniqueSlug(slugify(newGroup), (slug) => db.positionGroup.findUnique({ where: { slug } })),
          displayOrder: (last._max.displayOrder ?? 0) + 1,
        },
      });
    } catch (e) {
      if (isUnique(e)) return { error: "A section with that name already exists." };
      throw e;
    }
  }
  try {
    await db.position.create({
      data: {
        groupId: group.id,
        name: parsed.data.name,
        displayOrder,
        slug: await uniqueSlug(`${group.slug}--${slugify(parsed.data.name)}`, (slug) => db.position.findUnique({ where: { slug } })),
      },
    });
  } catch (e) {
    if (isUnique(e)) return { error: "That position already exists in this section." };
    throw e;
  }
  await audit(admin.id, "position.create", undefined, `${group.name}: ${parsed.data.name}`);
  revalidatePath("/admin/positions");
  return { success: "Position added." };
}

export async function updatePosition(_prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin("admin");
  const parsed = z.object({ id: z.coerce.number().int(), name, displayOrder: order }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const { count } = await db.position.updateMany({
      where: { id: parsed.data.id },
      data: { name: parsed.data.name, displayOrder: parsed.data.displayOrder },
    });
    if (!count) return { error: "This position no longer exists." };
  } catch (e) {
    if (isUnique(e)) return { error: "That position already exists in this section." };
    throw e;
  }
  await audit(admin.id, "position.update", String(parsed.data.id), parsed.data.name);
  revalidatePath("/admin/positions");
  return { success: "Saved." };
}

export async function deletePosition(_prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin("admin");
  const id = Number(fd.get("id"));
  const position = await db.position.findUnique({ where: { id }, include: { _count: { select: { candidacies: true } } } });
  if (!position) return {};
  if (position._count.candidacies > 0) {
    return { error: "Remove the candidates from this position before deleting it." };
  }
  await db.position.delete({ where: { id } });
  // Drop the section too if this was its last position.
  if ((await db.position.count({ where: { groupId: position.groupId } })) === 0) {
    await db.positionGroup.delete({ where: { id: position.groupId } });
  }
  await audit(admin.id, "position.delete", String(id), position.name);
  revalidatePath("/admin/positions");
  return {};
}
