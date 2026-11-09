// Supermarket sections. Order below = default walking order (entrance → checkout).
// Real aisle order differs per store, so the family can re-order it in the app.
//
// Matching (see classify): word-aware, not substring.
//  - keyword with 3 letters or fewer must equal a whole word ("מים", "תה", "חלב")
//  - longer keyword matches the start of a word ("עגבני" → עגבניות)
//  - keyword with a space is a phrase matched from the start of a word
//  - the longest matching keyword wins ("שוקולד חלב" → snacks, "חלב שקדים" → dairy)
import { EXTRA, BRANDS } from "./catalog.js";
import { NEW_SECTIONS, MOVES, BRAND_MOVES, EXTRA_IL, BRANDS_IL } from "./catalog-il.js";

export const CATEGORIES = [
  { id: "produce", bg: "#5CF2A0", fg: "#0B0F1A", icon: "produce", hue: 140, emoji: "🥬", name: "פירות וירקות",
    keywords: ["בצל ירוק", "בצל סגול", "פלפל חריף", "תפוח עץ", "חסה אמריקאית", "עגבניות שרי", "עגבני", "מלפפון", "מלפפונים", "בצל", "בצלים", "שום", "תפוח אדמה", "תפוחי אדמה", "גזר", "חסה", "פלפל", "פלפלים", "גמבה", "חציל", "קישוא", "זוקיני", "כרוב", "כרובית", "ברוקולי", "תפוח", "תפוחים", "בננ", "תפוז", "לימון", "ליים", "אבוקדו", "ענבים", "אבטיח", "מלון", "מלונים", "אפרסק", "שזיף", "תות", "תותים", "נענע", "מנטה", "פטרוזיל", "כוסברה", "שמיר", "עירית", "בזיליקום", "בטטה", "דלעת", "פטריות", "פטרייה", "אגס", "קלמנטינ", "אשכולית", "רימון", "מנגו", "אננס", "קיווי", "דובדבן", "נקטרינ", "משמש", "תאנ", "פירות", "ירקות", "סלרי", "צנונית", "צנון", "סלק", "רוקט", "תרד", "קייל", "לפת", "קולורבי", "תירס טרי", "שעועית ירוקה", "ג'ינג'ר", "זנגוויל", "נבטים", "שאלוט", "כרישה", "ארטישוק", "אספרגוס", "כרוב סיני", "בוק צוי", "אוכמניות", "פטל", "עלים", "ירק", "פרי"] },
  { id: "bakery", bg: "#FFC46B", fg: "#0B0F1A", icon: "bakery", hue: 32, emoji: "🥖", name: "לחם ומאפים",
    keywords: ["לחם מלא", "לחם קל", "לחם אחיד", "לחם שיפון", "לחם פרוס", "עוגת שוקולד", "לחם", "לחמני", "פיתה", "פיתות", "חלה", "חלות", "בגט", "טורטייה", "לאפה", "עוגה", "עוגות", "עוגיות", "בורקס", "קרואסון", "מאפה", "מאפים", "בייגל", "טוסט", "סופגני", "רוגלך", "פחזני", "לחמים", "לחם קלוי", "קלאמטה"] },
  { id: "dairy", bg: "#7CC8FF", fg: "#0B0F1A", icon: "dairy", hue: 205, emoji: "🥛", name: "חלב וביצים",
    keywords: ["גבנ״צ", "גבנ\"צ", "גבנצ", "פרזמן", "פרמזן", "גבינה צהובה", "גבינה לבנה", "גבינה בולגרית", "גבינה מגורדת", "גבינה מלוחה", "שוקו קר", "חלב", "גבינ", "קוטג", "יוגורט", "שמנת", "חמאה", "ביצים", "ביצה", "ביצי", "לבן", "לבנה", "מעדן", "מעדני", "מוצרלה", "צהובה", "שוקו", "אשל", "קממבר", "פטה", "מרגרינה", "דנונה", "משקה סויה", "משקה שקדים", "משקה שיבולת", "חלב שקדים", "חלב סויה", "חלב שיבולת", "חלב עיזים", "ריקוטה", "פרמזן", "ברי", "גאודה", "בולגרית", "סמנה", "קשקבל", "אמנטל", "קרם פרש", "שמנת חמוצה", "קפיר", "מילקי", "אקטיביה", "יופלה", "תנובה", "שטראוס", "יטבתה", "טרה", "פודינג", "גבינת שמנת"] },
  { id: "meat", bg: "#FF8FA3", fg: "#0B0F1A", icon: "meat", hue: 6, emoji: "🍗", name: "בשר, עוף ודגים",
    keywords: ["שניצל עוף", "חזה עוף", "חזה הודו", "נקניקיות עוף", "כנפיים עוף", "שוקיים עוף", "כבד עוף", "המבורגר בקר", "עוף", "חזה", "שניצל", "בשר", "טחון", "סטייק", "נקניק", "נקניקיות", "נקניקיה", "המבורגר", "כנפיים", "שוקיים", "דג", "דגים", "סלמון", "פילה", "אנטריקוט", "קבב", "הודו", "פסטרמה", "קצבים", "כבד", "לבבות", "צלעות", "אסאדו", "סינטה", "שייטל", "כרעיים", "פרגית", "פרגיות", "שווארמה", "בקר", "כבש", "קציצות", "נגיסים", "בורי", "דניס", "לברק", "אמנון", "קרפיון", "פורל", "הרינג", "סלמי", "קבנוס", "בייקון", "ברווז", "אווז", "צלי", "רוסטביף", "שיפודים", "עגל", "מקרל", "טונה טרייה", "עוף שלם", "בשר טחון", "סרדינים טריים", "סלמון מעושן"] },
  { id: "pantry", bg: "#FF9F6B", fg: "#0B0F1A", icon: "pantry", hue: 45, emoji: "🥫", name: "מזווה ויבשים",
    keywords: ["קמח מלא", "פסטה מלאה", "אורז מלא", "קמח תופח", "סוכר חום", "מלח גס", "שמן ספריי", "רסק עגבניות", "טחינה מלאה", "קפה שחור", "קפה טורקי", "תה נענע", "אורז", "פסטה", "ספגטי", "קוסקוס", "קמח", "סוכר", "מלח", "שמן", "חומץ", "רסק", "קטשופ", "מיונז", "חרדל", "טחינה", "חומוס", "שימורים", "טונה", "תירס", "זיתים", "מלפפונים חמוצים", "חמוצים", "אפונה", "שעועית", "עדשים", "בורגול", "שיבולת שועל", "קורנפלקס", "דגני", "גרנולה", "קפה", "תה", "נס", "שוקולד לאפייה", "אבקת אפייה", "אבקת אפיה", "אבקת סוכר", "אבקת קקאו", "תבלין", "תבלינ", "פפריקה", "כמון", "קינמון", "פלפל שחור", "קורנפלור", "עמילן", "סולת", "קינואה", "כוסמת", "שמרים", "וניל", "סודה לשתייה", "קקאו", "דבש", "ריבה", "נוטלה", "סילאן", "מרק", "רוטב", "פירורי", "קטניות", "אגוזים", "שקדים", "צימוקים", "פתיתים", "חמאת בוטנים", "קשיו", "פיסטוק", "פסטו", "סויה", "טריאקי", "אטריות", "נודלס", "לזניה", "מקרוני", "פנה", "פוזילי", "עגבניות מרוסקות", "עגבניות מיובשות", "רוטב עגבניות", "גרגירי חומוס", "פול", "שמן זית", "שמן קנולה", "שמן חמניות", "ממתיק", "סוכרזית", "סטיביה", "חלב קוקוס", "עלי גפן", "קפסולות", "קפה נמס", "תה ירוק", "תיונים", "חליטה", "מצות", "מלח ים", "אסם", "תלמה", "יכין", "סוגת", "מגדים", "טחינה גולמית", "פולנטה", "אורז בסמטי", "ממרח", "ריבת", "מייפל", "פירות יבשים", "תמרים", "צנוברים", "שומשום", "זעתר", "סומאק", "אבקת מרק", "קובייות מרק", "כרוב כבוש"] },
  { id: "snacks", bg: "#FF6B8A", fg: "#0B0F1A", icon: "snacks", hue: 320, emoji: "🍫", name: "חטיפים וממתקים",
    keywords: ["שוקולד מריר", "שוקולד חלב", "שוקולד לבן", "עוגיות שוקולד", "חטיף שוקולד", "חטיף", "חטיפים", "חטיפי", "במבה", "ביסלי", "שוקולד", "ממתק", "ממתקים", "מסטיק", "סוכריות", "סוכרייה", "פופקורן", "צ'יפס", "צ׳יפס", "תפוצ'יפס", "פרינגלס", "וופל", "ופלים", "חלבה", "גרעינים", "בוטנים", "פיצוחים", "אגוזי", "קרקר", "קרקרים", "פסק זמן", "קליק", "כיף כף", "טופי", "מרשמלו", "דובונים", "גומי", "דוריטוס", "קינדר", "מרס", "סניקרס", "טוויקס", "חטיף אנרגיה", "אוראו", "אכלס", "עלית", "מקופלים"] },
  { id: "drinks", bg: "#A58BFF", fg: "#0B0F1A", icon: "drinks", hue: 185, emoji: "🥤", name: "משקאות",
    keywords: ["מיץ תפוזים", "מיץ ענבים", "מיץ תפוחים", "מיץ לימון", "מיץ גזר", "בירה שחורה", "יין אדום", "יין לבן", "מים", "קולה", "קוקה", "פפסי", "ספרייט", "פאנטה", "מיץ", "מיצים", "סודה", "בירה", "יין", "יינות", "וודקה", "וויסקי", "ג'ין", "רום", "טקילה", "קוניאק", "ערק", "שמפניה", "ליקר", "משקה", "משקאות", "שתייה", "תרכיז", "נביעות", "מי עדן", "פרייה", "שוופס", "קריסטל", "נסטי", "לימונדה", "פחית", "פחיות", "מים מינרליים", "מים בטעמים", "מים עם גז", "מי סודה", "רד בול", "אנרג'י", "טמפו", "איזוטוני", "פריגת", "פרימור", "תפוזינה", "תה קר", "אייס", "גולדסטאר", "מכבי", "קורונה", "היינקן", "סיידר", "בקבוק מים"] },
  { id: "frozen", bg: "#8FEAF5", fg: "#0B0F1A", icon: "frozen", hue: 225, emoji: "🧊", name: "קפואים",
    keywords: ["קפוא", "פיצה", "שניצלונים", "ג'חנון", "גחנון", "מלוואח", "בצק עלים", "גלידה", "גלידות", "קרח", "מגנום", "סורבה", "אדממה", "בורקסים", "פופסיקל", "בצק"] },
  { id: "cleaning", bg: "#B7A6FF", fg: "#0B0F1A", icon: "cleaning", hue: 165, emoji: "🧽", name: "ניקיון וכביסה",
    keywords: ["אבקת כביסה", "מרכך כביסה", "מרכך", "נוזל כלים", "סבון כלים", "כלים", "אקונומיקה", "מנקה", "ספוג", "סקוטש", "שקיות אשפה", "שקיות", "שקית", "נייר סופג", "מגבות נייר", "נייר אלומיניום", "אלומיניום", "ניילון", "נייר אפייה", "מטהר", "ג'ל כביסה", "כביסה", "ניקוי", "סמרטוט", "מטליות", "סבון רצפה", "חומר ניקוי", "מסיר", "סנו", "פיירי", "אריאל", "טייד", "דסטוס", "מפיות", "חד פעמי", "צלחות", "כוסות", "סכו\"ם", "נרות", "גפרורים", "סוללות", "נורות", "מנקה חלונות", "מסיר אבנית", "מנקה אסלה", "מטאטא", "מגב", "דלי", "כפפות"] },
  { id: "hygiene", bg: "#FFB59A", fg: "#0B0F1A", icon: "hygiene", hue: 280, emoji: "🧴", name: "היגיינה וטיפוח",
    keywords: ["שמפו", "מרכך שיער", "סבון", "משחת שיניים", "משחה", "מברשת שיניים", "מברשת", "דאודורנט", "דיאודורנט", "נייר טואלט", "נייר", "טישו", "תחבושות", "תחבושת", "טמפונים", "קרם", "גילוח", "סכיני", "מגבונים לחים", "צמר גפן", "ג'ל רחצה", "ג'ל שיער", "בושם", "וזלין", "פדים", "מי פה", "חוט דנטלי", "קוטונטים", "לק", "ויטמין", "ויטמינים", "אקמול", "נורופן", "פלסטר", "אפטר שייב", "סבון ידיים", "נוזל רחצה", "קרם הגנה", "קרם ידיים", "שפתון", "קולגייט", "סנסודיין", "אופטיק", "מגבת"] },
  { id: "baby", bg: "#F5A6E6", fg: "#0B0F1A", icon: "baby", hue: 345, emoji: "🍼", name: "תינוקות",
    keywords: ["חיתולים", "חיתול", "מטרנה", "תמל", "תמ\"ל", "סימילאק", "נוטרילון", "פרוטרון", "מוצץ", "בקבוק", "דייסה", "דייסת", "מחית", "מגבונים לתינוק", "האגיס", "פמפרס", "תינוק", "בייבי"] },
  { id: "other", bg: "#AAB3CC", fg: "#0B0F1A", icon: "other", hue: 100, emoji: "🛍️", name: "אחר", keywords: [] },
];

