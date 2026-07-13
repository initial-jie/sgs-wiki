// SGS 房间服务端 —— Cloudflare Workers + Durable Object
// 复用 ../../shared/room-logic.mjs 的 RoomCore(与 node 模拟同一份逻辑)。
// 本地跑:cd prototype/worker && npx wrangler dev
// 部署:  npx wrangler deploy

import { RoomCore } from "../../shared/room-logic.mjs";
import ROOM_HTML from "../../client/room.html"; // 文本模块(见 wrangler.toml [[rules]] Text)
import GENERALS_DATA from "../../shared/generals.json"; // OL 全量武将库(点座位看技能 / 神典韦roll池的数据源)
import DERIVED_DATA from "../../shared/derived-skills.json"; // 常见武将牌衍生技(查将时带出;从 index.html 衍生技区抽取)
import DERIVED_ROOM from "../../shared/derived-skills-room.json"; // 房间专属补充(如魔张飞入魔修改版,不进 wiki)
import DCARDS_DATA from "../../shared/derived-cards.json"; // 常见武将牌衍生牌(查将时带出;从 index.html 衍生牌区抽取,按来源武将存)
import DCARDS_ROOM from "../../shared/derived-cards-room.json"; // 房间专属衍生牌(神黄月英三神装/族陆绩浑天仪等,不进 wiki)

const SEAT_COUNT = 8; // 三国杀常见 2~8 人;先固定 8,后续可由开房参数决定
const GENERALS_JSON = JSON.stringify(GENERALS_DATA); // 一次序列化,静态资源直接吐
// 合并 wiki 抽取的衍生技 + 房间专属补充(同名武将则数组拼接;房间补充仅房间可见)
const DERIVED_MERGED = (() => {
  const out = {};
  for (const k of Object.keys(DERIVED_DATA)) out[k] = DERIVED_DATA[k].slice();
  for (const k of Object.keys(DERIVED_ROOM)) out[k] = (out[k] || []).concat(DERIVED_ROOM[k]);
  return out;
})();
const DERIVED_JSON = JSON.stringify(DERIVED_MERGED); // 衍生技(小),同上
// 合并 wiki 抽取的衍生牌 + 房间专属补充(同名武将则数组拼接;房间补充仅房间可见)
const DCARDS_MERGED = (() => {
  const out = {};
  for (const k of Object.keys(DCARDS_DATA)) out[k] = DCARDS_DATA[k].slice();
  for (const k of Object.keys(DCARDS_ROOM)) out[k] = (out[k] || []).concat(DCARDS_ROOM[k]);
  return out;
})();
const DCARDS_JSON = JSON.stringify(DCARDS_MERGED);   // 衍生牌(小),同上
const ROOM_TTL_MS = 2 * 60 * 60 * 1000; // 房间闲置存活:每次操作把 TTL 推后到"此刻+2h";到点自动清盘=房间消失

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

    // 武将库(只读参考数据):点座位看技能 / 神典韦roll池 共用。同源、可缓存,别被下面的 catch-all 吞掉。
    if (url.pathname === "/generals.json" && request.method === "GET") {
      return new Response(GENERALS_JSON, {
        headers: {
          "content-type": "application/json; charset=utf-8",
          // 数据只在 deploy 时变;缓存 1h + 后台再验,改完最多 1h 生效(不再卡一整天)
          "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
        },
      });
    }

    // 衍生技/衍生牌(只读参考数据):查将时带出。同源、可缓存。
    if (url.pathname === "/derived-skills.json" && request.method === "GET") {
      return new Response(DERIVED_JSON, {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
        },
      });
    }
    if (url.pathname === "/derived-cards.json" && request.method === "GET") {
      return new Response(DCARDS_JSON, {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
        },
      });
    }

    // 其余 GET 一律吐客户端页 —— 手机开 https://<你的域名>/ 即可,"服务端"自动填成同源 wss
    if (request.method === "GET") {
      return new Response(ROOM_HTML, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          // 客户端页每次都回源校验,deploy 后刷新即拿新版(不再有桌面浏览器缓存旧页的坑)
          "cache-control": "no-cache",
        },
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

  async ensureCore() {
    // 从 DO storage 恢复(空闲被回收后重连即恢复);没有则新开。roomCode 仅展示用,DO 已按短码路由。
    if (this.core) return;
    let saved = null;
    try { saved = await this.state.storage.get("core"); } catch { /* ignore */ }
    this.core = saved ? RoomCore.hydrate(saved) : new RoomCore("room", SEAT_COUNT);
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

  async onMessage(ws, data) {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    const core = this.core;

    switch (msg.type) {
      case "hello": // { deviceId } —— 首次连接/重连,恢复该设备已认领的座位
        this.sessions.set(ws, msg.deviceId);
        core.connect(msg.deviceId);
        break;
      case "claimSeat": {
        const r = core.claimSeat(this.dev(ws), msg.seatNo);
        if (r && r.error) ws.send(JSON.stringify({ type: "error", code: r.error })); // 座位被占 → 提示需替换
        break;
      }
      case "takeoverSeat": { // 解锁替换:强制把座位从原持有设备转到本设备(前端已二次确认)
        const r = core.takeoverSeat(this.dev(ws), msg.seatNo);
        if (r && r.error) ws.send(JSON.stringify({ type: "error", code: r.error }));
        break;
      }
      case "releaseSeat": core.releaseSeat(this.dev(ws), msg.seatNo); break;
      case "disbandRoom": // 任意玩家解散房间
        await this.disband();
        return; // 已广播关闭并断开,不再 broadcast/persist
      case "setGeneral": {
        const r = core.setGeneral(this.dev(ws), msg.seatNo, msg.generalId);
        if (r && r.error) ws.send(JSON.stringify({ type: "error", code: r.error })); // 别再静默吞错(否则"工具没变"却无提示)
        break;
      }
      case "setFaction": { // 神将自选势力
        const r = core.setFaction(this.dev(ws), msg.seatNo, msg.faction);
        if (r && r.error) ws.send(JSON.stringify({ type: "error", code: r.error }));
        break;
      }
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
    await this.persist(); // 落盘 + 续期 TTL
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
