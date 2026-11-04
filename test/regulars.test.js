import { test } from "node:test";
import assert from "node:assert/strict";
import { listRegulars, listStarters, suggestions, missingPinned, STARTERS } from "../public/regulars.js";
import { learnKey } from "../public/categories.js";

const stats = {
  [learnKey("חלב")]: { n: "חלב", c: 5, t: 100, p: true },
  [learnKey("ביצים")]: { n: "ביצים", c: 9, t: 50 },
  [learnKey("לחם")]: { n: "לחם", c: 9, t: 80 },
  [learnKey("במבה")]: { n: "במבה", c: 20, t: 10, x: true }, // removed on purpose
};

test("regulars: pinned first, then most bought, then most recent; removed ones are hidden", () => {
  assert.deepEqual(listRegulars(stats).map((r) => r.name), ["חלב", "לחם", "ביצים"]);
});

test("regulars: tolerates missing or malformed entries", () => {
  assert.deepEqual(listRegulars({ a: null, b: { c: 3 }, c: { n: 5 } }), []);
  assert.deepEqual(listRegulars(undefined), []);
});

test("starters: skip what the family already has or removed, so a removed starter stays gone", () => {
  const starters = listStarters(stats);
  assert.ok(!starters.includes("חלב") && !starters.includes("ביצים") && !starters.includes("לחם"));
  assert.ok(!starters.includes("במבה"));
  assert.equal(listStarters({}).length, STARTERS.length);
});

test("suggestions: own products not on the list come first, then starters, and typing narrows them", () => {
  const onList = new Set([learnKey("ביצים")]);
  const all = suggestions(stats, onList, { limit: 50 });
  assert.deepEqual(all.slice(0, 2), ["חלב", "לחם"]);
  assert.ok(!all.includes("ביצים"));
  assert.deepEqual(suggestions(stats, onList, { typed: "לח" }), ["לחם"]);
  assert.equal(suggestions(stats, new Set(), { limit: 3 }).length, 3);
});

test("missingPinned: only pinned products that are not on the list yet", () => {
  assert.deepEqual(missingPinned(stats, new Set()).map((r) => r.name), ["חלב"]);
  assert.deepEqual(missingPinned(stats, new Set([learnKey("חלב")])), []);
});
