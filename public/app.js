import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, setDoc,
  onSnapshot, query, orderBy, writeBatch,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { CATEGORIES, DEFAULT_ORDER, categoryById, classify, normalizeOrder } from "./categories.js";

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

// ---- State ----
let items = [];
let order = [...DEFAULT_ORDER];

const catOf = (item) => categoryById(item.category || classify(item.name));

// ---- Render ----
function renderItem(item) {
  const li = document.createElement("li");
  li.className = item.checked ? "done" : "";

  const label = document.createElement("label");
  const box = document.createElement("input");
  box.type = "checkbox";
  box.checked = item.checked;
  box.addEventListener("change", () => {
    updateDoc(doc(itemsRef, item.id), { checked: box.checked })
      .catch(() => setStatus("לא הצלחתי לעדכן, בדוק חיבור לאינטרנט", true));
  });
  const name = document.createElement("span");
  name.className = "name";
  name.textContent = item.name; // textContent: never HTML
  label.append(box, name);

  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "chip";
  chip.textContent = catOf(item).emoji;
  chip.setAttribute("aria-label", `קטגוריה: ${catOf(item).name}. לחץ לשינוי`);
  chip.addEventListener("click", () => openPicker(item));

  const del = document.createElement("button");
  del.type = "button";
  del.className = "del";
  del.setAttribute("aria-label", "מחק " + item.name);
  del.textContent = "✕";
  del.addEventListener("click", () => {
    deleteDoc(doc(itemsRef, item.id))
      .catch(() => setStatus("לא הצלחתי למחוק", true));
  });

  li.append(label, chip, del);
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
    const h = document.createElement("h3");
    h.textContent = `${g.cat.emoji} ${g.cat.name}`;
    const ul = document.createElement("ul");
    ul.append(...g.items.map(renderItem));
    section.append(h, ul);
    return section;
  }));

  $("done-list").replaceChildren(...done.map(renderItem));
  $("done-count").textContent = done.length ? `(${done.length})` : "";
  $("done-section").hidden = done.length === 0;
  $("empty").hidden = items.length > 0;
  $("progress-bar").style.width = items.length ? `${(done.length / items.length) * 100}%` : "0";
  $("summary").textContent = !items.length ? "" :
    todo.length ? `${todo.length} נשארו לקחת · ${done.length} כבר בעגלה` : "הכול בעגלה 🎉";
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

onSnapshot(prefsRef, (snap) => {
  order = normalizeOrder(snap.exists() ? snap.data().order : null);
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
    b.textContent = `${c.emoji} ${c.name}`;
    b.addEventListener("click", () => {
      updateDoc(doc(itemsRef, item.id), { category: c.id })
        .catch(() => setStatus("לא הצלחתי לעדכן קטגוריה", true));
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
  setDoc(prefsRef, { order: next })
    .catch(() => setStatus("לא הצלחתי לשמור את הסדר", true));
}

$("order-btn").addEventListener("click", () => { renderOrderDialog(); orderDialog.showModal(); });
$("order-reset").addEventListener("click", () => {
  order = [...DEFAULT_ORDER];
  renderOrderDialog();
  render();
  setDoc(prefsRef, { order }).catch(() => setStatus("לא הצלחתי לשמור את הסדר", true));
});

// Close dialogs on close-button or backdrop click.
document.querySelectorAll("dialog").forEach((d) => {
  d.addEventListener("click", (e) => { if (e.target === d || e.target.closest("[data-close]")) d.close(); });
});

// ---- Actions ----
$("add-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = $("add-input");
  const name = input.value.trim().slice(0, 80);
  if (!name) return;
  input.value = "";
  input.focus();
  setStatus("");
  try {
    await addDoc(itemsRef, { name, checked: false, createdAt: Date.now(), category: classify(name) });
  } catch (err) {
    console.error(err);
    input.value = name;
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

$("share").addEventListener("click", async () => {
  const url = location.href;
  try {
    if (navigator.share) await navigator.share({ title: "העגלה המשפחתית", url });
    else { await navigator.clipboard.writeText(url); setStatus("הקישור הועתק ✓"); }
  } catch { /* user cancelled share */ }
});
