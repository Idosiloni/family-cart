#!/usr/bin/env node
// Builds public/prices.json: real shelf prices for a curated list of everyday products at several
// Israeli chains. The numbers come from the price files the chains must publish under Israel's
// Price Transparency Law (public, no login). Credentialed portals (publishedprices.co.il:
// Rami Levy, Osher Ad, Yochananof, ...) are deliberately NOT used.
//
//   node scripts/build-prices.mjs --fetch                 scrape today's files and rebuild
//   node scripts/build-prices.mjs --fetch --cache dir     ...and keep the unzipped XML in dir
//   node scripts/build-prices.mjs --shufersal a.gz --carrefour b.xml --hazi c.gz   offline
//   node scripts/build-prices.mjs --fetch --osherad PriceFull7290103152017-001-031-....xml   add Osher Ad (Kfar Saba)
//   node scripts/build-prices.mjs --cache dir --explore "חלב.*3%"   find barcodes (needs files)
//
// Zero dependencies, Node >= 22. Shufersal's download links are signed and expire, so the listing
// page is scraped again on every run; nothing is cached between runs except what --cache writes.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PRODUCTS } from "./reference-products.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UA = { "user-agent": "Mozilla/5.0 (family-cart price builder; personal use)" };

// Branches are picked on purpose: big-format stores in the same part of the country (Sharon),
// so the comparison is between like and like. Shufersal Deal (the discount format) rather than
// Sheli/Express; the physical Hazi Hinam branch rather than its delivery pseudo-store (103).
const CHAINS = [
  {
    id: "shufersal", name: "שופרסל דיל", format: "דיל (פורמט הדיסקאונט של שופרסל)",
    chainId: "7290027600007", subChain: "002", storeId: "151", branch: "דיל רעננה, קניון רננים",
    source: "https://prices.shufersal.co.il/",
  },
  {
    id: "carrefour", name: "קרפור", format: "היפר",
    chainId: "7290055700007", subChain: "001", storeId: "009", branch: "קרפור היפר רעננה",
    source: "https://prices.carrefour.co.il/",
  },
  {
    id: "hazihinam", name: "חצי חינם", format: "סניף פיזי",
    chainId: "7290700100008", subChain: "000", storeId: "206", branch: "חצי חינם הוד השרון",
    source: "https://shop.hazi-hinam.co.il/Prices",
  },
  // No fetcher on purpose: the files are behind a login, so this chain only loads from --osherad <file>.
  {
    id: "osher-ad", name: "אושר עד", format: "סניף פיזי",
    chainId: "7290103152017", subChain: "001", storeId: "031", branch: "אושר עד כפר סבא",
    source: "https://url.publishedprices.co.il/", manual: true,
  },
];

// ---------- args ----------
const argv = process.argv.slice(2);
const flag = (n) => argv.includes("--" + n);
const opt = (n) => { const i = argv.indexOf("--" + n); return i >= 0 ? argv[i + 1] : undefined; };

// ---------- file reading ----------
// gzip by magic bytes (1f 8b); plain XML also accepted; UTF-8 BOM and UTF-16 handled.
export function decodeFile(buf) {
  let b = buf;
  let gzName = "";
  if (b[0] === 0x1f && b[1] === 0x8b) {
    gzName = gzipOriginalName(b);
    b = gunzipSync(b);
  } else if (b[0] === 0x50 && b[1] === 0x4b) {
    throw new Error("zip archives are not supported (unzip first)");
  }
  let text;
  if (b[0] === 0xff && b[1] === 0xfe) text = new TextDecoder("utf-16le").decode(b);
  else if (b[0] === 0xfe && b[1] === 0xff) text = new TextDecoder("utf-16be").decode(b);
  else text = new TextDecoder("utf-8").decode(b);
  return { text: text.replace(/^﻿/, ""), gzName };
}

