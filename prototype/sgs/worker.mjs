// 三国杀房间 —— worker 侧:数据路由 + RoomDO(Durable Object)。由 prototype/sgs/worker.mjs 路由进来。
// 复用 ./shared/room-logic.mjs 的 RoomCore(与 node 模拟 room-sim 同一份逻辑);DO 外壳见 common/room-do.mjs。

import { RoomCore, setBannedPools } from "./shared/room-logic.mjs";
import { RoomDOBase, jsonResponse, htmlResponse, routeRoomWs } from "../common/room-do.mjs";
import ROOM_HTML from "./client/room.html"; // 文本模块(.html 默认即 Text)
import GENERALS_DATA from "./shared/generals.json"; // OL 全量武将库(点座位看技能 / 神典韦roll池的数据源)
import DERIVED_DATA from "./shared/derived-skills.json"; // 常见武将牌衍生技(查将时带出;从 index.html 衍生技区抽取)
import DERIVED_ROOM from "./shared/derived-skills-room.json"; // 房间专属补充(如魔张飞入魔修改版,不进 wiki)
import RULES_DATA from "./shared/rules.json"; // 规则集:身份模式规则/房规(大厅「规则集」卡,标题→iframe 整页)
import DCARDS_DATA from "./shared/derived-cards.json"; // 常见武将牌衍生牌(查将时带出;从 index.html 衍生牌区抽取,按来源武将存)
import DCARDS_ROOM from "./shared/derived-cards-room.json"; // 房间专属衍生牌(神黄月英三神装/族陆绩浑天仪等,不进 wiki)
import DERIVED_EN from "./shared/derived-en.json"; // 衍生技/牌英文补丁 {武将→{名称→英文}};独立文件,重抽 derived-* 不丢 EN
import EQUIPMENT_DATA from "./shared/equipment.json"; // 装备牌库(#2 距离层:坐骑/装备下拉数据源;build-equipment.mjs 生成)
import BANNED_DATA from "./shared/banned-generals.json"; // ② 禁将池(全局默认;改文件+deploy 生效)
import PINYIN_DATA from "./shared/hero-pinyin.json"; // 武将名→拼音音节(build-pinyin.mjs 生成),贴到 generals.json 的 py 字段供选将拼音搜索

// ② 禁将四池:把每池的 id 映射成 setGeneral 收到的 generalId 形式(有工具→工具名,否则→String(id)),喂给 RoomCore
{
  const pools = {};
  for (const [key, pool] of Object.entries(BANNED_DATA.pools || {})) {
    const set = [];
    for (const id of (pool.ids || [])) {
      const h = GENERALS_DATA.find((x) => x.id === id);
      set.push(String(id));                // 无工具将:generalId=String(id)
      if (h && h.tool) set.push(h.tool);    // 有工具将:generalId=工具名
    }
    pools[key] = set;
  }
  setBannedPools(pools);
}

