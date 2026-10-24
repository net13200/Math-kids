/* End-to-end check in a phone-sized browser.
 * Run: node tests/e2e.js   (screenshots go to tests/shots/)
 *
 * speechSynthesis is replaced by a fake that "speaks" for ~15ms and records
 * what was said, so the run is fast and the spoken text can be checked. */
const { chromium, devices } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SHOTS = path.join(__dirname, "shots");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2" };

function serve() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      return res.end("not found");
    }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((r) => server.listen(0, () => r(server)));
}

const FAKE_SPEECH = () => {
  window.__said = [];
  class U {
    constructor(text) {
      this.text = text;
    }
  }
  const synth = {
    speaking: false,
    getVoices: () => [{ name: "Test Hebrew", lang: "he-IL", localService: true }],
    addEventListener() {},
    cancel() {
      clearTimeout(this.t);
    },
    speak(u) {
      if (u.text.trim()) window.__said.push(u.text);
      this.t = setTimeout(() => u.onend && u.onend(), 15);
    },
  };
  Object.defineProperty(window, "speechSynthesis", { value: synth });
  window.SpeechSynthesisUtterance = U;
};

let failures = 0;
function check(cond, msg) {
  if (cond) console.log("  ✓ " + msg);
  else {
    failures++;
    console.log("  ✗ " + msg);
  }
}

// Solve what is on screen ("8 + 5 = ?", "3 + ? = 7") from the DOM.
async function readProblem(page) {
  const form = await page.$eval(".problem", (e) => e.dataset.form || "");
  if (form === "par") {
    const n = Number(await page.textContent(".problem .n"));
    return { text: String(n), ans: n % 2 ? "odd" : "even" };
  }
  if (form === "seq") {
    const items = await page.$$eval(".problem .n", (els) => els.map((e) => e.textContent.trim()));
    const known = items.map((x, i) => [i, Number(x)]).filter(([i]) => items[i] !== "?");
    const step = (known[1][1] - known[0][1]) / (known[1][0] - known[0][0]);
    const h = items.indexOf("?");
    return { text: items.join(", "), ans: known[0][1] + step * (h - known[0][0]) };
  }
  const parts = await page.$$eval(".problem > span", (els) => els.map((e) => e.textContent.trim()));
  const [a, op, b, , c] = parts;
  const n = (x) => Number(x);
  const plus = op === "+";
  let ans;
  if (c === "?") ans = plus ? n(a) + n(b) : n(a) - n(b);
  else if (b === "?") ans = plus ? n(c) - n(a) : n(a) - n(c);
  else ans = plus ? n(c) - n(b) : n(a) + n(c);
  return { text: parts.join(" "), ans };
}

// Left to right: the first number is left of the operator, the result is on the right.
async function checkLtr(page) {
  const xs = await page.$$eval(".problem > span", (els) => els.map((e) => e.getBoundingClientRect().left));
  return xs.every((x, i) => i === 0 || x > xs[i - 1]);
}

async function mode(page) {
  return (await page.$(".keypad")) ? "type" : "choice";
}

async function giveAnswer(page, value) {
  if ((await mode(page)) === "type") {
    for (const d of String(value)) await page.click(`.key[data-k="${d}"]`);
    await page.click('.key[data-k="ok"]');
  } else {
    const card = await page.$(`.card[data-v="${value}"]:not([disabled])`);
    if (card) await card.click();
    else await page.click(".card:not([disabled])");
  }
}

async function wrongValue(page, ans) {
  if ((await mode(page)) === "type") return ans + 1;
  const vals = await page.$$eval(".card:not([disabled])", (els) => els.map((e) => e.dataset.v));
  return vals.find((v) => v !== String(ans));
}

const waitIdle = (page) => page.waitForTimeout(120);

