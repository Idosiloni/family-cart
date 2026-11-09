// "Our products": the things this family buys again and again.
// Pure helpers (no DOM, no Firebase), so they can be unit-tested in Node.
//
// The data is the cart's history doc: { items: { [learnKey]: { n: name, c: times added, t: last added, p?: pinned, x?: hidden,
//   g?: sum of the gaps between purchases (ms), m?: how many gaps } } }.
// g and m let us say how often a product is bought (g / m) and so when it is probably running low.
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

// ---- Running low: how often is this bought, and is it overdue? ----
const DAY = 86400000;
const MIN_GAP = 12 * 3600000; // adding the same thing twice in one trip is not a repurchase
const MAX_GAP = 180 * DAY;    // a long break (holiday, a product tried once) says nothing about the habit

// What to add to a product's g and m when it is added again at `now`, or null if this add isn't a new purchase.
export function gapSince(prev, now) {
  const last = Number(prev?.t) || 0;
  const gap = now - last;
  return last && gap >= MIN_GAP && gap <= MAX_GAP ? { g: gap, m: 1 } : null;
}

// Typical days between purchases, once there are at least two gaps to average; otherwise null.
export function typicalDays(v) {
  const m = Number(v?.m) || 0, g = Number(v?.g) || 0;
  return m >= 2 && g > 0 ? g / m / DAY : null;
}

// Products that are probably running out: bought regularly (every 2 to 60 days), not on the list, and the usual time
// since the last purchase has passed. Most overdue first. `snoozed` is { learnKey: until } ("not now").
export function dueItems(stats, onList, { now = Date.now(), snoozed = {}, limit = 6 } = {}) {
  const out = [];
  for (const [key, v] of Object.entries(stats || {})) {
    if (!v || typeof v.n !== "string" || !v.n || v.x === true || onList.has(key)) continue;
    if ((snoozed[key] || 0) > now) continue;
    const every = typicalDays(v);
    if (every === null || every < 2 || every > 60) continue;
    const since = (now - (Number(v.t) || 0)) / DAY;
    if (since < every) continue;
    out.push({ key, name: v.n, since: Math.floor(since), ratio: since / every });
  }
  return out.sort((a, b) => b.ratio - a.ratio).slice(0, limit);
}

// "לפני 9 ימים", "לפני 3 שבועות".
export function agoText(days) {
  if (days < 2) return "אתמול";
  if (days < 14) return `לפני ${days} ימים`;
  const w = Math.round(days / 7);
  return `לפני ${w} שבועות`;
}
