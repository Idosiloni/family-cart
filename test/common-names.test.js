import { test } from "node:test";
import assert from "node:assert/strict";
import { COMMON_BY_SECTION, COMMON_NAMES } from "../public/common-names.js";
import { classify } from "../public/categories.js";
import { matchKey } from "../public/names.js";

test("every everyday name lands in the section it is listed under", () => {
  const wrong = [];
  for (const [id, names] of Object.entries(COMMON_BY_SECTION)) for (const n of names) if (classify(n) !== id) wrong.push(`${n}: ${classify(n)} (want ${id})`);
  assert.deepEqual(wrong, []);
});

test("no name is listed twice, even under another spelling", () => {
  const seen = new Map(), dupes = [];
  for (const n of COMMON_NAMES) { const k = matchKey(n); if (seen.has(k)) dupes.push(`${n} / ${seen.get(k)}`); seen.set(k, n); }
  assert.deepEqual(dupes, []);
});

test("names fit the limits the database enforces", () => {
  for (const n of COMMON_NAMES) assert.ok(n.length >= 2 && n.length <= 40, n);
});
