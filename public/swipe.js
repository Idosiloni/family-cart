// Swipe a list row: right = onRight (check off), left = onLeft (delete). Mostly-vertical drags are left to the page scroll.
export const SWIPE_DISTANCE = 90;

export function attachSwipe(li, { onRight, onLeft }) {
  let x0 = null, y0 = 0, dx = 0, live = false;
  const reset = () => { x0 = null; live = false; li.classList.remove("swiping", "sw-check", "sw-del", "armed"); li.style.transform = ""; };
  li.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button, input")) return;
    x0 = e.clientX; y0 = e.clientY; dx = 0; live = false;
  });
  li.addEventListener("pointermove", (e) => {
    if (x0 === null) return;
    const mx = e.clientX - x0, my = e.clientY - y0;
    if (!live) {
      if (Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my) * 1.5) { live = true; li.setPointerCapture(e.pointerId); li.classList.add("swiping"); }
      else { if (Math.abs(my) > 10) x0 = null; return; }
    }
    dx = mx;
    li.style.transform = `translateX(${dx}px)`;
    li.classList.toggle("sw-check", dx > 0);
    li.classList.toggle("sw-del", dx < 0);
    li.classList.toggle("armed", Math.abs(dx) > SWIPE_DISTANCE);
  });
  li.addEventListener("pointerup", () => {
    if (x0 === null) return;
    const fire = live && Math.abs(dx) > SWIPE_DISTANCE, right = dx > 0;
    // A drag that ends over the row must not also count as a tap on its checkbox label.
    if (live) { const stop = (e) => { e.preventDefault(); e.stopPropagation(); }; li.addEventListener("click", stop, { capture: true, once: true }); setTimeout(() => li.removeEventListener("click", stop, true), 50); }
    reset();
    if (!fire) return;
    if (right) onRight(); else onLeft();
  });
  li.addEventListener("pointercancel", reset);
}
