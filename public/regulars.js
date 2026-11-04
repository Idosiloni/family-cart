// "Our products": the things this family buys again and again.
// Pure helpers (no DOM, no Firebase), so they can be unit-tested in Node.
//
// The data is the cart's history doc: { items: { [learnKey]: { n: name, c: times added, t: last added, p?: pinned, x?: hidden } } }.
// Every product added to the list is counted there, so the database builds itself.
import { learnKey } from "./categories.js";

// Shown until the family has a history of its own.
export const STARTERS = ["חלב", "ביצים", "לחם", "עגבניות", "מלפפונים", "במבה", "קולה", "אורז", "גבינה צהובה", "קוטג'", "שמן", "פסטה"];

// The family's own products, pinned first, then most bought, then most recent. Removed ones are skipped.
export function listRegulars(stats = {}) {
  return Object.entries(stats)
    .filter(([, v]) => v && typeof v.n === "string" && v.n && v.x !== true)
    .map(([key, v]) => ({ key, name: v.n, count: Number(v.c) || 0, last: Number(v.t) || 0, pinned: v.p === true }))
    .sort((a, b) => (b.pinned - a.pinned) || (b.count - a.count) || (b.last - a.last) || a.name.localeCompare(b.name, "he"));
}

// Starter ideas the family has not already got (as a product of its own, or removed on purpose).
export function listStarters(stats = {}) {
  const known = new Set(Object.keys(stats));
  return STARTERS.filter((n) => !known.has(learnKey(n)));
}

// Names for the quick-add chips: regulars that are not on the list yet (pinned first), then starters.
// `onList` is a Set of learnKeys of everything on the list. `typed` narrows the chips while someone is typing.
export function suggestions(stats, onList, { typed = "", limit = 10 } = {}) {
  const mine = listRegulars(stats).filter((r) => !onList.has(r.key)).map((r) => r.name);
  const starters = listStarters(stats).filter((n) => !onList.has(learnKey(n)));
  const q = typed.trim().toLowerCase();
  const all = [...mine, ...starters];
  return (q ? all.filter((n) => n.toLowerCase().includes(q)) : all).slice(0, limit);
}

// Pinned regulars that are not on the list: "add all the usuals" in one tap.
export function missingPinned(stats, onList) {
  return listRegulars(stats).filter((r) => r.pinned && !onList.has(r.key));
}
