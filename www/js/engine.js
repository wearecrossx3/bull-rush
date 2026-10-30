// Bull Rush engine (tabletop edition): turn-based rounds, dealt price cards and a big reveal.
// Pure state + actions so the same code runs offline and on the online host.
(function (BR) {
  const R = BR.RULES;

  // ---------------------------------------------------------------- helpers
  function rnd(s) {
    s.rng = (s.rng + 0x6D2B79F5) | 0;
    let t = s.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const pick = (s, arr) => arr[Math.floor(rnd(s) * arr.length)];
  const shuffle = (s, arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd(s) * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  const company = (s, tk) => s.companies.find((c) => c.tk === tk);
  const player = (s, id) => s.players.find((p) => p.id === id);
  const current = (s) => s.players[s.seat];

  function log(s, text, kind) {
    s.feed.unshift({ round: s.round, text, kind: kind || 'news' });
    if (s.feed.length > 60) s.feed.length = 60;
  }

  function holdingsValue(s, p) {
    let v = 0;
    for (const tk in p.hold) { const c = company(s, tk); if (c) v += p.hold[tk] * (c.status === 'ipo' ? c.issue : c.price); }
    return v;
  }
  function netWorth(s, p) { return p.cash + holdingsValue(s, p) + (p.ipoBlocked || 0) - p.loan; }
  function fmt(n) {
    const a = Math.abs(n);
    if (a >= 1e7) return (n / 1e7).toFixed(2) + ' Cr';
    if (a >= 1e5) return (n / 1e5).toFixed(2) + ' L';
    return Math.round(n).toLocaleString('en-IN');
  }
  function maxBlocks(s, p, c) { return c.status === 'active' ? Math.floor(p.cash / (c.price * R.block)) : 0; }

  function tier(c) {
    if (c.price < 35) return [5, 10, 15];
    if (c.price < 70) return [5, 10, 15, 20];
    if (c.price < 120) return [10, 15, 20, 25];
    return [10, 20, 25, 30, 40];
  }

  function newCompany(def) {
    return {
      tk: def.tk, name: def.name, sector: def.sector, logo: def.logo, color: BR.SECTORS[def.sector].color,
      price: def.start, start: def.start, history: [def.start], last: 0, status: 'active',
    };
  }

  // ---------------------------------------------------------------- setup
  BR.createGame = function (settings, roster) {
    const s = {
      v: 0,
      settings: Object.assign({ rounds: 8, turns: 3, startCash: R.startCash, auto: false, turnTime: 0 }, settings),
      round: 0, pass: 0, seat: 0, phase: 'turns', timeLeft: 0, botWait: 0,
      rng: (settings.seed || Date.now()) | 0,
      companies: BR.COMPANIES.map(newCompany), players: [], feed: [], plays: [], reveal: null, ipo: null,
    };
    s.ipoQueue = shuffle(s, BR.IPOS.map((_, i) => i));
    s.ipoRounds = [];
    for (const f of [0.3, 0.55, 0.8]) {
      const r = Math.max(2, Math.round(s.settings.rounds * f));
      if (r < s.settings.rounds && !s.ipoRounds.includes(r)) s.ipoRounds.push(r);
    }
    s.players = roster.map((r, i) => ({
      id: r.id, name: r.name, bot: r.bot || null, color: r.color || BR.COLORS[i % 6], avatar: r.avatar || BR.AVATARS[i],
      cash: s.settings.startCash, hold: {}, loan: 0, hand: [], ipoBlocks: 0, ipoBlocked: 0,
      ready: false, connected: true, worth: [s.settings.startCash], seat: i,
    }));
    s.dealer = Math.floor(rnd(s) * s.players.length);
    log(s, 'Welcome to the Bull Rush table! Cards are being dealt.', 'sys');
    startRound(s);
    return s;
  };

  // ---------------------------------------------------------------- rounds
  function startRound(s) {
    s.round += 1;
    s.pass = 0;
    s.plays = [];
    s.reveal = null;
    s.phase = 'turns';

    for (const c of s.companies) {
      if (c.status === 'bankrupt') {
        c.status = 'active'; c.price = c.start; c.history.push(c.start);
        log(s, `${c.name} is back on the board at ₹${c.start} after restructuring.`, 'corp');
      }
    }

    // IPO: a new company joins, only buyable through the IPO this round
    s.ipo = null;
    if (s.ipoRounds.includes(s.round) && s.ipoQueue.length) {
      const def = BR.IPOS[s.ipoQueue.shift()];
      const c = newCompany(def);
      c.status = 'ipo'; c.issue = def.start; c.history = [];
      s.companies.push(c);
      s.ipo = { tk: c.tk, name: c.name, issue: def.start, blocks: Math.max(4, s.players.length * 3), pitch: def.pitch };
      log(s, `🚀 IPO! ${c.name} opens at ₹${def.start}/share. Apply on your turn this round.`, 'ipo');
    }

    // deal hands
    const live = s.companies.filter((c) => c.status === 'active' || c.status === 'ipo');
    const deck = [];
    const n = s.players.length;
    const cardsEach = R.priceCards;
    const total = cardsEach * n + Math.max(0, 32 - cardsEach * n); // extra "market" cards keep small tables lively
    for (let i = 0; i < total; i++) {
      const c = live[i % live.length];
      const v = pick(s, tier(c)) * (rnd(s) < 0.5 ? 1 : -1);
      deck.push({ id: 'k' + s.round + '-' + i, kind: 'price', tk: c.tk, v });
    }
    shuffle(s, deck);
    const specials = Object.keys(BR.SPECIALS);
    for (const p of s.players) {
      p.hand = deck.splice(0, cardsEach);
      if (rnd(s) < R.specialChance) p.hand.push({ id: 'x' + s.round + p.seat, kind: 'special', sp: pick(s, specials) });
      p.hand.sort((a, b) => (a.kind === b.kind ? (a.tk || '').localeCompare(b.tk || '') : a.kind === 'special' ? 1 : -1));
      p.ipoBlocks = 0;
      p.ready = !!p.bot;
    }
    s.market = deck; // leftover cards nobody holds
    s.dealer = (s.dealer + 1) % n;
    s.seat = s.dealer;
    s.timeLeft = s.settings.turnTime;
    s.botWait = 1.2;
    log(s, `Round ${s.round}: cards dealt. ${current(s).name} starts.`, 'sys');
    s.v++;
  }

  function nextTurn(s) {
    s.seat = (s.seat + 1) % s.players.length;
    if (s.seat === s.dealer) {
      s.pass += 1;
      if (s.pass >= s.settings.turns) { doReveal(s); return; }
    }
    s.timeLeft = s.settings.turnTime;
    s.botWait = 0.9 + rnd(s) * 0.8;
    s.v++;
  }

  function doReveal(s) {
    const rows = [];
    const events = [];
    const before = {};
    for (const p of s.players) before[p.id] = netWorth(s, p);

    // IPO allotment happens before the listing price moves
    if (s.ipo) {
      const c = company(s, s.ipo.tk);
      const want = s.players.reduce((a, p) => a + p.ipoBlocks, 0);
      const ratio = want > s.ipo.blocks ? s.ipo.blocks / want : 1;
      for (const p of s.players) {
        if (!p.ipoBlocks) continue;
        let got = Math.floor(p.ipoBlocks * ratio);
        if (rnd(s) < p.ipoBlocks * ratio - got) got++;
        const shares = got * R.block;
        p.cash += p.ipoBlocked - shares * c.issue;
        p.ipoBlocked = 0;
        if (shares) p.hold[c.tk] = (p.hold[c.tk] || 0) + shares;
        events.push(`${p.name} got ${got} of ${p.ipoBlocks} IPO blocks in ${c.tk}.`);
      }
      if (want > s.ipo.blocks) events.push(`${c.name} IPO was oversubscribed ${(want / s.ipo.blocks).toFixed(1)}x!`);
      c.status = 'active';
      c.price = c.issue;
      c.history = [c.issue];
    }

    const allBoom = s.plays.filter((x) => x.sp === 'BOOM').length - s.plays.filter((x) => x.sp === 'CRASH').length;
    for (const c of s.companies) {
      if (c.status !== 'active') continue;
      const cards = [];
      for (const p of s.players) for (const k of p.hand) if (k.kind === 'price' && k.tk === c.tk) cards.push({ who: p.name, v: k.v, avatar: p.avatar });
      for (const k of s.market) if (k.tk === c.tk) cards.push({ who: 'Market', v: k.v, avatar: '🏛' });
      let total = cards.reduce((a, k) => a + k.v, 0);
      const mods = [];
      for (const x of s.plays) {
        if (x.tk !== c.tk) continue;
        if (x.sp === 'BULL') { total += 20; mods.push('🐂 +20'); }
        if (x.sp === 'BEAR') { total -= 20; mods.push('🐻 −20'); }
      }
      if (s.plays.some((x) => x.sp === 'DOUBLE' && x.tk === c.tk)) { total *= 2; mods.push('✖2'); }
      if (allBoom) { total += allBoom * 10; mods.push(allBoom > 0 ? '🌦 +10' : '🌪 −10'); }
      if (total < 0 && s.plays.some((x) => x.sp === 'SHIELD' && x.tk === c.tk)) { total = 0; mods.push('🛡 blocked'); }
      const from = c.price;
      let to = Math.max(0, from + total);
      const row = { tk: c.tk, name: c.name, logo: c.logo, color: c.color, from, to, total, cards, mods, note: '' };

      for (const x of s.plays) {
        if (x.sp !== 'DIVIDEND' || x.tk !== c.tk) continue;
        for (const p of s.players) if (p.hold[c.tk]) p.cash += p.hold[c.tk] * R.dividend;
        row.note = `💰 Dividend ₹${R.dividend}/share paid`;
      }
      if (to <= 0) {
        c.status = 'bankrupt';
        for (const p of s.players) delete p.hold[c.tk];
        row.note = '💥 BANKRUPT! All shares wiped out';
        log(s, `${c.name} went bankrupt. Every share is gone!`, 'down');
        to = 0;
      } else if (to >= R.splitAt) {
        for (const p of s.players) if (p.hold[c.tk]) p.hold[c.tk] *= 2;
        to = Math.round(to / 2);
        row.note = '🎉 1:1 BONUS! Shares doubled, price halved';
        log(s, `${c.name} hit ₹${R.splitAt}: bonus issue, shares doubled!`, 'up');
      }
      c.price = to; c.last = to - from;
      c.history.push(to);
      if (c.history.length > 30) c.history.shift();
      rows.push(row);
    }

    // bank interest
    for (const p of s.players) {
      if (p.loan > 0) {
        const i = Math.round(p.loan * R.loanRate);
        p.loan += i;
        events.push(`${p.name} paid ₹${fmt(i)} loan interest.`);
      }
    }

    const pl = {};
    for (const p of s.players) {
      const w = netWorth(s, p);
      p.worth.push(w);
      pl[p.id] = w - before[p.id];
    }
    rows.sort((a, b) => b.total - a.total);
    s.reveal = { round: s.round, rows, events, pl, plays: s.plays.slice() };
    log(s, `Round ${s.round} revealed! Biggest mover: ${rows[0] ? rows[0].name : '-'}.`, 'sys');

    if (s.round >= s.settings.rounds) {
      s.phase = 'ended';
      s.final = s.players.map((p) => ({ id: p.id, name: p.name, worth: netWorth(s, p), avatar: p.avatar, color: p.color, bot: p.bot }))
        .sort((a, b) => b.worth - a.worth);
    } else {
      s.phase = 'reveal';
      s.timeLeft = s.settings.auto ? 25 : 0;
      for (const p of s.players) p.ready = !!p.bot;
    }
    s.v++;
  }

  // ---------------------------------------------------------------- actions
  // Free actions (bank) can happen any time; turn actions end your turn.
  const ACTIONS = {
    buy(s, p, a) {
      const c = company(s, a.tk);
      const b = Math.floor(a.blocks);
      if (!c || c.status !== 'active') return 'That company is not trading';
      if (!(b > 0)) return 'Choose how many blocks';
      const cost = b * R.block * c.price;
      if (cost > p.cash) return 'Not enough cash';
      p.cash -= cost;
      p.hold[c.tk] = (p.hold[c.tk] || 0) + b * R.block;
      log(s, `${p.name} bought ${fmt(b * R.block)} ${c.tk} @ ₹${c.price}`, 'up');
      return 'turn';
    },
    sell(s, p, a) {
      const c = company(s, a.tk);
      const b = Math.floor(a.blocks);
      if (!c || c.status !== 'active') return 'That company is not trading';
      if (!(b > 0) || b * R.block > (p.hold[c.tk] || 0)) return 'You do not have that many shares';
      p.cash += b * R.block * c.price;
      p.hold[c.tk] -= b * R.block;
      if (!p.hold[c.tk]) delete p.hold[c.tk];
      log(s, `${p.name} sold ${fmt(b * R.block)} ${c.tk} @ ₹${c.price}`, 'down');
      return 'turn';
    },
    ipo(s, p, a) {
      if (!s.ipo) return 'No IPO this round';
      const b = Math.max(1, Math.min(R.ipoMaxBlocks, Math.floor(a.blocks)));
      const cost = b * R.block * s.ipo.issue;
      p.cash += p.ipoBlocked;
      if (cost > p.cash) { p.cash -= p.ipoBlocked; return 'Not enough cash'; }
      p.cash -= cost; p.ipoBlocked = cost; p.ipoBlocks = b;
      log(s, `${p.name} applied for ${b} block${b > 1 ? 's' : ''} of the ${s.ipo.tk} IPO.`, 'ipo');
      return 'turn';
    },
    special(s, p, a) {
      const i = p.hand.findIndex((k) => k.id === a.card && k.kind === 'special');
      if (i < 0) return 'You do not have that card';
      const k = p.hand[i];
      const def = BR.SPECIALS[k.sp];
      const c = a.tk && company(s, a.tk);
      if (def.target && (!c || c.status !== 'active')) return 'Pick a company on the board';
      if (k.sp === 'GIFT') {
        if (!p.hold[c.tk]) return 'You must own that company';
        const add = Math.min(R.giftMax, Math.floor(p.hold[c.tk] / 2 / R.block) * R.block || R.block);
        p.hold[c.tk] += add;
        log(s, `🎁 ${p.name} got ${fmt(add)} free ${c.tk} shares!`, 'up');
      } else if (k.sp === 'LOOT') {
        const victims = s.players.filter((o) => o.id !== p.id && o.cash > 0);
        let got = 0;
        for (const o of victims) { const t = Math.min(o.cash, R.lootEach); o.cash -= t; got += t; }
        p.cash += got;
        log(s, `🪙 ${p.name} collected ₹${fmt(got)} in brokerage fees from everyone!`, 'up');
      } else {
        s.plays.push({ sp: k.sp, tk: c ? c.tk : null, who: p.name });
        log(s, `${def.icon} ${p.name} played ${def.name}${c ? ' on ' + c.name : ''}!`, 'corp');
      }
      p.hand.splice(i, 1);
      return 'turn';
    },
    pass(s, p) { log(s, `${p.name} passed.`, 'sys'); return 'turn'; },
    loan(s, p) {
      if (p.loan + R.loanStep > R.loanMax) return `Loan limit is ₹${fmt(R.loanMax)}`;
      p.loan += R.loanStep; p.cash += R.loanStep;
      log(s, `🏦 ${p.name} took a ₹${fmt(R.loanStep)} loan.`, 'sys');
      return null;
    },
    repay(s, p) {
      const amt = Math.min(p.loan, p.cash, R.loanStep);
      if (!(amt > 0)) return p.loan ? 'Not enough cash' : 'No loan to repay';
      p.loan -= amt; p.cash -= amt;
      return null;
    },
    ready(s, p) { p.ready = true; return null; },
  };
  const TURN_ACTIONS = ['buy', 'sell', 'ipo', 'special', 'pass'];

  BR.act = function (s, pid, a) {
    const p = player(s, pid);
    if (!p || !ACTIONS[a.type]) return 'Unknown action';
    if (s.phase === 'ended') return 'Game over';
    if (TURN_ACTIONS.includes(a.type)) {
      if (s.phase !== 'turns') return 'Wait for the next round';
      if (current(s).id !== pid) return 'Wait for your turn';
    }
    if (a.type === 'ready' && s.phase !== 'reveal') return null;
    const r = ACTIONS[a.type](s, p, a);
    if (r && r !== 'turn') return r;
    s.v++;
    if (r === 'turn') nextTurn(s);
    if (a.type === 'ready') maybeNextRound(s);
    return null;
  };

  function maybeNextRound(s) {
    const humans = s.players.filter((p) => !p.bot && p.connected);
    if (humans.length && !humans.every((p) => p.ready)) return;
    startRound(s);
  }

  // dt in seconds: turn timers and auto-continue for online games
  BR.tick = function (s, dt) {
    if (s.phase === 'turns' && s.settings.turnTime && !current(s).bot) {
      s.timeLeft -= dt;
      if (s.timeLeft <= 0) { BR.act(s, current(s).id, { type: 'pass' }); }
      return true;
    }
    if (s.phase === 'reveal' && s.settings.auto && s.timeLeft > 0) {
      s.timeLeft -= dt;
      if (s.timeLeft <= 0) startRound(s);
      return true;
    }
    return false;
  };

  BR.viewFor = function (s, pid) {
    const v = JSON.parse(JSON.stringify(s));
    delete v.rng;
    v.marketCount = v.market.length;
    v.market = [];
    for (const p of v.players) {
      p.handCount = p.hand.length;
      if (p.id !== pid) p.hand = [];
    }
    return v;
  };

  BR.util = { netWorth, holdingsValue, maxBlocks, company, player, current, fmt, rnd, pick };
})(window.BR = window.BR || {});
