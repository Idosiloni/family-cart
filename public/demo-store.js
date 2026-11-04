// In-memory stand-in for the slice of the Firestore API that app.js uses.
// Loaded instead of the real SDK when the URL hash is "#demo" (see db.js), so the app can be
// tried, screenshotted and tested without a Firebase project or touching anyone's real cart.
import { classify, learnKey } from "./categories.js";

const DELETE = { __op: "delete" };
const store = new Map();      // "carts/demo/items/abc" -> data
const listeners = new Set();  // { path, query, cb }
let seq = 0;

const isPlain = (v) => v && typeof v === "object" && !Array.isArray(v) && !v.__op;
const clone = (v) => JSON.parse(JSON.stringify(v));
const parentOf = (path) => path.slice(0, path.lastIndexOf("/"));

// Applies a patch to `base`, resolving increment()/deleteField() sentinels.
// deep = true merges nested maps (setDoc with merge); false replaces them (updateDoc).
function apply(base, patch, deep) {
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v === DELETE) delete out[k];
    else if (v && v.__op === "inc") out[k] = (Number(base[k]) || 0) + v.n;
    else if (isPlain(v)) out[k] = apply(deep && isPlain(base[k]) ? base[k] : {}, v, deep);
    else out[k] = v;
  }
  return out;
}

export const getFirestore = () => ({ demo: true });
export const increment = (n) => ({ __op: "inc", n });
export const deleteField = () => DELETE;
export const orderBy = (field) => ({ orderBy: field });
export const collection = (_db, ...segs) => ({ kind: "col", path: segs.join("/") });
export const query = (col, ...constraints) => ({ ...col, kind: "query", orderBy: constraints.find((c) => c.orderBy)?.orderBy });

export function doc(base, ...segs) {
  const path = base.kind === "col" ? `${base.path}/${segs[0] || `d${++seq}`}` : segs.join("/");
  return { kind: "doc", path, id: path.slice(path.lastIndexOf("/") + 1) };
}

function snapshot(l) {
  if (l.kind === "doc") {
    const data = store.get(l.path);
    return { id: l.path.slice(l.path.lastIndexOf("/") + 1), exists: () => data !== undefined, data: () => clone(data) };
  }
  const docs = [...store].filter(([p]) => parentOf(p) === l.path).map(([p, data]) => ({
    id: p.slice(p.lastIndexOf("/") + 1), data: () => clone(data),
  }));
  if (l.orderBy) docs.sort((a, b) => a.data()[l.orderBy] - b.data()[l.orderBy]);
  return { docs };
}

// Real Firestore calls listeners right after a local write, so do the same (asynchronously).
function notify(paths) {
  const touched = new Set(paths.flatMap((p) => [p, parentOf(p)]));
  for (const l of listeners) if (touched.has(l.path)) setTimeout(() => listeners.has(l) && l.cb(snapshot(l)), 0);
}

export function onSnapshot(ref, cb) {
  const l = { kind: ref.kind === "doc" ? "doc" : "query", path: ref.path, orderBy: ref.orderBy, cb };
  listeners.add(l);
  setTimeout(() => listeners.has(l) && cb(snapshot(l)), 0);
  return () => listeners.delete(l);
}

const write = {
  set: (ref, data, opts) => store.set(ref.path, apply(opts?.merge ? store.get(ref.path) || {} : {}, data, !!opts?.merge)),
  update: (ref, data) => store.set(ref.path, apply(store.get(ref.path) || {}, data, false)),
  delete: (ref) => store.delete(ref.path),
};
const run = (ops) => { ops.forEach(([op, ref, data, opts]) => write[op](ref, data, opts)); notify(ops.map(([, ref]) => ref.path)); };

export const setDoc = async (ref, data, opts) => run([["set", ref, data, opts]]);
export const updateDoc = async (ref, data) => run([["update", ref, data]]);
export const deleteDoc = async (ref) => run([["delete", ref]]);
export const addDoc = async (col, data) => { const ref = doc(col); run([["set", ref, data]]); return ref; };
export function writeBatch() {
  const ops = [];
  const batch = {
    set: (ref, data, opts) => (ops.push(["set", ref, data, opts]), batch),
    update: (ref, data) => (ops.push(["update", ref, data]), batch),
    delete: (ref) => (ops.push(["delete", ref]), batch),
    commit: async () => run(ops),
  };
  return batch;
}

// ---- Seed: a believable mid-week family list, a few already in the cart ----
const now = Date.now();
[
  ["חלב 3%", 1, "", "אמא", false], ["ביצים", 2, "", "אבא", false], ["גבינה צהובה", 1, "פרוסות", "אמא", false],
  ["לחם מלא", 1, "פרוס", "אבא", false], ["עגבניות שרי", 1, "", "", false], ["מלפפונים", 1, "", "", false],
  ["חזה עוף", 2, "", "אמא", false], ["אורז בסמטי", 1, "", "", false], ["פסטה", 3, "", "", false],
  ["אבקת כביסה", 1, "", "אבא", false], ["שמן זית", 1, "", "", false], ["קולה זירו", 6, "", "נועה", false],
  ["במבה", 2, "", "נועה", false], ["גלידה וניל", 1, "", "נועה", false],
  ["אבוקדו", 3, "", "אמא", true], ["פיתות", 1, "", "אבא", true], ["שמנת מתוקה", 1, "", "אמא", true],
].forEach(([name, qty, note, addedBy, checked], i) => {
  const data = { name, checked, createdAt: now - (30 - i) * 60000, category: classify(name) };
  if (qty > 1) data.qty = qty;
  if (note) data.note = note;
  if (addedBy) data.addedBy = addedBy;
  store.set(`carts/demo/items/seed${i}`, data);
});

// "Our products": what this family has bought before (counts), a few pinned.
const t0 = now - 86400000;
store.set("carts/demo/settings/history", { items: Object.fromEntries([
  ["חלב 3%", 14, true], ["ביצים", 12, true], ["לחם מלא", 11, true], ["עגבניות שרי", 9], ["מלפפונים", 9], ["במבה", 8],
  ["קולה זירו", 7], ["חזה עוף", 6], ["אורז בסמטי", 5], ["גבינה צהובה", 5], ["פסטה", 4], ["שמן זית", 3], ["אבקת כביסה", 2],
].map(([n, c, p], i) => [learnKey(n), { n, c, t: t0 - i * 3600000, ...(p ? { p: true } : {}) }])) });

// Receipts from earlier trips, so the prices tab has something to compare.
[["shufersal", 412.5, 31, 21], ["carrefour", 389, 28, 14], ["rami-levy", 361.9, 29, 8], ["shufersal", 398.2, 27, 3], ["carrefour", 402.4, 30, 0]]
  .forEach(([storeId, total, n, daysAgo], i) => store.set(`carts/demo/receipts/r${i}`, { storeId, total, items: n, t: now - daysAgo * 86400000 - 3600000 }));

// A "family member" adds something a while after load, so the live-sync toast can be seen.
if (typeof document !== "undefined") {
  setTimeout(() => {
    addDoc(collection(null, "carts", "demo", "items"), {
      name: "בננות", checked: false, createdAt: Date.now(), category: classify("בננות"), addedBy: "סבתא",
    });
  }, 14000);
}
