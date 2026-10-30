// Tiny synthesised sound effects, no audio files needed.
(function (BR) {
  let ctx = null;
  let on = true;
  try { on = localStorage.getItem('br.sound') !== 'off'; } catch (e) { /* storage unavailable */ }

  function ac() {
    if (!ctx) {
      const A = window.AudioContext || window.webkitAudioContext;
      if (!A) return null;
      ctx = new A();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, vol, when, slide) {
    const a = ac();
    if (!a) return;
    const t = a.currentTime + (when || 0);
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.15, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // short burst of filtered noise: paper, cards and shuffles
  function noise(dur, vol, when, freq) {
    const a = ac();
    if (!a) return;
    const t = a.currentTime + (when || 0);
    const len = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.createBufferSource();
    src.buffer = buf;
    const f = a.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq || 2500; f.Q.value = 0.8;
    const g = a.createGain();
    g.gain.value = vol || 0.2;
    src.connect(f).connect(g).connect(a.destination);
    src.start(t);
  }

  const FX = {
    bell() { [0, 0.18, 0.36].forEach((d) => { tone(880, 0.9, 'triangle', 0.12, d); tone(1320, 0.6, 'sine', 0.05, d); }); },
    buy() { tone(520, 0.12, 'square', 0.06); tone(780, 0.14, 'square', 0.05, 0.06); },
    sell() { tone(620, 0.12, 'square', 0.06); tone(410, 0.16, 'square', 0.05, 0.06); },
    coin() { tone(1200, 0.08, 'triangle', 0.1); tone(1800, 0.18, 'triangle', 0.08, 0.07); },
    err() { tone(180, 0.18, 'sawtooth', 0.06); },
    tap() { tone(900, 0.04, 'sine', 0.05); },
    power() { tone(300, 0.35, 'sawtooth', 0.07, 0, 1200); },
    win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.35, 'triangle', 0.1, i * 0.13)); },
    tick() { tone(1500, 0.03, 'sine', 0.04); },
    card() { noise(0.07, 0.25, 0, 3200); },
    flip() { noise(0.06, 0.25, 0, 2600); tone(700, 0.06, 'triangle', 0.05, 0.03); },
    deal() { for (let i = 0; i < 6; i++) noise(0.05, 0.2, i * 0.07, 2800 + i * 120); },
    cash() { for (let i = 0; i < 5; i++) noise(0.05, 0.22, i * 0.06, 1800); tone(1400, 0.1, 'triangle', 0.07, 0.3); tone(2100, 0.25, 'triangle', 0.06, 0.38); },
    turn() { tone(660, 0.14, 'triangle', 0.1); tone(990, 0.3, 'triangle', 0.1, 0.12); },
    notify() { tone(1040, 0.07, 'sine', 0.05); },
    crash() { tone(400, 0.7, 'sawtooth', 0.08, 0, 60); noise(0.4, 0.25, 0.05, 600); },
    bonus() { [660, 880, 1100, 1320, 1760].forEach((f, i) => tone(f, 0.18, 'triangle', 0.08, i * 0.06)); },
    lose() { tone(440, 0.25, 'triangle', 0.07); tone(330, 0.4, 'triangle', 0.07, 0.2); },
    fanfare() { [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone(f, i > 4 ? 0.5 : 0.18, 'square', 0.05, i * 0.14)); },
  };

  BR.sfx = function (name) { if (on && FX[name]) try { FX[name](); } catch (e) { /* audio blocked */ } };
  BR.sound = {
    get on() { return on; },
    toggle() { on = !on; try { localStorage.setItem('br.sound', on ? 'on' : 'off'); } catch (e) { /* ignore */ } return on; },
  };
})(window.BR = window.BR || {});
