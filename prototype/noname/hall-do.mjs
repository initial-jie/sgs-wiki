// 无名杀联机大厅(中转)—— 把 libnoname/noname packages/server/src/server/createServer.ts(≈430 行,GPL-3.0)的协议移植成
// Cloudflare Durable Object,零成本挂在我们现有的 worker 上。单例(idFromName("hall")),客户端「联机大厅」填 wss://<worker>/noname/。
//
// 协议(与原版一致,客户端不用改):
//   客户端 → 大厅:JSON 数组 ["server", <type>, ...args],type ∈ create/enter/changeAvatar/key/events/config/status/send/close;
//                 已加入房间的玩家(有 owner)发的任何消息原样转给房主:["onmessage", wsid, raw];"heartbeat" 字符串=心跳应答。
//   大厅 → 客户端:JSON 数组 ["roomlist"|"updaterooms"|"updateclients"|"updateevents"|"createroom"|"enterroomfailed"|
//                 "onconnection"|"onmessage"|"onclose"|"selfclose"|"reloadroom"|"denied"|"eventsdenied", ...];"heartbeat" 字符串。
//   房主自己的客户端跑整局游戏,大厅只做转发(非服务端权威)。
//
// 休眠(Hibernation API):每个连接的元数据(wsid/昵称/头像/onlineKey/status/owner/room/servermode)存在 ws attachment 里,
// 房间表存 storage("rooms"),约战(events)只存内存(丢了无所谓)。心跳用 alarm 每 60s 跑一次(只在有人在线时)。
// 原版的封禁(bannedKeys/Ips/关键词)没移植——朋友圈私用。

const HEARTBEAT_MS = 60000;
const nickname = (s) => (typeof s === "string" ? s.slice(0, 12) : "无名玩家");
const newId = () => Math.floor(1e9 + Math.random() * 9e9).toString();

export class NonameHallDO {
  constructor(state, env) {
    this.state = state; this.env = env;
    this.events = []; // 约战:仅内存
    this._rooms = null; // storage 缓存
  }

  // ── 连接元数据(attachment) ──
  meta(ws) { try { return ws.deserializeAttachment() || {}; } catch { return {}; } }
  setMeta(ws, patch) { const m = { ...this.meta(ws), ...patch }; try { ws.serializeAttachment(m); } catch { /* ignore */ } return m; }
  sockets() { try { return this.state.getWebSockets(); } catch { return []; } }
  byId(id) { return this.sockets().find((ws) => this.meta(ws).wsid === id) || null; }
  sendl(ws, ...args) { try { ws.send(JSON.stringify(args)); } catch { try { ws.close(); } catch { /* ignore */ } } }

  // ── 房间表(storage) ──
  async rooms() { if (!this._rooms) this._rooms = (await this.state.storage.get("rooms")) || {}; return this._rooms; }
  async saveRooms() { await this.state.storage.put("rooms", this._rooms || {}); }

  async buildRoomList() {
    const rooms = await this.rooms(), out = [], count = {};
    for (const ws of this.sockets()) { const m = this.meta(ws); if (m.room && !m.servermode) count[m.room] = (count[m.room] || 0) + 1; }
    let dirty = false;
    for (const key of Object.keys(rooms)) {
      const room = rooms[key], owner = this.byId(room.ownerId);
      if (!owner) { delete rooms[key]; dirty = true; continue; } // 房主已走(休眠期间掉线等):清房
      if (room.servermode) out.push("server");
      else if (room.config) {
        const c = count[key] || 0;
        if (c === 0) this.sendl(owner, "reloadroom");
        const om = this.meta(owner);
        out.push([om.nickname, om.avatar, room.config, c, key]);
      }
    }
    if (dirty) await this.saveRooms();
    return out;
  }
  buildClientList() { return this.sockets().map((ws) => { const m = this.meta(ws); return [m.nickname, m.avatar, !m.room, m.status, m.wsid, m.onlineKey]; }); }
  async updateRooms() {
    const rl = await this.buildRoomList(), cl = this.buildClientList();
    for (const ws of this.sockets()) if (!this.meta(ws).room) this.sendl(ws, "updaterooms", rl, cl);
  }
  updateClients() { const cl = this.buildClientList(); for (const ws of this.sockets()) if (!this.meta(ws).room) this.sendl(ws, "updateclients", cl); }
  checkEvents() { const now = Date.now(); this.events = this.events.filter((e) => e.utc > now); return this.events; }
  updateEvents() { this.checkEvents(); for (const ws of this.sockets()) if (!this.meta(ws).room) this.sendl(ws, "updateevents", this.events); }