// Finer Israeli sections slot into the walking order next to their parent section.
for (const s of NEW_SECTIONS) {
  const { after, ...section } = s;
  CATEGORIES.splice(CATEGORIES.findIndex((c) => c.id === after) + 1, 0, { ...section, keywords: [] });
}

// Brands: the new sections take over their own brands first, then the Israeli additions are merged in.
for (const [to, { from, words }] of Object.entries(BRAND_MOVES)) {
  BRANDS[from] = (BRANDS[from] || []).filter((b) => !words.includes(b));
  BRANDS[to] = [...new Set([...(BRANDS[to] || []), ...words])];
}
for (const [id, list] of Object.entries(BRANDS_IL)) BRANDS[id] = [...new Set([...(BRANDS[id] || []), ...list])];

// Merge the extra vocabulary; brand names move to their own low-priority rules.
for (const c of CATEGORIES) {
  const brands = new Set(BRANDS[c.id] || []);
  c.keywords = [...new Set([...c.keywords, ...(EXTRA[c.id] || []), ...(EXTRA_IL[c.id] || [])])].filter((k) => !brands.has(k));
}
// Words that now belong to a finer section leave their old one (explicit additions above stay where they were put).
const added = (id) => new Set(EXTRA_IL[id] || []);
for (const m of MOVES) {
  const target = CATEGORIES.find((c) => c.id === m.to);
  for (const fromId of m.from) {
    const src = CATEGORIES.find((c) => c.id === fromId);
    const keep = [];
    for (const k of src.keywords) {
      if (!added(fromId).has(k) && m.re.test(k) && !(m.not && m.not.test(k))) target.keywords.push(k);
      else keep.push(k);
    }
    src.keywords = keep;
  }
}
for (const c of CATEGORIES) c.keywords = [...new Set(c.keywords)];

