import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { matchProduct, compareStores, estimateTotal, receiptStats, priceKey } from "../public/pricing.js";

const data = JSON.parse(readFileSync(new URL("../public/prices.json", import.meta.url), "utf8"));
const real = data.products;
const idOf = (name) => matchProduct(name, real)?.id ?? null;

// Small hand-made catalogue so the arithmetic is obvious.
const products = [
  { id: "a", name: "אלף", size: "1", aliases: ["אלף"], prices: { x: 10, y: 12, z: 11 } },
  { id: "b", name: "בית", size: "1", aliases: ["בית"], prices: { x: 5, y: 4 } }, // z has no price for it
  { id: "c", name: "גימל", size: "1", aliases: ["גימל"], prices: { x: 3, y: 3, z: 3 } },
];
const chains = [{ id: "x", name: "X" }, { id: "y", name: "Y" }, { id: "z", name: "Z" }];
const totalOf = (r, id) => r.rows.find((x) => x.chainId === id).total;

test("a chain missing a price for an item can never win by being incomplete", () => {
  const r = compareStores({ items: [{ name: "אלף" }, { name: "בית" }], products, chains });
  // naive sums would be x 15, y 16, z 11 (z "wins" only because it lacks בית)
  assert.equal(r.comparableCount, 1);
  assert.deepEqual(r.partial, ["בית"]);
  assert.equal(totalOf(r, "x"), 10);
  assert.equal(totalOf(r, "z"), 11);
  assert.equal(r.cheapestId, "x");
  assert.equal(r.spread, 2);
});

test("totals multiply by quantity and coverage is reported per chain", () => {
  const r = compareStores({ items: [{ name: "אלף", qty: 3 }, { name: "גימל", qty: 2 }, { name: "בית" }], products, chains });
  assert.equal(totalOf(r, "x"), 36); // 3*10 + 2*3
  assert.equal(totalOf(r, "y"), 42);
  assert.equal(totalOf(r, "z"), 39);
  assert.equal(r.rows.find((x) => x.chainId === "x").pricedCount, 3);
  assert.equal(r.rows.find((x) => x.chainId === "z").pricedCount, 2);
});

test("family-entered prices override file prices and can fill a gap", () => {
  const userPrices = { [priceKey("אלף")]: { z: 7 }, [priceKey("בית")]: { z: 6 } };
  const r = compareStores({ items: [{ name: "אלף" }, { name: "בית" }], products, userPrices, chains });
  assert.equal(r.comparableCount, 2); // z now has בית, so both items count
  assert.equal(totalOf(r, "z"), 13);
  assert.equal(totalOf(r, "x"), 15);
  assert.equal(r.cheapestId, "z");
});

test("a store that only has family prices can be compared; items nobody priced are listed", () => {
  const ch = [...chains.slice(0, 2), { id: "w", name: "W" }];
  const userPrices = { [priceKey("חלוצים")]: { x: 9, y: 9, w: 8 } };
  const r = compareStores({ items: [{ name: "חלוצים" }, { name: "משהו לא ידוע" }, { name: "אלף" }], products, userPrices, chains: ch });
  assert.equal(r.comparableCount, 1); // only חלוצים is priced at x, y and w
  assert.deepEqual(r.unpriced, ["משהו לא ידוע"]);
  assert.deepEqual(r.partial, ["אלף"]);
  assert.equal(r.cheapestId, "w");
});

test("nothing comparable means no winner", () => {
  const r = compareStores({ items: [{ name: "בית" }], products, chains });
  assert.equal(r.comparableCount, 0);
  assert.equal(r.cheapestId, null);
  assert.equal(r.spread, 0);
  assert.equal(compareStores({ items: [{ name: "אלף" }], products, chains: [chains[0]] }).cheapestId, null);
});

test("estimateTotal prices one chain and names what is missing", () => {
  const e = estimateTotal({ items: [{ name: "אלף", qty: 2 }, { name: "בית" }, { name: "לא קיים" }], products, chainId: "z" });
  assert.deepEqual(e, { total: 22, pricedCount: 1, missing: ["בית", "לא קיים"] });
  assert.equal(estimateTotal({ items: [{ name: "בית" }], products, chainId: "x" }).total, 5);
});

