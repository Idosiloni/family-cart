import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, setDoc,
  onSnapshot, query, orderBy, writeBatch, increment, deleteField,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { CATEGORIES, DEFAULT_ORDER, categoryById, classify, normalizeOrder, setLearned, rememberLocally, learnKey } from "./categories.js";
import { parseItems, splitQty, splitSpoken } from "./parse.js";
import { icon } from "./icons.js";

const $ = (id) => document.getElementById(id);
const statusEl = $("status");

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("error", isError);
}

// ---- Cart id: the shared link. Long random id in the URL hash. ----
function newCartId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function getCartId() {
  let id = location.hash.slice(1);
  if (!/^[a-f0-9]{32}$/.test(id)) {
    let saved = null;
    try { saved = localStorage.getItem("cartId"); } catch {}
    id = /^[a-f0-9]{32}$/.test(saved || "") ? saved : newCartId();
    history.replaceState(null, "", "#" + id);
  }
  try { localStorage.setItem("cartId", id); } catch {}
  return id;
}

// ---- Setup check ----
if (!firebaseConfig.projectId) {
  setStatus("חסר חיבור ל-Firebase: מלא את firebase-config.js (ראה README).", true);
  throw new Error("firebase-config.js is not filled in");
}

const cartId = getCartId();

// ---- Installable app: manifest is built at runtime so the home-screen icon opens THIS cart ----
(function setupManifest() {
  const manifest = {
    name: "העגלה המשפחתית", short_name: "העגלה", lang: "he", dir: "rtl",
    id: "/", scope: location.origin + "/", start_url: location.origin + location.pathname + location.hash,
    display: "standalone", background_color: "#0B0F1A", theme_color: "#0B0F1A",
    icons: [
      { src: location.origin + "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: location.origin + "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ],
  };
  const link = document.createElement("link");
  link.rel = "manifest";
  link.href = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" }));
  document.head.append(link);
})();
const db = getFirestore(initializeApp(firebaseConfig));
const itemsRef = collection(db, "carts", cartId, "items");
const prefsRef = doc(db, "carts", cartId, "settings", "prefs");
const learnedRef = doc(db, "carts", cartId, "settings", "learned");
const historyRef = doc(db, "carts", cartId, "settings", "history");

// ---- State ----
let items = [];
let order = [...DEFAULT_ORDER];
let buyStats = {}; // learnKey -> { n: name, c: times added, t: last added }
let me = "";
let collapsed = new Set();
try { collapsed = new Set(JSON.parse(localStorage.getItem("collapsed") || "[]")); } catch {}
try { me = localStorage.getItem("me") || ""; } catch {}

// A colored tile carrying the section's line icon (replaces emoji everywhere).
function tileEl(cat, size = 20) {
  const t = document.createElement("span");
  t.className = "tile";
  t.style.setProperty("--tb", cat.bg);
  t.style.setProperty("--tf", cat.fg);
  t.append(icon(cat.icon, size));
  return t;
}
document.querySelectorAll("[data-icon]").forEach((el) => el.append(icon(el.dataset.icon, Number(el.dataset.size) || 20)));
document.querySelectorAll("[data-icon-label]").forEach((el) => el.prepend(icon(el.dataset.iconLabel, 18)));

const catOf = (item) => categoryById(item.category || classify(item.name));

// ---- Render ----
function renderItem(item) {
  const li = document.createElement("li");
  li.className = item.checked ? "done" : "";
  li.dataset.id = item.id;

  const box = document.createElement("input");
  box.type = "checkbox";
  box.id = "c-" + item.id;
  box.checked = item.checked;
  box.setAttribute("aria-label", item.name);
  box.addEventListener("change", () => {
    if (box.checked) navigator.vibrate?.(14);
    updateDoc(doc(itemsRef, item.id), { checked: box.checked })
      .catch(() => setStatus("לא הצלחתי לעדכן, בדוק חיבור לאינטרנט", true));
  });

  const label = document.createElement("label");
  label.htmlFor = box.id;
  const name = document.createElement("span");
  name.className = "name";
  name.textContent = item.name; // textContent: never HTML
  if (item.qty > 1) {
    const q = document.createElement("span");
    q.className = "qty";
    q.textContent = "×" + item.qty;
    name.append(q);
  }
  label.append(name);
  const metaParts = [item.note, item.addedBy].filter(Boolean);
  if (metaParts.length) {
    const meta = document.createElement("span");
    meta.className = "meta";
    meta.textContent = metaParts.join(" · ");
    label.append(meta);
  }

  const edit = document.createElement("button");
  edit.type = "button";
  edit.className = "ibtn";
  edit.setAttribute("aria-label", "ערוך " + item.name);
  edit.append(icon("edit", 18));
  edit.addEventListener("click", () => openEdit(item));

  const del = document.createElement("button");
  del.type = "button";
  del.className = "ibtn";
  del.setAttribute("aria-label", "מחק " + item.name);
  del.append(icon("close", 18));
  del.addEventListener("click", () => {
    deleteDoc(doc(itemsRef, item.id))
      .catch(() => setStatus("לא הצלחתי למחוק", true));
  });

  li.append(box, label, edit, del);
  return li;
}

// FLIP: remember where every row was, rebuild, then slide each row from its old spot to the new one.
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
function snapshotRows() {
  const rects = new Map();
  document.querySelectorAll("li[data-id]").forEach((li) => rects.set(li.dataset.id, li.getBoundingClientRect()));
  return rects;
}
function playFlip(first) {
  if (!first.size || reduceMotion.matches) return;
  document.querySelectorAll("li[data-id]").forEach((li) => {
    const a = first.get(li.dataset.id), b = li.getBoundingClientRect();
    if (!a || !b.width) return; // brand-new rows keep their pop-in
    li.style.animation = "none"; // rebuilt rows that already existed must not replay the CSS pop-in
    const dx = a.left - b.left, dy = a.top - b.top;
    if (!dx && !dy) return;
    // Groups clip their rows (overflow: hidden) and paint below the done list; lift them while a row travels.
    const group = li.closest(".group");
    group?.classList.add("flip");
    li.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
      { duration: 350, easing: "cubic-bezier(.19, 1, .22, 1)" })
      .finished.then(() => group?.classList.remove("flip"), () => {});
  });
}

