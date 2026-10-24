/* Unit tests: Hebrew number words and the exercise generator.
 * Run: node --test tests/ */
const test = require("node:test");
const assert = require("node:assert/strict");
const load = require("./load");

// Values from the app's context compare as plain data.
const plain = (x) => JSON.parse(JSON.stringify(x));

const App = load();
const { words, withVav } = App.num;
const G = App.gen;
const D = App.data;

// Niqqud marks can be stored in different orders; compare canonical forms.
const nfc = (s) => s.normalize("NFC");
const same = (a, b) => assert.equal(nfc(a), nfc(b));

test("numbers 0–20", () => {
  const expected = [
    "אֶפֶס", "אַחַת", "שְׁתַּיִם", "שָׁלוֹשׁ", "אַרְבַּע", "חָמֵשׁ", "שֵׁשׁ", "שֶׁבַע", "שְׁמוֹנֶה", "תֵּשַׁע", "עֶשֶׂר",
    "אַחַת עֶשְׂרֵה", "שְׁתֵּים עֶשְׂרֵה", "שְׁלוֹשׁ עֶשְׂרֵה", "אַרְבַּע עֶשְׂרֵה", "חֲמֵשׁ עֶשְׂרֵה",
    "שֵׁשׁ עֶשְׂרֵה", "שְׁבַע עֶשְׂרֵה", "שְׁמוֹנֶה עֶשְׂרֵה", "תְּשַׁע עֶשְׂרֵה", "עֶשְׂרִים",
  ];
  expected.forEach((w, n) => same(words(n), w));
});

test("tens", () => {
  const tens = { 30: "שְׁלוֹשִׁים", 40: "אַרְבָּעִים", 50: "חֲמִשִּׁים", 60: "שִׁשִּׁים", 70: "שִׁבְעִים", 80: "שְׁמוֹנִים", 90: "תִּשְׁעִים" };
  for (const [n, w] of Object.entries(tens)) same(words(Number(n)), w);
});

test("the ו takes its vowel from the next word", () => {
  same(words(21), "עֶשְׂרִים וְאַחַת");
  same(words(22), "עֶשְׂרִים וּשְׁתַּיִם"); // shva → וּ
  same(words(23), "עֶשְׂרִים וְשָׁלוֹשׁ");
  same(words(25), "עֶשְׂרִים וְחָמֵשׁ");
  same(words(28), "עֶשְׂרִים וּשְׁמוֹנֶה");
  same(words(29), "עֶשְׂרִים וְתֵשַׁע"); // no dagesh in ת after the ו
  same(words(99), "תִּשְׁעִים וְתֵשַׁע");
  same(withVav("חֲמִשִּׁים"), "וַחֲמִשִּׁים"); // hataf patah → וַ
  same(withVav("מֵאָה"), "וּמֵאָה"); // ב/מ/פ → וּ
});

test("hundreds and 1000", () => {
  same(words(100), "מֵאָה");
  same(words(101), "מֵאָה וְאַחַת");
  same(words(110), "מֵאָה וְעֶשֶׂר");
  same(words(112), "מֵאָה וּשְׁתֵּים עֶשְׂרֵה");
  same(words(115), "מֵאָה וַחֲמֵשׁ עֶשְׂרֵה");
  same(words(119), "מֵאָה וּתְשַׁע עֶשְׂרֵה");
  same(words(120), "מֵאָה וְעֶשְׂרִים");
  same(words(150), "מֵאָה וַחֲמִשִּׁים");
  same(words(200), "מָאתַיִם");
  same(words(300), "שְׁלוֹשׁ מֵאוֹת");
  same(words(325), "שְׁלוֹשׁ מֵאוֹת עֶשְׂרִים וְחָמֵשׁ");
  same(words(500), "חֲמֵשׁ מֵאוֹת");
  same(words(999), "תְּשַׁע מֵאוֹת תִּשְׁעִים וְתֵשַׁע");
  same(words(1000), "אֶלֶף");
  // Built from its parts: the hundreds, then the rest unchanged.
  same(words(347), words(300) + " " + words(47));
  same(words(830), words(800) + " " + withVav(words(30)));
});

test("every number 0–1000 has words, and only one ו", () => {
  for (let n = 0; n <= 1000; n++) {
    const w = words(n);
    assert.ok(w.length > 0);
    const vavs = w.split(" ").filter((x) => /^ו[ְֶַָּ]/.test(x)).length;
    assert.ok(vavs <= 1, `${n}: ${w}`);
    assert.equal(vavs, n > 20 && n % 10 !== 0 ? 1 : n > 100 && n % 100 !== 0 ? 1 : 0, `${n}: ${w}`);
  }
  assert.throws(() => words(-1));
  assert.throws(() => words(1001));
});

// ---------- Generator ----------
const REPS = 400;
const all = [];
for (const t of D.TOPICS) {
  t.levels.forEach((L, i) => {
    for (let r = 0; r < REPS; r++) all.push({ q: G.make(t.id, i + 1), L, t: t.id, lv: i + 1 });
  });
}

test("exercises are correct and never negative", () => {
  for (const { q } of all) {
    assert.equal(q.op === "+" ? q.a + q.b : q.a - q.b, q.c, JSON.stringify(q));
    for (const k of ["a", "b", "c"]) assert.ok(Number.isInteger(q[k]) && q[k] >= 0, JSON.stringify(q));
    assert.ok(["a", "b", "c"].includes(q.m));
  }
});

test("operands are never zero, results stay in range", () => {
  for (const { q, L } of all) {
    assert.ok(q.a > 0 && q.b > 0, JSON.stringify(q));
    if (L.max) assert.ok(Math.max(q.a, q.c) <= L.max, `${L.d}: ${JSON.stringify(q)}`);
    assert.ok(q.c <= 100 && q.a <= 100, JSON.stringify(q));
  }
});

