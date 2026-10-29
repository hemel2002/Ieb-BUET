import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { del, put } from "@vercel/blob";
import sharp, { type Metadata } from "sharp";

// Vercel rejects function request bodies over 4.5 MB, so uploads are capped below that.
export const PHOTO_MAX_BYTES = 4 * 1024 * 1024;
export const PHOTO_SIZES = [400, 800] as const; // widths; height is 5/4 of width (4:5 portrait)
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);
export const PHOTO_FILE_PATTERN = /^[0-9a-f-]{36}-(400|800)\.webp$/;
const LOCAL_KEY = /^[0-9a-f-]{36}$/;

/** Photos go to Vercel Blob when its token is configured, otherwise to UPLOAD_DIR on local disk. */
const useBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export function photoDir() {
  return resolve(process.env.UPLOAD_DIR || "./storage/uploads", "candidates");
}

export class PhotoError extends Error {}

/**
 * Decodes the upload with sharp (rejecting anything that is not a real JPEG/PNG/WebP),
 * auto-rotates, crops to 4:5 and re-encodes to WebP. Re-encoding strips metadata and
 * any payload hidden in the original file. Returns the value stored as Candidate.photoKey.
 */
export async function savePhoto(file: File): Promise<string> {
  if (file.size === 0) throw new PhotoError("Please choose an image file.");
  if (file.size > PHOTO_MAX_BYTES) throw new PhotoError("The image must be 4 MB or smaller.");
  const input = Buffer.from(await file.arrayBuffer());

  let meta: Metadata;
  try {
    meta = await sharp(input).metadata();
  } catch {
    throw new PhotoError("This file is not a readable image.");
  }
  if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) throw new PhotoError("Please upload a JPEG, PNG or WebP image.");
  if (!meta.width || !meta.height || meta.width < 200 || meta.height < 250) {
    throw new PhotoError("The image is too small. Please use one at least 200 × 250 pixels.");
  }
  if (meta.width * meta.height > 40_000_000) throw new PhotoError("The image dimensions are too large.");

  const id = randomUUID();
  const outputs = await Promise.all(
    PHOTO_SIZES.map(async (width) => ({
      width,
      data: await sharp(input)
        .rotate()
        .resize(width, Math.round((width * 5) / 4), { fit: "cover", position: "attention" })
        .webp({ quality: 82 })
        .toBuffer(),
    })),
  );

  if (useBlob()) {
    const uploaded = await Promise.all(
      outputs.map(({ width, data }) =>
        put(`candidates/${id}-${width}.webp`, data, {
          access: "public",
          contentType: "image/webp",
          addRandomSuffix: false,
          cacheControlMaxAge: 31536000,
        }),
      ),
    );
    // Stored without the size suffix; the page appends "-400.webp" / "-800.webp".
    return uploaded[0].url.replace(/-400\.webp$/, "");
  }

  await mkdir(photoDir(), { recursive: true });
  await Promise.all(outputs.map(({ width, data }) => writeFile(join(photoDir(), `${id}-${width}.webp`), data)));
  return id;
}

export async function deletePhoto(photoKey: string | null | undefined) {
  if (!photoKey) return;
  if (photoKey.startsWith("https://")) {
    if (useBlob()) await del(PHOTO_SIZES.map((w) => `${photoKey}-${w}.webp`));
    return;
  }
  if (!LOCAL_KEY.test(photoKey)) return;
  await Promise.all(PHOTO_SIZES.map((w) => rm(join(photoDir(), `${photoKey}-${w}.webp`), { force: true })));
}
