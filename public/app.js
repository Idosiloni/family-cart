import {
  DEMO, db, collection, doc, addDoc, updateDoc, deleteDoc, setDoc,
  onSnapshot, query, orderBy, writeBatch, increment, deleteField,
} from "./db.js";
import { firebaseConfig } from "./firebase-config.js";
import { CATEGORIES, DEFAULT_ORDER, categoryById, classify, normalizeOrder, setLearned, rememberLocally, learnKey } from "./categories.js";
import { parseItems, splitQty, splitSpoken } from "./parse.js";
import { icon } from "./icons.js";
import { clock, shareText } from "./format.js";
import { toast, reducedMotion, leaveRow, burst, rollIn, EASE_OUT } from "./effects.js";
import { attachSwipe } from "./swipe.js";
import { suggestions } from "./regulars.js";
import { initRegulars } from "./ui-regulars.js";
import { initPrices } from "./ui-prices.js";
import { startCart } from "./cart-boot.js";
import { initCarts } from "./ui-carts.js";

const $ = (id) => document.getElementById(id);
const statusEl = $("status");

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("error", isError);
}

// ---- Setup check ----
if (!firebaseConfig.projectId) {
  setStatus("חסר חיבור ל-Firebase: מלא את firebase-config.js (ראה README).", true);
  throw new Error("firebase-config.js is not filled in");
}

// Which cart this page is (cart-boot.js): the link's hash, a join code, or the one used last. May ask the database
// to resolve a join code, so it is awaited before anything is read.
const boot = await startCart();
const cartId = boot.id;
if (!DEMO) addEventListener("hashchange", () => location.reload()); // a different cart link was opened in this window

// ---- Installable app: the manifest is built at runtime so the home-screen icon opens THIS cart ----
(function setupManifest() {
  const manifest = {
    name: "העגלה המשפחתית", short_name: "העגלה", lang: "he", dir: "rtl",
    id: "/", scope: location.origin + "/", start_url: location.origin + location.pathname + (DEMO ? "" : location.hash), // never bake "#demo" into an installed icon
    display: "standalone", background_color: "#F7F6F2", theme_color: "#F7F6F2",
    icons: [
      { src: location.origin + "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: location.origin + "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ],
  };
  const link = document.createElement("link");
  link.rel = "manifest";
  link.href = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" }));
  document.head.append(link);
  // A service worker (network-first, see sw.js) is what lets browsers offer a real install.
  if ("serviceWorker" in navigator && !DEMO && (location.protocol === "https:" || location.hostname === "localhost")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();

const itemsRef = collection(db, "carts", cartId, "items");
const prefsRef = doc(db, "carts", cartId, "settings", "prefs");
const learnedRef = doc(db, "carts", cartId, "settings", "learned");
const historyRef = doc(db, "carts", cartId, "settings", "history");
const pricesRef = doc(db, "carts", cartId, "settings", "prices");
const storesRef = doc(db, "carts", cartId, "settings", "stores");
const receiptsRef = collection(db, "carts", cartId, "receipts");

// ---- State ----
let items = [];
let loaded = false;   // the first snapshot of the list has arrived
let order = [...DEFAULT_ORDER];
let buyStats = {};     // learnKey -> { n: name, c: times added, t: last added, p?: pinned, x?: removed }
let userPrices = {};   // learnKey -> { [storeId]: unit price the family typed in }
let storeCfg = { sel: null, custom: [] }; // chains compared in the prices tab
let receipts = [];     // { id, storeId, total, items, t }
let me = "";
let collapsed = new Set();
try { collapsed = new Set(JSON.parse(localStorage.getItem("collapsed") || "[]")); } catch {}
try { me = localStorage.getItem("me") || ""; } catch {}

// A neutral tile carrying the section's line icon.
function tileEl(cat, size = 18) {
  const t = document.createElement("span");
  t.className = "tile";
  t.dataset.cat = cat.id; // the soft section colour comes from CSS
  t.append(icon(cat.icon, size));
  return t;
}
document.querySelectorAll("[data-icon]").forEach((el) => el.append(icon(el.dataset.icon, Number(el.dataset.size) || 22)));
document.querySelectorAll("[data-icon-label]").forEach((el) => el.prepend(icon(el.dataset.iconLabel, 18)));

const catOf = (item) => categoryById(item.category || classify(item.name));

// The header gets a faint shadow once the list scrolls under it.
addEventListener("scroll", () => document.querySelector(".bar").classList.toggle("scrolled", scrollY > 4), { passive: true });

// ---- Tabs ----
let view = "list";
let regulars, prices; // set up at the bottom, after everything they need exists
function setView(v) {
  const changed = v !== view;
  view = v;
  for (const id of ["list", "regulars", "prices"]) {
    $("view-" + id).hidden = id !== v;
    $("tab-" + id).setAttribute("aria-selected", String(id === v));
  }
  $("add-form").classList.toggle("hide", v !== "list");
  try { sessionStorage.setItem("view", v); } catch {}
  placeTabInd();
  if (changed && !reducedMotion()) $("view-" + v).animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 240, easing: EASE_OUT });
  if (v === "regulars") regulars.refresh();
  if (v === "prices") prices.refresh();
  scrollTo(0, 0);
}
document.querySelectorAll(".tabs [data-view]").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));