async function setup(page, fn, arg) {
  await page.evaluate(fn, arg);
  await page.reload();
  await page.click("#splash").catch(() => {});
  await page.waitForSelector("#play");
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const server = await serve();
  const url = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...devices["iPhone 12 Pro"], deviceScaleFactor: 2 });
  await context.addInitScript(FAKE_SPEECH);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => m.type() === "error" && errors.push("console: " + m.text()));
  page.on("dialog", (d) => d.accept());
  const said = () => page.evaluate(() => window.__said.join(" | "));
  const shot = (name) => page.screenshot({ path: path.join(SHOTS, name + ".png") });

  console.log("First run");
  await page.goto(url);
  await page.waitForSelector("#splash-word.is-visible", { timeout: 4000 }).catch(() => {});
  await page.click("#splash");
  await page.waitForSelector("#go");
  await shot("01-welcome");
  await page.click("#go");
  await page.fill("#name", "נועם");
  await page.click("#save");
  await page.waitForSelector("#play");
  await page.waitForTimeout(500);
  check((await said()).includes("נועם"), "the guide greets the child by name");
  await shot("02-home");

  console.log("A session: right, wrong once, wrong twice");
  await page.click("#play");
  await page.waitForSelector(".problem");
  let seen = 0;
  let ltrOk = true;
  let i = 0;
  while ((await page.$(".problem")) && i < 20) {
    const q = await readProblem(page);
    ltrOk = ltrOk && (await checkLtr(page));
    if (i === 0) {
      await shot("03-exercise-" + (await mode(page)));
      await giveAnswer(page, q.ans);
      await page.waitForSelector(".blank.right, .card.right");
      check(true, `right answer: ${q.text} → ${q.ans}`);
    } else if (i === 1) {
      await page.evaluate(() => (window.__said = []));
      await giveAnswer(page, await wrongValue(page, q.ans));
      await page.waitForSelector("#visual:not([hidden])");
      await waitIdle(page);
      check((await said()).includes("נִבְדֹּק"), "first miss: help appears and “let's check together”");
      await shot("04-first-miss");
      await giveAnswer(page, q.ans);
    } else if (i === 2) {
      await giveAnswer(page, await wrongValue(page, q.ans));
      await page.waitForSelector("#visual:not([hidden])");
      await waitIdle(page);
      await giveAnswer(page, await wrongValue(page, q.ans));
      await page.waitForSelector("#steps:not([hidden])");
      check(true, "second miss: the way to the answer is shown");
      await shot("05-second-miss");
      await page.click("#next");
      await page.waitForFunction(() => !document.querySelector("#next"));
      const total = await page.$$eval(".dots i", (d) => d.length);
      check(total === 11, "the missed exercise comes back later in the session");
    } else {
      await giveAnswer(page, q.ans);
    }
    seen++;
    i++;
    await page.waitForFunction(() => !document.querySelector(".blank.right, .blank.reveal, .card.right") || document.querySelector(".end"), null, { timeout: 4000 });
  }
  check(ltrOk, "every exercise is written left to right");
  await page.waitForSelector(".end", { timeout: 4000 });
  check(seen === 11, `session finished after ${seen} exercises`);
  await page.waitForTimeout(1000);
  check((await said()).includes("כׇּל הַכָּבוֹד"), "end screen: well done + sticker");
  await shot("06-end");
  await page.click("#home");
  await page.waitForSelector("#play");
  check((await page.textContent("#stickers")).trim() === "1", "one sticker in the album");

  // One topic and level at a time, for a screenshot of each exercise type.
  const only = async (t, lv, answerMode = "level", grade = "א") => {
    await setup(
      page,
      ([t, lv, answerMode, grade]) => {
        const S = window.App.store;
        const p = S.profile();
        p.grade = grade;
        p.answerMode = answerMode;
        for (const k of Object.keys(p.topics)) p.topics[k].on = k === t;
        p.topics[t].lv = lv;
        p.facts = {}; // no missed facts from earlier steps
        S.saveProfile(p);
      },
      [t, lv, answerMode, grade]
    );
    await page.evaluate(() => (window.App.data.REVIEW_SHARE = 0));
    await page.click("#play");
    await page.waitForSelector(".problem");
  };
  const types = [
    ["add", 1, "pics: addition to 5"],
    ["sub", 1, "pics: subtraction to 5"],
    ["bond", 1, "ten frame: friends of 10"],
    ["add", 4, "typing: addition through ten"],
    ["sub", 4, "typing: subtraction through ten"],
    ["bond", 4, "to 20"],
    ["add", 5, "whole tens"],
    ["add", 8, "two-digit with carrying"],
    ["sub", 8, "two-digit with borrowing"],
    ["bond", 5, "to the next ten"],
    ["bond", 6, "friends of 100"],
    ["parity", 1, "even/odd to 10, dots in pairs"],
    ["parity", 2, "even/odd to 20"],
    ["parity", 3, "even/odd to 100"],
    ["parity", 4, "counting by 2"],
    ["parity", 5, "counting by 2, 5, 10"],
    ["parity", 6, "counting back"],
  ];
  console.log("Each exercise type: right and wrong paths, screenshots");
  for (const [t, lv, label] of types) {
    await only(t, lv);
    const q = await readProblem(page);
    const ltr = await checkLtr(page);
    await page.click("#help").catch(() => {});
    await page.waitForSelector("#visual:not([hidden])");
    await shot(`10-${t}-${lv}-help`);
    const fits = await page.evaluate(() => {
      const r = document.querySelector(".answers").getBoundingClientRect();
      return r.bottom <= window.innerHeight + 1 && document.documentElement.scrollWidth <= window.innerWidth;
    });
    await giveAnswer(page, await wrongValue(page, q.ans));
    await waitIdle(page);
    await giveAnswer(page, await wrongValue(page, q.ans));
    await page.waitForSelector("#steps:not([hidden])");
    await shot(`11-${t}-${lv}-steps`);
    await page.click("#next");
    const q2 = await readProblem(page);
    await giveAnswer(page, q2.ans);
    await page.waitForSelector(".blank.right, .card.right");
    check(ltr && fits, `${label}: ${q.text}, left to right, fits the screen`);
  }
  await only("add", 6, "choice", "ב");
  await shot("12-choice-two-digit");
  await only("sub", 3, "type", "ב");
  await shot("13-type-forced");

  console.log("Parent area");
  await setup(page, () => {
    const S = window.App.store;
    const p = S.profile();
    p.answerMode = "level";
    for (const k of Object.keys(p.topics)) p.topics[k].on = true;
    S.applyGrade(p, "א");
    S.saveProfile(p);
  });
  const lock = await page.$("#lock");
  const box = await lock.boundingBox();
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.down();
  await page.waitForTimeout(400);
  await page.mouse.up();
  check(!(await page.$(".gate")), "a short press does not open the parent area");
  await page.mouse.down();
  await page.waitForTimeout(1350);
  await page.mouse.up();
  await page.waitForSelector(".gate");
  const gq = await page.textContent(".gate .q");
  const [ga, gb] = gq.match(/\d+/g).map(Number);
  check(ga >= 12 && gb >= 3, `gate asks a two-digit multiplication (${ga} × ${gb})`);
  for (const d of String(ga * gb)) await page.click(`.gate .key[data-k="${d}"]`);
  await page.click('.gate .key[data-k="✓"]');
  await page.waitForSelector(".dash");
  await shot("20-parent");
  await page.click('[data-lvup="add"]');
  check((await page.textContent(".topic .lv-line")).includes("רמה 4"), "raise level: addition goes to level 4");
  await page.click('[data-lvdown="add"]');
  check((await page.textContent(".topic .lv-line")).includes("רמה 3"), "lower level: back to 3");
  await page.click('[data-toggle="sub"]');
  check(await page.$eval('[data-toggle="sub"]', (b) => !b.classList.contains("on")), "a topic can be switched off");
  await page.click('[data-toggle="sub"]');
  await page.screenshot({ path: path.join(SHOTS, "21-parent-full.png"), fullPage: false });
  await page.evaluate(() => document.getElementById("app").scrollTo(0, 99999));
  await shot("22-parent-bottom");
  await page.click("#voice");
  await page.waitForSelector(".voice-row");
  check((await page.$$(".voice-row")).length > 140, "voice check lists phrases and numbers");
  await page.evaluate(() => (window.__said = []));
  await page.click(".voice-row:nth-child(5)");
  await waitIdle(page);
  check((await said()).length > 0, "a voice-check row plays");
  await shot("23-voice-check");
  await page.click("#back");
  await page.click("#addKid");
  await page.fill("#name", "מיכל");
  await page.click('#gender [data-v="f"]');
  await page.click('#grade [data-v="ב"]');
  await page.click("#save");
  await page.waitForSelector(".dash");
  check((await page.$$(".kids .chip[data-id]")).length === 2, "a second child profile");
  await page.click("#back");
  await page.waitForSelector(".kid-chips");
  await shot("24-home-two-kids");

  console.log("Offline");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(500);
  await context.setOffline(true);
  await page.reload();
  await page.click("#splash").catch(() => {});
  await page.waitForSelector("#play", { timeout: 5000 });
  check(true, "reload without network works");
  await context.setOffline(false);

  check(errors.length === 0, "no page errors or console errors" + (errors.length ? ": " + errors.join("; ") : ""));
  await browser.close();
  server.close();
  console.log(failures ? `\n${failures} failed` : "\nall passed");
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
