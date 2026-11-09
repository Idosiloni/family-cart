// The "our products" tab: everything the family has added before, pinned favourites first.
// One tap adds a product to the list; tapping its name opens pin / section / price / remove.
import { learnKey, classify, categoryById } from "./categories.js";
import { matchKey } from "./names.js";
import { listRegulars, listStarters, missingPinned } from "./regulars.js";

export function initRegulars(ctx) {
  const { $, icon } = ctx;
  const view = $("view-regulars");
  const body = $("reg-body");
  const search = $("reg-search");
  const dialog = $("reg-dialog");
  let open = null; // the product the dialog is about: { key, name, count, pinned }

  const onListKeys = () => new Set(ctx.items.map((i) => matchKey(i.name)));
  const sectionOf = (name) => categoryById(classify(name));

  function row(r, onList) {
    const li = document.createElement("li");
    li.className = "reg-row";

    const main = document.createElement("button");
    main.type = "button";
    main.className = "reg-main";
    main.setAttribute("aria-label", "אפשרויות ל" + r.name);
    const name = document.createElement("span");
    name.className = "name";
    if (r.pinned) {
      const pin = document.createElement("span");
      pin.className = "pin";
      pin.append(icon("star", 14));
      name.append(pin);
    }
    name.append(document.createTextNode(r.name));
    const sub = document.createElement("span");
    sub.className = "meta";
    const parts = [];
    if (r.count) parts.push(r.count === 1 ? "נקנה פעם אחת" : `נקנה ${r.count} פעמים`);
    parts.push(sectionOf(r.name).name);
    const price = ctx.prices?.describe(r.name);
    if (price) parts.push(price);
    sub.textContent = parts.join(" · ");
    main.append(name, sub);
    main.addEventListener("click", () => openDialog(r));

    const add = document.createElement("button");
    add.type = "button";
    add.className = "add-chip" + (onList ? " on" : "");
    add.setAttribute("aria-label", onList ? r.name + " כבר ברשימה" : "הוספת " + r.name + " לרשימה");
    add.disabled = onList;
    if (onList) add.append(icon("check", 16), document.createTextNode("ברשימה"));
    else add.append(icon("plus", 16));
    add.addEventListener("click", () => ctx.addNames([r.name]));

    li.append(main, add);
    return li;
  }

  function group(title, rows, onList) {
    if (!rows.length) return [];
    const head = document.createElement("div");
    head.className = "sec-title";
    head.textContent = title;
    const card = document.createElement("div");
    card.className = "card";
    const ul = document.createElement("ul");
    ul.append(...rows.map((r) => row(r, onList.has(matchKey(r.name)))));
    card.append(ul);
    return [head, card];
  }

  function refresh() {
    if (view.hidden) return;
    const onList = onListKeys();
    const q = search.value.trim().toLowerCase();
    const hit = (n) => !q || n.toLowerCase().includes(q);
    const mine = listRegulars(ctx.stats).filter((r) => hit(r.name));
    const pinned = mine.filter((r) => r.pinned);
    const rest = mine.filter((r) => !r.pinned);
    const starters = listStarters(ctx.stats).filter(hit).map((n) => ({ key: learnKey(n), name: n, count: 0, pinned: false, starter: true }));

    $("reg-add-pinned").hidden = missingPinned(ctx.stats, onList).length === 0;

    const nodes = [
      ...group("קבועים", pinned, onList),
      ...group(pinned.length ? "שאר המוצרים" : "המוצרים שלנו", rest, onList),
      ...group(mine.length ? "הצעות" : "הצעות להתחלה", starters, onList),
    ];
    if (!nodes.length) {
      const p = document.createElement("p");
      p.className = "hint-line";
      p.textContent = q ? "לא נמצא מוצר בשם הזה." : "עוד אין מוצרים. כל מה שתוסיפו לרשימה יישמר כאן.";
      nodes.push(p);
    }
    body.replaceChildren(...nodes);
  }
  search.addEventListener("input", refresh);

  $("reg-add-pinned").addEventListener("click", () => {
    const names = missingPinned(ctx.stats, onListKeys()).map((r) => r.name);
    if (names.length) ctx.addNames(names);
  });

  // ---- One product: pin, section, price, remove ----
  function openDialog(r) {
    open = r;
    $("reg-title").textContent = r.name;
    $("reg-sub").textContent = r.count ? (r.count === 1 ? "נקנה פעם אחת" : `נקנה ${r.count} פעמים`) : "הצעה, עוד לא נקנתה";
    $("reg-cat").replaceChildren(document.createTextNode(sectionOf(r.name).name));
    $("reg-price").replaceChildren(document.createTextNode(ctx.prices?.describe(r.name) || "הוספת מחיר"));
    $("reg-pin").textContent = r.pinned ? "ביטול קיבוע" : "קיבוע לקבועים";
    dialog.showModal();
  }

  // Always send the name too: a starter that is not in the database yet becomes an entry the first time it is touched.
  const write = (patch) => ctx.save({ [open.key]: { n: open.name, ...patch } }).catch(() => ctx.setStatus("לא הצלחתי לשמור", true));

  $("reg-pin").addEventListener("click", () => {
    write({ p: !open.pinned, x: false });
    dialog.close();
  });
  $("reg-cat").addEventListener("click", () => {
    const r = open;
    dialog.close();
    ctx.openCategoryPicker(r.name, sectionOf(r.name).id, () => refresh());
  });
  $("reg-price").addEventListener("click", () => {
    const r = open;
    dialog.close();
    ctx.prices.openPriceDialog(r.name);
  });
  $("reg-remove").addEventListener("click", () => {
    const r = open;
    write({ x: true, p: false });
    dialog.close();
    ctx.toast(`${r.name} הוסר מהמוצרים שלנו`, {
      label: "ביטול",
      run: () => ctx.save({ [r.key]: { n: r.name, x: false, p: r.pinned } }).catch(() => ctx.setStatus("לא הצלחתי לשחזר", true)),
    });
  });

  return { refresh };
}
