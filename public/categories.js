// Supermarket sections. Order below = default walking order (entrance → checkout).
// Real aisle order differs per store, so the family can re-order it in the app.
//
// Matching (see classify): word-aware, not substring.
//  - keyword with 3 letters or fewer must equal a whole word ("מים", "תה", "חלב")
//  - longer keyword matches the start of a word ("עגבני" → עגבניות)
//  - keyword with a space is a phrase matched from the start of a word
//  - the longest matching keyword wins ("שוקולד חלב" → snacks, "חלב שקדים" → dairy)
import { EXTRA, BRANDS } from "./catalog.js";

export const CATEGORIES = [
  { id: "produce", bg: "#2A3DE0", fg: "#FFFFFF", icon: "produce", hue: 140, emoji: "🥬", name: "פירות וירקות",
    keywords: ["בצל ירוק", "בצל סגול", "פלפל חריף", "תפוח עץ", "חסה אמריקאית", "עגבניות שרי", "עגבני", "מלפפון", "מלפפונים", "בצל", "בצלים", "שום", "תפוח אדמה", "תפוחי אדמה", "גזר", "חסה", "פלפל", "פלפלים", "גמבה", "חציל", "קישוא", "זוקיני", "כרוב", "כרובית", "ברוקולי", "תפוח", "תפוחים", "בננ", "תפוז", "לימון", "ליים", "אבוקדו", "ענבים", "אבטיח", "מלון", "מלונים", "אפרסק", "שזיף", "תות", "תותים", "נענע", "מנטה", "פטרוזיל", "כוסברה", "שמיר", "עירית", "בזיליקום", "בטטה", "דלעת", "פטריות", "פטרייה", "אגס", "קלמנטינ", "אשכולית", "רימון", "מנגו", "אננס", "קיווי", "דובדבן", "נקטרינ", "משמש", "תאנ", "פירות", "ירקות", "סלרי", "צנונית", "צנון", "סלק", "רוקט", "תרד", "קייל", "לפת", "קולורבי", "תירס טרי", "שעועית ירוקה", "ג'ינג'ר", "זנגוויל", "נבטים", "שאלוט", "כרישה", "ארטישוק", "אספרגוס", "כרוב סיני", "בוק צוי", "אוכמניות", "פטל", "עלים", "ירק", "פרי"] },
  { id: "bakery", bg: "#EADFC8", fg: "#0D0D0D", icon: "bakery", hue: 32, emoji: "🥖", name: "לחם ומאפים",
    keywords: ["לחם מלא", "לחם קל", "לחם אחיד", "לחם שיפון", "לחם פרוס", "עוגת שוקולד", "לחם", "לחמני", "פיתה", "פיתות", "חלה", "חלות", "בגט", "טורטייה", "לאפה", "עוגה", "עוגות", "עוגיות", "בורקס", "קרואסון", "מאפה", "מאפים", "בייגל", "טוסט", "סופגני", "רוגלך", "פחזני", "לחמים", "לחם קלוי", "קלאמטה"] },
  { id: "dairy", bg: "#F5E663", fg: "#0D0D0D", icon: "dairy", hue: 205, emoji: "🥛", name: "חלב וביצים",
    keywords: ["גבנ״צ", "גבנ\"צ", "גבנצ", "פרזמן", "פרמזן", "גבינה צהובה", "גבינה לבנה", "גבינה בולגרית", "גבינה מגורדת", "גבינה מלוחה", "שוקו קר", "חלב", "גבינ", "קוטג", "יוגורט", "שמנת", "חמאה", "ביצים", "ביצה", "ביצי", "לבן", "לבנה", "מעדן", "מעדני", "מוצרלה", "צהובה", "שוקו", "אשל", "קממבר", "פטה", "מרגרינה", "דנונה", "משקה סויה", "משקה שקדים", "משקה שיבולת", "חלב שקדים", "חלב סויה", "חלב שיבולת", "חלב עיזים", "ריקוטה", "פרמזן", "ברי", "גאודה", "בולגרית", "סמנה", "קשקבל", "אמנטל", "קרם פרש", "שמנת חמוצה", "קפיר", "מילקי", "אקטיביה", "יופלה", "תנובה", "שטראוס", "יטבתה", "טרה", "פודינג", "גבינת שמנת"] },
  { id: "meat", bg: "#FF9FA8", fg: "#0D0D0D", icon: "meat", hue: 6, emoji: "🍗", name: "בשר, עוף ודגים",
    keywords: ["שניצל עוף", "חזה עוף", "חזה הודו", "נקניקיות עוף", "כנפיים עוף", "שוקיים עוף", "כבד עוף", "המבורגר בקר", "עוף", "חזה", "שניצל", "בשר", "טחון", "סטייק", "נקניק", "נקניקיות", "נקניקיה", "המבורגר", "כנפיים", "שוקיים", "דג", "דגים", "סלמון", "פילה", "אנטריקוט", "קבב", "הודו", "פסטרמה", "קצבים", "כבד", "לבבות", "צלעות", "אסאדו", "סינטה", "שייטל", "כרעיים", "פרגית", "פרגיות", "שווארמה", "בקר", "כבש", "קציצות", "נגיסים", "בורי", "דניס", "לברק", "אמנון", "קרפיון", "פורל", "הרינג", "סלמי", "קבנוס", "בייקון", "ברווז", "אווז", "צלי", "רוסטביף", "שיפודים", "עגל", "מקרל", "טונה טרייה", "עוף שלם", "בשר טחון", "סרדינים טריים", "סלמון מעושן"] },
  { id: "pantry", bg: "#FF7A45", fg: "#0D0D0D", icon: "pantry", hue: 45, emoji: "🥫", name: "מזווה ויבשים",
    keywords: ["קמח מלא", "פסטה מלאה", "אורז מלא", "קמח תופח", "סוכר חום", "מלח גס", "שמן ספריי", "רסק עגבניות", "טחינה מלאה", "קפה שחור", "קפה טורקי", "תה נענע", "אורז", "פסטה", "ספגטי", "קוסקוס", "קמח", "סוכר", "מלח", "שמן", "חומץ", "רסק", "קטשופ", "מיונז", "חרדל", "טחינה", "חומוס", "שימורים", "טונה", "תירס", "זיתים", "מלפפונים חמוצים", "חמוצים", "אפונה", "שעועית", "עדשים", "בורגול", "שיבולת שועל", "קורנפלקס", "דגני", "גרנולה", "קפה", "תה", "נס", "שוקולד לאפייה", "אבקת אפייה", "אבקת אפיה", "אבקת סוכר", "אבקת קקאו", "תבלין", "תבלינ", "פפריקה", "כמון", "קינמון", "פלפל שחור", "קורנפלור", "עמילן", "סולת", "קינואה", "כוסמת", "שמרים", "וניל", "סודה לשתייה", "קקאו", "דבש", "ריבה", "נוטלה", "סילאן", "מרק", "רוטב", "פירורי", "קטניות", "אגוזים", "שקדים", "צימוקים", "פתיתים", "חמאת בוטנים", "קשיו", "פיסטוק", "פסטו", "סויה", "טריאקי", "אטריות", "נודלס", "לזניה", "מקרוני", "פנה", "פוזילי", "עגבניות מרוסקות", "עגבניות מיובשות", "רוטב עגבניות", "גרגירי חומוס", "פול", "שמן זית", "שמן קנולה", "שמן חמניות", "ממתיק", "סוכרזית", "סטיביה", "חלב קוקוס", "עלי גפן", "קפסולות", "קפה נמס", "תה ירוק", "תיונים", "חליטה", "מצות", "מלח ים", "אסם", "תלמה", "יכין", "סוגת", "מגדים", "טחינה גולמית", "פולנטה", "אורז בסמטי", "ממרח", "ריבת", "מייפל", "פירות יבשים", "תמרים", "צנוברים", "שומשום", "זעתר", "סומאק", "אבקת מרק", "קובייות מרק", "כרוב כבוש"] },
  { id: "snacks", bg: "#FFC7D9", fg: "#0D0D0D", icon: "snacks", hue: 320, emoji: "🍫", name: "חטיפים וממתקים",
    keywords: ["שוקולד מריר", "שוקולד חלב", "שוקולד לבן", "עוגיות שוקולד", "חטיף שוקולד", "חטיף", "חטיפים", "חטיפי", "במבה", "ביסלי", "שוקולד", "ממתק", "ממתקים", "מסטיק", "סוכריות", "סוכרייה", "פופקורן", "צ'יפס", "צ׳יפס", "תפוצ'יפס", "פרינגלס", "וופל", "ופלים", "חלבה", "גרעינים", "בוטנים", "פיצוחים", "אגוזי", "קרקר", "קרקרים", "פסק זמן", "קליק", "כיף כף", "טופי", "מרשמלו", "דובונים", "גומי", "דוריטוס", "קינדר", "מרס", "סניקרס", "טוויקס", "חטיף אנרגיה", "אוראו", "אכלס", "עלית", "מקופלים"] },
  { id: "drinks", bg: "var(--ink)", fg: "var(--bg)", icon: "drinks", hue: 185, emoji: "🥤", name: "משקאות",
    keywords: ["מיץ תפוזים", "מיץ ענבים", "מיץ תפוחים", "מיץ לימון", "מיץ גזר", "בירה שחורה", "יין אדום", "יין לבן", "מים", "קולה", "קוקה", "פפסי", "ספרייט", "פאנטה", "מיץ", "מיצים", "סודה", "בירה", "יין", "יינות", "וודקה", "וויסקי", "ג'ין", "רום", "טקילה", "קוניאק", "ערק", "שמפניה", "ליקר", "משקה", "משקאות", "שתייה", "תרכיז", "נביעות", "מי עדן", "פרייה", "שוופס", "קריסטל", "נסטי", "לימונדה", "פחית", "פחיות", "מים מינרליים", "מים בטעמים", "מים עם גז", "מי סודה", "רד בול", "אנרג'י", "טמפו", "איזוטוני", "פריגת", "פרימור", "תפוזינה", "תה קר", "אייס", "גולדסטאר", "מכבי", "קורונה", "היינקן", "סיידר", "בקבוק מים"] },
  { id: "frozen", bg: "#BFE3FF", fg: "#0D0D0D", icon: "frozen", hue: 225, emoji: "🧊", name: "קפואים",
    keywords: ["קפוא", "פיצה", "שניצלונים", "ג'חנון", "גחנון", "מלוואח", "בצק עלים", "גלידה", "גלידות", "קרח", "מגנום", "סורבה", "אדממה", "בורקסים", "פופסיקל", "בצק"] },
  { id: "cleaning", bg: "#DCD3FF", fg: "#0D0D0D", icon: "cleaning", hue: 165, emoji: "🧽", name: "ניקיון וכביסה",
    keywords: ["אבקת כביסה", "מרכך כביסה", "מרכך", "נוזל כלים", "סבון כלים", "כלים", "אקונומיקה", "מנקה", "ספוג", "סקוטש", "שקיות אשפה", "שקיות", "שקית", "נייר סופג", "מגבות נייר", "נייר אלומיניום", "אלומיניום", "ניילון", "נייר אפייה", "מטהר", "ג'ל כביסה", "כביסה", "ניקוי", "סמרטוט", "מטליות", "סבון רצפה", "חומר ניקוי", "מסיר", "סנו", "פיירי", "אריאל", "טייד", "דסטוס", "מפיות", "חד פעמי", "צלחות", "כוסות", "סכו\"ם", "נרות", "גפרורים", "סוללות", "נורות", "מנקה חלונות", "מסיר אבנית", "מנקה אסלה", "מטאטא", "מגב", "דלי", "כפפות"] },
  { id: "hygiene", bg: "#FFD9A8", fg: "#0D0D0D", icon: "hygiene", hue: 280, emoji: "🧴", name: "היגיינה וטיפוח",
    keywords: ["שמפו", "מרכך שיער", "סבון", "משחת שיניים", "משחה", "מברשת שיניים", "מברשת", "דאודורנט", "דיאודורנט", "נייר טואלט", "נייר", "טישו", "תחבושות", "תחבושת", "טמפונים", "קרם", "גילוח", "סכיני", "מגבונים לחים", "צמר גפן", "ג'ל רחצה", "ג'ל שיער", "בושם", "וזלין", "פדים", "מי פה", "חוט דנטלי", "קוטונטים", "לק", "ויטמין", "ויטמינים", "אקמול", "נורופן", "פלסטר", "אפטר שייב", "סבון ידיים", "נוזל רחצה", "קרם הגנה", "קרם ידיים", "שפתון", "קולגייט", "סנסודיין", "אופטיק", "מגבת"] },
  { id: "baby", bg: "#F3C6FF", fg: "#0D0D0D", icon: "baby", hue: 345, emoji: "🍼", name: "תינוקות",
    keywords: ["חיתולים", "חיתול", "מטרנה", "תמל", "תמ\"ל", "סימילאק", "נוטרילון", "פרוטרון", "מוצץ", "בקבוק", "דייסה", "דייסת", "מחית", "מגבונים לתינוק", "האגיס", "פמפרס", "תינוק", "בייבי"] },
  { id: "other", bg: "#E3E3DE", fg: "#0D0D0D", icon: "other", hue: 100, emoji: "🛍️", name: "אחר", keywords: [] },
];

// Merge the extra vocabulary; brand names move to their own low-priority rules.
for (const c of CATEGORIES) {
  const brands = new Set(BRANDS[c.id] || []);
  c.keywords = [...new Set([...c.keywords, ...(EXTRA[c.id] || [])])].filter((k) => !brands.has(k));
}

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
const productRules = (c, order) =>
  c.keywords.flatMap((kw) => [kw, pluralOf(kw)].filter(Boolean).map((k) => rule(k, c.id, order, false)));
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
  return best ? best.id : "other";
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
  const unique = [...new Set(valid)];
  return [...unique, ...DEFAULT_ORDER.filter((id) => !unique.includes(id))];
}
