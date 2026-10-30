// Bull Rush UI (v4): screens, the table, cards, modals, effects and the main loop.
(function (BR) {
  const U = BR.util;
  const R = BR.RULES;
  const $ = (q) => document.querySelector(q);
  const $$ = (q) => Array.from(document.querySelectorAll(q));
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rs = (n) => (n < 0 ? '-₹' : '₹') + U.fmt(Math.abs(n));
  const cls = (x) => (x > 0 ? 'up' : x < 0 ? 'down' : 'flat');
  const sgn = (x) => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x);
  const kq = (q) => (q >= 1000 ? (q / 1000).toLocaleString('en-IN', { maximumFractionDigits: 1 }) + 'K' : String(q));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };
  const SAVE = 'br.save4';

  const UI = { ctrl: null, modal: null, phaseKey: '', blocks: 1, ipoBlocks: 1, renderKey: '', bankAmt: R.loanStep, timers: [] };
  BR.UI = UI;

  // ---------------------------------------------------------------- logos
  // Every company gets a random badge (shape, initials, stripe) so no two games look alike.
  function starPts(n, ro, ri) {
    const p = [];
    for (let i = 0; i < n * 2; i++) {
      const a = (Math.PI * i) / n - Math.PI / 2, r = i % 2 ? ri : ro;
      p.push((20 + r * Math.cos(a)).toFixed(1) + ',' + (20 + r * Math.sin(a)).toFixed(1));
    }
    return p.join(' ');
  }
  const SHAPE = {
    circle: '<circle cx="20" cy="20" r="18"/>',
    hex: '<polygon points="20,2 36,11 36,29 20,38 4,29 4,11"/>',
    diamond: '<polygon points="20,1 39,20 20,39 1,20"/>',
    shield: '<path d="M20 2 L36 8 V20 C36 30 28 36 20 39 C12 36 4 30 4 20 V8 Z"/>',
    square: '<rect x="3" y="3" width="34" height="34" rx="9"/>',
    star: `<polygon points="${starPts(8, 19, 15)}"/>`,
    drop: '<path d="M20 2 C30 13 36 20 36 26 A16 13 0 0 1 4 26 C4 20 10 13 20 2 Z"/>',
    leaf: '<path d="M5 35 C5 14 17 4 36 4 C36 25 26 36 5 35 Z"/>',
  };
  function logo(c, size) {
    const m = c.mark || { shape: 'circle', letters: c.tk.slice(0, 2), tilt: 0, ring: false };
    const sh = SHAPE[m.shape] || SHAPE.circle;
    return `<svg class="logo-svg" viewBox="0 0 40 40" width="${size || 30}" height="${size || 30}" aria-hidden="true">
      <g fill="${c.color}" stroke="rgba(40,20,5,.55)" stroke-width="2">${sh}</g>
      <clipPath id="cl-${c.tk}">${sh}</clipPath>
      <g clip-path="url(#cl-${c.tk})"><rect x="-10" y="16" width="60" height="7" fill="#fff" opacity=".22" transform="rotate(${m.tilt * 45 - 45} 20 20)"/>
      <ellipse cx="14" cy="10" rx="10" ry="5" fill="#fff" opacity=".3"/></g>
      ${m.ring ? '<circle cx="20" cy="20" r="12.5" fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="3 2" opacity=".75"/>' : ''}
      <text x="20" y="25" text-anchor="middle" font-size="13" font-weight="900" font-family="system-ui,sans-serif" fill="#fff" stroke="rgba(40,20,5,.6)" stroke-width="2.4" paint-order="stroke">${esc(m.letters)}</text>
    </svg>`;
  }
  function spark(hist, w, h, empty) {
    const pts = hist.slice(-10);
    if (pts.length < 2) return empty ? `<div class="spark-empty">${empty}</div>` : `<svg class="spark" viewBox="0 0 ${w} ${h}"></svg>`;
    const lo = Math.min(...pts), hi = Math.max(...pts) || 1, span = Math.max(1, hi - lo);
    const xy = pts.map((v, i) => `${((i / (pts.length - 1)) * (w - 4) + 2).toFixed(1)},${(h - 3 - ((v - lo) / span) * (h - 6)).toFixed(1)}`);
    const col = pts[pts.length - 1] >= pts[0] ? '#12a46e' : '#e5304f';
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${xy.join(' ')}" fill="none" stroke="${col}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
  }

  // ---------------------------------------------------------------- screens
  let rainT = null;
  function show(id) {
    $$('.screen').forEach((s) => { s.classList.toggle('active', s.id === 'scr-' + id); });
    UI.screen = id;
    if (id === 'title') { startRain(); renderHome(); $('#btn-continue').classList.toggle('hidden', !store.get(SAVE, null)); } else stopRain();
  }
  function startRain() {
    if (rainT) return;
    const box = $('#coin-rain');
    const drop = () => {
      if (document.hidden || box.childElementCount > 26) return;
      const k = document.createElement('i');
      const big = Math.random() < 0.3;
      k.className = Math.random() < 0.3 ? 'bill' : 'coin';
      k.textContent = k.className === 'coin' ? '₹' : '';
      k.style.left = Math.random() * 100 + '%';
      k.style.animationDuration = (4 + Math.random() * 4) + 's';
      k.style.setProperty('--s', big ? 1.3 : 0.8 + Math.random() * 0.3);
      k.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg');
      k.addEventListener('animationend', () => k.remove());
      box.appendChild(k);
    };
    for (let i = 0; i < 6; i++) setTimeout(drop, i * 200);
    rainT = setInterval(drop, 380);
  }
  function stopRain() { clearInterval(rainT); rainT = null; const b = $('#coin-rain'); if (b) b.innerHTML = ''; }

  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (go) { BR.sfx('tap'); show(go.dataset.go); }
  });

  function chips(el) {
    const opts = el.dataset.opts.split(',');
    const labels = el.dataset.labels ? el.dataset.labels.split(',') : opts;
    el.innerHTML = opts.map((o, i) => `<button class="chip${o === el.dataset.val ? ' on' : ''}" data-v="${o}">${labels[i]}</button>`).join('');
    el.addEventListener('click', (e) => {
      const b = e.target.closest('.chip');
      if (!b) return;
      BR.sfx('tap');
      el.dataset.val = b.dataset.v;
      el.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === b));
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
      BR.sfx('tap');
      av.dataset.val = b.dataset.v; av.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === b));
    });
    ['#pick-bots', '#pick-skill', '#pick-cos', '#pick-days', '#pick-len', '#pick-cos-on', '#pick-days-on', '#pick-len-on'].forEach((q) => chips($(q)));
    $('#btn-start').onclick = startOffline;
    $('#btn-continue').onclick = continueSaved;
    $('#btn-quick').onclick = quickGame;
    $('#btn-stats').onclick = () => { BR.sfx('tap'); statsModal(); };
    $('#btn-settings').onclick = () => { BR.sfx('tap'); settingsModal(); };
    applyPrefs();
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
      send(a) { return BR.act(this.s, me, a); },
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
    const s = BR.createGame({ rounds: +$('#pick-days').dataset.val, turns: +$('#pick-len').dataset.val, companies: +$('#pick-cos').dataset.val }, roster);
    begin(LocalCtrl(s, 'me'));
  }

  function quickGame() {
    BR.sfx('tap');
    $('#pick-bots').dataset.val = '3'; $('#pick-days').dataset.val = '6'; $('#pick-len').dataset.val = '3'; $('#pick-skill').dataset.val = 'normal'; $('#pick-cos').dataset.val = '8';
    startOffline();
  }

  // ---------------------------------------------------------------- home: profile, stats, settings, tips
  const prefs = () => Object.assign({ vib: true, speed: 'normal' }, store.get('br.prefs', {}));
  const SPEEDS = { relaxed: [2.6, 4.6], normal: [1.8, 3.6], fast: [0.7, 1.4] };
  function applyPrefs() { R.botThink = SPEEDS[prefs().speed] || SPEEDS.normal; }
  const stats = () => Object.assign({ played: 0, wins: 0, best: 0, podium: 0 }, store.get('br.stats', {}));
  const TIPS = [
    'Tip: watch the 📜 Trades list. A rival buying big usually holds good cards.',
    'Tip: hold 20,000 shares to become Co-owner and cancel the worst minus card.',
    'Tip: a 🛟 Safety Net plus a big holding is a fearless combo.',
    'Tip: cheap stocks crash to ₹0 fast. Spread your money if your cards are mixed.',
    'Tip: borrow before a sure rise, repay right after. Interest is 5% per round.',
    'Tip: reach ₹1 Cr and you can list your own company.',
    'Tip: 🕵️ Insider Tip shows the hidden market cards nobody else can see.',
    'Tip: tap any player to see what they own and their latest moves.',
  ];
  function renderHome() {
    const pr = store.get('br.profile', { name: 'Trader', avatar: BR.AVATARS[0] });
    const st = stats();
    $('#profile-strip').innerHTML = `<span class="ps-av">${esc(pr.avatar || '🦁')}</span><span class="ps-name"><b>${esc(pr.name || 'Trader')}</b><small>${st.played ? `${st.wins} wins · ${st.played} games` : 'New trader'}</small></span>${st.best ? `<span class="ps-best"><small>BEST</small>${rs(st.best)}</span>` : ''}`;
    $('#tip-line').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
  }
  function statsModal() {
    const st = stats();
    const rate = st.played ? Math.round(st.wins / st.played * 100) : 0;
    openModal('stats', `<h2>🏆 Your stats<button class="x" data-m="close">✕</button></h2>
      <div class="stat-grid">
        <div><small>Games played</small><b>${st.played}</b></div><div><small>Wins</small><b>${st.wins} (${rate}%)</b></div>
        <div><small>Top 3 finishes</small><b>${st.podium}</b></div><div><small>Best net worth</small><b>${rs(st.best)}</b></div>
      </div>
      <div class="m-foot"><button class="btn red ghosty" data-m="resetstats">Reset stats</button><button class="btn gold" data-m="close">Close</button></div>`, true);
  }
  function settingsModal() {
    const p = prefs();
    const row = (label, key, opts) => `<div class="set-row"><span>${label}</span><div class="chips">${opts.map(([v, l]) => `<button class="chip${String(p[key]) === String(v) ? ' on' : ''}" data-m="pref:${key}:${v}">${l}</button>`).join('')}</div></div>`;
    openModal('settings', `<h2>⚙️ Settings<button class="x" data-m="close">✕</button></h2>
      <div class="set-row"><span>Sound effects</span><div class="chips"><button class="chip${BR.sound.on ? ' on' : ''}" data-m="snd:on">On</button><button class="chip${BR.sound.on ? '' : ' on'}" data-m="snd:off">Off</button></div></div>
      ${row('Vibration', 'vib', [[true, 'On'], [false, 'Off']])}
      ${row('Bot speed', 'speed', [['relaxed', 'Relaxed'], ['normal', 'Normal'], ['fast', 'Fast']])}
      <p class="hint">Bot speed is how long computer players think before each move.</p>
      <div class="m-foot"><button class="btn gold" data-m="close">Done</button></div>`, true);
  }

  function continueSaved() {
    const sv = store.get(SAVE, null);
    if (sv) begin(LocalCtrl(sv, 'me'));
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
      host.start({ rounds: +$('#pick-days-on').dataset.val, turnTime: +$('#pick-len-on').dataset.val, companies: +$('#pick-cos-on').dataset.val });
      begin({
        local: true, online: true, me: 'host',
        view() { return host.game; },
        send(a) { const e = BR.act(host.game, 'host', a); host.flush(true); return e; },
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
          send(a) { cl.send(a); return null; },
          quit() { cl.close(); },
        });
      },
      onState() { UI.dirty = true; },
      onActError(m) { toast(m, 'err'); BR.sfx('err'); },
      onError(m) {
        toast(m, 'err');
        if (started) modalAlert('Connection lost', m);
        else { $('#online-home').classList.remove('hidden'); $('#online-lobby').classList.add('hidden'); }
      },
    });
    UI.client = cl;
  }

  function renderLobby(list) {
    $('#lobby-list').innerHTML = list.map((p) => `<li>${esc(p.avatar || '🙂')} ${esc(p.name)}${p.bot ? ' <small class="flat">bot</small>' : ''}</li>`).join('');
  }

  // ---------------------------------------------------------------- loop
  let raf = null, last = 0, acc = 0;
  function begin(ctrl) {
    UI.ctrl = ctrl;
    UI.phaseKey = ''; UI.renderKey = ''; UI.foundTold = false; UI.statsSaved = false; UI.lastSeat = null; UI.tradeSig = null; UI.prevCash = null; UI.roundSplash = 0; UI.handHtml = '';
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
    acc += dt;
    const v = c.view();
    if (v && (acc > 0.15 || UI.dirty)) {
      acc = 0; UI.dirty = false;
      render(v);
    }
    raf = requestAnimationFrame(loop);
  }
  function quitGame() {
    if (UI.ctrl && UI.ctrl.quit) UI.ctrl.quit();
    UI.ctrl = null;
    cancelAnimationFrame(raf);
    clearTimers();
    closeModal(true);
    show('title');
  }
  const meP = (v) => v.players.find((p) => p.id === UI.ctrl.me);
  const myTurn = (v) => v.phase === 'turns' && v.players[v.seat].id === UI.ctrl.me;
  function clearTimers() { UI.timers.forEach(clearTimeout); UI.timers = []; }
  function later(fn, ms) { UI.timers.push(setTimeout(fn, ms)); }

  function render(v) {
    const me = meP(v);
    if (!me) return;
    phaseModals(v, me);
    const seatKey = v.phase + v.round + ':' + v.pass + ':' + v.seat;
    if (seatKey !== UI.lastSeat) {
      UI.lastSeat = seatKey;
      if (myTurn(v)) {
        const wait = document.querySelector('.banner.round') ? 1300 : 0;
        later(() => { BR.sfx('turn'); banner('⭐ Your turn!', 'mine'); }, wait);
        if (navigator.vibrate && prefs().vib) try { navigator.vibrate(60); } catch (e) { /* ignore */ }
      }
    }
    // only rebuild the DOM when something visible changed
    const key = v.v + ':' + (v.settings.turnTime ? Math.ceil(v.timeLeft) : '');
    if (key !== UI.renderKey) {
      UI.renderKey = key;
      renderTop(v, me);
      renderBoard(v, me);
      renderSeats(v, me);
      renderHand(v, me);
      activity(v, me);
      cashFx(me);
      if (!UI.foundTold && U.canFound(v, me)) { UI.foundTold = true; later(() => { banner('🏢 ₹1 Cr club!<small>Tap "My company" on your turn to list it</small>', 'gold'); BR.sfx('bonus'); }, 1600); }
      if (UI.modal === 'bank') bankModal(v, me, true);
      if (UI.modal === 'trade') tradeModal(v, me, UI.tradeTk, true);
      if (UI.modal === 'player') playerModal(v, me, UI.playerId, true);
      if (UI.modal === 'reveal') updateWaiting(v, me);
    }
  }

  // ---------------------------------------------------------------- table
  function renderTop(v, me) {
    $('#tb-day').textContent = v.settings.rounds ? `${v.round}/${v.settings.rounds}` : `${v.round}/∞`;
    const t = $('#tb-turn');
    const cur = v.players[v.seat];
    if (v.phase === 'turns') {
      const timer = v.settings.turnTime ? ` · ${Math.max(0, Math.ceil(v.timeLeft))}s` : '';
      t.innerHTML = myTurn(v) ? `⭐ Your turn!${timer}` : `${esc(cur.avatar)} ${esc(cur.name)} is thinking<span class="dots"></span>${timer}`;
      t.className = 'tb-turn' + (myTurn(v) ? ' mine' : '');
    } else {
      t.textContent = v.phase === 'ended' ? '🏁 Game over' : '🃏 Big reveal!';
      t.className = 'tb-turn';
    }
    $('#tb-cash').textContent = rs(me.cash);
    const w = U.netWorth(v, me);
    $('#tb-worth').textContent = rs(w);
    const wc = ((w / v.settings.startCash) - 1) * 100;
    const we = $('#tb-worth-chg'); we.textContent = (wc >= 0 ? '+' : '') + wc.toFixed(0) + '%'; we.className = cls(Math.round(wc));
  }

  function holdersOf(v, c) {
    return v.players.filter((p) => p.hold[c.tk]).map((p) => ({ p, q: p.hold[c.tk] })).sort((a, b) => b.q - a.q);
  }

  function renderBoard(v, me) {
    const el = $('#board');
    const list = v.companies;
    el.style.setProperty('--cols', Math.ceil(list.length / (list.length > 10 ? 3 : 2)));
    el.dataset.n = list.length;
    const playsOn = {};
    for (const x of v.plays) if (x.tk && (!x.secret || x.pid === me.id)) (playsOn[x.tk] = playsOn[x.tk] || []).push(BR.SPECIALS[x.sp].icon);
    const now = Date.now();
    el.innerHTML = list.map((c) => {
      const price = U.priceOf(c);
      const own = c.status === 'active' && U.ownerOf(v, c);
      const hs = holdersOf(v, c);
      const chipsH = hs.slice(0, 3).map(({ p, q }) => `<span class="hc${p.id === me.id ? ' me' : ''}" style="--pc:${p.color}">${esc(p.avatar)}${kq(q)}</span>`).join('') + (hs.length > 3 ? `<span class="hc more">+${hs.length - 3}</span>` : '');
      const stamp = c.status === 'bankrupt' ? '<div class="d-stamp">💥 BANKRUPT</div>' : '';
      const ping = UI.ping && UI.ping[c.tk] > now ? ' ping' : '';
      const left = c.status === 'active' ? U.available(v, c) : 0;
      return `<div class="deed${c.status === 'bankrupt' ? ' dead' : ''}${c.status === 'ipo' ? ' ipo' : ''}${me.hold[c.tk] ? ' mine' : ''}${ping}" style="--c:${c.color}" data-tile="${c.tk}">
        <div class="d-band">${logo(c, 26)}<div class="d-id"><b>${c.founder ? '🏢' : ''}${c.tk}</b><small>${esc(c.name)}</small></div>
          ${own ? `<span class="d-own" title="${own.rank === 'owner' ? 'Owner' : 'Co-owner'}">${own.rank === 'owner' ? '👑' : '🎩'}${esc(own.p.avatar)}</span>` : ''}</div>
        <div class="d-body">
          <div class="d-row"><span class="d-px">₹${price}</span>${c.status === 'ipo' ? '<span class="d-chg ipo">🚀 IPO</span>' : c.last ? `<span class="d-chg ${cls(c.last)}">${c.last > 0 ? '▲' : '▼'}${Math.abs(c.last)}</span>` : ''}</div>
          ${c.status === 'ipo' ? `<div class="d-ipo">Apply now · ${v.ipo ? v.ipo.blocks : ''} blocks</div>` : spark(c.history, 100, 22)}
          <div class="d-hold">${chipsH || `<span class="hc none">${c.status === 'active' ? kq(left) + ' left' : ''}</span>`}</div>
        </div>
        ${playsOn[c.tk] ? `<span class="d-plays">${playsOn[c.tk].join('')}</span>` : ''}
        ${stamp}
      </div>`;
    }).join('');
  }

  const VERB = {
    buy: (t) => ({ ic: '🟢', txt: `Bought ${kq(t.qty)} ${t.tk}`, c: 'up' }),
    sell: (t) => ({ ic: '🔴', txt: `Sold ${kq(t.qty)} ${t.tk}`, c: 'down' }),
    apply: (t) => ({ ic: '🚀', txt: `Applied ${kq(t.qty)} ${t.tk} IPO`, c: 'ipo' }),
    ipo: (t) => ({ ic: '🚀', txt: `Got ${kq(t.qty)} ${t.tk} (${t.note})`, c: 'ipo' }),
    rights: (t) => ({ ic: '🎟', txt: `Rights +${kq(t.qty)} ${t.tk}`, c: 'up' }),
    gold: (t) => ({ ic: '✨', txt: `${t.note}${t.tk ? ' on ' + t.tk : ''}`, c: 'gold' }),
    div: (t) => ({ ic: '💰', txt: `Dividend from ${t.tk}`, c: 'up' }),
    loan: (t) => ({ ic: '🏦', txt: `Borrowed ${rs(t.px)}`, c: 'flat' }),
    repay: (t) => ({ ic: '🏦', txt: `Repaid ${rs(t.px)}`, c: 'flat' }),
    fd: (t) => ({ ic: '🔐', txt: `${t.note === 'deposit' ? 'Deposited' : 'Withdrew'} ${rs(t.px)}`, c: 'flat' }),
    margin: (t) => ({ ic: '⚠️', txt: `Bank sold ${kq(t.qty)} ${t.tk}`, c: 'down' }),
    found: (t) => ({ ic: '🏢', txt: `Founded ${t.note} (${t.tk})`, c: 'gold' }),
    raise: (t) => ({ ic: '🏢', txt: `Raised ${rs(t.qty * t.px)} in ${t.tk} IPO`, c: 'up' }),
    tax: (t) => ({ ic: '🧾', txt: `Paid ${rs(t.px)} tax`, c: 'down' }),
    bonus: (t) => ({ ic: '🎁', txt: `Lucky bonus ${rs(t.px)}`, c: 'up' }),
    net: (t) => ({ ic: '🛟', txt: `Safety Net paid ${rs(t.qty * t.px)}`, c: 'up' }),
    pass: () => ({ ic: '✋', txt: 'Passed', c: 'flat' }),
  };
  const verb = (t) => (VERB[t.act] || VERB.pass)(t);

  function renderSeats(v, me) {
    const order = v.players.map((p) => ({ p, w: U.netWorth(v, p) })).sort((a, b) => b.w - a.w);
    const rank = {};
    order.forEach((r, i) => (rank[r.p.id] = i + 1));
    $('#seats').innerHTML = v.players.map((p, i) => {
      const turn = v.phase === 'turns' && v.seat === i;
      const nCards = p.id === me.id ? p.hand.length : (p.handCount !== undefined ? p.handCount : p.hand.length);
      const nGold = p.id === me.id ? p.gold.length : (p.goldCount !== undefined ? p.goldCount : p.gold.length);
      const la = p.lastAct && p.lastAct.r === v.round ? verb(p.lastAct) : null;
      const status = turn && p.id !== me.id ? '<span class="la think">thinking<span class="dots"></span></span>'
        : la ? `<span class="la ${la.c}">${la.ic} ${esc(la.txt)}</span>` : `<span class="la flat">🃏${nCards} · ✨${nGold}</span>`;
      return `<div class="seat${turn ? ' turn' : ''}${p.id === me.id ? ' me' : ''}" data-seat="${esc(p.id)}">
        <div class="av" style="--pc:${p.color}">${esc(p.avatar || '🙂')}<i class="rk">${rank[p.id]}</i></div>
        <div class="sn"><b>${esc(p.name)}${p.id === me.id ? ' (you)' : ''}${p.connected === false ? ' 📴' : ''}</b>${status}</div>
        <div class="w">${rs(U.netWorth(v, p))}${p.loan ? '<small>🏦 loan</small>' : ''}</div></div>`;
    }).join('');
    const box = $('#actbox');
    if (v.phase !== 'turns') { box.innerHTML = '<div class="act-tip">Round over. Check the reveal!</div>'; return; }
    const passLine = `Turn ${v.pass + 1} of ${v.settings.turns}`;
    const spyBtn = (me.spy ? `<button class="btn small" data-act="spy">🔍 ${esc(me.spy.who)}</button>` : '') + (me.tip ? '<button class="btn small" data-act="tip">🕵️ Tip</button>' : '');
    if (myTurn(v)) {
      box.innerHTML = `<div class="act-tip"><b>${passLine}</b> · tap a company to buy or sell, or play a ✨ card</div>
        <div class="act-btns">${spyBtn}${U.canFound(v, me) ? '<button class="btn gold" data-act="found">🏢 My company</button>' : ''}<button class="btn green" data-act="pass">✋ Pass</button></div>`;
    } else {
      const t = v.trades[0];
      const lastLine = t ? `${esc(t.avatar)} ${esc(verb(t).txt)}` : 'Watch what rivals buy and sell...';
      box.innerHTML = `<div class="act-tip"><b>${passLine}</b> · ${lastLine}</div><div class="act-btns">${spyBtn}</div>`;
    }
    if (UI.wantSpy && me.spy) { UI.wantSpy = false; spyModal(v, me); }
    if (UI.wantTip && me.tip) { UI.wantTip = false; tipModal(v, me); }
  }

  function priceCard(v, k, mini) {
    const c = U.company(v, k.tk);
    return `<div class="card${mini ? ' mini' : ''}" style="--c:${c ? c.color : '#999'}" data-card="${k.id}">
      <div class="band">${c ? logo(c, 16) : ''}<span>${k.tk}</span></div>
      <div class="val ${k.v > 0 ? 'up' : 'down'}">${sgn(k.v)}</div><div class="arrow">${k.v > 0 ? '▲ rise' : '▼ fall'}</div></div>`;
  }
  function renderHand(v, me) {
    const el = $('#hand');
    const gold = me.gold.map((k) => {
      const d = BR.SPECIALS[k.sp];
      return `<div class="card sp" data-gold="${k.id}"><div class="ic">${d.icon}</div><div class="nm">${d.name}</div></div>`;
    }).join('');
    const cards = me.hand.map((k) => priceCard(v, k)).join('');
    const html = (gold ? `<div class="hand-grp gold">${gold}</div>` : '') + (cards ? `<div class="hand-grp">${cards}</div>` : '<div class="hand-empty">No price cards</div>');
    // rebuilding identical cards restarts their shine and deal animations, which looks like lag
    if (html !== UI.handHtml) { UI.handHtml = html; el.innerHTML = html; }
  }

  // ---------------------------------------------------------------- effects
  function fxLayer() { return $('#fx'); }
  function banner(text, kind) {
    const b = document.createElement('div');
    b.className = 'banner ' + (kind || '');
    b.innerHTML = text;
    fxLayer().appendChild(b);
    setTimeout(() => b.remove(), 1500);
  }
  function floatText(x, y, text, kind) {
    const f = document.createElement('div');
    f.className = 'float ' + (kind || '');
    f.textContent = text;
    f.style.left = x + 'px'; f.style.top = y + 'px';
    fxLayer().appendChild(f);
    setTimeout(() => f.remove(), 1400);
  }
  // A stack of notes flies from `from` into the target and the number there bumps.
  function moneyFly(from, toSel, amt) {
    const target = $(toSel);
    if (!target || !target.animate) return;
    const to = target.getBoundingClientRect();
    const sx = from ? from.left + from.width / 2 : innerWidth / 2;
    const sy = from ? from.top + from.height / 2 : innerHeight / 2;
    const tx = to.left + to.width / 2, ty = to.top + to.height / 2;
    const n = Math.min(12, 4 + Math.floor(Math.log10(Math.max(10, amt))));
    for (let i = 0; i < n; i++) {
      const el = document.createElement('i');
      el.className = i % 3 === 2 ? 'fly coin' : 'fly note';
      el.style.left = sx + 'px'; el.style.top = sy + 'px';
      fxLayer().appendChild(el);
      const dx = tx - sx, dy = ty - sy, jx = (Math.random() - 0.5) * 120, jy = -40 - Math.random() * 80;
      const a = el.animate([
        { transform: `translate(-50%,-50%) scale(.3) rotate(${jx}deg)`, opacity: 0 },
        { transform: `translate(calc(-50% + ${jx}px), calc(-50% + ${jy}px)) scale(1.15) rotate(${-jx / 3}deg)`, opacity: 1, offset: 0.35 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.35) rotate(0deg)`, opacity: 0.6 },
      ], { duration: 800 + i * 40, delay: i * 65, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'both' });
      a.onfinish = () => {
        el.remove();
        if (i === n - 1) { target.classList.remove('bump'); void target.offsetWidth; target.classList.add('bump'); }
        if (i % 3 === 0) BR.sfx('tick');
      };
    }
    BR.sfx('cash');
    setTimeout(() => floatText(tx, ty + 18, '+' + rs(amt), 'up'), 800 + n * 65);
  }
  function cashFx(me) {
    const prev = UI.prevCash;
    UI.prevCash = me.cash;
    if (prev === null || prev === undefined) return;
    const d = me.cash - prev;
    if (d >= 1000) moneyFly(UI.flyFrom || null, '#tb-cash', d);
    else if (d <= -1000) { const r = $('#tb-cash').getBoundingClientRect(); floatText(r.left + r.width / 2, r.bottom + 6, '−' + rs(-d).replace('-', ''), 'down'); }
    UI.flyFrom = null;
  }
  function confetti() {
    const cols = ['#f5b700', '#12a46e', '#e5304f', '#5b8cff', '#b46cff', '#ff8a3d'];
    for (let i = 0; i < 70; i++) {
      const c = document.createElement('i');
      c.className = 'confetti';
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = cols[i % cols.length];
      c.style.animationDuration = 1.8 + Math.random() * 1.8 + 's';
      c.style.animationDelay = Math.random() * 0.6 + 's';
      c.style.setProperty('--r', Math.random() * 900 + 'deg');
      fxLayer().appendChild(c);
      setTimeout(() => c.remove(), 4400);
    }
  }
  // Rival moves show up as speech bubbles next to their seat.
  function activity(v, me) {
    const sigOf = (t) => t ? [t.r, t.pid, t.act, t.tk, t.qty, t.px, t.note].join('|') : '';
    const top = sigOf(v.trades[0]);
    const prev = UI.tradeSig;
    UI.tradeSig = top;
    if (prev === null || top === prev) return;
    const fresh = [];
    for (const t of v.trades.slice(0, 8)) { if (sigOf(t) === prev) break; fresh.push(t); }
    UI.ping = UI.ping || {};
    fresh.reverse().forEach((t, i) => {
      if (t.tk && (t.act === 'buy' || t.act === 'sell' || t.act === 'gold' || t.act === 'rights')) UI.ping[t.tk] = Date.now() + 1200;
      if (t.pid === me.id) return;
      setTimeout(() => bubble(t), i * 350);
    });
    if (fresh.some((t) => t.tk)) UI.renderKey = '';
  }
  function bubble(t) {
    const seat = document.querySelector(`.seat[data-seat="${CSS.escape(t.pid)}"]`);
    if (!seat || UI.screen !== 'game' || UI.modal) return;
    const r = seat.getBoundingClientRect();
    const vb = verb(t);
    const b = document.createElement('div');
    b.className = 'bubble ' + vb.c;
    b.innerHTML = `${vb.ic} ${esc(vb.txt)}${t.act === 'buy' || t.act === 'sell' ? ` <small>@₹${t.px}</small>` : ''}`;
    const side = r.left > innerWidth / 2;
    b.classList.add(side ? 'left' : 'below');
    if (side) { b.style.right = (innerWidth - r.left + 8) + 'px'; b.style.top = (r.top + r.height / 2) + 'px'; }
    else { b.style.left = Math.max(6, Math.min(innerWidth - 180, r.left)) + 'px'; b.style.top = (r.bottom + 6) + 'px'; }
    fxLayer().appendChild(b);
    BR.sfx(t.act === 'buy' ? 'buy' : t.act === 'sell' ? 'sell' : t.act === 'gold' ? 'power' : 'notify');
    setTimeout(() => b.remove(), 2600);
  }

  // ---------------------------------------------------------------- input
  document.addEventListener('click', (e) => {
    if (!UI.ctrl || UI.screen !== 'game' || e.target.closest('.modal')) return;
    const v = UI.ctrl.view();
    if (!v) return;
    const me = meP(v);
    const tile = e.target.closest('[data-tile]');
    if (tile) {
      const c = U.company(v, tile.dataset.tile);
      BR.sfx('tap');
      if (c.status === 'ipo') ipoModal(v, me); else tradeModal(v, me, c.tk);
      return;
    }
    const g = e.target.closest('[data-gold]');
    if (g) { const k = me.gold.find((x) => x.id === g.dataset.gold); BR.sfx('card'); if (k) specialModal(v, me, k); return; }
    const card = e.target.closest('[data-card]');
    if (card) {
      const k = me.hand.find((x) => x.id === card.dataset.card);
      BR.sfx('card');
      if (k) { const c = U.company(v, k.tk); if (c && c.status !== 'bankrupt') (c.status === 'ipo' ? ipoModal(v, me) : tradeModal(v, me, c.tk)); }
      return;
    }
    const seat = e.target.closest('[data-seat]');
    if (seat) { BR.sfx('tap'); playerModal(v, me, seat.dataset.seat); return; }
    const act = e.target.closest('[data-act]');
    if (act && act.dataset.act === 'pass') { BR.sfx('tap'); send({ type: 'pass' }); }
    if (act && act.dataset.act === 'spy') spyModal(v, me);
    if (act && act.dataset.act === 'tip') tipModal(v, me);
    if (act && act.dataset.act === 'found') { BR.sfx('power'); foundModal(v, me); }
  });

  function send(a, okMsg) {
    const err = UI.ctrl.send(a);
    if (err) { toast(err, 'err'); BR.sfx('err'); return false; }
    if (okMsg) toast(okMsg, 'ok');
    UI.dirty = true;
    return true;
  }

  const view = () => UI.ctrl && UI.ctrl.view();
  $('#btn-bank').onclick = () => { const v = view(); if (v) { BR.sfx('tap'); bankModal(v, meP(v)); } };
  $('#btn-dash').onclick = () => { const v = view(); if (v) { BR.sfx('tap'); dashModal(v, meP(v)); } };
  $('#btn-log').onclick = () => { const v = view(); if (v) { BR.sfx('tap'); UI.logFilter = 'all'; logModal(v, meP(v)); } };
  $('#btn-menu').onclick = () => { BR.sfx('tap'); menuModal(); };

  // ---------------------------------------------------------------- modals
  function openModal(kind, html, narrow) {
    UI.modal = kind;
    $$('#fx .bubble').forEach((b) => b.remove());
    $('#modal-card').className = 'modal-card' + (narrow ? ' narrow' : '') + ' m-' + kind;
    $('#modal-card').innerHTML = html;
    $('#modal').classList.remove('hidden');
  }
  function closeModal(force) {
    if (!force && (UI.modal === 'reveal' || UI.modal === 'final')) return false;
    UI.modal = null;
    $('#modal').classList.add('hidden');
    return true;
  }
  $('#modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal') { closeModal(); return; }
    const b = e.target.closest('[data-m]');
    if (!b || b.disabled) return;
    const k = b.dataset.m;
    const v = view();
    const me = v && meP(v);
    if (k !== 'buy' && k !== 'sell') BR.sfx('tap');
    if (k === 'close') closeModal(true);
    else if (k === 'ready') { UI.ctrl.send({ type: 'ready' }); UI.dirty = true; updateWaiting(v, me, true); }
    else if (k === 'final') finalModal(v, me);
    else if (k === 'quit') quitGame();
    else if (k === 'again') { quitGame(); show('setup'); }
    else if (k === 'howto') { closeModal(true); show('howto'); UI.returnToGame = true; }
    else if (k === 'sound') { BR.sound.toggle(); menuModal(); }
    else if (k === 'b+' || k === 'b-' || k === 'bmax') {
      const c = U.company(v, UI.tradeTk);
      const mx = Math.max(1, U.maxBlocks(v, me, c), (me.hold[c.tk] || 0) / R.block);
      UI.blocks = k === 'bmax' ? Math.max(1, U.maxBlocks(v, me, c)) : Math.max(1, Math.min(mx, UI.blocks + (k === 'b+' ? 1 : -1)));
      tradeModal(v, me, UI.tradeTk, true);
    } else if (k === 'buy' || k === 'sell') {
      const tile = document.querySelector(`[data-tile="${UI.tradeTk}"]`);
      UI.flyFrom = tile ? tile.getBoundingClientRect() : null;
      if (send({ type: k, tk: UI.tradeTk, blocks: k === 'sell' && b.dataset.all ? (me.hold[UI.tradeTk] || 0) / R.block : UI.blocks })) {
        BR.sfx(k); closeModal(true);
      }
    } else if (k === 'i+' || k === 'i-') {
      UI.ipoBlocks = Math.max(1, Math.min(R.ipoMaxBlocks, UI.ipoBlocks + (k === 'i+' ? 1 : -1)));
      ipoModal(v, me);
    } else if (k === 'ipo') {
      if (send({ type: 'ipo', blocks: UI.ipoBlocks }, `Applied for ${UI.ipoBlocks} IPO block(s)`)) { BR.sfx('coin'); closeModal(true); }
    } else if (k.startsWith('sp:')) {
      const [, card, tk] = k.split(':');
      const sp = (me.gold.find((x) => x.id === card) || {}).sp;
      if (send({ type: 'special', card, tk: tk || undefined })) {
        BR.sfx('power'); closeModal(true);
        if (sp) banner(`${BR.SPECIALS[sp].icon} ${BR.SPECIALS[sp].name}${tk ? ' on ' + tk : ''}!`, 'gold');
        if (UI.ctrl.local) { const nv = view(); const nm = meP(nv); if (sp === 'SPY' && nm.spy) spyModal(nv, nm); if (sp === 'TIP' && nm.tip) tipModal(nv, nm); } else if (sp === 'SPY') UI.wantSpy = true; else if (sp === 'TIP') UI.wantTip = true;
      }
    } else if (k.startsWith('amt:')) { UI.bankAmt = +k.slice(4); bankModal(v, me, true); }
    else if (k === 'loan' || k === 'repay' || k === 'fdIn' || k === 'fdOut') {
      if (k === 'loan' || k === 'fdOut') UI.flyFrom = b.getBoundingClientRect();
      if (send({ type: k, amt: UI.bankAmt })) BR.sfx(k === 'loan' || k === 'fdOut' ? 'coin' : 'tap');
      setTimeout(() => { const nv = view(); if (nv) bankModal(nv, meP(nv), true); }, UI.ctrl.local ? 0 : 400);
    } else if (k.startsWith('pl:')) playerModal(v, me, k.slice(3));
    else if (k.startsWith('lf:')) { UI.logFilter = k.slice(3); logModal(v, me); }
    else if (k.startsWith('co:')) { const c = U.company(v, k.slice(3)); if (c.status === 'ipo') ipoModal(v, me); else tradeModal(v, me, c.tk); }
    else if (k === 'skip') finishReveal(v, me, true);
    else if (k.startsWith('ext:')) {
      const by = +k.slice(4);
      const wasEnded = v.phase === 'ended';
      if (send({ type: 'extend', by })) {
        BR.sfx('bonus'); closeModal(true); UI.statsSaved = false;
        banner(`➕ ${by} more round${by > 1 ? 's' : ''}!`, 'gold');
        if (wasEnded) UI.phaseKey = '';
      }
    } else if (k === 'endgame') { if (send({ type: 'endgame' })) { closeModal(true); banner('🏁 Final round!', 'gold'); } }
    else if (k.startsWith('pref:')) { const [, key, val] = k.split(':'); const p = prefs(); p[key] = val === 'true' ? true : val === 'false' ? false : val; store.set('br.prefs', p); applyPrefs(); settingsModal(); }
    else if (k.startsWith('snd:')) { if (BR.sound.on !== (k === 'snd:on')) BR.sound.toggle(); BR.sfx('tap'); settingsModal(); }
    else if (k === 'resetstats') { store.del('br.stats'); store.del('br.best2'); statsModal(); renderHome(); }
    else if (k.startsWith('fi:')) { UI.foundName = ($('#found-name') || {}).value; UI.foundIssue = +k.slice(3); foundModal(v, me); }
    else if (k === 'found') {
      const name = ($('#found-name') || {}).value || '';
      if (send({ type: 'found', name, issue: UI.foundIssue })) { closeModal(true); BR.sfx('fanfare'); confetti(); banner(`🏢 ${esc(name.trim() || 'Your company')}<small>IPO opens next round</small>`, 'gold'); }
    }
  });

  function titleChip(v, c, pid) {
    const o = c.status === 'active' && U.ownerOf(v, c);
    if (!o || o.p.id !== pid) return '';
    return o.rank === 'owner' ? '<span class="tchip owner">👑 Owner</span>' : '<span class="tchip co">🎩 Co-owner</span>';
  }

  function tradeModal(v, me, tk, refresh) {
    if (refresh && UI.modal !== 'trade') return;
    const c = U.company(v, tk);
    if (!refresh || UI.tradeTk !== tk) { UI.tradeTk = tk; UI.blocks = 1; }
    const own = me.hold[tk] || 0;
    const mine = me.hand.filter((k) => k.tk === tk);
    const net = mine.reduce((a, k) => a + k.v, 0);
    const hint = mine.length ? `Your cards: ${mine.map((k) => `<b class="${cls(k.v)}">${sgn(k.v)}</b>`).join(' ')} → net <b class="${cls(net)}">${sgn(net)}</b>` : 'You hold no cards for this company. Rivals might!';
    const can = myTurn(v) && c.status === 'active';
    const cost = UI.blocks * R.block * c.price;
    const hs = holdersOf(v, c);
    const ownr = c.status === 'active' && U.ownerOf(v, c);
    const holders = hs.length ? hs.map(({ p, q }) => `<div class="hrow${p.id === me.id ? ' me' : ''}"><span>${esc(p.avatar)} ${esc(p.name)}</span>${titleChip(v, c, p.id)}<b>${kq(q)}</b></div>`).join('') : '<div class="hint">Nobody owns this yet.</div>';
    const need = own >= R.ownerAt ? '' : own >= R.coOwnerAt ? `${kq(R.ownerAt - own)} more to be Owner (blocks 2 minus cards)` : `${kq(R.coOwnerAt - own)} more to be Co-owner (blocks the worst minus card)`;
    const html = `<div class="deed-head" style="--c:${c.color}">${logo(c, 44)}<div><h2>${esc(c.name)}</h2><small>${BR.SECTORS[c.sector].name} · ${esc(c.pitch || '')}</small></div><button class="x" data-m="close">✕</button></div>
      <div class="trade-grid">
        <div class="tg-left">
          <div class="kv"><span class="big-price">₹${c.price}</span><span class="${cls(c.last)}">${c.last ? sgn(c.last) + ' last round' : 'new this game'}</span></div>
          <div class="chart-box">${spark(c.history, 200, 46, 'Price chart starts after the first reveal')}</div>
          <div class="hint">${hint}</div>
          <div class="kv small"><span>You own</span><b>${own.toLocaleString('en-IN')} shares ${titleChip(v, c, me.id)}</b></div>
          ${own ? avgLine(me, c) : ''}
          ${need && c.status === 'active' ? `<div class="hint">🎯 ${need}</div>` : ''}
        </div>
        <div class="tg-right"><div class="sec-h">WHO OWNS IT · ${kq(U.available(v, c))} LEFT</div>${holders}
          ${ownr ? `<div class="hint">${ownr.rank === 'owner' ? '👑' : '🎩'} ${esc(ownr.p.name)} cancels the ${ownr.blocks === 2 ? 'two worst' : 'worst'} minus card${ownr.blocks === 2 ? 's' : ''} here at the reveal.</div>` : ''}</div>
      </div>
      <div class="stepper"><button data-m="b-">−</button><b>${UI.blocks} block${UI.blocks > 1 ? 's' : ''}<small>${(UI.blocks * R.block).toLocaleString('en-IN')} shares · ${rs(cost)}</small></b><button data-m="b+">+</button><button class="btn small" data-m="bmax">MAX</button></div>
      ${can ? '' : `<div class="hint center">${c.status !== 'active' ? 'Not trading right now.' : 'Wait for your turn to trade.'}</div>`}
      <div class="m-foot">
        <button class="btn red" data-m="sell" ${can && own >= UI.blocks * R.block ? '' : 'disabled'}>Sell</button>
        <button class="btn red ghosty" data-m="sell" data-all="1" ${can && own ? '' : 'disabled'}>Sell all</button>
        <button class="btn green big" data-m="buy" ${can && cost <= me.cash ? '' : 'disabled'}>Buy ${rs(cost)}</button></div>`;
    if (refresh) $('#modal-card').innerHTML = html; else openModal('trade', html, true);
  }

  const px1 = (x) => (Math.abs(x - Math.round(x)) < 0.05 ? Math.round(x) : x.toFixed(1));
  function avgLine(p, c) {
    const avg = U.avgCost(p, c.tk);
    if (!avg) return '';
    const q = p.hold[c.tk], pl = (U.priceOf(c) - avg) * q, pct = ((U.priceOf(c) / avg) - 1) * 100;
    return `<div class="avg-box"><div><small>Avg buy price</small><b>₹${px1(avg)}</b></div><div><small>Invested</small><b>${rs(avg * q)}</b></div>
      <div><small>Profit / loss</small><b class="${cls(Math.round(pl))}">${pl >= 0 ? '+' : ''}${rs(pl)} (${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%)</b></div></div>`;
  }

  function foundModal(v, me) {
    UI.foundIssue = UI.foundIssue || R.founderIssue[1];
    const nm = UI.foundName || `${me.name.split(' ')[0]} Ventures`;
    openModal('found', `<div class="gold-head"><div class="gold-ic">🏢</div><h2>Launch your own company</h2><button class="x" data-m="close">✕</button></div>
      <p class="sp-desc">You're worth over ₹1 Cr! List your own company on the board.</p>
      <label>Company name<input id="found-name" maxlength="18" value="${esc(nm)}"></label>
      <div class="sec-h">IPO PRICE PER SHARE</div>
      <div class="chips">${R.founderIssue.map((x) => `<button class="chip${UI.foundIssue === x ? ' on' : ''}" data-m="fi:${x}">₹${x}</button>`).join('')}</div>
      <div class="m-box" style="margin-top:8px">
        <div class="kv"><span>Listing fee (cash)</span><b>${rs(R.listingFee)}</b></div>
        <div class="kv"><span>Founder shares you keep</span><b>${U.fmt(R.founderShares)}</b></div>
        <div class="hint">Its IPO opens next round. Every share other players get in the IPO pays you the IPO price in cash. After that it trades like any other company, so price cards can push it up or crash it. You can found only one company per game. Uses your turn.</div>
      </div>
      <div class="m-foot"><button class="btn" data-m="close">Not now</button><button class="btn gold big" data-m="found">🚀 Found it</button></div>`, true);
  }

  function ipoModal(v, me) {
    const ipo = v.ipo;
    if (!ipo) return;
    const c = U.company(v, ipo.tk);
    const mine = me.hand.filter((k) => k.tk === ipo.tk);
    const cost = UI.ipoBlocks * R.block * ipo.issue;
    const applied = v.players.reduce((a, p) => a + (p.ipoBlocks || 0), 0);
    openModal('ipo', `<div class="deed-head" style="--c:${c.color}">${logo(c, 44)}<div><h2>🚀 IPO: ${esc(ipo.name)}</h2><small>${esc(ipo.pitch)}</small></div><button class="x" data-m="close">✕</button></div>
      <div class="m-box">
        <div class="kv"><span>Issue price</span><b>₹${ipo.issue} per share</b></div>
        <div class="kv"><span>Blocks on offer</span><b>${ipo.blocks} (asked so far: ${applied})</b></div>
        <div class="kv"><span>Your application</span><b>${me.ipoBlocks ? me.ipoBlocks + ' blocks' : '-'}</b></div>
      </div>
      <div class="hint">${mine.length ? `Your cards for ${ipo.tk}: ${mine.map((k) => `<b class="${cls(k.v)}">${sgn(k.v)}</b>`).join(' ')}` : `You hold no ${ipo.tk} cards. Others might!`} If more blocks are asked for than offered, everyone gets a fair share and the rest is refunded. It lists at the reveal and its cards move it straight away.</div>
      <div class="stepper"><button data-m="i-">−</button><b>${UI.ipoBlocks} block${UI.ipoBlocks > 1 ? 's' : ''}<small>${rs(cost)}</small></b><button data-m="i+">+</button></div>
      <div class="m-foot"><button class="btn" data-m="close">Close</button>${ipo.founder === me.id ? '<span class="hint">This is your company. Rivals apply; you get paid.</span>' : `<button class="btn gold big" data-m="ipo" ${myTurn(v) ? '' : 'disabled'}>Apply (uses your turn)</button>`}</div>`, true);
  }

  function specialModal(v, me, k) {
    const d = BR.SPECIALS[k.sp];
    let body = `<p class="sp-desc">${d.desc}</p>`;
    let btns = '';
    if (!myTurn(v)) body += '<p class="hint">Play it on your turn. Playing a gold card uses your turn. You keep unplayed gold cards for later rounds.</p>';
    else if (d.target) {
      const ok = v.companies.filter((c) => c.status === 'active' && (!d.own || me.hold[c.tk]));
      body += ok.length ? `<div class="sec-h">CHOOSE A COMPANY</div><div class="cpick">${ok.map((c) => `<button style="--c:${c.color}" data-m="sp:${k.id}:${c.tk}">${logo(c, 22)}<b>${c.tk}</b><small>₹${c.price}</small></button>`).join('')}</div>`
        : '<p class="hint">You need to own a company first.</p>';
    } else btns = `<button class="btn gold big" data-m="sp:${k.id}">Play ${d.name}</button>`;
    openModal('special', `<div class="gold-head"><div class="gold-ic">${d.icon}</div><h2>${d.name}</h2><button class="x" data-m="close">✕</button></div>${body}<div class="m-foot"><button class="btn" data-m="close">Keep it</button>${btns}</div>`, true);
  }

  function dashModal(v, me) {
    const cos = v.companies.filter((c) => c.status !== 'bankrupt');
    const head = cos.map((c) => `<th><button class="dh" data-m="co:${c.tk}">${logo(c, 22)}<br>${c.tk}<br><small>₹${U.priceOf(c)}</small></button></th>`).join('');
    const rows = v.players.map((p) => {
      const cells = cos.map((c) => {
        const q = p.hold[c.tk] || 0;
        const o = c.status === 'active' && U.ownerOf(v, c);
        const t = o && o.p.id === p.id ? (o.rank === 'owner' ? '👑' : '🎩') : '';
        return `<td class="${q ? 'has' : ''}${t ? ' boss' : ''}">${q ? t + kq(q) : '·'}</td>`;
      }).join('');
      return `<tr class="${p.id === me.id ? 'me' : ''}"><th class="pn"><button data-m="pl:${esc(p.id)}">${esc(p.avatar)} ${esc(p.name)}</button></th>${cells}<td class="money">${rs(p.cash)}</td><td class="money">${p.loan ? rs(p.loan) : '-'}</td><td class="money"><b>${rs(U.netWorth(v, p))}</b></td></tr>`;
    }).join('');
    const left = cos.map((c) => `<td>${c.status === 'active' ? kq(U.available(v, c)) : '-'}</td>`).join('');
    openModal('dash', `<h2>📊 Who owns what<small>🎩 Co-owner ${kq(R.coOwnerAt)}+ · 👑 Owner ${kq(R.ownerAt)}+</small><button class="x" data-m="close">✕</button></h2>
      <div class="dash-wrap"><table class="dash"><thead><tr><th></th>${head}<th>Cash</th><th>Loan</th><th>Worth</th></tr></thead>
      <tbody>${rows}<tr class="left"><th class="pn">📦 Shares left</th>${left}<td></td><td></td><td></td></tr></tbody></table></div>
      <div class="hint">Tap a name to see that player, or a company to trade it.</div>`);
  }

  function playerModal(v, me, pid, refresh) {
    if (refresh && UI.modal !== 'player') return;
    const p = v.players.find((x) => x.id === pid);
    if (!p) return;
    UI.playerId = pid;
    const order = v.players.map((x) => ({ x, w: U.netWorth(v, x) })).sort((a, b) => b.w - a.w);
    const rank = order.findIndex((r) => r.x.id === pid) + 1;
    const hv = U.holdingsValue(v, p);
    const w = U.netWorth(v, p);
    const nCards = p.id === me.id ? p.hand.length : (p.handCount !== undefined ? p.handCount : p.hand.length);
    const nGold = p.id === me.id ? p.gold.length : (p.goldCount !== undefined ? p.goldCount : p.gold.length);
    const hold = Object.keys(p.hold).map((tk) => ({ c: U.company(v, tk), q: p.hold[tk] })).filter((x) => x.c).sort((a, b) => b.q * U.priceOf(b.c) - a.q * U.priceOf(a.c));
    const hrows = hold.length ? hold.map(({ c, q }) => `<div class="prow" data-m="co:${c.tk}">${logo(c, 24)}<span><b>${c.tk}</b> ${titleChip(v, c, pid)}<small>${q.toLocaleString('en-IN')} sh × ₹${U.priceOf(c)}${U.avgCost(p, c.tk) ? ` · avg ₹${px1(U.avgCost(p, c.tk))}` : ''}</small></span><b>${rs(q * U.priceOf(c))}</b></div>`).join('') : '<div class="hint">No shares yet. Sitting on cash.</div>';
    const acts = v.trades.filter((t) => t.pid === pid).slice(0, 8).map((t) => { const x = verb(t); return `<div class="lrow"><i>R${t.r}</i><span class="${x.c}">${x.ic} ${esc(x.txt)}</span>${t.act === 'buy' || t.act === 'sell' ? `<small>@₹${t.px} · ${rs(t.qty * t.px)}</small>` : ''}</div>`; }).join('') || '<div class="hint">No moves yet.</div>';
    const curve = p.worth.length > 1 ? spark(p.worth.concat([w]), 200, 36) : '';
    const html = `<div class="ph" style="--pc:${p.color}"><div class="av big">${esc(p.avatar)}</div><div><h2>${esc(p.name)}${p.id === me.id ? ' (you)' : ''}</h2><small>#${rank} at the table${p.bot ? ' · ' + p.bot + ' bot' : ''}</small></div><button class="x" data-m="close">✕</button></div>
      <div class="stat-grid">
        <div><small>Net worth</small><b>${rs(w)}</b></div><div><small>Cash</small><b>${rs(p.cash)}</b></div>
        <div><small>Shares</small><b>${rs(hv)}</b></div><div><small>Deposit</small><b>${rs(p.fd)}</b></div>
        <div><small>Loan</small><b class="${p.loan ? 'down' : ''}">${rs(p.loan)}</b></div><div><small>Cards</small><b>🃏${nCards} · ✨${nGold}</b></div>
      </div>
      ${curve ? `<div class="chart-box slim">${curve}</div>` : ''}
      ${p.id === me.id && !p.founded ? `<div class="sec-h">🏢 OWN COMPANY AT ${rs(R.founderAt)} NET WORTH · ${Math.min(100, Math.floor(w / R.founderAt * 100))}%</div><div class="meter gold"><i style="width:${Math.min(100, w / R.founderAt * 100).toFixed(0)}%"></i></div>` : ''}
      ${p.founded ? `<div class="hint">🏢 Founder of ${esc(p.founded)}</div>` : ''}
      <div class="p-cols"><div><div class="sec-h">HOLDINGS</div>${hrows}</div><div><div class="sec-h">LATEST MOVES</div>${acts}</div></div>`;
    if (refresh) $('#modal-card').innerHTML = html; else openModal('player', html, true);
  }

  function logModal(v, me) {
    const f = UI.logFilter || 'all';
    const list = v.trades.filter((t) => f === 'all' || t.pid === f);
    let lastR = null;
    const rows = list.slice(0, 120).map((t) => {
      const x = verb(t);
      const h = t.r !== lastR ? `<div class="lhead">Round ${t.r}</div>` : '';
      lastR = t.r;
      const val = t.act === 'buy' || t.act === 'sell' || t.act === 'margin' || t.act === 'rights' || t.act === 'ipo' ? `<small>${t.qty.toLocaleString('en-IN')} @ ₹${t.px} = ${rs(t.qty * t.px)}</small>` : t.act === 'div' ? `<small>+${rs(t.qty * t.px)}</small>` : '';
      return `${h}<div class="lrow"><i>${esc(t.avatar)}</i><span><b>${esc(t.who)}</b> <span class="${x.c}">${esc(x.txt)}</span></span>${val}</div>`;
    }).join('') || '<div class="hint">No trades yet. Moves appear here as they happen.</div>';
    const tabs = [`<button class="chip${f === 'all' ? ' on' : ''}" data-m="lf:all">Everyone</button>`]
      .concat(v.players.map((p) => `<button class="chip${f === p.id ? ' on' : ''}" data-m="lf:${esc(p.id)}">${esc(p.avatar)} ${esc(p.name.split(' ')[0])}</button>`)).join('');
    openModal('log', `<h2>📜 Trade list<small>Every move at the table</small><button class="x" data-m="close">✕</button></h2>
      <div class="chips tabs">${tabs}</div><div class="log-list">${rows}</div>`, true);
  }

  function spyModal(v, me) {
    const sp = me.spy;
    if (!sp) return;
    const cards = sp.cards.map((k) => priceCard(v, k, true)).join('');
    openModal('spy', `<h2>🔍 ${esc(sp.avatar)} ${esc(sp.who)}'s secret hand<button class="x" data-m="close">✕</button></h2><div class="spy-hand">${cards}</div>
      <p class="hint">Only you can see this. Open it again this round from the 🔍 button.</p><div class="m-foot"><button class="btn gold" data-m="close">Got it</button></div>`);
  }

  function tipModal(v, me) {
    if (!me.tip) return;
    const by = {};
    for (const k of me.tip) (by[k.tk] = by[k.tk] || []).push(k.v);
    const rows = Object.keys(by).map((tk) => { const c = U.company(v, tk); const n = by[tk].reduce((a, x) => a + x, 0);
      return `<div class="prow">${c ? logo(c, 24) : ''}<span><b>${tk}</b><small>${by[tk].map((x) => `<b class="${cls(x)}">${sgn(x)}</b>`).join(' ')}</small></span><b class="${cls(n)}">${sgn(n)}</b></div>`; }).join('') || '<div class="hint">No hidden cards this round.</div>';
    openModal('tip', `<h2>🕵️ Insider Tip<small>Hidden market cards</small><button class="x" data-m="close">✕</button></h2>${rows}
      <p class="hint">These cards are not in anyone's hand, but they still move prices at the reveal. Only you can see this.</p><div class="m-foot"><button class="btn gold" data-m="close">Got it</button></div>`, true);
  }

  function bankModal(v, me, refresh) {
    if (refresh && UI.modal !== 'bank') return;
    const limit = U.loanLimit(v, me);
    const assets = me.cash + me.fd + U.holdingsValue(v, me);
    const risk = me.loan ? Math.min(1, me.loan / (R.baseCredit + assets * R.marginAt)) : 0;
    const amts = [50000, 100000, 200000, 500000];
    const html = `<h2>🏦 Bull Rush Bank<small>Using the bank does not use your turn</small><button class="x" data-m="close">✕</button></h2>
      <div class="chips amt">${amts.map((a) => `<button class="chip${UI.bankAmt === a ? ' on' : ''}" data-m="amt:${a}">${rs(a)}</button>`).join('')}</div>
      <div class="bank-grid">
        <div class="m-box"><h3>💳 LOAN · ${Math.round(R.loanRate * 100)}% per round</h3>
          <div class="kv"><span>You owe</span><b class="${me.loan ? 'down' : ''}">${rs(me.loan)}</b></div>
          <div class="kv"><span>Can still borrow</span><b>${rs(limit)}</b></div>
          <div class="meter"><i style="width:${(risk * 100).toFixed(0)}%" class="${risk > 0.8 ? 'hot' : ''}"></i></div>
          <div class="hint">Limit: ${rs(R.baseCredit)} on trust + ${Math.round(R.loanLtv * 100)}% of your shares and deposit. If the loan grows past ${rs(R.baseCredit)} + ${Math.round(R.marginAt * 100)}% of everything you own (red bar full), the bank takes your cash and sells your shares at the reveal (margin call).</div>
          <div class="row"><button class="btn" data-m="repay" ${me.loan && me.cash ? '' : 'disabled'}>Repay</button><button class="btn gold" data-m="loan" ${limit > 0 ? '' : 'disabled'}>Borrow</button></div>
        </div>
        <div class="m-box"><h3>🔐 FIXED DEPOSIT · +${Math.round(R.fdRate * 100)}% per round</h3>
          <div class="kv"><span>Cash in hand</span><b>${rs(me.cash)}</b></div>
          <div class="kv"><span>In deposit</span><b class="${me.fd ? 'up' : ''}">${rs(me.fd)}</b></div>
          <div class="hint">Safe money: it can never crash, but it grows slowly. Deposits count towards your net worth and your loan limit.</div>
          <div class="row"><button class="btn" data-m="fdOut" ${me.fd ? '' : 'disabled'}>Withdraw</button><button class="btn green" data-m="fdIn" ${me.cash ? '' : 'disabled'}>Deposit</button></div>
        </div>
      </div>`;
    if (refresh) $('#modal-card').innerHTML = html; else openModal('bank', html);
  }

  function phaseModals(v, me) {
    const key = v.round + ':' + v.phase;
    if (key === UI.phaseKey) return;
    const first = UI.phaseKey === '';
    UI.phaseKey = key;
    if (v.phase === 'turns') {
      if (UI.modal === 'reveal') closeModal(true);
      if (UI.ctrl.local && !UI.ctrl.online) store.set(SAVE, v);
      later(() => banner(`<small>ROUND</small>${v.round}<small>${v.ipo ? '🚀 IPO: ' + esc(v.ipo.name) : 'Cards dealt'}</small>`, 'round'), first ? 300 : 50);
      BR.sfx('deal');
      const h = $('#hand'); h.classList.add('dealt'); setTimeout(() => h.classList.remove('dealt'), 1000);
    } else if (v.phase === 'reveal') { BR.sfx('bell'); revealModal(v, me, false); }
    else if (v.phase === 'ended') {
      BR.sfx('bell'); revealModal(v, me, true);
      if (UI.ctrl.local && !UI.ctrl.online) store.del(SAVE);
    }
  }

  function waitingLine(v) {
    const humans = v.players.filter((p) => !p.bot);
    if (humans.length < 2) return '';
    const n = humans.filter((p) => p.ready).length;
    return `${n}/${humans.length} ready${v.settings.auto && v.timeLeft > 0 ? ` · next round in ${Math.ceil(v.timeLeft)}s` : ''}`;
  }
  function updateWaiting(v, me, force) {
    const w = $('#m-wait');
    if (w) w.textContent = waitingLine(v);
    const b = $('#m-ready');
    if (b && (me.ready || force) && UI.ctrl.online) { b.disabled = true; b.textContent = 'Waiting for others...'; }
  }

  // Rows flip over one by one, then the round result lands.
  function revealModal(v, me, last) {
    const r = v.reveal;
    clearTimers();
    const rows = r.rows.map((x) => {
      const cards = x.cards.map((k) => `<span class="${cls(k.v)}${k.blocked ? ' blk' : ''}" title="${esc(k.who)}">${esc(k.avatar || '')}${sgn(k.v)}</span>`).join('')
        + x.mods.map((m) => `<span class="mod">${esc(m)}</span>`).join('');
      const c = U.company(v, x.tk) || x;
      return `<div class="rev-row" data-tk="${x.tk}">
        ${logo(c, 26)}<b>${x.tk}${me.hold[x.tk] ? ' <small class="own-dot">●</small>' : ''}</b>
        <div class="rev-cards">${cards || '<span>no cards</span>'}</div>
        <div class="rev-tot ${cls(x.total)}">${sgn(x.total)}</div>
        <div class="rev-px">₹${x.from} → <span class="${cls(x.to - x.from)}">₹${x.to}</span></div>
        ${x.note ? `<div class="rev-note">${esc(x.note)}</div>` : ''}</div>`;
    }).join('');
    const ev = r.events.map((e) => `<div class="newsi">${esc(e)}</div>`).join('');
    const foot = last
      ? '<button class="btn gold big" data-m="final">See final results 🏆</button>'
      : '<button class="btn gold big" id="m-ready" data-m="ready">Next round ▶</button>';
    openModal('reveal', `<h2>🃏 Big reveal · Round ${r.round}<small id="rev-sum">Flipping cards...</small></h2>
      <div class="rev-list">${rows}</div><div class="rev-ev hidden">${ev}</div>
      <div class="m-foot"><span class="hint" id="m-wait">${waitingLine(v)}</span><button class="btn small" data-m="skip" id="rev-skip">Skip ⏩</button>${foot}</div>`);
    const els = $$('#modal-card .rev-row');
    els.forEach((el, i) => later(() => {
      el.classList.add('in');
      const x = r.rows[i];
      BR.sfx(x.note.includes('BANKRUPT') ? 'crash' : x.note.includes('BONUS') ? 'bonus' : 'flip');
      if (me.hold[x.tk] && x.to !== x.from) el.classList.add(x.to > x.from ? 'good' : 'bad');
    }, 250 + i * 330));
    later(() => finishReveal(v, me), 350 + els.length * 330);
  }
  function finishReveal(v, me, skip) {
    if (UI.modal !== 'reveal' && !skip) return;
    clearTimers();
    $$('#modal-card .rev-row').forEach((el) => el.classList.add('in'));
    const ev = $('#modal-card .rev-ev'); if (ev) ev.classList.remove('hidden');
    const sk = $('#rev-skip'); if (sk) sk.remove();
    const sum = $('#rev-sum');
    if (!sum || sum.dataset.done) return;
    sum.dataset.done = 1;
    const myPl = v.reveal.pl[me.id] || 0;
    sum.innerHTML = `Your round: <b class="${cls(myPl)}">${myPl >= 0 ? '+' : ''}${rs(myPl)}</b>`;
    if (myPl > 0) { BR.sfx('win'); const h = $('#modal-card h2').getBoundingClientRect(); moneyFly(h, '#tb-worth', myPl); }
    else if (myPl < 0) BR.sfx('lose');
  }

  const TITLES = [
    [(p) => p.worth >= 5e6, '🏆 Market Maharaja'], [(p) => p.worth >= 2e6, '🐂 Bull of the Table'],
    [(p) => p.worth >= 1e6, '📈 Smart Investor'], [(p) => p.worth >= 5e5, '🙂 Steady Saver'], [() => true, '🐻 Bear Survivor'],
  ];
  function finalModal(v, me) {
    clearTimers();
    const f = v.final;
    const rank = f.findIndex((x) => x.id === me.id) + 1;
    const mine = f[rank - 1];
    const title = TITLES.find(([t]) => t(mine))[1];
    const best = store.get('br.best2', 0);
    if (!UI.ctrl.online && mine.worth > best) store.set('br.best2', mine.worth);
    if (!UI.statsSaved) {
      UI.statsSaved = true;
      const st = stats();
      st.played++; if (rank === 1) st.wins++; if (rank <= 3) st.podium++; st.best = Math.max(st.best, mine.worth);
      store.set('br.stats', st);
    }
    if (rank === 1) { BR.sfx('fanfare'); confetti(); } else BR.sfx('win');
    const order = [f[1], f[0], f[2]].filter(Boolean);
    const pod = order.map((p) => `<div class="pod p${f.indexOf(p) + 1}"><div class="av">${esc(p.avatar || '🙂')}</div><b>${esc(p.name)}</b><small>${rs(p.worth)}</small><div class="pn">#${f.indexOf(p) + 1}</div></div>`).join('');
    const rest = f.slice(3).map((p, i) => `<div class="kv"><span>#${i + 4} ${esc(p.avatar)} ${esc(p.name)}</span><b>${rs(p.worth)}</b></div>`).join('');
    const gain = ((mine.worth / v.settings.startCash) - 1) * 100;
    openModal('final', `
      <h2>${rank === 1 ? '🏆 You won!' : `You finished #${rank}`}<small>${title}</small></h2>
      <div class="podium">${pod}</div>${rest}
      <div class="m-grid"><div class="m-box"><h3>YOUR RESULT</h3><div class="macro-big">${rs(mine.worth)} <span class="${cls(Math.round(gain))}">(${gain >= 0 ? '+' : ''}${gain.toFixed(0)}%)</span></div>
      <div class="hint">Best ever: ${rs(Math.max(best, mine.worth))}</div></div>
      <div class="m-box"><h3>WEALTH RACE</h3><canvas id="race2" style="width:100%;height:70px"></canvas></div></div>
      <div class="m-foot"><button class="btn" data-m="quit">Main menu</button>${isHost(v) ? '<button class="btn" data-m="ext:5">➕ Keep playing (+5 rounds)</button>' : ''}${UI.ctrl.online ? '' : '<button class="btn gold big" data-m="again">Play again</button>'}</div>`);
    setTimeout(() => {
      const cv = $('#race2');
      if (cv) BR.worthChart(cv, v.players.map((p) => ({ color: p.color || '#8fa3d6', me: p.id === me.id, pts: p.worth })));
    }, 50);
  }

  const isHost = (v) => !!v && v.players[0].id === UI.ctrl.me;
  function menuModal() {
    const v = view();
    const host = isHost(v) && v.phase !== 'ended';
    const left = v && v.settings.rounds ? `Round ${v.round} of ${v.settings.rounds}` : v ? `Round ${v.round} · no limit` : '';
    openModal('menu', `<h2>☰ Menu<small>${left}</small><button class="x" data-m="close">✕</button></h2>
      <div class="menu-list">
        <button class="btn gold" data-m="close">▶ Resume</button>
        ${host ? `<div class="row">${v.settings.rounds ? '<button class="btn" data-m="ext:1">➕ 1 round</button><button class="btn" data-m="ext:5">➕ 5 rounds</button>' : ''}${!v.settings.rounds || v.settings.rounds > v.round ? '<button class="btn" data-m="endgame">🏁 Last round now</button>' : ''}</div>` : ''}
        <button class="btn" data-m="howto">📘 How to play</button>
        <button class="btn" data-m="sound">${BR.sound.on ? '🔊 Sound on' : '🔇 Sound off'}</button>
        <button class="btn red" data-m="quit">Quit to main menu${UI.ctrl && !UI.ctrl.online ? ' (saved every round)' : ''}</button>
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

  document.addEventListener('click', (e) => {
    if (UI.returnToGame && e.target.closest('#scr-howto [data-go]')) {
      e.stopImmediatePropagation();
      UI.returnToGame = false;
      show('game');
    }
  }, true);

  window.onAndroidBack = function () {
    if (UI.modal) { closeModal(); return 'ok'; }
    if (UI.screen === 'game') { menuModal(); return 'ok'; }
    if (UI.screen === 'howto' && UI.returnToGame) { UI.returnToGame = false; show('game'); return 'ok'; }
    if (UI.screen !== 'title') { show('title'); return 'ok'; }
    return 'exit';
  };

  const HOWTO = `
    <h4>🎯 Goal</h4><p>Everyone starts with ₹5 lakh. After the last round, the richest player wins (cash + shares + deposit − loan).</p>
    <h4>🃏 Each round</h4><ul><li>Everyone gets <b>7 secret price cards</b>. A card like <b>KAIR +15</b> means that company will rise ₹15 at the reveal; <b>ORBT −10</b> means it will fall.</li>
    <li>Players take turns around the table. On your turn do <b>one</b> thing: buy, sell, apply for an IPO, play a gold card, or pass.</li>
    <li>Shares come in blocks of 1,000. Each company has only 1,00,000 shares.</li></ul>
    <h4>🎉 The big reveal</h4><p>When the round ends, <b>every</b> card is flipped, including a few hidden market cards. Each company moves by the total. Watch what rivals buy and sell: tap a player to see their holdings, or open 📜 Trades.</p>
    <h4>👑 Owners</h4><ul><li>🎩 <b>Co-owner</b>: hold the most shares of a company, at least 20,000. Its worst minus card is cancelled at the reveal.</li>
    <li>👑 <b>Owner</b>: at least 50,000 shares. The two worst minus cards are cancelled.</li></ul>
    <h4>💥 Bankrupt and 🎉 bonus</h4><ul><li>A company that falls to ₹0 goes bankrupt and its shares are wiped out. It comes back next round at its starting price.</li>
    <li>At ₹250 a company gives a 1:1 bonus: shares double, price halves.</li></ul>
    <h4>✨ Gold cards</h4><p>Gold cards are secret: rivals only see that you played one, and find out which at the reveal. Everyone starts with 3 and keeps them until played. Players in the bottom half get a new one after each reveal, so nobody runs away with the game.</p>
    <ul><li>🎟 Rights Offer: extra shares at half price · 🚨 Scam Exposed: −₹40 · 🔒 Trading Freeze: no move</li>
    <li>🚀 Rupee Rocket: all +10% · 📉 Rupee Slide: all −10% · 🚧 Upper Limit: max +₹15 · 🪂 Lower Limit: max −₹15</li>
    <li>💰 Dividend Day: ₹5 per share · 🔍 Spy Glass: see a rival's hand</li>
    <li>🐂 Bull Charge: +₹25 · 🎲 Double Trouble: moves ×2 · 🛟 Safety Net: the bank covers your loss on one company</li>
    <li>🕵️ Insider Tip: see the hidden market cards · 🧾 Tax Raid: the richest rival pays 5% · 🎁 Lucky Bonus: ₹1 lakh now</li></ul>
    <h4>🚀 IPOs</h4><p>A few times per game a new company goes public. Apply on your turn. If too many blocks are asked for, everyone gets a fair share and the rest is refunded.</p>
    <h4>🏢 Your own company</h4><p>Reach ₹1 Cr net worth and you can list your own company (₹10 lakh listing fee, uses your turn). You keep 30,000 founder shares, and every share rivals get in its IPO pays you cash. Then it trades like any other company.</p>
    <h4>⏱ Game length</h4><p>Pick 6 to 20 rounds or ∞ (no limit). The host can add rounds or call the last round from the ☰ menu, and can keep playing after the final results.</p>
    <h4>🏦 Bank</h4><p>Borrow ₹2 lakh on trust plus half the value of your shares, at 5% per round. Park spare cash in a fixed deposit for 2% per round. If your shares crash and the loan passes ₹2 lakh + 70% of everything you own, the bank sells your shares (margin call). The bank never uses your turn.</p>
    <h4>🌐 Online</h4><p>One player hosts a room and shares the 5-letter code. Up to 6 players; bots can fill empty seats.</p>`;

  setupScreens();
  show('title');
  const studio = $('#studio');
  studio.addEventListener('click', () => studio.classList.add('skip'));
  studio.addEventListener('animationend', (e) => { if (e.target === studio) studio.remove(); });
})(window.BR = window.BR || {});
