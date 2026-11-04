// A directory of Israeli supermarket chains, for the "which store?" pickers and the store notes.
// Facts come from the sources listed per chain (checked November 2026); nothing here is a price.
// There are deliberately NO numeric "price indexes": surveys disagree and age fast, so the few dated
// surveys we found are kept separately in SURVEYS with their date, basis and link.
//
//   id          matches prices.json chain ids where we hold real shelf prices (hasData: true)
//   type        "discount" | "hard-discount" | "regular" | "premium" | "religious" (the way it markets itself)
//   priceFiles  "manual"  behind a login: a person downloads the file and passes it to build-prices.mjs (Osher Ad)
//               "public"  the chain's price files are downloadable without a login and are used for prices.json
//               "login"   the files sit behind the publishedprices.co.il login; deliberately not used
//               "none"    no file we could fetch automatically (see researchNote)

export const TYPE_LABELS = {
  discount: "דיסקאונט",
  "hard-discount": "הארד דיסקאונט",
  regular: "רשת רגילה",
  premium: "פרימיום",
  religious: "כשרות מהדרין",
};

export const STORES = [
  {
    id: "shufersal", name: "שופרסל", type: "regular", hasData: true,
    traits: "הרשת הגדולה בישראל. פורמטים: דיל (דיסקאונט), שלי (שכונתי), אקספרס, יוניברס, ו״יש״ לציבור שומר מצוות.",
    website: "https://www.shufersal.co.il", priceFiles: "public",
    researchNote: "ויקיפדיה: 436 סניפים ב-2026, הסניף הראשון נפתח ב-1958. פורמט דיל נחשב לזול; שלי נוח אך יקר יותר מסניפים רחוקים. המחירים באפליקציה הם של דיל רעננה (קניון רננים).",
    sources: ["https://he.wikipedia.org/wiki/שופרסל", "https://prices.shufersal.co.il/"],
  },
  {
    id: "rami-levy", name: "רמי לוי", type: "discount", hasData: false,
    traits: "רשת דיסקאונט עם סניפים גדולים וזולים, ושיווק אונליין.",
    website: "https://www.rami-levy.co.il", priceFiles: "login",
    researchNote: "ויקיפדיה: 68 סניפים בספטמבר 2026. הזולה בסל אונליין בסקר גלובס (יוני 2023) ובסקר ישן מ-2021; נתפסת כזולה במדד תפיסת המחיר של מעריב 2025 (תפיסה, לא מדידה). קבצי המחירים שלה בכניסה עם שם משתמש, לכן אין לנו מחירים. אפשר להזין ידנית.",
    sources: ["https://he.wikipedia.org/wiki/רמי_לוי_שיווק_השקמה", "https://en.globes.co.il/en/article-survey-finds-carrefour-hypermarkets-are-israels-cheapest-1001451842", "https://www.maariv.co.il/economy/israel/article-1258470"],
  },
  {
    id: "victory", name: "ויקטורי", type: "regular", hasData: false,
    traits: "רשת סופרמרקטים ארצית בגודל בינוני.",
    website: "https://www.victoryonline.co.il", priceFiles: "public",
    researchNote: "ויקיפדיה (תקציר חיפוש): 68 סניפים באוגוסט 2023. בסקר ישן מ-2021 (837 ש״ח בסל) דורגה שנייה אחרי רמי לוי. קבצי המחירים שלה בפרסום פתוח באתר laibcatalog.co.il (בלי התחברות), אבל לא כללנו אותה בהשוואה כי המשפחה לא קונה בה.",
    sources: ["https://he.wikipedia.org/w/index.php?search=ויקטורי+רשת+סופרמרקטים", "https://www.pressreader.com/israel/jerusalem-post/20210624/281659668007290", "https://laibcatalog.co.il/"],
  },
  {
    id: "yochananof", name: "יוחננוף", type: "regular", hasData: false,
    traits: "סופרשוק ארצי, בבעלות משפחתית ונסחר בבורסה.",
    website: "https://yochananof.co.il", priceFiles: "login",
    researchNote: "ויקיפדיה: 42 סניפים ב-2023, נסחרת בבורסה מנובמבר 2019, רכשה ב-2021 50.1% מזול סטוק. קבצי המחירים בכניסה עם שם משתמש, לכן אין לנו מחירים.",
    sources: ["https://he.wikipedia.org/wiki/רשת_יוחננוף"],
  },
  {
    id: "osher-ad", name: "אושר עד", type: "discount", hasData: true,
    traits: "רשת דיסקאונט של סניפים גדולים (כ-6,000 מ״ר בממוצע). לא מכוונת רק לציבור החרדי.",
    website: "https://www.osherad.co.il", priceFiles: "manual",
    researchNote: "ויקיפדיה: נוסדה ב-2009, 24 סניפים ב-2026, שלישית בגודלה במכירות לפי דירוג D&B 2023. נתפסת כזולה במדד תפיסת המחיר של מעריב 2025. קבצי המחירים שלה בכניסה עם שם משתמש, ולכן המחירים באפליקציה הם מקובץ שהורד ידנית (לא אוטומטית) של אושר עד כפר סבא.",
    sources: ["https://he.wikipedia.org/wiki/אושר_עד", "https://www.maariv.co.il/economy/israel/article-1258470"],
  },
  {
    id: "carrefour", name: "קרפור", type: "discount", hasData: true,
    traits: "פורמט היפר (גדול, בפאתי הערים) ופורמט סיטי שכונתי. הוקמה בישראל מהסבת סניפי יינות ביתן ומגה ב-2023.",
    website: "https://www.carrefour.co.il", priceFiles: "public",
    researchNote: "בסקר גלובס (יוני 2023) הסל הזול ביותר היה בקרפור היפר, שפעל אז רק בבית שמש, נתניה ורעננה. כ-50 סניפים הוסבו למותג בשנת 2023. המחירים באפליקציה הם של קרפור היפר רעננה.",
    sources: ["https://en.globes.co.il/en/article-survey-finds-carrefour-hypermarkets-are-israels-cheapest-1001451842", "https://www.timesofisrael.com/french-retail-chain-carrefour-opens-50-stores-across-israel-vowing-to-disrupt-prices/", "https://prices.carrefour.co.il/"],
  },
  {
    id: "hazihinam", name: "חצי חינם", type: "discount", hasData: true,
    traits: "רשת קטנה במרכז הארץ: ראשון לציון, חולון, פתח תקווה, הוד השרון ורחובות.",
    website: "https://www.hazi-hinam.co.il", priceFiles: "public",
    researchNote: "ויקיפדיה: 8 סניפים ב-2025, המטה בחולון, חברה פרטית. הסניף שלנו: הוד השרון. בקבצים יש גם סניף משלוחים (103) שלא נכלל בהשוואה.",
    sources: ["https://he.wikipedia.org/wiki/חצי_חינם", "https://shop.hazi-hinam.co.il/Prices"],
  },
  {
    id: "tiv-taam", name: "טיב טעם", type: "regular", hasData: false,
    traits: "רשת לא כשרה, רוב הסניפים פתוחים גם בשבת ובחגים.",
    website: "https://www.tivtaam.co.il", priceFiles: "login",
    researchNote: "ויקיפדיה: פועלת מ-1990, 46 סניפים בינואר 2024, השביעית בגודלה לפי מספר סניפים. קבצי המחירים בכניסה עם שם משתמש, לכן אין לנו מחירים.",
    sources: ["https://he.wikipedia.org/wiki/טיב_טעם"],
  },
  {
    id: "keshet-teamim", name: "קשת טעמים", type: "regular", hasData: false,
    traits: "רשת לא כשרה, השנייה בגודלה בתחומה אחרי טיב טעם. כוללת גם חנויות עירוניות בשם קולינריק.",
    website: "https://www.keshet-teamim.co.il", priceFiles: "none",
    researchNote: "ויקיפדיה: פועלת מ-2002, 26 סניפים ב-2024 (22 גדולים ו-4 עירוניים). לא בדקנו את קבצי המחירים שלה.",
    sources: ["https://he.wikipedia.org/wiki/קשת_טעמים"],
  },
  {
    id: "yeinot-bitan", name: "יינות ביתן ומגה", type: "regular", hasData: false,
    traits: "קבוצת גלובל ריטייל: יינות ביתן, מגה (כולל מגה בעיר) ושוק מהדרין. חלק מהסניפים הוסבו לקרפור.",
    website: "https://www.ybitan.co.il", priceFiles: "none",
    researchNote: "ויקיפדיה: הקבוצה רכשה את מגה ב-2016, ב-2023 כ-50 סניפים הוסבו לקרפור. בסקר גלובס (יוני 2023) סל מגה בעיר ירד ב-1.7% וסל יינות ביתן בעיר ב-1.9%. לא בדקנו את קבצי המחירים שלה.",
    sources: ["https://he.wikipedia.org/wiki/יינות_ביתן", "https://en.globes.co.il/en/article-survey-finds-carrefour-hypermarkets-are-israels-cheapest-1001451842"],
  },
  {
    id: "machsanei-hashuk", name: "מחסני השוק", type: "hard-discount", hasData: false,
    traits: "רשת הארד דיסקאונט מבאר שבע, עם פורמט מהדרין נפרד.",
    website: null, priceFiles: "none",
    researchNote: "ויקיפדיה: נוסדה ב-1996 בבאר שבע, כ-70 סניפים בנובמבר 2025. בסקר גלובס (יוני 2023) היה הסל האונליין היקר ביותר, בפער של 12% מרמי לוי. אתר הקבצים laibcatalog.co.il מפרט אותה אבל לא הצלחנו למשוך ממנו קבצים.",
    sources: ["https://he.wikipedia.org/wiki/מחסני_השוק", "https://en.globes.co.il/en/article-survey-finds-carrefour-hypermarkets-are-israels-cheapest-1001451842"],
  },
];

