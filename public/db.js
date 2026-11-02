// The one place that decides what "the database" is.
// Normal load: the real Firestore SDK. Open the page as "#demo" and it is an in-memory fake
// (demo-store.js) instead, so nothing is read from or written to a real cart.
import { firebaseConfig } from "./firebase-config.js";

const SDK = "https://www.gstatic.com/firebasejs/10.14.1/";

export const DEMO = location.hash === "#demo";

let fs, app;
if (DEMO) fs = await import("./demo-store.js");
else [fs, app] = await Promise.all([import(SDK + "firebase-firestore.js"), import(SDK + "firebase-app.js")]);

export const {
  collection, doc, addDoc, updateDoc, deleteDoc, setDoc,
  onSnapshot, query, orderBy, writeBatch, increment, deleteField,
} = fs;

export const db = DEMO ? fs.getFirestore() : fs.getFirestore(app.initializeApp(firebaseConfig));