const SEAT_COUNT = 8; // 三国杀常见 2~8 人;先固定 8,后续可由开房参数决定
// 一次序列化,静态资源直接吐;顺带贴拼音(py:"guan yu")。GENERALS_DATA 本身不改(禁将池等仍按原数据查)
const GENERALS_JSON = JSON.stringify(GENERALS_DATA.map((h) => (PINYIN_DATA[h.name] ? { ...h, py: PINYIN_DATA[h.name] } : h)));
// 合并 wiki 抽取的衍生技 + 房间专属补充(同名武将则数组拼接;房间补充仅房间可见)。map 浅拷贝每条,便于下面贴 text_en 不污染 import 源
const DERIVED_MERGED = (() => {
  const out = {};
  for (const k of Object.keys(DERIVED_DATA)) out[k] = DERIVED_DATA[k].map((x) => ({ ...x }));
  for (const k of Object.keys(DERIVED_ROOM)) out[k] = (out[k] || []).concat(DERIVED_ROOM[k].map((x) => ({ ...x })));
  return out;
})();
// 合并 wiki 抽取的衍生牌 + 房间专属补充(同名武将则数组拼接;房间补充仅房间可见)
const DCARDS_MERGED = (() => {
  const out = {};
  for (const k of Object.keys(DCARDS_DATA)) out[k] = DCARDS_DATA[k].map((x) => ({ ...x }));
  for (const k of Object.keys(DCARDS_ROOM)) out[k] = (out[k] || []).concat(DCARDS_ROOM[k].map((x) => ({ ...x })));
  return out;
})();
// 衍生技/衍生牌英文补丁:按 武将→名称 贴 text_en(前端按 LANG 取 text_en||text;缺失回退中文)
for (const merged of [DERIVED_MERGED, DCARDS_MERGED]) {
  for (const hero of Object.keys(merged)) {
    const en = DERIVED_EN[hero];
    if (!en) continue;
    for (const entry of merged[hero]) if (en[entry.name] && !entry.text_en) entry.text_en = en[entry.name];
  }
}
const DERIVED_JSON = JSON.stringify(DERIVED_MERGED); // 衍生技(小),同上
const DCARDS_JSON = JSON.stringify(DCARDS_MERGED);   // 衍生牌(小),同上
const EQUIPMENT_JSON = JSON.stringify(EQUIPMENT_DATA); // 装备牌库(静态,直接吐)
const BANNED_JSON = JSON.stringify({ pools: BANNED_DATA.pools || {} }); // ② 禁将四池(客户端 fetch 标记/展示;静态)
// 规则集:目录只给 id/title/sub(小);正文由 /rules/{id}.html 吐成自包含整页,供大厅弹层 iframe 加载
const RULES_INDEX_JSON = JSON.stringify(RULES_DATA.map(({ id, title, sub }) => ({ id, title, sub })));
const RULE_PAGES = new Map(RULES_DATA.map((r) => [r.id, `<!doctype html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${r.title}</title>
<style>body{margin:0;padding:12px 14px 20px;font:15px/1.65 -apple-system,"PingFang SC","Noto Sans SC",sans-serif;color:#2b2419;background:#fbf7ef}
h1{font-size:19px;margin:0 0 2px;letter-spacing:.06em}.sub{font-size:12px;color:#7a6f60;margin:0 0 12px}h3{font-size:14px;margin:14px 0 4px;color:#a32e22;letter-spacing:.05em}
p,li{margin:4px 0}ol,ul{padding-left:1.4em}ol ol{margin-top:4px}table{border-collapse:collapse;margin:6px 0;font-size:14px}th,td{border:1px solid #d9cfbd;padding:3px 12px;text-align:center}th{background:#efe7d6}
.note{font-size:12.5px;color:#7a6f60;border-top:1px dashed #d9cfbd;padding-top:8px;margin-top:12px}.skill{font-weight:700;color:#a32e22}</style></head>
<body><h1>${r.title}</h1><p class="sub">${r.sub || ""}</p>${r.html}</body></html>`]));

// 三国杀 HTTP 路由。返回 Response 或 null(不归我管)。
export function handleSgs(request, env, url) {
  // 开房:发一个 4 位短码(房间由该短码惰性创建,首个连接者即"开房者")
  if (url.pathname === "/api/room/new") {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    return Response.json({ roomCode: code });
  }
  // 加入房间的 WebSocket:/api/room/1234/ws(同一短码 -> 同一 DO 实例)
  const wsRes = routeRoomWs(url, request, env.ROOM, "/api/room");
  if (wsRes) return wsRes;

  if (request.method === "GET") {
    // 只读参考数据(同源、可缓存):武将库 / 衍生技 / 衍生牌 / 装备 / 禁将池
    if (url.pathname === "/generals.json") return jsonResponse(GENERALS_JSON);
    if (url.pathname === "/derived-skills.json") return jsonResponse(DERIVED_JSON);
    if (url.pathname === "/derived-cards.json") return jsonResponse(DCARDS_JSON);
    if (url.pathname === "/equipment.json") return jsonResponse(EQUIPMENT_JSON);
    if (url.pathname === "/banned-generals.json") return jsonResponse(BANNED_JSON, 300);
    if (url.pathname === "/rules.json") return jsonResponse(RULES_INDEX_JSON, 300);
    if (url.pathname.startsWith("/rules/") && url.pathname.endsWith(".html")) { // 规则集正文整页(iframe)
      const page = RULE_PAGES.get(url.pathname.slice(7, -5));
      return page ? htmlResponse(page) : new Response("no such rule", { status: 404 });
    }
    // 三国杀房间页:根路径(历史入口,手机收藏的链接不变)+ /sgs
    if (url.pathname === "/" || url.pathname === "/sgs" || url.pathname === "/sgs/" || url.pathname === "/index.html") return htmlResponse(ROOM_HTML);
  }
  return null;
}

// 三国杀房间 DO。类名 RoomDO 不能改(wrangler.toml 绑定 + 已有 DO 迁移 v1)。
export class RoomDO extends RoomDOBase {
  createCore() { return new RoomCore("room", SEAT_COUNT); }
  hydrateCore(saved) { return RoomCore.hydrate(saved); }
  onGameMessage(ws, msg, core) {
    const id = this.dev(ws);
    switch (msg.type) {
      case "setBanEnabled": return core.setBanEnabled(msg.on);                      // ② 禁将总开关(房内共享,任何玩家可切)
      case "setGeneral": return core.setGeneral(id, msg.seatNo, msg.generalId);      // 别静默吞错(否则"工具没变"却无提示)
      case "setFaction": return core.setFaction(id, msg.seatNo, msg.faction);        // 神将自选势力
      default: return undefined;
    }
  }
}
