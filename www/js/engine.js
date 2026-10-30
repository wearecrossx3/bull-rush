// Bull Rush engine (tabletop edition): turn-based rounds, dealt price cards, gold cards and a big reveal.
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
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const company = (s, tk) => s.companies.find((c) => c.tk === tk);
  const player = (s, id) => s.players.find((p) => p.id === id);
  const current = (s) => s.players[s.seat];
  const live = (c) => c.status === 'active';

  function fmt(n) {
    const a = Math.abs(n);
    if (a >= 1e7) return (n / 1e7).toFixed(2) + ' Cr';
    if (a >= 1e5) return (n / 1e5).toFixed(2) + ' L';
    return Math.round(n).toLocaleString('en-IN');
  }
  function log(s, text, kind) {
    s.feed.unshift({ round: s.round, text, kind: kind || 'news' });
    if (s.feed.length > 80) s.feed.length = 80;
  }
  // Public record of every money move, shown in the trade list.
  function trade(s, p, act, tk, qty, px, note) {
    s.trades.unshift({ r: s.round, who: p.name, avatar: p.avatar, pid: p.id, act, tk, qty, px, note: note || '' });
    if (s.trades.length > 250) s.trades.length = 250;
    p.lastAct = { r: s.round, act, tk, qty, px, note: note || '' };
  }

  // Average buy price: p.cost[tk] is what the current holding cost in total.
  function addCost(p, tk, amt) { p.cost = p.cost || {}; p.cost[tk] = (p.cost[tk] || 0) + amt; }
  function shrinkCost(p, tk, before) {
    p.cost = p.cost || {};
    const left = p.hold[tk] || 0;
    if (!left) delete p.cost[tk]; else if (p.cost[tk]) p.cost[tk] = Math.round(p.cost[tk] * left / before);
  }
  function avgCost(p, tk) { return p.hold[tk] && p.cost && p.cost[tk] ? p.cost[tk] / p.hold[tk] : 0; }

  function priceOf(c) { return c.status === 'ipo' ? c.issue : c.price; }
  function holdingsValue(s, p) {
    let v = 0;
    for (const tk in p.hold) { const c = company(s, tk); if (c) v += p.hold[tk] * priceOf(c); }
    return v;
  }
  function netWorth(s, p) { return p.cash + p.fd + holdingsValue(s, p) + (p.ipoBlocked || 0) - p.loan; }
  function loanLimit(s, p) { return Math.max(0, Math.floor((R.baseCredit + R.loanLtv * (holdingsValue(s, p) + p.fd) - p.loan) / 10000) * 10000); }
  function available(s, c) { return (c.supply || R.supply) - s.players.reduce((a, p) => a + (p.hold[c.tk] || 0), 0); }
  function maxBlocks(s, p, c) {
    if (!live(c)) return 0;
    return Math.max(0, Math.min(Math.floor(p.cash / (c.price * R.block)), Math.floor(available(s, c) / R.block)));
  }

  // Top holder of a company earns a title: Co-owner (blocks 1 minus card) or Owner (blocks 2).
  function ownerOf(s, c) {
    let best = null, tie = false;
    for (const p of s.players) {
      const q = p.hold[c.tk] || 0;
      if (q < R.coOwnerAt) continue;
      if (!best || q > best.hold[c.tk]) { best = p; tie = false; } else if (q === best.hold[c.tk]) tie = true;
    }
    if (!best || tie) return null;
    return { p: best, rank: best.hold[c.tk] >= R.ownerAt ? 'owner' : 'co', blocks: best.hold[c.tk] >= R.ownerAt ? 2 : 1 };
  }

  function tier(c) {
    if (c.price < 20) return [5];
    if (c.price < 40) return [5, 10];
    if (c.price < 70) return [5, 10, 15];
    if (c.price < 120) return [10, 15, 20];
    return [10, 20, 25, 30];
  }

  const SHAPES = ['circle', 'hex', 'diamond', 'shield', 'square', 'star', 'drop', 'leaf'];
  const PALETTE = ['#ff5c8a', '#ff8a3d', '#ffd23f', '#7ed957', '#2fd0c6', '#5fd3ff', '#5b8cff', '#b46cff', '#f06bd8', '#c9a36b', '#3ddc97', '#ff6f59'];
  function newCompany(s, def, idx) {
    const words = def.name.split(/\s+/);
    return {
      tk: def.tk, name: def.name, sector: def.sector, pitch: def.pitch, color: s.palette[idx % s.palette.length],
      mark: { shape: pick(s, SHAPES), letters: (words[0][0] + (words[1] ? words[1][0] : words[0][1])).toUpperCase(), tilt: Math.floor(rnd(s) * 4), ring: rnd(s) < 0.5 },
      price: def.start, start: def.start, history: [def.start], last: 0, status: 'active', supply: R.supply,
    };
  }
  function goldCard(s, p) { return { id: 'g' + Math.floor(rnd(s) * 1e9), sp: pick(s, Object.keys(BR.SPECIALS)) }; }

  // ---------------------------------------------------------------- setup
  BR.createGame = function (settings, roster) {
    const s = {
      v: 0,
      settings: Object.assign({ rounds: 8, turns: 3, startCash: R.startCash, auto: false, turnTime: 0 }, settings),
      round: 0, pass: 0, seat: 0, phase: 'turns', timeLeft: 0, botWait: 0,
      rng: (settings.seed || Date.now()) | 0,
      companies: [], players: [], feed: [], trades: [], plays: [], reveal: null, ipo: null,
    };
    const pool = shuffle(s, BR.COMPANY_POOL.slice());
    s.palette = shuffle(s, PALETTE.slice());
    s.companies = BR.START_PRICES.map((start, i) => newCompany(s, Object.assign({ start }, pool[i]), i));
    s.ipoDefs = BR.IPO_PRICES.map((start, i) => Object.assign({ start }, pool[8 + i]));
    s.ipoRounds = [];
    for (const f of [0.3, 0.55, 0.8]) {
      const r = Math.max(2, Math.round(s.settings.rounds * f));
      if (r < s.settings.rounds && !s.ipoRounds.includes(r)) s.ipoRounds.push(r);
    }
    s.players = roster.map((r, i) => ({
      id: r.id, name: r.name, bot: r.bot || null, color: r.color || BR.COLORS[i % 6], avatar: r.avatar || BR.AVATARS[i],
      cash: s.settings.startCash, hold: {}, cost: {}, loan: 0, fd: 0, hand: [], gold: [], ipoBlocks: 0, ipoBlocked: 0,
      ready: false, connected: true, worth: [s.settings.startCash], seat: i, lastAct: null, spy: null,
    }));
    for (const p of s.players) for (let i = 0; i < R.startGold; i++) p.gold.push(goldCard(s, p));
    s.dealer = Math.floor(rnd(s) * s.players.length);
    log(s, 'Welcome to the Bull Rush table! Everyone gets 3 gold cards.', 'sys');
    startRound(s);
    return s;
  };

  // ---------------------------------------------------------------- market brain
  // Decides how many rise/fall cards each company gets so no stock runs away for ever:
  // expensive stocks lean down, beaten-down stocks lean up, and long streaks get tired.
  function buildDeck(s, cos, total) {
    const deck = [];
    for (let i = 0; i < total; i++) {
      const c = cos[i % cos.length];
      const ratio = c.price / c.start;
      let bias = clamp(-0.28 * Math.log(ratio) / Math.log(2), -0.3, 0.3);
      const h = c.history;
      if (h.length >= 3) {
        const up = h[h.length - 1] > h[h.length - 2] && h[h.length - 2] > h[h.length - 3];
        const down = h[h.length - 1] < h[h.length - 2] && h[h.length - 2] < h[h.length - 3];
        if (up) bias -= 0.12;
        if (down) bias += 0.12;
      }
      const v = pick(s, tier(c)) * (rnd(s) < 0.5 + bias ? 1 : -1);
      deck.push({ id: 'k' + s.round + '-' + i, tk: c.tk, v });
    }
    return shuffle(s, deck);
  }

  // Every hand gets a fair mix of rises and falls.
  function dealFair(s, deck, n, each) {
    const ups = deck.filter((k) => k.v > 0), downs = deck.filter((k) => k.v < 0);
    const hands = [];
    for (let i = 0; i < n; i++) {
      const h = [];
      const wantUp = Math.round(each / 2 + (rnd(s) - 0.5) * 2);
      for (let j = 0; j < each; j++) {
        const fromUp = (j < wantUp && ups.length) || !downs.length;
        const k = (fromUp ? ups : downs).pop();
        if (k) h.push(k);
      }
      hands.push(h.sort((a, b) => a.tk.localeCompare(b.tk) || b.v - a.v));
    }
    return { hands, rest: ups.concat(downs) };
  }

  // ---------------------------------------------------------------- rounds
  function startRound(s) {
    s.round += 1;
    s.pass = 0;
    s.plays = [];
    s.reveal = null;
    s.phase = 'turns';

    for (const c of s.companies) {
      if (c.status === 'bankrupt') {
        c.status = 'active'; c.price = c.start; c.supply = R.supply; c.history.push(c.start);
        log(s, `${c.name} is back on the board at ₹${c.start} after restructuring.`, 'corp');
      }
    }

    s.ipo = null;
    let def = null;
    if (s.foundQueue && s.foundQueue.length) {
      // a player's own company jumps the queue; a scheduled IPO waits a round
      def = s.foundQueue.shift();
      s.ipoRounds = s.ipoRounds.map((r) => (r === s.round ? r + 1 : r));
    } else if (s.ipoRounds.includes(s.round) && s.ipoDefs.length) def = s.ipoDefs.shift();
    if (def) {
      const c = newCompany(s, def, s.companies.length);
      c.status = 'ipo'; c.issue = def.start; c.history = [];
      if (def.founder) c.founder = def.founder;
      s.companies.push(c);
      s.ipo = { tk: c.tk, name: c.name, issue: def.start, blocks: Math.max(6, s.players.length * 4), pitch: def.pitch, founder: def.founder || null };
      log(s, `🚀 IPO! ${c.name} opens at ₹${def.start}/share. Apply on your turn this round.`, 'ipo');
    }

    const cos = s.companies.filter((c) => c.status === 'active' || c.status === 'ipo');
    const n = s.players.length;
    const each = R.priceCards;
    const total = each * n + Math.max(0, 32 - each * n);
    const { hands, rest } = dealFair(s, buildDeck(s, cos, total), n, each);
    s.players.forEach((p, i) => {
      p.hand = hands[i];
      p.ipoBlocks = 0;
      p.spy = null;
      p.tip = null;
      p.ready = !!p.bot;
    });
    s.market = rest;
    s.dealer = (s.dealer + 1) % n;
    s.seat = s.dealer;
    s.timeLeft = s.settings.turnTime;
    s.botWait = R.botThink[0] + 1;
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
    s.botWait = R.botThink[0] + rnd(s) * (R.botThink[1] - R.botThink[0]);
    s.v++;
  }

  function doReveal(s) {
    const rows = [];
    const events = [];
    const before = {};
    const cashBefore = {};
    for (const p of s.players) { before[p.id] = netWorth(s, p); cashBefore[p.id] = p.cash; }

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
        if (shares) { p.hold[c.tk] = (p.hold[c.tk] || 0) + shares; addCost(p, c.tk, shares * c.issue); }
        events.push(`${p.avatar} ${p.name} got ${got} of ${p.ipoBlocks} IPO blocks in ${c.tk}.`);
        trade(s, p, 'ipo', c.tk, shares, c.issue, `allotted ${got}/${p.ipoBlocks}`);
      }
      const founder = c.founder && player(s, c.founder);
      if (founder) {
        const sold = s.players.reduce((a, p) => a + (p.id === founder.id ? 0 : p.hold[c.tk] || 0), 0);
        founder.hold[c.tk] = (founder.hold[c.tk] || 0) + R.founderShares;
        addCost(founder, c.tk, R.listingFee);
        if (sold) { founder.cash += sold * c.issue; trade(s, founder, 'raise', c.tk, sold, c.issue, 'IPO money'); }
        events.push(`🏢 ${founder.avatar} ${founder.name} listed ${c.name}, kept ${fmt(R.founderShares)} founder shares and raised ₹${fmt(sold * c.issue)}.`);
      }
      if (want > s.ipo.blocks) events.push(`${c.name} IPO was oversubscribed ${(want / s.ipo.blocks).toFixed(1)}x!`);
      c.status = 'active'; c.price = c.issue; c.history = [c.issue];
    }

    const rupee = s.plays.filter((x) => x.sp === 'RUPUP').length - s.plays.filter((x) => x.sp === 'RUPDN').length;
    for (const c of s.companies) {
      if (!live(c)) continue;
      const cards = [];
      for (const p of s.players) for (const k of p.hand) if (k.tk === c.tk) cards.push({ who: p.name, v: k.v, avatar: p.avatar });
      for (const k of s.market) if (k.tk === c.tk) cards.push({ who: 'Market', v: k.v, avatar: '🏛' });
      const mods = [];
      const own = ownerOf(s, c);
      if (own) {
        const worst = cards.filter((k) => k.v < 0).sort((a, b) => a.v - b.v).slice(0, own.blocks);
        worst.forEach((k) => (k.blocked = true));
        if (worst.length) mods.push(`${own.rank === 'owner' ? '👑 Owner' : '🎩 Co-owner'} ${own.p.name} removed ${worst.map((k) => k.v).join(', ')}`);
      }
      let total = cards.reduce((a, k) => a + (k.blocked ? 0 : k.v), 0);
      const on = (sp) => s.plays.some((x) => x.sp === sp && x.tk === c.tk);
      if (on('DOUBLE') && total) { total *= 2; mods.push('🎲 ×2'); }
      if (on('SCAM')) { total -= 40; mods.push('🚨 −40'); }
      if (on('CHARGE')) { total += 25; mods.push('🐂 +25'); }
      if (rupee) { const d = Math.round((c.price * 0.1 * rupee) / 5) * 5 || 5 * Math.sign(rupee); total += d; mods.push(`${rupee > 0 ? '🚀' : '📉'} ${d > 0 ? '+' : ''}${d}`); }
      if (on('UPCAP') && total > 15) { total = 15; mods.push('🚧 max +15'); }
      if (on('LOWCAP') && total < -15) { total = -15; mods.push('🪂 max −15'); }
      if (on('FREEZE')) { total = 0; mods.push('🔒 frozen'); }
      const from = c.price;
      let to = Math.max(0, from + total);
      const row = { tk: c.tk, name: c.name, color: c.color, mark: c.mark, from, to, total, cards, mods, note: '' };

      if (on('DIVIDEND')) {
        for (const p of s.players) if (p.hold[c.tk]) { p.cash += p.hold[c.tk] * R.dividend; trade(s, p, 'div', c.tk, p.hold[c.tk], R.dividend); }
        row.note = `💰 Dividend ₹${R.dividend}/share paid`;
      }
      if (to < from) {
        for (const x of s.plays.filter((y) => y.sp === 'NET' && y.tk === c.tk)) {
          const p = player(s, x.pid);
          const q = p && p.hold[c.tk];
          if (!q) continue;
          const back = q * (from - to);
          p.cash += back;
          trade(s, p, 'net', c.tk, q, from - to, 'Safety Net');
          events.push(`🛟 ${p.avatar} ${p.name}'s Safety Net paid ₹${fmt(back)} on ${c.tk}.`);
        }
      }
      if (to <= 0) {
        c.status = 'bankrupt';
        for (const p of s.players) { delete p.hold[c.tk]; if (p.cost) delete p.cost[c.tk]; }
        row.note = '💥 BANKRUPT! All shares wiped out';
        log(s, `${c.name} went bankrupt. Every share is gone!`, 'down');
        to = 0;
      } else if (to >= R.splitAt) {
        for (const p of s.players) if (p.hold[c.tk]) p.hold[c.tk] *= 2;
        c.supply = (c.supply || R.supply) * 2;
        to = Math.round(to / 2);
        row.note = '🎉 1:1 BONUS! Shares doubled, price halved';
        log(s, `${c.name} hit ₹${R.splitAt}: bonus issue, shares doubled!`, 'up');
      }
      c.price = to; c.last = to - from;
      c.history.push(to);
      if (c.history.length > 30) c.history.shift();
      rows.push(row);
    }

    // bank: deposits earn, loans cost, and too much debt triggers a margin call
    for (const p of s.players) {
      if (p.fd > 0) { const i = Math.round(p.fd * R.fdRate); p.fd += i; }
      if (p.loan > 0) { const i = Math.round(p.loan * R.loanRate); p.loan += i; }
      marginCall(s, p, events);
    }

    // catch-up: players in the bottom half get a fresh gold card
    const ranked = s.players.map((p) => ({ p, w: netWorth(s, p) })).sort((a, b) => b.w - a.w);
    ranked.slice(Math.ceil(ranked.length / 2)).forEach(({ p }) => {
      if (p.gold.length < R.maxGold) { p.gold.push(goldCard(s, p)); events.push(`✨ ${p.avatar} ${p.name} gets a bonus gold card for catching up.`); }
    });

    const pl = {}, cash = {};
    for (const p of s.players) {
      const w = netWorth(s, p);
      p.worth.push(w);
      pl[p.id] = w - before[p.id];
      cash[p.id] = p.cash - cashBefore[p.id];
    }
    rows.sort((a, b) => b.total - a.total);
    s.reveal = { round: s.round, rows, events, pl, cash, plays: s.plays.slice() };
    log(s, `Round ${s.round} revealed! Biggest mover: ${rows[0] ? rows[0].name : '-'}.`, 'sys');

    if (s.round >= s.settings.rounds) {
      s.phase = 'ended';
      for (const p of s.players) { p.cash += p.fd - p.loan; p.fd = 0; p.loan = 0; }
      s.final = s.players.map((p) => ({ id: p.id, name: p.name, worth: netWorth(s, p), avatar: p.avatar, color: p.color, bot: p.bot }))
        .sort((a, b) => b.worth - a.worth);
    } else {
      s.phase = 'reveal';
      s.timeLeft = s.settings.auto ? 25 : 0;
      for (const p of s.players) p.ready = !!p.bot;
    }
    s.v++;
  }

  function marginCall(s, p, events) {
    // the bank tolerates its trust credit plus 70% of what you own; beyond that it recovers the loan
    const assets = p.cash + p.fd + holdingsValue(s, p);
    if (p.loan <= 0 || p.loan <= R.baseCredit + assets * R.marginAt) return;
    const fromCash = Math.min(p.cash, p.loan); p.cash -= fromCash; p.loan -= fromCash;
    const fromFd = Math.min(p.fd, p.loan); p.fd -= fromFd; p.loan -= fromFd;
    const held = Object.keys(p.hold).map((tk) => company(s, tk)).filter(live).sort((a, b) => p.hold[b.tk] * b.price - p.hold[a.tk] * a.price);
    for (const c of held) {
      if (p.loan <= 0) break;
      const q = Math.min(p.hold[c.tk], Math.ceil(p.loan / c.price / R.block) * R.block);
      const had = p.hold[c.tk];
      p.hold[c.tk] -= q;
      if (!p.hold[c.tk]) delete p.hold[c.tk];
      shrinkCost(p, c.tk, had);
      const got = q * c.price;
      const pay = Math.min(got, p.loan);
      p.loan -= pay; p.cash += got - pay;
      trade(s, p, 'margin', c.tk, q, c.price, 'bank sold');
    }
    events.push(`⚠️ Margin call! The bank sold ${p.name}'s shares to recover its loan.`);
  }

  // ---------------------------------------------------------------- actions
  const ACTIONS = {
    buy(s, p, a) {
      const c = company(s, a.tk);
      const b = Math.floor(a.blocks);
      if (!c || !live(c)) return 'That company is not trading';
      if (!(b > 0)) return 'Choose how many blocks';
      const q = b * R.block;
      if (q * c.price > p.cash) return 'Not enough cash';
      if (q > available(s, c)) return `Only ${fmt(available(s, c))} ${c.tk} shares left`;
      p.cash -= q * c.price;
      p.hold[c.tk] = (p.hold[c.tk] || 0) + q;
      addCost(p, c.tk, q * c.price);
      trade(s, p, 'buy', c.tk, q, c.price);
      log(s, `${p.avatar} ${p.name} bought ${fmt(q)} ${c.tk} @ ₹${c.price}`, 'up');
      return 'turn';
    },
    sell(s, p, a) {
      const c = company(s, a.tk);
      const b = Math.floor(a.blocks);
      if (!c || !live(c)) return 'That company is not trading';
      const q = b * R.block;
      if (!(b > 0) || q > (p.hold[c.tk] || 0)) return 'You do not have that many shares';
      const had = p.hold[c.tk];
      p.cash += q * c.price;
      p.hold[c.tk] -= q;
      if (!p.hold[c.tk]) delete p.hold[c.tk];
      shrinkCost(p, c.tk, had);
      trade(s, p, 'sell', c.tk, q, c.price);
      log(s, `${p.avatar} ${p.name} sold ${fmt(q)} ${c.tk} @ ₹${c.price}`, 'down');
      return 'turn';
    },
    ipo(s, p, a) {
      if (!s.ipo) return 'No IPO this round';
      if (s.ipo.founder === p.id) return 'You cannot apply to your own IPO';
      const b = clamp(Math.floor(a.blocks), 1, R.ipoMaxBlocks);
      const cost = b * R.block * s.ipo.issue;
      p.cash += p.ipoBlocked;
      if (cost > p.cash) { p.cash -= p.ipoBlocked; return 'Not enough cash'; }
      p.cash -= cost; p.ipoBlocked = cost; p.ipoBlocks = b;
      trade(s, p, 'apply', s.ipo.tk, b * R.block, s.ipo.issue, 'IPO application');
      log(s, `${p.avatar} ${p.name} applied for ${b} block${b > 1 ? 's' : ''} of the ${s.ipo.tk} IPO.`, 'ipo');
      return 'turn';
    },
    special(s, p, a) {
      const i = p.gold.findIndex((k) => k.id === a.card);
      if (i < 0) return 'You do not have that card';
      const k = p.gold[i];
      const def = BR.SPECIALS[k.sp];
      const c = a.tk && company(s, a.tk);
      if (def.target && (!c || !live(c))) return 'Pick a company on the board';
      if (def.own && !p.hold[c.tk]) return 'You must own that company';
      if (k.sp === 'RIGHTS') {
        const half = Math.max(1, Math.round(c.price / 2));
        let add = Math.min(R.rightsMax, Math.floor(p.hold[c.tk] / 2 / R.block) * R.block || R.block);
        add = Math.min(add, Math.floor(p.cash / half / R.block) * R.block, Math.floor(available(s, c) / R.block) * R.block);
        if (!add) return 'Not enough cash for the rights shares';
        p.cash -= add * half; p.hold[c.tk] += add; addCost(p, c.tk, add * half);
        trade(s, p, 'rights', c.tk, add, half, 'Rights Offer');
      } else if (k.sp === 'SPY') {
        const rivals = s.players.filter((o) => o.id !== p.id);
        const o = rivals[Math.floor(rnd(s) * rivals.length)];
        p.spy = { who: o.name, avatar: o.avatar, cards: o.hand.map((x) => Object.assign({}, x)) };
        trade(s, p, 'gold', null, 0, 0, `🔍 spied on ${o.name}`);
      } else if (k.sp === 'TIP') {
        p.tip = s.market.map((x) => Object.assign({}, x));
        trade(s, p, 'gold', null, 0, 0, '🕵️ took an Insider Tip');
      } else if (k.sp === 'TAX') {
        const rich = s.players.filter((o) => o.id !== p.id).sort((a, b) => netWorth(s, b) - netWorth(s, a))[0];
        const amt = Math.max(0, Math.min(rich.cash, Math.round(netWorth(s, rich) * 0.05 / 1000) * 1000));
        rich.cash -= amt;
        trade(s, p, 'gold', null, 0, 0, `🧾 Tax Raid on ${rich.name}`);
        trade(s, rich, 'tax', null, 0, amt, `raided by ${p.name}`);
      } else if (k.sp === 'LUCKY') {
        p.cash += 100000;
        trade(s, p, 'bonus', null, 0, 100000, 'Lucky Bonus');
      } else {
        s.plays.push({ sp: k.sp, tk: c ? c.tk : null, who: p.name, pid: p.id });
        trade(s, p, 'gold', c ? c.tk : null, 0, 0, `${def.icon} ${def.name}`);
      }
      log(s, `${def.icon} ${p.name} played ${def.name}${c ? ' on ' + c.name : ''}!`, 'corp');
      p.gold.splice(i, 1);
      return 'turn';
    },
    found(s, p, a) {
      if (p.founded) return 'You already have your own company';
      if (netWorth(s, p) < R.founderAt) return `Reach ₹${fmt(R.founderAt)} net worth first`;
      if (p.cash < R.listingFee) return `Listing costs ₹${fmt(R.listingFee)} in cash`;
      if (s.round >= s.settings.rounds) return 'No rounds left to list a company';
      const name = String(a.name || '').replace(/[^A-Za-z0-9 &.'-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 18) || `${p.name.split(' ')[0]} Ventures`;
      const issue = R.founderIssue.includes(+a.issue) ? +a.issue : R.founderIssue[1];
      const tk = ticker(s, name);
      p.cash -= R.listingFee;
      p.founded = tk;
      (s.foundQueue = s.foundQueue || []).push({ tk, name, sector: 'OWN', pitch: `Founded by ${p.name}`, start: issue, founder: p.id });
      trade(s, p, 'found', tk, 0, R.listingFee, name);
      log(s, `🏢 ${p.avatar} ${p.name} founded ${name}! Its IPO opens next round at ₹${issue}.`, 'ipo');
      return 'turn';
    },
    pass(s, p) { p.lastAct = { r: s.round, act: 'pass' }; log(s, `${p.avatar} ${p.name} passed.`, 'sys'); return 'turn'; },
    loan(s, p, a) {
      const amt = Math.min(Math.floor(a.amt || R.loanStep), loanLimit(s, p));
      if (!(amt > 0)) return 'The bank will not lend you more right now';
      p.loan += amt; p.cash += amt;
      trade(s, p, 'loan', null, 0, amt);
      return null;
    },
    repay(s, p, a) {
      const amt = Math.min(Math.floor(a.amt || R.loanStep), p.loan, p.cash);
      if (!(amt > 0)) return p.loan ? 'Not enough cash' : 'No loan to repay';
      p.loan -= amt; p.cash -= amt;
      trade(s, p, 'repay', null, 0, amt);
      return null;
    },
    fdIn(s, p, a) {
      const amt = Math.min(Math.floor(a.amt || R.loanStep), p.cash);
      if (!(amt > 0)) return 'Not enough cash';
      p.fd += amt; p.cash -= amt;
      trade(s, p, 'fd', null, 0, amt, 'deposit');
      return null;
    },
    fdOut(s, p, a) {
      const amt = Math.min(Math.floor(a.amt || R.loanStep), p.fd);
      if (!(amt > 0)) return 'No deposit to withdraw';
      p.fd -= amt; p.cash += amt;
      trade(s, p, 'fd', null, 0, amt, 'withdraw');
      return null;
    },
    ready(s, p) { p.ready = true; return null; },
  };
  const TURN_ACTIONS = ['buy', 'sell', 'ipo', 'special', 'found', 'pass'];
  function ticker(s, name) {
    const taken = new Set(s.companies.map((c) => c.tk).concat(s.ipoDefs.map((d) => d.tk), (s.foundQueue || []).map((d) => d.tk)));
    let base = (name.toUpperCase().replace(/[^A-Z]/g, '') + 'XXXX').slice(0, 4);
    for (let i = 2; taken.has(base); i++) base = base.slice(0, 3) + i;
    return base;
  }
  function canFound(s, p) { return !p.founded && s.phase === 'turns' && s.round < s.settings.rounds && netWorth(s, p) >= R.founderAt && p.cash >= R.listingFee; }

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

  BR.tick = function (s, dt) {
    if (s.phase === 'turns' && s.settings.turnTime && !current(s).bot) {
      s.timeLeft -= dt;
      if (s.timeLeft <= 0) BR.act(s, current(s).id, { type: 'pass' });
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
    v.market = [];
    for (const p of v.players) {
      p.handCount = p.hand.length;
      p.goldCount = p.gold.length;
      if (p.id !== pid) { p.hand = []; p.gold = []; p.spy = null; p.tip = null; }
    }
    return v;
  };

  BR.util = { canFound, avgCost, available, ownerOf, netWorth, holdingsValue, loanLimit, maxBlocks, company, player, current, fmt, rnd, pick, priceOf };
})(window.BR = window.BR || {});