// One underline that slides to the selected tab, instead of each tab drawing its own.
const tabInd = document.createElement("span");
tabInd.className = "tab-ind";
tabInd.setAttribute("aria-hidden", "true");
document.querySelector(".tabs").append(tabInd);
function placeTabInd() {
  const b = $("tab-" + view);
  if (!b.offsetWidth) return;
  tabInd.style.width = b.offsetWidth * .56 + "px";
  tabInd.style.transform = `translateX(${b.offsetLeft + b.offsetWidth * .22}px)`;
}
placeTabInd();
requestAnimationFrame(() => tabInd.classList.add("ready")); // no slide on the first placement
addEventListener("resize", placeTabInd);
document.fonts?.ready.then(placeTabInd);

// ---- Render ----
const WHO_COLORS = ["#2F7D5B", "#3B7DC4", "#C77D2E", "#B5527A", "#7A5BC4", "#2E9AA8"];
const hashName = (n) => [...n].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

function renderItem(item) {
  const li = document.createElement("li");
  li.className = "row" + (item.checked ? " done" : "");
  li.dataset.id = item.id;

  const box = document.createElement("input");
  box.type = "checkbox";
  box.id = "c-" + item.id;
  box.checked = item.checked;
  box.setAttribute("aria-label", item.name);
  box.addEventListener("change", () => { li.classList.add("popping"); toggleItem(item, box.checked, li); });
  // New rows ease in (staggered on first load); one added by someone else also flashes briefly.
  // Other snapshots (settings, history) rebuild the list a moment later, so a row keeps its entrance going:
  // the negative delay resumes the animation where it was instead of restarting it.
  const e = enterAt.get(item.id);
  if (e && !item.checked) {
    const elapsed = performance.now() - e.t;
    if (elapsed > 1500) enterAt.delete(item.id);
    else {
      li.classList.add("enter");
      if (e.flash) li.classList.add("flash");
      li.style.animationDelay = `${e.i * 34 - elapsed}ms`;
    }
  }

  // Tapping the name opens the editor (quantity, note, price, delete); the circle or a swipe checks it off.
  const text = document.createElement("button");
  text.type = "button";
  text.className = "row-text";
  text.setAttribute("aria-label", "עריכת " + item.name);
  const name = document.createElement("span");
  name.className = "name";
  name.textContent = item.name; // textContent: never HTML
  if (item.qty > 1) {
    const q = document.createElement("span");
    q.className = "qty";
    q.textContent = "×" + item.qty;
    name.append(q);
  }
  text.append(name);
  if (item.note || item.addedBy) {
    const meta = document.createElement("span");
    meta.className = "meta";
    if (item.note) meta.append(item.note + (item.addedBy ? " · " : ""));
    if (item.addedBy) {
      // A small dot in the colour of whoever added it, the same colour every time for the same name.
      const dot = document.createElement("i");
      dot.className = "who";
      dot.style.setProperty("--who", WHO_COLORS[hashName(item.addedBy) % WHO_COLORS.length]);
      meta.append(dot, item.addedBy);
    }
    text.append(meta);
  }
  text.addEventListener("click", () => openEdit(item));

  li.append(box, text);
  attachSwipe(li, { onRight: () => { if (!item.checked) { box.checked = true; li.classList.add("popping"); } toggleItem(item, !item.checked, li); }, onLeft: () => deleteWithUndo([item], `${item.name} נמחק`) });
  return li;
}

// FLIP: remember where every row was, rebuild, then slide each row from its old spot to the new one.
function snapshotRows() {
  const rects = new Map();
  document.querySelectorAll("li[data-id]").forEach((li) => rects.set(li.dataset.id, li.getBoundingClientRect()));
  return rects;
}
function playFlip(first) {
  if (!first.size || reducedMotion()) return;
  document.querySelectorAll("li[data-id]").forEach((li) => {
    const a = first.get(li.dataset.id), b = li.getBoundingClientRect();
    if (!a || !b.width) return;
    const dx = a.left - b.left, dy = a.top - b.top;
    if (!dx && !dy) return;
    const group = li.closest(".group");
    group?.classList.add("flip");
    li.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
      { duration: 260, easing: "cubic-bezier(.2, .8, .2, 1)" })
      .finished.then(() => group?.classList.remove("flip"), () => {});
  });
}

// While a checked-off row is still sliding out, rebuilding the list would cut the motion short, so a render
// that arrives meanwhile is held back and runs when the row's write lands (its snapshot triggers it).
const enterAt = new Map(); // item id -> { t: when it appeared, i: stagger slot, flash }: rows still easing in
let leaving = 0, dirty = false, prevTodoN = 0;