function render() {
  const first = snapshotRows();
  // Rows are rebuilt on every render; keep a keyboard user's place on the checkbox they just toggled.
  const focusedBox = document.activeElement?.matches?.("li input[type=checkbox]") ? document.activeElement.id : null;
  const todo = items.filter((i) => !i.checked);
  const done = items.filter((i) => i.checked);

  // Group the to-do items by section, in the store-walking order.
  const groups = order
    .map((id) => ({ cat: categoryById(id), items: todo.filter((i) => catOf(i).id === id) }))
    .filter((g) => g.items.length);

  $("list").replaceChildren(...groups.map((g, gi) => {
    const section = document.createElement("section");
    section.className = "group";
    if (first.size) section.style.animation = "none"; // the rise-in is for the first paint, not every re-render
    section.style.setProperty("--cc", g.cat.bg);
    section.style.setProperty("--cf", g.cat.fg);
    const h = document.createElement("button");
    h.type = "button";
    h.className = "group-head";
    const tile = tileEl(g.cat, 22);
    tile.classList.add("gh-tile");
    const gname = document.createElement("span");
    gname.className = "gh-name";
    gname.textContent = g.cat.name;
    const count = document.createElement("span");
    count.className = "count";
    count.textContent = g.items.length;
    const chev = document.createElement("span");
    chev.className = "chev";
    chev.append(icon("chevron", 20));
    const folio = document.createElement("span");
    folio.className = "folio";
    folio.textContent = String(gi + 1).padStart(2, "0");
    h.append(tile, folio, gname, count, chev);
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
  updateHero(todo.length, done.length, todo);
  renderSuggestions();
  if (focusedBox) document.getElementById(focusedBox)?.focus({ preventScroll: true });
  playFlip(first);
  if (shopDlg.open) renderShop();
}

// Counter feel: tween the big numeral to its new value.
function countTo(el, to) {
  const from = Number(el.textContent) || 0;
  if (from === to || matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = to; return; }
  const t0 = performance.now(), dur = 450;
  (function f(t) {
    const k = Math.min(1, (t - t0) / dur);
    el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(f);
  })(t0);
}

function setSummary(todoN, doneN) {
  const total = todoN + doneN;
  $("summary").textContent = !total ? "הרשימה ריקה" : todoN ? "נשארו לקחת" : "הכול בעגלה, כל הכבוד";
  $("meta").textContent = total ? `${doneN} מתוך ${total} כבר בעגלה` : "";
  $("big-todo").hidden = !todoN;
}

function updateHero(todoN, doneN, todo) {
  const total = todoN + doneN;
  const pct = total ? Math.round((doneN / total) * 100) : 0;
  countTo($("big-todo"), todoN);
  setSummary(todoN, doneN);

  // Celebrate the moment the last item gets checked off (not on first load).
  if (prevTodo !== null && prevTodo > 0 && todoN === 0 && total > 0) confetti();
  prevTodo = todoN;
}
let prevTodo = null;

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "לילה טוב" : h < 12 ? "בוקר טוב" : h < 17 ? "צהריים טובים" : h < 21 ? "ערב טוב" : "לילה טוב";
}
function renderGreeting() {
  $("greeting").textContent = greeting() + (me ? ", " + me : "");
}
renderGreeting();

// Flat shapes in the palette (no emoji).
function confetti() {
  const box = $("confetti");
  const colors = ["#5CF2C0", "#4CC9F0", "#A58BFF", "#FF6B8A", "#FFC46B", "#FFFFFF"];
  for (let i = 0; i < 40; i++) {
    const p = document.createElement("i");
    p.className = "piece";
    const size = 8 + Math.random() * 10;
    p.style.width = size + "px";
    p.style.height = (i % 3 === 0 ? size * 2.2 : size) + "px";
    p.style.borderRadius = i % 2 ? "50%" : "3px";
    p.style.background = colors[i % colors.length];
    p.style.left = Math.random() * 100 + "%";
    p.style.setProperty("--dx", (Math.random() * 160 - 80) + "px");
    p.style.setProperty("--rot", (Math.random() * 900 - 450) + "deg");
    p.style.setProperty("--dur", (2 + Math.random() * 1.6) + "s");
    p.style.animationDelay = Math.random() * 0.5 + "s";
    box.append(p);
    setTimeout(() => p.remove(), 4500);
  }
}

let loaded = false;
function toast(text) {
  const el = document.createElement("div");
  el.className = "toast";
  el.setAttribute("role", "status");
  el.textContent = text;
  (shopDlg.open ? shopDlg : document.body).append(el);
  el.animate([{ opacity: 0, transform: "translate(-50%, 12px)" }, { opacity: 1, transform: "translate(-50%, 0)" }], { duration: 220, easing: "cubic-bezier(.19, 1, .22, 1)" });
  setTimeout(() => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200 }).finished.then(() => el.remove(), () => el.remove()), 3200);
}

