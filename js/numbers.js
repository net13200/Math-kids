/* Numbers as Hebrew words with niqqud, for speech.
 *
 * Arithmetic uses the abstract (feminine) form: "שָׁלוֹשׁ וְעוֹד אַרְבַּע שָׁוֶה שֶׁבַע",
 * "שְׁלוֹשׁ מֵאוֹת עֶשְׂרִים וְחָמֵשׁ". The connecting ו goes before the last part of
 * the number and takes its vowel from the word after it (וְ / וּ / וַ). */
(() => {
  "use strict";

  const App = (window.App = window.App || {});

  const ONES = ["אֶפֶס", "אַחַת", "שְׁתַּיִם", "שָׁלוֹשׁ", "אַרְבַּע", "חָמֵשׁ", "שֵׁשׁ", "שֶׁבַע", "שְׁמוֹנֶה", "תֵּשַׁע", "עֶשֶׂר"];
  // Construct forms, used before עֶשְׂרֵה and מֵאוֹת.
  const ONES_C = [null, "אַחַת", "שְׁתֵּים", "שְׁלוֹשׁ", "אַרְבַּע", "חֲמֵשׁ", "שֵׁשׁ", "שְׁבַע", "שְׁמוֹנֶה", "תְּשַׁע"];
  const TENS = [null, null, "עֶשְׂרִים", "שְׁלוֹשִׁים", "אַרְבָּעִים", "חֲמִשִּׁים", "שִׁשִּׁים", "שִׁבְעִים", "שְׁמוֹנִים", "תִּשְׁעִים"];
  const HUNDRED = "מֵאָה";
  const TWO_HUNDRED = "מָאתַיִם";
  const HUNDREDS = "מֵאוֹת";
  const THOUSAND = "אֶלֶף";
  const TEEN = "עֶשְׂרֵה";

  const SHVA = "ְ";
  const HATAF = { "ֱ": "ֶ", "ֲ": "ַ", "ֳ": "ָ" }; // hataf → the full vowel ו takes
  const DAGESH = "ּ";
  const isMark = (c) => c >= "֑" && c <= "ׇ";

  // Prefix the word with "and": וְ, or וּ before a shva or ב/מ/פ, or the matching
  // vowel before a hataf. A dagesh kal in the first letter drops after the ו.
  function withVav(word) {
    const chars = [...word];
    const first = chars[0];
    let i = 1;
    while (i < chars.length && isMark(chars[i])) i++;
    let marks = chars.slice(1, i);
    const rest = chars.slice(i).join("");
    let vav = "וְ"; // וְ
    const hataf = marks.find((m) => HATAF[m]);
    if (marks.includes(SHVA) || "במפ".includes(first)) vav = "וּ"; // וּ
    else if (hataf) vav = "ו" + HATAF[hataf];
    if ("בגדכפת".includes(first)) marks = marks.filter((m) => m !== DAGESH);
    return vav + first + marks.join("") + rest;
  }

  // The first word of a phrase gets the ו.
  function vavPhrase(phrase) {
    const [head, ...tail] = phrase.split(" ");
    return [withVav(head), ...tail].join(" ");
  }

  function below100(n) {
    if (n <= 10) return ONES[n];
    if (n < 20) return ONES_C[n - 10] + " " + TEEN;
    const t = Math.floor(n / 10);
    const u = n % 10;
    return u ? TENS[t] + " " + withVav(ONES[u]) : TENS[t];
  }

  function words(n) {
    if (!Number.isInteger(n) || n < 0 || n > 1000) throw new RangeError("0–1000 only: " + n);
    if (n < 100) return below100(n);
    if (n === 1000) return THOUSAND;
    const h = Math.floor(n / 100);
    const r = n % 100;
    const head = h === 1 ? HUNDRED : h === 2 ? TWO_HUNDRED : ONES_C[h] + " " + HUNDREDS;
    if (!r) return head;
    // "מֵאָה עֶשְׂרִים וְחָמֵשׁ" already has its ו; a single last part takes one.
    const tail = below100(r);
    const single = r <= 19 || r % 10 === 0;
    return head + " " + (single ? vavPhrase(tail) : tail);
  }

  App.num = { words, withVav };
})();
