// Bull Rush game engine. Pure state + actions so the same code runs offline and on the online host.
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
  const gauss = (s) => {
    let u = 0, v = 0;
    while (u === 0) u = rnd(s);
    while (v === 0) v = rnd(s);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const round2 = (x) => Math.round(x * 100) / 100;
  const company = (s, tk) => s.companies.find((c) => c.tk === tk);
  const player = (s, id) => s.players.find((p) => p.id === id);

  function feed(s, text, kind) {
    s.feed.unshift({ day: s.day, text, kind: kind || 'news' });
    if (s.feed.length > 60) s.feed.length = 60;
  }

  function tradable(c) { return c.status === 'active'; }

  function holdingsValue(s, p) {
    let v = 0;
    for (const tk in p.hold) {
      const c = company(s, tk);
      if (c) v += p.hold[tk] * c.price;
    }
    return v;
  }
  function netWorth(s, p) {
    return p.cash + holdingsValue(s, p) + p.fd + blockedCash(p) - p.loan;
  }
  function blockedCash(p) { return (p.ipoBlocked || 0) + (p.rightsBlocked || 0); }
  function loanLimit(s, p) {
    return Math.max(0, R.baseCredit + R.loanLtv * (holdingsValue(s, p) + p.fd) - p.loan);
  }

  function newCompany(def, supplyValue) {
    const supply = Math.round(supplyValue / def.price / 10) * 10;
    return {
      tk: def.tk, name: def.name, sector: def.sector, logo: def.logo, vol: def.vol, div: def.div,
      price: def.price, open: def.price, prevClose: def.price, hi: def.price, lo: def.price,
      supply, float: supply, fair: def.price, E: 0, walk: 0, impact: 1,
      candles: [], intraday: [def.price], status: 'active',
    };
  }

  // ---------------------------------------------------------------- setup
  BR.createGame = function (settings, roster) {
    const s = {
      v: 0,
      settings: Object.assign({ days: 10, dayLength: 60, startCash: R.startCash, auto: false }, settings),
      day: 0, phase: 'brief', timeLeft: 0, tickAcc: 0,
      rng: (settings.seed || Date.now()) | 0,
      companies: [], players: [], feed: [], corp: [], macro: null, ipo: null, summary: null,
      index: { value: 10000, open: 10000, history: [10000], divisor: 1 },
    };
    const supplyValue = 3.5e7 * Math.max(2, roster.length) / 4; // more players -> deeper market
    s.companies = BR.COMPANIES.map((d) => newCompany(d, supplyValue));
    s.index.divisor = marketCap(s) / 10000;
    // IPOs open roughly at 25%, 50% and 75% of the game
    const order = BR.IPOS.map((_, i) => i).sort(() => rnd(s) - 0.5);
    s.ipoQueue = order;
    s.ipoDays = [];
    for (const f of [0.25, 0.5, 0.75]) {
      const d = Math.max(2, Math.round(s.settings.days * f));
      if (d < s.settings.days && !s.ipoDays.includes(d)) s.ipoDays.push(d);
    }
    const powerKeys = Object.keys(BR.POWERS);
    s.players = roster.map((r, i) => ({
      id: r.id, name: r.name, bot: r.bot || null, color: r.color, avatar: r.avatar,
      cash: s.settings.startCash, hold: {}, cost: {}, loan: 0, fd: 0,
      tips: [], intel: [], powers: [pick(s, powerKeys)], powerUsed: false, shields: {},
      ipoLots: 0, ipoBlocked: 0, rights: {}, rightsBlocked: 0, tender: {},
      ready: false, connected: true, worth: [s.settings.startCash], trades: 0, seat: i,
    }));
    feed(s, 'Welcome to the Bull Rush exchange. Opening bell on Day 1!', 'sys');
    startDay(s);
    return s;
  };

  function marketCap(s) {
    return s.companies.filter((c) => c.status !== 'insolvent').reduce((a, c) => a + c.price * c.supply, 0);
  }

  // ---------------------------------------------------------------- day cycle
  function startDay(s) {
    s.day += 1;
    s.phase = 'brief';
    s.summary = null;
    const humans = s.players.filter((p) => !p.bot);
    s.timeLeft = s.settings.auto ? 12 : 0;

    // relist restructured companies and list yesterday's IPO
    for (const c of s.companies) {
      if (c.status === 'insolvent' && s.day >= c.relistDay) {
        const cap = marketCap(s);
        c.status = 'active';
        c.price = c.prevClose = c.fair = 100;
        c.float = c.supply = Math.round(3.5e7 / 100 / 10) * 10;
        c.candles = [];
        s.index.divisor = (cap + c.price * c.supply) / s.index.value;
        feed(s, `${c.name} relists at ₹100 after restructuring.`, 'corp');
      }
      if (c.listingPrice) {
        const cap = marketCap(s);
        const old = c.price * c.supply;
        c.price = c.listingPrice;
        s.index.divisor *= (cap - old + c.price * c.supply) / cap;
        const g = (c.listingPrice / c.issue - 1) * 100;
        feed(s, `${c.name} lists at ₹${c.listingPrice.toFixed(0)} (${g >= 0 ? '+' : ''}${g.toFixed(1)}% vs issue).`, g >= 0 ? 'up' : 'down');
        delete c.listingPrice;
      }
    }

    // morning macro event
    let m;
    do { m = pick(s, BR.MACRO); } while (s.macro && m.h === s.macro.h);
    s.macro = m;
    feed(s, 'MACRO: ' + m.h, 'macro');

    const active = s.companies.filter((c) => c.status === 'active');
    for (const c of s.companies) {
      c.open = c.hi = c.lo = c.price;
      c.walk = 0; c.impact = 1; c.intraday = [c.price];
      c.E = 0;
      if (c.status === 'suspended') c.status = 'active';
      if (c.status !== 'active') continue;
      c.E += ((m.fx[c.sector] || 0) + (m.fx.ALL || 0)) / 100;
      c.E += (c.fair / c.price - 1) * 0.06; // slow pull toward fair value
    }

    // corporate actions
    s.corp = [];
    const nCorp = rnd(s) < 0.35 ? 0 : rnd(s) < 0.6 ? 1 : 2;
    const pool = active.slice().sort(() => rnd(s) - 0.5);
    for (let i = 0; i < nCorp && i < pool.length; i++) makeCorp(s, pool[i]);

    // private tips
    for (const p of s.players) {
      p.ready = !!p.bot;
      p.powerUsed = false; p.shields = {}; p.intel = [];
      p.ipoLots = 0; p.rights = {}; p.tender = {};
      p.tips = [];
      for (let i = 0; i < R.tipsPerDay; i++) p.tips.push(makeTip(s, active, p.id));
    }
    // hidden "market" tips so small tables still move
    const phantom = Math.max(0, 14 - s.players.length * R.tipsPerDay);
    for (let i = 0; i < phantom; i++) makeTip(s, active, null);

    // IPO opens
    s.ipo = null;
    if (s.ipoDays.includes(s.day) && s.ipoQueue.length) {
      const def = BR.IPOS[s.ipoQueue.shift()];
      const hype = Math.exp(gauss(s) * 1.1 + 1.2); // institutional appetite, typically 1x-20x
      const lot = Math.max(10, Math.round(15000 / def.price / 5) * 5);
      const lotsOffered = Math.round(1.2e7 / (def.price * lot));
      s.ipo = Object.assign({}, def, {
        issue: def.price, lot, lotsOffered, maxLots: Math.max(5, Math.round(lotsOffered * 0.04)),
        hype, inst: 0, retail: 0, gmp: 0, status: 'open',
      });
      feed(s, `IPO OPEN: ${def.name} at ₹${def.price}/share, lot of ${lot}. Bids close today!`, 'ipo');
    }
    s.index.open = s.index.value;
    s.v++;
  }

  function makeTip(s, active, owner) {
    const c = pick(s, active);
    const up = rnd(s) < 0.52;
    const pct = pick(s, [3, 4, 5, 6, 8, 10, 12]) * (up ? 1 : -1);
    const rumor = rnd(s) < 0.3;
    const truth = rumor ? rnd(s) < R.rumorTruth : true;
    if (truth) c.E += pct / 100;
    return { id: 't' + Math.floor(rnd(s) * 1e9), tk: c.tk, pct, rumor, truth, owner, h: pick(s, up ? BR.TIPS_UP : BR.TIPS_DOWN) };
  }

  function makeCorp(s, c) {
    const kinds = ['DIV', 'RIGHTS', 'BUYBACK', 'PROBE'];
    if (c.price > 300) kinds.push('BONUS');
    if (c.price > 1200) kinds.push('SPLIT', 'SPLIT');
    const k = pick(s, kinds);
    let a = { type: k, tk: c.tk };
    if (k === 'DIV') {
      a.amt = Math.max(1, Math.round(c.price * Math.max(0.01, c.div) * (0.6 + rnd(s))));
      c.E += 0.01;
      a.text = `${c.name} declares dividend of ₹${a.amt}/share (paid at close).`;
    } else if (k === 'BONUS') {
      c.E += 0.03;
      a.text = `${c.name} announces 1:1 bonus. Holdings double, price halves at close.`;
    } else if (k === 'SPLIT') {
      c.E += 0.02;
      a.text = `${c.name} announces 1:5 stock split, effective at close.`;
    } else if (k === 'RIGHTS') {
      a.price = Math.round(c.price * 0.8);
      c.E -= 0.03;
      a.text = `${c.name} rights issue: 1 new share for every 5 held at ₹${a.price}. Subscribe today.`;
    } else if (k === 'BUYBACK') {
      a.price = Math.round(c.price * 1.15);
      c.E += 0.04;
      a.text = `${c.name} buyback at ₹${a.price}. Tender up to 25% of your shares today.`;
    } else if (k === 'PROBE') {
      c.status = 'suspended';
      c.E = -(0.12 + rnd(s) * 0.1);
      a.text = `Regulator probes ${c.name} for insider trading. Trading suspended today!`;
    }
    s.corp.push(a);
    feed(s, a.text, 'corp');
  }

  function stepPrices(s) {
    const L = s.settings.dayLength;
    const frac = clamp(1 - s.timeLeft / L, 0, 1);
    for (const c of s.companies) {
      if (c.status !== 'active') continue;
      c.walk = c.walk * 0.97 + gauss(s) * c.vol * 0.12;
      setPrice(c, c.open * (1 + 0.4 * c.E * frac + c.walk) * c.impact);
    }
    // IPO subscription builds through the day
    if (s.ipo && s.ipo.status === 'open') {
      const ipo = s.ipo;
      const target = ipo.hype * Math.pow(frac, 1.6);
      ipo.inst = round2(Math.max(ipo.inst, target * (0.8 + rnd(s) * 0.4)));
      ipo.retail = round2(Math.max(ipo.retail, target * 0.7 * (0.8 + rnd(s) * 0.4) + playerLots(s) / ipo.lotsOffered));
      ipo.gmp = Math.round(ipo.issue * (listingGainGuess(s, ipo) + gauss(s) * 0.04));
    }
    s.index.value = marketCap(s) / s.index.divisor;
  }

  function setPrice(c, p) {
    const lo = c.open * (1 - R.circuit), hi = c.open * (1 + R.circuit);
    c.price = round2(clamp(p, Math.max(0.5, lo), hi));
    c.hi = Math.max(c.hi, c.price);
    c.lo = Math.min(c.lo, c.price);
  }

  function playerLots(s) { return s.players.reduce((a, p) => a + p.ipoLots, 0); }
  function marketMood(s) { return s.index.value / s.index.open - 1; }
  function listingGainGuess(s, ipo) {
    const sub = (ipo.inst + ipo.retail) / 2;
    return -0.12 + 0.11 * Math.log(1 + sub) + marketMood(s);
  }

  function closeDay(s) {
    const sum = { day: s.day, movers: [], tips: [], events: [], ipo: null, pl: {} };
    const before = {};
    for (const p of s.players) before[p.id] = netWorth(s, p);

    for (const c of s.companies) {
      if (c.status !== 'active' && c.status !== 'suspended') continue;
      const noise = gauss(s) * c.vol;
      const target = c.status === 'suspended' ? c.open * (1 + c.E) : c.open * (1 + c.E + noise) * c.impact;
      setPrice(c, target);
      c.fair *= 1 + gauss(s) * 0.01;
    }

    // shields
    for (const p of s.players) {
      for (const tk in p.shields) {
        const c = company(s, tk);
        const q = p.hold[tk] || 0;
        if (c && q && c.price < c.open) {
          const pay = (c.open - c.price) * q;
          p.cash += pay;
          sum.events.push(`🛡 ${p.name}'s shield on ${tk} paid ₹${fmt(pay)}.`);
        }
      }
    }

    // corporate actions settle
    for (const a of s.corp) {
      const c = company(s, a.tk);
      if (a.type === 'DIV') {
        for (const p of s.players) if (p.hold[a.tk]) p.cash += a.amt * p.hold[a.tk];
        c.price = round2(Math.max(1, c.price - a.amt));
      } else if (a.type === 'BONUS' || a.type === 'SPLIT') {
        const f = a.type === 'BONUS' ? 2 : 5;
        for (const p of s.players) if (p.hold[a.tk]) { p.hold[a.tk] *= f; p.cost[a.tk] /= f; }
        c.price = round2(c.price / f); c.open /= f; c.hi /= f; c.lo /= f; c.fair /= f;
        c.supply *= f; c.float *= f;
        c.candles.forEach((k) => { k.o /= f; k.h /= f; k.l /= f; k.c /= f; });
        c.intraday = c.intraday.map((x) => x / f);
      } else if (a.type === 'RIGHTS') {
        for (const p of s.players) {
          const q = p.rights[a.tk] || 0;
          if (!q) continue;
          const old = p.hold[a.tk] || 0;
          p.cost[a.tk] = ((p.cost[a.tk] || 0) * old + a.price * q) / (old + q);
          p.hold[a.tk] = old + q;
          p.rightsBlocked -= a.price * q;
          c.supply += q;
          sum.events.push(`${p.name} got ${q} rights shares of ${a.tk}.`);
        }
      } else if (a.type === 'BUYBACK') {
        for (const p of s.players) {
          const q = Math.min(p.tender[a.tk] || 0, p.hold[a.tk] || 0);
          if (!q) continue;
          p.hold[a.tk] -= q;
          if (!p.hold[a.tk]) { delete p.hold[a.tk]; delete p.cost[a.tk]; }
          p.cash += q * a.price;
          c.supply -= q;
          sum.events.push(`${p.name} sold ${q} ${a.tk} in the buyback.`);
        }
      }
    }
    for (const p of s.players) p.rightsBlocked = 0;

    // IPO allotment
    if (s.ipo && s.ipo.status === 'open') sum.ipo = settleIpo(s);

    // insolvency
    for (const c of s.companies) {
      if (c.status === 'active' && c.price < R.pennyFloor) {
        c.status = 'insolvent';
        c.relistDay = s.day + 2;
        for (const p of s.players) { delete p.hold[c.tk]; delete p.cost[c.tk]; }
        sum.events.push(`💥 ${c.name} collapsed below ₹${R.pennyFloor}. Shares cancelled!`);
        feed(s, `${c.name} declared insolvent. All shares cancelled.`, 'down');
      }
    }

    // candles + movers
    for (const c of s.companies) {
      if (c.status === 'insolvent' && !c.candles.length) continue;
      if (c.status !== 'insolvent') {
        c.candles.push({ o: c.open, h: Math.max(c.hi, c.price), l: Math.min(c.lo, c.price), c: c.price });
        if (c.candles.length > 40) c.candles.shift();
      }
      sum.movers.push({ tk: c.tk, name: c.name, from: c.open, to: c.price, pct: (c.price / c.open - 1) * 100 });
      c.prevClose = c.price;
    }
    sum.movers.sort((a, b) => b.pct - a.pct);

    // reveal every tip played today
    for (const p of s.players) for (const t of p.tips) sum.tips.push(Object.assign({ who: p.name }, t));

    // bank: interest and margin calls
    for (const p of s.players) {
      if (p.loan > 0) p.loan = round2(p.loan * (1 + R.loanRate));
      if (p.fd > 0) p.fd = round2(p.fd * (1 + R.fdRate));
      marginCall(s, p, sum);
    }

    s.index.value = marketCap(s) / s.index.divisor;
    s.index.history.push(s.index.value);

    for (const p of s.players) {
      const w = netWorth(s, p);
      p.worth.push(w);
      sum.pl[p.id] = w - before[p.id];
      if (s.day % 3 === 0 && p.powers.length < 3) p.powers.push(pick(s, Object.keys(BR.POWERS)));
    }
    s.summary = sum;
    s.corp = [];
    if (s.day >= s.settings.days) {
      s.phase = 'ended';
      s.final = s.players.map((p) => ({ id: p.id, name: p.name, worth: netWorth(s, p), avatar: p.avatar, color: p.color, bot: p.bot }))
        .sort((a, b) => b.worth - a.worth);
      feed(s, 'Final closing bell! Market is closed.', 'sys');
    } else {
      s.phase = 'summary';
      s.timeLeft = s.settings.auto ? 20 : 0;
      for (const p of s.players) p.ready = !!p.bot;
    }
    s.v++;
  }

  function settleIpo(s) {
    const ipo = s.ipo;
    const pl = playerLots(s);
    const simLots = ipo.lotsOffered * (ipo.hype * 0.85 + ipo.hype * 0.15 * rnd(s));
    const sub = (pl + simLots) / ipo.lotsOffered;
    const ratio = sub > 1 ? 1 / sub : 1;
    const res = { tk: ipo.tk, name: ipo.name, sub, allot: {} };
    const c = newCompany(ipo, ipo.lotsOffered * ipo.lot * ipo.issue * 3);
    c.issue = ipo.issue;
    let gain = -0.12 + 0.11 * Math.log(1 + sub) + marketMood(s) + gauss(s) * 0.07;
    gain = clamp(gain, -0.35, 0.9);
    c.listingPrice = round2(ipo.issue * (1 + gain));
    c.fair = ipo.issue * (1 + gain * 0.4);
    for (const p of s.players) {
      if (!p.ipoLots) continue;
      let lots = 0;
      for (let i = 0; i < p.ipoLots; i++) if (rnd(s) < ratio) lots++;
      if (!lots && rnd(s) < Math.min(1, ratio * p.ipoLots * 1.5)) lots = 1; // small-investor lottery
      const shares = lots * ipo.lot;
      const refund = p.ipoBlocked - shares * ipo.issue;
      p.cash += refund;
      p.ipoBlocked = 0;
      if (shares) { p.hold[ipo.tk] = shares; p.cost[ipo.tk] = ipo.issue; }
      res.allot[p.id] = { applied: p.ipoLots, lots, shares };
    }
    c.float = c.supply - Object.values(res.allot).reduce((a, x) => a + x.shares, 0);
    s.companies.push(c);
    s.index.divisor = marketCap(s) / s.index.value;
    feed(s, `${ipo.name} IPO subscribed ${sub.toFixed(1)}x. Lists tomorrow.`, 'ipo');
    s.ipo = null;
    return res;
  }

  function marginCall(s, p, sum) {
    const assets = () => p.cash + holdingsValue(s, p) + p.fd;
    if (p.loan <= 0 || p.loan <= assets() * R.marginCall) return;
    const pay = Math.min(p.cash, p.loan);
    p.cash -= pay; p.loan -= pay;
    if (p.loan > 0 && p.fd > 0) { const f = Math.min(p.fd, p.loan); p.fd -= f; p.loan -= f; }
    const held = Object.keys(p.hold).map((tk) => company(s, tk)).sort((a, b) => p.hold[b.tk] * b.price - p.hold[a.tk] * a.price);
    for (const c of held) {
      if (p.loan <= assets() * 0.6) break;
      const q = p.hold[c.tk];
      const need = Math.ceil((p.loan - assets() * 0.55) / c.price);
      const sell = Math.min(q, Math.max(1, need));
      const cash = sell * c.price;
      p.hold[c.tk] -= sell;
      if (!p.hold[c.tk]) { delete p.hold[c.tk]; delete p.cost[c.tk]; }
      c.float += sell;
      const r = Math.min(cash, p.loan);
      p.loan -= r; p.cash += cash - r;
    }
    p.loan = round2(p.loan);
    sum.events.push(`⚠ Margin call! The bank sold ${p.name}'s shares to recover its loan.`);
    feed(s, `Margin call on ${p.name}.`, 'down');
  }

  // ---------------------------------------------------------------- actions
  function maxBuy(s, p, c) {
    if (!tradable(c)) return 0;
    let lo = 0, hi = Math.min(c.float, Math.floor(p.cash / c.price));
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (quote(c, mid, true).total <= p.cash) lo = mid; else hi = mid - 1;
    }
    return lo;
  }
  function quote(c, qty, buy) {
    const imp = R.impact * qty / c.supply;
    const px = c.price * (buy ? 1 + imp / 2 : 1 - imp / 2);
    const gross = px * qty;
    const fee = gross * R.brokerage;
    return { px, imp, gross, fee, total: buy ? gross + fee : gross - fee };
  }

  const ACTIONS = {
    buy(s, p, a) {
      const c = company(s, a.tk);
      const q = Math.floor(a.qty);
      if (!c || s.phase !== 'open') return 'Market is closed';
      if (!tradable(c)) return `${c.tk} is not trading`;
      if (!(q > 0)) return 'Pick a quantity';
      if (q > c.float) return `Only ${c.float} shares available`;
      const qt = quote(c, q, true);
      if (qt.total > p.cash + 0.01) return 'Not enough cash';
      p.cash -= qt.total;
      const old = p.hold[c.tk] || 0;
      p.cost[c.tk] = ((p.cost[c.tk] || 0) * old + qt.px * q) / (old + q);
      p.hold[c.tk] = old + q;
      c.float -= q;
      c.impact *= 1 + qt.imp;
      setPrice(c, c.price * (1 + qt.imp));
      p.trades++;
      if (q * qt.px > 300000) feed(s, `${p.name} bought ${q.toLocaleString('en-IN')} ${c.tk} @ ₹${qt.px.toFixed(2)}`, 'up');
      return null;
    },
    sell(s, p, a) {
      const c = company(s, a.tk);
      const q = Math.floor(a.qty);
      if (!c || s.phase !== 'open') return 'Market is closed';
      if (!tradable(c)) return `${c.tk} is not trading`;
      if (!(q > 0) || q > (p.hold[c.tk] || 0)) return 'You do not hold that many';
      const qt = quote(c, q, false);
      p.cash += qt.total;
      p.hold[c.tk] -= q;
      if (!p.hold[c.tk]) { delete p.hold[c.tk]; delete p.cost[c.tk]; }
      c.float += q;
      c.impact *= 1 - qt.imp;
      setPrice(c, c.price * (1 - qt.imp));
      p.trades++;
      if (q * qt.px > 300000) feed(s, `${p.name} sold ${q.toLocaleString('en-IN')} ${c.tk} @ ₹${qt.px.toFixed(2)}`, 'down');
      return null;
    },
    loan(s, p, a) {
      const amt = Math.floor(a.amt);
      if (!(amt > 0)) return 'Enter an amount';
      if (amt > loanLimit(s, p) + 1) return 'Above your credit limit';
      p.loan += amt; p.cash += amt;
      return null;
    },
    repay(s, p, a) {
      const amt = Math.min(Math.floor(a.amt), p.loan, p.cash);
      if (!(amt > 0)) return 'Nothing to repay';
      p.loan = round2(p.loan - amt); p.cash -= amt;
      return null;
    },
    fdIn(s, p, a) {
      const amt = Math.min(Math.floor(a.amt), p.cash);
      if (!(amt > 0)) return 'Enter an amount';
      p.fd += amt; p.cash -= amt;
      return null;
    },
    fdOut(s, p, a) {
      const amt = Math.min(Math.floor(a.amt), p.fd);
      if (!(amt > 0)) return 'No deposit to withdraw';
      p.fd = round2(p.fd - amt); p.cash += amt;
      return null;
    },
    power(s, p, a) {
      if (s.phase !== 'open') return 'Use powers while the market is open';
      if (p.powerUsed) return 'One power per day';
      const i = p.powers.indexOf(a.power);
      if (i < 0) return 'You do not have that card';
      const def = BR.POWERS[a.power];
      const c = a.tk && company(s, a.tk);
      if (def.target === 'stock' && (!c || !tradable(c))) return 'Pick a trading stock';
      if (a.power === 'BULL' || a.power === 'BEAR') {
        const f = a.power === 'BULL' ? 1.07 : 0.93;
        c.impact *= f;
        setPrice(c, c.price * f);
        feed(s, `${def.icon} ${p.name} played ${def.name} on ${c.name}!`, a.power === 'BULL' ? 'up' : 'down');
      } else if (a.power === 'PEEK') {
        for (const o of s.players) {
          if (o.id === p.id || !o.tips.length) continue;
          const t = o.tips[Math.floor(rnd(s) * o.tips.length)];
          p.intel.push({ who: o.name, tk: t.tk, pct: t.pct, rumor: t.rumor, h: t.h });
        }
        feed(s, `${def.icon} ${p.name} is peeking at rivals' tips...`, 'sys');
      } else if (a.power === 'SHIELD') {
        if (!p.hold[c.tk]) return 'You must hold that stock';
        p.shields[c.tk] = true;
      }
      p.powers.splice(i, 1);
      p.powerUsed = true;
      return null;
    },
    ipo(s, p, a) {
      const ipo = s.ipo;
      if (!ipo || ipo.status !== 'open' || s.phase !== 'open') return 'No IPO is open';
      const lots = clamp(Math.floor(a.lots), 0, ipo.maxLots);
      p.cash += p.ipoBlocked;
      const need = lots * ipo.lot * ipo.issue;
      if (need > p.cash) { p.cash -= p.ipoBlocked; return 'Not enough cash to block'; }
      p.cash -= need; p.ipoBlocked = need; p.ipoLots = lots;
      return null;
    },
    rights(s, p, a) {
      const ca = s.corp.find((x) => x.type === 'RIGHTS' && x.tk === a.tk);
      if (!ca || s.phase !== 'open') return 'No rights issue open';
      const max = Math.floor((p.hold[a.tk] || 0) / 5);
      const q = clamp(Math.floor(a.qty), 0, max);
      const prev = p.rights[a.tk] || 0;
      const delta = (q - prev) * ca.price;
      if (delta > p.cash) return 'Not enough cash';
      p.cash -= delta; p.rightsBlocked += delta; p.rights[a.tk] = q;
      return null;
    },
    tender(s, p, a) {
      const ca = s.corp.find((x) => x.type === 'BUYBACK' && x.tk === a.tk);
      if (!ca || s.phase !== 'open') return 'No buyback open';
      p.tender[a.tk] = clamp(Math.floor(a.qty), 0, Math.floor((p.hold[a.tk] || 0) * 0.25));
      return null;
    },
    ready(s, p) { p.ready = true; return null; },
  };

  BR.act = function (s, pid, a) {
    const p = player(s, pid);
    if (!p || !ACTIONS[a.type]) return 'Unknown action';
    if (s.phase === 'ended') return 'Game over';
    const err = ACTIONS[a.type](s, p, a);
    if (!err) {
      s.v++;
      if (a.type === 'ready') maybeAdvance(s);
    }
    return err;
  };

  function maybeAdvance(s) {
    const humans = s.players.filter((p) => !p.bot && p.connected);
    if (humans.length && !humans.every((p) => p.ready)) return;
    advance(s);
  }

  function advance(s) {
    if (s.phase === 'brief') {
      s.phase = 'open';
      s.timeLeft = s.settings.dayLength;
      for (const p of s.players) p.ready = !!p.bot;
      feed(s, `🔔 Day ${s.day} opening bell!`, 'sys');
    } else if (s.phase === 'open') {
      closeDay(s);
    } else if (s.phase === 'summary') {
      startDay(s);
    }
    s.v++;
  }

  // dt in seconds. Returns true when state changed.
  BR.tick = function (s, dt) {
    if (s.phase === 'ended') return false;
    if (s.phase === 'open') {
      s.timeLeft -= dt;
      s.tickAcc += dt;
      if (s.tickAcc >= 1) {
        s.tickAcc = 0;
        stepPrices(s);
        for (const c of s.companies) {
          if (c.status !== 'active') continue;
          c.intraday.push(c.price);
          if (c.intraday.length > 120) c.intraday.splice(1, 1);
        }
        s.v++;
      }
      if (s.timeLeft <= 0) { advance(s); return true; }
      return true;
    }
    if (s.settings.auto && s.timeLeft > 0) {
      s.timeLeft -= dt;
      if (s.timeLeft <= 0) advance(s);
      return true;
    }
    return false;
  };

  // close the market early (single player "ring the bell")
  BR.ringBell = function (s, pid) {
    const p = player(s, pid);
    if (s.phase === 'open' && p) { p.ready = true; maybeAdvance(s); s.v++; }
  };

  // What a given player is allowed to see. Secret drift and rival tips are removed.
  BR.viewFor = function (s, pid) {
    const v = JSON.parse(JSON.stringify(s));
    delete v.rng;
    for (const c of v.companies) { delete c.E; delete c.fair; delete c.walk; }
    if (v.ipo) delete v.ipo.hype;
    for (const p of v.players) {
      if (s.phase !== 'summary' && s.phase !== 'ended') for (const t of p.tips) delete t.truth;
      if (p.id !== pid) {
        p.tipCount = p.tips.length;
        p.tips = []; p.intel = []; p.powerCount = p.powers.length; p.powers = [];
      }
    }
    return v;
  };

  BR.util = { netWorth, holdingsValue, loanLimit, maxBuy, quote, company, player, fmt, blockedCash, rnd, pick, gauss };

  function fmt(n) {
    const a = Math.abs(n);
    if (a >= 1e7) return (n / 1e7).toFixed(2) + ' Cr';
    if (a >= 1e5) return (n / 1e5).toFixed(2) + ' L';
    return Math.round(n).toLocaleString('en-IN');
  }
})(window.BR = window.BR || {});