// ---- Shopping mode: one section at a time, in store-walking order ----
const shopDlg = $("shop-dialog");
const shop = { idx: 0, left: new Map(), timer: 0, wake: null, dir: 0 };
const reduceMotionQ = matchMedia("(prefers-reduced-motion: reduce)");

function shopSections() {
  return order.map((id) => {
    const its = items.filter((i) => catOf(i).id === id);
    return { cat: categoryById(id), todo: its.filter((i) => !i.checked), done: its.filter((i) => i.checked) };
  }).filter((s) => s.todo.length + s.done.length);
}

function toggleItem(item, checked) {
  if (checked) navigator.vibrate?.(14);
  updateDoc(doc(itemsRef, item.id), { checked })
    .catch(() => setStatus("לא הצלחתי לעדכן, בדוק חיבור לאינטרנט", true));
}

function shopRow(item) {
  const row = document.createElement("div");
  row.className = "shop-row" + (item.checked ? " done" : "");
  row.setAttribute("role", "checkbox");
  row.setAttribute("aria-checked", String(item.checked));
  row.tabIndex = 0;
  const mark = document.createElement("span");
  mark.className = "shop-mark";
  mark.append(icon("check", 20));
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
  const flip = () => toggleItem(item, !item.checked);
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
    b.style.setProperty("--cc", s.cat.bg);
    b.setAttribute("aria-label", s.cat.name + (s.todo.length ? `, נשארו ${s.todo.length}` : ", הושלם"));
    if (i === shop.idx) b.setAttribute("aria-current", "step");
    b.addEventListener("click", () => { shop.dir = Math.sign(i - shop.idx); shop.idx = i; renderShop(); });
    return b;
  }));

  const head = document.createElement("div");
  head.className = "shop-head";
  head.style.setProperty("--cc", sec.cat.bg);
  const tile = tileEl(sec.cat, 26);
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
    const mark = document.createElement("div");
    mark.className = "ad-mark";
    mark.append(icon("check", 34));
    const t = document.createElement("h3");
    t.textContent = "הכול בעגלה";
    const p = document.createElement("p");
    p.textContent = "כל הכבוד, סיימתם את הקניות.";
    const done = document.createElement("button");
    done.type = "button";
    done.className = "btn";
    done.textContent = "סיום";
    done.addEventListener("click", () => { shopDlg.close(); confetti(); });
    fin.append(mark, t, p, done);
    body.replaceChildren(fin);
  } else {
    body.replaceChildren(head, ...sec.todo.map(shopRow), ...sec.done.map(shopRow));
  }
  if (focusedKey >= 0) body.querySelectorAll(".shop-row")[focusedKey]?.focus({ preventScroll: true });

  $("shop-prev").disabled = shop.idx === 0 || !remaining;
  $("shop-next").disabled = shop.idx === secs.length - 1 || !remaining;
  document.querySelector(".shop-nav").hidden = !remaining;

  if (shop.dir && !reduceMotionQ.matches) {
    body.animate([{ opacity: 0, transform: `translateX(${shop.dir * -28}px)` }, { opacity: 1, transform: "none" }],
      { duration: 260, easing: "cubic-bezier(.19, 1, .22, 1)" });
  }
  shop.dir = 0;

  // Finished this section by checking the last item: move on to the next one that still has something to grab.
  const prevLeft = shop.left.get(sec.cat.id);
  shop.left.set(sec.cat.id, sec.todo.length);
  clearTimeout(shop.timer);
  if (prevLeft > 0 && sec.todo.length === 0 && remaining) {
    shop.timer = setTimeout(() => {
      const now = shopSections();
      const next = now.findIndex((s, i) => i > shop.idx && s.todo.length) ;
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
  renderShop();
  shopDlg.showModal();
  keepAwake();
});
$("shop-close").addEventListener("click", () => shopDlg.close());
$("shop-prev").addEventListener("click", () => { shop.dir = -1; shop.idx--; renderShop(); });
$("shop-next").addEventListener("click", () => { shop.dir = 1; shop.idx++; renderShop(); });
shopDlg.addEventListener("close", () => { clearTimeout(shop.timer); shop.wake?.release?.().catch(() => {}); shop.wake = null; });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && shopDlg.open) keepAwake(); });

