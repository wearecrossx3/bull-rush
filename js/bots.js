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
      est[t] += rup * c.price * 0.1 + U.newsMove(s, c);
      for (const x of s.plays) {
        if (x.tk !== t || (x.secret && x.pid !== p.id)) continue;
        if (x.sp === 'SCAM') est[t] -= 40;
        if (x.sp === 'DIVIDEND') est[t] += 5;
        if (x.sp === 'UPCAP') est[t] = Math.min(est[t], 15);
        if (x.sp === 'LOWCAP') est[t] = Math.max(est[t], -15);
        if (x.sp === 'FREEZE') est[t] = 0;
        if (x.sp === 'CHARGE') est[t] += 25;
        if (x.sp === 'DOUBLE') est[t] *= 2;
        if (x.sp === 'MOON') est[t] += 40;
        if (x.sp === 'HYPE' && est[t] > 0) est[t] *= 3;
        if (x.sp === 'PANIC' && est[t] < 0) est[t] *= 3;
        if (x.sp === 'FLIP') est[t] = -est[t];
        if (x.sp === 'ANCHOR') est[t] = Math.max(-5, Math.min(5, est[t]));
        if (x.sp === 'MEGADIV') est[t] += 15;
      }
    }
    if (p.spy) for (const k of p.spy.cards) if (est[k.tk] !== undefined) est[k.tk] += k.v;
    if (p.tip) for (const k of p.tip) if (k.who !== 'You' && est[k.tk] !== undefined) est[k.tk] += k.v;
    // owners know their worst minus cards will be blocked
    for (const t in est) { const o = U.ownerOf(s, U.company(s, t)); if (o && o.p.id === p.id) est[t] += 8 * o.blocks; }
    return est;
  }

  function decide(s, p) {
    const st = STYLES[p.bot] || STYLES.normal;
    const est = outlook(s, p, st);
    const gainPct = (tk) => est[tk] / U.company(s, tk).price;
    const lastPass = s.pass === s.settings.turns - 1;

    // 2. play a gold card when one of them helps
    if (p.gold.length && U.rnd(s) < st.special) {
      const owned = Object.keys(p.hold).filter((t) => U.company(s, t).status === 'active').sort((a, b) => p.hold[b] - p.hold[a]);
      const notOwned = Object.keys(est).filter((t) => !p.hold[t] && U.company(s, t).status === 'active').sort((a, b) => est[a] - est[b]);
      const fall = owned.find((t) => est[t] < -5);
      const rise = owned.find((t) => est[t] > 0);
      const richer = s.players.some((o) => o.id !== p.id && U.netWorth(s, o) > U.netWorth(s, p));
      const mySectors = new Set(owned.map((t) => U.company(s, t).sector));
      const top = Object.keys(est).filter((t) => U.company(s, t).status === 'active' && U.available(s, U.company(s, t)) >= R.block).sort((a, b) => gainPct(b) - gainPct(a))[0];
      const use = (sp, tk) => ({ type: 'special', card: sp.id, tk });
      for (const sp of p.gold) {
        const k = sp.sp;
        if ((k === 'RIGHTS' || k === 'DIVIDEND' || k === 'MEGADIV') && owned[0] && est[owned[0]] >= 0) return use(sp, owned[0]);
        if ((k === 'LOWCAP' || k === 'FREEZE' || k === 'ANCHOR' || k === 'NET' || k === 'FLIP') && fall) return use(sp, fall);
        if (k === 'BUYBACK' && fall) return use(sp, fall);
        if (k === 'SHORT' && notOwned[0] && est[notOwned[0]] < -8) return use(sp, notOwned[0]);
        if ((k === 'PANIC' || k === 'LOCK') && notOwned[0] && est[notOwned[0]] < -5) return use(sp, notOwned[0]);
        if (k === 'SCAM' && notOwned[0]) return use(sp, notOwned[0]);
        if (k === 'SLUMP') { const t = notOwned.find((x) => !mySectors.has(U.company(s, x).sector)); if (t) return use(sp, t); }
        if (k === 'UPCAP') { const t = Object.keys(est).filter((x) => !p.hold[x] && U.company(s, x).status === 'active').sort((a, b) => est[b] - est[a])[0]; if (t) return use(sp, t); }
        if ((k === 'RUPUP' || k === 'STAR') && owned.length) return use(sp);
        if ((k === 'RUPDN' || k === 'SWAN') && !owned.length) return use(sp);
        if ((k === 'SPY' || k === 'TIP' || k === 'REDRAW') && s.pass === 0) return use(sp);
        if (k === 'CRYSTAL' && s.pass === 0 && (owned[0] || top)) return use(sp, owned[0] || top);
        if ((k === 'CHARGE' || k === 'DOUBLE' || k === 'MOON' || k === 'HYPE' || k === 'BOOM') && rise) return use(sp, rise);
        if (k === 'SPLIT' && owned.find((t) => U.company(s, t).price >= 60)) return use(sp, owned.find((t) => U.company(s, t).price >= 60));
        if (k === 'ANGEL' && top) return use(sp, top);
        if (k === 'LUCKY' || k === 'JACKPOT' || k === 'FORTUNE' || k === 'PICK') return use(sp);
        if (k === 'DOUBLEUP' && p.gold.length < R.maxGold) return use(sp);
        if ((k === 'TAX' || k === 'ROBIN') && richer) return use(sp);
        if (k === 'WAIVER' && p.loan > 0) return use(sp);
        if (k === 'GOLDFD' && p.fd > 0) return use(sp);
        if (k === 'VIP' && s.ipo && s.ipo.founder !== p.id && !p.ipoBlocks) return use(sp);
      }
    }

    // 1. dump anything that looks like it will fall
    const bad = Object.keys(p.hold).filter((tk) => est[tk] !== undefined && est[tk] < -2 && U.company(s, tk).status === 'active')
      .sort((a, b) => est[a] * p.hold[a] - est[b] * p.hold[b]);
    if (bad.length) return { type: 'sell', tk: bad[0], blocks: p.hold[bad[0]] / R.block };

    // 2b. rich bots list their own company
    if (p.bot !== 'easy' && U.canFound(s, p)) return { type: 'found', name: `${p.name.split(' ')[0]} ${U.pick(s, ['Ventures', 'Industries', 'Labs', 'Capital', 'Motors'])}`, issue: 50 };

    // 2c. take over companies we hold half of, or raid a rival boss
    for (const tk of Object.keys(p.hold)) {
      const c = U.company(s, tk);
      const m = U.takeoverMove(s, p, c);
      if (m === 'takeover') return { type: 'takeover', tk };
      if (m === 'hostile' && p.bot !== 'easy' && est[tk] >= 0 && U.rnd(s) < 0.5) {
        const b = U.player(s, c.boss);
        if (b && (b.hold[tk] || 0) * Math.ceil(c.price * R.hostilePremium) <= p.cash * 0.8) return { type: 'hostile', tk };
      }
    }
    // ...and push towards control when we are close
    if (p.bot !== 'easy') {
      const near = Object.keys(p.hold).map((tk) => U.company(s, tk)).find((c) => c && c.status === 'active' && !c.boss && est[c.tk] >= 0
        && p.hold[c.tk] >= (c.supply || R.supply) * 0.35 && p.hold[c.tk] < (c.supply || R.supply) * R.takeoverAt);
      if (near) {
        const want = Math.ceil(((near.supply || R.supply) * R.takeoverAt - p.hold[near.tk]) / R.block);
        const blocks = Math.min(want, Math.floor(U.available(s, near) / R.block), Math.floor(p.cash / (near.price * R.block)));
        if (blocks > 0) return { type: 'buy', tk: near.tk, blocks };
      }
    }

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
