// Price matching and store comparison. Pure functions (no DOM, no Firebase), unit-tested in Node.
//
// Data shapes
//   products   prices.json "products": [{ id, name, size, aliases, not?, nums?, barcode, prices: { chainId: price } }]
//   userPrices { [priceKey(itemName)]: { [chainId]: unitPrice } }  family-entered shelf prices, they win over products
//   chains     [{ id, name }]  the stores being compared (may include stores that only have user prices)
//   items      [{ name, qty? }]
import { learnKey } from "./categories.js";

export { learnKey };

// Key for family-typed prices. Stricter than learnKey on purpose: learnKey drops numbers and %, which would make
// "חלב 1%" and "חלב 3%" share one price. This one only trims, lower-cases and collapses spaces.
export const priceKey = (name) => String(name ?? "").trim().toLowerCase().replace(/\s+/g, " ").slice(0, 60);

const round2 = (n) => Math.round(n * 100) / 100;
const validPrice = (v) => typeof v === "number" && Number.isFinite(v) && v > 0;

// ---------- matching ----------
// Tokens keep digits and a trailing % ("3%" and "1%" are different milks). A dot between digits stays ("1.5").
const TOKEN = /[\p{L}\p{N}'"׳״]+(?:\.\p{N}+)?%?/gu;
const tokenize = (s) => (String(s).toLowerCase().match(TOKEN) || []).map((t) => t.replace(/["'׳״]/g, ""));

// One-letter Hebrew prefix (ה ו ב ל מ כ ש): "הקוטג" -> "קוטג". Both forms count.
const PREFIX = "הוובלמכש";
const variants = (t) => (t.length >= 4 && PREFIX.includes(t[0]) ? [t, t.slice(1)] : [t]);

// Words that turn a typed item into a different product, whatever the product ("חלב שקדים" is not milk).
const NOT_ANY = new Set(["שקדים", "סויה", "שיבולת", "קוקוס", "שוקו", "שוקולד", "עיזים", "עיזי", "וניל", "אבקת", "מרוכז", "לקטוז", "נטול", "טבעוני", "טבעונית"]);
const isNumeric = (t) => /^\d/.test(t);

const compiled = new WeakMap();
function compile(product) {
  let c = compiled.get(product);
  if (!c) {
    c = {
      aliases: (product.aliases || []).map(tokenize).filter((a) => a.length),
      not: new Set((product.not || []).flatMap((w) => tokenize(w).flatMap(variants))),
      nums: new Set((product.nums || []).flatMap(tokenize)),
    };
    compiled.set(product, c);
  }
  return c;
}

// Returns how well `product` fits the tokens (the matched alias length), or 0 for no match.
function score(tokens, vtokens, product) {
  const { aliases, not, nums } = compile(product);
  let best = 0;
  for (const alias of aliases) {
    for (let i = 0; i + alias.length <= tokens.length; i++) {
      if (!alias.every((a, k) => vtokens[i + k].includes(a))) continue;
      const leftover = [...tokens.keys()].filter((j) => j < i || j >= i + alias.length);
      let ok = true;
      for (const j of leftover) {
        const t = tokens[j];
        // A leftover number must be one this product allows; a leftover word must not change the product.
        const bad = isNumeric(t) ? !nums.has(t) : vtokens[j].some((v) => not.has(v) || NOT_ANY.has(v));
        if (bad) { ok = false; break; }
      }
      if (ok) best = Math.max(best, alias.length);
    }
  }
  return best;
}

// The product a typed item most likely is, or null. Conservative on purpose: no match beats a wrong one.
export function matchProduct(name, products) {
  const tokens = tokenize(name);
  if (!tokens.length) return null;
  const vtokens = tokens.map(variants);
  let best = null, bestScore = 0, tie = false;
  for (const p of products || []) {
    const s = score(tokens, vtokens, p);
    if (!s) continue;
    if (s > bestScore) { best = p; bestScore = s; tie = false; }
    else if (s === bestScore) tie = true;
  }
  return tie ? null : best; // two products fit equally well: do not guess
}

// ---------- prices ----------
// Unit price of an item at a chain: what the family typed wins, then the file price.
function unitPrice(userEntry, product, chainId) {
  const u = userEntry?.[chainId];
  if (validPrice(u)) return u;
  const f = product?.prices?.[chainId];
  return validPrice(f) ? f : null;
}

const qtyOf = (item) => (Number.isInteger(item.qty) && item.qty > 0 ? item.qty : 1);

// Compare chains on the items priced at EVERY chain in `chains` (the intersection), so a chain that
// lacks a price for something can never look cheapest. Everything else is reported, not guessed.
export function compareStores({ items, products, userPrices = {}, chains }) {
  const ids = chains.map((c) => c.id);
  const comparable = [], partial = [], unpriced = [];
  const covered = Object.fromEntries(ids.map((id) => [id, 0]));

  for (const item of items) {
    const product = matchProduct(item.name, products);
    const user = userPrices[priceKey(item.name)];
    const prices = {};
    for (const id of ids) {
      const p = unitPrice(user, product, id);
      if (p != null) { prices[id] = p; covered[id]++; }
    }
    const n = Object.keys(prices).length;
    const row = { name: item.name, qty: qtyOf(item), prices, product: product ? { id: product.id, name: product.name, size: product.size } : null };
    if (n === ids.length && n > 0) comparable.push(row);
    else if (n > 0) partial.push(row);
    else unpriced.push(item.name);
  }

  const rows = chains.map((c) => ({
    chainId: c.id,
    name: c.name,
    total: round2(comparable.reduce((sum, r) => sum + r.prices[c.id] * r.qty, 0)),
    pricedCount: covered[c.id],
  }));

  let cheapestId = null;
  if (comparable.length && rows.length > 1) {
    cheapestId = rows.reduce((a, b) => (b.total < a.total ? b : a)).chainId;
  }
  const totals = rows.map((r) => r.total);
  return {
    rows,
    comparableCount: comparable.length,
    comparable,
    unpriced,
    partial: partial.map((r) => r.name),
    partialItems: partial,
    cheapestId,
    spread: rows.length > 1 && comparable.length ? round2(Math.max(...totals) - Math.min(...totals)) : 0,
  };
}

// One chain's estimate for the whole list: only what it has a price for, plus what is missing.
export function estimateTotal({ items, products, userPrices = {}, chainId }) {
  let total = 0, pricedCount = 0;
  const missing = [];
  for (const item of items) {
    const p = unitPrice(userPrices[priceKey(item.name)], matchProduct(item.name, products), chainId);
    if (p == null) missing.push(item.name);
    else { total += p * qtyOf(item); pricedCount++; }
  }
  return { total: round2(total), pricedCount, missing };
}

// ---------- receipts (what the family actually paid) ----------
// receipts: [{ storeId, total, items?, t }] -> { [storeId]: { n, avgTotal, avgPerItem, last } }
export function receiptStats(receipts) {
  const by = {};
  for (const r of receipts || []) {
    if (!r || !r.storeId || !validPrice(r.total)) continue;
    const s = (by[r.storeId] ||= { n: 0, sum: 0, itemSum: 0, itemTotal: 0, last: null, lastT: -Infinity });
    s.n++;
    s.sum += r.total;
    if (Number.isInteger(r.items) && r.items > 0) { s.itemSum += r.total; s.itemTotal += r.items; }
    if ((r.t ?? 0) >= s.lastT) { s.lastT = r.t ?? 0; s.last = r.total; }
  }
  return Object.fromEntries(Object.entries(by).map(([id, s]) => [id, {
    n: s.n,
    avgTotal: round2(s.sum / s.n),
    avgPerItem: s.itemTotal ? round2(s.itemSum / s.itemTotal) : null,
    last: s.last,
  }]));
}