function render() {
  if (leaving) { dirty = true; return; }
  dirty = false;
  const first = snapshotRows();
  // Rows are rebuilt on every render; keep a keyboard user's place on the checkbox they just toggled.
  const focusedBox = document.activeElement?.matches?.("li input[type=checkbox]") ? document.activeElement.id : null;
  const todo = items.filter((i) => !i.checked);
  const done = items.filter((i) => i.checked);

  // Group the to-do items by section, in the store-walking order.
  const groups = order
    .map((id) => ({ cat: categoryById(id), items: todo.filter((i) => catOf(i).id === id) }))
    .filter((g) => g.items.length);

  $("list").replaceChildren(...groups.map((g) => {
    const section = document.createElement("section");
    section.className = "group";
    section.dataset.cat = g.cat.id;
    const h = document.createElement("button");
    h.type = "button";
    h.className = "group-head";
    const gname = document.createElement("span");
    gname.textContent = g.cat.name;
    const count = document.createElement("span");
    count.className = "count";
    count.textContent = g.items.length;
    const chev = document.createElement("span");
    chev.className = "chev";
    chev.append(icon("chevron", 16));
    h.append(tileEl(g.cat, 15), gname, count, chev);
    const isCollapsed = collapsed.has(g.cat.id);
    section.classList.toggle("collapsed", isCollapsed);
    h.setAttribute("aria-expanded", String(!isCollapsed));
    h.addEventListener("click", () => {
      const now = section.classList.toggle("collapsed");
      h.setAttribute("aria-expanded", String(!now));
      if (now) collapsed.add(g.cat.id); else collapsed.delete(g.cat.id);
      try { localStorage.setItem("collapsed", JSON.stringify([...collapsed])); } catch {}
    });
    const ul = document.createElement("ul");
    ul.append(...g.items.map(renderItem));
    const card = document.createElement("div");
    card.className = "card";
    card.append(ul);
    section.append(h, card);
    return section;
  }));

  $("done-list").replaceChildren(...done.map(renderItem));
  $("done-count").textContent = done.length ? `(${done.length})` : "";
  $("done-section").hidden = done.length === 0;
  $("skeleton").hidden = true;
  $("empty").hidden = items.length > 0;
  $("all-done").hidden = !(items.length > 0 && todo.length === 0);
  if (loaded && view === "list" && prevTodoN > 0 && todo.length === 0 && items.length > 0) {
    requestAnimationFrame(() => burst($("all-done").querySelector(".state-mark")));
  }
  prevTodoN = todo.length;
  updateSummary(todo.length, done.length);
  renderSuggestions();
  if (focusedBox) document.getElementById(focusedBox)?.focus({ preventScroll: true });
  playFlip(first);
  if (shopDlg.open) renderShop();
  regulars?.refresh();
  prices?.refresh();
}

function updateSummary(todoN, doneN) {
  const total = todoN + doneN;
  const changed = $("big-todo").textContent !== String(todoN);
  $("big-todo").textContent = todoN;
  $("big-todo").hidden = !todoN;
  if (changed && todoN) rollIn($("big-todo"));
  $("summary").textContent = !total ? "הרשימה ריקה" : todoN ? "נשארו לקחת" : "הכול בעגלה";
  $("meta").textContent = total && todoN && doneN ? `· ${doneN} כבר בעגלה` : "";
  const bar = $("progress"); // absent if an older cached index.html is paired with this script
  if (bar) { bar.hidden = !total; bar.style.setProperty("--p", total ? doneN / total : 0); }
  $("shop-btn").disabled = !todoN;
  $("send-btn").disabled = !todoN;
}

// The "in the cart" list stays folded until someone wants it.
let doneOpen = false;
try { doneOpen = localStorage.getItem("doneOpen") === "1"; } catch {}
function applyDoneOpen() {
  $("done-body").hidden = !doneOpen;
  $("done-toggle").setAttribute("aria-expanded", String(doneOpen));
}
applyDoneOpen();
$("done-toggle").addEventListener("click", () => {
  doneOpen = !doneOpen;
  try { localStorage.setItem("doneOpen", doneOpen ? "1" : "0"); } catch {}
  applyDoneOpen();
});

// Delete now, offer to bring it back. Rules only allow creating unchecked items, so checked ones are re-checked afterwards.
async function restoreItems(list) {
  const batch = writeBatch(db);
  list.forEach(({ id, ...data }) => batch.set(doc(itemsRef, id), { ...data, checked: false }));
  await batch.commit();
  const was = list.filter((i) => i.checked);
  if (was.length) {
    const b2 = writeBatch(db);
    was.forEach((i) => b2.update(doc(itemsRef, i.id), { checked: true }));
    await b2.commit();
  }
}
function deleteWithUndo(list, label) {
  const keep = list.map((i) => ({ ...i }));
  const batch = writeBatch(db);
  list.forEach((i) => batch.delete(doc(itemsRef, i.id)));
  batch.commit().catch(() => setStatus("לא הצלחתי למחוק", true));
  toast(label, { label: "ביטול", run: () => restoreItems(keep).catch(() => setStatus("לא הצלחתי לשחזר", true)) });
}

// Checking a row off: the circle fills, the row slides out, and only then is the change written, so the list
// is rebuilt once the motion is done. Tapping the circle again mid-slide just cancels it; nothing is written.
function toggleItem(item, checked, row) {
  if (row?._leave) { row._leave.cancel(); row._leave = null; return; }
  if (checked) navigator.vibrate?.(14);
  const write = () => updateDoc(doc(itemsRef, item.id), { checked })
    .catch(() => { setStatus("לא הצלחתי לעדכן, בדוק חיבור לאינטרנט", true); render(); });
  if (!checked || !row || reducedMotion()) return write();
  const anim = leaveRow(row);
  row._leave = anim;
  leaving++;
  anim.finished.then(
    () => { row._leave = null; leaving--; write(); },
    () => { leaving--; if (!leaving && dirty) render(); },
  );
}

// ---- Shopping mode: one section at a time, in store-walking order ----
const shopDlg = $("shop-dialog");
const shop = { idx: 0, left: new Map(), timer: 0, wake: null, dir: 0, start: 0, startDone: 0, tick: 0, summary: null, prev: null };

function shopSections() {
  return order.map((id) => {
    const its = items.filter((i) => catOf(i).id === id);
    return { cat: categoryById(id), todo: its.filter((i) => !i.checked), done: its.filter((i) => i.checked) };
  }).filter((s) => s.todo.length + s.done.length);
}

const shopPop = new Map(); // item id -> when it was last ticked in shopping mode, so the rebuilt row can still pop

