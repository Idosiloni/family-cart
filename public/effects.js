// Small visual helpers: reduced-motion check and the toast. Motion is skipped for people who ask for less of it.

export const EASE_OUT = "cubic-bezier(.2, .8, .2, 1)";
export const POP = "cubic-bezier(.34, 1.56, .64, 1)"; // a little overshoot, like a spring settling
export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// One toast at a time, with an optional action button (used for "undo").
// It mounts inside the shopping dialog when that is open, because a modal dialog hides everything behind it.
export function toast(text, action) {
  document.querySelectorAll(".toast").forEach((t) => t.remove());
  const el = document.createElement("div");
  el.className = "toast";
  el.setAttribute("role", "status");
  const span = document.createElement("span");
  span.textContent = text;
  el.append(span);
  const gone = () => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200 }).finished.then(() => el.remove(), () => el.remove());
  const timer = setTimeout(gone, action ? 6000 : 3200);
  if (action) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = action.label;
    b.addEventListener("click", () => { clearTimeout(timer); action.run(); gone(); });
    el.append(b);
  }
  (document.querySelector("dialog.shop[open]") || document.body).append(el);
  if (!reducedMotion()) el.animate([{ opacity: 0, transform: "translate(-50%, 16px) scale(.94)" }, { opacity: 1, transform: "translate(-50%, 0) scale(1)" }], { duration: 320, easing: POP });
}

// A row that was just checked off slides out and folds away. Returns the Animation so the caller can wait for
// `finished` (then do the write) or cancel() it (the person tapped again, so nothing changes).
// The 160ms delay lets the circle fill in first.
export function leaveRow(el) {
  const h = el.offsetHeight;
  el.style.overflow = "hidden";
  const anim = el.animate([
    { opacity: 1, transform: "none", height: h + "px", minHeight: h + "px", paddingTop: "6px", paddingBottom: "6px", borderTopWidth: "1px" },
    { opacity: 0, transform: "translateX(28px)", offset: .55 },
    { opacity: 0, transform: "translateX(28px)", height: "0px", minHeight: "0px", paddingTop: "0px", paddingBottom: "0px", borderTopWidth: "0px" },
  ], { duration: 340, delay: 160, easing: EASE_OUT, fill: "forwards" });
  anim.finished.catch(() => { el.style.overflow = ""; });
  return anim;
}

// A few small pieces thrown up from `origin`, for finishing the list or the trip. Under a second, then gone.
export function burst(origin, count = 18) {
  if (reducedMotion() || !origin?.isConnected) return;
  const r = origin.getBoundingClientRect();
  const host = document.querySelector("dialog.shop[open]") || document.body;
  const colors = ["var(--accent)", "var(--accent)", "color-mix(in srgb, var(--accent) 40%, var(--surface))", "var(--mut)", "var(--text)"];
  for (let i = 0; i < count; i++) {
    const p = document.createElement("i");
    const size = 6 + Math.random() * 4;
    p.setAttribute("aria-hidden", "true");
    p.style.cssText = `position:fixed;z-index:70;pointer-events:none;left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;width:${size}px;height:${size * (Math.random() < .5 ? 1 : 1.8)}px;border-radius:${Math.random() < .5 ? "50%" : "2px"};background:${colors[i % colors.length]}`;
    const dx = (Math.random() - .5) * 260, up = 70 + Math.random() * 110, spin = (Math.random() - .5) * 540;
    host.append(p);
    p.animate([
      { transform: "translate(-50%,-50%) scale(.3)", opacity: 1 },
      { transform: `translate(calc(-50% + ${dx * .6}px), calc(-50% - ${up}px)) rotate(${spin * .5}deg) scale(1)`, opacity: 1, offset: .4, easing: "cubic-bezier(.5,0,.9,.6)" },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${60 + Math.random() * 50}px)) rotate(${spin}deg) scale(.9)`, opacity: 0 },
    ], { duration: 800 + Math.random() * 400, easing: EASE_OUT, delay: Math.random() * 60 }).finished.then(() => p.remove(), () => p.remove());
  }
}

// Swap a number with a short slide-in, so a changing count reads as a change.
export function rollIn(el) {
  if (reducedMotion()) return;
  el.animate([{ opacity: 0, transform: "translateY(45%) scale(.9)" }, { opacity: 1, transform: "none" }], { duration: 280, easing: POP });
}
