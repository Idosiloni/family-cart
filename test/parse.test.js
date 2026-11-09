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

// ---- Behaviour worth keeping (pinned before the parser was extended) ----
test("pinned: the ו prefix splits only before a recognised product, so וופל and וודקה stay whole", () => {
  assert.deepEqual(parseItems("חלב ולחם וביצים"), ["חלב", "לחם", "ביצים"]);
  assert.deepEqual(parseItems("וופל"), ["וופל"]);
  assert.deepEqual(parseItems("וודקה"), ["וודקה"]);
});

test("pinned: WhatsApp export prefixes, bullets, numbering, checkboxes and headings are cleaned", () => {
  assert.deepEqual(parseItems("[13:15, 9/9/2026] אמא: חלב, לחם"), ["חלב", "לחם"]);
  assert.deepEqual(parseItems("סופר:\n• חלב\n1. לחם\n☐ ביצים\nחלב!!!"), ["חלב", "לחם", "ביצים"]);
});

test("pinned: commas inside parentheses stay in one item; percentages and units are not quantities", () => {
  assert.deepEqual(parseItems("שתייה (קולה, זירו), חלב"), ["שתייה (קולה / זירו)", "חלב"]);
  assert.deepEqual(parseItems("חלב 3%, קוטג' 5%"), ["חלב 3%", "קוטג' 5%"]);
  assert.deepEqual(splitQty("2 ליטר מים"), { name: "2 ליטר מים", qty: 1 });
  assert.deepEqual(splitQty("10 ביצים"), { name: "ביצים", qty: 10 });
});

test("pinned: speech with no commas is cut into products", () => {
  assert.equal(splitSpoken("חלב ביצים שמן זית ולחם"), "חלב, ביצים, שמן זית, לחם");
});

// ---- Quantities in words, fillers, parentheses ----
test("splitQty reads Hebrew number words", () => {
  assert.deepEqual(splitQty("שלוש בננות"), { name: "בננות", qty: 3 });
  assert.deepEqual(splitQty("שתי חלב"), { name: "חלב", qty: 2 });
  assert.deepEqual(splitQty("זוג גרביים"), { name: "גרביים", qty: 2 });
  assert.deepEqual(splitQty("שלוש קילו עגבניות"), { name: "3 קילו עגבניות", qty: 1 }); // a weight, not a count
});

test("splitQty reads a number in parentheses, but never a bare trailing number (that is a fat percentage)", () => {
  assert.deepEqual(splitQty("פיתות (6)"), { name: "פיתות", qty: 6 });
  assert.deepEqual(splitQty("חלב 3"), { name: "חלב 3", qty: 1 });
  assert.deepEqual(splitQty("קוטג' 5"), { name: "קוטג' 5", qty: 1 });
  assert.deepEqual(splitQty("שמנת 15"), { name: "שמנת 15", qty: 1 });
  assert.deepEqual(splitQty("חלב (3%)"), { name: "חלב (3%)", qty: 1 });
});

test("parseItems drops fillers like 'עוד' and 'לא לשכוח'", () => {
  assert.deepEqual(parseItems("עוד חלב, לא לשכוח ביצים\nגם לחם"), ["חלב", "ביצים", "לחם"]);
  assert.deepEqual(parseItems("צריך שתי חלב"), ["שתי חלב"]);
});

test("splitSpoken starts a new item at a number word", () => {
  assert.equal(splitSpoken("חלב שתי ביצים שלוש בננות"), "חלב, שתי ביצים, שלוש בננות");
});

test("a unit is a whole word: 'גר' (grams) must not swallow גרביים, 'מל' (ml) must not swallow מלפפונים", () => {
  assert.deepEqual(splitQty("5 מלפפונים"), { name: "מלפפונים", qty: 5 });
  assert.deepEqual(splitQty("3 גרנולה"), { name: "גרנולה", qty: 3 });
  assert.deepEqual(splitQty("2 גרביים"), { name: "גרביים", qty: 2 });
  assert.deepEqual(splitQty("200 גר גבינה"), { name: "200 גר גבינה", qty: 1 });
  assert.deepEqual(splitQty("2 קילו בשר"), { name: "2 קילו בשר", qty: 1 });
});