const unitsCarry = (q) => (q.op === "+" ? (q.a % 10) + (q.b % 10) >= 10 : q.b % 10 > q.a % 10);

test("carrying only where the level allows it", () => {
  for (const { q, L } of all) {
    if (L.carry === false) assert.ok(!unitsCarry(q), `${L.d}: ${JSON.stringify(q)}`);
    if (L.carry === true) assert.ok(unitsCarry(q), `${L.d}: ${JSON.stringify(q)}`);
    if (L.kind === "addTens" || L.kind === "subTens") assert.ok(q.a % 10 === 0 && q.b % 10 === 0);
  }
});

test("levels that mix carrying have both kinds", () => {
  for (const kind of ["add2d1d", "sub2d1d"]) {
    const qs = all.filter((x) => x.L.kind === kind).map((x) => x.q);
    assert.ok(qs.some(unitsCarry) && qs.some((q) => !unitsCarry(q)), kind);
  }
});

test("friends of 10 / 20 / 100 add up to the total", () => {
  for (const { q, L } of all) {
    if (L.kind === "bond" && L.total) assert.equal(q.c, L.total);
    if (L.kind === "bond" && L.totalMin) assert.ok(q.c >= L.totalMin && q.c <= L.totalMax);
    if (L.kind === "toTen") assert.ok(q.c % 10 === 0 && q.c - q.a < 10 && q.a % 10 !== 0);
    if (L.kind === "bond100") assert.equal(q.c, 100);
    if (L.kind.startsWith("bond") || L.kind === "toTen") assert.notEqual(q.m, "c");
  }
});

test("missing-number exercises appear only where the level has them", () => {
  for (const t of D.TOPICS.filter((x) => x.id !== "bond")) {
    t.levels.forEach((L, i) => {
      const qs = all.filter((x) => x.t === t.id && x.lv === i + 1).map((x) => x.q);
      const missing = qs.filter((q) => q.m !== "c").length;
      if (!L.missing) assert.equal(missing, 0, L.d);
      else assert.ok(missing > 0 && missing < qs.length, L.d);
      // Subtraction never asks for the first number (? − 4 = 5).
      if (t.id === "sub") assert.ok(qs.every((q) => q.m !== "a"));
    });
  }
});

test("three choices: different, not negative, one of them right", () => {
  for (const { q } of all) {
    const cs = G.choices(q);
    assert.equal(cs.length, 3, JSON.stringify(q));
    assert.equal(new Set(cs).size, 3, JSON.stringify(q) + " " + cs);
    assert.ok(cs.includes(G.answer(q)));
    assert.ok(cs.every((n) => Number.isInteger(n) && n >= 0), cs.join());
  }
});

test("distractors are close to the answer", () => {
  for (const { q } of all) {
    const ans = G.answer(q);
    for (const n of G.choices(q)) assert.ok(Math.abs(n - ans) <= Math.max(20, ans), `${G.text(q)} → ${n}`);
  }
});

test("solution steps are true equations ending in the answer", () => {
  const evalSide = (s) => s.split("=").map((x) => Function(`return (${x.replace(/−/g, "-")})`)());
  for (const { q } of all) {
    const lines = G.steps(q);
    assert.ok(lines.length >= 1);
    for (const l of lines) {
      const vals = evalSide(l);
      assert.ok(vals.every((v) => v === vals[0]), `${G.text(q)}: ${l}`);
    }
    assert.ok(lines.join(" ").includes(String(G.answer(q))));
  }
});

test("steps for typical cases", () => {
  const s = (a, op, b, m = "c", t = op === "+" ? "add" : "sub") =>
    G.steps({ t, lv: 4, a, op, b, c: op === "+" ? a + b : a - b, m });
  assert.deepEqual(plain(s(8, "+", 5)), ["8 + 5 = 8 + 2 + 3 = 10 + 3 = 13"]);
  assert.deepEqual(plain(s(13, "-", 6)), ["13 − 6 = 13 − 3 − 3 = 10 − 3 = 7"]);
  assert.deepEqual(plain(s(34, "+", 28)), ["30 + 20 = 50", "4 + 8 = 12", "50 + 12 = 62"]);
  assert.deepEqual(plain(s(52, "-", 27)), ["52 − 20 = 32", "32 − 7 = 25"]);
  assert.deepEqual(plain(s(3, "+", 4, "b")), ["7 − 3 = 4", "3 + 4 = 7"]);
});

test("help visuals match the exercise", () => {
  for (const { q } of all) {
    const v = G.visual(q);
    if (v.type === "frames" || v.type === "pics") {
      const count = (c) => v.cells.filter((x) => x === c).length;
      if (q.op === "+" && q.m === "c") assert.equal(count("a") + count("b"), q.c);
      if (q.op === "+" && q.m !== "c") assert.equal(count("a") + count("slot"), q.c);
      if (q.op === "-") assert.ok(count("a") === q.c && count("x") === q.b);
    } else {
      const val = (g, cls) => 10 * g.rods.filter((c) => cls.includes(c)).length + g.cubes.filter((c) => cls.includes(c)).length;
      if (q.op === "+" && q.m === "c") assert.equal(val(v.groups[0], ["a"]) + val(v.groups[1], ["b"]), q.c);
      else if (q.op === "+") assert.equal(val(v.groups[0], ["a", "slot"]), q.c, G.text(q));
      else assert.ok(val(v.groups[0], ["a"]) === q.c && val(v.groups[0], ["x"]) === q.b, G.text(q));
    }
  }
});

test("starting levels exist for both grades", () => {
  for (const t of D.TOPICS) for (const g of D.GRADES) assert.ok(t.start[g] >= 1 && t.start[g] <= t.levels.length);
});
