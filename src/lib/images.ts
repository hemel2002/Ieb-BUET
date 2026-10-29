import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import sharp, { type Metadata } from "sharp";

export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_SIZES = [400, 800] as const; // widths; height is 5/4 of width (4:5 portrait)
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);
export const PHOTO_FILE_PATTERN = /^[0-9a-f-]{36}-(400|800)\.webp$/;

export function photoDir() {
  return resolve(process.env.UPLOAD_DIR || "./storage/uploads", "candidates");
}

export class PhotoError extends Error {}

/**
 * Decodes the upload with sharp (rejecting anything that is not a real JPEG/PNG/WebP),
 * auto-rotates, crops to 4:5 and re-encodes to WebP. Re-encoding strips metadata and
 * any payload hidden in the original file. Returns the key stored on the candidate.
 */
export async function savePhoto(file: File): Promise<string> {
  if (file.size === 0) throw new PhotoError("Please choose an image file.");
  if (file.size > PHOTO_MAX_BYTES) throw new PhotoError("The image must be 5 MB or smaller.");
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

  const key = randomUUID();
  await mkdir(photoDir(), { recursive: true });
  for (const width of PHOTO_SIZES) {
    const output = await sharp(input)
      .rotate()
      .resize(width, Math.round((width * 5) / 4), { fit: "cover", position: "attention" })
      .webp({ quality: 82 })
      .toBuffer();
    await writeFile(join(photoDir(), `${key}-${width}.webp`), output);
  }
  return key;
}

export async function deletePhoto(key: string | null | undefined) {
  if (!key || !/^[0-9a-f-]{36}$/.test(key)) return;
  await Promise.all(PHOTO_SIZES.map((w) => rm(join(photoDir(), `${key}-${w}.webp`), { force: true })));
}
