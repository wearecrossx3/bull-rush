// Bull Rush UI (tabletop edition): screens, the table, cards, modals and the main loop.
(function (BR) {
  const U = BR.util;
  const R = BR.RULES;
  const $ = (q) => document.querySelector(q);
  const $$ = (q) => Array.from(document.querySelectorAll(q));
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rs = (n) => (n < 0 ? '-₹' : '₹') + U.fmt(Math.abs(n));
  const cls = (x) => (x > 0 ? 'up' : x < 0 ? 'down' : 'flat');
  const sgn = (x) => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };

  const UI = { ctrl: null, modal: null, phaseKey: '', blocks: 1, ipoBlocks: 1, renderKey: '' };
  BR.UI = UI;

  // ---------------------------------------------------------------- screens
  let stopBg = null;
  function show(id) {
    $$('.screen').forEach((s) => s.classList.toggle('active', s.id === 'scr-' + id));
    UI.screen = id;
    if (id === 'title') { stopBg = stopBg || BR.titleBg($('#title-bg')); $('#btn-continue').classList.toggle('hidden', !store.get('br.save2', null)); }
    else if (stopBg) { stopBg(); stopBg = null; }
  }
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
    const s = BR.createGame({ rounds: +$('#pick-days').dataset.val, turns: +$('#pick-len').dataset.val }, roster);
    begin(LocalCtrl(s, 'me'));
  }

  function continueSaved() {
    const sv = store.get('br.save2', null);
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
      host.start({ rounds: +$('#pick-days-on').dataset.val, turnTime: +$('#pick-len-on').dataset.val });
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
    UI.phaseKey = ''; UI.renderKey = ''; UI.lastSeat = null;
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
    closeModal(true);
    show('title');
  }
  const meP = (v) => v.players.find((p) => p.id === UI.ctrl.me);
  const myTurn = (v) => v.phase === 'turns' && v.players[v.seat].id === UI.ctrl.me;

  function render(v) {
    const me = meP(v);
    if (!me) return;
    phaseModals(v, me);
    const seatKey = v.phase + v.round + ':' + v.pass + ':' + v.seat;
    if (seatKey !== UI.lastSeat) {
      UI.lastSeat = seatKey;
      if (myTurn(v)) { BR.sfx('coin'); if (navigator.vibrate) try { navigator.vibrate(60); } catch (e) { /* ignore */ } }
    }
    // only rebuild the DOM when something visible changed
    const key = v.v + ':' + (v.settings.turnTime ? Math.ceil(v.timeLeft) : '');
    if (key !== UI.renderKey) {
      UI.renderKey = key;
      renderTop(v, me);
      renderBoard(v, me);
      renderSeats(v, me);
      renderHand(v, me);
      if (UI.modal === 'bank') bankModal(v, me, true);
      if (UI.modal === 'trade') tradeModal(v, me, UI.tradeTk, true);
      if (UI.modal === 'reveal') updateWaiting(v, me);
    }
  }

  // ---------------------------------------------------------------- table
  function renderTop(v, me) {
    $('#tb-day').textContent = `${v.round}/${v.settings.rounds}`;
    const t = $('#tb-turn');
    const cur = v.players[v.seat];
    if (v.phase === 'turns') {
      const timer = v.settings.turnTime ? ` · ${Math.max(0, Math.ceil(v.timeLeft))}s` : '';
      t.textContent = myTurn(v) ? `⭐ Your turn!${timer}` : `${cur.avatar} ${cur.name}'s turn${timer}`;
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

  function renderBoard(v, me) {
    const el = $('#board');
    const list = v.companies;
    const cols = Math.ceil(list.length / 2);
    el.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    const playsOn = {};
    for (const x of v.plays) if (x.tk) (playsOn[x.tk] = playsOn[x.tk] || []).push(BR.SPECIALS[x.sp].icon);
    el.innerHTML = list.map((c) => {
      const own = me.hold[c.tk];
      const hist = c.history.slice(-8);
      const showBars = hist.length > 1;
      const mx = Math.max(...hist, 1);
      const bars = hist.map((h) => `<i style="height:${Math.max(8, (h / mx) * 100)}%"></i>`).join('');
      const stamp = c.status === 'bankrupt' ? '<div class="t-stamp">💥 BANKRUPT</div>' : c.status === 'ipo' ? '<div class="t-stamp">🚀 IPO</div>' : '';
      const price = c.status === 'ipo' ? c.issue : c.price;
      const boss = c.status === 'active' && U.bossOf(v, c);
      return `<div class="tile${c.status === 'bankrupt' ? ' dead' : ''}${c.status === 'ipo' ? ' ipo' : ''}" style="--c:${c.color}" data-tile="${c.tk}">
        <div class="t-head"><span class="lg">${c.logo}</span>${c.tk}</div>
        <div class="t-name">${esc(c.name)}</div>
        ${c.last && c.status === 'active' ? `<span class="t-chg ${cls(c.last)}">${c.last > 0 ? '▲' : '▼'}${Math.abs(c.last)}</span>` : ''}
        <div class="t-price">₹${price}</div>
        <div class="t-bars">${showBars ? bars : ""}</div>
        ${own ? `<span class="t-own">${(own / 1000).toLocaleString('en-IN')}K</span>` : ''}
        ${boss ? `<span class="t-boss" title="Big Boss">👑${esc(boss.avatar)}</span>` : ''}
        ${playsOn[c.tk] ? `<span class="t-chg flat" style="top:auto;bottom:24px">${playsOn[c.tk].join('')}</span>` : ''}
        ${stamp}
      </div>`;
    }).join('');
  }

  function renderSeats(v, me) {
    const order = v.players.map((p) => ({ p, w: U.netWorth(v, p) })).sort((a, b) => b.w - a.w);
    const rank = {};
    order.forEach((r, i) => (rank[r.p.id] = i + 1));
    $('#seats').innerHTML = v.players.map((p, i) => {
      const turn = v.phase === 'turns' && v.seat === i;
      const nCards = p.id === me.id ? p.hand.length : (p.handCount !== undefined ? p.handCount : p.hand.length);
      return `<div class="seat${turn ? ' turn' : ''}">
        <div class="av" style="--pc:${p.color}">${esc(p.avatar || '🙂')}</div>
        <div><b>#${rank[p.id]} ${esc(p.name)}${p.id === me.id ? ' (you)' : ''}</b><small>${turn && p.id !== me.id ? '<span class="dots">thinking</span>' : `💵 ${rs(p.cash)} · 🃏${nCards}`}${p.loan ? ' · 🏦' : ''}</small></div>
        <div class="w">${rs(U.netWorth(v, p))}</div></div>`;
    }).join('');
    const box = $('#actbox');
    if (v.phase !== 'turns') { box.innerHTML = '<div>Round over. Check the reveal!</div>'; return; }
    const passLine = `Pass ${v.pass + 1} of ${v.settings.turns}`;
    const feed = v.feed.slice(0, 3).map((f) => `<div>• ${esc(f.text)}</div>`).join('');
    const spyBtn = me.spy ? `<button class="btn small" data-act="spy">🔍 ${esc(me.spy.who)}'s hand</button>` : '';
    if (myTurn(v)) {
      box.innerHTML = `<div class="act-tip">👆 Tap a company to <b>buy / sell</b><br>✨ or tap a gold card</div>
        <button class="btn green" data-act="pass">✋ Pass</button>${spyBtn}`;
    } else {
      box.innerHTML = `<div><b>${passLine}</b></div><div class="feed-mini">${feed}</div>${spyBtn}`;
    }
    if (UI.wantSpy && me.spy) { UI.wantSpy = false; spyModal(v, me); }
  }

  function renderHand(v, me) {
    const el = $('#hand');
    if (!me.hand.length) { el.innerHTML = '<div class="hand-empty">No cards in hand</div>'; return; }
    el.innerHTML = me.hand.map((k) => {
      if (k.kind === 'special') {
        const d = BR.SPECIALS[k.sp];
        return `<div class="card sp" data-card="${k.id}"><div class="ic">${d.icon}</div><div class="nm">${d.name}</div></div>`;
      }
      const c = U.company(v, k.tk);
      return `<div class="card" style="--c:${c ? c.color : '#999'}" data-card="${k.id}">
        <div class="band"><span>${c ? c.logo : ''}</span><span>${k.tk}</span></div>
        <div class="val ${k.v > 0 ? 'up' : 'down'}">${sgn(k.v)}</div><div class="arrow">${k.v > 0 ? '▲ rise' : '▼ fall'}</div></div>`;
    }).join('');
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
    const card = e.target.closest('[data-card]');
    if (card) {
      const k = me.hand.find((x) => x.id === card.dataset.card);
      BR.sfx('tap');
      if (k && k.kind === 'special') specialModal(v, me, k);
      else if (k) { const c = U.company(v, k.tk); if (c && c.status !== 'bankrupt') (c.status === 'ipo' ? ipoModal(v, me) : tradeModal(v, me, c.tk)); }
      return;
    }
    const act = e.target.closest('[data-act]');
    if (act && act.dataset.act === 'pass') send({ type: 'pass' });
    if (act && act.dataset.act === 'spy') spyModal(v, me);
  });

  function send(a, okMsg) {
    const err = UI.ctrl.send(a);
    if (err) { toast(err, 'err'); BR.sfx('err'); return false; }
    if (okMsg) toast(okMsg, 'ok');
    UI.dirty = true;
    return true;
  }

  $('#btn-bank').onclick = () => { const v = UI.ctrl.view(); bankModal(v, meP(v)); };
  $('#btn-dash').onclick = () => { const v = UI.ctrl.view(); dashModal(v, meP(v)); BR.sfx('tap'); };
  $('#btn-menu').onclick = () => menuModal();

  // ---------------------------------------------------------------- modals
  function openModal(kind, html, narrow) {
    UI.modal = kind;
    $('#modal-card').className = 'modal-card' + (narrow ? ' narrow' : '');
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
    if (!b) return;
    const k = b.dataset.m;
    const v = UI.ctrl && UI.ctrl.view();
    const me = v && meP(v);
    if (k === 'close') closeModal(true);
    else if (k === 'ready') { UI.ctrl.send({ type: 'ready' }); BR.sfx('tap'); UI.dirty = true; updateWaiting(v, me, true); }
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
      if (send({ type: 'special', card, tk: tk || undefined })) {
        BR.sfx('power'); closeModal(true);
        if (card && UI.ctrl.local) { const nv = UI.ctrl.view(); const nm = meP(nv); if (nm.spy) spyModal(nv, nm); }
        else UI.wantSpy = true;
      }
    } else if (k === 'loan' || k === 'repay') {
      if (send({ type: k })) BR.sfx('coin');
      setTimeout(() => { const nv = UI.ctrl.view(); bankModal(nv, meP(nv), true); }, UI.ctrl.local ? 0 : 400);
    }
  });

  function tradeModal(v, me, tk, refresh) {
    if (refresh && UI.modal !== 'trade') return;
    const c = U.company(v, tk);
    if (!refresh || UI.tradeTk !== tk) { UI.tradeTk = tk; UI.blocks = 1; }
    const own = me.hold[tk] || 0;
    const mine = me.hand.filter((k) => k.kind === 'price' && k.tk === tk);
    const hint = mine.length ? `Your cards: ${mine.map((k) => `<b class="${cls(k.v)}">${sgn(k.v)}</b>`).join(' ')} (net <b class="${cls(mine.reduce((a, k) => a + k.v, 0))}">${sgn(mine.reduce((a, k) => a + k.v, 0))}</b>)` : 'You hold no cards for this company.';
    const can = myTurn(v) && c.status === 'active';
    const cost = UI.blocks * R.block * c.price;
    const html = `<h2><span class="lg" style="background:${c.color};border-radius:8px;padding:2px 6px;color:#0b1020">${c.logo}</span> ${esc(c.name)}<small>${BR.SECTORS[c.sector].name}</small></h2>
      <div class="trade-sheet">
        <div class="kv"><span class="big-price">₹${c.price}<small class="${cls(c.last)}" style="font-size:13px"> ${c.last ? sgn(c.last) + ' last round' : ''}</small></span><span>You own<br><b>${own.toLocaleString('en-IN')} shares</b></span></div>
        <div class="hint">${hint}</div>
        <div class="stepper"><button data-m="b-">−</button><b>${UI.blocks} block${UI.blocks > 1 ? 's' : ''}<br><small class="flat">${(UI.blocks * R.block).toLocaleString('en-IN')} shares</small></b><button data-m="b+">+</button><button class="btn small" data-m="bmax">MAX</button></div>
        ${can ? '' : `<div class="hint">${c.status !== 'active' ? 'Not trading right now.' : 'Wait for your turn to trade.'}</div>`}
      </div>
      <div class="m-foot"><button class="btn" data-m="close">Close</button>
        <button class="btn red" data-m="sell" ${can && own >= UI.blocks * R.block ? '' : 'disabled'}>Sell ${rs(cost)}</button>
        <button class="btn red" data-m="sell" data-all="1" ${can && own ? '' : 'disabled'}>Sell all</button>
        <button class="btn green" data-m="buy" ${can && cost <= me.cash ? '' : 'disabled'}>Buy ${rs(cost)}</button></div>`;
    if (refresh) $('#modal-card').innerHTML = html; else openModal('trade', html, true);
  }

  function ipoModal(v, me) {
    const ipo = v.ipo;
    if (!ipo) return;
    const mine = me.hand.filter((k) => k.kind === 'price' && k.tk === ipo.tk);
    const cost = UI.ipoBlocks * R.block * ipo.issue;
    const applied = v.players.reduce((a, p) => a + (p.ipoBlocks || 0), 0);
    openModal('ipo', `<h2>🚀 IPO: ${esc(ipo.name)}<small>${esc(ipo.pitch)}</small></h2>
      <div class="trade-sheet">
        <div class="kv"><span>Issue price</span><b>₹${ipo.issue} per share</b></div>
        <div class="kv"><span>Blocks on offer</span><b>${ipo.blocks} (applied so far: ${applied})</b></div>
        <div class="kv"><span>Your application</span><b>${me.ipoBlocks ? me.ipoBlocks + ' blocks' : '-'}</b></div>
        <div class="hint">${mine.length ? `Your cards for ${ipo.tk}: ${mine.map((k) => `<b class="${cls(k.v)}">${sgn(k.v)}</b>`).join(' ')}` : `You hold no ${ipo.tk} cards. Others might!`} If more blocks are asked for than offered, everyone gets a fair share and the rest is refunded. It lists at the reveal and its cards move it right away.</div>
        <div class="stepper"><button data-m="i-">−</button><b>${UI.ipoBlocks} block${UI.ipoBlocks > 1 ? 's' : ''}<br><small class="flat">${rs(cost)}</small></b><button data-m="i+">+</button></div>
      </div>
      <div class="m-foot"><button class="btn" data-m="close">Close</button><button class="btn gold" data-m="ipo" ${myTurn(v) ? '' : 'disabled'}>Apply (uses your turn)</button></div>`, true);
  }

  function specialModal(v, me, k) {
    const d = BR.SPECIALS[k.sp];
    let body = `<p>${d.desc}</p>`;
    let btns = '';
    if (!myTurn(v)) body += '<p class="hint">You can play it on your turn. Playing a card uses your turn.</p>';
    else if (d.target) {
      const ok = v.companies.filter((c) => c.status === 'active' && (!d.own || me.hold[c.tk]));
      body += ok.length ? `<div class="sec-h">CHOOSE A COMPANY</div><div class="cpick">${ok.map((c) => `<button style="--c:${c.color}" data-m="sp:${k.id}:${c.tk}">${c.logo} ${c.tk}</button>`).join('')}</div>`
        : '<p class="hint">You need to own a company first.</p>';
    } else btns = `<button class="btn gold" data-m="sp:${k.id}">Play ${d.name}</button>`;
    openModal('special', `<h2>${d.icon} ${d.name}</h2>${body}<div class="m-foot"><button class="btn" data-m="close">Close</button>${btns}</div>`, true);
  }

  function dashModal(v, me) {
    const cos = v.companies.filter((c) => c.status !== 'bankrupt');
    const head = cos.map((c) => `<th><span class="dlg" style="background:${c.color}">${c.logo}</span><br>${c.tk}<br><small>₹${c.status === 'ipo' ? c.issue : c.price}</small></th>`).join('');
    const rows = v.players.map((p) => {
      const cells = cos.map((c) => {
        const q = p.hold[c.tk] || 0;
        const boss = U.bossOf(v, c);
        return `<td class="${q ? 'has' : ''}">${q ? (boss && boss.id === p.id ? '👑' : '') + (q / 1000) + 'K' : '·'}</td>`;
      }).join('');
      return `<tr class="${p.id === me.id ? 'me' : ''}"><th class="pn">${esc(p.avatar)} ${esc(p.name)}</th>${cells}<td class="money">${rs(p.cash)}</td><td class="money">${p.loan ? rs(p.loan) : '-'}</td><td class="money"><b>${rs(U.netWorth(v, p))}</b></td></tr>`;
    }).join('');
    const left = cos.map((c) => `<td>${c.status === 'active' ? (U.available(v, c) / 1000) + 'K' : '-'}</td>`).join('');
    openModal('dash', `<h2>📊 Who owns what<small>👑 = Big Boss (most shares, at least 5K)</small></h2>
      <div class="dash-wrap"><table class="dash"><thead><tr><th></th>${head}<th>Cash</th><th>Loan</th><th>Worth</th></tr></thead>
      <tbody>${rows}<tr class="left"><th class="pn">📦 Shares left</th>${left}<td></td><td></td><td></td></tr></tbody></table></div>
      <div class="m-foot"><button class="btn gold" data-m="close">Close</button></div>`);
  }

  function spyModal(v, me) {
    const sp = me.spy;
    if (!sp) return;
    const cards = sp.cards.map((k) => {
      if (k.kind === 'special') return `<div class="card sp mini"><div class="ic">${BR.SPECIALS[k.sp].icon}</div><div class="nm">${BR.SPECIALS[k.sp].name}</div></div>`;
      const c = U.company(v, k.tk);
      return `<div class="card mini" style="--c:${c ? c.color : '#999'}"><div class="band"><span>${c ? c.logo : ''}</span><span>${k.tk}</span></div><div class="val ${k.v > 0 ? 'up' : 'down'}">${sgn(k.v)}</div></div>`;
    }).join('');
    openModal('spy', `<h2>🔍 ${esc(sp.avatar)} ${esc(sp.who)}'s secret hand</h2><div class="spy-hand">${cards}</div>
      <p class="hint">Only you can see this. It stays available this round from the 🔍 button.</p><div class="m-foot"><button class="btn gold" data-m="close">Got it</button></div>`);
  }

  function bankModal(v, me, refresh) {
    if (refresh && UI.modal !== 'bank') return;
    const html = `<h2>🏦 Bull Rush Bank</h2>
      <div class="m-box">
        <div class="kv"><span>Cash in hand</span><b>${rs(me.cash)}</b></div>
        <div class="kv"><span>Your loan</span><b class="${me.loan ? 'down' : ''}">${rs(me.loan)} / ${rs(R.loanMax)}</b></div>
        <div class="hint">Borrow ₹1 lakh at a time. ${Math.round(R.loanRate * 100)}% interest is added after every reveal. Loans are subtracted from your final score. Using the bank does not use your turn.</div>
      </div>
      <div class="m-foot"><button class="btn" data-m="repay" ${me.loan ? '' : 'disabled'}>Repay ₹1L</button><button class="btn" data-m="loan" ${me.loan < R.loanMax ? '' : 'disabled'}>Borrow ₹1L</button><button class="btn gold" data-m="close">Done</button></div>`;
    if (refresh) $('#modal-card').innerHTML = html; else openModal('bank', html, true);
  }

  function phaseModals(v, me) {
    const key = v.round + ':' + v.phase;
    if (key === UI.phaseKey) return;
    UI.phaseKey = key;
    if (v.phase === 'turns') {
      if (UI.modal === 'reveal') closeModal(true);
      if (UI.ctrl.local && !UI.ctrl.online) store.set('br.save2', v);
    } else if (v.phase === 'reveal') { BR.sfx('bell'); revealModal(v, me, false); }
    else if (v.phase === 'ended') {
      BR.sfx('bell'); revealModal(v, me, true);
      if (UI.ctrl.local && !UI.ctrl.online) store.del('br.save2');
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

  function revealModal(v, me, last) {
    const r = v.reveal;
    const myPl = r.pl[me.id] || 0;
    const rows = r.rows.map((x, i) => {
      const cards = x.cards.map((k) => `<span class="${cls(k.v)}" title="${esc(k.who)}">${esc(k.avatar || '')}${k.blocked ? '<s>' + sgn(k.v) + '</s>' : sgn(k.v)}</span>`).join('')
        + x.mods.map((m) => `<span class="mod">${m}</span>`).join('');
      return `<div class="rev-row" style="animation-delay:${i * 0.18}s">
        <div class="lg" style="background:${x.color}">${x.logo}</div><b>${x.tk}${me.hold[x.tk] ? ' <small style="color:var(--gold)">●</small>' : ''}</b>
        <div class="rev-cards">${cards || '<span>no cards</span>'}</div>
        <div class="rev-tot ${cls(x.total)}">${sgn(x.total)}</div>
        <div class="rev-px">₹${x.from} → <span class="${cls(x.to - x.from)}">₹${x.to}</span></div>
        ${x.note ? `<div class="rev-note">${x.note}</div>` : ''}</div>`;
    }).join('');
    const ev = r.events.map((e) => `<div class="newsi">${esc(e)}</div>`).join('');
    const foot = last
      ? '<button class="btn gold big" data-m="final">See final results 🏆</button>'
      : '<button class="btn gold big" id="m-ready" data-m="ready">Next round ▶</button>';
    openModal('reveal', `<h2>🃏 Big reveal · Round ${r.round}<small>Your round: <b class="${cls(myPl)}">${myPl >= 0 ? '+' : ''}${rs(myPl)}</b></small></h2>
      <div>${rows}</div>${ev ? `<div style="margin-top:8px">${ev}</div>` : ''}
      <div class="m-foot"><span class="hint" id="m-wait">${waitingLine(v)}</span>${foot}</div>`);
    BR.sfx(myPl >= 0 ? 'win' : 'sell');
    if (last) $('#modal-card').querySelector('[data-m="final"]').onclick = () => finalModal(v, me);
  }

  const TITLES = [
    [(p) => p.worth >= 5e6, '🏆 Market Maharaja'], [(p) => p.worth >= 2e6, '🐂 Bull of the Table'],
    [(p) => p.worth >= 1e6, '📈 Smart Investor'], [(p) => p.worth >= 5e5, '🙂 Steady Saver'], [() => true, '🐻 Bear Survivor'],
  ];
  function finalModal(v, me) {
    const f = v.final;
    const rank = f.findIndex((x) => x.id === me.id) + 1;
    const mine = f[rank - 1];
    const title = TITLES.find(([t]) => t(mine))[1];
    const best = store.get('br.best2', 0);
    if (!UI.ctrl.online && mine.worth > best) store.set('br.best2', mine.worth);
    if (rank === 1) BR.sfx('win');
    const order = [f[1], f[0], f[2]].filter(Boolean);
    const pod = order.map((p) => `<div class="pod p${f.indexOf(p) + 1}"><div class="av">${esc(p.avatar || '🙂')}</div><b>${esc(p.name)}</b><small>${rs(p.worth)}</small><div>#${f.indexOf(p) + 1}</div></div>`).join('');
    const rest = f.slice(3).map((p, i) => `<div class="kv"><span>#${i + 4} ${esc(p.name)}</span><b>${rs(p.worth)}</b></div>`).join('');
    const gain = ((mine.worth / v.settings.startCash) - 1) * 100;
    openModal('final', `
      <h2>${rank === 1 ? '🏆 You won!' : `You finished #${rank}`}<small>${title}</small></h2>
      <div class="podium">${pod}</div>${rest}
      <div class="m-grid"><div class="m-box"><h3>YOUR RESULT</h3><div class="macro-big">${rs(mine.worth)} <span class="${cls(Math.round(gain))}">(${gain >= 0 ? '+' : ''}${gain.toFixed(0)}%)</span></div>
      <div class="hint">Best ever: ${rs(Math.max(best, mine.worth))}</div></div>
      <div class="m-box"><h3>WEALTH RACE</h3><canvas id="race2" style="width:100%;height:70px"></canvas></div></div>
      <div class="m-foot"><button class="btn" data-m="quit">Main menu</button>${UI.ctrl.online ? '' : '<button class="btn gold big" data-m="again">Play again</button>'}</div>`);
    setTimeout(() => {
      const cv = $('#race2');
      if (cv) BR.worthChart(cv, v.players.map((p) => ({ color: p.color || '#8fa3d6', me: p.id === me.id, pts: p.worth })));
    }, 50);
  }

  function menuModal() {
    openModal('menu', `<h2>☰ Menu</h2>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button class="btn gold" data-m="close">Resume</button>
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
    <h4>🎯 Goal</h4><p>Everyone starts with ₹5 lakh. After the last round, the richest player wins (cash + shares − loans).</p>
    <h4>🃏 Each round</h4><ul><li>Everyone is dealt <b>7 price cards</b>, and often a gold <b>special card</b>. Only you can see your hand.</li>
    <li>A price card like <b>KAIR +15</b> means Kairo Motors will rise ₹15 at the reveal. <b>ORBT −10</b> means it will fall.</li>
    <li>Players take turns around the table (3 times per round). On your turn do <b>one</b> thing: buy, sell, apply for an IPO, play a gold card, or pass.</li>
    <li>Shares come in blocks of 1,000.</li></ul>
    <h4>🎉 The big reveal</h4><p>When the round ends, <b>every</b> player's cards are flipped. Each company moves by the total of all cards for it. Your cards are only part of the story, so watch what rivals buy and sell!</p>
    <h4>💥 Bankrupt and 🎉 bonus</h4><ul><li>If a company falls to ₹0 it goes bankrupt and all its shares are wiped out. It returns next round at its starting price.</li>
    <li>If a company reaches ₹250, it gives a 1:1 bonus: your shares double and the price halves.</li></ul>
    <h4>👑 Big Boss</h4><p>Whoever owns the most shares of a company (at least 5,000) is its Big Boss. At the reveal, the Boss blocks the single worst card for that company.</p>
    <h4>📦 Limited shares</h4><p>Each company has only 1,00,000 shares on the table. Tap 📊 Shares to see who owns what.</p>
    <h4>✨ Gold cards</h4><ul><li>🎟 Rights Offer: buy extra shares at half price · 🚨 Scam Exposed: −₹40 · 🔒 Trading Freeze: no move</li>
    <li>🚀 Rupee Rocket: all +10% · 📉 Rupee Slide: all −10% · 🚧 Upper Limit: max +₹15 · 🪂 Lower Limit: max −₹15</li>
    <li>💰 Dividend Day: ₹5 per share · 🔍 Spy Glass: see a rival's whole hand</li></ul>
    <h4>🚀 IPOs</h4><p>A few times per game a new company goes public. Apply on your turn at the issue price. If too many blocks are asked for, everyone gets a fair share. It lists at the reveal and its cards move it straight away.</p>
    <h4>🏦 Bank</h4><p>Borrow ₹1 lakh at a time (up to ₹3 lakh) any time without using your turn. 10% interest per round.</p>
    <h4>🌐 Online</h4><p>One player hosts a room and shares the 5-letter code. Up to 6 players, and bots can fill empty seats.</p>`;

  setupScreens();
  show('title');
})(window.BR = window.BR || {});