function shopRow(item) {
  const row = document.createElement("div");
  row.className = "shop-row" + (item.checked ? " done" : "");
  row.setAttribute("role", "checkbox");
  row.setAttribute("aria-checked", String(item.checked));
  row.tabIndex = 0;
  const mark = document.createElement("span");
  mark.className = "shop-mark";
  mark.append(icon("check", 18));
  const name = document.createElement("span");
  name.className = "shop-name";
  name.textContent = item.name;
  if (item.qty > 1) {
    const q = document.createElement("span");
    q.className = "qty";
    q.textContent = "×" + item.qty;
    name.append(q);
  }
  row.append(mark, name);
  if (item.note) {
    const n = document.createElement("span");
    n.className = "shop-note";
    n.textContent = item.note;
    name.append(n);
  }
  if (performance.now() - (shopPop.get(item.id) || -1e9) < 800) row.classList.add("popping");
  const flip = () => { shopPop.set(item.id, performance.now()); toggleItem(item, !item.checked); };
  let x0 = null, dx = 0;
  row.addEventListener("pointerdown", (e) => { x0 = e.clientX; dx = 0; row.setPointerCapture(e.pointerId); });
  row.addEventListener("pointermove", (e) => {
    if (x0 === null) return;
    dx = e.clientX - x0;
    if (Math.abs(dx) < 6) return;
    row.style.transform = `translateX(${dx}px)`;
    row.classList.toggle("armed", Math.abs(dx) > 90);
  });
  const end = () => {
    if (x0 === null) return;
    const swiped = Math.abs(dx) > 90, moved = Math.abs(dx) >= 6;
    x0 = null;
    row.classList.remove("armed");
    row.style.transform = "";
    if (swiped || !moved) flip();
  };
  row.addEventListener("pointerup", end);
  row.addEventListener("pointercancel", () => { x0 = null; row.classList.remove("armed"); row.style.transform = ""; });
  row.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); } });
  return row;
}

function renderShop() {
  const secs = shopSections();
  if (!secs.length) { shopDlg.close(); return; }
  shop.idx = Math.min(Math.max(shop.idx, 0), secs.length - 1);
  const sec = secs[shop.idx];
  const remaining = secs.reduce((n, s) => n + s.todo.length, 0);
  const focusedKey = document.activeElement?.closest?.("#shop-body .shop-row") ? [...document.querySelectorAll("#shop-body .shop-row")].indexOf(document.activeElement) : -1;

  $("shop-pos").textContent = remaining ? `${shop.idx + 1} מתוך ${secs.length}` : "";
  $("shop-dots").replaceChildren(...secs.map((s, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "shop-dot" + (i === shop.idx ? " cur" : "") + (s.todo.length ? "" : " full");
    b.setAttribute("aria-label", s.cat.name + (s.todo.length ? `, נשארו ${s.todo.length}` : ", הושלם"));
    if (i === shop.idx) b.setAttribute("aria-current", "step");
    b.addEventListener("click", () => { clearTimeout(shop.timer); shop.dir = Math.sign(i - shop.idx); shop.idx = i; renderShop(); });
    return b;
  }));

  const head = document.createElement("div");
  head.className = "shop-head";
  const tile = tileEl(sec.cat, 24);
  tile.classList.add("shop-tile");
  const titles = document.createElement("div");
  const h = document.createElement("h3");
  h.textContent = sec.cat.name;
  const sub = document.createElement("p");
  sub.textContent = sec.todo.length ? `נשארו ${sec.todo.length}` : "הכול נלקח";
  titles.append(h, sub);
  head.append(tile, titles);

  const body = $("shop-body");
  if (!remaining) {
    const fin = document.createElement("div");
    fin.className = "shop-fin";
    const t = document.createElement("h3");
    t.textContent = "הכול בעגלה";
    const p = document.createElement("p");
    if (!shop.summary && shop.start) {
      const n = items.filter((i) => i.checked).length - shop.startDone;
      if (n > 0) {
        const min = Math.max(1, Math.round((Date.now() - shop.start) / 60000));
        shop.summary = { n, min };
        shop.celebrate = true;
        if (!DEMO) try {
          const trips = JSON.parse(localStorage.getItem("trips:" + cartId) || "[]");
          shop.prev = trips[0] || null;
          trips.unshift({ t: Date.now(), n, min });
          localStorage.setItem("trips:" + cartId, JSON.stringify(trips.slice(0, 20)));
        } catch {}
      }
    }
    p.textContent = shop.summary ? `${shop.summary.n} מוצרים ב-${shop.summary.min} דקות` : "כל הכבוד, סיימתם את הקניות.";
    const prevP = document.createElement("p");
    if (shop.summary && shop.prev) prevP.textContent = `בפעם הקודמת: ${shop.prev.n} מוצרים ב-${shop.prev.min} דקות`;
    const receipt = document.createElement("button");
    receipt.type = "button";
    receipt.className = "btn ghost";
    receipt.textContent = "הוספת קבלה מהסופר";
    receipt.addEventListener("click", () => prices.openReceipt({ items: shop.summary?.n }));
    const done = document.createElement("button");
    done.type = "button";
    done.className = "btn";
    done.textContent = "סיום";
    done.addEventListener("click", () => shopDlg.close());
    fin.append(t, p, ...(prevP.textContent ? [prevP] : []), receipt, done);
    body.replaceChildren(fin);
    if (shop.celebrate) { shop.celebrate = false; requestAnimationFrame(() => burst(t)); }
  } else {
    body.replaceChildren(head, ...sec.todo.map(shopRow), ...sec.done.map(shopRow));
  }
  if (focusedKey >= 0) body.querySelectorAll(".shop-row")[focusedKey]?.focus({ preventScroll: true });

  $("shop-prev").disabled = shop.idx === 0 || !remaining;
  $("shop-next").disabled = shop.idx === secs.length - 1 || !remaining;
  document.querySelector(".shop-nav").hidden = !remaining;

  if (shop.dir && !reducedMotion()) {
    body.animate([{ opacity: 0, transform: `translateX(${shop.dir * -24}px)` }, { opacity: 1, transform: "none" }],
      { duration: 220, easing: "cubic-bezier(.2, .8, .2, 1)" });
  }
  shop.dir = 0;

  // Finished this section by checking the last item: move on to the next one that still has something to grab.
  const prevLeft = shop.left.get(sec.cat.id);
  shop.left.set(sec.cat.id, sec.todo.length);
  if (prevLeft > 0 && sec.todo.length === 0 && remaining) {
    shop.timer = setTimeout(() => {
      const now = shopSections();
      const next = now.findIndex((s, i) => i > shop.idx && s.todo.length);
      const target = next >= 0 ? next : now.findIndex((s) => s.todo.length);
      if (target >= 0 && shopDlg.open) { shop.dir = Math.sign(target - shop.idx) || 1; shop.idx = target; renderShop(); }
    }, 750);
  }
}

