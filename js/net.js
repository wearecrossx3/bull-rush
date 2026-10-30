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

  // ---------------------------------------------------------------- host
  BR.Host = function (me, cb) {
    const self = this;
    this.code = code5();
    this.roster = [Object.assign({ id: 'host' }, me)];
    this.conns = {};
    this.game = null;
    this.lastSent = 0;
    this.peer = new Peer(PREFIX + this.code, opts());
    this.peer.on('open', () => cb.onReady(self.code));
    this.peer.on('error', (e) => {
      if (e.type === 'unavailable-id') { self.peer.destroy(); cb.onError('Room code clash, please try again.'); }
      else cb.onError(netMsg(e));
    });
    this.peer.on('connection', (conn) => {
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
  BR.Host.prototype.close = function () { try { this.peer.destroy(); } catch (e) { /* ignore */ } };

  // ---------------------------------------------------------------- client
  BR.Client = function (me, code, cb) {
    const self = this;
    this.id = null;
    this.state = null;
    this.cb = cb;
    this.peer = new Peer(opts());
    this.peer.on('open', () => {
      const conn = self.peer.connect(PREFIX + code.toUpperCase(), { reliable: true });
      self.conn = conn;
      const to = setTimeout(() => cb.onError('Could not reach that room. Check the code.'), 12000);
      conn.on('open', () => { clearTimeout(to); conn.send({ t: 'hello', name: me.name, avatar: me.avatar }); });
      conn.on('data', (m) => self.onData(m));
      conn.on('close', () => cb.onError('Disconnected from the host.'));
    });
    this.peer.on('error', (e) => cb.onError(netMsg(e)));
  };
  BR.Client.prototype.onData = function (m) {
    if (m.t === 'welcome') { this.id = m.id; this.cb.onJoined(m.code); }
    else if (m.t === 'lobby') this.cb.onLobby(m.list);
    else if (m.t === 'start') this.cb.onStart();
    else if (m.t === 'state') { this.state = m.s; this.cb.onState(m.s); }
    else if (m.t === 'error') this.cb.onActError(m.msg);
  };
  BR.Client.prototype.send = function (a) { if (this.conn) this.conn.send({ t: 'act', a }); };
  BR.Client.prototype.close = function () { try { this.peer.destroy(); } catch (e) { /* ignore */ } };

  function netMsg(e) {
    if (e.type === 'peer-unavailable') return 'Room not found. Check the code.';
    if (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error') return 'Cannot reach the online server. Check your internet.';
    if (e.type === 'browser-incompatible') return 'This device does not support online play.';
    return 'Connection problem: ' + (e.type || e.message || e);
  }
})(window.BR = window.BR || {});
