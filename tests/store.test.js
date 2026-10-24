/* Unit tests: progress, level suggestions and session planning.
 * Run: node --test tests/ */
const test = require("node:test");
const assert = require("node:assert/strict");
const load = require("./load");

// Values from the app's context compare as plain data.
const plain = (x) => JSON.parse(JSON.stringify(x));

function fresh(grade = "א") {
  const App = load();
  const p = App.store.newProfile(grade);
  p.name = "נועם";
  App.store.saveProfile(p);
  return { App, S: App.store, G: App.gen, p };
}

test("grade sets the starting levels", () => {
  const { p } = fresh("א");
  assert.deepEqual([p.topics.add.lv, p.topics.sub.lv, p.topics.bond.lv, p.topics.parity.lv], [3, 3, 2, 2]);
  const b = fresh("ב").p;
  assert.deepEqual([b.topics.add.lv, b.topics.sub.lv, b.topics.bond.lv, b.topics.parity.lv], [5, 5, 4, 4]);
});

test("a session has 10 exercises from the active topics, no repeats", () => {
  const { S, G, p } = fresh();
  p.topics.sub.on = false;
  for (let i = 0; i < 20; i++) {
    const tasks = S.planSession(p, i + 1);
    assert.equal(tasks.length, 10);
    assert.ok(tasks.every((q) => q.t !== "sub"));
    assert.equal(new Set(tasks.map(G.key)).size, 10);
    // Current level, or one below for review.
    assert.ok(tasks.every((q) => q.lv === p.topics[q.t].lv || q.lv === p.topics[q.t].lv - 1));
  }
  p.topics.add.on = p.topics.bond.on = p.topics.parity.on = false;
  assert.equal(S.planSession(p, 99).length, 0);
});

test("a fact is learned after 3 right in a row in 2 sessions", () => {
  const { S, p } = fresh();
  const q = { t: "add", lv: 4, a: 8, op: "+", b: 5, c: 13, m: "c" };
  S.record(p, q, false, 1);
  assert.equal(S.hardFacts(p).length, 1);
  S.record(p, q, true, 1);
  S.record(p, q, true, 1);
  S.record(p, q, true, 1);
  assert.equal(S.hardFacts(p).length, 1, "three in one session is not enough");
  S.record(p, q, true, 2);
  assert.equal(S.hardFacts(p).length, 0);
});

test("a missed fact comes back early in the next session", () => {
  const { S, G, p } = fresh();
  const q = { t: "add", lv: 3, a: 12, op: "+", b: 5, c: 17, m: "c" };
  S.record(p, q, false, 1);
  const next = S.planSession(p, 2);
  assert.ok(next.some((x) => G.key(x) === G.key(q)));
});

test("practising hard facts puts them in the next session", () => {
  const { S, G, p } = fresh();
  const qs = [
    { t: "add", lv: 3, a: 12, op: "+", b: 5, c: 17, m: "c" },
    { t: "sub", lv: 3, a: 16, op: "-", b: 4, c: 12, m: "c" },
  ];
  qs.forEach((q) => S.record(p, q, false, 1));
  p.focusHard = true;
  const keys = S.planSession(p, 5).map(G.key);
  qs.forEach((q) => assert.ok(keys.includes(G.key(q))));
  assert.equal(p.focusHard, false);
});

function answer(S, G, p, t, okCount, total, sessionNo) {
  for (let i = 0; i < total; i++) S.record(p, G.make(t, p.topics[t].lv), i < okCount, sessionNo);
}

test("suggest the next level after 8 of 10 in two sessions; never change it alone", () => {
  const { S, G, p } = fresh();
  answer(S, G, p, "add", 5, 5, 1);
  assert.equal(S.suggestions(p).length, 0, "only 5 so far");
  answer(S, G, p, "add", 4, 5, 2);
  const s = S.suggestions(p);
  assert.deepEqual(plain(s.map((x) => [x.t, x.dir, x.lv])), [["add", "up", 4]]);
  assert.equal(p.topics.add.lv, 3, "the level waits for the parent");
  S.dismiss(p, "add");
  assert.equal(S.suggestions(p).length, 0);
  S.setLevel(p, "add", 4);
  assert.equal(p.topics.add.lv, 4);
});

test("ten in one session is not enough for a suggestion", () => {
  const { S, G, p } = fresh();
  answer(S, G, p, "add", 10, 10, 1);
  assert.equal(S.suggestions(p).length, 0);
});

test("many mistakes suggest the level below", () => {
  const { S, G, p } = fresh();
  answer(S, G, p, "sub", 2, 5, 1);
  answer(S, G, p, "sub", 1, 5, 2);
  assert.deepEqual(plain(S.suggestions(p).map((x) => [x.t, x.dir, x.lv])), [["sub", "down", 2]]);
});

test("no suggestions with auto progress off, but a passed level still earns its sticker", () => {
  const { S, G, p } = fresh();
  p.autoProgress = false;
  let passed = null;
  for (let s = 1; s <= 2; s++) {
    for (let i = 0; i < 5; i++) {
      const r = S.record(p, G.make("bond", 2), true, s);
      if (r.levelPassed) passed = r.levelPassed;
    }
  }
  assert.equal(S.suggestions(p).length, 0);
  assert.deepEqual(plain({ ...passed }), { t: "bond", lv: 2 });
});

test("a profile from before a new topic gets it at the grade's level", () => {
  const App = load();
  const old = App.store.newProfile("ב");
  delete old.topics.parity;
  const raw = JSON.stringify({ version: 1, activeId: old.id, profiles: [old] });
  App.store.importData(raw);
  assert.equal(App.store.profile().topics.parity.lv, 4);
});

test("even / odd is always answered by choosing", () => {
  const { S, p } = fresh();
  p.answerMode = "type";
  assert.equal(S.answerMode(p, { t: "parity", lv: 2 }), "choice");
  assert.equal(S.answerMode(p, { t: "parity", lv: 5 }), "type");
});

test("answer form: by level, or fixed by the parent", () => {
  const { S, p } = fresh();
  const low = { t: "add", lv: 1 };
  const high = { t: "add", lv: 4 };
  assert.equal(S.answerMode(p, low), "choice");
  assert.equal(S.answerMode(p, high), "type");
  p.answerMode = "choice";
  assert.equal(S.answerMode(p, high), "choice");
});

test("backup round trip", () => {
  const { S, p } = fresh();
  const text = S.exportData();
  S.resetAll();
  assert.equal(S.profile(), null);
  S.importData(text);
  assert.equal(S.profile().name, p.name);
  assert.throws(() => S.importData("{}"));
});
