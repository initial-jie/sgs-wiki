// 枪鸣锈语房间 —— worker 侧:页面 / 数据路由 + QmxyRoomDO(Durable Object)。由 prototype/worker/src/index.js 路由进来。
// 逻辑在 ./shared/qmxy-logic.mjs(与 node 模拟 qmxy-sim 同一份);DO 外壳见 common/room-do.mjs。

import { QmxyCore } from "./shared/qmxy-logic.mjs";
import { HEROES, NPCS, IDENTITIES, ID_KEYS, DEFAULT_ID_COUNTS, CARDS, POINT_DISTRIBUTION, ART_BASE } from "./shared/qmxy-data.mjs";
import { RoomDOBase, jsonResponse, htmlResponse, routeRoomWs } from "../common/room-do.mjs";
import QMXY_HTML from "./client/qmxy.html";
import PINYIN from "./shared/hero-pinyin.json"; // 角色名→拼音(build-pinyin.mjs 生成),贴到 py 字段供选角拼音搜索

const SEAT_COUNT = 5; // 3~8 人,开房默认 5 座,房内可增减(3 人局把 3 个座位标成 NPC 隔开)
const DATA_JSON = JSON.stringify({
  heroes: HEROES.map((h) => (PINYIN[h.name] ? { ...h, py: PINYIN[h.name] } : h)),
  artBase: ART_BASE, npcs: NPCS, identities: IDENTITIES, idKeys: ID_KEYS, defaultIdCounts: DEFAULT_ID_COUNTS, cards: CARDS, points: POINT_DISTRIBUTION,
});

function fnv1a(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); }
const DATA_VER = fnv1a(DATA_JSON);
const PAGE_HTML = QMXY_HTML.replace("__QMXY_DATA_VER__", DATA_VER);

// 返回 Response 或 null(不归我管)
export function handleQmxy(request, env, url) {
  const wsRes = routeRoomWs(url, request, env.QMXY_ROOM, "/api/qmxy"); // /api/qmxy/<4位码>/ws
  if (wsRes) return wsRes;
  if (request.method !== "GET") return null;
  if (url.pathname === "/qmxy" || url.pathname === "/qmxy/") return htmlResponse(PAGE_HTML);
  if (url.pathname === "/qmxy/data.json") return jsonResponse(DATA_JSON, url.searchParams.get("v") === DATA_VER ? 31536000 : 60);
  return null;
}

export class QmxyRoomDO extends RoomDOBase {
  createCore() { return new QmxyCore("room", SEAT_COUNT); }
  hydrateCore(saved) { return QmxyCore.hydrate(saved); }
  // 没有额外的顶层消息:一切游戏操作都走通用 action{op,…}
}
