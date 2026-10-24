/* Voice and sound effects.
 *
 * Every spoken piece is { key, text } with a fixed key ("p.howMuch", "num.7",
 * "op.plus"). A key listed in data.RECORDINGS plays that checked recording;
 * everything else is read by the device's Hebrew voice. Neighbouring pieces
 * without a recording are read as one sentence, so the voice doesn't pause
 * between words and two voices never meet inside one phrase.
 * Sound effects are synthesized with WebAudio, so nothing needs downloading. */
(() => {
  "use strict";

  const App = (window.App = window.App || {});

  let rate = 0.85;
  let voice = null;
  let ctx = null;
  let currentAudio = null;
  let token = 0; // bumps on every new say() / stop(), cancelling older chains

  const synth = "speechSynthesis" in window ? window.speechSynthesis : null;
  const recordings = () => (App.data && App.data.RECORDINGS) || {};

  function pickVoice() {
    if (!synth) return;
    const voices = synth.getVoices();
    const he = voices.filter((v) => /^he|^iw/i.test(v.lang));
    // Prefer a local (offline) voice.
    voice = he.find((v) => v.localService) || he[0] || null;
  }
  if (synth) {
    pickVoice();
    synth.addEventListener && synth.addEventListener("voiceschanged", pickVoice);
  }

  function playFile(src) {
    return new Promise((resolve) => {
      const a = new Audio(src);
      currentAudio = a;
      a.playbackRate = Math.max(0.6, Math.min(1.2, rate / 0.85));
      const finish = () => {
        if (currentAudio === a) currentAudio = null;
        resolve();
      };
      a.onended = finish;
      a.onerror = finish;
      a.play().catch(finish);
    });
  }

  function speakText(text) {
    return new Promise((resolve) => {
      if (!synth) {
        setTimeout(resolve, 300 + text.length * 60);
        return;
      }
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "he-IL";
      if (voice) u.voice = voice;
      u.rate = rate;
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        clearTimeout(guard);
        resolve();
      };
      // Some engines never fire onend; never let the exercise hang on it.
      const guard = setTimeout(finish, 1500 + (text.length * 160) / rate);
      u.onend = finish;
      u.onerror = finish;
      synth.speak(u);
    });
  }

  function stop() {
    token++;
    if (synth) synth.cancel();
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
  }

  // Recorded pieces stay separate; runs of device-voice pieces become one text.
  function chunks(segments) {
    const out = [];
    for (const seg of segments) {
      if (!seg || !seg.text) continue;
      const file = seg.key && recordings()[seg.key];
      const last = out[out.length - 1];
      if (file) out.push({ file });
      else if (last && last.text != null) last.text += " " + seg.text;
      else out.push({ text: seg.text });
    }
    return out;
  }

  // say([{key, text}, ...]) — plays the pieces in order. Resolves when done or
  // when interrupted by another say()/stop().
  async function say(segments) {
    stop();
    const myToken = token;
    for (const ch of chunks(segments)) {
      if (myToken !== token) return;
      if (ch.file) await playFile("audio/" + ch.file);
      else await speakText(ch.text);
    }
  }

  // ---------- Sound effects ----------
  function audioCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone(freq, start, dur, type = "sine", gain = 0.18) {
    const c = audioCtx();
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    const t0 = c.currentTime + start;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  const sfx = {
    correct() {
      tone(784, 0, 0.18, "triangle");
      tone(1175, 0.1, 0.28, "triangle");
    },
    soft() {
      // A gentle, non-punishing "hmm" for a wrong answer.
      tone(330, 0, 0.22, "sine", 0.12);
      tone(294, 0.14, 0.26, "sine", 0.1);
    },
    tap() {
      tone(660, 0, 0.06, "sine", 0.08);
    },
    sticker() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.3, "triangle", 0.15));
    },
  };

  // iOS only lets audio start from a user gesture; call this from one.
  function unlock() {
    audioCtx();
    if (synth && !unlock.done) {
      unlock.done = true;
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      synth.speak(u);
    }
  }

  App.audio = {
    say,
    stop,
    sfx,
    unlock,
    chunks,
    setRate(r) {
      rate = r;
    },
    hasHebrewVoice() {
      pickVoice();
      return !!voice;
    },
    voiceName() {
      return voice ? voice.name : null;
    },
  };
})();
