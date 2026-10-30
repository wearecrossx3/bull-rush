// Computer players. They only use their own hand and the specials everyone has seen played.
(function (BR) {
  const U = BR.util;
  const R = BR.RULES;
  const STYLES = {
    easy: { noise: 12, greed: 0.5, special: 0.4 },
    normal: { noise: 5, greed: 0.75, special: 0.7 },
    hard: { noise: 1, greed: 0.95, special: 0.9 },
  };

  function outlook(s, p, st) {
    const est = {};
    for (const c of s.companies) if (c.status === 'active' || c.status === 'ipo') est[c.tk] = (U.rnd(s) - 0.5) * st.noise;
    for (const k of p.hand) if (k.kind === 'price' && est[k.tk] !== undefined) est[k.tk] += k.v;
    for (const x of s.plays) {
      if (x.tk && est[x.tk] !== undefined) {
        if (x.sp === 'BULL') est[x.tk] += 20;
        if (x.sp === 'BEAR') est[x.tk] -= 20;
        if (x.sp === 'DOUBLE') est[x.tk] *= 2;
        if (x.sp === 'DIVIDEND') est[x.tk] += 5;
      }
      if (x.sp === 'BOOM') for (const t in est) est[t] += 10;
      if (x.sp === 'CRASH') for (const t in est) est[t] -= 10;
    }
    return est;
  }

  function decide(s, p) {
    const st = STYLES[p.bot] || STYLES.normal;
    const est = outlook(s, p, st);
    const gainPct = (tk) => est[tk] / U.company(s, tk).price;
    const lastPass = s.pass === s.settings.turns - 1;

    // 1. dump anything that looks like it will fall
    const bad = Object.keys(p.hold).filter((tk) => est[tk] !== undefined && est[tk] < -2 && U.company(s, tk).status === 'active')
      .sort((a, b) => est[a] * p.hold[a] - est[b] * p.hold[b]);
    if (bad.length) return { type: 'sell', tk: bad[0], blocks: p.hold[bad[0]] / R.block };

    // 2. play a special card when it helps
    const sp = p.hand.find((k) => k.kind === 'special');
    if (sp && U.rnd(s) < st.special) {
      const owned = Object.keys(p.hold).filter((t) => U.company(s, t).status === 'active').sort((a, b) => p.hold[b] - p.hold[a]);
      const notOwned = Object.keys(est).filter((t) => !p.hold[t] && U.company(s, t).status === 'active').sort((a, b) => est[a] - est[b]);
      const k = sp.sp;
      if ((k === 'BULL' || k === 'DIVIDEND' || k === 'GIFT') && owned[0]) return { type: 'special', card: sp.id, tk: owned[0] };
      if (k === 'SHIELD' && owned.find((t) => est[t] < 0)) return { type: 'special', card: sp.id, tk: owned.find((t) => est[t] < 0) };
      if (k === 'DOUBLE' && owned.find((t) => est[t] > 8)) return { type: 'special', card: sp.id, tk: owned.find((t) => est[t] > 8) };
      if (k === 'BEAR' && notOwned[0]) return { type: 'special', card: sp.id, tk: notOwned[0] };
      if (k === 'BOOM' && owned.length) return { type: 'special', card: sp.id };
      if (k === 'CRASH' && !owned.length) return { type: 'special', card: sp.id };
      if (k === 'LOOT') return { type: 'special', card: sp.id };
    }

    // 3. IPO if our cards say it will pop
    if (s.ipo && !p.ipoBlocks && (est[s.ipo.tk] > 3 || (p.bot === 'easy' && U.rnd(s) < 0.4))) {
      const b = Math.min(R.ipoMaxBlocks, Math.floor(p.cash * 0.4 / (R.block * s.ipo.issue)));
      if (b > 0) return { type: 'ipo', blocks: b };
    }

    // 4. buy the best idea with a big chunk of cash
    const best = Object.keys(est).filter((t) => U.company(s, t).status === 'active').sort((a, b) => gainPct(b) - gainPct(a))[0];
    if (best && gainPct(best) > 0.08) {
      const c = U.company(s, best);
      if (p.bot === 'hard' && gainPct(best) > 0.3 && p.loan < R.loanMax && p.cash < c.price * R.block * 3) BR.act(s, p.id, { type: 'loan' });
      const share = lastPass ? 1 : st.greed;
      const blocks = Math.floor(Math.min(p.cash * share, p.cash) / (c.price * R.block));
      if (blocks > 0) return { type: 'buy', tk: best, blocks };
    }

    // 5. clear expensive loans
    if (p.loan > 0 && p.cash > R.loanStep * 1.5) BR.act(s, p.id, { type: 'repay' });
    return { type: 'pass' };
  }

  BR.runBots = function (s, dt) {
    if (s.phase !== 'turns') return;
    const p = U.current(s);
    if (!p.bot) return;
    s.botWait -= dt;
    if (s.botWait > 0) return;
    const a = decide(s, p);
    if (BR.act(s, p.id, a)) BR.act(s, p.id, { type: 'pass' });
  };

  BR.BOT_NAMES = ['Rocky Raja', 'Bulla Bhai', 'Madam Margin', 'Captain Candle', 'Sensei Sharma', 'Lucky Lakshmi', 'Dalal Dev', 'Pinky Portfolio'];
  BR.AVATARS = ['🦁', '🐯', '🦊', '🐼', '🦉', '🐺', '🦅', '🐲', '🦈', '🐘'];
  BR.COLORS = ['#ffd23f', '#00c389', '#5b8cff', '#ff5c8a', '#b46cff', '#ff8a3d'];
})(window.BR = window.BR || {});
