// The demo store stands in for Firestore, so these pin down the behaviours app.js relies on.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "../public/demo-store.js";

const settle = () => new Promise((r) => setTimeout(r, 5));
const db = fs.getFirestore();

test("the seeded cart is delivered to a query listener, ordered by createdAt", async () => {
  const q = fs.query(fs.collection(db, "carts", "demo", "items"), fs.orderBy("createdAt"));
  const snap = await new Promise((res) => { const off = fs.onSnapshot(q, (s) => { off(); res(s); }); });
  assert.ok(snap.docs.length >= 10);
  const times = snap.docs.map((d) => d.data().createdAt);
  assert.deepEqual(times, [...times].sort((a, b) => a - b));
  assert.ok(snap.docs.every((d) => typeof d.id === "string" && d.id));
});

test("a write notifies listeners, and a delete removes the document", async () => {
  const col = fs.collection(db, "carts", "t1", "items");
  const seen = [];
  const off = fs.onSnapshot(fs.query(col, fs.orderBy("createdAt")), (s) => seen.push(s.docs.length));
  await settle();
  const ref = await fs.addDoc(col, { name: "x", checked: false, createdAt: 1 });
  await settle();
  await fs.deleteDoc(ref);
  await settle();
  off();
  assert.deepEqual(seen, [0, 1, 0]);
});

test("updateDoc changes only the given fields; deleteField removes one", async () => {
  const ref = fs.doc(db, "carts", "t2", "items", "a");
  await fs.setDoc(ref, { name: "milk", qty: 3, note: "n", checked: false });
  await fs.updateDoc(ref, { checked: true, qty: fs.deleteField() });
  const snap = await new Promise((res) => { const off = fs.onSnapshot(ref, (s) => { off(); res(s); }); });
  assert.deepEqual(snap.data(), { name: "milk", note: "n", checked: true });
});

test("setDoc with merge deep-merges maps and increment() accumulates (the quick-add history doc)", async () => {
  const ref = fs.doc(db, "carts", "t3", "settings", "history");
  const bump = () => fs.setDoc(ref, { items: { milk: { n: "חלב", c: fs.increment(1), t: 5 } } }, { merge: true });
  await bump(); await bump();
  await fs.setDoc(ref, { items: { eggs: { n: "ביצים", c: fs.increment(1), t: 6 } } }, { merge: true });
  const snap = await new Promise((res) => { const off = fs.onSnapshot(ref, (s) => { off(); res(s); }); });
  assert.equal(snap.data().items.milk.c, 2);
  assert.equal(snap.data().items.eggs.c, 1);
});

test("a missing document reports exists() === false", async () => {
  const snap = await new Promise((res) => { const off = fs.onSnapshot(fs.doc(db, "carts", "t4", "settings", "prefs"), (s) => { off(); res(s); }); });
  assert.equal(snap.exists(), false);
});

test("writeBatch applies every operation and notifies once", async () => {
  const col = fs.collection(db, "carts", "t5", "items");
  const a = fs.doc(col, "a"), b = fs.doc(col, "b");
  let calls = 0, last = 0;
  const off = fs.onSnapshot(fs.query(col, fs.orderBy("createdAt")), (s) => { calls++; last = s.docs.length; });
  await settle();
  const batch = fs.writeBatch(db);
  batch.set(a, { name: "a", createdAt: 1 }).set(b, { name: "b", createdAt: 2 });
  await batch.commit();
  await settle();
  off();
  assert.equal(last, 2);
  assert.equal(calls, 2); // initial snapshot + one for the whole batch
});
