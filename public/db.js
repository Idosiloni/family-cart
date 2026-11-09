// The one place that decides what "the database" is.
// Normal load: the real Firestore SDK. Open the page as "#demo" and it is an in-memory fake
// (demo-store.js) instead, so nothing is read from or written to a real cart.
import { firebaseConfig } from "./firebase-config.js";

const SDK = "https://www.gstatic.com/firebasejs/10.14.1/";

// The installed app (home-screen icon) never runs the demo: an icon that was added while the demo was open
// would otherwise start on "#demo" forever. In that case drop the hash and open the family's own cart.
const installed = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
if (installed && location.hash === "#demo") history.replaceState(null, "", location.pathname);
export const DEMO = location.hash === "#demo";

let fs, app;
if (DEMO) fs = await import("./demo-store.js");
else [fs, app] = await Promise.all([import(SDK + "firebase-firestore.js"), import(SDK + "firebase-app.js")]);

export const {
  collection, doc, addDoc, updateDoc, deleteDoc, setDoc, getDoc,
  onSnapshot, query, orderBy, writeBatch, increment, deleteField,
} = fs;

export const db = DEMO ? fs.getFirestore() : fs.getFirestore(app.initializeApp(firebaseConfig));
