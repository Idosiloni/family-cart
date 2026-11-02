import { test } from "node:test";
import assert from "node:assert/strict";
import { greeting, clock, shareText } from "../public/format.js";

test("greeting follows the hour of the day", () => {
  assert.equal(greeting(3), "לילה טוב");
  assert.equal(greeting(8), "בוקר טוב");
  assert.equal(greeting(13), "צהריים טובים");
  assert.equal(greeting(19), "ערב טוב");
  assert.equal(greeting(23), "לילה טוב");
});

test("clock formats seconds as m:ss", () => {
  assert.equal(clock(0), "0:00");
  assert.equal(clock(75), "1:15");
  assert.equal(clock(599.9), "9:59");
  assert.equal(clock(-5), "0:00");
});

test("shareText groups what is left by section, with quantities and notes", () => {
  const text = shareText([
    { cat: { name: "חלב וביצים" }, todo: [{ name: "חלב", qty: 2 }, { name: "ביצים", note: "L" }] },
    { cat: { name: "משקאות" }, todo: [] },
    { cat: { name: "לחם ומאפים" }, todo: [{ name: "לחם" }] },
  ]);
  assert.equal(text, ["העגלה המשפחתית, נשארו 3:", "", "*חלב וביצים*", "• חלב ×2", "• ביצים (L)", "", "*לחם ומאפים*", "• לחם"].join("\n"));
});

test("shareText is empty when everything is already in the cart", () => {
  assert.equal(shareText([{ cat: { name: "x" }, todo: [] }]), "");
});