async function keepAwake() {
  try { shop.wake = await navigator.wakeLock?.request("screen"); } catch {}
}

$("shop-btn").addEventListener("click", () => {
  const secs = shopSections();
  shop.idx = Math.max(0, secs.findIndex((s) => s.todo.length));
  shop.left = new Map(secs.map((s) => [s.cat.id, s.todo.length]));
  shop.dir = 0;
  shop.start = Date.now();
  shop.startDone = items.filter((i) => i.checked).length;
  shop.summary = null;
  shop.prev = null;
  renderShop();
  shopDlg.showModal();
  keepAwake();
  const time = $("shop-time");
  const draw = () => { time.textContent = clock((Date.now() - shop.start) / 1000); };
  draw();
  clearInterval(shop.tick);
  shop.tick = setInterval(draw, 1000);
});
$("send-btn").addEventListener("click", async () => {
  const text = shareText(shopSections());
  if (!text) { toast("הכול כבר בעגלה, אין מה לשלוח"); return; }
  if (navigator.share) { try { await navigator.share({ text }); } catch {} return; }
  window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank", "noopener");
});
$("shop-close").addEventListener("click", () => shopDlg.close());
$("shop-prev").addEventListener("click", () => { clearTimeout(shop.timer); shop.dir = -1; shop.idx--; renderShop(); });
$("shop-next").addEventListener("click", () => { clearTimeout(shop.timer); shop.dir = 1; shop.idx++; renderShop(); });
shopDlg.addEventListener("close", () => { clearTimeout(shop.timer); clearInterval(shop.tick); shop.wake?.release?.().catch(() => {}); shop.wake = null; });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && shopDlg.open) keepAwake(); });

// ---- Live data ----
// An item that was just added lands in its own section, maybe off-screen: scroll it into view so the add is seen.
function revealNew(added) {
  if (view !== "list" || !added.length) return;
  const li = document.querySelector(`#list li[data-id="${added[0].id}"]`);
  if (!li) return;
  const r = li.getBoundingClientRect();
  const top = document.querySelector(".bar").getBoundingClientRect().bottom, bottom = $("add-form").getBoundingClientRect().top;
  if (r.top < top + 8 || r.bottom > bottom - 8) li.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
}

onSnapshot(
  query(itemsRef, orderBy("createdAt")),
  (snap) => {
    const known = new Set(items.map((i) => i.id));
    const firstLoad = !loaded;
    items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    loaded = true;
    let fresh = [];
    // Someone else added something while this screen is open: say so.
    if (!firstLoad) {
      fresh = items.filter((i) => !known.has(i.id) && i.addedBy && i.addedBy !== me);
      if (fresh.length) toast(fresh.length === 1 ? `${fresh[0].addedBy} הוסיף/ה ${fresh[0].name}` : `${fresh[0].addedBy} הוסיף/ה ${fresh.length} מוצרים`);
    } else {
      showInstallBanner();
    }
    const freshIds = new Set(fresh.map((i) => i.id));
    let slot = 0;
    for (const i of items) if (!known.has(i.id) && !i.checked) enterAt.set(i.id, { t: performance.now(), i: firstLoad ? Math.min(slot++, 10) : 0, flash: !firstLoad });
    render();
    if (!firstLoad) revealNew(items.filter((i) => !known.has(i.id) && !i.checked));
  },
  (err) => {
    console.error(err);
    setStatus("אין חיבור לעגלה. בדוק אינטרנט והרשאות (firestore.rules).", true);
  },
);

onSnapshot(historyRef, (snap) => {
  buyStats = snap.exists() ? (snap.data().items || {}) : {};
  renderSuggestions();
  regulars?.refresh();
}, (err) => console.error(err));

// Corrections the family made ("לחמים belongs in bakery"): used for every future item.
onSnapshot(learnedRef, (snap) => {
  setLearned(snap.exists() ? snap.data().map : {});
  render();
}, (err) => console.error(err));

onSnapshot(prefsRef, (snap) => {
  const data = snap.exists() ? snap.data() : {};
  order = normalizeOrder(data.order);
  if (data.theme) applyTheme(data.theme); // no saved theme: keep this device's choice
  render();
  if ($("order-dialog").open) renderOrderDialog();
}, (err) => console.error(err));

onSnapshot(pricesRef, (snap) => {
  userPrices = snap.exists() ? (snap.data().p || {}) : {};
  prices?.refresh();
}, (err) => console.error(err));

onSnapshot(storesRef, (snap) => {
  const d = snap.exists() ? snap.data() : {};
  storeCfg = { sel: Array.isArray(d.sel) ? d.sel : null, custom: Array.isArray(d.custom) ? d.custom : [] };
  prices?.refresh();
}, (err) => console.error(err));

