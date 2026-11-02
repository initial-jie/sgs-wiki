// 一夜终极狼人房间 —— worker 侧:页面 / 数据路由 + OnuwRoomDO(Durable Object)。由 prototype/worker/src/index.js 路由进来。
// 逻辑在 ./shared/onuw-logic.mjs(与 node 模拟 onuw-sim 同一份);DO 外壳见 common/room-do.mjs。
// 定时:客户端到点发 {type:"action",op:"tick"};tick 没推进任何状态时不广播不落盘(onGameMessage 返回 undefined),避免多台手机每秒唤醒 DO。

import { OnuwCore } from "./shared/onuw-logic.mjs";
import { ROLES, TEAMS, NIGHT_ORDER, ARTIFACTS, NARR, DEFAULT_FILL } from "./shared/onuw-data.mjs";
import { RoomDOBase, jsonResponse, htmlResponse, routeRoomWs } from "../common/room-do.mjs";
import ONUW_HTML from "./client/onuw.html";

const SEAT_COUNT = 5; // 3~10 人,开房默认 5 座
const DATA_JSON = JSON.stringify({ roles: ROLES, teams: TEAMS, nightOrder: NIGHT_ORDER, artifacts: ARTIFACTS, defaultFill: DEFAULT_FILL,
  narr: { nightStart: NARR.nightStart, nightEnd: NARR.nightEnd, voteClosed: NARR.voteClosed } });

function fnv1a(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); }
const DATA_VER = fnv1a(DATA_JSON);
const PAGE_HTML = ONUW_HTML.replace("__ONUW_DATA_VER__", DATA_VER);

// 返回 Response 或 null(不归我管)
export function handleOnuw(request, env, url) {
  const wsRes = routeRoomWs(url, request, env.ONUW_ROOM, "/api/onuw"); // /api/onuw/<4位码>/ws
  if (wsRes) return wsRes;
  if (request.method !== "GET") return null;
  if (url.pathname === "/onuw" || url.pathname === "/onuw/") return htmlResponse(PAGE_HTML);
  if (url.pathname === "/onuw/data.json") return jsonResponse(DATA_JSON, url.searchParams.get("v") === DATA_VER ? 31536000 : 60);
  return null;
}

export class OnuwRoomDO extends RoomDOBase {
  createCore() { return new OnuwCore("room", SEAT_COUNT); }
  hydrateCore(saved) { return OnuwCore.hydrate(saved); }
  // 通用 action 之外:tick 幂等推进,没变化就不广播
  onGameMessage(ws, msg, core) {
    if (msg.type === "tick") { const r = core.action(this.dev(ws) || "tick", { op: "tick" }); return r && r.changed ? r : undefined; }
    return undefined;
  }
}
