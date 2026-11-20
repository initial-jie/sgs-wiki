// 情书房间 —— worker 侧:页面 / 数据路由 + LoveLetterRoomDO(Durable Object)。由 prototype/worker/src/index.js 路由进来。
// 逻辑在 ./shared/ll-logic.mjs(与 node 模拟 ll-sim 同一份);DO 外壳见 common/room-do.mjs。全部事件驱动,没有 tick。

import { LoveLetterCore } from "./shared/ll-logic.mjs";
import { CARDS, EDITIONS, DEFAULT_EDITION, ART_BASE } from "./shared/ll-data.mjs";
import { RoomDOBase, jsonResponse, htmlResponse, routeRoomWs } from "../common/room-do.mjs";
import LL_HTML from "./client/loveletter.html";

const SEAT_COUNT = 4; // 2~6 人,开房默认 4 座
const DATA_JSON = JSON.stringify({ cards: CARDS, editions: EDITIONS, defaultEdition: DEFAULT_EDITION, artBase: ART_BASE });

function fnv1a(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); }
const DATA_VER = fnv1a(DATA_JSON);
const PAGE_HTML = LL_HTML.replace("__LL_DATA_VER__", DATA_VER);

// 返回 Response 或 null(不归我管)
export function handleLoveLetter(request, env, url) {
  const wsRes = routeRoomWs(url, request, env.LOVELETTER_ROOM, "/api/loveletter"); // /api/loveletter/<4位码>/ws
  if (wsRes) return wsRes;
  if (request.method !== "GET") return null;
  if (url.pathname === "/loveletter" || url.pathname === "/loveletter/") return htmlResponse(PAGE_HTML);
  if (url.pathname === "/loveletter/data.json") return jsonResponse(DATA_JSON, url.searchParams.get("v") === DATA_VER ? 31536000 : 60);
  return null;
}

export class LoveLetterRoomDO extends RoomDOBase {
  createCore() { return new LoveLetterCore("room", SEAT_COUNT); }
  hydrateCore(saved) { return LoveLetterCore.hydrate(saved); }
}