test("matching: everyday names find the right product, lookalikes find none", () => {
  assert.equal(idOf("חלב"), "milk3");
  assert.equal(idOf("חלב 3%"), "milk3");
  assert.equal(idOf("חלב תנובה"), "milk3");
  assert.equal(idOf("חלב 1%"), "milk1");
  assert.equal(idOf("חלב שקדים"), null);
  assert.equal(idOf("חלב סויה"), null);
  assert.equal(idOf("חלב קוקוס"), null);
  assert.equal(idOf("חלב 2%"), null); // a different milk: no guess
  assert.equal(idOf("שוקו"), "milk-choc");
  assert.equal(idOf("חלב שוקו"), "milk-choc");
  assert.equal(idOf("קוטג"), "cottage5");
  assert.equal(idOf("הקוטג'"), "cottage5"); // Hebrew prefix letter
  assert.equal(idOf("קוטג 3%"), "cottage3");
  assert.equal(idOf("ביצים"), "eggs12");
  assert.equal(idOf("ביצים 18"), "eggs18");
  assert.equal(idOf("ביצים 30"), null);
  assert.equal(idOf("סוכר"), "sugar");
  assert.equal(idOf("סוכר חום"), "sugar-brown");
  assert.equal(idOf("אבקת סוכר"), null);
  assert.equal(idOf("קולה זירו"), "cola-zero15");
  assert.equal(idOf("קולה זירו 500"), "cola-zero500");
  assert.equal(idOf("תה ירוק"), null);
  assert.equal(idOf("תה"), "tea");
  assert.equal(idOf("גבינה צהובה מגורדת"), "yellow-grated");
  assert.equal(idOf("גבינה צהובה"), "yellow-sliced");
  assert.equal(idOf("עגבניות"), null); // produce is not in the price data
  assert.equal(idOf(""), null);
});

test("prices.json is well formed and every price is a positive number", () => {
  assert.match(data.asOf, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(data.chains.length >= 2);
  const ids = new Set(data.chains.map((c) => c.id));
  assert.ok(real.length >= 80);
  for (const p of real) {
    const entries = Object.entries(p.prices);
    assert.ok(entries.length >= 2, `${p.id} priced at >= 2 chains`);
    for (const [chain, price] of entries) {
      assert.ok(ids.has(chain), `${p.id}: unknown chain ${chain}`);
      assert.ok(typeof price === "number" && price > 0);
    }
  }
  assert.equal(new Set(real.map((p) => p.id)).size, real.length, "unique product ids");
});

test("receiptStats averages per store and ignores junk", () => {
  const s = receiptStats([
    { storeId: "rami", total: 400, items: 20, t: 1 },
    { storeId: "rami", total: 500, items: 25, t: 3 },
    { storeId: "rami", total: 450, t: 2 }, // no item count: counts toward the total average only
    { storeId: "shufersal", total: 600, items: 20, t: 1 },
    { storeId: "shufersal", total: -5, items: 3, t: 2 },
    { storeId: "", total: 100 },
    null,
  ]);
  assert.deepEqual(s.rami, { n: 3, avgTotal: 450, avgPerItem: 20, last: 500 });
  assert.deepEqual(s.shufersal, { n: 1, avgTotal: 600, avgPerItem: 30, last: 600 });
  assert.deepEqual(receiptStats([]), {});
  assert.deepEqual(receiptStats(undefined), {});
});

test("every chain in prices.json has a public-files entry in the store directory", async () => {
  const { STORES, storeById } = await import("../public/stores.js");
  for (const c of data.chains) {
    const s = storeById(c.id);
    assert.ok(s, `${c.id} is in stores.js`);
    assert.equal(s.hasData, true);
    assert.equal(s.priceFiles, "public");
  }
  assert.equal(new Set(STORES.map((s) => s.id)).size, STORES.length, "unique store ids");
  assert.ok(STORES.every((s) => s.sources.length >= 1 && s.researchNote && s.traits));
});

test("priceKey keeps numbers apart, so milk 1% and milk 3% never share a price", () => {
  assert.notEqual(priceKey("חלב 1%"), priceKey("חלב 3%"));
  assert.equal(priceKey("  חלב   3% "), priceKey("חלב 3%"));
  const r = compareStores({
    items: [{ name: "חלב 3%" }, { name: "חלב 1%" }],
    products: [],
    userPrices: { [priceKey("חלב 3%")]: { a: 7, b: 8 } },
    chains: [{ id: "a", name: "A" }, { id: "b", name: "B" }],
  });
  assert.equal(r.comparableCount, 1);
  assert.deepEqual(r.unpriced, ["חלב 1%"]);
});