  // ── HTTP:只接 WebSocket 升级 ──
  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") return new Response("noname hall: websocket only", { status: 426 });
    const pair = new WebSocketPair(), [client, server] = Object.values(pair);
    this.state.acceptWebSocket(server);
    const wsid = newId();
    this.setMeta(server, { wsid, nickname: "无名玩家", avatar: "", ip: request.headers.get("CF-Connecting-IP") || "", onlineKey: null, status: null, owner: null, room: null, servermode: false, beat: false });
    this.sendl(server, "roomlist", await this.buildRoomList(), this.checkEvents(), this.buildClientList(), wsid);
    if ((await this.state.storage.getAlarm()) == null) await this.state.storage.setAlarm(Date.now() + HEARTBEAT_MS);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, data) {
    const raw = typeof data === "string" ? data : new TextDecoder().decode(data);
    const m = this.meta(ws);
    if (raw === "heartbeat") { this.setMeta(ws, { beat: false }); return; }
    if (m.owner) { // 房内玩家 → 原样转给房主
      const owner = this.byId(m.owner);
      if (owner) this.sendl(owner, "onmessage", m.wsid, raw);
      return;
    }
    let arr;
    try { arr = JSON.parse(raw); if (!Array.isArray(arr)) throw new Error(); } catch { this.sendl(ws, "denied", "banned"); return; }
    if (arr.shift() !== "server") return;
    const type = arr.shift();
    const h = this.handlers[type];
    if (!h) { console.log("[noname-hall] unknown type", type); return; }
    try { await h.call(this, ws, m, ...arr); }
    catch (e) { console.log("[noname-hall] handler error", type, e && e.stack || e); }
  }
  async webSocketClose(ws) { await this.onClose(ws); }
  async webSocketError(ws) { await this.onClose(ws); }
  async onClose(ws) {
    const m = this.meta(ws);
    try { ws.close(1000, "bye"); } catch { /* 已关 */ }
    const rooms = await this.rooms(); let dirty = false;
    for (const key of Object.keys(rooms)) {
      if (rooms[key].ownerId !== m.wsid) continue;
      for (const c of this.sockets()) { const cm = this.meta(c); if (cm.room === key && cm.wsid !== m.wsid) this.sendl(c, "selfclose"); }
      delete rooms[key]; dirty = true;
    }
    if (dirty) await this.saveRooms();
    if (m.owner) { const owner = this.byId(m.owner); if (owner) this.sendl(owner, "onclose", m.wsid); }
    if (!this.sockets().length) return; // 没人了:不用广播(让 DO 尽快空闲)
    if (m.room) await this.updateRooms(); else this.updateClients();
  }

  // 心跳:每 60s 向所有连接发 "heartbeat";上一轮没应答的关掉。没人在线就不再续闹钟
  async alarm() {
    const list = this.sockets();
    for (const ws of list) {
      const m = this.meta(ws);
      if (m.beat) { try { ws.close(1000, "heartbeat timeout"); } catch { /* ignore */ } continue; }
      this.setMeta(ws, { beat: true });
      try { ws.send("heartbeat"); } catch { try { ws.close(); } catch { /* ignore */ } }
    }
    if (this.sockets().length) await this.state.storage.setAlarm(Date.now() + HEARTBEAT_MS);
  }

  handlers = {
    async create(ws, m, key, nick, avatar, config, mode) {
      if (m.onlineKey !== key) return;
      this.setMeta(ws, { nickname: nickname(nick), avatar, room: key, status: null });
      const rooms = await this.rooms(); rooms[key] = { key, ownerId: m.wsid, config: null, servermode: false }; await this.saveRooms();
      this.sendl(ws, "createroom", key);
      await this.updateRooms();
    },
    async enter(ws, m, key, nick, avatar) {
      const rooms = await this.rooms(), room = rooms[key];
      if (!room) return this.sendl(ws, "enterroomfailed");
      this.setMeta(ws, { nickname: nickname(nick), avatar, room: key, status: null });
      const owner = this.byId(room.ownerId);
      if (!owner) return this.sendl(ws, "enterroomfailed");
      if (!room.config || (room.config.gameStarted && (!room.config.observe || !room.config.observeReady))) return this.sendl(ws, "enterroomfailed");
      this.setMeta(ws, { owner: room.ownerId });
      this.sendl(owner, "onconnection", m.wsid);
      await this.updateRooms();
    },
    async changeAvatar(ws, m, nick, avatar) { this.setMeta(ws, { nickname: nickname(nick), avatar }); this.updateClients(); },
    async key(ws, m, id) {
      if (!id || typeof id !== "object") { this.sendl(ws, "denied", "key"); try { ws.close(); } catch { /* ignore */ } return; }
      this.setMeta(ws, { onlineKey: id[0] });
    },
    async events(ws, m, cfg, id, type) {
      if (typeof id !== "string" || m.onlineKey !== id) return;
      let changed = false; const now = Date.now();
      if (typeof cfg === "string") {
        for (const ev of this.events) if (ev.id === cfg) {
          if (type === "join" && !ev.members.includes(id)) { ev.members.push(id); changed = true; }
          if (type === "leave") { const i = ev.members.indexOf(id); if (i !== -1) { ev.members.splice(i, 1); if (!ev.members.length) this.events.splice(this.events.indexOf(ev), 1); changed = true; } }
        }
      } else if (cfg && typeof cfg === "object" && "utc" in cfg && "day" in cfg && "hour" in cfg && "content" in cfg) {
        if (this.events.length >= 20) this.sendl(ws, "eventsdenied", "total");
        else if (cfg.utc <= now) this.sendl(ws, "eventsdenied", "time");
        else { this.events.unshift({ ...cfg, nickname: nickname(cfg.nickname), avatar: cfg.avatar || "caocao", creator: id, id: newId(), members: [id] }); changed = true; }
      }
      if (changed) this.updateEvents();
    },
    async config(ws, m, config) {
      const rooms = await this.rooms(), room = m.room && rooms[m.room];
      if (!room || room.ownerId !== m.wsid) return;
      room.servermode = false; room.config = config; await this.saveRooms();
      await this.updateRooms();
    },
    async status(ws, m, str) { this.setMeta(ws, { status: typeof str === "string" ? str : null }); this.updateClients(); },
    async send(ws, m, id, message) { // 房主 → 某个房内玩家(原样)
      const target = this.byId(id);
      if (target && this.meta(target).owner === m.wsid) { try { target.send(message); } catch { try { target.close(); } catch { /* ignore */ } } }
    },
    async close(ws, m, id) { const target = this.byId(id); if (target && this.meta(target).owner === m.wsid) { try { target.close(1000, "closed by host"); } catch { /* ignore */ } } },
  };
}
