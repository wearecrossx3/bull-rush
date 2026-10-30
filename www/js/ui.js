// Bull Rush UI: screens, game table, modals and the main loop.
(function (BR) {
  const U = BR.util;
  const $ = (q) => document.querySelector(q);
  const $$ = (q) => Array.from(document.querySelectorAll(q));
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rs = (n) => '₹' + U.fmt(n);
  const px = (n) => (n >= 1000 ? n.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : n.toFixed(2));
  const short = (n) => (n >= 1e5 ? rs(n) : n >= 1000 ? '₹' + (n / 1000).toFixed(1) + 'K' : '₹' + Math.round(n));
  const pct = (a, b) => (b ? (a / b - 1) * 100 : 0);
  const cls = (x) => (x > 0.005 ? 'up' : x < -0.005 ? 'down' : 'flat');
  const sgn = (x, d) => (x > 0 ? '+' : '') + x.toFixed(d === undefined ? 2 : d);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };

  const UI = { ctrl: null, sel: null, qty: 0, tab: 'tips', chart: 'intra', ipoLots: 1, bankAmt: 50000, modal: null, phaseKey: '', prev: {}, feedKey: '' };
  BR.UI = UI;

  // ---------------------------------------------------------------- screens
  let stopBg = null;
  function show(id) {
    $$('.screen').forEach((s) => s.classList.toggle('active', s.id === 'scr-' + id));
    UI.screen = id;
    if (id === 'title') { stopBg = stopBg || BR.titleBg($('#title-bg')); $('#btn-continue').classList.toggle('hidden', !store.get('br.save', null)); }
    else if (stopBg) { stopBg(); stopBg = null; }
  }
  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (go) { BR.sfx('tap'); show(go.dataset.go); }
  });

  function chips(el, onChange) {
    const opts = el.dataset.opts.split(',');
    const labels = el.dataset.labels ? el.dataset.labels.split(',') : opts;
    el.innerHTML = opts.map((o, i) => `<button class="chip${o === el.dataset.val ? ' on' : ''}" data-v="${o}">${labels[i]}</button>`).join('');
    el.addEventListener('click', (e) => {
      const b = e.target.closest('.chip');
      if (!b) return;
      el.dataset.val = b.dataset.v;
      el.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === b));
      if (onChange) onChange(b.dataset.v);
    });
  }

  function setupScreens() {
    const prof = store.get('br.profile', { name: '', avatar: BR.AVATARS[0] });
    $('#in-name').value = prof.name; $('#in-name-on').value = prof.name;
    const av = $('#pick-avatar');
    av.innerHTML = BR.AVATARS.map((a) => `<button class="chip av${a === prof.avatar ? ' on' : ''}" data-v="${a}">${a}</button>`).join('');
    av.dataset.val = prof.avatar;
    av.addEventListener('click', (e) => {
      const b = e.target.closest('.chip'); if (!b) return;
      av.dataset.val = b.dataset.v; av.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === b));
    });
    ['#pick-bots', '#pick-skill', '#pick-days', '#pick-len', '#pick-days-on', '#pick-len-on'].forEach((q) => chips($(q)));
    $('#btn-start').onclick = startOffline;
    $('#btn-continue').onclick = continueSaved;
    $('#btn-sound').onclick = () => { const on = BR.sound.toggle(); $('#btn-sound').textContent = on ? '🔊 Sound on' : '🔇 Sound off'; };
    $('#btn-sound').textContent = BR.sound.on ? '🔊 Sound on' : '🔇 Sound off';
    $('#btn-host').onclick = hostRoom;
    $('#btn-join').onclick = joinRoom;
    $('#howto-body').innerHTML = HOWTO;
  }

  function profile(sel) {
    const name = ($(sel).value || '').trim() || 'Trader';
    const p = { name, avatar: $('#pick-avatar').dataset.val || BR.AVATARS[0] };
    store.set('br.profile', p);
    $('#in-name').value = name; $('#in-name-on').value = name;
    return p;
  }

  // ---------------------------------------------------------------- controllers
  function LocalCtrl(s, me) {
    return {
      local: true, me, s,
      view() { return this.s; },
      send(a) { const e = BR.act(this.s, me, a); return e; },
      bell() { BR.ringBell(this.s, me); },
      step(dt) { BR.runBots(this.s, dt); BR.tick(this.s, dt); },
    };
  }

  function startOffline() {
    const me = profile('#in-name');
    const nBots = +$('#pick-bots').dataset.val;
    const skill = $('#pick-skill').dataset.val;
    const roster = [{ id: 'me', name: me.name, avatar: me.avatar, color: BR.COLORS[0] }];
    const names = BR.BOT_NAMES.slice().sort(() => Math.random() - 0.5);
    const avs = BR.AVATARS.filter((a) => a !== me.avatar).sort(() => Math.random() - 0.5);
    for (let i = 0; i < nBots; i++) roster.push({ id: 'bot' + i, name: names[i], bot: skill, avatar: avs[i], color: BR.COLORS[(i + 1) % 6] });
    const s = BR.createGame({ days: +$('#pick-days').dataset.val, dayLength: +$('#pick-len').dataset.val, auto: false }, roster);
    begin(LocalCtrl(s, 'me'));
  }

  function continueSaved() {
    const sv = store.get('br.save', null);
    if (!sv) return;
    begin(LocalCtrl(sv, 'me'));
  }

  function hostRoom() {
    const me = profile('#in-name-on');
    $('#lobby-msg').textContent = 'Creating room...';
    const host = new BR.Host(Object.assign({ color: BR.COLORS[0] }, me), {
      onReady(code) {
        $('#online-home').classList.add('hidden'); $('#online-lobby').classList.remove('hidden'); $('#host-ctrl').classList.remove('hidden');
        $('#room-code').textContent = code;
        $('#lobby-msg').textContent = 'Share the code. Add bots or wait for friends, then start.';
      },
      onLobby: renderLobby,
      onError(m) { toast(m, 'err'); },
    });
    UI.host = host;
    $('#btn-addbot').onclick = () => host.addBot();
    $('#btn-host-start').onclick = () => {
      if (host.roster.length < 2) { toast('Add a bot or wait for a friend', 'err'); return; }
      host.start({ days: +$('#pick-days-on').dataset.val, dayLength: +$('#pick-len-on').dataset.val });
      begin({
        local: true, online: true, me: 'host',
        view() { return host.game; },
        send(a) { const e = BR.act(host.game, 'host', a); host.flush(true); return e; },
        bell() { BR.ringBell(host.game, 'host'); host.flush(true); },
        step(dt) { BR.runBots(host.game, dt); BR.tick(host.game, dt); host.flush(false); },
        quit() { host.close(); },
      });
    };
  }

  function joinRoom() {
    const me = profile('#in-name-on');
    const code = ($('#in-code').value || '').trim().toUpperCase();
    if (code.length !== 5) { toast('Enter the 5-letter room code', 'err'); return; }
    toast('Connecting...');
    let started = false;
    const cl = new BR.Client(me, code, {
      onJoined(c) {
        $('#online-home').classList.add('hidden'); $('#online-lobby').classList.remove('hidden'); $('#host-ctrl').classList.add('hidden');
        $('#room-code').textContent = c; $('#lobby-msg').textContent = 'Joined! Waiting for the host to start...';
      },
      onLobby: renderLobby,
      onStart() {
        started = true;
        begin({
          online: true, get me() { return cl.id; },
          view() { return cl.state; },
          send(a) { cl.send(a); BR.sfx(a.type === 'buy' ? 'buy' : a.type === 'sell' ? 'sell' : 'tap'); return null; },
          bell() { cl.send({ type: 'bell' }); },
          quit() { cl.close(); },
        });
      },
      onState() { UI.dirty = true; },
      onActError(m) { toast(m, 'err'); BR.sfx('err'); },
      onError(m) {
        toast(m, 'err');
        if (started) { modalAlert('Connection lost', m); }
        else { $('#online-home').classList.remove('hidden'); $('#online-lobby').classList.add('hidden'); }
      },
    });
    UI.client = cl;
  }

  function renderLobby(list) {
    $('#lobby-list').innerHTML = list.map((p) => `<li>${esc(p.avatar || '🙂')} ${esc(p.name)}${p.bot ? ' <small class="flat">bot</small>' : ''}</li>`).join('');
  }

  // ---------------------------------------------------------------- game loop
  let raf = null, last = 0, renderAcc = 0;
  function begin(ctrl) {
    UI.ctrl = ctrl;
    UI.sel = null; UI.qty = 0; UI.phaseKey = ''; UI.prev = {}; UI.feedKey = '';
    closeModal(true);
    show('game');
    BR.sfx('bell');
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }
  function loop(t) {
    const dt = Math.min(0.25, (t - last) / 1000);
    last = t;
    const c = UI.ctrl;
    if (!c) return;
    if (c.step) c.step(dt);
    renderAcc += dt;
    const v = c.view();
    if (v && (renderAcc > 0.2 || UI.dirty)) {
      renderAcc = 0; UI.dirty = false;
      render(v);
    }
    raf = requestAnimationFrame(loop);
  }
  function quitGame() {
    if (UI.ctrl && UI.ctrl.quit) UI.ctrl.quit();
    UI.ctrl = null;
    cancelAnimationFrame(raf);
    closeModal(true);
    show('title');
  }

  function meP(v) { return v.players.find((p) => p.id === UI.ctrl.me); }

  function render(v) {
    const me = meP(v);
    if (!me) return;
    if (!UI.sel || !U.company(v, UI.sel)) UI.sel = v.companies[0].tk;
    phaseModals(v, me);
    renderTop(v, me);
    renderList(v, me);
    renderDetail(v, me);
    renderSide(v, me);
    renderTicker(v);
    if (UI.modal === 'bank') bankModal(v, me, true);
    if (UI.modal === 'brief' || UI.modal === 'summary') updateWaiting(v, me);
  }

  // ---------------------------------------------------------------- top bar
  function renderTop(v, me) {
    $('#tb-day').textContent = `${v.day}/${v.settings.days}`;
    const ph = $('#tb-phase');
    const names = { brief: 'PRE-OPEN', open: 'MARKET OPEN', summary: 'CLOSED', ended: 'GAME OVER' };
    $('#tb-phase-txt').textContent = names[v.phase];
    ph.className = 'tb-phase' + (v.phase === 'open' ? ' open' : '') + (v.phase === 'open' && v.timeLeft < 10 ? ' warn' : '');
    $('#tb-timer').textContent = v.phase === 'open' ? Math.max(0, Math.ceil(v.timeLeft)) + 's' : '';
    if (v.phase === 'open' && v.timeLeft < 5.5 && Math.ceil(v.timeLeft) !== UI.lastTick) { UI.lastTick = Math.ceil(v.timeLeft); BR.sfx('tick'); }
    const ic = pct(v.index.value, v.index.open);
    $('#tb-index').textContent = v.index.value.toLocaleString('en-IN', { maximumFractionDigits: 0 });
    const ie = $('#tb-index-chg'); ie.textContent = sgn(ic) + '%'; ie.className = cls(ic);
    $('#tb-cash').textContent = rs(me.cash);
    const w = U.netWorth(v, me);
    $('#tb-worth').textContent = rs(w);
    const wc = pct(w, v.settings.startCash);
    const we = $('#tb-worth-chg'); we.textContent = sgn(wc, 1) + '%'; we.className = cls(wc);
    const bell = $('#btn-bell');
    bell.classList.toggle('hidden', v.phase !== 'open');
    bell.textContent = me.ready ? '⏳ Waiting' : (v.players.filter((p) => !p.bot).length > 1 ? '🔔 Ready to close' : '🔔 Close day');
    bell.disabled = me.ready;
  }

  // ---------------------------------------------------------------- stock list
  function logoStyle(c) { return `background:${BR.SECTORS[c.sector].color}`; }
  function renderList(v, me) {
    const el = $('#stock-list');
    const corpTk = {};
    for (const a of v.corp) corpTk[a.tk] = a.type;
    let html = '';
    for (const c of v.companies) {
      const ch = pct(c.price, c.prevClose);
      const prev = UI.prev[c.tk];
      const flash = prev && c.price !== prev ? (c.price > prev ? ' flash-up' : ' flash-down') : '';
      const halt = c.status !== 'active';
      const own = me.hold[c.tk];
      const label = c.status === 'insolvent' ? 'INSOLVENT' : c.status === 'suspended' ? 'SUSPENDED' : '';
      html += `<div class="srow${c.tk === UI.sel ? ' sel' : ''}${halt ? ' halt' : ''}${flash}" data-sel="${c.tk}">
        <div class="slogo" style="${logoStyle(c)}">${c.logo}</div>
        <div class="sname"><b>${c.tk}${corpTk[c.tk] ? ` <span class="tag-c">${corpTk[c.tk]}</span>` : ''}</b><small>${own ? `<span class="own">● ${own.toLocaleString('en-IN')}</span> · ` : ''}${label || esc(c.name)}</small></div>
        <canvas class="spark" data-spark="${c.tk}"></canvas>
        <div class="sprice"><b>${px(c.price)}</b><span class="pill ${cls(ch)}">${sgn(ch)}%</span></div>
      </div>`;
      UI.prev[c.tk] = c.price;
    }
    const top = el.scrollTop;
    el.innerHTML = html;
    el.scrollTop = top;
    el.querySelectorAll('[data-spark]').forEach((cv) => {
      const c = U.company(v, cv.dataset.spark);
      const pts = v.phase === 'open' || v.phase === 'brief' ? c.intraday : c.candles.slice(-12).map((k) => k.c);
      BR.spark(cv, pts.length > 1 ? pts : c.candles.slice(-12).map((k) => k.c), v.phase === 'open' ? c.prevClose : (pts[0] || c.price));
    });
  }

  // ---------------------------------------------------------------- detail
  function stepFor(c) { return c.price > 1500 ? 5 : c.price > 400 ? 10 : c.price > 100 ? 50 : 100; }

  function renderDetail(v, me) {
    const c = U.company(v, UI.sel);
    const el = $('#detail');
    const step = stepFor(c);
    if (!UI.qty) UI.qty = step * 10;
    const held = me.hold[c.tk] || 0;
    const maxB = U.maxBuy(v, me, c);
    const qb = U.quote(c, Math.max(1, UI.qty), true);
    const ch = pct(c.price, c.prevClose);
    const avg = me.cost[c.tk];
    const pl = held ? (c.price - avg) * held : 0;
    const canTrade = v.phase === 'open' && c.status === 'active';
    const corp = v.corp.filter((a) => a.tk === c.tk);
    let corpHtml = '';
    for (const a of corp) {
      let ctl = '';
      if (a.type === 'RIGHTS' && held >= 5) {
        const mx = Math.floor(held / 5), cur = me.rights[c.tk] || 0;
        ctl = `<button class="btn small gold" data-act="rights" data-q="${cur ? 0 : mx}">${cur ? `Cancel (${cur})` : `Subscribe ${mx} @ ₹${a.price}`}</button>`;
      } else if (a.type === 'BUYBACK' && held >= 4) {
        const mx = Math.floor(held * 0.25), cur = me.tender[c.tk] || 0;
        ctl = `<button class="btn small gold" data-act="tender" data-q="${cur ? 0 : mx}">${cur ? `Cancel (${cur})` : `Tender ${mx} @ ₹${a.price}`}</button>`;
      }
      corpHtml += `<div class="corp-banner">📣 <span>${esc(a.text)}</span>${canTrade ? ctl : ''}</div>`;
    }
    const sector = BR.SECTORS[c.sector];
    el.innerHTML = `
      <div class="d-head">
        <div class="slogo" style="${logoStyle(c)}">${c.logo}</div>
        <div class="d-title"><b>${esc(c.name)}</b><small>${c.tk} · <span style="color:${sector.color}">${sector.name}</span>${c.issue ? ' · IPO ₹' + c.issue : ''}</small></div>
        <div class="d-price"><b class="${cls(ch)}">₹${px(c.price)}</b><span class="pill ${cls(ch)}">${sgn(c.price - c.prevClose)} (${sgn(ch)}%)</span></div>
      </div>
      <div class="chart-wrap">
        <div class="chart-mode"><button data-chart="intra" class="${UI.chart === 'intra' ? 'on' : ''}">Today</button><button data-chart="candle" class="${UI.chart === 'candle' ? 'on' : ''}">Daily</button></div>
        <canvas id="chart"></canvas>
      </div>
      ${corpHtml}
      <div class="d-stats">
        <div>Open<b>${px(c.open)}</b></div><div>High<b>${px(c.hi)}</b></div><div>Low<b>${px(c.lo)}</b></div>
        <div>You hold<b>${held.toLocaleString('en-IN')}</b></div><div>Avg cost<b>${held ? px(avg) : '-'}</b></div>
        <div>P&amp;L<b class="${cls(pl)}">${held ? (pl >= 0 ? '+' : '-') + short(Math.abs(pl)) : '-'}</b></div>
      </div>
      <div class="trade">
        <div class="qty"><button data-q="-">−</button><b>${UI.qty.toLocaleString('en-IN')}</b><button data-q="+">+</button></div>
        <div class="qchips"><button data-q="x2">×2</button><button data-q="half">½</button><button data-q="max">MAX</button><button data-q="all">ALL</button></div>
      </div>
      <div class="trade">
        <button class="btn green" data-act="buy" ${canTrade && UI.qty <= maxB ? '' : 'disabled'}>BUY<small>${rs(qb.total)}</small></button>
        <button class="btn red" data-act="sell" ${canTrade && held >= UI.qty && UI.qty > 0 ? '' : 'disabled'}>SELL<small>${held ? 'hold ' + held.toLocaleString('en-IN') : 'nothing held'}</small></button>
      </div>`;
    const cv = $('#chart');
    if (UI.chart === 'intra' && c.status !== 'insolvent') BR.lineChart(cv, c.intraday, c.prevClose, v.settings.dayLength + 1);
    else BR.candleChart(cv, c.candles, v.phase === 'open' ? { o: c.open, h: c.hi, l: c.lo, c: c.price } : null);
  }

  // ---------------------------------------------------------------- side tabs
  function renderSide(v, me) {
    $$('#side-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === UI.tab));
    $('#ipo-dot').classList.toggle('hidden', !v.ipo);
    const el = $('#tab-body');
    let h = '';
    if (UI.tab === 'tips') {
      h += `<div class="sec-h">YOUR SECRET TIPS · DAY ${v.day}</div>`;
      if (!me.tips.length) h += '<div class="empty">No tips today.</div>';
      for (const t of me.tips) h += tipCard(v, t);
      if (me.intel.length) {
        h += '<div class="sec-h">INTEL ON RIVALS</div>';
        for (const t of me.intel) h += tipCard(v, t, true);
      }
      h += `<div class="sec-h">POWER CARDS ${me.powerUsed ? '· used today' : '· 1 per day'}</div><div class="powers">`;
      if (!me.powers.length) h += '<div class="empty">You earn a card every 3 days.</div>';
      me.powers.forEach((k) => {
        const d = BR.POWERS[k];
        h += `<button class="power" data-power="${k}" ${me.powerUsed || v.phase !== 'open' ? 'disabled style="opacity:.5"' : ''}><b>${d.icon} ${d.name}</b><small>${d.desc}</small></button>`;
      });
      h += '</div>';
    } else if (UI.tab === 'ipo') {
      h += ipoPanel(v, me);
    } else if (UI.tab === 'rivals') {
      const rows = v.players.map((p) => ({ p, w: U.netWorth(v, p) })).sort((a, b) => b.w - a.w);
      rows.forEach((r, i) => {
        const p = r.p;
        const d = p.worth.length ? r.w - p.worth[p.worth.length - 1] : 0;
        const nHold = Object.keys(p.hold).length;
        h += `<div class="rival" style="${p.id === me.id ? 'outline:1px solid var(--gold)' : ''}">
          <div class="av">${esc(p.avatar || '🙂')}</div>
          <div><b>${i + 1}. ${esc(p.name)}</b><small>${p.bot ? 'bot · ' : ''}${nHold} stocks · loan ${rs(p.loan)}${p.ready && v.phase !== 'open' ? ' · ready' : ''}</small></div>
          <div class="w">${rs(r.w)}<br><small class="${cls(d)}">${d >= 0 ? '+' : '-'}${rs(Math.abs(d))}</small></div></div>`;
      });
      h += '<div class="sec-h">NET WORTH RACE</div><canvas id="race" style="width:100%;height:80px"></canvas>';
    } else {
      for (const f of v.feed) h += `<div class="newsi ${f.kind}"><small class="flat">D${f.day}</small> ${esc(f.text)}</div>`;
    }
    const top = el.scrollTop;
    el.innerHTML = h;
    el.scrollTop = top;
    const race = $('#race');
    if (race) {
      BR.worthChart(race, v.players.map((p) => ({ color: p.color || '#8fa3d6', me: p.id === me.id, pts: p.worth.concat([U.netWorth(v, p)]) })));
    }
  }

  function tipCard(v, t, intel) {
    const c = U.company(v, t.tk);
    return `<div class="tip${intel ? ' intel' : ''}" data-sel="${t.tk}">
      <span class="tk" style="color:${BR.SECTORS[c.sector].color}">${t.tk}</span>${t.rumor ? '<span class="rum">RUMOUR</span>' : ''}${intel ? ` <small class="flat">from ${esc(t.who)}</small>` : ''}
      <span class="eff ${t.pct > 0 ? 'up' : 'down'}">${t.pct > 0 ? '▲ +' : '▼ '}${t.pct}%</span>
      <p>${esc(t.h)}</p></div>`;
  }

  function ipoPanel(v, me) {
    const ipo = v.ipo;
    if (!ipo) {
      const next = (v.ipoDays || []).find((d) => d > v.day);
      const listed = v.companies.filter((c) => c.issue);
      let h = `<div class="empty">No IPO open today.${next ? `<br>Next IPO opens on <b>Day ${next}</b>.` : ''}</div>`;
      if (listed.length) {
        h += '<div class="sec-h">RECENT LISTINGS</div>';
        for (const c of listed) {
          const g = pct(c.price, c.issue);
          h += `<div class="kv newsi"><span>${c.logo} ${esc(c.name)}</span><b class="${cls(g)}">${sgn(g, 1)}% vs issue</b></div>`;
        }
      }
      return h;
    }
    const cost = UI.ipoLots * ipo.lot * ipo.issue;
    const gm = ipo.gmp / ipo.issue * 100;
    const meter = (x) => Math.min(100, (x / 10) * 100);
    return `<div class="ipo-card">
      <h4>${ipo.logo} ${esc(ipo.name)} <span class="pill flat">${BR.SECTORS[ipo.sector].name}</span></h4>
      <div class="muted">${esc(ipo.pitch)}</div>
      <div class="kv"><span>Issue price</span><b>₹${ipo.issue}</b></div>
      <div class="kv"><span>Lot size</span><b>${ipo.lot} shares (${rs(ipo.lot * ipo.issue)})</b></div>
      <div class="kv"><span>Max per investor</span><b>${ipo.maxLots} lots</b></div>
      <div class="kv"><span>Institutions</span><b>${ipo.inst.toFixed(2)}x</b></div><div class="meter"><i style="width:${meter(ipo.inst)}%"></i></div>
      <div class="kv"><span>Retail</span><b>${ipo.retail.toFixed(2)}x</b></div><div class="meter"><i style="width:${meter(ipo.retail)}%"></i></div>
      <div class="kv"><span>GMP (grey market)</span><b class="${cls(gm)}">${ipo.gmp >= 0 ? '+' : ''}₹${ipo.gmp} (${sgn(gm, 1)}%)</b></div>
      ${me.ipoLots ? `<div class="kv"><span>Your bid</span><b class="up">${me.ipoLots} lots · ${rs(me.ipoBlocked)} blocked</b></div>` : ''}
      <div class="trade"><div class="qty"><button data-ipo="-">−</button><b>${UI.ipoLots} lot${UI.ipoLots > 1 ? 's' : ''}</b><button data-ipo="+">+</button></div>
      <button class="btn gold" data-act="ipo" ${v.phase === 'open' ? '' : 'disabled'}>${me.ipoLots ? 'Update bid' : 'Apply'}<small>${rs(cost)}</small></button></div>
      <div class="muted">Bids close at today's bell. If oversubscribed, lots are allotted by lottery. Lists tomorrow.</div>
    </div>`;
  }

  function renderTicker(v) {
    const key = v.feed.length + (v.feed[0] ? v.feed[0].text : '') + v.day;
    if (key === UI.feedKey) return;
    UI.feedKey = key;
    const movers = v.companies.filter((c) => c.status === 'active').map((c) => {
      const ch = pct(c.price, c.prevClose);
      return `<span class="${cls(ch)}">${c.tk} ${px(c.price)} ${ch >= 0 ? '▲' : '▼'}${Math.abs(ch).toFixed(2)}%</span>`;
    }).join('');
    const news = v.feed.slice(0, 6).map((f) => `<span class="flat">◆ ${esc(f.text)}</span>`).join('');
    $('#ticker').innerHTML = movers + news;
  }

  // ---------------------------------------------------------------- game input
  document.addEventListener('click', (e) => {
    if (!UI.ctrl || UI.screen !== 'game') return;
    const v = UI.ctrl.view();
    if (!v) return;
    const me = meP(v);
    const t = e.target;
    const selEl = t.closest('[data-sel]');
    if (selEl && !t.closest('.modal')) {
      if (UI.sel !== selEl.dataset.sel) { UI.sel = selEl.dataset.sel; UI.qty = 0; BR.sfx('tap'); render(v); }
      return;
    }
    const tab = t.closest('[data-tab]');
    if (tab) { UI.tab = tab.dataset.tab; BR.sfx('tap'); render(v); return; }
    const ch = t.closest('[data-chart]');
    if (ch) { UI.chart = ch.dataset.chart; render(v); return; }
    const q = t.closest('[data-q]');
    const actBtn = t.closest('[data-act]');
    if (q && !actBtn) {
      const c = U.company(v, UI.sel), st = stepFor(c);
      const k = q.dataset.q;
      if (k === '+') UI.qty += st;
      else if (k === '-') UI.qty = Math.max(st, UI.qty - st);
      else if (k === 'x2') UI.qty *= 2;
      else if (k === 'half') UI.qty = Math.max(1, Math.floor(UI.qty / 2));
      else if (k === 'max') UI.qty = Math.max(1, U.maxBuy(v, me, c));
      else if (k === 'all') UI.qty = me.hold[c.tk] || UI.qty;
      BR.sfx('tap'); render(v); return;
    }
    const ib = t.closest('[data-ipo]');
    if (ib && v.ipo) {
      UI.ipoLots = Math.max(1, Math.min(v.ipo.maxLots, UI.ipoLots + (ib.dataset.ipo === '+' ? 1 : -1)));
      render(v); return;
    }
    if (actBtn) {
      const a = actBtn.dataset.act;
      let err;
      if (a === 'buy' || a === 'sell') {
        err = UI.ctrl.send({ type: a, tk: UI.sel, qty: UI.qty });
        if (!err && UI.ctrl.local) { BR.sfx(a); toast(`${a === 'buy' ? 'Bought' : 'Sold'} ${UI.qty.toLocaleString('en-IN')} ${UI.sel}`, 'ok'); }
      } else if (a === 'rights' || a === 'tender') {
        err = UI.ctrl.send({ type: a, tk: UI.sel, qty: +actBtn.dataset.q });
        if (!err) BR.sfx('coin');
      } else if (a === 'ipo') {
        err = UI.ctrl.send({ type: 'ipo', lots: UI.ipoLots });
        if (!err) { BR.sfx('coin'); toast(`Applied for ${UI.ipoLots} lots`, 'ok'); }
      }
      if (err) { toast(err, 'err'); BR.sfx('err'); }
      UI.dirty = true;
      return;
    }
    const pw = t.closest('[data-power]');
    if (pw && !pw.disabled) { powerModal(v, me, pw.dataset.power); return; }
  });

  $('#btn-bell').onclick = () => { if (UI.ctrl) { UI.ctrl.bell(); BR.sfx('tap'); } };
  $('#btn-bank').onclick = () => { const v = UI.ctrl.view(); bankModal(v, meP(v)); };
  $('#btn-menu').onclick = () => menuModal();

  // ---------------------------------------------------------------- modals
  function openModal(kind, html, narrow) {
    UI.modal = kind;
    $('#modal-card').className = 'modal-card' + (narrow ? ' narrow' : '');
    $('#modal-card').innerHTML = html;
    $('#modal').classList.remove('hidden');
  }
  function closeModal(force) {
    if (!force && (UI.modal === 'brief' || UI.modal === 'summary' || UI.modal === 'final')) return false;
    UI.modal = null;
    $('#modal').classList.add('hidden');
    return true;
  }
  BR.closeModal = closeModal;
  $('#modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal') { closeModal(); return; }
    const b = e.target.closest('[data-m]');
    if (!b) return;
    const k = b.dataset.m;
    const v = UI.ctrl && UI.ctrl.view();
    if (k === 'close') closeModal(true);
    else if (k === 'ready') { UI.ctrl.send({ type: 'ready' }); BR.sfx('tap'); UI.dirty = true; }
    else if (k === 'quit') quitGame();
    else if (k === 'again') { quitGame(); show('setup'); }
    else if (k === 'howto') { closeModal(true); quitGameKeep(); }
    else if (k === 'sound') { BR.sound.toggle(); menuModal(); }
    else if (k.startsWith('amt:')) { UI.bankAmt = +k.slice(4); bankModal(v, meP(v), true); }
    else if (k.startsWith('bank:')) {
      const me = meP(v);
      let amt = UI.bankAmt;
      const type = k.slice(5);
      if (amt === -1) amt = type === 'loan' ? U.loanLimit(v, me) : type === 'repay' ? Math.min(me.loan, me.cash) : type === 'fdIn' ? me.cash : me.fd;
      const err = UI.ctrl.send({ type, amt });
      if (err) { toast(err, 'err'); BR.sfx('err'); } else { BR.sfx('coin'); }
      setTimeout(() => { const nv = UI.ctrl.view(); bankModal(nv, meP(nv), true); }, UI.ctrl.local ? 0 : 400);
    } else if (k.startsWith('power:')) {
      const [, power, tk] = k.split(':');
      const err = UI.ctrl.send({ type: 'power', power, tk: tk || undefined });
      if (err) { toast(err, 'err'); BR.sfx('err'); } else { BR.sfx('power'); closeModal(true); }
    }
  });

  function quitGameKeep() { show('howto'); UI.returnToGame = true; }

  function phaseModals(v, me) {
    const key = v.day + ':' + v.phase;
    if (key === UI.phaseKey) return;
    const prevPhase = UI.phaseKey.split(':')[1];
    UI.phaseKey = key;
    if (v.phase === 'brief') briefModal(v, me);
    else if (v.phase === 'open') { closeModal(true); if (prevPhase === 'brief') BR.sfx('bell'); }
    else if (v.phase === 'summary') { BR.sfx('bell'); summaryModal(v, me); if (UI.ctrl.local && !UI.ctrl.online) store.set('br.save', v); }
    else if (v.phase === 'ended') { finalModal(v, me); if (UI.ctrl.local && !UI.ctrl.online) store.del('br.save'); }
  }

  function fxChips(fx) {
    const ks = Object.keys(fx);
    if (!ks.length) return '<span class="pill flat">No sector impact</span>';
    return ks.map((k) => `<span class="pill ${fx[k] > 0 ? 'up' : 'down'}">${k === 'ALL' ? 'All stocks' : BR.SECTORS[k].name} ${fx[k] > 0 ? '+' : ''}${fx[k]}%</span>`).join('');
  }

  function waitingLine(v) {
    const humans = v.players.filter((p) => !p.bot);
    if (humans.length < 2) return '';
    const n = humans.filter((p) => p.ready).length;
    return `${n}/${humans.length} ready${v.settings.auto && v.timeLeft > 0 ? ` · auto in ${Math.ceil(v.timeLeft)}s` : ''}`;
  }
  function updateWaiting(v, me) {
    const w = $('#m-wait');
    if (w) w.textContent = waitingLine(v);
    const b = $('#m-ready');
    if (b && me.ready) { b.disabled = true; b.textContent = 'Waiting for others...'; }
  }

  function briefModal(v, me) {
    const corp = v.corp.length ? v.corp.map((a) => `<div class="newsi corp">${esc(a.text)}</div>`).join('') : '<div class="flat">No corporate announcements today.</div>';
    const ipo = v.ipo ? `<div class="newsi ipo">🚀 IPO open: <b>${esc(v.ipo.name)}</b> at ₹${v.ipo.issue}. Check the IPO tab.</div>` : '';
    const tips = me.tips.map((t) => `<div class="kv"><span>${t.tk}${t.rumor ? ' <span class="rum tip">RUMOUR</span>' : ''}</span><b class="${t.pct > 0 ? 'up' : 'down'}">${t.pct > 0 ? '+' : ''}${t.pct}%</b></div>`).join('');
    openModal('brief', `
      <h2>☀️ Morning briefing · Day ${v.day} of ${v.settings.days}<small>Market opens soon</small></h2>
      <div class="m-grid">
        <div class="m-box"><h3>MACRO NEWS</h3><div class="macro-big">${esc(v.macro.h)}</div><div class="fx">${fxChips(v.macro.fx)}</div></div>
        <div class="m-box"><h3>YOUR SECRET TIPS (only you can see these)</h3>${tips}<div class="hint">Rumours may turn out false. Everyone's tips move prices at the closing bell.</div></div>
        <div class="m-box" style="grid-column:1/-1"><h3>CORPORATE ACTIONS</h3>${corp}${ipo}</div>
      </div>
      <div class="m-foot"><span class="hint" id="m-wait">${waitingLine(v)}</span><button class="btn gold big" id="m-ready" data-m="ready">🔔 Open the market</button></div>`);
  }

  function summaryModal(v, me) {
    const s = v.summary;
    const myPl = s.pl[me.id] || 0;
    const top = s.movers.slice(0, 3), bot = s.movers.slice(-3).reverse();
    const mv = (m) => `<div class="mv"><b>${m.tk}</b><span class="flat">₹${px(m.from)} → ₹${px(m.to)}</span><b class="${cls(m.pct)}">${sgn(m.pct)}%</b></div>`;
    const tips = s.tips.map((t) => `<div class="mv"><b>${t.tk}</b><span>${esc(t.who)}${t.rumor ? (t.truth ? ' · rumour TRUE' : ' · <s>rumour false</s>') : ''}</span><b class="${t.truth ? (t.pct > 0 ? 'up' : 'down') : 'flat'}">${t.pct > 0 ? '+' : ''}${t.pct}%</b></div>`).join('');
    let ipo = '';
    if (s.ipo) {
      const a = s.ipo.allot[me.id];
      ipo = `<div class="newsi ipo">${esc(s.ipo.name)} IPO subscribed <b>${s.ipo.sub.toFixed(1)}x</b>. ${a ? (a.lots ? `🎉 You got ${a.lots} of ${a.applied} lots (${a.shares} shares)!` : `😕 No allotment for your ${a.applied} lots. Money refunded.`) : 'You did not apply.'}</div>`;
    }
    const ev = s.events.map((e) => `<div class="newsi">${esc(e)}</div>`).join('');
    openModal('summary', `
      <h2>🔔 Closing bell · Day ${s.day}<small>Your day: <b class="${cls(myPl)}">${myPl >= 0 ? '+' : '-'}${rs(Math.abs(myPl))}</b></small></h2>
      <div class="m-grid">
        <div class="m-box"><h3>TOP GAINERS</h3>${top.map(mv).join('')}<h3 style="margin-top:8px">TOP LOSERS</h3>${bot.map(mv).join('')}</div>
        <div class="m-box"><h3>ALL TIPS REVEALED</h3><div style="max-height:150px;overflow:auto">${tips}</div></div>
        ${ipo || ev ? `<div class="m-box" style="grid-column:1/-1">${ipo}${ev}</div>` : ''}
      </div>
      <div class="m-foot"><span class="hint" id="m-wait">${waitingLine(v)}</span><button class="btn gold big" id="m-ready" data-m="ready">Next day ▶</button></div>`);
  }

  const TITLES = [
    [p => p.worth >= 3e6, '🏆 Market Wizard'], [p => p.worth >= 2e6, '🐂 Bull of the Street'],
    [p => p.worth >= 1.4e6, '📈 Smart Investor'], [p => p.worth >= 1e6, '🙂 Steady Saver'], [() => true, '🐻 Bear Survivor'],
  ];
  function finalModal(v, me) {
    const f = v.final;
    const rank = f.findIndex((x) => x.id === me.id) + 1;
    const mine = f[rank - 1];
    const title = TITLES.find(([t]) => t(mine))[1];
    const best = store.get('br.best', 0);
    if (!UI.ctrl.online && mine.worth > best) store.set('br.best', mine.worth);
    if (rank === 1) BR.sfx('win');
    const order = [f[1], f[0], f[2]].filter(Boolean);
    const pod = order.map((p) => `<div class="pod p${f.indexOf(p) + 1}"><div class="av">${esc(p.avatar || '🙂')}</div><b>${esc(p.name)}</b><small>${rs(p.worth)}</small><div>#${f.indexOf(p) + 1}</div></div>`).join('');
    const rest = f.slice(3).map((p, i) => `<div class="kv"><span>#${i + 4} ${esc(p.name)}</span><b>${rs(p.worth)}</b></div>`).join('');
    const gain = pct(mine.worth, v.settings.startCash);
    openModal('final', `
      <h2>${rank === 1 ? '🏆 You won!' : `You finished #${rank}`}<small>${title}</small></h2>
      <div class="podium">${pod}</div>${rest}
      <div class="m-grid"><div class="m-box"><h3>YOUR RESULT</h3><div class="macro-big">${rs(mine.worth)} <span class="${cls(gain)}">(${sgn(gain, 1)}%)</span></div>
      <div class="hint">Best ever: ${rs(Math.max(best, mine.worth))}</div></div>
      <div class="m-box"><h3>NET WORTH RACE</h3><canvas id="race2" style="width:100%;height:70px"></canvas></div></div>
      <div class="m-foot"><button class="btn" data-m="quit">Main menu</button>${UI.ctrl.online ? '' : '<button class="btn gold big" data-m="again">Play again</button>'}</div>`);
    setTimeout(() => {
      const cv = $('#race2');
      if (cv) BR.worthChart(cv, v.players.map((p) => ({ color: p.color || '#8fa3d6', me: p.id === me.id, pts: p.worth })));
    }, 50);
  }

  function bankModal(v, me, refresh) {
    const amts = [[10000, '10K'], [50000, '50K'], [100000, '1L'], [500000, '5L'], [-1, 'MAX']];
    const R = BR.RULES;
    const html = `
      <h2>🏦 Rush Bank<small>Interest is charged / paid at every closing bell</small></h2>
      <div class="m-grid">
        <div class="m-box"><h3>LOAN · ${(R.loanRate * 100).toFixed(1)}% per day</h3>
          <div class="bank-row"><span>Outstanding loan</span><b class="down">${rs(me.loan)}</b></div>
          <div class="bank-row"><span>You can still borrow</span><b>${rs(U.loanLimit(v, me))}</b></div>
          <div class="hint">Limit = ₹2L + 50% of your shares and deposits. If the loan goes above 80% of everything you own, the bank sells your shares (margin call).</div></div>
        <div class="m-box"><h3>FIXED DEPOSIT · ${(R.fdRate * 100).toFixed(1)}% per day</h3>
          <div class="bank-row"><span>Cash in hand</span><b>${rs(me.cash)}</b></div>
          <div class="bank-row"><span>Deposit</span><b class="up">${rs(me.fd)}</b></div>
          <div class="hint">Safe, steady and boring. Withdraw any time.</div></div>
      </div>
      <div class="amt-chips">${amts.map(([a, l]) => `<button class="chip${UI.bankAmt === a ? ' on' : ''}" data-m="amt:${a}">${l}</button>`).join('')}</div>
      <div class="m-foot">
        <button class="btn" data-m="bank:loan">Borrow</button><button class="btn" data-m="bank:repay">Repay</button>
        <button class="btn" data-m="bank:fdIn">Deposit</button><button class="btn" data-m="bank:fdOut">Withdraw</button>
        <button class="btn gold" data-m="close">Done</button></div>`;
    if (refresh && UI.modal !== 'bank') return;
    if (refresh) $('#modal-card').innerHTML = html; else openModal('bank', html);
  }

  function powerModal(v, me, key) {
    const d = BR.POWERS[key];
    const c = U.company(v, UI.sel);
    let body, btn;
    if (d.target === 'stock') {
      const ok = c.status === 'active' && (key !== 'SHIELD' || me.hold[c.tk]);
      body = `<p>${d.desc}</p><p>Target: <b>${c.logo} ${esc(c.name)}</b> (the stock selected on the left).</p>${ok ? '' : '<p class="down">Select a trading stock' + (key === 'SHIELD' ? ' that you hold' : '') + ' first.</p>'}`;
      btn = ok ? `<button class="btn gold" data-m="power:${key}:${c.tk}">Play on ${c.tk}</button>` : '';
    } else {
      body = `<p>${d.desc}</p>`;
      btn = `<button class="btn gold" data-m="power:${key}">Play card</button>`;
    }
    openModal('power', `<h2>${d.icon} ${d.name}</h2>${body}<div class="m-foot"><button class="btn" data-m="close">Cancel</button>${btn}</div>`, true);
  }

  function menuModal() {
    openModal('menu', `<h2>☰ Menu</h2>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button class="btn gold" data-m="close">Resume</button>
        <button class="btn" data-m="howto">📘 How to play</button>
        <button class="btn" data-m="sound">${BR.sound.on ? '🔊 Sound on' : '🔇 Sound off'}</button>
        <button class="btn red" data-m="quit">Quit to main menu${UI.ctrl && !UI.ctrl.online ? ' (progress saved each day)' : ''}</button>
      </div>`, true);
  }

  function modalAlert(title, msg) {
    openModal('alert', `<h2>${esc(title)}</h2><p>${esc(msg)}</p><div class="m-foot"><button class="btn gold" data-m="quit">Main menu</button></div>`, true);
  }

  let toastT;
  function toast(msg, kind) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast show ' + (kind || '');
    clearTimeout(toastT);
    toastT = setTimeout(() => (t.className = 'toast'), 1800);
  }

  // back to the game from "How to play"
  document.addEventListener('click', (e) => {
    if (UI.returnToGame && e.target.closest('#scr-howto [data-go]')) {
      e.stopImmediatePropagation();
      UI.returnToGame = false;
      show('game');
    }
  }, true);

  // Android back button
  window.onAndroidBack = function () {
    if (UI.modal) { if (closeModal()) return 'ok'; return 'ok'; }
    if (UI.screen === 'game') { menuModal(); return 'ok'; }
    if (UI.screen === 'howto' && UI.returnToGame) { UI.returnToGame = false; show('game'); return 'ok'; }
    if (UI.screen !== 'title') { show('title'); return 'ok'; }
    return 'exit';
  };

  const HOWTO = `
    <h4>🎯 Goal</h4><p>Start with ₹10 lakh. After the last trading day, the player with the highest <b>net worth</b> (cash + shares + deposits − loans) wins.</p>
    <h4>📅 A trading day</h4><ul><li><b>Morning briefing:</b> one macro news story, corporate actions and your <b>3 secret tips</b>.</li>
    <li><b>Market open</b> (timer): buy and sell freely. Prices tick live and slowly start to reflect what everyone knows.</li>
    <li><b>Closing bell:</b> all tips from all players hit the price at once. Every tip is revealed.</li></ul>
    <h4>🕵️ Secret tips</h4><p>Each tip says a stock will rise or fall by a set %. A tip marked <b>RUMOUR</b> may be false. Your rivals hold different tips, so watch the price action for clues.</p>
    <h4>📊 Real-market rules</h4><ul><li>Big orders move the price against you (market impact).</li><li>0.1% brokerage on every trade.</li>
    <li>Stocks cannot move more than <b>±20%</b> in a day (circuit limit).</li><li>A stock under ₹10 goes insolvent and its shares are cancelled.</li></ul>
    <h4>🏢 Corporate actions</h4><ul><li><b>Dividend:</b> cash per share at the close.</li><li><b>Bonus 1:1 / Split 1:5:</b> more shares, lower price, same value.</li>
    <li><b>Rights issue:</b> buy 1 new share for every 5 at a discount.</li><li><b>Buyback:</b> sell up to 25% of your shares back at a premium.</li><li><b>Regulator probe:</b> trading frozen for the day and the price usually falls.</li></ul>
    <h4>🚀 IPOs</h4><p>New companies go public during the game. Apply for lots while the market is open. Watch the subscription meter and grey market premium. If the IPO is oversubscribed, lots are given by lottery and the rest is refunded. It lists the next morning, sometimes with a big pop, sometimes with a flop.</p>
    <h4>🏦 Rush Bank</h4><p>Borrow against your shares at 1.5% per day, or park cash in a fixed deposit at 0.6% per day. Too much debt triggers a margin call.</p>
    <h4>🃏 Power cards</h4><p>Bull Charge, Bear Raid, Insider Peek and Stop-Loss Shield. Play one per day. You earn a new card every 3 days.</p>
    <h4>🌐 Online</h4><p>One player hosts a room and shares the code. Up to 6 traders, bots can fill empty seats.</p>`;

  setupScreens();
  show('title');
})(window.BR = window.BR || {});
