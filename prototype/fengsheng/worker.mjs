// 风声房间 —— worker 侧:页面 / 数据路由 + FsRoomDO(Durable Object)。由 prototype/worker/src/index.js 路由进来。
// 逻辑在 ./shared/fs-logic.mjs(与 node 模拟 fs-sim 同一份);DO 外壳见 common/room-do.mjs。

import { FsCore } from "./shared/fs-logic.mjs";
import { CHARACTERS, CARDS, TASKS, FACTIONS, DEFAULT_ID_COUNTS, INTEL_KINDS } from "./shared/fs-data.mjs";
import { RoomDOBase, jsonResponse, htmlResponse, routeRoomWs } from "../common/room-do.mjs";
import FS_HTML from "./client/fs.html";

const SEAT_COUNT = 5; // 风声 3~9 人,开房默认 5 座,房内可增减
const DATA_JSON = JSON.stringify({ characters: CHARACTERS, cards: CARDS, tasks: TASKS, factions: FACTIONS, defaultIdCounts: DEFAULT_ID_COUNTS, intelKinds: INTEL_KINDS });

// 返回 Response 或 null(不归我管)
export function handleFengsheng(request, env, url) {
  const wsRes = routeRoomWs(url, request, env.FS_ROOM, "/api/fs"); // /api/fs/<4位码>/ws
  if (wsRes) return wsRes;
  if (request.method !== "GET") return null;
  if (url.pathname === "/fs" || url.pathname === "/fs/") return htmlResponse(FS_HTML);
  if (url.pathname === "/fs/data.json") return jsonResponse(DATA_JSON);
  return null;
}

export class FsRoomDO extends RoomDOBase {
  createCore() { return new FsCore("room", SEAT_COUNT); }
  hydrateCore(saved) { return FsCore.hydrate(saved); }
  // 风声没有额外的顶层消息:一切游戏操作都走通用 action{op,…}
}