// The gzip header may carry the original file name ("PriceFull...-20261104-...."), which dates the file.
function gzipOriginalName(b) {
  const flags = b[3];
  if (!(flags & 8)) return "";
  let p = 10;
  if (flags & 4) p += 2 + (b[p] | (b[p + 1] << 8));
  let e = p;
  while (e < b.length && b[e] !== 0) e++;
  return b.subarray(p, e).toString("latin1");
}

const unescapeXml = (s) =>
  s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, "&");
const tag = (s, t) => { const m = s.match(new RegExp(`<${t}\\s*>([\\s\\S]*?)</${t}\\s*>`)); return m ? unescapeXml(m[1].trim()) : ""; };

// code -> { name, price, weighted, qty, unit }
export function parseItems(xml) {
  const map = new Map();
  for (const m of xml.matchAll(/<Item>([\s\S]*?)<\/Item>/g)) {
    const b = m[1];
    const code = tag(b, "ItemCode");
    const price = parseFloat(tag(b, "ItemPrice"));
    if (!code || !(price > 0)) continue;
    map.set(code, {
      name: tag(b, "ItemName"), price, weighted: tag(b, "bIsWeighted") === "1",
      qty: tag(b, "Quantity"), unit: tag(b, "UnitQty"),
    });
  }
  return map;
}

// ---------- fetching ----------
async function get(url, binary = false) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return binary ? Buffer.from(await r.arrayBuffer()) : r.text();
}
const lastBy = (arr, key) => arr.slice().sort((a, b) => (key(a) < key(b) ? -1 : 1)).pop();

async function fetchShufersal(c) {
  const base = "https://prices.shufersal.co.il/FileObject/UpdateCategory";
  const list = await get(`${base}?catID=2&storeId=${+c.storeId}&sort=Time&order=Desc&page=1`);
  const re = new RegExp(`href="([^"]*PriceFull${c.chainId}-\\d{3}-0*${+c.storeId}-(\\d{8})-[^"]*)"`, "g");
  const links = [...list.matchAll(re)].map((m) => ({ url: m[1].replace(/&amp;/g, "&"), key: m[0] }));
  if (!links.length) throw new Error(`Shufersal: no PriceFull file listed for store ${c.storeId}`);
  const file = await get(links[0].url, true);
  let branch;
  try { // confirm the branch name from the chain's own Stores file
    const sl = await get(`${base}?catID=5&storeId=0&sort=Time&order=Desc&page=1`);
    const su = sl.match(/href="([^"]*Stores[^"]*)"/)?.[1].replace(/&amp;/g, "&");
    if (su) {
      const { text } = decodeFile(await get(su, true));
      for (const sc of text.matchAll(/<SubChain>([\s\S]*?)<\/SubChain>/g)) {
        for (const st of sc[1].matchAll(/<Store>([\s\S]*?)<\/Store>/g)) {
          if (+tag(st[1], "StoreID") === +c.storeId) branch = `${tag(sc[1], "SubChainName")}: ${tag(st[1], "StoreName")}`;
        }
      }
    }
  } catch {}
  return { file, branch };
}

async function fetchCarrefour(c) {
  const html = await get("https://prices.carrefour.co.il/");
  const path = html.match(/const path = '(\d+)'/)?.[1];
  const files = JSON.parse(html.match(/const files = (\[[\s\S]*?\]);/)?.[1] || "[]");
  const branches = JSON.parse(html.match(/const branches = (\{[\s\S]*?\});/)?.[1] || "{}");
  const mine = files.filter((f) => f.name.startsWith(`PriceFull${c.chainId}-${c.subChain}-${c.storeId}-`));
  if (!path || !mine.length) throw new Error(`Carrefour: no PriceFull file for store ${c.storeId}`);
  const f = lastBy(mine, (x) => x.name);
  const file = await get(`https://prices.carrefour.co.il/${path}/${f.name}`, true);
  return { file, branch: branches[c.storeId]?.replace(/\s+/g, " ").trim() };
}

