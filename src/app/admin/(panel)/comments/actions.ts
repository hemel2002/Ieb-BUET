"use server";

import { revalidatePath } from "next/cache";
import { audit, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { log } from "@/lib/log";

const OPS = { approve: "approved", reject: "rejected", pending: "pending" } as const;

/** Approve, reject, return to pending, or delete a comment. Allowed for admins and moderators. */
export async function moderateComment(fd: FormData) {
  const admin = await requireAdmin("any");
  const id = String(fd.get("id") ?? "");
  const op = String(fd.get("op") ?? "");
  if (!id) return;

  if (op === "delete") {
    const { count } = await db.comment.deleteMany({ where: { id } });
    if (count) {
      await audit(admin.id, "comment.delete", id);
      log("info", "comment.deleted", { commentId: id, adminId: admin.id });
    }
  } else if (op in OPS) {
    const status = OPS[op as keyof typeof OPS];
    const { count } = await db.comment.updateMany({
      where: { id },
      data: { status, moderatedAt: status === "pending" ? null : new Date(), moderatedById: status === "pending" ? null : admin.id },
    });
    if (count) {
      await audit(admin.id, `comment.${status}`, id);
      log("info", "comment.moderated", { commentId: id, status, adminId: admin.id });
    }
  }
  revalidatePath("/admin", "layout");
}
