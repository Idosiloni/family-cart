import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { matchProduct, compareStores, estimateTotal, receiptStats, priceKey } from "../public/pricing.js";
import { pickPrices } from "../scripts/build-prices.mjs";
import { PRODUCTS as REFERENCE } from "../scripts/reference-products.mjs";

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
  assert.equal(idOf("חלב שקדים"), "almond-milk"); // it has a product of its own now; it must never resolve to ordinary milk
  assert.notEqual(idOf("חלב שקדים"), "milk3");
  assert.equal(idOf("חלב סויה"), "soy-milk");
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
  // fresh produce (priced per kg)
  assert.equal(idOf("עגבניות"), "tomato");
  assert.equal(idOf("עגבניות שרי"), "cherry-tomato");
  assert.equal(idOf("מלפפונים"), "cucumber");
  assert.equal(idOf("בצלים"), "onion");
  assert.equal(idOf("בצל אדום"), "red-onion");
  assert.equal(idOf("קישוא"), "zucchini");
  assert.equal(idOf("תפוחי אדמה"), "potato");
  assert.equal(idOf("תפוח אדמה"), "potato");
  assert.equal(idOf("תפוחים"), "apple");
  assert.equal(idOf("אפרסמון"), "persimmon");
  assert.equal(idOf("קישוא 3"), "zucchini");
  assert.equal(idOf("פירות"), null);
  assert.equal(idOf("פירות שנראים טוב"), null);
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

