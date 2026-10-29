import assert from "node:assert/strict";
import { test } from "node:test";
import { candidateSlug } from "../src/lib/slug";

test("honorifics and suffixes are dropped, membership number keeps slugs unique", () => {
  assert.equal(candidateSlug("ENGR. SYED MAHFUZ AHMAD, PEng.", "F/04266"), "syed-mahfuz-ahmad-f04266");
  assert.equal(candidateSlug("BRIG. GEN. ENGR. M. MOFIZUR RAHMAN, PSC, PEng. (Retd.)", "F/03595"), "m-mofizur-rahman-f03595");
  assert.equal(candidateSlug("PROF. DR. ENGR. MD. ALI", "F/07759"), "md-ali-f07759");
});

test("same name with different membership numbers gives different slugs", () => {
  assert.notEqual(candidateSlug("ENGR. MD. SADEQUR RAHMAN", "F/06517"), candidateSlug("ENGR. MD. SADEQUR RAHMAN", "M/24579"));
});

test("works without a membership number", () => {
  assert.equal(candidateSlug("ENGR. NEW PERSON", null), "new-person");
});
