// Small visual helpers: reduced-motion check and the toast. Motion is skipped for people who ask for less of it.

const EASE_OUT = "cubic-bezier(.2, .8, .2, 1)";
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
  el.animate([{ opacity: 0, transform: "translate(-50%, 12px)" }, { opacity: 1, transform: "translate(-50%, 0)" }], { duration: 220, easing: EASE_OUT });
}
