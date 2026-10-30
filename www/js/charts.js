// Canvas charts: sparklines, intraday line and daily candles.
(function (BR) {
  const GREEN = '#12a46e', RED = '#e5304f', GRID = 'rgba(74,44,18,.12)', MUTED = '#9a7650';

  function fit(cv) {
    const r = cv.getBoundingClientRect();
    const d = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(r.width * d)), h = Math.max(1, Math.round(r.height * d));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const g = cv.getContext('2d');
    g.setTransform(d, 0, 0, d, 0, 0);
    g.clearRect(0, 0, r.width, r.height);
    return { g, w: r.width, h: r.height };
  }

  BR.spark = function (cv, pts, base) {
    const { g, w, h } = fit(cv);
    if (!pts || pts.length < 2) return;
    let lo = Math.min(base, ...pts), hi = Math.max(base, ...pts);
    if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
    const x = (i) => (i / (pts.length - 1)) * (w - 2) + 1;
    const y = (v) => h - 2 - ((v - lo) / (hi - lo)) * (h - 4);
    const up = pts[pts.length - 1] >= base;
    g.strokeStyle = 'rgba(143,163,214,.35)'; g.setLineDash([2, 2]); g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, y(base)); g.lineTo(w, y(base)); g.stroke(); g.setLineDash([]);
    g.strokeStyle = up ? GREEN : RED; g.lineWidth = 1.5; g.beginPath();
    pts.forEach((v, i) => (i ? g.lineTo(x(i), y(v)) : g.moveTo(x(i), y(v))));
    g.stroke();
  };

  function axis(g, w, h, lo, hi, padR) {
    g.font = '10px sans-serif'; g.fillStyle = MUTED; g.textAlign = 'left';
    for (let i = 0; i <= 3; i++) {
      const v = lo + ((hi - lo) * i) / 3;
      const yy = h - 14 - ((v - lo) / (hi - lo)) * (h - 28);
      g.strokeStyle = GRID; g.beginPath(); g.moveTo(0, yy); g.lineTo(w - padR, yy); g.stroke();
      g.fillText(v >= 1000 ? v.toFixed(0) : v.toFixed(1), w - padR + 4, yy + 3);
    }
  }

  BR.lineChart = function (cv, pts, base, slots) {
    const { g, w, h } = fit(cv);
    if (!pts || !pts.length) return;
    const padR = 44;
    let lo = Math.min(base * 0.98, ...pts), hi = Math.max(base * 1.02, ...pts);
    const yv = (v) => h - 14 - ((v - lo) / (hi - lo)) * (h - 28);
    axis(g, w, h, lo, hi, padR);
    const n = Math.max(pts.length, slots || 30);
    const xv = (i) => 2 + (i / (n - 1)) * (w - padR - 6);
    const last = pts[pts.length - 1];
    const col = last >= base ? GREEN : RED;
    g.strokeStyle = 'rgba(143,163,214,.5)'; g.setLineDash([3, 3]);
    g.beginPath(); g.moveTo(0, yv(base)); g.lineTo(w - padR, yv(base)); g.stroke(); g.setLineDash([]);
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, col + '55'); grad.addColorStop(1, col + '00');
    g.beginPath();
    pts.forEach((v, i) => (i ? g.lineTo(xv(i), yv(v)) : g.moveTo(xv(i), yv(v))));
    g.lineTo(xv(pts.length - 1), h - 14); g.lineTo(xv(0), h - 14); g.closePath();
    g.fillStyle = grad; g.fill();
    g.beginPath(); g.strokeStyle = col; g.lineWidth = 2;
    pts.forEach((v, i) => (i ? g.lineTo(xv(i), yv(v)) : g.moveTo(xv(i), yv(v))));
    g.stroke();
    const lx = xv(pts.length - 1), ly = yv(last);
    g.fillStyle = col; g.beginPath(); g.arc(lx, ly, 3.5, 0, 7); g.fill();
    g.fillStyle = col; g.fillRect(w - padR, ly - 8, padR, 16);
    g.fillStyle = '#04110c'; g.font = 'bold 10px sans-serif';
    g.fillText(last >= 1000 ? last.toFixed(0) : last.toFixed(2), w - padR + 3, ly + 4);
    g.fillStyle = MUTED; g.font = '9px sans-serif';
    g.fillText('Today · circuit limit ±20%', 4, h - 3);
  };

  BR.candleChart = function (cv, candles, live) {
    const { g, w, h } = fit(cv);
    const data = candles.slice(-24);
    if (live) data.push(live);
    if (!data.length) return;
    const padR = 44;
    let lo = Math.min(...data.map((k) => k.l)), hi = Math.max(...data.map((k) => k.h));
    if (hi - lo < 1e-6) { hi += 1; lo -= 1; }
    const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
    const yv = (v) => h - 14 - ((v - lo) / (hi - lo)) * (h - 28);
    axis(g, w, h, lo, hi, padR);
    const n = Math.max(data.length, 12);
    const bw = (w - padR - 8) / n;
    data.forEach((k, i) => {
      const x = 4 + i * bw + bw / 2;
      const col = k.c >= k.o ? GREEN : RED;
      g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, yv(k.h)); g.lineTo(x, yv(k.l)); g.stroke();
      const top = yv(Math.max(k.o, k.c)), bot = yv(Math.min(k.o, k.c));
      g.globalAlpha = live && i === data.length - 1 ? 0.6 : 1;
      g.fillRect(x - bw * 0.32, top, bw * 0.64, Math.max(1.5, bot - top));
      g.globalAlpha = 1;
    });
    g.fillStyle = MUTED; g.font = '9px sans-serif';
    g.fillText('Daily candles' + (live ? ' · today live' : ''), 4, h - 3);
  };

  BR.worthChart = function (cv, series) {
    const { g, w, h } = fit(cv);
    const all = series.flatMap((s) => s.pts);
    if (!all.length) return;
    let lo = Math.min(...all), hi = Math.max(...all);
    if (hi - lo < 1) hi = lo + 1;
    const n = Math.max(...series.map((s) => s.pts.length));
    const xv = (i) => 4 + (i / Math.max(1, n - 1)) * (w - 8);
    const yv = (v) => h - 6 - ((v - lo) / (hi - lo)) * (h - 12);
    for (const s of series) {
      g.strokeStyle = s.color; g.lineWidth = s.me ? 3 : 1.6; g.beginPath();
      s.pts.forEach((v, i) => (i ? g.lineTo(xv(i), yv(v)) : g.moveTo(xv(i), yv(v))));
      g.stroke();
    }
  };

  // Animated candle field for the title screen
  BR.titleBg = function (cv) {
    let t = 0, raf;
    const cols = [];
    function frame() {
      const { g, w, h } = fit(cv);
      const n = Math.ceil(w / 22) + 2;
      while (cols.length < n) {
        const prev = cols.length ? cols[cols.length - 1].c : h / 2;
        const o = prev, c = Math.max(h * 0.15, Math.min(h * 0.85, o + (Math.random() - 0.48) * 40));
        cols.push({ o, c, hi: Math.min(o, c) - Math.random() * 18, lo: Math.max(o, c) + Math.random() * 18 });
      }
      t += 0.35;
      if (t >= 22) { t = 0; cols.shift(); }
      cols.forEach((k, i) => {
        const x = i * 22 - t;
        const col = k.c <= k.o ? GREEN : RED;
        g.strokeStyle = col; g.fillStyle = col; g.globalAlpha = 0.35;
        g.beginPath(); g.moveTo(x + 7, k.hi); g.lineTo(x + 7, k.lo); g.stroke();
        g.fillRect(x + 2, Math.min(k.o, k.c), 10, Math.max(2, Math.abs(k.c - k.o)));
      });
      g.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    }
    frame();
    return () => cancelAnimationFrame(raf);
  };
})(window.BR = window.BR || {});
