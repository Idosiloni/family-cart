import { test } from "node:test";
import assert from "node:assert/strict";
import { parseItems, splitQty, splitSpoken } from "../public/parse.js";

test("parseItems splits on newlines, commas, semicolons, bullets and plus", () => {
  assert.deepEqual(parseItems("חלב, ביצים\n• לחם; 2 עגבניות + שמן זית"), ["חלב", "ביצים", "לחם", "2 עגבניות", "שמן זית"]);
});

test("parseItems ignores empty input", () => {
  assert.deepEqual(parseItems(""), []);
  assert.deepEqual(parseItems(" , ;\n"), []);
});

test("parseItems caps the number of items per submit", () => {
  const many = Array.from({ length: 100 }, (_, i) => `פריט${i}`).join(",");
  assert.ok(parseItems(many).length <= 40);
});

test("splitQty reads a leading number, a trailing x or ×, and ranges", () => {
  assert.deepEqual(splitQty("3 חלב"), { name: "חלב", qty: 3 });
  assert.deepEqual(splitQty("חלב x3"), { name: "חלב", qty: 3 });
  assert.deepEqual(splitQty("חלב ×2"), { name: "חלב", qty: 2 });
  assert.deepEqual(splitQty("5-6 בננות"), { name: "בננות", qty: 5 });
});

test("splitQty leaves weights, units and percentages alone", () => {
  assert.deepEqual(splitQty('2 ק"ג עגבניות'), { name: '2 ק"ג עגבניות', qty: 1 });
  assert.deepEqual(splitQty("חלב 3%"), { name: "חלב 3%", qty: 1 });
  assert.deepEqual(splitQty("חלב"), { name: "חלב", qty: 1 });
});

test("splitSpoken starts a new item at each known product and strips the Hebrew 'and' prefix", () => {
  assert.equal(splitSpoken("חלב ביצים שמן זית ולחם"), "חלב, ביצים, שמן זית, לחם");
});
