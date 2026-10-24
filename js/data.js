/* Content tables: topics and their level ladders, spoken phrases, stickers.
 *
 * Every level is described by data only; js/gen.js turns a level into
 * exercises. To change what a level practises, change it here.
 *
 * Level fields:
 *   d       — what the parent sees ("חיבור עד 20 עם מעבר עשרת")
 *   kind    — the exercise generator (see js/gen.js)
 *   answer  — "choice" (pick one of 3) or "type" (number pad), unless the
 *             parent chose a fixed answer form in the settings
 *   pics    — the exercise is shown with pictures from the start
 *   frame   — the ten frame is shown from the start
 *   missing — share of exercises with a missing number (3 + ? = 7)
 *   other kind-specific limits (max, carry, total…) */
(() => {
  "use strict";

  const App = (window.App = window.App || {});

  const TOPICS = [
    {
      id: "add",
      name: "חיבור",
      // Starting level for a new profile, by grade.
      start: { א: 3, ב: 5 },
      levels: [
        { d: "חיבור עד 5, עם תמונות", kind: "add", max: 5, pics: true, answer: "choice" },
        { d: "חיבור עד 10", kind: "add", max: 10, answer: "choice", missing: 0.2 },
        { d: "חיבור עד 20 בלי מעבר עשרת", kind: "add", max: 20, carry: false, answer: "type", missing: 0.25 },
        { d: "חיבור עד 20 עם מעבר עשרת", kind: "add", max: 20, carry: true, answer: "type", missing: 0.2 },
        { d: "עשרות שלמות עד 100", kind: "addTens", answer: "type", missing: 0.2 },
        { d: "דו־ספרתי וחד־ספרתי, עד 100", kind: "add2d1d", answer: "type" },
        { d: "דו־ספרתי ודו־ספרתי, בלי המרה", kind: "add2d2d", carry: false, answer: "type" },
        { d: "דו־ספרתי ודו־ספרתי, עם המרה", kind: "add2d2d", carry: true, answer: "type" },
      ],
    },
    {
      id: "sub",
      name: "חיסור",
      start: { א: 3, ב: 5 },
      levels: [
        { d: "חיסור עד 5, עם תמונות", kind: "sub", max: 5, pics: true, answer: "choice" },
        { d: "חיסור עד 10", kind: "sub", max: 10, answer: "choice", missing: 0.2 },
        { d: "חיסור עד 20 בלי מעבר עשרת", kind: "sub", max: 20, carry: false, answer: "type", missing: 0.25 },
        { d: "חיסור עד 20 עם מעבר עשרת", kind: "sub", max: 20, carry: true, answer: "type", missing: 0.2 },
        { d: "עשרות שלמות עד 100", kind: "subTens", answer: "type", missing: 0.2 },
        { d: "דו־ספרתי פחות חד־ספרתי, עד 100", kind: "sub2d1d", answer: "type" },
        { d: "דו־ספרתי פחות דו־ספרתי, בלי המרה", kind: "sub2d2d", carry: false, answer: "type" },
        { d: "דו־ספרתי פחות דו־ספרתי, עם המרה", kind: "sub2d2d", carry: true, answer: "type" },
      ],
    },
    {
      id: "bond",
      name: "חברים של 10 ופירוק",
      start: { א: 2, ב: 4 },
      levels: [
        { d: "חברים של 10, עם מסגרת עשר", kind: "bond", total: 10, frame: true, answer: "choice" },
        { d: "חברים של 10", kind: "bond", total: 10, answer: "type" },
        { d: "פירוק מספרים עד 10 (חברים של 5–9)", kind: "bond", totalMin: 5, totalMax: 9, answer: "type" },
        { d: "השלמה ל־20", kind: "bond", total: 20, answer: "type" },
        { d: "השלמה לעשרת הבאה (37 + ? = 40)", kind: "toTen", answer: "type" },
        { d: "חברים של 100 בעשרות (30 + ? = 100)", kind: "bond100", answer: "type" },
      ],
    },
  ];

  // Everything the guide says. A string, or { m, f } by how the child is addressed.
  // Each phrase is spoken with the key "p.<name>" (or "p.<name>.m/f"), so a checked
  // recording can replace the device voice later without code changes.
  const PHRASES = {
    hello: "שָׁלוֹם",
    letsPlay: { m: "בּוֹא נְתַרְגֵּל חֶשְׁבּוֹן!", f: "בּוֹאִי נְתַרְגֵּל חֶשְׁבּוֹן!" },
    howMuch: "כַּמָּה זֶה",
    unknown: "כַּמָּה",
    checkTogether: { m: "בּוֹא נִבְדֹּק יַחַד.", f: "בּוֹאִי נִבְדֹּק יַחַד." },
    showHow: { m: "בּוֹא נִרְאֶה אֵיךְ פּוֹתְרִים.", f: "בּוֹאִי נִרְאֶה אֵיךְ פּוֹתְרִים." },
    praise: ["יָפֶה מְאוֹד!", "מְצֻיָּן!", "נָכוֹן!", "כׇּל הַכָּבוֹד!", "יֹפִי!"],
    wellDone: "כׇּל הַכָּבוֹד",
    done: { m: "סִיַּמְתָּ לְהַיּוֹם!", f: "סִיַּמְתְּ לְהַיּוֹם!" },
    newSticker: { m: "קִבַּלְתָּ מַדְבֵּקָה!", f: "קִבַּלְתְּ מַדְבֵּקָה!" },
    levelUp: { m: "וְעָבַרְתָּ שָׁלָב! מַדְבֵּקַת זָהָב!", f: "וְעָבַרְתְּ שָׁלָב! מַדְבֵּקַת זָהָב!" },
    noStickersYet: { m: "עוֹד אֵין מַדְבֵּקוֹת. בּוֹא נְשַׂחֵק!", f: "עוֹד אֵין מַדְבֵּקוֹת. בּוֹאִי נְשַׂחֵק!" },
  };

  // Operations, one fixed word each.
  const OPS = {
    "+": { key: "op.plus", text: "וְעוֹד" },
    "-": { key: "op.minus", text: "פָּחוֹת" },
    "=": { key: "op.eq", text: "שָׁוֶה" },
  };

  // A sticker for each finished session, in this order; gold ones for a passed level.
  const STICKERS = [
    "🦊", "🐢", "🦉", "🐸", "🐝", "🦋", "🐠", "🐙", "🦄", "🐼", "🦁", "🐨", "🐧", "🐳", "🦒", "🐘",
    "🍓", "🍉", "🍒", "🌻", "🌈", "⭐", "🚀", "🎈", "🚂", "⛵", "🎨", "🧩", "🪁", "🍦", "🧁", "🎁",
  ];
  const GOLD = ["🏆", "🥇", "👑", "💎", "🌟", "🏅"];

  // Things to count in the picture levels.
  const PICS = ["🍎", "🍓", "⭐", "🎈", "🐟", "🍪", "🌸", "🐞", "🍋", "🧸"];

  App.data = {
    APP_NAME: "אחד",
    GRADES: ["א", "ב"],
    TOPICS,
    PHRASES,
    OPS,
    STICKERS,
    GOLD,
    PICS,
    SESSION_SIZE: 10,
    REVIEW_SHARE: 0.2, // share of a session from the level below
    RECORDINGS: {}, // key → file under audio/, for checked recordings (none yet)
    topic: (id) => TOPICS.find((t) => t.id === id),
  };
})();
