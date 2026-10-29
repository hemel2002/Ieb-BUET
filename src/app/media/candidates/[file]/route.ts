import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PHOTO_FILE_PATTERN, photoDir } from "@/lib/images";

// Uploaded photos live outside /public (which is fixed at build time) and are served here.
// File names are random UUIDs that change on every upload, so they can be cached forever.
export async function GET(_req: Request, ctx: RouteContext<"/media/candidates/[file]">) {
  const { file } = await ctx.params;
  if (!PHOTO_FILE_PATTERN.test(file)) return new Response("Not found", { status: 404 });
  try {
    const data = await readFile(join(photoDir(), file));
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
