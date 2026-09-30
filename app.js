import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore, collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, writeBatch,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

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

  const del = document.createElement("button");
  del.type = "button";
  del.className = "del";
  del.setAttribute("aria-label", "מחק " + item.name);
  del.textContent = "✕";
  del.addEventListener("click", () => {
    deleteDoc(doc(itemsRef, item.id))
      .catch(() => setStatus("לא הצלחתי למחוק", true));
  });

  li.append(label, del);
  return li;
}

let doneIds = [];

onSnapshot(
  query(itemsRef, orderBy("createdAt")),
  (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const todo = items.filter((i) => !i.checked);
    const done = items.filter((i) => i.checked);
    doneIds = done.map((i) => i.id);

    $("list").replaceChildren(...todo.map(renderItem));
    $("done-list").replaceChildren(...done.map(renderItem));
    $("done-count").textContent = done.length ? `(${done.length})` : "";
    $("done-section").hidden = done.length === 0;
    setStatus(items.length ? "" : "העגלה ריקה. הוסף את המוצר הראשון 👆");
  },
  (err) => {
    console.error(err);
    setStatus("אין חיבור לעגלה. בדוק אינטרנט והרשאות (firestore.rules).", true);
  },
);

// ---- Actions ----
$("add-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = $("add-input");
  const name = input.value.trim().slice(0, 80);
  if (!name) return;
  input.value = "";
  input.focus();
  try {
    await addDoc(itemsRef, { name, checked: false, createdAt: Date.now() });
  } catch (err) {
    console.error(err);
    input.value = name;
    setStatus("לא הצלחתי להוסיף, נסה שוב", true);
  }
});

$("clear-done").addEventListener("click", async () => {
  if (!doneIds.length || !confirm("למחוק את כל המוצרים שכבר בעגלה?")) return;
  try {
    const batch = writeBatch(db);
    doneIds.forEach((id) => batch.delete(doc(itemsRef, id)));
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
