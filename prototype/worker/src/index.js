// SGS 房间服务端 —— Cloudflare Workers + Durable Object
// 复用 ../../shared/room-logic.mjs 的 RoomCore(与 node 模拟同一份逻辑)。
// 本地跑:cd prototype/worker && npx wrangler dev
// 部署:  npx wrangler deploy

import { RoomCore } from "../../shared/room-logic.mjs";
import ROOM_HTML from "../../client/room.html"; // 文本模块(见 wrangler.toml [[rules]] Text)

const SEAT_COUNT = 8; // 三国杀常见 2~8 人;先固定 8,后续可由开房参数决定

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 开房:发一个 4 位短码(房间由该短码惰性创建,首个连接者即"开房者")
    if (url.pathname === "/api/room/new") {
      const code = String(Math.floor(1000 + Math.random() * 9000));
      return Response.json({ roomCode: code });
    }

    // 加入房间的 WebSocket:/api/room/1234/ws
    const m = url.pathname.match(/^\/api\/room\/(\d{4})\/ws$/);
    if (m) {
      const id = env.ROOM.idFromName(m[1]); // 同一短码 -> 同一 DO 实例(单点权威)
      const stub = env.ROOM.get(id);
      return stub.fetch(request);
    }

    // 其余 GET 一律吐客户端页 —— 手机开 https://<你的域名>/ 即可,"服务端"自动填成同源 wss
    if (request.method === "GET") {
      return new Response(ROOM_HTML, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    return new Response("sgs-room worker up. use /api/room/new then /api/room/<code>/ws", { status: 200 });
  },
};

export class RoomDO {
  constructor(state, env) {
    this.state = state;
    this.core = null;
    this.sessions = new Map(); // ws -> deviceId
  }

  ensureCore() {
    // roomCode 仅用于展示;DO 已按短码路由,这里用占位即可
    if (!this.core) this.core = new RoomCore("room", SEAT_COUNT);
  }

  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket")
      return new Response("expected websocket", { status: 426 });

    this.ensureCore();
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    server.addEventListener("message", (e) => this.onMessage(server, e.data));
    server.addEventListener("close", () => this.onClose(server));
    server.addEventListener("error", () => this.onClose(server));
    return new Response(null, { status: 101, webSocket: client });
  }

  dev(ws) { return this.sessions.get(ws); }

  onMessage(ws, data) {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    const core = this.core;

    switch (msg.type) {
      case "hello": // { deviceId } —— 首次连接/重连,恢复该设备已认领的座位
        this.sessions.set(ws, msg.deviceId);
        core.connect(msg.deviceId);
        break;
      case "claimSeat":   core.claimSeat(this.dev(ws), msg.seatNo); break;
      case "releaseSeat": core.releaseSeat(this.dev(ws), msg.seatNo); break;
      case "setGeneral":  core.setGeneral(this.dev(ws), msg.seatNo, msg.generalId); break;
      case "action": {
        const r = core.action(this.dev(ws), msg);
        // 保密结果(如夺炁抽到的牌)只回操作者本人,不进广播
        if (r && r.ok && r.card !== undefined)
          ws.send(JSON.stringify({ type: "actionResult", card: r.card }));
        if (r && r.error) ws.send(JSON.stringify({ type: "error", code: r.error }));
        break;
      }
      default: return;
    }
    this.broadcast();
  }

  onClose(ws) {
    // 只移除连接,保留该设备的座位认领(deviceId 重连后仍是同一身份)
    this.sessions.delete(ws);
    this.broadcast();
  }

  broadcast() {
    for (const [ws, deviceId] of this.sessions) {
      try {
        ws.send(JSON.stringify({ type: "roomState", ...this.core.viewFor(deviceId) }));
      } catch { /* 连接已断,忽略 */ }
    }
  }
}
