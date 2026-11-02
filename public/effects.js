// Small visual effects: numeral count-up, confetti, toast.
// All of them skip motion for people who ask for reduced motion.

const EASE_OUT = "cubic-bezier(.19, 1, .22, 1)";
export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// Counter feel: tween a numeral to its new value.
export function countTo(el, to) {
  const from = Number(el.textContent) || 0;
  if (from === to || reducedMotion()) { el.textContent = to; return; }
  const t0 = performance.now(), dur = 450;
  (function f(t) {
    const k = Math.min(1, (t - t0) / dur);
    el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(f);
  })(t0);
}

// Flat shapes in the palette (no emoji).
export function confetti(box = document.getElementById("confetti")) {
  if (reducedMotion()) return;
  const colors = ["#5CF2C0", "#4CC9F0", "#A58BFF", "#FF6B8A", "#FFC46B", "#FFFFFF"];
  for (let i = 0; i < 40; i++) {
    const p = document.createElement("i");
    p.className = "piece";
    const size = 8 + Math.random() * 10;
    p.style.width = size + "px";
    p.style.height = (i % 3 === 0 ? size * 2.2 : size) + "px";
    p.style.borderRadius = i % 2 ? "50%" : "3px";
    p.style.background = colors[i % colors.length];
    p.style.left = Math.random() * 100 + "%";
    p.style.setProperty("--dx", (Math.random() * 160 - 80) + "px");
    p.style.setProperty("--rot", (Math.random() * 900 - 450) + "deg");
    p.style.setProperty("--dur", (2 + Math.random() * 1.6) + "s");
    p.style.animationDelay = Math.random() * 0.5 + "s";
    box.append(p);
    setTimeout(() => p.remove(), 4500);
  }
}

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
