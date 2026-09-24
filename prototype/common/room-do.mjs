// Durable Object 房间外壳(游戏无关):WebSocket 会话 / DO storage 持久化 / 闲置 TTL / 解散 / 按设备过滤广播。
// 各游戏:class XxxRoomDO extends RoomDOBase { createCore(){…} hydrateCore(saved){…} onGameMessage(ws,msg,core){…} }
//
// 通用消息(所有游戏都有):
//   hello{deviceId} / claimSeat{seatNo} / takeoverSeat{seatNo} / releaseSeat{seatNo} / rename{newId}
//   addSeat / removeSeat / disbandRoom / action{…交给 core.action(deviceId,msg)}
// 下发:roomState{…core.viewFor(deviceId)} / error{code} / renamed{newId} / roomClosed{reason} / actionResult{…}
// 游戏专属消息:onGameMessage 返回 undefined=不认识(忽略);返回 {error}=回错;返回其它=已处理(随后广播+落盘)。

export const ROOM_TTL_MS = 2 * 60 * 60 * 1000; // 房间闲置存活:每次操作把 TTL 推后到"此刻+2h";到点自动清盘=房间消失

export class RoomDOBase {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.core = null;
    this.sessions = new Map(); // ws -> deviceId
  }

  // ── 子类实现 ──
  createCore() { throw new Error("createCore not implemented"); }
  hydrateCore(/* saved */) { throw new Error("hydrateCore not implemented"); }
  onGameMessage(/* ws, msg, core */) { return undefined; }

  async ensureCore() {
    // 从 DO storage 恢复(空闲被回收后重连即恢复);没有则新开。
    if (this.core) return;
    let saved = null;
    try { saved = await this.state.storage.get("core"); } catch { /* ignore */ }
    this.core = saved ? this.hydrateCore(saved) : this.createCore();
  }

  async persist() {
    // 每次变更落盘 + 把 TTL 闹钟推后到"此刻+2h"(有人操作房间就一直活着;都不动 2h 后自动清)
    try {
      await this.state.storage.put("core", this.core.serialize());
      await this.state.storage.setAlarm(Date.now() + ROOM_TTL_MS);
    } catch { /* ignore */ }
  }

  // TTL 到点:清盘 = 房间销毁。即便无人连接,DO alarm 也会被平台唤醒执行。
  async alarm() {
    try { await this.state.storage.deleteAll(); } catch { /* ignore */ }
    this._closeAll("ttl");
  }

  // 解散房间(任意玩家可发起,前端二次确认):立即清盘 + 撤闹钟 + 广播关闭。
  async disband() {
    try { await this.state.storage.deleteAll(); } catch { /* ignore */ }
    try { await this.state.storage.deleteAlarm(); } catch { /* ignore */ }
    this._closeAll("disband");
  }

  _closeAll(reason) {
    for (const [ws] of this.sessions) {
      try { ws.send(JSON.stringify({ type: "roomClosed", reason })); ws.close(1000, reason); } catch { /* ignore */ }
    }
    this.sessions.clear();
    this.core = null;
  }

  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket")
      return new Response("expected websocket", { status: 426 });

    await this.ensureCore();
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    server.addEventListener("message", (e) => this.onMessage(server, e.data));
    server.addEventListener("close", () => this.onClose(server));
    server.addEventListener("error", () => this.onClose(server));
    return new Response(null, { status: 101, webSocket: client });
  }

  dev(ws) { return this.sessions.get(ws); }
  sendTo(ws, obj) { try { ws.send(JSON.stringify(obj)); } catch { /* ignore */ } }
  replyErr(ws, r) { if (r && r.error) this.sendTo(ws, { type: "error", code: r.error }); }

  async onMessage(ws, data) {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    await this.ensureCore(); // 解散后同一连接又发消息的兜底
    const core = this.core;
    const id = this.dev(ws);

    switch (msg.type) {
      case "hello": // { deviceId } —— 首次连接/重连,恢复该设备已认领的座位
        this.sessions.set(ws, msg.deviceId);
        core.connect(msg.deviceId);
        break;
      case "claimSeat": this.replyErr(ws, core.claimSeat(id, msg.seatNo)); break;   // 座位被占 → 提示需替换
      case "takeoverSeat": this.replyErr(ws, core.takeoverSeat(id, msg.seatNo)); break; // 解锁替换(前端已二次确认)
      case "releaseSeat": core.releaseSeat(id, msg.seatNo); break;
      case "rename": { // 房内改名:原子改键(搬 holds+座位归属),回执让发起端更新本地 deviceId
        const r = core.renameDevice(id, msg.newId);
        if (r && r.error) { this.replyErr(ws, r); break; }
        for (const [s, d] of this.sessions) if (d === id) this.sessions.set(s, r.newId); // 同设备多标签一并改
        this.sendTo(ws, { type: "renamed", newId: r.newId });
        break;
      }
      case "addSeat": this.replyErr(ws, core.addSeat(id)); break;
      case "removeSeat": this.replyErr(ws, core.removeSeat(id)); break;
      case "disbandRoom": // 任意玩家解散房间
        await this.disband();
        return; // 已广播关闭并断开,不再 broadcast/persist
      case "action": {
        const r = core.action(id, msg);
        // 保密结果只回操作者本人,不进广播:card(三国杀夺炁,历史字段)/ private(通用)
        if (r && r.ok && r.card !== undefined) this.sendTo(ws, { type: "actionResult", card: r.card });
        if (r && r.ok && r.private !== undefined) this.sendTo(ws, { type: "actionResult", private: r.private });
        this.replyErr(ws, r);
        break;
      }
      default: {
        const r = this.onGameMessage(ws, msg, core);
        if (r === undefined) return; // 不认识的消息:忽略
        this.replyErr(ws, r);
      }
    }
    this.broadcast();
    await this.persist(); // 落盘 + 续期 TTL
  }

  onClose(ws) {
    // 只移除连接,保留该设备的座位认领(deviceId 重连后仍是同一身份)
    this.sessions.delete(ws);
    if (this.core) this.broadcast();
  }

  broadcast() {
    for (const [ws, deviceId] of this.sessions) {
      try {
        ws.send(JSON.stringify({ type: "roomState", ...this.core.viewFor(deviceId) }));
      } catch { /* 连接已断,忽略 */ }
    }
  }
}

// 小工具:JSON / 静态资源响应
export function jsonResponse(body, maxAge = 3600) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      // 数据只在 deploy 时变;缓存 + 后台再验
      "cache-control": `public, max-age=${maxAge}, stale-while-revalidate=86400`,
    },
  });
}
export function htmlResponse(html) {
  // 客户端页每次都回源校验,deploy 后刷新即拿新版
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" } });
}
export function jsResponse(js) {
  return new Response(js, { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-cache" } });
}
// 每个游戏的房间 WebSocket 路由:/<prefix>/<4位码>/ws → 该游戏 DO 命名空间里同名实例(单点权威)
export function routeRoomWs(url, request, namespace, prefix) {
  const m = url.pathname.match(new RegExp("^" + prefix.replace(/\//g, "\\/") + "\\/(\\d{4})\\/ws$"));
  if (!m) return null;
  return namespace.get(namespace.idFromName(m[1])).fetch(request);
}