onSnapshot(
  query(itemsRef, orderBy("createdAt")),
  (snap) => {
    const known = new Set(items.map((i) => i.id));
    const firstLoad = !loaded;
    items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    loaded = true;
    // Someone else added something while this screen is open: say so.
    if (!firstLoad) {
      const fresh = items.filter((i) => !known.has(i.id) && i.addedBy && i.addedBy !== me);
      if (fresh.length) toast(fresh.length === 1 ? `${fresh[0].addedBy} הוסיף/ה ${fresh[0].name}` : `${fresh[0].addedBy} הוסיף/ה ${fresh.length} מוצרים`);
    }
    render();
  },
  (err) => {
    console.error(err);
    setStatus("אין חיבור לעגלה. בדוק אינטרנט והרשאות (firestore.rules).", true);
  },
);

onSnapshot(historyRef, (snap) => {
  buyStats = snap.exists() ? (snap.data().items || {}) : {};
  renderSuggestions();
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

// ---- Change an item's section ----
const picker = $("picker");
let pickedItem = null;

function openPicker(item) {
  pickedItem = item;
  $("picker-title").textContent = `איפה ${item.name} בסופר?`;
  $("picker-list").replaceChildren(...CATEGORIES.map((c) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pick" + (c.id === catOf(item).id ? " current" : "");
    b.append(tileEl(c, 18), document.createTextNode(c.name));
    b.addEventListener("click", () => {
      updateDoc(doc(itemsRef, item.id), { category: c.id })
        .catch(() => setStatus("לא הצלחתי לעדכן קטגוריה", true));
      const key = rememberLocally(item.name, c.id);
      if (key) {
        setDoc(learnedRef, { map: { [key]: c.id } }, { merge: true })
          .catch(() => setStatus("לא הצלחתי לזכור את הבחירה", true));
      }
      picker.close();
    });
    return b;
  }));
  picker.showModal();
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
    li.append(tileEl(c, 18), label, up, down);
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

$("order-btn").addEventListener("click", () => { renderOrderDialog(); orderDialog.showModal(); });
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
const autoGrow = () => { addInput.style.height = "auto"; addInput.style.height = Math.min(addInput.scrollHeight + 2, 168) + "px"; };
addInput.addEventListener("input", autoGrow);
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

// Adds product names (already split). Skips what is already waiting; remembers counts for quick-add.
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
      if (key) seen[key] = { n: name, c: increment(1), t: now };
    });
    await batch.commit();
    if (Object.keys(seen).length) {
      setDoc(historyRef, { items: seen }, { merge: true }).catch(() => {}); // quick-add stats are best-effort
    }
    const skipped = parsed.length - fresh.length;
    if (fresh.length > 1 || skipped) {
      const added = fresh.length === 1 ? "נוסף מוצר אחד" : `נוספו ${fresh.length} מוצרים`;
      flash(`${added} ✓` + (skipped ? ` (${skipped} כבר היו ברשימה)` : ""));
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

// ---- Quick add chips: what this family buys most (starter set until there is history) ----
const STARTERS = ["חלב", "ביצים", "לחם", "עגבניות", "מלפפונים", "במבה", "קולה", "אורז"];
function renderSuggestions() {
  const onList = new Set(items.map((i) => learnKey(i.name)));
  const fromHistory = Object.entries(buyStats)
    .filter(([k, v]) => v && typeof v.n === "string" && !onList.has(k))
    .sort((a, b) => (b[1].c || 0) - (a[1].c || 0) || (b[1].t || 0) - (a[1].t || 0))
    .map(([, v]) => v.n);
  const starters = STARTERS.filter((n) => !onList.has(learnKey(n)) && !fromHistory.includes(n));
  const names = [...fromHistory, ...starters].slice(0, 10);

  $("sugg").hidden = names.length === 0;
  $("sugg-row").replaceChildren(...names.map((n) => {
    const cat = categoryById(classify(n));
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sugg";
    b.append(tileEl(cat, 16), document.createTextNode(n));
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
  const c = catOf(item);
  $("edit-cat").replaceChildren(tileEl(c, 18), document.createTextNode(c.name));
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
$("edit-delete").addEventListener("click", () => {
  if (!editing) return;
  deleteDoc(doc(itemsRef, editing.id)).catch(() => setStatus("לא הצלחתי למחוק", true));
  editDialog.close();
});

// ---- Who am I (shown on items I add) ----
const nameDialog = $("name-dialog");
function askName() { $("name-input").value = me; nameDialog.showModal(); }
$("greeting").addEventListener("click", askName);
$("greeting").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") askName(); });
$("name-form").addEventListener("submit", (e) => {
  e.preventDefault();
  me = $("name-input").value.trim().slice(0, 20);
  try { localStorage.setItem("me", me); } catch {}
  renderGreeting();
  nameDialog.close();
});
$("name-skip").addEventListener("click", () => {
  try { localStorage.setItem("meSkipped", "1"); } catch {}
  nameDialog.close();
});
try {
  if (!me && localStorage.getItem("meSkipped") !== "1") setTimeout(askName, 900);
} catch {}

$("all-done-clear").addEventListener("click", () => $("clear-done").click());
$("clear-done").addEventListener("click", async () => {
  const ids = items.filter((i) => i.checked).map((i) => i.id);
  if (!ids.length || !confirm("למחוק את כל המוצרים שכבר בעגלה?")) return;
  try {
    const batch = writeBatch(db);
    ids.forEach((id) => batch.delete(doc(itemsRef, id)));
    await batch.commit();
  } catch (err) {
    console.error(err);
    setStatus("לא הצלחתי לנקות", true);
  }
});

// ---- Themes (shared through prefs; localStorage avoids a flash of the default) ----
const THEMES = [
  { id: "mint", name: "מנטה", color: "#5CF2C0" },
  { id: "violet", name: "סגול", color: "#A58BFF" },
  { id: "coral", name: "אלמוג", color: "#FF6B8A" },
  { id: "sky", name: "תכלת", color: "#4CC9F0" },
  { id: "amber", name: "ענבר", color: "#FFC46B" },
];
function applyTheme(id) {
  const t = THEMES.find((x) => x.id === id) || THEMES[0];
  document.documentElement.dataset.theme = t.id;
  try { localStorage.setItem("theme", t.id); } catch {}
  document.querySelectorAll(".swatch").forEach((b) => b.setAttribute("aria-pressed", b.dataset.id === t.id));
}
try { applyTheme(localStorage.getItem("theme")); } catch { applyTheme(); }

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
applyTheme(document.documentElement.dataset.theme);
$("theme-btn").addEventListener("click", () => $("theme-dialog").showModal());

// ---- Connect devices: WhatsApp link, copy, QR ----
function openConnect() {
  const url = location.href;
  $("wa").href = "https://wa.me/?text=" + encodeURIComponent("הנה העגלה המשפחתית שלנו\n" + url);
  const qrBox = $("qr");
  try {
    const qr = qrcode(0, "M");
    qr.addData(url); qr.make();
    qrBox.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); // library-generated SVG of our own URL
    qrBox.hidden = false;
  } catch { qrBox.hidden = true; }
  $("connect-dialog").showModal();
}
$("share").addEventListener("click", openConnect);

// ---- "Add to home screen" ----
let installPrompt = null;
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installPrompt = e; });
const isStandalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
if (isStandalone) $("install-btn").hidden = true;
$("install-btn").addEventListener("click", async () => {
  const help = $("install-help");
  if (installPrompt) {
    installPrompt.prompt();
    await installPrompt.userChoice.catch(() => {});
    installPrompt = null;
    return;
  }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  help.textContent = ios
    ? "באייפון: לחצו על כפתור השיתוף (ריבוע עם חץ) בתחתית Safari, גללו ובחרו \"הוסף למסך הבית\"."
    : "באנדרואיד: לחצו על שלוש הנקודות בדפדפן Chrome ובחרו \"הוסף למסך הבית\" או \"התקן אפליקציה\".";
  help.hidden = false;
});
$("copy-link").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(location.href); $("copy-link").textContent = "הועתק ✓"; }
  catch { $("copy-link").textContent = "לא הצלחתי להעתיק"; }
  setTimeout(() => { $("copy-link").textContent = "העתק קישור"; }, 2000);
});

