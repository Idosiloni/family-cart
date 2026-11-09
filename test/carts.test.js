import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CODE_ALPHABET, CODE_LEN, DEFAULT_CART_NAME, MAX_CARTS, ID_RE, newCartId, newCode, normalizeCode, formatCode,
  parseHash, parseCarts, defaultName, useCart, renameCart, removeCart, joinUrl, inviteExpiry,
} from "../public/carts.js";

const id = (n) => n.toString(16).padStart(32, "0");

test("alphabet is 32 symbols and has no look-alikes", () => {
  assert.equal(CODE_ALPHABET.length, 32);
  assert.equal(new Set(CODE_ALPHABET).size, 32);
  for (const bad of "01OI") assert.ok(!CODE_ALPHABET.includes(bad));
});

test("generated ids and codes have the right shape", () => {
  for (let i = 0; i < 200; i++) {
    assert.match(newCartId(), ID_RE);
    const c = newCode();
    assert.equal(c.length, CODE_LEN);
    assert.ok([...c].every((ch) => CODE_ALPHABET.includes(ch)));
  }
});

test("codes are typed forgivingly and bad ones are rejected", () => {
  assert.equal(normalizeCode("kfrt-4829"), "KFRT4829");
  assert.equal(normalizeCode("  kfrt 4829 "), "KFRT4829");
  assert.equal(normalizeCode("KFRT4829"), "KFRT4829");
  assert.equal(normalizeCode("KFRT482"), "");     // too short
  assert.equal(normalizeCode("KFRT48290"), "");   // too long
  assert.equal(normalizeCode("KFRT-4O29"), "");   // O is not in the alphabet
  assert.equal(normalizeCode(null), "");
  assert.equal(formatCode("KFRT4829"), "KFRT-4829");
});

test("the hash is a cart, an invite, a bad invite or nothing", () => {
  assert.deepEqual(parseHash("#" + id(5)), { cart: id(5) });
  assert.deepEqual(parseHash("#join=kfrt-4829"), { join: "KFRT4829" });
  assert.deepEqual(parseHash("#join=KFRT%204829"), { join: "KFRT4829" });
  assert.deepEqual(parseHash("#join=nope"), { join: "bad" });
  assert.deepEqual(parseHash("#demo"), {});
  assert.deepEqual(parseHash(""), {});
  assert.deepEqual(parseHash("#" + id(255).toUpperCase()), {}); // ids are lower-case hex only
  assert.equal(joinUrl("https://x.app/", "ABCD2345"), "https://x.app/#join=ABCD2345");
});

test("invites expire in the future, within the rules' limit", () => {
  const now = 1_000_000;
  assert.ok(inviteExpiry(now) > now);
  assert.ok(inviteExpiry(now) - now <= 7 * 86400000);
});

test("stored carts: malformed input is dropped, not thrown", () => {
  assert.deepEqual(parseCarts("not json"), []);
  assert.deepEqual(parseCarts('{"a":1}'), []);
  assert.deepEqual(parseCarts(null), []);
  const list = parseCarts(JSON.stringify([
    { id: id(1), name: "  בית  ", used: 5 }, { id: id(1), name: "dup", used: 9 },
    { id: "short", name: "x" }, null, { id: id(2), used: 7 },
  ]));
  assert.deepEqual(list.map((c) => [c.id, c.name]), [[id(2), DEFAULT_CART_NAME], [id(1), "בית"]]);
});

test("a first cart keeps the old title, later ones are numbered without clashing", () => {
  assert.equal(defaultName([]), DEFAULT_CART_NAME);
  const one = useCart([], id(1), "", 10);
  assert.equal(one[0].name, DEFAULT_CART_NAME);
  const two = useCart(one, id(2), "", 20);
  assert.equal(two[0].name, "עגלה 2");
  const three = useCart(two, id(3), "", 30);
  assert.equal(three[0].name, "עגלה 3");
  assert.equal(new Set(three.map((c) => c.name)).size, 3);
});

test("using a cart moves it to the front and keeps its name unless given a better one", () => {
  let l = useCart([], id(1), "בית", 10);
  l = useCart(l, id(2), "הורים", 20);
  assert.deepEqual(l.map((c) => c.id), [id(2), id(1)]);
  l = useCart(l, id(1), "", 30);
  assert.deepEqual(l.map((c) => [c.id, c.name]), [[id(1), "בית"], [id(2), "הורים"]]);
  l = useCart(l, id(1), "הבית", 40);
  assert.equal(l[0].name, "הבית");
});

test("rename ignores empty names; remove drops one cart; the list is capped", () => {
  let l = useCart([], id(1), "בית", 1);
  assert.equal(renameCart(l, id(1), "   ")[0].name, "בית");
  assert.equal(renameCart(l, id(1), " חדש ")[0].name, "חדש");
  assert.deepEqual(removeCart(l, id(1)), []);
  let big = [];
  for (let i = 1; i <= MAX_CARTS + 5; i++) big = useCart(big, id(i), `c${i}`, i);
  assert.equal(big.length, MAX_CARTS);
  assert.equal(big[0].id, id(MAX_CARTS + 5)); // the newest survive
});
