/* Exercise generator: turns a topic level from js/data.js into exercises.
 *
 * An exercise is { t, lv, a, op, b, c, m }: a op b = c, where m names the
 * unknown ("a", "b" or "c"). It never has a negative number, subtraction never
 * goes below zero, and carrying (מעבר עשרת / המרה) appears only where the
 * level asks for it. `rnd` can be replaced for tests. */
(() => {
  "use strict";

  const App = (window.App = window.App || {});
  const D = App.data;

  let rnd = Math.random;
  const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const chance = (p) => rnd() < p;
  const swap = (x, y) => (chance(0.5) ? [x, y] : [y, x]);

  // ---------- Generators by kind: return { a, op, b, m? } ----------
  const KINDS = {
    add(L) {
      if (L.max <= 10) {
        const a = int(1, L.max - 1);
        return { a, op: "+", b: int(1, L.max - a) };
      }
      if (L.carry) {
        // Two single digits that cross ten: 8 + 5.
        const a = int(2, 9);
        return { a, op: "+", b: int(Math.max(2, 11 - a), 9) };
      }
      // A teen (or 10) and a single digit, units stay below ten: 12 + 5.
      const u = int(0, 8);
      const [a, b] = swap(10 + u, int(1, 9 - u));
      return { a, op: "+", b };
    },
    sub(L) {
      if (L.max <= 10) {
        const a = int(2, L.max);
        return { a, op: "-", b: int(1, a - 1) };
      }
      if (L.carry) {
        // From a teen, through ten: 13 − 6.
        const u = int(1, 8);
        return { a: 10 + u, op: "-", b: int(u + 1, 9) };
      }
      const u = int(1, 9);
      return { a: 10 + u, op: "-", b: chance(0.15) ? 10 : int(1, u) };
    },
    addTens() {
      const i = int(1, 8);
      return { a: i * 10, op: "+", b: int(1, 9 - i) * 10 };
    },
    subTens() {
      const i = int(2, 10);
      return { a: i * 10, op: "-", b: int(1, i - 1) * 10 };
    },
    add2d1d() {
      // Half with carrying (47 + 5), half without (43 + 5).
      const carry = chance(0.5);
      const t = int(1, 8);
      const u = carry ? int(2, 9) : int(1, 7);
      const b = carry ? int(10 - u, 9) : int(1, 9 - u);
      const [a, bb] = chance(0.8) ? [t * 10 + u, b] : [b, t * 10 + u];
      return { a, op: "+", b: bb };
    },
    sub2d1d() {
      const borrow = chance(0.5);
      const t = int(2, 9);
      const u = borrow ? int(0, 8) : int(2, 9);
      const b = borrow ? int(u + 1, 9) : int(1, u);
      return { a: t * 10 + u, op: "-", b };
    },
    add2d2d(L) {
      const ta = int(1, 7);
      const tb = int(1, (L.carry ? 8 : 9) - ta);
      let ua, ub;
      if (L.carry) {
        ua = int(1, 9);
        ub = int(Math.max(1, 10 - ua), 9);
      } else {
        ua = int(1, 8);
        ub = int(1, 9 - ua);
      }
      return { a: ta * 10 + ua, op: "+", b: tb * 10 + ub };
    },
    sub2d2d(L) {
      const ta = int(2, 9);
      const tb = int(1, ta - 1);
      let ua, ub;
      if (L.carry) {
        ua = int(0, 8);
        ub = int(ua + 1, 9);
      } else {
        ua = int(1, 9);
        ub = int(1, ua);
      }
      return { a: ta * 10 + ua, op: "-", b: tb * 10 + ub };
    },
    bond(L) {
      const total = L.total || int(L.totalMin, L.totalMax);
      // To 20: mostly from a teen (13 + ? = 20), sometimes from a single digit.
      const known = total === 20 ? (chance(0.75) ? int(11, 19) : int(2, 9)) : int(1, total - 1);
      // Level 1 always asks for the second number, as the ten frame shows it.
      const m = L.frame ? "b" : chance(0.7) ? "b" : "a";
      return m === "b" ? { a: known, op: "+", b: total - known, m } : { a: total - known, op: "+", b: known, m };
    },
    toTen() {
      const a = int(1, 9) * 10 + int(1, 9);
      return { a, op: "+", b: Math.ceil(a / 10) * 10 - a, m: "b" };
    },
    bond100() {
      const a = int(1, 9) * 10;
      return { a, op: "+", b: 100 - a, m: "b" };
    },
  };

  function level(t, lv) {
    return D.topic(t).levels[lv - 1];
  }

  function make(t, lv) {
    const L = level(t, lv);
    const x = KINDS[L.kind](L);
    const c = x.op === "+" ? x.a + x.b : x.a - x.b;
    let m = x.m || "c";
    if (!x.m && L.missing && chance(L.missing)) {
      // 3 + ? = 7, ? + 4 = 7, 9 − ? = 5.
      m = x.op === "+" ? pick(["a", "b"]) : "b";
    }
    return { t, lv, a: x.a, op: x.op, b: x.b, c, m };
  }

  const answer = (q) => q[q.m];
  const key = (q) => `${q.t}:${q.m === "a" ? "?" : q.a}${q.op}${q.m === "b" ? "?" : q.b}=${q.m === "c" ? "?" : q.c}`;
  const sign = (op) => (op === "-" ? "−" : op);

  // "8 + 5 = ?" (shown left to right).
  function text(q, filled) {
    const v = (k) => (q.m === k ? (filled ? String(answer(q)) : "?") : String(q[k]));
    return `${v("a")} ${sign(q.op)} ${v("b")} = ${v("c")}`;
  }

  const isRound = (n) => n % 10 === 0;

  // Three answers to choose from: the answer and two near misses (±1, or a
  // typical slip such as adding instead of subtracting). All different, none negative.
  function choices(q) {
    const ans = answer(q);
    const L = level(q.t, q.lv);
    const tens = isRound(ans) && ans >= 10 && /Tens|bond100/.test(L.kind);
    const near = tens ? [ans - 10, ans + 10] : [ans - 1, ans + 1];
    const slips = [];
    if (q.m === "c") slips.push(q.op === "+" ? Math.abs(q.a - q.b) : q.a + q.b);
    else slips.push(q.c, q.m === "a" ? q.b : q.a);
    const far = tens ? [ans - 20, ans + 20] : [ans - 2, ans + 2, ans + 10, ans - 10];
    const ok = (n, list) => n >= 0 && n !== ans && !list.includes(n);
    const out = [];
    const take = (pool) => {
      const cands = pool.filter((n) => ok(n, out));
      if (cands.length) out.push(pick(cands));
    };
    take(near);
    take(slips.filter((n) => Math.abs(n - ans) <= Math.max(5, ans)));
    while (out.length < 2) take([...near, ...far, ans + 3, ans + 4]);
    const all = [ans, ...out];
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    return all;
  }

  // ---------- The way to the answer, shown after a second miss ----------
  // Lines of an equation chain, left to right: "8 + 5 = 8 + 2 + 3 = 10 + 3 = 13".
  function steps(q) {
    const { a, b, c } = q;
    const lines = [];
    if (q.m !== "c") {
      // 3 + ? = 7  →  7 − 3 = 4.
      const known = q.m === "a" ? b : a;
      if (q.op === "+") lines.push(`${c} − ${known} = ${answer(q)}`);
      else lines.push(`${a} − ${c} = ${b}`);
      lines.push(text(q, true));
      return lines;
    }
    const s = sign(q.op);
    const big = Math.max(a, b);
    const small = Math.min(a, b);
    if (isRound(a) && isRound(b) && big >= 20) {
      // 30 + 40: 3 tens and 4 tens.
      lines.push(`${a / 10} ${s} ${b / 10} = ${c / 10}`);
    } else if (q.op === "+" && c > 10 && big !== 10) {
      if (c <= 20 && big < 10) {
        // Make ten: 8 + 5 = 8 + 2 + 3 = 10 + 3.
        const fill = 10 - a;
        lines.push(`${a} + ${b} = ${a} + ${fill} + ${b - fill} = 10 + ${b - fill} = ${c}`);
        return lines;
      }
      if (c <= 20) {
        // 12 + 5 = 10 + 2 + 5 = 10 + 7.
        lines.push(`${a} + ${b} = 10 + ${big - 10} + ${small} = 10 + ${c - 10} = ${c}`);
        return lines;
      }
      const u = big % 10;
      const tensOf = big - u;
      if (small < 10) {
        const fill = 10 - u;
        // 47 + 5 = 47 + 3 + 2 = 50 + 2;  43 + 5 = 40 + 3 + 5 = 40 + 8.
        if (small > fill) lines.push(`${a} + ${b} = ${big} + ${fill} + ${small - fill} = ${big + fill} + ${small - fill} = ${c}`);
        else lines.push(`${a} + ${b} = ${tensOf} + ${u} + ${small} = ${tensOf} + ${u + small} = ${c}`);
        return lines;
      }
      // 34 + 28: tens, then units, then together.
      const tens = a - (a % 10) + (b - (b % 10));
      const units = (a % 10) + (b % 10);
      lines.push(`${a - (a % 10)} + ${b - (b % 10)} = ${tens}`);
      lines.push(`${a % 10} + ${b % 10} = ${units}`);
      lines.push(`${tens} + ${units} = ${c}`);
      return lines;
    } else if (q.op === "-" && a > 10 && b !== 10 && c !== 10) {
      const u = a % 10;
      if (a < 20 && b > u) {
        // Through ten: 13 − 6 = 13 − 3 − 3 = 10 − 3.
        lines.push(`${a} − ${b} = ${a} − ${u} − ${b - u} = 10 − ${b - u} = ${c}`);
        return lines;
      }
      if (a < 20) {
        // 17 − 4 = 10 + 7 − 4 = 10 + 3.
        lines.push(`${a} − ${b} = 10 + ${u} − ${b} = 10 + ${u - b} = ${c}`);
        return lines;
      }
      if (b < 10) {
        // 52 − 7 = 52 − 2 − 5 = 50 − 5;  50 − 7 = 40 + 10 − 7;  48 − 5 = 40 + 8 − 5.
        if (u === 0) lines.push(`${a} − ${b} = ${a - 10} + 10 − ${b} = ${a - 10} + ${10 - b} = ${c}`);
        else if (b > u) lines.push(`${a} − ${b} = ${a} − ${u} − ${b - u} = ${a - u} − ${b - u} = ${c}`);
        else lines.push(`${a} − ${b} = ${a - u} + ${u} − ${b} = ${a - u} + ${u - b} = ${c}`);
        return lines;
      }
      // 52 − 27: the tens first, then the units.
      const bt = b - (b % 10);
      lines.push(`${a} − ${bt} = ${a - bt}`);
      lines.push(`${a - bt} − ${b % 10} = ${c}`);
      return lines;
    }
    lines.push(`${a} ${s} ${b} = ${c}`);
    return lines;
  }

  // ---------- What the help shows ----------
  // frames: ten frames of dots (numbers to 20). blocks: tens rods and unit cubes.
  // Each cell / cube is "a" (first number), "b" (second), "x" (taken away) or
  // "slot" (still missing).
  function visual(q) {
    const L = level(q.t, q.lv);
    const big = Math.max(q.a, q.b, q.c);
    if (big <= 20 && !/Tens/.test(L.kind)) {
      let cells = [];
      if (q.op === "+") {
        if (q.m === "c") cells = [...Array(q.a).fill("a"), ...Array(q.b).fill("b")];
        else {
          const known = q.m === "a" ? q.b : q.a;
          cells = [...Array(known).fill("a"), ...Array(q.c - known).fill("slot")];
        }
      } else {
        // a dots; the ones taken away are crossed out.
        cells = [...Array(q.a - q.b).fill("a"), ...Array(q.b).fill("x")];
      }
      const total = L.pics ? cells.length : Math.max(10, Math.ceil(cells.length / 10) * 10);
      while (cells.length < total) cells.push("");
      return { type: L.pics ? "pics" : "frames", cells, pic: L.pics ? pick(D.PICS) : null, always: !!(L.pics || L.frame) };
    }
    // Rods and cubes.
    const split = (n) => ({ tens: Math.floor(n / 10), ones: n % 10 });
    if (q.op === "+") {
      if (q.m === "c") return { type: "blocks", groups: [blocks(split(q.a), "a"), blocks(split(q.b), "b")], op: "+" };
      const known = q.m === "a" ? q.b : q.a;
      const k = split(known);
      const gap = q.c - known;
      // Fill the ones first (37 → 40), then whole tens.
      const gapOnes = Math.min(gap, (10 - k.ones) % 10 || (gap % 10));
      const gapTens = Math.floor((gap - gapOnes) / 10);
      const rods = [...Array(k.tens).fill("a"), ...Array(gapTens).fill("slot")];
      const cubes = [...Array(k.ones).fill("a"), ...Array(gapOnes).fill("slot")];
      return { type: "blocks", groups: [{ rods, cubes }] };
    }
    // a − b: break a ten into ones when needed, then cross out b.
    const s = split(q.a);
    const borrow = q.b % 10 > s.ones;
    const rodsN = s.tens - (borrow ? 1 : 0);
    const cubesN = s.ones + (borrow ? 10 : 0);
    const bt = Math.floor(q.b / 10);
    const bu = q.b % 10;
    const rods = Array.from({ length: rodsN }, (_, i) => (i >= rodsN - bt ? "x" : "a"));
    const cubes = Array.from({ length: cubesN }, (_, i) => (i >= cubesN - bu ? "x" : "a"));
    return { type: "blocks", groups: [{ rods, cubes, broke: borrow }] };
  }
  function blocks(n, cls) {
    return { rods: Array(n.tens).fill(cls), cubes: Array(n.ones).fill(cls) };
  }

  App.gen = {
    make,
    answer,
    key,
    text,
    choices,
    steps,
    visual,
    level,
    sign,
    setRandom(fn) {
      rnd = fn || Math.random;
    },
  };
})();
