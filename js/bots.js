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
    for (const k of p.hand) if (est[k.tk] !== undefined) est[k.tk] += k.v;
    const known = s.plays.filter((x) => !x.secret || x.pid === p.id);
    const rup = known.filter((x) => x.sp === 'RUPUP').length - known.filter((x) => x.sp === 'RUPDN').length;
    for (const t in est) {
      const c = U.company(s, t);
      est[t] += rup * c.price * 0.1;
      for (const x of s.plays) {
        if (x.tk !== t || (x.secret && x.pid !== p.id)) continue;
        if (x.sp === 'SCAM') est[t] -= 40;
        if (x.sp === 'DIVIDEND') est[t] += 5;
        if (x.sp === 'UPCAP') est[t] = Math.min(est[t], 15);
        if (x.sp === 'LOWCAP') est[t] = Math.max(est[t], -15);
        if (x.sp === 'FREEZE') est[t] = 0;
        if (x.sp === 'CHARGE') est[t] += 25;
        if (x.sp === 'DOUBLE') est[t] *= 2;
      }
    }
    if (p.spy) for (const k of p.spy.cards) if (est[k.tk] !== undefined) est[k.tk] += k.v;
    if (p.tip) for (const k of p.tip) if (est[k.tk] !== undefined) est[k.tk] += k.v;
    // owners know their worst minus cards will be blocked
    for (const t in est) { const o = U.ownerOf(s, U.company(s, t)); if (o && o.p.id === p.id) est[t] += 8 * o.blocks; }
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
    const sp = p.gold[0];
    if (sp && U.rnd(s) < st.special) {
      const owned = Object.keys(p.hold).filter((t) => U.company(s, t).status === 'active').sort((a, b) => p.hold[b] - p.hold[a]);
      const notOwned = Object.keys(est).filter((t) => !p.hold[t] && U.company(s, t).status === 'active').sort((a, b) => est[a] - est[b]);
      const k = sp.sp;
      const fall = owned.find((t) => est[t] < -5);
      if ((k === 'RIGHTS' || k === 'DIVIDEND') && owned[0] && est[owned[0]] >= 0) return { type: 'special', card: sp.id, tk: owned[0] };
      if ((k === 'LOWCAP' || k === 'FREEZE') && fall) return { type: 'special', card: sp.id, tk: fall };
      if (k === 'SCAM' && notOwned[0]) return { type: 'special', card: sp.id, tk: notOwned[0] };
      if (k === 'UPCAP') { const t = Object.keys(est).filter((x) => !p.hold[x] && U.company(s, x).status === 'active').sort((a, b) => est[b] - est[a])[0]; if (t) return { type: 'special', card: sp.id, tk: t }; }
      if (k === 'RUPUP' && owned.length) return { type: 'special', card: sp.id };
      if (k === 'RUPDN' && !owned.length) return { type: 'special', card: sp.id };
      if (k === 'SPY' && s.pass === 0) return { type: 'special', card: sp.id };
      if ((k === 'CHARGE' || k === 'DOUBLE') && owned[0] && est[owned[0]] > 0) return { type: 'special', card: sp.id, tk: owned[0] };
      if (k === 'NET' && fall) return { type: 'special', card: sp.id, tk: fall };
      if (k === 'TIP' && s.pass === 0) return { type: 'special', card: sp.id };
      if (k === 'LUCKY') return { type: 'special', card: sp.id };
      if (k === 'TAX' && s.players.some((o) => o.id !== p.id && U.netWorth(s, o) > U.netWorth(s, p))) return { type: 'special', card: sp.id };
    }

    // 2b. rich bots list their own company
    if (p.bot !== 'easy' && U.canFound(s, p)) return { type: 'found', name: `${p.name.split(' ')[0]} ${U.pick(s, ['Ventures', 'Industries', 'Labs', 'Capital', 'Motors'])}`, issue: 50 };

    // 3. IPO if our cards say it will pop
    if (s.ipo && s.ipo.founder !== p.id && !p.ipoBlocks && (est[s.ipo.tk] > 3 || (p.bot === 'easy' && U.rnd(s) < 0.4))) {
      const b = Math.min(R.ipoMaxBlocks, Math.floor(p.cash * 0.4 / (R.block * s.ipo.issue)));
      if (b > 0) return { type: 'ipo', blocks: b };
    }

    // 4. buy the best idea with a big chunk of cash
    const best = Object.keys(est).filter((t) => U.company(s, t).status === 'active').sort((a, b) => gainPct(b) - gainPct(a))[0];
    if (best && gainPct(best) > 0.08) {
      const c = U.company(s, best);
      if (p.bot !== 'easy' && gainPct(best) > 0.25 && p.cash < c.price * R.block * 3 && U.loanLimit(s, p) > 0) BR.act(s, p.id, { type: 'loan', amt: Math.min(U.loanLimit(s, p), R.loanStep * (p.bot === 'hard' ? 2 : 1)) });
      const share = lastPass ? 1 : st.greed;
      const blocks = Math.floor(Math.min(p.cash * share, p.cash) / (c.price * R.block));
      if (blocks > 0) return { type: 'buy', tk: best, blocks };
    }

    // 5. clear expensive loans
    if (p.loan > 0 && p.cash > R.loanStep * 1.5) BR.act(s, p.id, { type: 'repay', amt: Math.min(p.loan, p.cash - R.loanStep) });
    if (lastPass && p.cash > R.loanStep * 2 && p.bot === 'hard') BR.act(s, p.id, { type: 'fdIn', amt: Math.floor(p.cash / 2 / 10000) * 10000 });
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
