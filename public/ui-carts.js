// The carts screens: the header switcher, "my carts", create / rename / join, and the invite sheet.
// Switching is a page reload: every listener in app.js is built from the cart id once, at load.
import { loadCarts, saveCarts, resolveInvite, createInvite } from "./cart-boot.js";
import { useCart, renameCart, removeCart, newCartId, defaultName, normalizeCode, formatCode, joinUrl, INVITE_DAYS } from "./carts.js";

export function initCarts({ $, icon, toast, DEMO, cartId }) {
  let list = loadCarts();
  const nameOf = (id) => list.find((c) => c.id === id)?.name || "";
  const currentName = () => nameOf(cartId);

  $("cart-name").textContent = DEMO ? "הדגמה" : currentName() || $("cart-name").textContent;
  const retitle = (n) => { document.title = !n || n === "העגלה המשפחתית" ? "העגלה המשפחתית" : `${n} · העגלה המשפחתית`; };
  if (!DEMO) retitle(currentName());

  function switchTo(id, name) {
    saveCarts(useCart(loadCarts(), id, name));
    try { localStorage.setItem("cartId", id); } catch {}
    history.replaceState(null, "", location.pathname + location.search + "#" + id);
    location.reload();
  }

  // ---- My carts ----
  const dlg = $("carts-dialog");
  const msg = $("join-msg");
  // A toast would sit behind this dialog, so messages (and "undo") live inside it.
  const say = (text, undo) => {
    msg.replaceChildren(text);
    if (undo) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "link-btn"; b.textContent = "ביטול";
      b.addEventListener("click", undo);
      msg.append(" ", b);
    }
  };

  function renderList() {
    list = loadCarts();
    $("carts-list").replaceChildren(...list.map((c) => {
      const li = document.createElement("li");
      const row = document.createElement("button");
      row.type = "button";
      row.className = "row-btn cart-row";
      const current = c.id === cartId;
      if (current) row.setAttribute("aria-current", "true");
      const label = document.createElement("span");
      label.textContent = c.name;
      row.append(label);
      if (current) {
        const mark = document.createElement("span");
        mark.className = "val";
        mark.append(icon("check", 16), "פתוחה");
        row.append(mark);
      }
      row.addEventListener("click", () => (current ? dlg.close() : switchTo(c.id)));
      li.append(row, iconBtn("edit", `שינוי שם: ${c.name}`, () => askName("שם העגלה", c.name, (n) => {
        saveCarts(renameCart(loadCarts(), c.id, n));
        if (current) { $("cart-name").textContent = n; retitle(n); }
        renderList();
      })));
      // Only a cart you are not in can be removed from this phone, so you can never lock yourself out of the open one.
      if (!current) li.append(iconBtn("close", `הסרה מהטלפון: ${c.name}`, () => {
        saveCarts(removeCart(loadCarts(), c.id));
        renderList();
        say(`"${c.name}" הוסרה מהטלפון.`, () => { saveCarts(useCart(loadCarts(), c.id, c.name, c.used)); renderList(); say(""); });
      }));
      return li;
    }));
  }
  function iconBtn(name, label, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "icon-btn small";
    b.setAttribute("aria-label", label);
    b.append(icon(name, 16));
    b.addEventListener("click", onClick);
    return b;
  }

  $("cart-btn").addEventListener("click", () => {
    if (DEMO) return toast("במצב הדגמה יש עגלה אחת");
    say(""); $("join-input").value = "";
    renderList();
    dlg.showModal();
  });

  // Join with a typed code.
  $("join-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const code = normalizeCode($("join-input").value);
    if (!code) return say("הקוד הוא 8 תווים, למשל KFRT-4829.");
    say("בודקים את הקוד…");
    try {
      const { id, name } = await resolveInvite(code);
      switchTo(id, name);
    } catch (err) {
      say(err.kind === "offline" ? "אין חיבור כרגע. נסו שוב." : "הקוד לא נמצא או שפג תוקפו. בקשו קוד חדש.");
    }
  });

  // ---- Name a cart (new or rename) ----
  const nameDlg = $("cartname-dialog");
  let onName = null;
  function askName(title, value, done) {
    $("cartname-title").textContent = title;
    $("cartname-input").value = value;
    onName = done;
    nameDlg.showModal();
    $("cartname-input").select();
  }
  $("cartname-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const n = $("cartname-input").value.trim();
    if (!n) return;
    nameDlg.close();
    onName?.(n);
  });
  $("cart-new").addEventListener("click", () => askName("עגלה חדשה", defaultName(loadCarts()), (n) => switchTo(newCartId(), n)));

  // ---- Invite sheet ----
  const permUrl = () => location.origin + location.pathname + "#" + cartId;
  async function copy(btn, text, idle) {
    try { await navigator.clipboard.writeText(text); btn.textContent = "הועתק"; }
    catch { btn.textContent = "לא הצלחתי להעתיק"; }
    setTimeout(() => { btn.textContent = idle; }, 2000);
  }
  let shareUrl = "";
  async function openInvite() {
    const codeEl = $("invite-code"), expEl = $("invite-exp"), hint = $("connect-hint"), perm = $("copy-perm");
    codeEl.hidden = true; expEl.hidden = true; perm.hidden = true;
    shareUrl = permUrl(); // until (and unless) a short code exists, the permanent link is the invite
    paint(shareUrl);
    hint.textContent = "מכינים קוד הזמנה…";
    $("connect-dialog").showModal();
    if (DEMO) { hint.textContent = "במצב הדגמה אין הזמנות אמיתיות."; return; }
    try {
      const { code, exp } = await createInvite(cartId, currentName());
      shareUrl = joinUrl(location.origin + location.pathname, code);
      codeEl.textContent = formatCode(code);
      codeEl.hidden = false;
      const days = Math.max(1, Math.round((exp - Date.now()) / 86400000));
      expEl.textContent = `תקף ל-${days === INVITE_DAYS ? INVITE_DAYS : days} ימים`;
      expEl.hidden = false;
      perm.hidden = false;
      hint.textContent = "מי שסורק את הברקוד או פותח את הקישור מצטרף לעגלה. אפשר גם להקליד את הקוד תחת \"העגלות שלי\".";
      paint(shareUrl);
    } catch {
      hint.textContent = "לא הצלחתי ליצור קוד כרגע, אז זה הקישור הקבוע של העגלה. כל מי שפותח אותו מצטרף.";
    }
  }
  function paint(url) {
    $("wa").href = "https://wa.me/?text=" + encodeURIComponent(`הצטרפו לעגלה "${currentName() || "המשפחתית"}"\n${url}`);
    const box = $("qr");
    try {
      const qr = qrcode(0, "M");
      qr.addData(url); qr.make();
      box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); // library-generated SVG of our own URL
      box.hidden = false;
    } catch { box.hidden = true; }
  }
  $("copy-link").addEventListener("click", () => copy($("copy-link"), shareUrl, "העתקת קישור"));
  $("copy-perm").addEventListener("click", () => copy($("copy-perm"), permUrl(), "העתקת קישור קבוע (לא פג תוקף)"));

  return { openInvite };
}
