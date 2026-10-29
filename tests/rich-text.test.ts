import assert from "node:assert/strict";
import { test } from "node:test";
import { parseRichText } from "../src/lib/rich-text";

test("headings, paragraphs and both list types", () => {
  const blocks = parseRichText("## Vision\nA line\ncontinued\n\n- one\n- two\n\n1. first\n2) second");
  assert.deepEqual(blocks, [
    { type: "heading", text: "Vision" },
    { type: "paragraph", text: "A line\ncontinued" },
    { type: "list", ordered: false, items: ["one", "two"] },
    { type: "list", ordered: true, items: ["first", "second"] },
  ]);
});

test("HTML is kept as literal text, never interpreted", () => {
  assert.deepEqual(parseRichText("<script>alert(1)</script>"), [{ type: "paragraph", text: "<script>alert(1)</script>" }]);
});

test("a continuation line joins the previous list item", () => {
  assert.deepEqual(parseRichText("- item\n  wraps here"), [{ type: "list", ordered: false, items: ["item wraps here"] }]);
});

test("empty input produces nothing", () => {
  assert.deepEqual(parseRichText(null), []);
  assert.deepEqual(parseRichText("   \n\n"), []);
});
