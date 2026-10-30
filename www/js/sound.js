// Synthesised sound effects (no audio files). Soft marimba/bell tones through one master bus.
(function (BR) {
  let ctx = null, bus = null;
  let on = true;
  try { on = localStorage.getItem('br.sound') !== 'off'; } catch (e) { /* storage unavailable */ }

  function ac() {
    if (!ctx) {
      const A = window.AudioContext || window.webkitAudioContext;
      if (!A) return null;
      ctx = new A();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.ratio.value = 4;
      bus = ctx.createGain();
      bus.gain.value = 0.9;
      bus.connect(comp).connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // one voice: oscillator with a quick attack and exponential decay, optional pitch slide
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
    g.gain.exponentialRampToValueAtTime(vol || 0.12, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  // wooden mallet: fundamental plus a quiet 4th harmonic
  function marimba(f, when, vol) { tone(f, 0.35, 'sine', vol || 0.14, when); tone(f * 4, 0.08, 'sine', (vol || 0.14) * 0.25, when); }
  // bell: inharmonic partials that ring
  function bell(f, when, vol) { const v = vol || 0.08; tone(f, 1.1, 'sine', v, when); tone(f * 2.76, 0.6, 'sine', v * 0.4, when); tone(f * 5.4, 0.3, 'sine', v * 0.2, when); }
  // filtered noise burst: paper, cards, shuffles
  function noise(dur, vol, when, freq, q) {
    const a = ac();
    if (!a) return;
    const t = a.currentTime + (when || 0);
    const len = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const src = a.createBufferSource();
    src.buffer = buf;
    const f = a.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq || 2500; f.Q.value = q || 0.9;
    const g = a.createGain();
    g.gain.value = vol || 0.2;
    src.connect(f).connect(g).connect(bus);
    src.start(t);
  }

  const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5;
  const FX = {
    tap() { noise(0.025, 0.12, 0, 4000, 2); tone(1400, 0.04, 'sine', 0.03); },
    card() { noise(0.06, 0.22, 0, 3400, 1.2); },
    flip() { noise(0.05, 0.2, 0, 2800, 1.4); marimba(880, 0.02, 0.05); },
    deal() { for (let i = 0; i < 7; i++) noise(0.045, 0.16, i * 0.06, 3000 + i * 90, 1.3); },
    buy() { marimba(G5 * 0.5, 0, 0.13); marimba(C5, 0.07, 0.13); },
    sell() { marimba(C5, 0, 0.13); marimba(G5 * 0.5, 0.07, 0.13); },
    coin() { bell(1568, 0, 0.07); bell(2093, 0.06, 0.05); },
    cash() { for (let i = 0; i < 6; i++) noise(0.04, 0.16, i * 0.05, 1900, 1.2); bell(1568, 0.32, 0.06); bell(2349, 0.4, 0.05); },
    tick() { tone(2400, 0.03, 'sine', 0.025); },
    notify() { marimba(1175, 0, 0.05); },
    turn() { marimba(E5, 0, 0.12); marimba(G5, 0.09, 0.12); marimba(C6, 0.18, 0.12); },
    power() { noise(0.35, 0.12, 0, 1800, 0.6); tone(400, 0.4, 'triangle', 0.06, 0, 1600); bell(2093, 0.3, 0.05); },
    bell() { bell(C5, 0, 0.1); bell(G5, 0.16, 0.08); bell(C6, 0.32, 0.07); },
    win() { [C5, E5, G5, C6].forEach((f, i) => marimba(f, i * 0.1, 0.13)); bell(C6 * 2, 0.42, 0.04); },
    lose() { marimba(E5 * 0.5, 0, 0.12); marimba(311, 0.16, 0.12); marimba(262, 0.32, 0.12); },
    err() { tone(196, 0.16, 'triangle', 0.08); tone(185, 0.16, 'triangle', 0.06, 0.08); },
    crash() { tone(160, 0.6, 'sine', 0.18, 0, 45); noise(0.35, 0.22, 0, 500, 0.7); },
    bonus() { [C5, E5, G5, C6, E5 * 2].forEach((f, i) => bell(f, i * 0.06, 0.06)); },
    fanfare() { [[C5, 0], [E5, 0.12], [G5, 0.24], [C6, 0.36], [G5, 0.56], [C6, 0.7]].forEach(([f, w]) => { marimba(f, w, 0.13); tone(f / 2, 0.3, 'triangle', 0.05, w); }); bell(C6 * 2, 0.9, 0.05); },
  };

  BR.sfx = function (name) { if (on && FX[name]) try { FX[name](); } catch (e) { /* audio blocked */ } };
  BR.sound = {
    get on() { return on; },
    toggle() { on = !on; try { localStorage.setItem('br.sound', on ? 'on' : 'off'); } catch (e) { /* ignore */ } return on; },
  };
})(window.BR = window.BR || {});
