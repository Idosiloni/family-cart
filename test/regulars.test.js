import { test } from "node:test";
import assert from "node:assert/strict";
import { listRegulars, listStarters, suggestions, missingPinned, STARTERS, gapSince, typicalDays, dueItems, agoText } from "../public/regulars.js";
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

const DAY = 86400000;

test("gapSince: a new purchase adds its gap; the same trip or a long break adds nothing", () => {
  const now = 1_000 * DAY;
  assert.deepEqual(gapSince({ t: now - 7 * DAY }, now), { g: 7 * DAY, m: 1 });
  assert.equal(gapSince({ t: now - 3600000 }, now), null);   // an hour ago: same trip
  assert.equal(gapSince({ t: now - 400 * DAY }, now), null); // over six months: not a habit
  assert.equal(gapSince(undefined, now), null);              // first time ever
});

test("typicalDays needs two gaps before it says anything", () => {
  assert.equal(typicalDays({ g: 7 * DAY, m: 1 }), null);
  assert.equal(typicalDays({ g: 14 * DAY, m: 2 }), 7);
  assert.equal(typicalDays({}), null);
});

test("dueItems: overdue regulars that are not on the list, most overdue first", () => {
  const now = 100 * DAY;
  const h = {
    [learnKey("חלב")]: { n: "חלב", c: 9, t: now - 9 * DAY, g: 14 * DAY, m: 2 },     // every 7 days, 9 ago: due
    [learnKey("ביצים")]: { n: "ביצים", c: 9, t: now - 20 * DAY, g: 14 * DAY, m: 2 }, // every 7, 20 ago: very due
    [learnKey("לחם")]: { n: "לחם", c: 9, t: now - 3 * DAY, g: 14 * DAY, m: 2 },     // not yet
    [learnKey("אורז")]: { n: "אורז", c: 2, t: now - 90 * DAY, g: 90 * DAY, m: 1 },  // one gap: unknown
    [learnKey("שמן")]: { n: "שמן", c: 9, t: now - 90 * DAY, g: 200 * DAY, m: 2 },    // every 100 days: too rare to nag
    [learnKey("קולה")]: { n: "קולה", c: 9, t: now - 30 * DAY, g: 2 * DAY, m: 2, x: true }, // removed
  };
  assert.deepEqual(dueItems(h, new Set(), { now }).map((d) => d.name), ["ביצים", "חלב"]);
  assert.deepEqual(dueItems(h, new Set([learnKey("ביצים")]), { now }).map((d) => d.name), ["חלב"]);
  assert.deepEqual(dueItems(h, new Set(), { now, snoozed: { [learnKey("ביצים")]: now + DAY } }).map((d) => d.name), ["חלב"]);
  assert.deepEqual(dueItems(h, new Set(), { now, snoozed: { [learnKey("ביצים")]: now - 1 } }).map((d) => d.name), ["ביצים", "חלב"]); // snooze over
  assert.equal(dueItems(h, new Set(), { now, limit: 1 }).length, 1);
  assert.deepEqual(dueItems(undefined, new Set()), []);
});

test("agoText", () => {
  assert.equal(agoText(1), "אתמול");
  assert.equal(agoText(9), "לפני 9 ימים");
  assert.equal(agoText(21), "לפני 3 שבועות");
});
