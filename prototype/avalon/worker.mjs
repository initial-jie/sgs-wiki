// 阿瓦隆房间 —— worker 侧:页面 / 数据路由 + AvalonRoomDO(Durable Object)。由 prototype/worker/src/index.js 路由进来。
// 逻辑在 ./shared/avalon-logic.mjs(与 node 模拟 avalon-sim 同一份);DO 外壳见 common/room-do.mjs。全部事件驱动,没有 tick。

import { AvalonCore } from "./shared/avalon-logic.mjs";
import { ROLES, TEAMS, PACKS, PLAYERS, LANCELOT_MODES, ART_BASE } from "./shared/avalon-data.mjs";
import { RoomDOBase, jsonResponse, htmlResponse, routeRoomWs } from "../common/room-do.mjs";
import AVALON_HTML from "./client/avalon.html";

const SEAT_COUNT = 7; // 5~10 人,开房默认 7 座
const DATA_JSON = JSON.stringify({ roles: ROLES, teams: TEAMS, packs: PACKS, players: PLAYERS, lancelotModes: LANCELOT_MODES, artBase: ART_BASE });

function fnv1a(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); }
const DATA_VER = fnv1a(DATA_JSON);
const PAGE_HTML = AVALON_HTML.replace("__AVALON_DATA_VER__", DATA_VER);

// 返回 Response 或 null(不归我管)
export function handleAvalon(request, env, url) {
  const wsRes = routeRoomWs(url, request, env.AVALON_ROOM, "/api/avalon"); // /api/avalon/<4位码>/ws
  if (wsRes) return wsRes;
  if (request.method !== "GET") return null;
  if (url.pathname === "/avalon" || url.pathname === "/avalon/") return htmlResponse(PAGE_HTML);
  if (url.pathname === "/avalon/data.json") return jsonResponse(DATA_JSON, url.searchParams.get("v") === DATA_VER ? 31536000 : 60);
  return null;
}

export class AvalonRoomDO extends RoomDOBase {
  createCore() { return new AvalonCore("room", SEAT_COUNT); }
  hydrateCore(saved) { return AvalonCore.hydrate(saved); }
}
