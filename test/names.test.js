import { test } from "node:test";
import assert from "node:assert/strict";
import { matchKey, sameProduct, typedMatches, numberWordsToDigits, stripFiller, stem } from "../public/names.js";

test("the same product under another spelling gets the same key", () => {
  const same = [["בננה", "בננות"], ["ביצה", "ביצים"], ["עגבנייה", "עגבניות"], ["הלחם", "לחם"], ["תפוח", "תפוחים"],
    ["גזר", "גזרים"], ["פיתה", "פיתות"], ["קוטג'", "קוטג׳"], ["קוטג'", "קוטג"], ["גבינה צהובה", "גבינות צהובות"], ["בצל", "בצלים"], ["לחמנייה", "לחמניות"], ["נקניקיה", "נקניקיות"], ["עוגייה", "עוגיות"]];
  for (const [a, b] of same) assert.ok(sameProduct(a, b), `${a} / ${b}`);
});

test("different products never share a key", () => {
  const diff = [["חלב", "חלב 3%"], ["חלה", "חלב"], ["חלב", "חלבה"], ["מים", "מיץ"], ["תה", "תות"], ["שמן זית", "שמן קנולה"], ["גבינה צהובה", "גבינה לבנה"], ["אורז", "אורז בסמטי"],
    ["עוגיות", "עוגה"], ["סוכריות", "סוכר"], ["נקניקיות", "נקניק"]]; // cookies, candies and sausages are not cake, sugar and a cold cut
  for (const [a, b] of diff) assert.ok(!sameProduct(a, b), `${a} / ${b}`);
});

test("short words are left alone and an empty name matches nothing", () => {
  assert.equal(stem("מים"), "מימ");   // only the final letter is normalised
  assert.equal(stem("תה"), "תה");
  assert.equal(stem("חלה"), "חלה");
  assert.equal(sameProduct("", ""), false);
  assert.equal(sameProduct("!!!", "---"), false);
});

test("typing matches the start of words, in any order of words, and a typed singular finds the plural", () => {
  assert.ok(typedMatches("עגב", "עגבניות שרי"));
  assert.ok(typedMatches("גבינה צ", "גבינה צהובה"));
  assert.ok(typedMatches("בננה", "בננות"));
  assert.ok(typedMatches("צהובה גב", "גבינה צהובה"));
  assert.ok(!typedMatches("חל", "גבינה"));
  assert.ok(!typedMatches("", "חלב"));
});

test("number words become digits only when a product follows", () => {
  assert.equal(numberWordsToDigits("שלוש בננות"), "3 בננות");
  assert.equal(numberWordsToDigits("שתי חלב"), "2 חלב");
  assert.equal(numberWordsToDigits("זוג גרביים"), "2 גרביים");
  assert.equal(numberWordsToDigits("זוג"), "זוג");
  assert.equal(numberWordsToDigits("חלב שלוש"), "חלב שלוש");
});

test("fillers in front of a product are dropped, but a lone filler word is kept", () => {
  assert.equal(stripFiller("עוד חלב"), "חלב");
  assert.equal(stripFiller("לא לשכוח עוד ביצים"), "ביצים");
  assert.equal(stripFiller("גם"), "גם");
  assert.equal(stripFiller("חלב גם"), "חלב גם");
});