async function fetchHazi(c) {
  const re = new RegExp(`https://hazihinamprod01\\.blob\\.core\\.windows\\.net/regulatories/PriceFull${c.chainId}-${c.subChain}-${c.storeId}-[0-9-]+\\.gz`, "g");
  let found = [];
  for (let p = 1; p <= 8 && !found.length; p++) {
    const html = await get(`https://shop.hazi-hinam.co.il/Prices?p=${p}&s=&f=PriceFull&t=1&d=`);
    found = [...new Set(html.match(re) || [])];
  }
  if (!found.length) throw new Error(`Hazi Hinam: no PriceFull file for store ${c.storeId}`);
  const file = await get(lastBy(found, (x) => x), true);
  let branch;
  try {
    const sp = await get("https://shop.hazi-hinam.co.il/Prices?p=1&s=&f=&t=3&d=");
    const su = sp.match(/https:\/\/hazihinamprod01[^"]*Stores[^"]*\.gz/)?.[0];
    if (su) {
      const { text } = decodeFile(await get(su, true));
      for (const st of text.matchAll(/<Store>([\s\S]*?)<\/Store>/g)) {
        if (+tag(st[1], "StoreID") === +c.storeId) branch = "חצי חינם " + tag(st[1], "Address").replace(/^\d+\s*/, "").replace(/\s*,\s*ישראל$/, "");
      }
    }
  } catch {}
  return { file, branch };
}

const FETCHERS = { shufersal: fetchShufersal, carrefour: fetchCarrefour, hazihinam: fetchHazi };
const ARG_OF = { shufersal: "shufersal", carrefour: "carrefour", hazihinam: "hazi", "osher-ad": "osherad" };

