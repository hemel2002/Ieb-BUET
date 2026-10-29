import assert from "node:assert/strict";
import { test } from "node:test";
import { hashPassword, verifyPassword } from "../src/lib/password";

test("hash verifies only the original password", async () => {
  const hash = await hashPassword("correct horse battery");
  assert.match(hash, /^scrypt\$131072\$8\$1\$/);
  assert.equal(await verifyPassword("correct horse battery", hash), true);
  assert.equal(await verifyPassword("correct horse batterY", hash), false);
});

test("malformed stored hashes are rejected", async () => {
  assert.equal(await verifyPassword("x", "plaintext"), false);
  assert.equal(await verifyPassword("x", ""), false);
});
