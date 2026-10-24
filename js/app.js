/* Screens, exercises and the parent area. */
(() => {
  "use strict";

  const App = window.App;
  const D = App.data;
  const G = App.gen;
  const N = App.num;
  const S = App.store;
  const A = App.audio;

  const $app = document.getElementById("app");

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  // Exercises are written left to right, isolated from the RTL page.
  const ltr = (s) => `<span class="ltr" dir="ltr">${esc(s)}</span>`;

  // ---------- Speech segments ----------
  function gender() {
    const p = S.profile();
    return p && p.gender === "f" ? "f" : "m";
  }
  const seg = {
    p(name, g = gender()) {
      const v = D.PHRASES[name];
      if (typeof v === "string") return { key: "p." + name, text: v };
      return { key: `p.${name}.${g}`, text: v[g] };
    },
    praise() {
      const i = Math.floor(Math.random() * D.PHRASES.praise.length);
      return { key: "p.praise." + i, text: D.PHRASES.praise[i] };
    },
    num: (n) => ({ key: "num." + n, text: N.words(n) }),
    op: (op) => D.OPS[op],
    name: () => ({ key: null, text: (S.profile() || {}).name || "" }),
  };
  const ask = (s) => ({ ...s, text: s.text + "?" });

  // "כַּמָּה זֶה שְׁמוֹנֶה וְעוֹד חָמֵשׁ?" / "שָׁלוֹשׁ וְעוֹד כַּמָּה שָׁוֶה שֶׁבַע?"
  function questionSpeech(q) {
    // "שֶׁבַע, זוּגִי אוֹ אִי־זוּגִי?"
    if (q.f === "par") return [comma(seg.num(q.n)), ask(seg.p("evenOrOdd"))];
    // "סוֹפְרִים בִּקְפִיצוֹת שֶׁל שְׁתַּיִם: שְׁתַּיִם, אַרְבַּע, שֵׁשׁ, כַּמָּה?"
    if (q.f === "seq") {
      const items = q.seq.map((n, i) => (i === q.h ? seg.p("unknown") : seg.num(n)));
      const head = [seg.p(q.seq[1] > q.seq[0] ? "countBy" : "countBack"), { ...seg.num(q.s), text: seg.num(q.s).text + ":" }];
      return [...head, ...items.slice(0, -1).map(comma), ask(items[items.length - 1])];
    }
    if (q.m === "c") return [seg.p("howMuch"), seg.num(q.a), seg.op(q.op), ask(seg.num(q.b))];
    const part = (k) => (q.m === k ? seg.p("unknown") : seg.num(q[k]));
    return [part("a"), seg.op(q.op), part("b"), seg.op("="), ask(seg.num(q.c))];
  }
  const comma = (s) => ({ ...s, text: s.text + "," });
  function equationSpeech(q) {
    if (q.f === "par") return [seg.num(q.n), seg.p(G.answer(q))];
    if (q.f === "seq") return [...q.seq.slice(0, -1).map((n) => comma(seg.num(n))), seg.num(q.seq[q.seq.length - 1])];
    return [seg.num(q.a), seg.op(q.op), seg.num(q.b), seg.op("="), seg.num(q.c)];
  }

  // ---------- Guide character: a fox ----------
  const GUIDE = `
  <svg class="guide" viewBox="0 0 120 124" aria-hidden="true">
    <path d="M86 104 C 112 102, 120 76, 108 60 C 106 78, 98 88, 82 94 Z" fill="#f08a3c"/>
    <path d="M108 60 C 113 66, 114 73, 112 80 C 107 76, 105 68, 108 60 Z" fill="#fff4e6"/>
    <ellipse cx="60" cy="94" rx="29" ry="26" fill="#f08a3c"/>
    <ellipse cx="60" cy="100" rx="16" ry="18" fill="#fff4e6"/>
    <path d="M29 42 L33 8 L55 30 Z" fill="#f08a3c"/>
    <path d="M91 42 L87 8 L65 30 Z" fill="#f08a3c"/>
    <path d="M35 34 L37 17 L48 29 Z" fill="#7a3e1d"/>
    <path d="M85 34 L83 17 L72 29 Z" fill="#7a3e1d"/>
    <ellipse cx="60" cy="50" rx="35" ry="28" fill="#f08a3c"/>
    <path d="M26 52 C 34 70, 48 77, 60 77 C 72 77, 86 70, 94 52 C 84 58, 70 56, 60 64 C 50 56, 36 58, 26 52 Z" fill="#fff4e6"/>
    <circle cx="45" cy="46" r="5.6" fill="#3a2e5c"/>
    <circle cx="75" cy="46" r="5.6" fill="#3a2e5c"/>
    <circle cx="46.8" cy="44.2" r="1.9" fill="#fff"/>
    <circle cx="76.8" cy="44.2" r="1.9" fill="#fff"/>
    <circle cx="36" cy="60" r="4.2" fill="#ff9fb5" opacity=".55"/>
    <circle cx="84" cy="60" r="4.2" fill="#ff9fb5" opacity=".55"/>
    <ellipse cx="60" cy="62" rx="5.4" ry="3.8" fill="#3a2e5c"/>
    <path class="mouth" d="M53.5 68.5 Q60 75 66.5 68.5" stroke="#3a2e5c" stroke-width="2.4" fill="#ff7a8a" stroke-linecap="round" stroke-linejoin="round"/>
    <ellipse cx="47" cy="118" rx="9" ry="5" fill="#7a3e1d"/>
    <ellipse cx="73" cy="118" rx="9" ry="5" fill="#7a3e1d"/>
  </svg>`;

  async function talk(segments) {
    const g = document.querySelector(".guide");
    g && g.classList.add("talking");
    await A.say(segments);
    g && g.classList.remove("talking");
  }

  // ---------- Icons ----------
  const ICON = {
    speaker: `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 4V5L7 9H3z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.8 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    close: `<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>`,
    play: `<svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
    next: `<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    home: `<svg viewBox="0 0 24 24"><path d="M3 11.5L12 4l9 7.5M5.5 9.8V20h13V9.8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    lock: `<svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>`,
    book: `<svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" fill="currentColor"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5A2.5 2.5 0 0 1 4 20.5z" fill="currentColor" opacity=".55"/><path d="M12 7.2l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z" fill="#fff"/></svg>`,
    back: `<svg viewBox="0 0 24 24"><path d="M14 7H6v8M6 15c3-6 9-8 14-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  };

  // ---------- Router ----------
  let view = null; // cleanup hook of the current screen
  function show(html, cls) {
    A.stop();
    if (view && view.cleanup) view.cleanup();
    view = {};
    $app.className = "screen " + (cls || "");
    $app.innerHTML = html;
    $app.scrollTop = 0;
    return view;
  }
  const $ = (sel) => $app.querySelector(sel);
  const $$ = (sel) => [...$app.querySelectorAll(sel)];
  function on(sel, evt, fn) {
    const e = typeof sel === "string" ? $(sel) : sel;
    if (e) e.addEventListener(evt, fn);
  }

  function start() {
    const p = S.profile();
    if (p) A.setRate(p.rate);
    if (!p) welcome();
    else home();
  }

  // ---------- First run (parent-facing) ----------
  function welcome() {
    show(
      `<div class="parent-page welcome">
        <div class="hero">${GUIDE}</div>
        <h1>ברוכים הבאים ל<span class="brand">${D.APP_NAME}</span></h1>
        <p>תרגול חשבון לכיתות א׳–ב׳, שמשלים את מה שנלמד בכיתה: חיבור, חיסור, חברים של 10, זוגי ואי־זוגי — ברמה שאתם קובעים.</p>
        <p class="muted">כל המידע נשמר על המכשיר הזה בלבד. אין חשבון, אין שרת, אין פרסומות.</p>
        <button class="btn primary" id="go">יצירת פרופיל לילד</button>
      </div>`,
      "parent"
    );
    on("#go", "click", () => newKidForm(true));
  }

  function newKidForm(first) {
    show(
      `<div class="parent-page">
        <h1>פרופיל חדש</h1>
        <label class="field"><span>שם הילד</span><input type="text" id="name" maxlength="20" autocomplete="off" /></label>
        <div class="field"><span>פנייה</span>
          <div class="seg-ctl" id="gender"><button class="on" data-v="m">בּוֹא (בן)</button><button data-v="f">בּוֹאִי (בת)</button></div></div>
        <div class="field"><span>כיתה</span>
          <div class="seg-ctl" id="grade"><button class="on" data-v="א">א׳</button><button data-v="ב">ב׳</button></div>
          <span class="sub">הכיתה קובעת את רמת הפתיחה של כל נושא. אפשר לשנות כל רמה אחר כך באזור ההורים.</span></div>
        <p class="error" id="err" hidden></p>
        <button class="btn primary" id="save">שמירה</button>
        <button class="btn" id="cancel">ביטול</button>
      </div>`,
      "parent"
    );
    segCtl("#gender");
    segCtl("#grade");
    on("#cancel", "click", () => (first ? welcome() : parentHome()));
    on("#save", "click", () => {
      const name = $("#name").value.trim();
      if (!name) {
        $("#err").textContent = "צריך שם — הדמות פונה אל הילד בשמו.";
        $("#err").hidden = false;
        $("#name").focus();
        return;
      }
      const p = S.newProfile($("#grade .on").dataset.v);
      p.name = name;
      p.gender = $("#gender .on").dataset.v;
      S.saveProfile(p);
      first ? home() : parentHome();
    });
  }

  function segCtl(sel, onChange) {
    $$(sel + " button").forEach((b) =>
      b.addEventListener("click", () => {
        $$(sel + " button").forEach((x) => x.classList.toggle("on", x === b));
        onChange && onChange(b.dataset.v);
      })
    );
  }

  // ---------- Home ----------
  function home() {
    const p = S.profile();
    if (!p) return welcome();
    A.setRate(p.rate);
    const kids = S.profiles();
    const kidChips =
      kids.length > 1
        ? `<div class="kid-chips">${kids
            .map((k) => `<button class="kid ${k.id === p.id ? "on" : ""}" data-id="${k.id}">${esc(k.name)}</button>`)
            .join("")}</div>`
        : "";
    const v = show(
      `<button class="corner lock" id="lock" aria-label="אזור הורים (לחיצה ארוכה)">
        <svg class="ring" viewBox="0 0 44 44"><circle cx="22" cy="22" r="19"/></svg>${ICON.lock}
      </button>
      ${kidChips}
      <div class="home-guide" id="guide">${GUIDE}<div class="bubble">שָׁלוֹם ${esc(p.name)}!</div></div>
      <button class="play-btn" id="play" aria-label="מתחילים">${ICON.play}</button>
      <button class="round-btn" id="stickers" aria-label="המדבקות שלי">${ICON.book}<span>${p.stickers.length}</span></button>`,
      "home"
    );
    const greet = () => talk([seg.p("hello"), seg.name(), seg.p("letsPlay")]);
    on("#guide", "click", () => {
      A.unlock();
      greet();
    });
    on("#play", "click", () => {
      A.unlock();
      A.sfx.tap();
      startSession();
    });
    on("#stickers", "click", () => {
      A.unlock();
      A.sfx.tap();
      stickerBook();
    });
    $$(".kid").forEach((b) =>
      b.addEventListener("click", () => {
        A.unlock();
        S.switchTo(b.dataset.id);
        home();
      })
    );
    longPress($("#lock"), () => parentGate());
    // Browsers that allow it (e.g. after the splash tap) greet right away.
    v.timer = setTimeout(greet, 400);
    v.cleanup = () => clearTimeout(v.timer);
  }

  function longPress(btn, fn) {
    let t = null;
    const cancel = () => {
      clearTimeout(t);
      btn.classList.remove("holding");
    };
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      btn.classList.add("holding");
      t = setTimeout(() => {
        btn.classList.remove("holding");
        fn();
      }, 1200);
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => btn.addEventListener(ev, cancel));
    btn.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  // ---------- Sticker book ----------
  function stickerHtml(s, extra = "", style = "") {
    const label = s.gold ? `<span class="lvl">${esc(D.topic(s.t).name.split(" ")[0])} ${s.lv}</span>` : "";
    return `<div class="sticker got ${s.gold ? "gold" : ""} ${extra}" style="${style}"><span class="emoji">${s.e}</span>${label}</div>`;
  }

  function stickerBook() {
    const p = S.profile();
    const empty = Math.max(6, 12 - p.stickers.length);
    const cells = p.stickers.map((s) => stickerHtml(s)).join("") + `<div class="sticker"></div>`.repeat(empty);
    show(
      `<div class="topbar"><button class="icon-btn" id="back" aria-label="חזרה">${ICON.home}</button></div>
       <div class="sticker-grid">${cells}</div>`,
      "stickers"
    );
    on("#back", "click", home);
    if (!p.stickers.length) talk([seg.p("noStickersYet")]);
  }

  // ---------- Session ----------
  let session = null;

  function startSession() {
    const p = S.profile();
    const sessionNo = p.sessions + 1;
    const tasks = S.planSession(p, sessionNo);
    if (!tasks.length) return noTopics();
    p.sessions = sessionNo;
    S.saveProfile(p);
    session = { p, no: sessionNo, tasks, i: 0, requeued: new Set(), gold: [], total: tasks.length, doneCount: 0 };
    runTask();
  }

  function noTopics() {
    show(
      `<div class="parent-page">
        <div class="hero small">${GUIDE}</div>
        <h2>אין נושא פעיל</h2>
        <p>כדי להתחיל, ההורה מפעיל באזור ההורים לפחות נושא אחד לתרגול.</p>
        <button class="btn primary" id="gate">לאזור ההורים</button>
        <button class="btn" id="back">חזרה</button>
      </div>`,
      "parent"
    );
    on("#gate", "click", parentGate);
    on("#back", "click", home);
  }

  function sessionShell(stageHtml, cls) {
    const dots = Array.from({ length: session.total }, (_, k) => `<i class="${k < session.doneCount ? "on" : ""}"></i>`).join("");
    const v = show(
      `<div class="topbar">
         <button class="icon-btn" id="exit" aria-label="יציאה">${ICON.close}</button>
         <div class="dots" aria-hidden="true">${dots}</div>
         <button class="icon-btn speaker" id="again" aria-label="שמע שוב">${ICON.speaker}</button>
       </div>
       <div class="stage ${cls || ""}">${stageHtml}</div>`,
      "session"
    );
    on("#exit", "click", () => {
      session = null;
      home();
    });
    on("#again", "click", () => v.replay && v.replay());
    return v;
  }

  function runTask() {
    if (!session) return;
    if (session.i >= session.tasks.length) return endSession();
    exercise(session.tasks[session.i]);
  }

  function finishTask(q, firstTry) {
    if (!session) return;
    session.doneCount++;
    const r = S.record(session.p, q, firstTry, session.no);
    if (r.levelPassed) session.gold.push(r.levelPassed);
    session.i++;
    runTask();
  }

  async function endSession() {
    const s = session;
    session = null;
    const got = [S.addSticker(s.p), ...s.gold.map((g) => S.addSticker(s.p, g))];
    const stickers = got.map((st, i) => stickerHtml(st, "pop", `animation-delay:${0.4 + i * 0.3}s`)).join("");
    show(
      `<div class="end">
        <div class="confetti" aria-hidden="true">${"<i></i>".repeat(14)}</div>
        <div class="home-guide">${GUIDE}</div>
        <h1>כׇּל הַכָּבוֹד ${esc(s.p.name)}!</h1>
        <div class="new-stickers">${stickers}</div>
        <button class="play-btn small" id="home" aria-label="הביתה">${ICON.home}</button>
      </div>`,
      "end"
    );
    on("#home", "click", home);
    A.sfx.sticker();
    await wait(500);
    const segs = [seg.p("wellDone"), seg.name(), seg.p("done"), seg.p("newSticker")];
    if (s.gold.length) segs.push(seg.p("levelUp"));
    talk(segs);
  }

  // ---------- Help visuals ----------
  function visualHtml(vis) {
    if (vis.type === "pairs") {
      // Two rows: every column is a pair; an odd number leaves one dot alone.
      const cols = Math.ceil(vis.n / 2);
      const cells = Array.from({ length: vis.n }, (_, i) => `<i class="${vis.n % 2 && i === vis.n - 1 ? "b" : "a"}"></i>`);
      const units = vis.units ? `<div class="vis-label">ספרת האחדות</div>` : "";
      return `${units}<div class="pairs" style="grid-template-columns:repeat(${cols}, 26px)">${cells.join("")}</div>`;
    }
    if (vis.type === "hops") {
      const jump = `<span class="hop">${vis.up ? "+" : "−"}${vis.s}</span>`;
      const items = vis.seq.map((n, i) => `<span class="hop-n ${i === vis.h ? "slot" : ""}">${i === vis.h ? "?" : n}</span>`);
      return `<div class="hops">${items.join(jump)}</div>`;
    }
    if (vis.type === "pics") {
      const cells = vis.cells.map((c, i) => {
        const gap = i > 0 && c !== vis.cells[i - 1] && vis.cells[i - 1] === "a" && c === "b" ? " gap" : "";
        return `<span class="pic-cell ${c}${gap}">${c === "slot" ? "" : vis.pic}</span>`;
      });
      return `<div class="pics">${cells.join("")}</div>`;
    }
    if (vis.type === "frames") {
      const frames = [];
      for (let i = 0; i < vis.cells.length; i += 10) {
        frames.push(`<div class="frame">${vis.cells.slice(i, i + 10).map((c) => `<i class="${c}"></i>`).join("")}</div>`);
      }
      return `<div class="frames">${frames.join("")}</div>`;
    }
    const group = (g) =>
      `<div class="bgroup">
        ${g.rods.map((c) => `<i class="rod ${c}"></i>`).join("")}
        ${g.cubes.length ? `<div class="cubes ${g.broke ? "broke" : ""}">${g.cubes.map((c) => `<i class="${c}"></i>`).join("")}</div>` : ""}
      </div>`;
    return `<div class="blocks">${vis.groups.map(group).join(vis.op ? `<b class="bop">${G.sign(vis.op)}</b>` : "")}</div>`;
  }

  // A chain "8 + 5 = 8 + 2 + 3 = 10 + 3 = 13" is written with the = signs
  // under each other, as in the math books.
  function stepsHtml(lines) {
    return lines
      .map((l) => {
        const parts = l.split(" = ");
        return parts
          .slice(1)
          .map((x, i) => `<span class="lhs">${i ? "" : esc(parts[0])}</span><span class="rhs">= ${esc(x)}</span>`)
          .join("");
      })
      .join("");
  }

  // ---------- An exercise ----------
  function exercise(q) {
    const p = session.p;
    const ans = G.answer(q);
    const mode = S.answerMode(p, q);
    const vis = G.visual(q);
    const blankHtml = `<span class="n blank" id="blank">?</span>`;
    const part = (k) => (q.m === k ? blankHtml : `<span class="n">${q[k]}</span>`);
    let problem;
    if (q.f === "par") problem = `<div class="problem par" dir="ltr" data-form="par"><span class="n">${q.n}</span></div>`;
    else if (q.f === "seq")
      problem = `<div class="problem seq" dir="ltr" data-form="seq">${q.seq
        .map((n, i) => (i === q.h ? blankHtml : `<span class="n">${n}</span>`))
        .join(`<span class="sep">,</span>`)}</div>`;
    else problem = `<div class="problem" dir="ltr">${part("a")}<span class="op">${G.sign(q.op)}</span>${part("b")}<span class="op">=</span>${part("c")}</div>`;
    const card = (v) =>
      q.f === "par"
        ? `<button class="card word" data-v="${v}"><span>${D.PARITY_LABEL[v]}</span></button>`
        : `<button class="card num" data-v="${v}"><span dir="ltr">${v}</span></button>`;
    const answers =
      mode === "choice"
        ? `<div class="choices">${G.choices(q).map(card).join("")}</div>`
        : `<div class="keypad" dir="ltr">${[1, 2, 3, 4, 5, 6, 7, 8, 9, "del", 0, "ok"]
            .map((k) => {
              const label = k === "del" ? "⌫" : k === "ok" ? "✓" : k;
              const aria = k === "del" ? ` aria-label="מחיקה"` : k === "ok" ? ` aria-label="אישור"` : "";
              return `<button class="key ${k === "ok" ? "ok" : ""}" data-k="${k}"${aria}>${label}</button>`;
            })
            .join("")}</div>`;
    const v = sessionShell(
      `${problem}
       <div class="help-area">
         <div class="visual" id="visual" ${vis.always ? "" : "hidden"}>${visualHtml(vis)}</div>
         <div class="steps" id="steps" dir="ltr" hidden></div>
       </div>
       <button class="help-btn" id="help" ${vis.always ? "hidden" : ""}>💡 עזרה</button>
       <div class="answers ${mode}" id="answers">${answers}</div>`,
      "ex-stage " + mode
    );

    let attempts = 0;
    let locked = false;
    let entry = "";
    // Even/odd has no blank in the exercise; the chosen card shows the answer.
    const blank = $("#blank") || document.createElement("span");
    const prompt = () => talk(questionSpeech(q));
    v.replay = prompt;

    const showHelp = () => {
      $("#visual").hidden = false;
      $("#help").hidden = true;
    };
    on("#help", "click", () => {
      A.sfx.tap();
      showHelp();
    });

    async function right(btn) {
      locked = true;
      blank.textContent = ans;
      blank.classList.add("right");
      btn && btn.classList.add("right");
      A.sfx.correct();
      if (attempts === 0 && Math.random() < 0.4) await talk([seg.praise()]);
      else await wait(800);
      finishTask(q, attempts === 0);
    }

    async function wrong(btn) {
      attempts++;
      A.sfx.soft();
      if (btn && q.f === "par") {
        // Only two answers: keep both, or the second guess needs no thinking.
        btn.classList.add("shake");
        setTimeout(() => btn.classList.remove("shake"), 400);
      } else if (btn) {
        btn.classList.add("wrong");
        btn.disabled = true;
      }
      locked = true;
      if (attempts === 1) {
        // First miss: the help appears, and we look at it together.
        blank.classList.add("shake");
        setTimeout(() => blank.classList.remove("shake"), 400);
        showHelp();
        await talk([seg.p("checkTogether"), ...questionSpeech(q)]);
        locked = false;
        return;
      }
      // Second miss: the way to the answer; the exercise comes back later.
      blank.textContent = ans;
      blank.classList.add("reveal");
      $$(".card").forEach((b) => b.dataset.v === String(ans) && b.classList.add("reveal"));
      $("#visual").hidden = true;
      $("#help").hidden = true;
      const steps = $("#steps");
      const note = G.stepsNote(q);
      steps.innerHTML = (note ? `<div class="note" dir="rtl">${esc(note)}</div>` : "") + stepsHtml(G.steps(q));
      steps.hidden = false;
      if (!session.requeued.has(G.key(q))) {
        session.requeued.add(G.key(q));
        session.tasks.splice(Math.min(session.tasks.length, session.i + 4), 0, { ...q });
        session.total++;
      }
      $("#answers").innerHTML = `<button class="next-btn" id="next" aria-label="הלאה">${ICON.next}</button>`;
      $("#answers").className = "answers";
      on("#next", "click", () => {
        A.sfx.tap();
        finishTask(q, false);
      });
      await talk([seg.p("showHow"), ...equationSpeech(q)]);
    }

    if (mode === "choice") {
      $$(".card").forEach((btn) =>
        btn.addEventListener("click", () => {
          if (locked || btn.disabled) return;
          if (btn.dataset.v === String(ans)) right(btn);
          else wrong(btn);
        })
      );
    } else {
      const maxLen = Math.max(2, String(ans).length + 1);
      $$(".key").forEach((btn) =>
        btn.addEventListener("click", () => {
          if (locked) return;
          const k = btn.dataset.k;
          A.sfx.tap();
          if (k === "del") entry = entry.slice(0, -1);
          else if (k === "ok") {
            if (!entry) return;
            const val = Number(entry);
            entry = "";
            if (val === ans) return right();
            blank.textContent = "?";
            return wrong();
          } else if (entry.length < maxLen) entry = entry === "0" ? String(k) : entry + k;
          blank.textContent = entry || "?";
          blank.classList.toggle("typing", !!entry);
        })
      );
    }
    prompt();
  }

  // ---------- Parent gate ----------
  // A two-digit multiplication: a second-grader may know 3 × 4.
  function parentGate() {
    const a = 12 + Math.floor(Math.random() * 8);
    const b = 3 + Math.floor(Math.random() * 7);
    let entry = "";
    const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, "⌫", 0, "✓"].map((k) => `<button class="key" data-k="${k}">${k}</button>`).join("");
    show(
      `<div class="topbar"><button class="icon-btn" id="back" aria-label="חזרה">${ICON.close}</button></div>
       <div class="gate">
         <p>להורים: כמה זה</p>
         <div class="q" dir="ltr">${a} × ${b} = <span id="entry">?</span></div>
         <div class="keypad" dir="ltr">${keys}</div>
       </div>`,
      "parent gate-screen"
    );
    on("#back", "click", home);
    $$(".key").forEach((btn) =>
      btn.addEventListener("click", () => {
        const k = btn.dataset.k;
        if (k === "⌫") entry = entry.slice(0, -1);
        else if (k === "✓") {
          if (Number(entry) === a * b) return parentHome();
          entry = "";
          $(".q").classList.add("shake");
          setTimeout(() => $(".q") && $(".q").classList.remove("shake"), 400);
        } else if (entry.length < 3) entry += k;
        $("#entry").textContent = entry || "?";
      })
    );
  }

  // ---------- Parent area ----------
  // Re-render the parent page in place, keeping the scroll position.
  function refresh() {
    const y = $app.scrollTop;
    parentHome();
    $app.scrollTop = y;
  }

  function parentHome() {
    const p = S.profile();
    if (!p) return welcome();
    const kids = S.profiles()
      .map((k) => `<button class="chip ${k.id === p.id ? "on" : ""}" data-id="${k.id}">${esc(k.name)} · כיתה ${k.grade}׳</button>`)
      .join("");

    const sugg = S.suggestions(p)
      .map((s) => {
        const t = D.topic(s.t);
        const txt =
          s.dir === "up"
            ? `${esc(p.name)} ${p.gender === "f" ? "שולטת" : "שולט"} ב${t.name} ברמה ${s.lv - 1}. לעבור לרמה ${s.lv}: ${t.levels[s.lv - 1].d}?`
            : `${t.name} ברמה ${s.lv + 1} קשה כרגע (הרבה טעויות). לחזור לרמה ${s.lv}: ${t.levels[s.lv - 1].d}?`;
        return `<div class="sugg"><p>${txt}</p><div class="row-btns">
          <button class="btn small primary" data-accept="${s.t}" data-lv="${s.lv}">כן, ${s.dir === "up" ? "להעלות" : "להוריד"}</button>
          <button class="btn small" data-dismiss="${s.t}">לא עכשיו</button></div></div>`;
      })
      .join("");

    const topics = D.TOPICS.map((t) => {
      const cur = p.topics[t.id];
      const L = t.levels[cur.lv - 1];
      const ex = G.make(t.id, cur.lv);
      return `<div class="card-box topic ${cur.on ? "" : "off"}">
        <div class="topic-head">
          <h3>${t.name}</h3>
          <button class="switch ${cur.on ? "on" : ""}" data-toggle="${t.id}" role="switch" aria-checked="${cur.on}"
            aria-label="${t.name} — ${cur.on ? "פעיל" : "כבוי"}"><i></i></button>
        </div>
        <div class="lv-line"><b>רמה ${cur.lv} מתוך ${t.levels.length}</b> · ${L.d}</div>
        <div class="example">דוגמה: ${ltr(G.text(ex))}</div>
        <div class="lv-btns">
          <button class="btn lv" data-lvdown="${t.id}" ${cur.lv <= 1 ? "disabled" : ""}>הוֹרֵד רָמָה</button>
          <button class="btn lv primary" data-lvup="${t.id}" ${cur.lv >= t.levels.length ? "disabled" : ""}>הַעֲלֵה רָמָה</button>
        </div>
      </div>`;
    }).join("");

    const week = S.weekSummary(p);
    const pct = week.byTopic
      .map((x) => `<div><b>${x.pct == null ? "—" : x.pct + "%"}</b><span>${D.topic(x.t).name}</span></div>`)
      .join("");
    const hard = S.hardFacts(p);
    const hardHtml = hard.length
      ? `<div class="facts">${hard.map((f) => `<span class="fact">${ltr(G.text(f.q, true))}</span>`).join("")}</div>
         ${
           p.focusHard
             ? `<p class="muted">הששן הבא יתחיל מהעובדות האלה.</p>`
             : `<button class="btn" id="focus">לתרגל אותן במיוחד בששן הבא</button>`
         }`
      : `<p class="muted">עוד אין עובדות שחוזרות בהן טעויות.</p>`;

    const voiceOk = A.hasHebrewVoice();
    const voiceHtml = voiceOk
      ? `<p class="muted">מושמע בקול העברי של המכשיר (${esc(A.voiceName())}).</p>`
      : `<p class="warn">לא נמצא קול עברי במכשיר. באייפון: הגדרות ← נגישות ← תוכן מדובר ← קולות ← עברית. באנדרואיד: הגדרות ← המרת טקסט לדיבור ← התקנת עברית.</p>`;

    show(
      `<div class="parent-page dash">
        <div class="dash-head">
          <h1>אזור הורים</h1>
          <button class="btn small" id="back">חזרה לילד</button>
        </div>
        <div class="kids">${kids}<button class="chip add" id="addKid">+ ילד נוסף</button></div>

        ${sugg ? `<div class="card-box suggs"><h2>הצעות</h2>${sugg}</div>` : ""}

        <div class="card-box">
          <h2>כיתה</h2>
          <div class="seg-ctl" id="grade">${D.GRADES.map((g) => `<button data-v="${g}" class="${p.grade === g ? "on" : ""}">כיתה ${g}׳</button>`).join("")}</div>
          <p class="muted">שינוי הכיתה מחזיר כל נושא לרמת הפתיחה של הכיתה.</p>
        </div>

        <h2 class="sec">מה מתרגלים</h2>
        <p class="muted">מפעילים את מה שכבר נלמד בכיתה, וקובעים לכל נושא את הרמה.</p>
        ${topics}

        <div class="card-box">
          <div class="topic-head">
            <h3>התקדמות אוטומטית</h3>
            <button class="switch ${p.autoProgress ? "on" : ""}" id="auto" role="switch" aria-checked="${p.autoProgress}" aria-label="התקדמות אוטומטית"><i></i></button>
          </div>
          <p class="muted">כשהילד עונה נכון 8 מתוך 10 בשני ששנים שונים, תופיע כאן הצעה לעלות רמה (ואחרי הרבה טעויות — לרדת). הרמה לא משתנה בלי אישור שלכם.</p>
        </div>

        <div class="card-box">
          <h2>השבוע</h2>
          <div class="stats"><div><b>${week.n}</b><span>תרגילים</span></div>${pct}</div>
          <p class="muted">אחוז התשובות הנכונות בניסיון הראשון.</p>
        </div>

        <div class="card-box">
          <h2>עובדות שמתקשים בהן</h2>
          ${hardHtml}
        </div>

        <div class="card-box">
          <h2>הגדרות</h2>
          <label class="field"><span>שם הילד</span><input type="text" id="name" maxlength="20" value="${esc(p.name)}" autocomplete="off" /></label>
          <div class="field"><span>פנייה</span>
            <div class="seg-ctl" id="gender"><button data-v="m" class="${p.gender === "m" ? "on" : ""}">בּוֹא (בן)</button><button data-v="f" class="${p.gender === "f" ? "on" : ""}">בּוֹאִי (בת)</button></div></div>
          <div class="field"><span>צורת התשובה</span>
            <div class="seg-ctl" id="mode">
              <button data-v="level" class="${p.answerMode === "level" ? "on" : ""}">לפי הרמה</button>
              <button data-v="choice" class="${p.answerMode === "choice" ? "on" : ""}">בחירה</button>
              <button data-v="type" class="${p.answerMode === "type" ? "on" : ""}">הקלדה</button>
            </div>
            <span class="sub">"לפי הרמה": בחירה מבין 3 ברמות הנמוכות, הקלדה במקלדת מספרים ברמות הגבוהות.</span></div>
          <div class="field"><span>מהירות הקול</span>
            <div class="rate-row"><input type="range" id="rate" min="0.6" max="1.1" step="0.05" value="${p.rate}" /><button class="btn small" id="try">נסו</button></div></div>
          ${voiceHtml}
          <button class="btn" id="voice">בדיקת קול: כל המשפטים והמספרים</button>
        </div>

        <div class="card-box">
          <h2>גיבוי ונתונים</h2>
          <button class="btn" id="export">שמירת גיבוי לקובץ</button>
          <label class="btn file-btn">שחזור מגיבוי<input type="file" id="import" accept="application/json,.json" hidden /></label>
          ${S.profiles().length > 1 ? `<button class="btn danger" id="delKid">מחיקת הפרופיל של ${esc(p.name)}</button>` : ""}
          <button class="btn danger" id="reset">מחיקת כל הנתונים</button>
        </div>
      </div>`,
      "parent"
    );

    on("#back", "click", home);
    $$(".kids .chip[data-id]").forEach((b) =>
      b.addEventListener("click", () => {
        S.switchTo(b.dataset.id);
        refresh();
      })
    );
    on("#addKid", "click", () => newKidForm(false));
    $$("[data-accept]").forEach((b) =>
      b.addEventListener("click", () => {
        S.setLevel(p, b.dataset.accept, Number(b.dataset.lv));
        refresh();
      })
    );
    $$("[data-dismiss]").forEach((b) =>
      b.addEventListener("click", () => {
        S.dismiss(p, b.dataset.dismiss);
        refresh();
      })
    );
    segCtl("#grade", (g) => {
      if (g === p.grade) return;
      if (confirm(`לעבור לכיתה ${g}׳? כל נושא יחזור לרמת הפתיחה של כיתה ${g}׳.`)) S.applyGrade(p, g);
      S.saveProfile(p);
      refresh();
    });
    $$("[data-toggle]").forEach((b) =>
      b.addEventListener("click", () => {
        const cur = p.topics[b.dataset.toggle];
        cur.on = !cur.on;
        S.saveProfile(p);
        refresh();
      })
    );
    $$("[data-lvup]").forEach((b) =>
      b.addEventListener("click", () => {
        S.setLevel(p, b.dataset.lvup, p.topics[b.dataset.lvup].lv + 1);
        refresh();
      })
    );
    $$("[data-lvdown]").forEach((b) =>
      b.addEventListener("click", () => {
        S.setLevel(p, b.dataset.lvdown, p.topics[b.dataset.lvdown].lv - 1);
        refresh();
      })
    );
    on("#auto", "click", () => {
      p.autoProgress = !p.autoProgress;
      S.saveProfile(p);
      refresh();
    });
    on("#focus", "click", () => {
      p.focusHard = true;
      S.saveProfile(p);
      refresh();
    });
    on("#name", "change", () => {
      const name = $("#name").value.trim();
      if (name) {
        p.name = name;
        S.saveProfile(p);
        refresh();
      }
    });
    segCtl("#gender", (g) => {
      p.gender = g;
      S.saveProfile(p);
    });
    segCtl("#mode", (m) => {
      p.answerMode = m;
      S.saveProfile(p);
    });
    on("#rate", "change", () => {
      p.rate = Number($("#rate").value);
      A.setRate(p.rate);
      S.saveProfile(p);
    });
    on("#try", "click", () => {
      A.unlock();
      A.setRate(Number($("#rate").value));
      const q = { t: "add", lv: 4, a: 8, op: "+", b: 5, c: 13, m: "c" };
      A.say(questionSpeech(q));
    });
    on("#voice", "click", voiceCheck);
    on("#export", "click", () => {
      const blob = new Blob([S.exportData()], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `math-kids-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => (URL.revokeObjectURL(a.href), a.remove()), 1000);
    });
    on("#import", "change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        S.importData(await file.text());
        alert("הגיבוי שוחזר.");
        start();
      } catch (_) {
        alert("הקובץ הזה אינו גיבוי תקין.");
      }
    });
    on("#delKid", "click", () => {
      if (confirm(`למחוק את הפרופיל של ${p.name} ואת כל ההתקדמות שלו?`)) {
        S.removeProfile(p.id);
        refresh();
      }
    });
    on("#reset", "click", () => {
      if (confirm("למחוק את כל הנתונים מהמכשיר? אי אפשר לבטל.")) {
        S.resetAll();
        start();
      }
    });
  }

  // Every phrase and number, to hear how the device voice reads the niqqud.
  function voiceCheck() {
    const rows = [];
    for (const [name, v] of Object.entries(D.PHRASES)) {
      if (Array.isArray(v)) v.forEach((text, i) => rows.push({ key: `p.${name}.${i}`, text }));
      else if (typeof v === "string") rows.push({ key: "p." + name, text: v });
      else ["m", "f"].forEach((g) => rows.push(seg.p(name, g)));
    }
    Object.values(D.OPS).forEach((o) => rows.push(o));
    const nums = [...Array(121).keys(), 125, 150, 199, 200, 210, 300, 325, 400, 500, 600, 700, 800, 900, 999, 1000];
    nums.forEach((n) => rows.push(seg.num(n)));
    const sample = { t: "add", lv: 3, a: 3, op: "+", b: 4, c: 7 };
    rows.push({ key: "sample.1", text: A.chunks(questionSpeech({ ...sample, m: "c" }))[0].text, label: "כמה זה 3 + 4?" });
    rows.push({ key: "sample.2", text: A.chunks(questionSpeech({ ...sample, m: "b" }))[0].text, label: "3 + ? = 7" });

    show(
      `<div class="parent-page">
        <div class="dash-head"><h1>בדיקת קול</h1><button class="btn small" id="back">חזרה</button></div>
        <p class="muted">לחיצה על שורה משמיעה אותה בקול של המכשיר. אם משהו נקרא לא נכון, אפשר להחליף אותו בעתיד בהקלטה לפי המפתח שבסוגריים.</p>
        <div class="voice-list">${rows
          .map(
            (r, i) => `<button class="voice-row" data-i="${i}">${ICON.speaker}<span>${esc(r.text)}</span>
              <small dir="ltr">${esc(r.label || r.key || "")}</small></button>`
          )
          .join("")}</div>
      </div>`,
      "parent"
    );
    on("#back", "click", parentHome);
    $$(".voice-row").forEach((b) =>
      b.addEventListener("click", () => {
        A.unlock();
        A.say([rows[Number(b.dataset.i)]]);
      })
    );
  }

  // Start once the splash is gone (or right away if there is none).
  if (document.getElementById("splash")) document.addEventListener("sugi-splash-done", start, { once: true });
  else start();
})();
