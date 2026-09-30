import { classify } from "./categories.js";

const MAX_ITEMS = 40;
const MAX_NAME = 80;

// Turns a pasted/typed message into separate item names.
// Splits on newlines, commas, semicolons, bullets and "+"; also on a Hebrew "ו" prefix
// ("חלב ולחם") but only when the rest of the word is a product we recognise,
// so words that genuinely start with ו (וופל, וודקה, ...) stay intact.
export function parseItems(text) {
  const pieces = String(text)
    .split(/[\n\r,،;•·|+]+/)
    .map(cleanPiece)
    .filter(Boolean);

  const names = [];
  for (const piece of pieces) {
    let current = [];
    for (const [i, token] of piece.split(/\s+/).entries()) {
      const bare = token.slice(1);
      const startsNew = i > 0 && token.startsWith("ו") &&
        (/^\d/.test(bare) || (bare.length > 1 && classify(bare) !== "other"));
      if (startsNew) {
        if (current.length) names.push(current.join(" "));
        current = [bare];
      } else {
        current.push(token);
      }
    }
    if (current.length) names.push(current.join(" "));
  }

  const seen = new Set();
  const out = [];
  for (const raw of names) {
    const name = raw.trim().slice(0, MAX_NAME);
    const key = name.toLowerCase();
    if (name.length < 2 || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length === MAX_ITEMS) break;
  }
  return out;
}

function cleanPiece(p) {
  return p
    .replace(/^\s*(?:[-–—*•·▪●○□☐✅☑✔]+️?|\[[ xX]?\]|\d+[.)])\s*/u, "") // list markers
    .replace(/[.!؟?]+$/u, "")
    .replace(/\s+/g, " ")
    .trim();
}