// The few dated price surveys we found. Different baskets, dates and formats: do not rank chains by adding them up.
export const SURVEYS = [
  {
    date: "2023-07-10", publisher: "Globes",
    url: "https://en.globes.co.il/en/article-survey-finds-carrefour-hypermarkets-are-israels-cheapest-1001451842",
    basis: "סל של 68 מוצרים נמכרים (הוגדר ע״י הלמ״ס ומשרד הכלכלה), מחירי יוני 2023 מאתר Pricez",
    finding: "הסל הזול ביותר: קרפור היפר, 865 ש״ח. היקר ביותר: סופר יודה, 1,158 ש״ח. באונליין: רמי לוי הזול ומחסני השוק היקר, פער של 12%.",
  },
  {
    date: "2021-06-24", publisher: "Jerusalem Post (PressReader)",
    url: "https://www.pressreader.com/israel/jerusalem-post/20210624/281659668007290",
    basis: "סקר סל קניות של 2021. פרטי הסל לא נבדקו; התקבל מתקציר חיפוש",
    finding: "רמי לוי הזולה בין חנויות פיזיות (823 ש״ח), אחריה ויקטורי (837) ושופרסל דיל (845).",
  },
  {
    date: "2025", publisher: "מעריב",
    url: "https://www.maariv.co.il/economy/israel/article-1258470",
    basis: "מדד תפיסת המחיר: סקר של כ-1,000 צרכנים על התחושה של ״זול״, לא מחירים בקופה. התקבל מתקציר חיפוש; החודש לא נבדק",
    finding: "רמי לוי ואושר עד נתפסות כזולות; קרפור במקום הרביעי.",
  },
];

export const storeById = (id) => STORES.find((s) => s.id === id) || null;
