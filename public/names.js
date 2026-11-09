// How product names are compared and read. Pure (no DOM, no Firebase), so it is unit-tested.
//
// matchKey answers "is this the same product?" for duplicate detection and for hiding suggestions that are already
// on the list: בננה and בננות, ביצה and ביצים, קוטג', קוטג׳ and קוטג all give the same key.
// It is NOT categories.learnKey: that one is stored (history, pins, learned sections, snoozes) and must never change.

const NIKUD = /[֑-ׇ]/g;
const QUOTES = /['"׳״’‘`]/g;
const FINAL = { ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ" };

const words = (s) => String(s ?? "").toLowerCase().replace(NIKUD, "").replace(QUOTES, "").split(/[^\p{L}\p{N}%]+/u).filter(Boolean);

// One word to its stem. Careful by design: a word must have at least 4 letters to lose anything, and keeps at least 3,
// so מים, תה, חלה and דגים are left alone and cannot collapse into a different word.
// Words where taking the ending off would turn one product into another (חלבה is halva, not milk).
const KEEP = new Set(["חלבה"]);
const plainFinals = (w) => w.replace(/[ךםןףץ]/g, (c) => FINAL[c]);

export function stem(word) {
  let w = word;
  if (/\d/.test(w) || KEEP.has(w)) return plainFinals(w);
  if (w.length >= 4 && w.startsWith("ה") && w.length - 1 >= 3) w = w.slice(1); // הלחם -> לחם
  for (const end of ["ים", "ות", "ה"]) {
    if (w.length >= 4 && w.endsWith(end) && w.length - end.length >= 3) { w = w.slice(0, -end.length); break; }
  }
  w = w.replace(/יי$/, "י"); // עגבנייה -> עגבניי -> עגבני, the same stem as עגבניות. (A lone י stays: עוגיות, סוכריות and נקניקיות
                              // are cookies, candies and sausages, not עוגה, סוכר and נקניק.)
  return plainFinals(w);
}

export function matchKey(name) {
  return words(name).map(stem).join(" ");
}

export const sameProduct = (a, b) => {
  const k = matchKey(a);
  return k !== "" && k === matchKey(b);
};

// Does what was typed ("עגב", "גבינה צ") start the words of a product name? Every typed word must begin some word of the
// name (compared by stem too, so a typed singular finds the plural). Used for autocomplete.
export function typedMatches(typed, name) {
  const t = words(typed);
  if (!t.length) return false;
  const n = words(name);
  return t.every((tw) => n.some((nw) => plainFinals(nw).startsWith(plainFinals(tw)) || stem(nw).startsWith(stem(tw))));
}

// ---- Hebrew number words: "שתי חלב", "שלוש בננות", "זוג גרביים" ----
export const NUMBER_WORDS = {
  שתי: 2, שני: 2, שתיים: 2, שניים: 2, זוג: 2,
  שלוש: 3, שלושה: 3, ארבע: 4, ארבעה: 4, חמש: 5, חמישה: 5, שש: 6, שישה: 6,
  שבע: 7, שבעה: 7, שמונה: 8, תשע: 9, תשעה: 9, עשר: 10, עשרה: 10, תריסר: 12,
};
export const isNumberWord = (t) => Object.hasOwn(NUMBER_WORDS, t);

// "שלוש בננות" -> "3 בננות" (only when a product word follows; a lone number word is left as it is).
export function numberWordsToDigits(text) {
  const m = /^(\S+)\s+(\S.*)$/.exec(text);
  return m && isNumberWord(m[1]) ? `${NUMBER_WORDS[m[1]]} ${m[2]}` : text;
}

// Words people put in front of a product that are not part of its name: "עוד חלב", "לא לשכוח ביצים", "צריך לחם".
const FILLER = /^(?:צריך|צריכים|צריכה|לקנות|קנה|קני|תקנו|תקנה|תביא|תביאו|להביא|תוסיף|להוסיף|עוד|גם|חסר|חסרים|חסרה|לא\s+לשכוח|אל\s+תשכחו|אל\s+תשכח)\s+(?=\S)/;
export function stripFiller(text) {
  let t = text, prev;
  do { prev = t; t = t.replace(FILLER, ""); } while (t !== prev);
  return t;
}
