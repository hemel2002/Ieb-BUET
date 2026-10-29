"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/app/admin/actions";
import { audit, requireAdmin } from "@/lib/auth";
import { SITE_CONTENT_KEYS } from "@/lib/candidates";
import { db } from "@/lib/db";

export async function saveSiteContent(_prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin("admin");
  for (const key of Object.values(SITE_CONTENT_KEYS)) {
    const value = String(fd.get(key) ?? "").replace(/\r\n?/g, "\n").trim();
    if (value.length > 10000) return { error: "Each text must be under 10,000 characters." };
    await db.siteContent.upsert({ where: { key }, create: { key, value }, update: { value } });
  }
  await audit(admin.id, "content.update");
  revalidatePath("/", "layout");
  return { success: "Site text saved." };
}
