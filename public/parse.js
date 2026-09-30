import { classify, isKnownWord, phraseLengthAt } from "./categories.js";

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

// "3 חלב" / "חלב x3" -> { name: "חלב", qty: 3 }. Leaves "חלב 3%" and "2 ליטר מים" alone.
const UNIT = /^(ליטר|ליטרים|קילו|ק"ג|קג|גרם|גר|מ"ל|מל|יח|יחידות)/;
export function splitQty(text) {
  const lead = text.match(/^(\d{1,2})\s+(.+)$/);
  if (lead && !UNIT.test(lead[2]) && !lead[2].startsWith("%")) {
    const qty = Number(lead[1]);
    if (qty >= 1) return { name: lead[2].trim(), qty };
  }
  const trail = text.match(/^(.+?)\s*[x×]\s*(\d{1,2})$/i);
  if (trail && Number(trail[2]) >= 1) return { name: trail[1].trim(), qty: Number(trail[2]) };
  return { name: text, qty: 1 };
}

// Speech recognition returns one run of words with no commas ("חלב ביצים שמן זית ולחם").
// Start a new item at every known product word/phrase; unknown words stick to the previous item.
export function splitSpoken(text) {
  const tokens = String(text).trim().split(/\s+/).filter(Boolean)
    .map((t, i) => {
      const bare = t.slice(1);
      return i > 0 && t.startsWith("ו") && bare.length > 0 && (/^\d/.test(bare) || (bare.length > 1 && isKnownWord(bare))) ? bare : t;
    });
  const items = [];
  let cur = [];
  const flush = () => { if (cur.length) items.push(cur.join(" ")); cur = []; };

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (/^\d+$/.test(t)) { flush(); cur = [t]; continue; }     // a number opens the next item ("2 חלב")
    const n = phraseLengthAt(tokens, i) || (isKnownWord(t) ? 1 : 0);
    if (n) {
      if (cur.length && !(cur.length === 1 && /^\d+$/.test(cur[0]))) flush();
      cur.push(...tokens.slice(i, i + n));
      i += n - 1;
    } else {
      cur.push(t);
    }
  }
  flush();
  return items.join(", ");
}
