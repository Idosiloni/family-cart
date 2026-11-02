import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, categoryById, normalizeOrder, DEFAULT_ORDER, learnKey, setLearned } from "../public/categories.js";

test("common Hebrew products land in the right supermarket section", () => {
  const cases = {
    "חלב": "dairy", "ביצים": "dairy", "עגבניות שרי": "produce", "לחם מלא": "bakery",
    "חזה עוף": "meat", "שמן זית": "pantry", "במבה": "snacks", "קולה זירו": "drinks",
    "גלידה וניל": "frozen", "אבקת כביסה": "cleaning", "נייר טואלט": "hygiene",
  };
  for (const [name, id] of Object.entries(cases)) assert.equal(classify(name), id, name);
});

test("the longest matching keyword wins", () => {
  assert.equal(classify("חלב שקדים"), "dairy");  // "חלב שקדים" beats the pantry word "שקדים"
  assert.equal(classify("שוקולד חלב"), "snacks"); // chocolate bar, not milk
});

test("short keywords must match a whole word, not a substring", () => {
  assert.equal(classify("מים"), "drinks");
  assert.notEqual(classify("מימון"), "drinks");
});

test("unknown products fall back to 'other'", () => {
  assert.equal(classify("qwertyxyz"), "other");
});

test("categoryById never returns undefined for a bad id", () => {
  assert.equal(categoryById("nope").id, "other");
});

test("normalizeOrder drops unknown ids and keeps the family's order for known ones", () => {
  const order = normalizeOrder(["dairy", "bogus", "produce"]);
  assert.ok(!order.includes("bogus"));
  assert.ok(order.indexOf("dairy") < order.indexOf("produce"), "saved relative order is kept");
  assert.equal(new Set(order).size, DEFAULT_ORDER.length, "every section appears exactly once");
  assert.deepEqual(normalizeOrder(undefined), DEFAULT_ORDER);
});

test("a section missing from a saved order is placed right after its default neighbour", () => {
  const saved = DEFAULT_ORDER.filter((id) => id !== "dairy").reverse(); // family reversed everything, never saw "dairy"
  const order = normalizeOrder(saved);
  const before = DEFAULT_ORDER[DEFAULT_ORDER.indexOf("dairy") - 1];
  assert.equal(order.indexOf("dairy"), order.indexOf(before) + 1);
});

test("a family correction overrides the built-in classification", () => {
  assert.equal(classify("חלב"), "dairy");
  setLearned({ [learnKey("חלב")]: "snacks" });
  assert.equal(classify("חלב"), "snacks");
  setLearned({});
  assert.equal(classify("חלב"), "dairy");
});

test("learnKey ignores whitespace, quantities and percentages", () => {
  assert.equal(learnKey("  חלב  3% "), learnKey("חלב"));
});
