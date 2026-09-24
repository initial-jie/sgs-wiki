// 风声房间 —— worker 侧:页面 / 数据路由 + FsRoomDO(Durable Object)。由 prototype/worker/src/index.js 路由进来。
// 逻辑在 ./shared/fs-logic.mjs(与 node 模拟 fs-sim 同一份);DO 外壳见 common/room-do.mjs。

import { FsCore } from "./shared/fs-logic.mjs";
import { CHARACTERS, CARDS, TASKS, FACTIONS, DEFAULT_ID_COUNTS, INTEL_KINDS } from "./shared/fs-data.mjs";
import { RoomDOBase, jsonResponse, htmlResponse, routeRoomWs } from "../common/room-do.mjs";
import FS_HTML from "./client/fs.html";
import PINYIN from "./shared/char-pinyin.json"; // 角色名→拼音(build-pinyin.mjs 生成),贴到 py 字段供选角拼音搜索

const SEAT_COUNT = 5; // 风声 3~9 人,开房默认 5 座,房内可增减
const DATA_JSON = JSON.stringify({ characters: CHARACTERS.map((c) => (PINYIN[c.name] ? { ...c, py: PINYIN[c.name] } : c)), cards: CARDS, tasks: TASKS, factions: FACTIONS, defaultIdCounts: DEFAULT_ID_COUNTS, intelKinds: INTEL_KINDS });

// 数据版本 = DATA_JSON 的短哈希,注入页面(__FS_DATA_VER__)→ 客户端 fetch /fs/data.json?v=<哈希>。
// 数据只在 deploy 时变:URL 一变浏览器就拿新的,旧 URL 可放心长缓存(避开"deploy 后最长 1h 拿旧数据"的坑)
function fnv1a(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); }
const DATA_VER = fnv1a(DATA_JSON);
const PAGE_HTML = FS_HTML.replace("__FS_DATA_VER__", DATA_VER);

// 返回 Response 或 null(不归我管)
export function handleFengsheng(request, env, url) {
  const wsRes = routeRoomWs(url, request, env.FS_ROOM, "/api/fs"); // /api/fs/<4位码>/ws
  if (wsRes) return wsRes;
  if (request.method !== "GET") return null;
  if (url.pathname === "/fs" || url.pathname === "/fs/") return htmlResponse(PAGE_HTML);
  if (url.pathname === "/fs/data.json") return jsonResponse(DATA_JSON, url.searchParams.get("v") === DATA_VER ? 31536000 : 60);
  return null;
}

export class FsRoomDO extends RoomDOBase {
  createCore() { return new FsCore("room", SEAT_COUNT); }
  hydrateCore(saved) { return FsCore.hydrate(saved); }
  // 风声没有额外的顶层消息:一切游戏操作都走通用 action{op,…}
}