onSnapshot(query(receiptsRef, orderBy("t")), (snap) => {
  receipts = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.t - a.t);
  prices?.refresh();
}, (err) => console.error(err));

// ---- Change a product's section (for a list item, or for one of "our products") ----
const picker = $("picker");

function learnCategory(name, catId) {
  const key = rememberLocally(name, catId);
  if (key) {
    setDoc(learnedRef, { map: { [key]: catId } }, { merge: true })
      .catch(() => setStatus("לא הצלחתי לזכור את הבחירה", true));
  }
}

function openCategoryPicker(name, currentId, onPick) {
  $("picker-title").textContent = `איפה ${name} בסופר?`;
  $("picker-list").replaceChildren(...CATEGORIES.map((c) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pick" + (c.id === currentId ? " current" : "");
    b.append(tileEl(c, 16), document.createTextNode(c.name));
    b.addEventListener("click", () => {
      learnCategory(name, c.id);
      onPick?.(c.id);
      picker.close();
    });
    return b;
  }));
  picker.showModal();
}

function openPicker(item) {
  openCategoryPicker(item.name, catOf(item).id, (catId) => {
    updateDoc(doc(itemsRef, item.id), { category: catId })
      .catch(() => setStatus("לא הצלחתי לעדכן קטגוריה", true));
  });
}

// ---- Edit the store walking order ----
const orderDialog = $("order-dialog");

function renderOrderDialog() {
  $("order-list").replaceChildren(...order.map((id, idx) => {
    const c = categoryById(id);
    const li = document.createElement("li");
    li.className = "order-row";
    const label = document.createElement("span");
    label.className = "lbl";
    label.textContent = c.name;
    const up = document.createElement("button");
    up.type = "button"; up.textContent = "↑"; up.disabled = idx === 0;
    up.setAttribute("aria-label", `הזז למעלה: ${c.name}`);
    up.addEventListener("click", () => moveCategory(idx, -1));
    const down = document.createElement("button");
    down.type = "button"; down.textContent = "↓"; down.disabled = idx === order.length - 1;
    down.setAttribute("aria-label", `הזז למטה: ${c.name}`);
    down.addEventListener("click", () => moveCategory(idx, 1));
    li.append(tileEl(c, 16), label, up, down);
    return li;
  }));
}

function moveCategory(idx, delta) {
  const next = [...order];
  const j = idx + delta;
  if (j < 0 || j >= next.length) return;
  [next[idx], next[j]] = [next[j], next[idx]];
  order = next; // optimistic; snapshot confirms
  renderOrderDialog();
  render();
  setDoc(prefsRef, { order: next }, { merge: true })
    .catch(() => setStatus("לא הצלחתי לשמור את הסדר", true));
}

$("order-reset").addEventListener("click", () => {
  order = [...DEFAULT_ORDER];
  renderOrderDialog();
  render();
  setDoc(prefsRef, { order }, { merge: true }).catch(() => setStatus("לא הצלחתי לשמור את הסדר", true));
});

// Close dialogs on close-button or backdrop click.
document.querySelectorAll("dialog").forEach((d) => {
  d.addEventListener("click", (e) => { if (e.target === d || e.target.closest("[data-close]")) d.close(); });
});

// ---- Actions ----
const addInput = $("add-input");
const autoGrow = () => { addInput.style.height = "auto"; addInput.style.height = Math.min(addInput.scrollHeight + 2, 160) + "px"; };
addInput.addEventListener("input", () => { autoGrow(); renderSuggestions(); });
// Desktop: Enter sends, Shift+Enter = new line. Touch: Enter = new line, the + button sends.
const isTouch = matchMedia("(pointer: coarse)").matches;
addInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !isTouch && !e.isComposing) {
    e.preventDefault();
    $("add-form").requestSubmit();
  }
});

let statusTimer;
function flash(text) {
  setStatus(text);
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => setStatus(""), 3000);
}

// Adds product names (already split). Skips what is already waiting; remembers counts for "our products".
async function addNames(rawNames, restoreText = "") {
  const parsed = rawNames.map(splitQty).filter((p) => p.name.length >= 2);
  if (!parsed.length) return;

  const waiting = new Set(items.filter((i) => !i.checked).map((i) => i.name.trim().toLowerCase()));
  const fresh = parsed.filter((p) => !waiting.has(p.name.toLowerCase()));
  if (!fresh.length) return flash("כבר יש את זה ברשימה");

  setStatus("");
  try {
    const batch = writeBatch(db);
    const now = Date.now();
    const seen = {};
    fresh.forEach(({ name, qty }, i) => {
      const data = { name, checked: false, createdAt: now + i, category: classify(name) };
      if (qty > 1) data.qty = qty;
      if (me) data.addedBy = me;
      batch.set(doc(itemsRef), data);
      const key = learnKey(name);
      if (key) seen[key] = { n: name, c: increment(1), t: now, x: false }; // x:false brings back a product that was removed
    });
    await batch.commit();
    if (Object.keys(seen).length) {
      setDoc(historyRef, { items: seen }, { merge: true }).catch(() => {}); // the products database is best-effort
    }
    const skipped = parsed.length - fresh.length;
    if (fresh.length > 1 || skipped) {
      const added = fresh.length === 1 ? "נוסף מוצר אחד" : `נוספו ${fresh.length} מוצרים`;
      flash(`${added}` + (skipped ? ` (${skipped} כבר היו ברשימה)` : ""));
    }
  } catch (err) {
    console.error(err);
    if (restoreText) { addInput.value = restoreText; autoGrow(); }
    setStatus("לא הצלחתי להוסיף, נסה שוב", true);
  }
}