export const DEFAULT_ORDER = CATEGORIES.map((c) => c.id);
const byId = new Map(CATEGORIES.map((c) => [c.id, c]));

export function categoryById(id) {
  return byId.get(id) || byId.get("other");
}

// ---- word-aware matching ----
const PREFIX_LETTERS = "הוובלמכש";
const tokenize = (name) =>
  name.toLowerCase().split(/[^\p{L}\p{N}'"׳״]+/u).filter(Boolean);

// A word may carry a one-letter Hebrew prefix (הלחם, ולחם). Try both forms.
const variants = (t) =>
  t.length >= 4 && PREFIX_LETTERS.includes(t[0]) ? [t, t.slice(1)] : [t];

const rule = (kw, id, order, brand) =>
  ({ kw: kw.toLowerCase(), len: kw.length, w: brand ? 1 : kw.length, id, order, phrase: kw.includes(" ") });
// Hebrew plural of a feminine noun: בטטה → בטטות (a word-start match can't see it), so add it.
const pluralOf = (kw) => (!kw.includes(" ") && kw.length >= 4 && kw.endsWith("ה") ? kw.slice(0, -1) + "ות" : null);
// ...and the other way: a keyword written in the plural (בננות, ביצים) must also catch the singular (בננה, ביצה).
const singularsOf = (kw) => {
  if (kw.includes(" ") || kw.length < 5) return [];
  if (kw.endsWith("ות")) return [kw.slice(0, -2) + "ה"];             // בננות -> בננה
  if (kw.endsWith("ים")) return [kw.slice(0, -2), kw.slice(0, -2) + "ה"]; // מלפפונים -> מלפפון, ביצים -> ביצה
  return [];
};
const productRules = (c, order) =>
  c.keywords.flatMap((kw) => [kw, pluralOf(kw), ...singularsOf(kw)].filter(Boolean).map((k) => rule(k, c.id, order, false)));
const RULES = [
  ...CATEGORIES.flatMap((c, order) => productRules(c, order)),
  ...CATEGORIES.flatMap((c, order) => (BRANDS[c.id] || []).map((kw) => rule(kw, c.id, order, true))),
];

export function classify(name) {
  const learnedId = learned.get(learnKey(name));
  if (learnedId && byId.has(learnedId)) return learnedId;

  const tokens = tokenize(name);
  if (!tokens.length) return "other";
  if (tokens.some((t) => variants(t).some((v) => v.startsWith("קפוא")))) return "frozen";

  const words = tokens.flatMap(variants);
  const spaced = " " + tokens.join(" ");
  let best = null;
  for (const r of RULES) {
    let hit;
    if (r.phrase) hit = spaced.includes(" " + r.kw);
    else if (r.len <= 3) hit = words.includes(r.kw);
    else hit = words.some((w) => w.startsWith(r.kw));
    if (hit && (!best || r.w > best.w || (r.w === best.w && r.order < best.order))) best = r;
  }
  return best ? best.id : typoFallback(words);
}

// A typo in a long word ("עגבנוית", "מלפפונימ") should not make the product "other". Only for words of 6+ letters, only
// against keywords of 6+ letters, only one slip away (a wrong, missing, extra or swapped letter), and only when every
// close keyword is in the same section; otherwise it stays "other" and the family corrects it once.
function within1(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a === b) return true;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const A = a.slice(i), B = b.slice(i);
  if (A.length === B.length) return A.slice(1) === B.slice(1) || (A[0] === B[1] && A[1] === B[0] && A.slice(2) === B.slice(2));
  const [long, short] = A.length > B.length ? [A, B] : [B, A];
  return long.slice(1) === short;
}
const FUZZY_RULES = RULES.filter((r) => !r.phrase && r.len >= 6 && r.w === r.len); // product keywords, not brands
function typoFallback(words) {
  const hits = new Set();
  for (const w of words) {
    if (w.length < 6) continue;
    for (const r of FUZZY_RULES) {
      for (const n of [r.len - 1, r.len, r.len + 1]) if (n >= 6 && within1(w.slice(0, n), r.kw)) { hits.add(r.id); break; }
    }
  }
  return hits.size === 1 ? [...hits][0] : "other";
}

// Helpers for splitting a spoken sentence ("חלב ביצים שמן זית") into products.
export const isKnownWord = (t) => classify(t) !== "other";
// How many words starting at tokens[i] form a known multi-word product (3, 2) or 0.
export function phraseLengthAt(tokens, i) {
  for (const n of [3, 2]) {
    const slice = tokens.slice(i, i + n);
    if (slice.length < n) continue;
    const cand = slice.join(" ").toLowerCase();
    if (RULES.some((r) => r.phrase && r.kw.split(" ").length === n && cand.startsWith(r.kw))) return n;
  }
  return 0;
}

// ---- learned corrections (per cart): "how this family files a product" ----
const learned = new Map();

// Normalised key: words only, no quantities/punctuation ("2 לחמים!" → "לחמים").
export function learnKey(name) {
  return tokenize(name).filter((t) => !/^\d+$/.test(t)).join(" ").slice(0, 40);
}
export function setLearned(map) {
  learned.clear();
  for (const [k, v] of Object.entries(map || {})) if (typeof v === "string") learned.set(k, v);
}
export function rememberLocally(name, id) {
  const k = learnKey(name);
  if (k) learned.set(k, id);
  return k;
}

// Stored order may be missing new categories or contain removed ones.
export function normalizeOrder(saved) {
  const valid = Array.isArray(saved) ? saved.filter((id) => byId.has(id)) : [];
  const result = [...new Set(valid)];
  // A section the family has never seen (added later) goes right after its default neighbour, not at the very end.
  DEFAULT_ORDER.forEach((id, i) => {
    if (result.includes(id)) return;
    const prev = i ? result.indexOf(DEFAULT_ORDER[i - 1]) : -1;
    result.splice(prev + 1, 0, id);
  });
  return result;
}
