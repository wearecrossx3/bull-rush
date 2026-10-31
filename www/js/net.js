// Online play over PeerJS. The host runs the real game; clients send actions and receive their own view.
(function (BR) {
  const PREFIX = 'bullrush-v1-';
  const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  // Default is the free PeerJS cloud broker; a self-hosted PeerServer can be set via BR.PEER_OPTS.
  const opts = () => Object.assign({ debug: 0 }, BR.PEER_OPTS || {});

  function code5() {
    let c = '';
    for (let i = 0; i < 5; i++) c += LETTERS[Math.floor(Math.random() * LETTERS.length)];
    return c;
  }


  // ---------------------------------------------------------------- internet relay
  // For players on different networks (mobile data, other cities) a direct link often cannot be made,
  // so rooms also run through free public MQTT brokers over secure WebSockets. The host listens on all
  // brokers; a player joins through the first one that answers.
  const BROKERS = BR.RELAY_URLS || ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081/mqtt'];
  const TOPIC = 'bullrush-v6/';
  const enc = new TextEncoder(), dec = new TextDecoder();

  function mqttStr(str) { const b = enc.encode(str); return [b.length >> 8, b.length & 255, ...b]; }
  function mqttPacket(head, body) {
    const len = []; let n = body.length;
    do { let d = n % 128; n = Math.floor(n / 128); if (n) d |= 128; len.push(d); } while (n);
    const out = new Uint8Array(1 + len.length + body.length);
    out[0] = head; out.set(len, 1); out.set(body, 1 + len.length);
    return out;
  }

  // Bare-bones MQTT 3.1.1 client (QoS 0 only), enough for a room's messages.
  function Mqtt(url, onReady, onMsg, onDown) {
    const self = this;
    this.ok = false;
    let buf = new Uint8Array(0), ping = null;
    let ws;
    try { ws = new WebSocket(url, 'mqtt'); } catch (e) { setTimeout(onDown, 0); return; }
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    const timeout = setTimeout(() => { if (!self.ok) { try { ws.close(); } catch (e) { /* ignore */ } } }, 7000);
    ws.onopen = () => {
      const id = 'br' + Math.random().toString(36).slice(2, 12);
      ws.send(mqttPacket(0x10, [...mqttStr('MQTT'), 4, 2, 0, 60, ...mqttStr(id)]));
    };
    ws.onmessage = (e) => {
      const add = new Uint8Array(e.data), nb = new Uint8Array(buf.length + add.length);
      nb.set(buf); nb.set(add, buf.length); buf = nb;
      for (;;) {
        if (buf.length < 2) return;
        let len = 0, mul = 1, i = 1, d;
        do { if (i >= buf.length) return; d = buf[i++]; len += (d & 127) * mul; mul *= 128; } while (d & 128);
        if (buf.length < i + len) return;
        const type = buf[0] >> 4, qos = (buf[0] >> 1) & 3, body = buf.subarray(i, i + len);
        if (type === 2) { clearTimeout(timeout); self.ok = body[1] === 0; if (self.ok) { ping = setInterval(() => self.raw(mqttPacket(0xC0, [])), 25000); onReady(); } else ws.close(); }
        else if (type === 3) {
          const tl = (body[0] << 8) | body[1], topic = dec.decode(body.subarray(2, 2 + tl));
          const payload = body.subarray(2 + tl + (qos ? 2 : 0));
          try { onMsg(topic, JSON.parse(dec.decode(payload))); } catch (err) { /* bad message */ }
        }
        buf = buf.slice(i + len);
      }
    };
    ws.onclose = ws.onerror = () => { clearTimeout(timeout); clearInterval(ping); const was = self.ok; self.ok = false; if (!self.dead) { self.dead = true; onDown(was); } };
  }
  Mqtt.prototype.raw = function (b) { try { if (this.ws.readyState === 1) this.ws.send(b); } catch (e) { /* closed */ } };
  Mqtt.prototype.sub = function (topic) { this.raw(mqttPacket(0x82, [0, 1, ...mqttStr(topic), 0])); };
  Mqtt.prototype.pub = function (topic, obj) { this.raw(mqttPacket(0x30, [...mqttStr(topic), ...enc.encode(JSON.stringify(obj))])); };
  Mqtt.prototype.close = function () { this.dead = true; try { this.ws.close(); } catch (e) { /* ignore */ } };

  // A relayed player looks like a PeerJS connection to the host code: send(), plus data/close handlers.
  function RelayConn(mq, code, cid) {
    this.peer = cid; this.mq = mq; this.to = TOPIC + code + '/c/' + cid; this.h = {}; this.seen = Date.now();
  }
  RelayConn.prototype.send = function (m) { this.mq.pub(this.to, m); };
  RelayConn.prototype.on = function (ev, fn) { this.h[ev] = fn; };
  RelayConn.prototype.close = function () { if (this.closed) return; this.closed = true; if (this.h.close) this.h.close(); };

  function relayHost(host, onUp) {
    const conns = {};
    host.relays = BROKERS.map((url) => {
      const mq = new Mqtt(url, () => { mq.sub(TOPIC + host.code + '/h'); onUp(); }, (topic, m) => {
        if (!m || !m.from) return;
        let c = conns[m.from];
        if (!c) {
          if (m.t !== 'hello') return;
          c = conns[m.from] = new RelayConn(mq, host.code, m.from);
          c.on('data', (x) => host.onData(c, x));
          c.on('close', () => host.onClose(c));
        }
        c.seen = Date.now();
        if (m.t === 'bye') c.close();
        else if (m.t !== 'ping') c.h.data(m);
      }, () => {});
      return mq;
    });
    // players that stop pinging have left; the host also pings so players know it is still there
    host.relayTimer = setInterval(() => {
      const now = Date.now();
      for (const id in conns) {
        const c = conns[id];
        if (c.closed) continue;
        if (now - c.seen > 12000) c.close(); else c.send({ t: 'hb' });
      }
    }, 4000);
  }

  function relayJoin(client, me, code, cb, onFail) {
    const cid = 'r' + Math.random().toString(36).slice(2, 10);
    const host = TOPIC + code + '/h';
    let i = 0, joined = false, lastHeard = 0;
    const tryNext = () => {
      if (client.closed) return;
      if (i >= BROKERS.length) { onFail(); return; }
      const mq = new Mqtt(BROKERS[i++], () => {
        mq.sub(TOPIC + code + '/c/' + cid);
        mq.pub(host, { t: 'hello', from: cid, name: me.name, avatar: me.avatar });
        // no welcome within a few seconds: the room is not on this broker, try the next one
        setTimeout(() => { if (!joined) { mq.close(); tryNext(); } }, 6000);
      }, (topic, m) => {
        lastHeard = Date.now();
        if (m.t === 'welcome' && !joined) {
          joined = true;
          client.mq = mq;
          client.relaySend = (x) => mq.pub(host, Object.assign({ from: cid }, x));
          client.ping = setInterval(() => {
            client.relaySend({ t: 'ping' });
            if (Date.now() - lastHeard > 20000) { clearInterval(client.ping); mq.close(); cb.onError('Disconnected from the host.'); }
          }, 4000);
        }
        if (m.t !== 'hb') client.onData(m);
      }, (was) => { if (!joined) { if (!was) tryNext(); } else if (!client.closed) cb.onError('Disconnected from the host.'); });
    };
    tryNext();
  }

  // ---------------------------------------------------------------- host
  BR.Host = function (me, cb) {
    const self = this;
    this.code = code5();
    this.roster = [Object.assign({ id: 'host' }, me)];
    this.conns = {};
    this.game = null;
    this.lastSent = 0;
    // the room opens once the relay is up (friends anywhere can join), or after 8s with only the direct link
    let ready = false, relayUp = false, waited = false;
    const up = () => { if (!ready) { ready = true; cb.onReady(self.code); } };
    const check = () => { if (relayUp || (self.peerUp && waited)) up(); };
    setTimeout(() => { waited = true; check(); if (!ready) setTimeout(() => { if (!ready) cb.onError(self.peerErr || 'Cannot reach the online server. Check your internet.'); }, 7000); }, 8000);
    relayHost(this, () => { relayUp = true; check(); });
    try {
      this.peer = new Peer(PREFIX + this.code, opts());
      this.peer.on('open', () => { self.peerUp = true; check(); });
      this.peer.on('error', (e) => {
        if (e.type === 'unavailable-id') { self.peer.destroy(); cb.onError('Room code clash, please try again.'); }
        // other direct-link errors are not fatal: the relay may still carry the room (the 15s timeout reports a real failure)
        else self.peerErr = netMsg(e);
      });
    } catch (e) { this.peer = null; }
    if (this.peer) this.peer.on('connection', (conn) => {
      conn.on('data', (m) => self.onData(conn, m));
      conn.on('close', () => self.onClose(conn));
    });
    this.cb = cb;
  };
  BR.Host.prototype.onData = function (conn, m) {
    if (m.t === 'hello') {
      if (this.game) { conn.send({ t: 'error', msg: 'Game already started' }); return; }
      if (this.roster.length >= 6) { conn.send({ t: 'error', msg: 'Room is full' }); return; }
      const id = 'c' + conn.peer.slice(-6);
      this.conns[id] = conn;
      conn.brId = id;
      this.roster.push({ id, name: String(m.name || 'Trader').slice(0, 14), avatar: m.avatar, color: BR.COLORS[this.roster.length % 6] });
      conn.send({ t: 'welcome', id, code: this.code });
      this.lobby();
    } else if (m.t === 'act' && this.game && conn.brId) {
      const err = BR.act(this.game, conn.brId, m.a);
      if (err) conn.send({ t: 'error', msg: err });
      this.flush(true);
    }
  };
  BR.Host.prototype.onClose = function (conn) {
    const id = conn.brId;
    if (!id) return;
    delete this.conns[id];
    if (this.game) {
      const p = BR.util.player(this.game, id);
      if (p) { p.connected = false; p.bot = 'normal'; p.ready = true; p.name += ' (bot)'; }
    } else {
      this.roster = this.roster.filter((r) => r.id !== id);
      this.lobby();
    }
  };
  BR.Host.prototype.addBot = function () {
    if (this.roster.length >= 6) return;
    const used = this.roster.map((r) => r.name);
    const name = BR.BOT_NAMES.find((n) => !used.includes(n)) || 'Bot';
    this.roster.push({ id: 'b' + this.roster.length + Date.now() % 1000, name, bot: 'normal', avatar: BR.AVATARS[(this.roster.length * 3) % BR.AVATARS.length], color: BR.COLORS[this.roster.length % 6] });
    this.lobby();
  };
  BR.Host.prototype.lobby = function () {
    const list = this.roster.map((r) => ({ name: r.name, avatar: r.avatar, bot: !!r.bot }));
    for (const id in this.conns) this.conns[id].send({ t: 'lobby', list });
    this.cb.onLobby(list);
  };
  BR.Host.prototype.start = function (settings) {
    this.game = BR.createGame(Object.assign({ auto: true }, settings), this.roster);
    for (const id in this.conns) this.conns[id].send({ t: 'start' });
    this.flush(true);
    return this.game;
  };
  BR.Host.prototype.flush = function (force) {
    const now = Date.now();
    if (!force && now - this.lastSent < 400) return;
    this.lastSent = now;
    for (const id in this.conns) {
      try { this.conns[id].send({ t: 'state', s: BR.viewFor(this.game, id) }); } catch (e) { /* closed */ }
    }
  };
  BR.Host.prototype.close = function () {
    try { if (this.peer) this.peer.destroy(); } catch (e) { /* ignore */ }
    clearInterval(this.relayTimer);
    (this.relays || []).forEach((m) => m.close());
  };

  // ---------------------------------------------------------------- client
  // mode 'wifi' tries a direct link first and falls back to the relay; 'net' goes straight to the relay
  BR.Client = function (me, code, cb, mode) {
    const self = this;
    this.id = null;
    this.state = null;
    this.cb = cb;
    code = code.toUpperCase();
    const relay = () => {
      if (self.closed || self.mq) return;
      if (self.peer) { try { self.peer.destroy(); } catch (e) { /* ignore */ } self.peer = null; }
      self.conn = null;
      relayJoin(self, me, code, cb, () => cb.onError('Could not reach that room. Check the code and your internet.'));
    };
    if (mode === 'net' || typeof Peer === 'undefined') { relay(); return; }
    let to = setTimeout(relay, 8000);
    this.peer = new Peer(opts());
    this.peer.on('open', () => {
      const conn = self.peer.connect(PREFIX + code, { reliable: true });
      self.conn = conn;
      conn.on('open', () => { clearTimeout(to); conn.send({ t: 'hello', name: me.name, avatar: me.avatar }); });
      conn.on('data', (m) => self.onData(m));
      conn.on('close', () => { if (self.conn === conn && !self.closed) cb.onError('Disconnected from the host.'); });
    });
    this.peer.on('error', () => { clearTimeout(to); relay(); });
  };
  BR.Client.prototype.onData = function (m) {
    if (m.t === 'welcome') { this.id = m.id; this.cb.onJoined(m.code); }
    else if (m.t === 'lobby') this.cb.onLobby(m.list);
    else if (m.t === 'start') this.cb.onStart();
    else if (m.t === 'state') { this.state = m.s; this.cb.onState(m.s); }
    else if (m.t === 'error') this.cb.onActError(m.msg);
  };
  BR.Client.prototype.send = function (a) {
    if (this.relaySend) this.relaySend({ t: 'act', a });
    else if (this.conn) this.conn.send({ t: 'act', a });
  };
  BR.Client.prototype.close = function () {
    this.closed = true;
    if (this.relaySend) this.relaySend({ t: 'bye' });
    clearInterval(this.ping);
    const mq = this.mq; if (mq) setTimeout(() => mq.close(), 200);
    try { if (this.peer) this.peer.destroy(); } catch (e) { /* ignore */ }
  };

  function netMsg(e) {
    if (e.type === 'peer-unavailable') return 'Room not found. Check the code.';
    if (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error') return 'Cannot reach the online server. Check your internet.';
    if (e.type === 'browser-incompatible') return 'This device does not support online play.';
    return 'Connection problem: ' + (e.type || e.message || e);
  }
})(window.BR = window.BR || {});
