// 忍者之夜房间 —— worker 侧:页面 / 数据路由 + NinjaRoomDO(Durable Object)。由 prototype/worker/src/index.js 路由进来。
// 逻辑在 ./shared/ninja-logic.mjs(与 node 模拟 ninja-sim 同一份);DO 外壳见 common/room-do.mjs。全部事件驱动,没有 tick。

import { NinjaCore } from "./shared/ninja-logic.mjs";
import { CARDS, PHASES, HOUSES, DEFAULT_TOKENS, DEFAULT_POINTS, MIN_PLAYERS, MAX_PLAYERS } from "./shared/ninja-data.mjs";
import { RoomDOBase, jsonResponse, htmlResponse, routeRoomWs } from "../common/room-do.mjs";
import NINJA_HTML from "./client/ninja.html";

const SEAT_COUNT = 6; // 4~11 人,开房默认 6 座
const DATA_JSON = JSON.stringify({ cards: CARDS, phases: PHASES, houses: HOUSES, defaultTokens: DEFAULT_TOKENS, defaultPoints: DEFAULT_POINTS, minPlayers: MIN_PLAYERS, maxPlayers: MAX_PLAYERS });

function fnv1a(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); }
const DATA_VER = fnv1a(DATA_JSON);
const PAGE_HTML = NINJA_HTML.replace("__NINJA_DATA_VER__", DATA_VER);

// 返回 Response 或 null(不归我管)
export function handleNinja(request, env, url) {
  const wsRes = routeRoomWs(url, request, env.NINJA_ROOM, "/api/ninja"); // /api/ninja/<4位码>/ws
  if (wsRes) return wsRes;
  if (request.method !== "GET") return null;
  if (url.pathname === "/ninja" || url.pathname === "/ninja/") return htmlResponse(PAGE_HTML);
  if (url.pathname === "/ninja/data.json") return jsonResponse(DATA_JSON, url.searchParams.get("v") === DATA_VER ? 31536000 : 60);
  return null;
}

export class NinjaRoomDO extends RoomDOBase {
  createCore() { return new NinjaCore("room", SEAT_COUNT); }
  hydrateCore(saved) { return NinjaCore.hydrate(saved); }
}
