// Shared by the app and the import script, so it must stay dependency-free.

const HONORIFICS = new Set(["engr", "dr", "prof", "brig", "gen", "peng", "psc", "retd"]);

export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** "ENGR. SYED MAHFUZ AHMAD, PEng." + "F/04266" -> "syed-mahfuz-ahmad-f04266" */
export function candidateSlug(fullName: string, membershipNo?: string | null): string {
  const words = slugify(fullName.replace(/\(.*?\)/g, " "))
    .split("-")
    .filter((w) => w && !HONORIFICS.has(w));
  const base = words.join("-") || "candidate";
  const suffix = membershipNo ? slugify(membershipNo).replace(/-/g, "") : "";
  return suffix ? `${base}-${suffix}` : base;
}
