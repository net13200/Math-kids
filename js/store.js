/* Local-only storage, progress and session planning.
 * Everything lives in localStorage on the device; the parent area can export
 * and import a backup file. */
(() => {
  "use strict";

  const App = (window.App = window.App || {});
  const D = App.data;
  const G = App.gen;

  const KEY = "mathkids.v1";
  const MASTERY_STREAK = 3; // a fact is learned after 3 right in a row...
  const MASTERY_SESSIONS = 2; // ...in at least 2 different sessions
  const WINDOW = 10; // level suggestions look at the last 10 exercises of the level
  const UP_AT = 8; // 8 of 10 right first time → suggest the next level
  const DOWN_AT = 4; // 4 or fewer of 10 → suggest the level below
  const DUE_MAX = 3; // facts that were missed, brought back early in a session
  const LOG_MAX = 3000;
  const WEEK = 7 * 24 * 3600 * 1000;

  let state = load();

  function blank() {
    return { version: 1, activeId: null, profiles: [] };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      const s = JSON.parse(raw);
      if (!s || !Array.isArray(s.profiles)) return blank();
      s.profiles.forEach(upgrade);
      return s;
    } catch (_) {
      return blank();
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (_) {
      return false;
    }
  }

  function newProfile(grade = "א") {
    const p = {
      id: "p" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
      name: "",
      gender: "m",
      grade,
      rate: 0.85,
      answerMode: "level", // "level" | "choice" | "type"
      autoProgress: true,
      topics: {},
      facts: {},
      log: [],
      stickers: [],
      passed: {},
      dismissed: {},
      focusHard: false,
      sessions: 0,
      created: Date.now(),
    };
    applyGrade(p, grade);
    return p;
  }

  // Grade sets a sensible starting level for every topic.
  function applyGrade(p, grade) {
    p.grade = grade;
    for (const t of D.TOPICS) {
      const cur = p.topics[t.id];
      p.topics[t.id] = { on: cur ? cur.on : true, lv: t.start[grade] || 1, since: Date.now() };
    }
  }

  // A topic added in a later version starts at the grade's level.
  function upgrade(p) {
    for (const t of D.TOPICS) {
      if (!p.topics[t.id]) p.topics[t.id] = { on: true, lv: t.start[p.grade] || 1, since: Date.now() };
    }
  }

  function profile() {
    return state.profiles.find((x) => x.id === state.activeId) || null;
  }
  const profiles = () => state.profiles;

  function saveProfile(p) {
    const i = state.profiles.findIndex((x) => x.id === p.id);
    if (i >= 0) state.profiles[i] = p;
    else state.profiles.push(p);
    state.activeId = p.id;
    save();
  }

  function switchTo(id) {
    if (state.profiles.some((x) => x.id === id)) {
      state.activeId = id;
      save();
    }
  }

  function removeProfile(id) {
    state.profiles = state.profiles.filter((x) => x.id !== id);
    if (state.activeId === id) state.activeId = state.profiles.length ? state.profiles[0].id : null;
    save();
  }

  // ---------- Levels ----------
  const maxLevel = (t) => D.topic(t).levels.length;

  function setLevel(p, t, lv) {
    const cur = p.topics[t];
    cur.lv = Math.max(1, Math.min(maxLevel(t), lv));
    cur.since = Date.now();
    saveProfile(p);
  }

  // The exercises of the current level since it was set (newest last).
  function levelLog(p, t, after = 0) {
    const cur = p.topics[t];
    const from = Math.max(cur.since, after);
    return p.log.filter((e) => e.t === t && e.lv === cur.lv && e.ts >= from);
  }

  // "up" when the child has this level, "down" when it is too hard, else null.
  function judge(entries) {
    const last = entries.slice(-WINDOW);
    if (last.length < WINDOW) return null;
    if (new Set(last.map((e) => e.s)).size < 2) return null;
    const ok = last.filter((e) => e.ok).length;
    if (ok >= UP_AT) return "up";
    if (ok <= DOWN_AT) return "down";
    return null;
  }

  // Suggestions for the parent; the level never changes by itself.
  function suggestions(p) {
    if (!p.autoProgress) return [];
    const out = [];
    for (const t of D.TOPICS) {
      const cur = p.topics[t.id];
      if (!cur.on) continue;
      // After "not now", only answers given since then count.
      const verdict = judge(levelLog(p, t.id, (p.dismissed[t.id] || 0) + 1));
      if (verdict === "up" && cur.lv < t.levels.length) out.push({ t: t.id, dir: "up", lv: cur.lv + 1 });
      if (verdict === "down" && cur.lv > 1) out.push({ t: t.id, dir: "down", lv: cur.lv - 1 });
    }
    return out;
  }

  function dismiss(p, t) {
    p.dismissed[t] = Date.now();
    saveProfile(p);
  }

  // ---------- Facts ----------
  function fact(p, q) {
    const k = G.key(q);
    if (!p.facts[k]) p.facts[k] = { q: { ...q }, right: 0, wrong: 0, streak: 0, streakSessions: [], due: null, last: 0 };
    return p.facts[k];
  }

  const isMastered = (f) => f.streak >= MASTERY_STREAK && f.streakSessions.length >= MASTERY_SESSIONS;

  // Record one exercise. Returns { levelPassed } when this answer completes a
  // level for the first time (that earns a gold sticker).
  function record(p, q, ok, sessionNo) {
    const f = fact(p, q);
    f.last = Date.now();
    if (ok) {
      f.right++;
      f.streak++;
      if (!f.streakSessions.includes(sessionNo)) f.streakSessions.push(sessionNo);
      // A missed fact comes back sooner, then less often as it sticks.
      f.due = f.wrong && !isMastered(f) ? sessionNo + f.streak : null;
    } else {
      f.wrong++;
      f.streak = 0;
      f.streakSessions = [];
      f.due = sessionNo + 1;
    }
    p.log.push({ t: q.t, lv: q.lv, k: G.key(q), ok, s: sessionNo, ts: Date.now() });
    if (p.log.length > LOG_MAX) p.log.splice(0, p.log.length - LOG_MAX);

    let levelPassed = null;
    const cur = p.topics[q.t];
    const pk = q.t + ":" + q.lv;
    if (cur && cur.lv === q.lv && !p.passed[pk] && judge(levelLog(p, q.t)) === "up") {
      p.passed[pk] = Date.now();
      levelPassed = { t: q.t, lv: q.lv };
    }
    saveProfile(p);
    return { levelPassed };
  }

  // Facts the child keeps missing, most-missed first.
  function hardFacts(p, n = 8) {
    return Object.values(p.facts)
      .filter((f) => f.wrong > 0 && !isMastered(f) && p.topics[f.q.t] && p.topics[f.q.t].on)
      .sort((x, y) => y.wrong - x.wrong || y.last - x.last)
      .slice(0, n);
  }

  // ---------- Session planning ----------
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Mostly the current level of each active topic, some review from the level
  // below, and missed facts brought back early.
  function planSession(p, sessionNo) {
    const on = D.TOPICS.filter((t) => p.topics[t.id].on).map((t) => t.id);
    if (!on.length) return [];
    const tasks = [];
    const keys = new Set();
    const add = (q) => {
      const k = G.key(q);
      if (keys.has(k)) return false;
      keys.add(k);
      tasks.push(q);
      return true;
    };

    if (p.focusHard) {
      hardFacts(p, 6).forEach((f) => add({ ...f.q }));
      p.focusHard = false;
    }
    Object.values(p.facts)
      .filter((f) => f.due != null && f.due <= sessionNo && on.includes(f.q.t) && f.q.lv <= p.topics[f.q.t].lv)
      .sort((x, y) => x.due - y.due)
      .slice(0, DUE_MAX)
      .forEach((f) => add({ ...f.q }));

    let i = Math.floor(Math.random() * on.length);
    let tries = 0;
    while (tasks.length < D.SESSION_SIZE && tries++ < 200) {
      const t = on[i++ % on.length];
      const lv = p.topics[t].lv;
      const useLower = lv > 1 && Math.random() < D.REVIEW_SHARE;
      add(G.make(t, useLower ? lv - 1 : lv));
    }
    return shuffle(tasks);
  }

  // How the answer is given: the parent's fixed choice, or the level's default.
  function answerMode(p, q) {
    const L = G.level(q.t, q.lv);
    if (L.choiceOnly) return "choice";
    if (p.answerMode === "choice" || p.answerMode === "type") return p.answerMode;
    return L.answer;
  }

  // ---------- Stickers ----------
  function addSticker(p, gold) {
    const pool = gold ? D.GOLD : D.STICKERS;
    const have = p.stickers.filter((s) => !!s.gold === !!gold).length;
    const s = { e: pool[have % pool.length], gold: !!gold, ts: Date.now() };
    if (gold) Object.assign(s, gold);
    p.stickers.push(s);
    saveProfile(p);
    return s;
  }

  // ---------- Summary for the parent ----------
  function weekSummary(p) {
    const from = Date.now() - WEEK;
    const week = p.log.filter((e) => e.ts >= from);
    const byTopic = D.TOPICS.map((t) => {
      const es = week.filter((e) => e.t === t.id);
      return { t: t.id, n: es.length, pct: es.length ? Math.round((100 * es.filter((e) => e.ok).length) / es.length) : null };
    });
    return { n: week.length, byTopic };
  }

  // ---------- Backup ----------
  function exportData() {
    return JSON.stringify(state, null, 1);
  }

  function importData(text) {
    const s = JSON.parse(text);
    if (!s || !Array.isArray(s.profiles)) throw new Error("bad backup");
    s.profiles.forEach(upgrade);
    state = s;
    if (!state.profiles.some((x) => x.id === state.activeId)) state.activeId = state.profiles.length ? state.profiles[0].id : null;
    save();
  }

  function resetAll() {
    state = blank();
    try {
      localStorage.removeItem(KEY);
    } catch (_) {}
  }

  App.store = {
    newProfile,
    applyGrade,
    profile,
    profiles,
    saveProfile,
    switchTo,
    removeProfile,
    maxLevel,
    setLevel,
    suggestions,
    dismiss,
    record,
    hardFacts,
    planSession,
    answerMode,
    addSticker,
    weekSummary,
    exportData,
    importData,
    resetAll,
    _judge: judge,
  };
})();
