// Pure helpers for "which cart am I in": ids, short invite codes, the list of carts a device knows.
// No DOM, no storage, no Firestore, so it is unit-tested. cart-boot.js and ui-carts.js do the I/O.

export const ID_RE = /^[a-f0-9]{32}$/;

// 32 symbols, 5 bits each, without the look-alikes 0 O 1 I. Eight of them is 40 bits: far too many to guess,
// and short enough to read out over the phone.
export const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const CODE_LEN = 8;
export const INVITE_DAYS = 7;
export const DEFAULT_CART_NAME = "העגלה המשפחתית";
export const MAX_CARTS = 12;
export const NAME_MAX = 30;

export function newCartId(rand = crypto) {
  return Array.from(rand.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
}

// `& 31` on a random byte is unbiased because the alphabet has exactly 32 symbols.
export function newCode(rand = crypto) {
  return Array.from(rand.getRandomValues(new Uint8Array(CODE_LEN)), (b) => CODE_ALPHABET[b & 31]).join("");
}

// Whatever a person typed or pasted ("kfrt 4829", "KFRT-4829 ") -> the canonical code, or "" if it can't be one.
export function normalizeCode(text) {
  const c = String(text ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return c.length === CODE_LEN && [...c].every((ch) => CODE_ALPHABET.includes(ch)) ? c : "";
}

export const formatCode = (code) => `${code.slice(0, 4)}-${code.slice(4)}`;

export const joinUrl = (base, code) => `${base}#join=${code}`;

// The URL hash tells us what to open: a cart ("#<32 hex>"), an invite ("#join=<code>") or nothing we know.
export function parseHash(hash) {
  const h = String(hash || "").replace(/^#/, "");
  if (ID_RE.test(h)) return { cart: h };
  const m = /^join=(.*)$/.exec(h);
  if (m) return { join: normalizeCode(decodeURIComponent(m[1])) || "bad" };
  return {};
}

export const inviteExpiry = (now = Date.now()) => now + INVITE_DAYS * 86400000;

// ---- The device's list of carts: [{ id, name, used }] ----

const cleanName = (n) => String(n ?? "").replace(/\s+/g, " ").trim().slice(0, NAME_MAX);

// Reads the stored JSON defensively: anything malformed is dropped, never thrown.
export function parseCarts(json) {
  let raw;
  try { raw = JSON.parse(json || "[]"); } catch { return []; }
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const c of raw) {
    if (!c || !ID_RE.test(c.id) || seen.has(c.id)) continue;
    seen.add(c.id);
    out.push({ id: c.id, name: cleanName(c.name) || DEFAULT_CART_NAME, used: Number(c.used) || 0 });
  }
  return sortCarts(out).slice(0, MAX_CARTS);
}

export const sortCarts = (list) => [...list].sort((a, b) => b.used - a.used);

// Name for a cart nobody has named yet: the first one keeps the app's old title, later ones are numbered.
export function defaultName(list) {
  if (!list.length) return DEFAULT_CART_NAME;
  let n = list.length + 1;
  while (list.some((c) => c.name === `עגלה ${n}`)) n++;
  return `עגלה ${n}`;
}

// Marks `id` as the one in use now. A known cart keeps its name unless a better one is given
// (an invite carries the name its owner chose). An unknown cart is added.
export function useCart(list, id, name, now = Date.now()) {
  const nm = cleanName(name);
  const found = list.find((c) => c.id === id);
  const next = found
    ? list.map((c) => (c.id === id ? { ...c, used: now, name: nm || c.name } : c))
    : [...list, { id, name: nm || defaultName(list), used: now }];
  return sortCarts(next).slice(0, MAX_CARTS);
}

export function renameCart(list, id, name) {
  const nm = cleanName(name);
  return nm ? list.map((c) => (c.id === id ? { ...c, name: nm } : c)) : list;
}

export const removeCart = (list, id) => list.filter((c) => c.id !== id);