// One-time hint: the link is what joins devices together.
let hintSeen = false;
try { hintSeen = localStorage.getItem("hintSeen") === "1"; } catch {}
$("hint").hidden = hintSeen;
const dismissHint = () => { $("hint").hidden = true; try { localStorage.setItem("hintSeen", "1"); } catch {} };
$("hint-x").addEventListener("click", dismissHint);
$("hint-go").addEventListener("click", () => { dismissHint(); openConnect(); });

// ---- Light / dark switch (stored per device; system setting is the default) ----
const modeBtn = $("mode");
const isDark = () => (document.documentElement.dataset.mode || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")) === "dark";
const syncMode = () => modeBtn.setAttribute("aria-checked", String(isDark()));
syncMode();
modeBtn.addEventListener("click", () => {
  const next = isDark() ? "light" : "dark";
  document.documentElement.dataset.mode = next;
  try { localStorage.setItem("mode", next); } catch {}
  syncMode();
});

// ---- Intro loader: a short 0-100% count, once per session ----
(function boot() {
  const el = $("boot");
  let seen = false;
  try { seen = sessionStorage.getItem("booted") === "1"; sessionStorage.setItem("booted", "1"); } catch {}
  if (seen || matchMedia("(prefers-reduced-motion: reduce)").matches) { el.remove(); return; }
  const t0 = performance.now(), dur = 1100;
  (function f(t) {
    const k = Math.min(1, (t - t0) / dur);
    $("boot-n").textContent = Math.round((1 - Math.pow(1 - k, 3)) * 100) + "%";
    if (k < 1) requestAnimationFrame(f);
    else { el.classList.add("out"); setTimeout(() => el.remove(), 700); }
  })(t0);
})();