$("add-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const text = addInput.value;
  const names = parseItems(text);
  if (!names.length) return;
  addInput.value = "";
  autoGrow();
  addInput.focus();
  addNames(names, text);
});

// ---- Quick add chips: appear while typing (or when the list is empty), built from "our products" ----
let addFocused = false;
addInput.addEventListener("focus", () => { addFocused = true; renderSuggestions(); });
addInput.addEventListener("blur", () => setTimeout(() => { addFocused = false; renderSuggestions(); }, 150));
function renderSuggestions() {
  const row = $("sugg-row");
  const onList = new Set(items.map((i) => learnKey(i.name)));
  const names = suggestions(buyStats, onList, { typed: addInput.value, limit: 10 });
  const show = names.length > 0 && (addFocused || addInput.value.trim() || (loaded && items.length === 0));
  row.hidden = !show;
  if (!show) { row.replaceChildren(); return; }
  row.replaceChildren(...names.map((n) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sugg";
    b.textContent = n;
    b.addEventListener("pointerdown", (e) => e.preventDefault()); // keep the keyboard open
    b.addEventListener("click", () => addNames([n]));
    return b;
  }));
}

// ---- Voice input (Web Speech API, Hebrew) ----
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SR) {
  const mic = $("mic");
  mic.hidden = false;
  let rec = null;
  let heard = "";
  const setListening = (on) => {
    mic.classList.toggle("listening", on);
    addInput.placeholder = on ? "מקשיב... אמרו מה חסר" : "מה חסר בבית?";
  };
  mic.addEventListener("click", () => {
    if (rec) { rec.stop(); return; }
    rec = new SR();
    rec.lang = "he-IL";
    rec.interimResults = true;
    rec.continuous = false;
    heard = "";
    rec.onstart = () => setListening(true);
    rec.onresult = (e) => {
      heard = Array.from(e.results, (r) => r[0].transcript).join(" ");
      addInput.value = heard;
      autoGrow();
    };
    rec.onerror = (e) => {
      flash(e.error === "not-allowed" ? "צריך לאשר גישה למיקרופון" : e.error === "no-speech" ? "לא שמעתי, נסו שוב" : "ההקלטה נכשלה");
    };
    rec.onend = () => {
      setListening(false);
      rec = null;
      const names = parseItems(splitSpoken(heard));
      addInput.value = "";
      autoGrow();
      if (names.length) addNames(names, heard);
    };
    try { rec.start(); } catch { rec = null; setListening(false); }
  });
}

// ---- Edit an item: name, quantity, note ----
const editDialog = $("edit-dialog");
let editing = null;
let editQty = 1;
const setQty = (n) => { editQty = Math.min(99, Math.max(1, n)); $("qty-val").textContent = editQty; };
$("qty-minus").addEventListener("click", () => setQty(editQty - 1));
$("qty-plus").addEventListener("click", () => setQty(editQty + 1));

function openEdit(item) {
  editing = item;
  $("edit-name").value = item.name;
  $("edit-note").value = item.note || "";
  setQty(item.qty || 1);
  $("edit-cat").replaceChildren(document.createTextNode(catOf(item).name));
  $("edit-price").replaceChildren(document.createTextNode(prices?.describe(item.name) || "הוספת מחיר"));
  editDialog.showModal();
}

$("edit-form").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!editing) return;
  const name = $("edit-name").value.trim().slice(0, 80);
  if (!name) return;
  const note = $("edit-note").value.trim().slice(0, 60);
  updateDoc(doc(itemsRef, editing.id), {
    name,
    qty: editQty > 1 ? editQty : deleteField(),
    note: note || deleteField(),
  }).catch(() => setStatus("לא הצלחתי לשמור את השינויים", true));
  editDialog.close();
});
$("edit-cat").addEventListener("click", () => {
  if (!editing) return;
  const it = editing;
  editDialog.close();
  openPicker(it);
});
$("edit-price").addEventListener("click", () => {
  if (!editing) return;
  const it = editing;
  editDialog.close();
  prices.openPriceDialog(it.name);
});
$("edit-delete").addEventListener("click", () => {
  if (!editing) return;
  deleteWithUndo([editing], `${editing.name} נמחק`);
  editDialog.close();
});

$("all-done-clear").addEventListener("click", () => $("clear-done").click());
$("clear-done").addEventListener("click", () => {
  const done = items.filter((i) => i.checked);
  if (done.length) deleteWithUndo(done, `${done.length} מוצרים נמחקו`);
});

// ---- Who am I (shown on items I add) ----
const nameDialog = $("name-dialog");
function renderMyName() { $("menu-name-val").textContent = me || "לא הוגדר"; }
function askName() { $("name-input").value = me; nameDialog.showModal(); }
$("name-form").addEventListener("submit", (e) => {
  e.preventDefault();
  me = $("name-input").value.trim().slice(0, 20);
  try { localStorage.setItem("me", me); } catch {}
  renderMyName();
  nameDialog.close();
});
$("name-skip").addEventListener("click", () => {
  try { localStorage.setItem("meSkipped", "1"); } catch {}
  nameDialog.close();
});
renderMyName();
try {
  if (!DEMO && !me && localStorage.getItem("meSkipped") !== "1") setTimeout(askName, 900);
} catch {}

