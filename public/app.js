import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, setDoc,
  onSnapshot, query, orderBy, writeBatch,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { CATEGORIES, DEFAULT_ORDER, categoryById, classify, normalizeOrder, setLearned, rememberLocally } from "./categories.js";
import { parseItems } from "./parse.js";

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
const db = getFirestore(initializeApp(firebaseConfig));
const itemsRef = collection(db, "carts", cartId, "items");
const prefsRef = doc(db, "carts", cartId, "settings", "prefs");
const learnedRef = doc(db, "carts", cartId, "settings", "learned");

// ---- State ----
let items = [];
let order = [...DEFAULT_ORDER];

const catOf = (item) => categoryById(item.category || classify(item.name));

// ---- Render ----
function renderItem(item) {
  const cat = catOf(item);
  const li = document.createElement("li");
  li.className = item.checked ? "done" : "";
  li.style.setProperty("--h", cat.hue);

  const box = document.createElement("input");
  box.type = "checkbox";
  box.id = "c-" + item.id;
  box.checked = item.checked;
  box.setAttribute("aria-label", item.name);
  box.addEventListener("change", () => {
    updateDoc(doc(itemsRef, item.id), { checked: box.checked })
      .catch(() => setStatus("לא הצלחתי לעדכן, בדוק חיבור לאינטרנט", true));
  });

  const tile = document.createElement("button");
  tile.type = "button";
  tile.className = "tile";
  tile.textContent = cat.emoji;
  tile.setAttribute("aria-label", `מחלקה: ${cat.name}. לחץ לשינוי`);
  tile.addEventListener("click", () => openPicker(item));

  const label = document.createElement("label");
  label.htmlFor = box.id;
  const name = document.createElement("span");
  name.className = "name";
  name.textContent = item.name; // textContent: never HTML
  label.append(name);

  const del = document.createElement("button");
  del.type = "button";
  del.className = "del";
  del.setAttribute("aria-label", "מחק " + item.name);
  del.textContent = "✕";
  del.addEventListener("click", () => {
    deleteDoc(doc(itemsRef, item.id))
      .catch(() => setStatus("לא הצלחתי למחוק", true));
  });

  li.append(box, tile, label, del);
  return li;
}

function render() {
  const todo = items.filter((i) => !i.checked);
  const done = items.filter((i) => i.checked);

  // Group the to-do items by section, in the store-walking order.
  const groups = order
    .map((id) => ({ cat: categoryById(id), items: todo.filter((i) => catOf(i).id === id) }))
    .filter((g) => g.items.length);

  $("list").replaceChildren(...groups.map((g) => {
    const section = document.createElement("section");
    section.className = "group";
    section.style.setProperty("--h", g.cat.hue);
    const h = document.createElement("h3");
    h.textContent = `${g.cat.emoji} ${g.cat.name} `;
    const count = document.createElement("span");
    count.className = "count";
    count.textContent = g.items.length;
    h.append(count);
    const ul = document.createElement("ul");
    ul.append(...g.items.map(renderItem));
    section.append(h, ul);
    return section;
  }));

  $("done-list").replaceChildren(...done.map(renderItem));
  $("done-count").textContent = done.length ? `(${done.length})` : "";
  $("done-section").hidden = done.length === 0;
  $("empty").hidden = items.length > 0;
  updateHero(todo.length, done.length);
}

const RING_LEN = 226.2; // 2 * PI * r(36)

function updateHero(todoN, doneN) {
  const total = todoN + doneN;
  $("ring-fg").style.strokeDashoffset = RING_LEN * (1 - (total ? doneN / total : 0));
  $("ring-num").textContent = total ? `${doneN}/${total}` : "0";
  $("ring-of").textContent = total ? "בעגלה" : "";
  $("summary").textContent = !total ? "הרשימה ריקה, בואו נתחיל" :
    todoN ? `${todoN} נשארו לקחת · ${doneN} כבר בעגלה` : "הכול בעגלה, כל הכבוד! 🎉";

  // Celebrate the moment the last item gets checked off (not on first load).
  if (prevTodo !== null && prevTodo > 0 && todoN === 0 && total > 0) confetti();
  prevTodo = todoN;
}
let prevTodo = null;

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "לילה טוב" : h < 12 ? "בוקר טוב" : h < 17 ? "צהריים טובים" : h < 21 ? "ערב טוב" : "לילה טוב";
}
$("greeting").textContent = greeting() + " 👋";