test("every chain in prices.json has a data entry in the store directory (public files, or a manually downloaded file)", async () => {
  const { STORES, storeById } = await import("../public/stores.js");
  for (const c of data.chains) {
    const s = storeById(c.id);
    assert.ok(s, `${c.id} is in stores.js`);
    assert.equal(s.hasData, true);
    assert.ok(["public", "manual"].includes(s.priceFiles), `${c.id} priceFiles`);
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

// ---------- equiv: per-chain equivalent barcodes (scripts/build-prices.mjs) ----------
const chainItems = (id, entries) => ({ id, items: new Map(Object.entries(entries).map(([code, price]) => [code, { price, weighted: false }])) });

test("pickPrices: the barcode priced at the most chains wins, and every chain that has it is priced from it", () => {
  const loaded = [chainItems("a", { m: 10, s: 9 }), chainItems("b", { m: 11, s: 9.5 }), chainItems("c", { s: 8 })];
  const r = pickPrices({ codes: ["m", "s"] }, loaded);
  assert.equal(r.code, "s");
  assert.deepEqual(r.prices, { a: 9, b: 9.5, c: 8 });
  assert.deepEqual(r.equivUsed, []);
});

test("pickPrices: a chain without the winning barcode falls back to its own equiv barcode, and says so", () => {
  const loaded = [chainItems("a", { m: 10 }), chainItems("b", { m: 11 }), chainItems("o", { alt: 9.9, other: 1 })];
  const r = pickPrices({ codes: ["m"], equiv: { o: ["missing", "alt"] } }, loaded);
  assert.deepEqual(r.prices, { a: 10, b: 11, o: 9.9 });
  assert.deepEqual(r.equivUsed, [{ chain: "o", code: "alt", price: 9.9 }]);
  assert.equal(r.n, 3);
});

test("pickPrices: equiv never overrides a chain that carries the main barcode, and never rescues a product nobody else prices", () => {
  const loaded = [chainItems("a", { m: 10, alt: 1 }), chainItems("b", { m: 11 })];
  assert.deepEqual(pickPrices({ codes: ["m"], equiv: { a: ["alt"] } }, loaded).prices, { a: 10, b: 11 });
  assert.equal(pickPrices({ codes: ["m"], equiv: { b: ["alt"] } }, [chainItems("a", { m: 10 }), chainItems("b", { alt: 5 })]), null);
});

test("pickPrices: weighted items are skipped", () => {
  const w = (id, price) => ({ id, items: new Map([["m", { price, weighted: true }]]) });
  assert.equal(pickPrices({ codes: ["m"] }, [w("a", 5), w("b", 6)]), null);
});

test("the reference list: every equiv is for a chain that exists, and names a barcode that is not already a main code", () => {
  const chainIds = new Set(data.chains.map((c) => c.id));
  const codes = new Set(REFERENCE.flatMap((p) => p.codes));
  let used = 0;
  for (const p of REFERENCE) {
    for (const [chain, list] of Object.entries(p.equiv || {})) {
      used++;
      assert.ok(chainIds.has(chain), `${p.id}: unknown chain ${chain}`);
      for (const code of list) assert.ok(!codes.has(code), `${p.id}: equiv ${code} is also a main code (a sibling pack belongs in codes)`);
    }
  }
  assert.ok(used >= 2);
});

// ---------- the widened list ----------
test("matching on the widened list: new products are found by what a family types, ambiguous or lookalike names find none", () => {
  const cases = {
    "חלב שקדים": "almond-milk", "משקה סויה": "soy-milk", "פילדלפיה": "philadelphia", "קוטג 9%": "cottage9",
    "גבינה בולגרית": "bulgarian", "חלומי": "halloumi", "ביצי חופש": "eggs-free", "פסטה פנה": "penne", "פוזילי": "fusilli",
    "אורז יסמין": "rice-jasmine", "רוטב סויה": "soy-sauce", "חומץ": "vinegar", "אבקת אפייה": "baking-powder", "שמרים": "yeast",
    "דוריטוס": "doritos", "תפוצ'יפס": "tapuchips", "פסק זמן": "pesek-zman", "שוקולד מריר": "choc-dark", "מגנום": "magnum",
    "נאגטס": "nuggets", "בורקס גבינה": "burekas-cheese", "פריגת": "prigat", "נביעות": "neviot", "שוופס": "schweppes",
    "אקונומיקה": "bleach", "נוזל רצפה": "floor-cleaner", "ניקוי חלונות": "window-cleaner", "חיתולים מידה 5": "diapers5",
    "מטרנה שלב 2": "formula2", "פיתות כוסמין": "spelt-pita", "לחם אנגל": "angel-bread",
  };
  for (const [typed, id] of Object.entries(cases)) assert.equal(idOf(typed), id, typed);
  // the everyday generic names still mean the same product as before
  assert.equal(idOf("חלב"), "milk3");
  assert.equal(idOf("אורז"), "rice-persian");
  assert.equal(idOf("קוטג'"), "cottage5");
  assert.equal(idOf("בורקס"), "burekas");
  assert.equal(idOf("פסטה"), "pasta");
  assert.equal(idOf("חמאה"), "butter");
  // lookalikes and variants with no product of their own match nothing
  for (const typed of ["חלב שקדים וניל", "גלידה", "גלידה וניל", "קולה 1.5", "פנה מלא", "חיתולים מידה 7", "מטרנה שלב 4"]) {
    assert.equal(idOf(typed), null, typed);
  }
});

test("every alias of every product finds its own product, so nothing on the list is unreachable or ambiguous", () => {
  for (const p of real) for (const a of p.aliases) assert.equal(matchProduct(a, real)?.id ?? null, p.id, `${p.id} alias "${a}"`);
});

test("prices.json: every product has a barcode, at least two chain prices, a sane spread, and ids are unique", () => {
  const ids = new Set();
  for (const p of real) {
    assert.ok(!ids.has(p.id), `duplicate id ${p.id}`);
    ids.add(p.id);
    if (p.kg) {
      assert.ok(p.unitKg > 0 && p.unitKg <= 3, `${p.id} unitKg`);
      assert.ok(Object.values(p.prices).every((x) => x >= 1 && x <= 100), `${p.id} per-kg price range`);
    } else assert.ok(/^\d{6,14}$/.test(p.barcode), `${p.id} barcode`);
    const v = Object.values(p.prices);
    assert.ok(v.length >= 2, `${p.id} is priced at ${v.length} chain(s)`);
    assert.ok(Math.max(...v) / Math.min(...v) <= 2.2, `${p.id} prices differ too much`);
  }
  assert.ok(real.length >= 150, `only ${real.length} products`);
  const atOsher = real.filter((p) => p.prices["osher-ad"]).length;
  assert.ok(atOsher >= 100, `only ${atOsher} products priced at Osher Ad`);
});

test("produce is priced per kilo with an assumed weight, and the total is labelled an estimate", () => {
  const products = [
    { id: "persimmon", name: "אפרסמון", aliases: ["אפרסמון"], kg: true, unitKg: 0.2, prices: { a: 10, b: 20 } },
    { id: "milk", name: "חלב", aliases: ["חלב"], prices: { a: 7, b: 8 } },
  ];
  const chains = [{ id: "a", name: "A" }, { id: "b", name: "B" }];
  const r = compareStores({ items: [{ name: "אפרסמון", qty: 3 }, { name: "חלב", qty: 2 }], products, chains });
  assert.equal(r.rows.find((x) => x.chainId === "a").total, 3 * 0.2 * 10 + 2 * 7); // 6 + 14
  assert.equal(r.rows.find((x) => x.chainId === "b").total, 3 * 0.2 * 20 + 2 * 8); // 12 + 16
  assert.equal(r.estimatedCount, 1);
  assert.equal(r.comparable.find((x) => x.name === "אפרסמון").est, true);
  assert.equal(r.comparable.find((x) => x.name === "חלב").est, false);
  assert.equal(estimateTotal({ items: [{ name: "אפרסמון", qty: 3 }], products, chainId: "a" }).total, 6);
});

test("a family-typed price for a produce item is per kilo, like the file prices", () => {
  const products = [{ id: "t", name: "עגבניה", aliases: ["עגבניות"], kg: true, unitKg: 1, prices: { a: 8, b: 9 } }];
  const r = compareStores({
    items: [{ name: "עגבניות", qty: 2 }], products, chains: [{ id: "a", name: "A" }, { id: "b", name: "B" }],
    userPrices: { [priceKey("עגבניות")]: { a: 5 } },
  });
  assert.equal(r.rows.find((x) => x.chainId === "a").total, 10);
  assert.equal(r.rows.find((x) => x.chainId === "b").total, 18);
});

test("a small number typed in a produce name is its count, never for packaged products", () => {
  const products = [
    { id: "z", name: "קישוא", aliases: ["קישוא"], kg: true, unitKg: 0.2, prices: { a: 10, b: 10 } },
    { id: "m", name: "חלב", aliases: ["חלב"], nums: ["3%"], prices: { a: 7, b: 7 } },
  ];
  const chains = [{ id: "a", name: "A" }, { id: "b", name: "B" }];
  const r = compareStores({ items: [{ name: "קישוא 3" }], products, chains });
  assert.equal(r.rows[0].total, 6); // 3 x 0.2 kg x 10
  assert.equal(compareStores({ items: [{ name: "חלב 5" }], products, chains }).comparableCount, 0); // 5 is not an allowed number for milk
});
