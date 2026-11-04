// The prices tab: what the current list would cost at each chain, the family's own prices and receipts,
// and a short directory of Israeli chains. The maths lives in pricing.js (pure, tested); this file is only screens.
import { matchProduct, compareStores, receiptStats, priceKey } from "./pricing.js";
import { STORES, SURVEYS, storeById } from "./stores.js";

const money = (n) => "₪" + (Number.isInteger(n) ? n : n.toFixed(2));

function h(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
const num = (text, cls = "") => h("span", ("num " + cls).trim(), text);

export function initPrices(ctx) {
  const { $ } = ctx;
  const body = $("prices-body");
  let data = null; // public/prices.json: real shelf prices for a reference basket, from the chains' published price files

  fetch("prices.json").then((r) => r.json()).then((d) => { data = d; refresh(); }).catch(() => { data = null; });

  // ---- Which chains are compared: the ones with published prices, plus any the family added ----
  const fileChains = () => (data?.chains || []).map((c) => ({ id: c.id, name: c.name, branch: c.branch, custom: false, optional: !!c.optional }));
  const allChains = () => [...fileChains(), ...ctx.storeCfg.custom.map((c) => ({ id: c.id, name: c.n, custom: true }))];
  const selected = () => {
    const sel = ctx.storeCfg.sel;
    // Default: the chains with published prices, except "optional" ones (their branch file has no fresh produce).
    return allChains().filter((c) => (sel ? sel.includes(c.id) : !c.custom && !c.optional));
  };
  const chainName = (id) => allChains().find((c) => c.id === id)?.name || storeById(id)?.name || (id === "other" ? "אחר" : id);

  const todo = () => ctx.items.filter((i) => !i.checked);
  const compare = () => compareStores({
    items: todo().map((i) => ({ name: i.name, qty: i.qty || 1 })),
    products: data?.products || [],
    userPrices: ctx.userPrices,
    chains: selected().map((c) => ({ id: c.id, name: c.name })),
  });

  // Unit price of a product at every known chain: what the family typed wins over the file price.
  function unitPrices(name) {
    const product = data ? matchProduct(name, data.products) : null;
    const mine = ctx.userPrices[priceKey(name)] || {};
    const out = {};
    for (const c of allChains()) {
      const v = mine[c.id] ?? product?.prices?.[c.id];
      if (typeof v === "number") out[c.id] = v;
    }
    return { product, mine, out };
  }

  // "₪6.40 at Carrefour" for the cheapest known price, or "" when nothing is known.
  function describe(name) {
    const sel = new Set(selected().map((c) => c.id));
    const entries = Object.entries(unitPrices(name).out).filter(([id]) => sel.has(id));
    if (!entries.length) return "";
    const [id, v] = entries.sort((a, b) => a[1] - b[1])[0];
    return `${money(v)}${unitPrices(name).product?.kg ? " לק״ג" : ""} ב${chainName(id)}`;
  }

  // ---- The one-line estimate on the list tab ----
  function renderLine() {
    const line = $("price-line");
    const r = data && todo().length ? compare() : null;
    if (!r || !r.rows.length || !r.comparableCount) { line.hidden = true; return; }
    const best = [...r.rows].sort((a, b) => a.total - b.total)[0];
    const main = h("span");
    const b = h("b");
    b.append(num(money(best.total)));
    main.append(r.rows.length > 1 ? `הכי זול: ${best.name}, ` : `${best.name}: `, b);
    line.replaceChildren(main, h("span", "mut", `${r.comparableCount} מתוך ${todo().length} מוצרים ›`));
    line.hidden = false;
  }
  $("price-line").addEventListener("click", () => ctx.setView("prices"));

  // ---- The tab ----
  function panel(title, sub) {
    const p = h("section", "panel");
    p.append(h("h2", "", title));
    if (sub !== undefined) p.append(h("p", "sub", sub));
    return p;
  }

  function renderCompare() {
    const p = panel("כמה זה יעלה", "");
    const r = compare();
    const n = todo().length;
    const sub = p.querySelector(".sub");

    if (!data) { sub.textContent = "טוען מחירים…"; return p; }
    if (!n) { sub.textContent = "הרשימה ריקה. הוסיפו מוצרים ונחשב כמה הם עולים בכל רשת."; }
    else if (!r.comparableCount) { sub.textContent = "עוד אין מוצר ברשימה שיש לו מחיר בכל הרשתות שנבחרו. אפשר להזין מחירים בעצמכם, או לצמצם את הרשתות."; }
    else { sub.textContent = `מחושב על ${r.comparableCount} מתוך ${n} מוצרים, אלה שיש להם מחיר בכל הרשתות שנבחרו.`; }

    if (r.comparableCount) {
      const rows = [...r.rows].sort((a, b) => a.total - b.total);
      const best = rows[0].total;
      const list = h("div", "rank");
      rows.forEach((row, i) => {
        const el = h("div", "rank-row" + (i === 0 ? " best" : ""));
        const store = h("span", "store", row.name);
        if (i === 0 && rows.length > 1) store.append(h("span", "badge", "הכי זול"));
        const branch = allChains().find((c) => c.id === row.chainId)?.branch;
        if (branch) store.append(h("small", "", branch));
        const total = h("span", "total");
        total.append(num(money(row.total)));
        el.append(store, total);
        if (i > 0) { const d = h("span", "diff"); d.append("יקר ב-", num(money(Math.round((row.total - best) * 100) / 100))); el.append(d); }
        list.append(el);
      });
      p.append(list);
    }
    const pick = h("button", "link-btn", "בחירת רשתות להשוואה");
    pick.type = "button";
    pick.addEventListener("click", openStores);
    p.append(pick);
    if (r.estimatedCount) p.append(h("p", "fine", `כולל ${r.estimatedCount} פירות וירקות שנמכרים לפי משקל: חושבו לפי משקל משוער, כך שהסכום הוא הערכה.`));
    p.append(h("p", "fine", `מחירי מדף מסניף אחד בכל רשת, ללא מבצעים והנחות מועדון` + (data.asOf ? `, נכון ל-${new Date(data.asOf).toLocaleDateString("he-IL")}` : "") + ". המחיר בקופה יכול להיות שונה."));
    return p;
  }

  function renderMissing() {
    const r = data && todo().length ? compare() : null;
    if (!r) return [];
    const names = [...new Set([...(r.unpriced || []), ...(r.partial || [])])];
    if (!names.length) return [];
    const p = panel("מוצרים בלי מחיר", "הוסיפו מחיר ונכלול אותם בהשוואה.");
    const ul = h("ul", "price-list");
    names.slice(0, 8).forEach((name) => {
      const li = h("li");
      li.append(h("span", "nm", name));
      const b = h("button", "link-btn", "הוספת מחיר");
      b.type = "button";
      b.addEventListener("click", () => openPriceDialog(name));
      li.append(b);
      ul.append(li);
    });
    p.append(ul);
    if (names.length > 8) p.append(h("p", "fine", `ועוד ${names.length - 8}`));
    return [p];
  }

  function renderReceipts() {
    const p = panel("הקבלות שלנו", "מה שילמתם בפועל בכל סופר. אחרי כמה קניות רואים איפה יוצא זול יותר.");
    const add = h("button", "btn small ghost", "הוספת קבלה");
    add.type = "button";
    add.addEventListener("click", () => openReceipt({}));
    p.append(add);

    const list = ctx.receipts;
    if (list.length) {
      const ul = h("ul", "price-list");
      ul.style.marginTop = "10px";
      list.slice(0, 5).forEach((r) => {
        const li = h("li");
        const nm = h("span", "nm");
        nm.append(chainName(r.storeId), " ", h("span", "mut", new Date(r.t).toLocaleDateString("he-IL", { day: "numeric", month: "numeric" }) + (r.items ? ` · ${r.items} מוצרים` : "")));
        const tot = h("b"); tot.append(num(money(r.total)));
        const del = h("button", "icon-btn small");
        del.type = "button";
        del.setAttribute("aria-label", "מחיקת קבלה");
        del.append(ctx.icon("close", 16));
        del.addEventListener("click", () => {
          const { id, ...copy } = r;
          ctx.deleteReceipt(id).catch(() => ctx.setStatus("לא הצלחתי למחוק", true));
          ctx.toast("הקבלה נמחקה", { label: "ביטול", run: () => ctx.addReceipt(copy).catch(() => {}) });
        });
        li.append(nm, tot, del);
        ul.append(li);
      });
      p.append(ul);

      const stats = receiptStats(list);
      const rows = Object.entries(stats).filter(([, s]) => s.n >= 1);
      if (rows.length > 1) {
        const box = h("div", "stats");
        rows.sort((a, b) => (a[1].avgPerItem ?? Infinity) - (b[1].avgPerItem ?? Infinity)).forEach(([id, s]) => {
          const d = h("div");
          d.append(h("span", "", `${chainName(id)} · ${s.n} קניות`));
          const v = h("span", "mut");
          v.append("ממוצע ", num(money(Math.round(s.avgTotal))));
          if (s.avgPerItem) v.append(" · ", num(money(s.avgPerItem)), " למוצר");
          d.append(v);
          box.append(d);
        });
        p.append(box);
      }
    }
    return p;
  }

  function renderDirectory() {
    const d = h("details", "panel");
    const s = h("summary");
    s.append(h("span", "", "על הרשתות"), ctx.icon("chevron", 18));
    d.append(s);
    for (const c of STORES) {
      const el = h("div", "chain");
      el.append(h("h3", "", c.name));
      const files = c.hasData ? "המחירים שלה כלולים בהשוואה" : c.priceFiles === "login" ? "קובץ המחירים שלה מאחורי התחברות, אפשר להזין מחירים ידנית" : "אין לנו מחירים שלה, אפשר להזין ידנית";
      el.append(h("p", "", [c.traits, files].filter(Boolean).join(". ")));
      if (c.researchNote) el.append(h("p", "", c.researchNote));
      const src = (c.sources || []).find((u) => u.startsWith("http"));
      if (src) { const a = h("a", "", "מקור"); a.href = src; a.target = "_blank"; a.rel = "noopener"; el.append(a); }
      d.append(el);
    }
    if (SURVEYS.length) {
      d.append(h("h3", "chain-sub", "סקרי מחירים שמצאנו"));
      d.append(h("p", "fine", "סלים, תאריכים וסניפים שונים, ולכן אי אפשר לדרג רשתות לפיהם. הם רק כיוון."));
      for (const sv of SURVEYS) {
        const el = h("div", "chain");
        el.append(h("h3", "", `${sv.publisher}, ${sv.date}`));
        el.append(h("p", "", sv.finding));
        el.append(h("p", "", "בסיס: " + sv.basis));
        const a = h("a", "", "מקור"); a.href = sv.url; a.target = "_blank"; a.rel = "noopener"; el.append(a);
        d.append(el);
      }
    }
    return d;
  }

  function renderView() {
    body.replaceChildren(renderCompare(), ...renderMissing(), renderReceipts(), renderDirectory());
  }

  function refresh() {
    renderLine();
    if (!$("view-prices").hidden) {
      const open = $("view-prices").querySelector("details")?.open;
      renderView();
      if (open) $("view-prices").querySelector("details").open = true;
    }
  }

  // ---- Prices for one product ----
  const priceDialog = $("price-dialog");
  let priced = null;

  function openPriceDialog(name) {
    const { product, mine } = unitPrices(name);
    priced = { name, key: priceKey(name), mine };
    $("price-title").textContent = name;
    $("price-sub").textContent = product?.kg
      ? `זוהה כ"${product.name}". מחיר לקילו, מה שתזינו יחליף את מחיר הרשת. בהערכה, כל יחידה ברשימה נחשבת ${product.unitKg} ק״ג.`
      : product
      ? `זוהה כ"${product.name}${product.size ? " " + product.size : ""}". מחיר ליחידה אחת, מה שתזינו יחליף את מחיר הרשת.`
      : "המוצר לא נמצא במאגר המחירים. הזינו מחיר ליחידה אחת בכל רשת שתרצו.";
    const fields = selected().map((c) => {
      const wrap = h("div", "price-field");
      const label = h("label", "", c.name);
      label.htmlFor = "pf-" + c.id;
      if (c.branch) label.append(h("small", "", c.branch));
      const input = document.createElement("input");
      input.id = "pf-" + c.id;
      input.dataset.chain = c.id;
      input.type = "number"; input.inputMode = "decimal"; input.min = "0.1"; input.max = "9999"; input.step = "0.01";
      if (typeof mine[c.id] === "number") input.value = mine[c.id];
      const fileVal = product?.prices?.[c.id];
      input.placeholder = typeof fileVal === "number" ? String(fileVal) : "—";
      wrap.append(label, input);
      return wrap;
    });
    $("price-fields").replaceChildren(...(fields.length ? fields : [h("p", "hint", "לא נבחרו רשתות. בחרו רשתות בלשונית המחירים.")]));
    priceDialog.showModal();
  }
  $("price-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!priced) return;
    const patch = {};
    $("price-fields").querySelectorAll("input").forEach((input) => {
      const v = parseFloat(input.value);
      if (Number.isFinite(v) && v > 0 && v <= 9999) patch[input.dataset.chain] = Math.round(v * 100) / 100;
      else if (input.value === "" && typeof priced.mine[input.dataset.chain] === "number") patch[input.dataset.chain] = ctx.deleteField();
    });
    priceDialog.close();
    if (!Object.keys(patch).length) return;
    ctx.savePrices({ [priced.key]: patch }).then(() => ctx.toast("המחיר נשמר")).catch(() => ctx.setStatus("לא הצלחתי לשמור מחיר", true));
  });

  // ---- Which chains to compare ----
  const storeDialog = $("store-dialog");
  function openStores() { renderStoreList(); storeDialog.showModal(); }
  function renderStoreList() {
    const sel = new Set(selected().map((c) => c.id));
    const known = new Set(allChains().map((c) => c.id));
    const sugg = $("store-sugg");
    sugg.replaceChildren(...STORES.filter((s) => !known.has(s.id)).slice(0, 8).map((s) => {
      const b = h("button", "sugg", "+ " + s.name);
      b.type = "button";
      b.addEventListener("click", () => addCustom(s.id, s.name));
      return b;
    }));
    sugg.hidden = !sugg.children.length;
    $("store-list").replaceChildren(...allChains().map((c) => {
      const row = h("label", "chk");
      const box = document.createElement("input");
      box.type = "checkbox"; box.checked = sel.has(c.id);
      box.addEventListener("change", () => {
        box.checked ? sel.add(c.id) : sel.delete(c.id);
        ctx.saveStores({ sel: [...sel] }).catch(() => ctx.setStatus("לא הצלחתי לשמור", true));
      });
      const name = h("span", "", c.name);
      if (c.branch) name.append(" ", h("small", "", c.branch));
      if (c.optional) name.append(" ", h("small", "", "· בלי מחירי ירקות"));
      row.append(box, name);
      if (c.custom) {
        const rm = h("button", "link-btn danger", "הסרה");
        rm.type = "button";
        rm.addEventListener("click", (e) => {
          e.preventDefault();
          const custom = ctx.storeCfg.custom.filter((x) => x.id !== c.id);
          sel.delete(c.id);
          ctx.saveStores({ custom, sel: [...sel] }).catch(() => ctx.setStatus("לא הצלחתי לשמור", true));
        });
        row.append(rm);
      }
      return row;
    }));
  }
  // A chain the family shops at that has no published prices here: they type its prices in themselves.
  function addCustom(id, n) {
    if (!n || ctx.storeCfg.custom.length >= 10 || allChains().some((c) => c.id === id)) return;
    const sel = new Set(selected().map((c) => c.id)).add(id);
    ctx.saveStores({ custom: [...ctx.storeCfg.custom, { id, n }], sel: [...sel] }).catch(() => ctx.setStatus("לא הצלחתי לשמור", true));
  }
  $("store-form").addEventListener("submit", (e) => {
    e.preventDefault();
    addCustom("c" + Date.now().toString(36), $("store-new").value.trim().slice(0, 24));
    $("store-new").value = "";
  });
  // The dialog lists stay in sync with the snapshots that follow every save.
  const baseRefresh = refresh;
  const refreshAll = () => { baseRefresh(); if (storeDialog.open) renderStoreList(); };

  // ---- A receipt ----
  const receiptDialog = $("receipt-dialog");
  function openReceipt({ items } = {}) {
    const have = new Set(allChains().map((c) => c.id));
    const options = [...allChains(), ...STORES.filter((x) => !have.has(x.id)).map((x) => ({ id: x.id, name: x.name })), { id: "other", name: "אחר" }];
    $("receipt-store").replaceChildren(...options.map((c) => {
      const o = document.createElement("option");
      o.value = c.id; o.textContent = c.name;
      return o;
    }));
    $("receipt-total").value = "";
    $("receipt-items").value = items || "";
    receiptDialog.showModal();
  }
  $("receipt-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const total = parseFloat($("receipt-total").value);
    if (!(total > 0 && total <= 99999)) return;
    const count = parseInt($("receipt-items").value, 10);
    const r = { storeId: $("receipt-store").value, total: Math.round(total * 100) / 100, t: Date.now() };
    if (count >= 1 && count <= 1000) r.items = count;
    receiptDialog.close();
    ctx.addReceipt(r).then(() => ctx.toast("הקבלה נשמרה")).catch(() => ctx.setStatus("לא הצלחתי לשמור קבלה", true));
  });

  return { refresh: refreshAll, describe, openPriceDialog, openReceipt };
}
