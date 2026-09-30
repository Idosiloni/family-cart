# העגלה המשפחתית (Family Cart)

Shared family shopping list. Static site (no build step) + Firebase Firestore for realtime sync.
Access = the long random cart id in the URL hash (`index.html#<32 hex>`); no login.

## Setup
1. Firebase console → create project → Build → Firestore Database → Create (production mode).
2. Firestore → Rules → paste `firestore.rules` → Publish.
3. Project settings → Your apps → Web (`</>`) → copy config into `firebase-config.js`.
4. Run locally: `python3 -m http.server 8000` → open http://localhost:8000
5. Deploy: Firebase Hosting or any static host. Share the cart link on WhatsApp once.

## Roadmap
1. Shared cart: add / check off / delete (this slice)
2. Auto-sort by supermarket aisle
3. Price estimate + compare stores
