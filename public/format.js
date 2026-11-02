// Pure text helpers (no DOM, no Firebase), so they can be unit-tested in Node.

export function greeting(hour = new Date().getHours()) {
  return hour < 5 ? "לילה טוב" : hour < 12 ? "בוקר טוב" : hour < 17 ? "צהריים טובים" : hour < 21 ? "ערב טוב" : "לילה טוב";
}

// Shopping-mode clock: 75 seconds -> "1:15".
export function clock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// WhatsApp-friendly text for what is still left to buy.
// sections: [{ cat: { name }, todo: [{ name, qty?, note? }] }] in store-walking order; empty ones are skipped.
export function shareText(sections) {
  const secs = sections.filter((s) => s.todo.length);
  const left = secs.reduce((n, s) => n + s.todo.length, 0);
  if (!left) return "";
  const lines = [`העגלה המשפחתית, נשארו ${left}:`];
  secs.forEach((s) => {
    lines.push("", `*${s.cat.name}*`);
    s.todo.forEach((i) => lines.push(`• ${i.name}${i.qty > 1 ? " ×" + i.qty : ""}${i.note ? ` (${i.note})` : ""}`));
  });
  return lines.join("\n");
}