// ---- Settings sheet: name, store order, invite, home screen, appearance ----
const menuDialog = $("menu-dialog");
// Open another dialog from the sheet: close the sheet first so only one is ever on screen.
const fromMenu = (open) => () => { menuDialog.close(); open(); };
$("menu-btn").addEventListener("click", () => menuDialog.showModal());
$("menu-name").addEventListener("click", fromMenu(askName));
$("menu-order").addEventListener("click", fromMenu(() => { renderOrderDialog(); orderDialog.showModal(); }));
$("menu-connect").addEventListener("click", fromMenu(() => carts.openInvite()));
$("menu-install").addEventListener("click", fromMenu(showInstall));

// Appearance: auto (follow the phone), light, dark. Stored per device.
const modeButtons = [...document.querySelectorAll(".seg [data-mode]")];
function syncMode() {
  const cur = document.documentElement.dataset.mode || "auto";
  modeButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === cur)));
}
modeButtons.forEach((b) => b.addEventListener("click", () => {
  const m = b.dataset.mode;
  if (m === "auto") delete document.documentElement.dataset.mode; else document.documentElement.dataset.mode = m;
  try { m === "auto" ? localStorage.removeItem("mode") : localStorage.setItem("mode", m); } catch {}
  syncMode();
}));
syncMode();

// Colours are shared through prefs; localStorage avoids a flash of the default.
const THEMES = [
  { id: "mint", name: "ירוק", color: "#2F7D5B" },
  { id: "sky", name: "כחול", color: "#2F6FA8" },
  { id: "coral", name: "אדמה", color: "#B3523B" },
  { id: "violet", name: "סגול", color: "#6A5AA6" },
  { id: "amber", name: "חרדל", color: "#9A6710" },
];
function applyTheme(id) {
  const t = THEMES.find((x) => x.id === id) || THEMES[0];
  document.documentElement.dataset.theme = t.id;
  try { localStorage.setItem("theme", t.id); } catch {}
  document.querySelectorAll(".swatch").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === t.id)));
}
$("swatches").replaceChildren(...THEMES.map((t) => {
  const b = document.createElement("button");
  b.type = "button"; b.className = "swatch"; b.dataset.id = t.id;
  b.style.background = t.color; b.setAttribute("aria-label", t.name);
  b.addEventListener("click", () => {
    applyTheme(t.id);
    setDoc(prefsRef, { theme: t.id }, { merge: true }).catch(() => setStatus("לא הצלחתי לשמור את הצבע", true));
  });
  return b;
}));
try { applyTheme(localStorage.getItem("theme")); } catch { applyTheme(); }

// ---- Carts: switcher, join by code, invite sheet (ui-carts.js) ----
const carts = initCarts({ $, icon, toast, DEMO, cartId });
if (boot.notice?.joined) toast(`הצטרפתם לעגלה "${boot.name}"`);
else if (boot.notice?.error) toast(boot.notice.error);

// ---- Add to home screen ----
let installPrompt = null;
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installPrompt = e; });
const isStandalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
if (isStandalone || DEMO) $("menu-install").parentElement.hidden = true;

function showInstall() {
  if (installPrompt) {
    installPrompt.prompt();
    installPrompt.userChoice.catch(() => {}).finally(() => { installPrompt = null; });
    return;
  }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const steps = ios
    ? ["פתחו את העגלה ב-Safari (לא מתוך וואטסאפ: לחצו על \"פתיחה ב-Safari\").", "לחצו על כפתור השיתוף (ריבוע עם חץ) בתחתית המסך.", "גללו ובחרו \"הוספה למסך הבית\", ואשרו.", "האייקון החדש פותח את העגלה שהייתם בה. כדי להוסיף עגלה נוספת, הצטרפו אליה מתוך האפליקציה עם הקוד."]
    : ["פתחו את העגלה ב-Chrome.", "לחצו על שלוש הנקודות בפינה העליונה.", "בחרו \"התקנת אפליקציה\" או \"הוספה למסך הבית\".", "האייקון החדש פותח את העגלה שהייתם בה. כדי להוסיף עגלה נוספת, הצטרפו אליה מתוך האפליקציה עם הקוד."];
  $("install-steps").replaceChildren(...steps.map((s) => { const li = document.createElement("li"); li.textContent = s; return li; }));
  $("install-dialog").showModal();
}

// A one-time nudge, only in a browser tab (never inside the installed app, never in the demo).
function showInstallBanner() {
  let dismissed = false;
  try { dismissed = localStorage.getItem("installDismissed") === "1"; } catch {}
  $("install-banner").hidden = isStandalone || DEMO || dismissed;
}
$("install-go").addEventListener("click", showInstall);
$("install-x").addEventListener("click", () => {
  $("install-banner").hidden = true;
  try { localStorage.setItem("installDismissed", "1"); } catch {}
});
if (DEMO) $("demo-bar").hidden = false;

// ---- Tabs that need everything above ----
regulars = initRegulars({
  $, icon, toast, flash, setStatus, catOf, openCategoryPicker, learnCategory,
  get items() { return items; },
  get stats() { return buyStats; },
  get prices() { return prices; },
  addNames,
  save: (patch) => setDoc(historyRef, { items: patch }, { merge: true }),
});
prices = initPrices({
  $, icon, toast, setStatus, DEMO, setView,
  get items() { return items; },
  get userPrices() { return userPrices; },
  get storeCfg() { return storeCfg; },
  get receipts() { return receipts; },
  savePrices: (patch) => setDoc(pricesRef, { p: patch }, { merge: true }),
  saveStores: (cfg) => setDoc(storesRef, cfg, { merge: true }),
  addReceipt: (r) => addDoc(receiptsRef, r),
  deleteReceipt: (id) => deleteDoc(doc(receiptsRef, id)),
  deleteField,
});

try { const v = sessionStorage.getItem("view"); if (["regulars", "prices"].includes(v)) setView(v); } catch {}