// ---------- main ----------
async function loadChain(c, cacheDir) {
  const localPath = opt(ARG_OF[c.id]);
  let raw, branch;
  if (localPath) raw = readFileSync(localPath);
  else if (flag("fetch") && FETCHERS[c.id]) ({ file: raw, branch } = await FETCHERS[c.id](c));
  else if (cacheDir && existsSync(join(cacheDir, c.id + ".xml"))) raw = readFileSync(join(cacheDir, c.id + ".xml"));
  else return null;
  const { text, gzName } = decodeFile(raw);
  if (cacheDir && !localPath) { mkdirSync(cacheDir, { recursive: true }); writeFileSync(join(cacheDir, c.id + ".xml"), text); }
  const fileStore = text.match(/<StoreID>0*(\d+)<\/StoreID>/)?.[1];
  if (fileStore && +fileStore !== +c.storeId) console.warn(`! ${c.id}: file is for store ${fileStore}, expected ${c.storeId}`);
  const date = (gzName.match(/-(\d{8})-/) || localPath?.match(/-(20\d{6})-/) || [])[1];
  return {
    ...c, branch: branch || c.branch, items: parseItems(text),
    date: date ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}` : new Date().toISOString().slice(0, 10),
  };
}

// Prices for one reference product. The `codes` barcode priced at the most chains wins (first wins a tie), and
// every chain that carries it is priced from it. A chain that does NOT carry it may fall back to an `equiv`
// barcode, but only one that was checked by hand to be the same brand, variant and pack size (see
// reference-products.mjs). Weighted items are skipped, they have chain-internal codes.
// loaded: [{ id, items: Map(code -> { price, weighted }) }]  ->  { code, prices, n, equivUsed } | null
export function pickPrices(product, loaded) {
  let best = null;
  for (const code of product.codes) {
    const prices = {};
    let weighted = false;
    for (const l of loaded) {
      const it = l.items.get(code);
      if (!it) continue;
      if (it.weighted) weighted = true;
      prices[l.id] = Math.round(it.price * 100) / 100;
    }
    const n = Object.keys(prices).length;
    if (!weighted && n >= 2 && (!best || n > best.n)) best = { code, prices, n };
  }
  if (!best) return null;
  const equivUsed = [];
  for (const l of loaded) {
    if (best.prices[l.id] != null) continue;
    for (const code of product.equiv?.[l.id] || []) {
      const it = l.items.get(code);
      if (!it || it.weighted) continue;
      best.prices[l.id] = Math.round(it.price * 100) / 100;
      equivUsed.push({ chain: l.id, code, price: best.prices[l.id] });
      break;
    }
  }
  best.n = Object.keys(best.prices).length;
  return { ...best, equivUsed };
}

async function main() {
  const cacheDir = opt("cache");
  const loaded = [];
  for (const c of CHAINS) {
    try {
      const l = await loadChain(c, cacheDir);
      if (l) { loaded.push(l); console.log(`${c.id}: ${l.items.size} items, ${l.branch}, ${l.date}`); }
      else console.warn(`- ${c.id}: no input (use ${c.manual ? "" : "--fetch or "}--${ARG_OF[c.id]} <file>)`);
    } catch (e) { console.warn(`! ${c.id} failed: ${e.message}`); }
  }
  if (loaded.length < 2) throw new Error("need at least two chains to build prices.json");

  const ex = opt("explore");
  if (ex) return explore(loaded, new RegExp(ex));

  const products = [];
  for (const p of PRODUCTS) {
    const best = pickPrices(p, loaded);
    if (!best) { console.warn(`  skip ${p.id} (${p.name}): fewer than 2 chains priced it`); continue; }
    for (const e of best.equivUsed) console.log(`  equiv ${p.id}: ${e.chain} uses ${e.code} (main ${best.code}) -> ${e.price}`);
    const v = Object.values(best.prices);
    if (Math.max(...v) / Math.min(...v) > 2.2) console.warn(`  ? ${p.id} ${p.name}: prices differ a lot`, best.prices);
    products.push({ id: p.id, name: p.name, size: p.size, aliases: p.aliases, ...(p.not ? { not: p.not } : {}), ...(p.nums ? { nums: p.nums } : {}), barcode: best.code, prices: best.prices });
  }

  const out = {
    asOf: loaded.map((l) => l.date).sort()[0],
    note: "מחירי מדף מקבצי המחירים הציבוריים שהרשתות מפרסמות לפי חוק (סניף אחד לכל רשת). ללא הנחות מועדון ומבצעים.",
    chains: loaded.map((l) => ({ id: l.id, name: l.name, branch: l.branch, format: l.format, date: l.date, source: l.source })),
    products,
  };
  const body = JSON.stringify({ ...out, products: undefined }).slice(0, -1) + ',"products":[\n' +
    products.map((p) => JSON.stringify(p)).join(",\n") + "\n]}\n";
  const path = opt("out") || join(ROOT, "public", "prices.json");
  writeFileSync(path, body);
  const all = products.filter((p) => loaded.every((l) => p.prices[l.id] != null)).length;
  console.log(`wrote ${path}: ${products.length} products, ${all} priced at all ${loaded.length} chains, ${(body.length / 1024).toFixed(1)} KB`);
}

// Candidate barcodes whose name (in any chain) matches, best-covered first.
function explore(loaded, re) {
  const rows = new Map();
  for (const l of loaded) {
    for (const [code, it] of l.items) {
      if (!re.test(it.name)) continue;
      const r = rows.get(code) || { code, by: {} };
      r.by[l.id] = it;
      rows.set(code, r);
    }
  }
  const list = [...rows.values()].filter((r) => Object.keys(r.by).length >= 2)
    .sort((a, b) => Object.keys(b.by).length - Object.keys(a.by).length);
  for (const r of list.slice(0, 25)) {
    const first = Object.values(r.by)[0];
    const prices = loaded.map((l) => r.by[l.id]?.price ?? "-").join(" / ");
    console.log(`${r.code}  ${first.name}  [${first.qty}${first.unit}${first.weighted ? " W" : ""}]  ${prices}  (${Object.keys(r.by).length})`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
