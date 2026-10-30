// Computer traders. They only use what a human would know: their own tips, public news and price action.
(function (BR) {
  const U = BR.util;
  const STYLES = {
    easy: { think: [5, 9], noise: 0.04, conviction: 0.25, rumor: 0.8, loan: 0, power: 0.15 },
    normal: { think: [3, 6], noise: 0.02, conviction: 0.4, rumor: 0.55, loan: 0.3, power: 0.3 },
    hard: { think: [2, 4], noise: 0.008, conviction: 0.55, rumor: 0.5, loan: 0.7, power: 0.5 },
  };

  function outlook(s, p, st) {
    const est = {};
    for (const c of s.companies) {
      if (c.status !== 'active') continue;
      let e = ((s.macro.fx[c.sector] || 0) + (s.macro.fx.ALL || 0)) / 100;
      // price action already hints at what others know
      e += (c.price / c.open - 1) * (st === STYLES.hard ? 0.8 : 0.3);
      est[c.tk] = e + U.gauss(s) * st.noise;
    }
    for (const t of p.tips) if (est[t.tk] !== undefined) est[t.tk] += (t.pct / 100) * (t.rumor ? st.rumor : 1);
    for (const t of p.intel) if (est[t.tk] !== undefined) est[t.tk] += (t.pct / 100) * (t.rumor ? 0.5 : 0.9);
    for (const a of s.corp) {
      if (est[a.tk] === undefined) continue;
      if (a.type === 'BONUS' || a.type === 'SPLIT') est[a.tk] += 0.025;
      if (a.type === 'DIV') est[a.tk] += 0.01;
      if (a.type === 'BUYBACK') est[a.tk] += 0.04;
      if (a.type === 'RIGHTS') est[a.tk] -= 0.025;
    }
    return est;
  }

  function think(s, p) {
    const st = STYLES[p.bot] || STYLES.normal;
    const est = outlook(s, p, st);
    const frac = 1 - s.timeLeft / s.settings.dayLength;
    const worth = U.netWorth(s, p);

    // sell what looks bad (or lock gains late in the day)
    for (const tk in p.hold) {
      const e = est[tk];
      if (e === undefined) continue;
      const c = U.company(s, tk);
      const gain = c.price / (p.cost[tk] || c.price) - 1;
      if (e < -0.02 || (frac > 0.75 && gain > 0.12 && e < 0.03)) {
        BR.act(s, p.id, { type: 'sell', tk, qty: p.hold[tk] });
        return;
      }
    }

    // corporate actions
    for (const a of s.corp) {
      const c = U.company(s, a.tk);
      if (a.type === 'RIGHTS' && p.hold[a.tk] && !p.rights[a.tk] && c.price > a.price * 1.08) {
        BR.act(s, p.id, { type: 'rights', tk: a.tk, qty: Math.floor(p.hold[a.tk] / 5) });
      }
      if (a.type === 'BUYBACK' && p.hold[a.tk] && !p.tender[a.tk]) {
        BR.act(s, p.id, { type: 'tender', tk: a.tk, qty: Math.floor(p.hold[a.tk] * 0.25) });
      }
    }

    // IPO
    if (s.ipo && !p.ipoLots && frac > 0.3) {
      const keen = s.ipo.gmp / s.ipo.issue;
      if (keen > 0.03 || (p.bot === 'easy' && U.rnd(s) < 0.5)) {
        const lots = Math.min(s.ipo.maxLots, Math.floor((p.cash * (keen > 0.15 ? 0.35 : 0.15)) / (s.ipo.lot * s.ipo.issue)));
        if (lots > 0) BR.act(s, p.id, { type: 'ipo', lots });
      }
    }

    // power cards
    if (!p.powerUsed && p.powers.length && U.rnd(s) < st.power * (frac > 0.2 ? 1 : 0.3)) {
      const best = Object.keys(est).sort((a, b) => est[b] - est[a]);
      const card = p.powers[0];
      if (card === 'BULL') {
        const tk = Object.keys(p.hold).sort((a, b) => p.hold[b] * U.company(s, b).price - p.hold[a] * U.company(s, a).price)[0];
        if (tk && est[tk] !== undefined) return void BR.act(s, p.id, { type: 'power', power: card, tk });
      } else if (card === 'BEAR') {
        const tk = best.reverse().find((t) => !p.hold[t]);
        if (tk) return void BR.act(s, p.id, { type: 'power', power: card, tk });
      } else if (card === 'PEEK') {
        return void BR.act(s, p.id, { type: 'power', power: card });
      } else if (card === 'SHIELD') {
        const tk = Object.keys(p.hold).find((t) => est[t] !== undefined);
        if (tk) return void BR.act(s, p.id, { type: 'power', power: card, tk });
      }
    }

    // buy the best idea
    const ranked = Object.keys(est).sort((a, b) => est[b] - est[a]);
    const tk = ranked[0];
    if (!tk || est[tk] < 0.03 || frac > 0.92) return;
    const c = U.company(s, tk);
    const invested = (p.hold[tk] || 0) * c.price;
    const want = worth * Math.min(0.6, st.conviction * est[tk] * 8) - invested;
    if (want < worth * 0.03) return;
    if (p.cash < want && st.loan > 0 && est[tk] > 0.06 && U.rnd(s) < st.loan) {
      const lim = U.loanLimit(s, p);
      const amt = Math.floor(Math.min(lim, want - p.cash) * 0.8);
      if (amt > 20000) BR.act(s, p.id, { type: 'loan', amt });
    }
    const qty = Math.min(U.maxBuy(s, p, c), Math.floor(want / c.price));
    if (qty > 0) BR.act(s, p.id, { type: 'buy', tk, qty });
  }

  // Between days: repay expensive loans, park idle cash late in the game.
  function housekeeping(s, p) {
    if (p.loan > 0 && p.cash > 0) BR.act(s, p.id, { type: 'repay', amt: Math.min(p.cash * 0.7, p.loan) });
  }

  BR.runBots = function (s, dt) {
    if (s.phase === 'summary' || s.phase === 'brief') {
      for (const p of s.players) if (p.bot && !p.houseDone) { housekeeping(s, p); p.houseDone = true; }
      return;
    }
    if (s.phase !== 'open') return;
    for (const p of s.players) {
      if (!p.bot) continue;
      p.houseDone = false;
      const st = STYLES[p.bot] || STYLES.normal;
      p.nextThink = (p.nextThink === undefined ? st.think[0] * U.rnd(s) : p.nextThink) - dt;
      if (p.nextThink <= 0) {
        p.nextThink = st.think[0] + U.rnd(s) * (st.think[1] - st.think[0]);
        think(s, p);
      }
    }
  };

  BR.BOT_NAMES = ['Rocky Raja', 'Bulla Bhai', 'Madam Margin', 'Captain Candle', 'Sensei Sharma', 'Lucky Lakshmi', 'Dalal Dev', 'Pinky Portfolio'];
  BR.AVATARS = ['🦁', '🐯', '🦊', '🐼', '🦉', '🐺', '🦅', '🐲', '🦈', '🐘'];
  BR.COLORS = ['#ffd23f', '#00c389', '#5b8cff', '#ff5c8a', '#b46cff', '#ff8a3d'];
})(window.BR = window.BR || {});