function confetti() {
  const box = $("confetti");
  const glyphs = ["🎉", "✨", "🥕", "🍎", "🥛", "🍞", "⭐", "🧀"];
  for (let i = 0; i < 36; i++) {
    const p = document.createElement("span");
    p.className = "piece";
    p.textContent = glyphs[i % glyphs.length];
    p.style.left = Math.random() * 100 + "%";
    p.style.setProperty("--dx", (Math.random() * 160 - 80) + "px");
    p.style.setProperty("--rot", (Math.random() * 900 - 450) + "deg");
    p.style.setProperty("--dur", (2 + Math.random() * 1.6) + "s");
    p.style.animationDelay = Math.random() * 0.5 + "s";
    box.append(p);
    setTimeout(() => p.remove(), 4500);
  }
}

onSnapshot(
  query(itemsRef, orderBy("createdAt")),
  (snap) => {
    items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    render();
  },
  (err) => {
    console.error(err);
    setStatus("אין חיבור לעגלה. בדוק אינטרנט והרשאות (firestore.rules).", true);
  },
);

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
    b.style.setProperty("--h", c.hue);
    b.textContent = `${c.emoji} ${c.name}`;
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
    li.style.setProperty("--h", c.hue);
    const label = document.createElement("span");
    label.textContent = `${c.emoji} ${c.name}`;
    const up = document.createElement("button");
    up.type = "button"; up.textContent = "↑"; up.disabled = idx === 0;
    up.setAttribute("aria-label", `הזז למעלה: ${c.name}`);
    up.addEventListener("click", () => moveCategory(idx, -1));
    const down = document.createElement("button");
    down.type = "button"; down.textContent = "↓"; down.disabled = idx === order.length - 1;
    down.setAttribute("aria-label", `הזז למטה: ${c.name}`);
    down.addEventListener("click", () => moveCategory(idx, 1));
    li.append(label, up, down);
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

$("add-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = addInput.value;
  const names = parseItems(text);
  if (!names.length) return;

  // Skip things that are already waiting on the list.
  const waiting = new Set(items.filter((i) => !i.checked).map((i) => i.name.trim().toLowerCase()));
  const fresh = names.filter((n) => !waiting.has(n.toLowerCase()));
  addInput.value = "";
  autoGrow();
  addInput.focus();
  if (!fresh.length) return flash("כבר יש את זה ברשימה");

  setStatus("");
  try {
    const batch = writeBatch(db);
    const now = Date.now();
    fresh.forEach((name, i) => {
      batch.set(doc(itemsRef), { name, checked: false, createdAt: now + i, category: classify(name) });
    });
    await batch.commit();
    const skipped = names.length - fresh.length;
    if (fresh.length > 1 || skipped) {
      const added = fresh.length === 1 ? "נוסף מוצר אחד" : `נוספו ${fresh.length} מוצרים`;
      flash(`${added} ✓` + (skipped ? ` (${skipped} כבר היו ברשימה)` : ""));
    }
  } catch (err) {
    console.error(err);
    addInput.value = text;
    autoGrow();
    setStatus("לא הצלחתי להוסיף, נסה שוב", true);
  }
});

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
  { id: "coral", name: "אלמוג", css: "linear-gradient(135deg,#e14b36,#ff9d5e)", meta: "#e8563f" },
  { id: "pink", name: "ורוד", css: "linear-gradient(135deg,#c02a72,#ff8bb8)", meta: "#d6367f" },
  { id: "violet", name: "סגול", css: "linear-gradient(135deg,#5a3ecf,#a98cff)", meta: "#6c4ce0" },
  { id: "ocean", name: "כחול", css: "linear-gradient(135deg,#0e62b0,#52c6f7)", meta: "#1479c9" },
  { id: "sun", name: "שמש", css: "linear-gradient(135deg,#e07a08,#ffc93c)", meta: "#d9820b" },
  { id: "forest", name: "ירוק", css: "linear-gradient(135deg,#1a6b4f,#38b98f)", meta: "#1f7a5a" },
];
function applyTheme(id) {
  const t = THEMES.find((x) => x.id === id) || THEMES[0];
  document.documentElement.dataset.theme = t.id;
  document.querySelector('meta[name="theme-color"]').content = t.meta;
  try { localStorage.setItem("theme", t.id); } catch {}
  document.querySelectorAll(".swatch").forEach((b) => b.setAttribute("aria-pressed", b.dataset.id === t.id));
}
try { applyTheme(localStorage.getItem("theme")); } catch { applyTheme(); }

$("swatches").replaceChildren(...THEMES.map((t) => {
  const b = document.createElement("button");
  b.type = "button"; b.className = "swatch"; b.dataset.id = t.id;
  b.style.background = t.css; b.setAttribute("aria-label", t.name);
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
  $("wa").href = "https://wa.me/?text=" + encodeURIComponent("הנה העגלה המשפחתית שלנו 🛒\n" + url);
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
