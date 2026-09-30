# העגלה המשפחתית (Family Cart)

Shared family shopping list. Static site (no build step, in `public/`) + Firebase Firestore for realtime sync.
Access = the long random cart id in the URL hash (`index.html#<32 hex>`); no login.

## Features
- Add / check off / delete items, synced live between family members
- Items auto-sorted into supermarket sections (`public/categories.js`); tap an item's emoji to change its section
- "סדר הסופר": the family re-orders sections to match their store; saved per cart

## Run locally
```
cd public && python3 -m http.server 8000   # http://localhost:8000
```

## Deploy (Firebase Hosting + rules)
```
npx firebase-tools login          # one-time, opens browser
npx firebase-tools deploy         # publishes public/ and firestore.rules
```
Project id is in `.firebaserc`. After deploy, open the site URL once and share the cart link (with `#...`) on WhatsApp.

## Roadmap
1. Shared cart (done)
2. Auto-sort by supermarket section (done; order editable)
3. Price estimate + compare stores (Israeli chains publish price files)
