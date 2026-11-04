// Fresh produce, priced per kilo. These items are sold by weight, so their barcodes are chain-internal and
// differ everywhere: instead of a barcode, each entry says which item NAME to take at every chain (`re`, tested
// against the weighted items; the shortest, most generic name wins, then the lowest price). Every price in
// prices.json is the shelf price per kg.
//
//   unitKg  assumed weight of ONE unit of what a family types ("3 אפרסמון" = 3 x 0.2 kg; "עגבניות" = 1 unit = 1 kg).
//           The app labels these totals as estimates.
//   aliases / not / nums   as in reference-products.mjs
const v = (id, name, aliases, re, unitKg, extra = {}) => ({ id, name, aliases, re, unitKg, ...extra });

export const PRODUCE = [
  v("tomato", "עגבניה", ["עגבניה", "עגבניות", "עגבניות לסלט"], /^עגבניה$/, 1),
  v("cherry-tomato", "עגבניות שרי", ["עגבניות שרי", "עגבניה שרי", "שרי"], /^עגבני(ה|ות) שרי/, 0.5),
  v("cucumber", "מלפפון", ["מלפפון", "מלפפונים"], /^מלפפון$/, 1),
  v("carrot", "גזר", ["גזר", "גזרים"], /^גזר( ארוז| תפזורת)?$/, 1),
  v("white-cabbage", "כרוב לבן", ["כרוב", "כרוב לבן"], /^כרוב לבן$/, 1.2),
  v("red-cabbage", "כרוב אדום", ["כרוב אדום"], /^כרוב אדום$/, 1, { nums: [] }),
  v("cauliflower", "כרובית", ["כרובית"], /^כרובית$/, 1),
  v("onion", "בצל", ["בצל", "בצלים", "בצל יבש"], /^בצל( יבש)?$/, 0.15, { not: ["ירוק", "סגול", "אדום", "קפוא"] }),
  v("red-onion", "בצל אדום", ["בצל אדום", "בצל סגול"], /^בצל( יבש)? אדום$/, 0.2),
  v("garlic", "שום", ["שום", "ראש שום"], /^שום (בתפזורת|לח|יבש תפזורת)$/, 0.05),
  v("potato", "תפוח אדמה", ["תפוח אדמה", "תפוחי אדמה", "תפוא", "תפו״א"], /^תפוח אדמה (לבן ארוז|תפזורת)$/, 1),
  v("zucchini", "קישוא", ["קישוא", "קישואים", "זוקיני"], /^קישוא( ירוק \(זוקיני\)| זוקיני ירוק)?$/, 0.2),
  v("eggplant", "חציל", ["חציל", "חצילים"], /^חציל$/, 0.4),
  v("red-pepper", "פלפל אדום", ["פלפל אדום", "פלפלים אדומים"], /^פלפל אדום$/, 0.25),
  v("sweet-potato", "בטטה", ["בטטה", "בטטות"], /^בטטה( ארוזה| מובחרת)?$/, 0.5),
  v("beet", "סלק", ["סלק"], /^סלק( אדום)?$/, 0.3),
  v("banana", "בננה", ["בננה", "בננות"], /^בנ(נה|נות)( מובחרת)?$/, 1),
  v("apple", "תפוח עץ גאלה", ["תפוח", "תפוחים", "תפוח עץ", "תפוחי עץ", "תפוח גאלה"], /^תפוח עץ (גאלה|גלה)( \d+)?$/, 1, { not: ["אדמה"] }),
  v("orange", "תפוז", ["תפוז", "תפוזים"], /^תפוז$/, 1),
  v("clementine", "קלמנטינה", ["קלמנטינה", "קלמנטינות", "קלמנטינה"], /^קלמנטינה( \d+)?$/, 0.1),
  v("lemon", "לימון", ["לימון", "לימונים"], /^לימון$/, 0.12),
  v("avocado", "אבוקדו", ["אבוקדו", "אבוקדו אס"], /^אבוקדו$/, 0.25),
  v("mango", "מנגו", ["מנגו"], /^מנגו$/, 0.4),
  v("persimmon", "אפרסמון", ["אפרסמון", "אפרסמונים"], /^אפרסמון( \d+)?$/, 0.2),
  v("nectarine", "נקטרינה", ["נקטרינה", "נקטרינות"], /^נקטרינה( \d+)?$/, 0.15),
  v("peach", "אפרסק", ["אפרסק", "אפרסקים"], /^אפרסק$/, 0.2),
];
