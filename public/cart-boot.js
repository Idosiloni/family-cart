// Decides which cart this page opens, and talks to Firestore about invite codes.
// Pure rules live in carts.js; this file is the part that touches localStorage, the URL and the database.
import { DEMO, db, doc, getDoc, setDoc } from "./db.js";
import {
  ID_RE, parseHash, parseCarts, useCart, newCartId, newCode, normalizeCode, inviteExpiry, DEFAULT_CART_NAME,
} from "./carts.js";

const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

export const loadCarts = () => (DEMO ? [] : parseCarts(ls.get("carts")));
export const saveCarts = (list) => { if (!DEMO) ls.set("carts", JSON.stringify(list)); };

const timeout = (p, ms) => Promise.race([
  p,
  new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error("timeout"), { code: "timeout" })), ms)),
]);

// "offline" = we couldn't ask; "gone" = the database answered that there is no valid invite (never made, expired, or wrong).
const failure = (e) => Object.assign(new Error(e.code), { kind: e.code === "permission-denied" || e.code === "not-found" ? "gone" : "offline" });

// code (any spelling) -> { id, name }
export async function resolveInvite(text) {
  const code = normalizeCode(text);
  if (!code) throw Object.assign(new Error("bad code"), { kind: "gone" });
  let snap;
  try { snap = await timeout(getDoc(doc(db, "invites", code)), 8000); } catch (e) { throw failure(e); }
  const d = snap.exists() ? snap.data() : null;
  if (!d || !ID_RE.test(d.cartId) || !(d.exp > Date.now())) throw Object.assign(new Error("gone"), { kind: "gone" });
  return { id: d.cartId, name: typeof d.name === "string" ? d.name : "" };
}

// A code for this cart. One is kept per device for a week, so opening the invite sheet twice doesn't mint two.
// Throws if the database can't be reached or refuses (the caller then falls back to the permanent link).
export async function createInvite(cartId, name) {
  const key = "invite:" + cartId;
  try {
    const c = JSON.parse(ls.get(key) || "null");
    if (c && normalizeCode(c.code) && c.exp - Date.now() > 86400000) return c;
  } catch {}
  let last;
  for (let i = 0; i < 5; i++) {
    const code = newCode();
    const exp = inviteExpiry();
    try {
      // Rules allow create only, so an already-used code is refused (permission-denied) and we draw another.
      await timeout(setDoc(doc(db, "invites", code), { cartId, name: name || DEFAULT_CART_NAME, exp }), 8000);
      const made = { code, exp };
      ls.set(key, JSON.stringify(made));
      return made;
    } catch (e) {
      last = e;
      if (e.code !== "permission-denied") break;
    }
  }
  throw last;
}

// Run once, before anything is read or written. Returns the cart to open and a message for the person, if any.
export async function startCart() {
  if (DEMO) return { id: "demo", list: [], notice: null };
  const route = parseHash(location.hash);
  const saved = ls.get("cartId");
  const lastCart = ID_RE.test(saved || "") ? saved : null;
  let list = loadCarts();
  let id = null, name = "", notice = null;

  if (route.cart) {
    id = route.cart;
  } else if (route.join) {
    try {
      ({ id, name } = await resolveInvite(route.join));
      notice = { joined: true };
    } catch (e) {
      notice = { error: e.kind === "offline" ? "אין חיבור כרגע, לא הצלחתי לבדוק את הקוד. נסו שוב." : "הקוד לא תקין או שפג תוקפו. בקשו קוד חדש." };
    }
  }
  if (!id) id = lastCart || list[0]?.id || newCartId();

  // Per-cart trip history used to be one global key; hand it to the cart this device was using.
  const legacy = ls.get("trips");
  if (legacy != null) {
    const owner = lastCart || id;
    if (ls.get("trips:" + owner) == null) ls.set("trips:" + owner, legacy);
    ls.del("trips");
  }

  list = useCart(list, id, name);
  saveCarts(list);
  ls.set("cartId", id);
  history.replaceState(null, "", location.pathname + location.search + "#" + id);
  return { id, list, notice, name: list.find((c) => c.id === id)?.name || "" };
}
