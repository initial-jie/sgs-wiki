// 三国杀房间 —— worker 侧:数据路由 + RoomDO(Durable Object)。由 prototype/sgs/worker.mjs 路由进来。
// 复用 ./shared/room-logic.mjs 的 RoomCore(与 node 模拟 room-sim 同一份逻辑);DO 外壳见 common/room-do.mjs。

import { RoomCore, setBannedPools, banPoolForSeats, setHeroInfo } from "./shared/room-logic.mjs";
import { identModesForClient } from "./shared/identity.mjs"; // 身份自动发放:模式表(发身份设置弹层用)
import { buildDealPools } from "./shared/deal.mjs"; // 线上发将:组池(同名成坑/曹丕仅君主/董昭仅身份局/模式专属君主)
import { RoomDOBase, jsonResponse, htmlResponse, routeRoomWs } from "../common/room-do.mjs";
import ROOM_HTML from "./client/room.html"; // 文本模块(.html 默认即 Text)
import POOL_HTML from "./client/pool.html"; // 将池(白名单)编辑页 /pool
import PACKS_DATA from "./shared/hero-packs.json"; // 武将→所属包(olwiki 将灯),贴到 generals.json 的 pack 字段供将池编辑页分组
import POOL_SEED from "./shared/hero-pool-seed.json"; // 将池种子/备份(服务端没存过时回退)
import GENERALS_DATA from "./shared/generals.json"; // OL 全量武将库(点座位看技能 / 神典韦roll池的数据源)
import DERIVED_DATA from "./shared/derived-skills.json"; // 常见武将牌衍生技(查将时带出;从 index.html 衍生技区抽取)
import DERIVED_ROOM from "./shared/derived-skills-room.json"; // 房间专属补充(如魔张飞入魔修改版,不进 wiki)
import RULES_DATA from "./shared/rules.json"; // 规则集:身份模式规则/房规(大厅「规则集」卡,标题→iframe 整页)
import DCARDS_DATA from "./shared/derived-cards.json"; // 常见武将牌衍生牌(查将时带出;从 index.html 衍生牌区抽取,按来源武将存)
import DCARDS_ROOM from "./shared/derived-cards-room.json"; // 房间专属衍生牌(神黄月英三神装/族陆绩浑天仪等,不进 wiki)
import DERIVED_EN from "./shared/derived-en.json"; // 衍生技/牌英文补丁 {武将→{名称→英文}};独立文件,重抽 derived-* 不丢 EN
import EQUIPMENT_DATA from "./shared/equipment.json"; // 装备牌库(#2 距离层:坐骑/装备下拉数据源;build-equipment.mjs 生成)
import BANNED_DATA from "./shared/banned-generals.json"; // ② 禁将池(全局默认;改文件+deploy 生效)
import GENDER_DATA from "./shared/hero-gender.json"; // 女性武将 id(olwiki 性别);贴成 generals.json 的 gender 字段 + 喂 RoomCore(明忠〖明察〗判定)
import PINYIN_DATA from "./shared/hero-pinyin.json"; // 武将名→拼音音节(build-pinyin.mjs 生成),贴到 generals.json 的 py 字段供选将拼音搜索

// 环境(池)划分:军争/身份 · 2v2 · 斗地主 · 1v1。每个环境一份白名单(可发将)+ 一份黑名单(禁将)。
// 标签/座位数沿用 banned-generals.json;名单本身存 SgsConfigDO(/pool 页编辑,保存即生效),文件里的 ids 只作首次种子。
const POOL_KEYS = Object.keys(BANNED_DATA.pools || {}); // ["junzheng","2v2","douzhu","1v1"]
const POOL_META = Object.fromEntries(POOL_KEYS.map((k) => [k, { label: BANNED_DATA.pools[k].label, seats: BANNED_DATA.pools[k].seats }]));
// 把禁将 id 映射成 setGeneral 收到的 generalId 形式(有工具→工具名,否则→String(id)),喂给 RoomCore
function applyBans(bansByPool) {
  const pools = {};
  for (const key of POOL_KEYS) {
    const set = [];
    for (const id of (bansByPool[key] || [])) {
      const h = GENERALS_DATA.find((x) => x.id === id);
      set.push(String(id));                // 无工具将:generalId=String(id)
      if (h && h.tool) set.push(h.tool);    // 有工具将:generalId=工具名
    }
    pools[key] = set;
  }
  setBannedPools(pools);
}
applyBans(Object.fromEntries(POOL_KEYS.map((k) => [k, BANNED_DATA.pools[k].ids || []]))); // 启动默认;RoomDO.syncConfig 会用服务端配置覆盖
// 读全局配置(SgsConfigDO):{ pools:{key:{label,seats,white,ban}}, seen, updatedAt }
async function getConfig(env) {
  const r = await env.SGS_CONFIG.get(env.SGS_CONFIG.idFromName("global")).fetch("https://config/api/pool");
  return r.json();
}

// 武将基本信息喂给 RoomCore(key 同 setGeneral 的 generalId:有工具→工具名,否则 String(id))
const FEMALE_IDS = new Set(GENDER_DATA.female);
setHeroInfo(Object.fromEntries(GENERALS_DATA.map((h) => [h.tool || String(h.id), { name: h.name, hp: h.hp, female: FEMALE_IDS.has(h.id) }])));

const SEAT_COUNT = 8; // 三国杀常见 2~8 人;先固定 8,后续可由开房参数决定
// 一次序列化,静态资源直接吐;顺带贴拼音(py:"guan yu")。GENERALS_DATA 本身不改(禁将池等仍按原数据查)
// pack:所属包(缺则回退 genre)—— 新录武将没补 hero-packs.json 也能在编辑页出现
const GENERALS_JSON = JSON.stringify(GENERALS_DATA.map((h) => ({ ...h, pack: PACKS_DATA.packs[h.id] || h.genre || "其他", gender: FEMALE_IDS.has(h.id) ? "女" : "男", ...(PINYIN_DATA[h.name] ? { py: PINYIN_DATA[h.name] } : {}) })));
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
const IDENT_MODES_JSON = JSON.stringify(identModesForClient());
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

  // 将池(白名单):全局一份,存在 SgsConfigDO(单例 "global");/pool 编辑页读写,发将时房间也读它。无鉴权(朋友局,用户定)
  if (url.pathname === "/api/pool" && (request.method === "GET" || request.method === "PUT"))
    return env.SGS_CONFIG.get(env.SGS_CONFIG.idFromName("global")).fetch(request);

  if (request.method === "GET") {
    // 只读参考数据(同源、可缓存):武将库 / 衍生技 / 衍生牌 / 装备 / 禁将池
    if (url.pathname === "/generals.json") return jsonResponse(GENERALS_JSON);
    if (url.pathname === "/derived-skills.json") return jsonResponse(DERIVED_JSON);
    if (url.pathname === "/derived-cards.json") return jsonResponse(DCARDS_JSON);
    if (url.pathname === "/equipment.json") return jsonResponse(EQUIPMENT_JSON);
    if (url.pathname === "/banned-generals.json") // ② 禁将四池(客户端标记/展示):现读服务端配置,/pool 页改完即生效
      return getConfig(env).then((cfg) => new Response(JSON.stringify({ rev: cfg.updatedAt || 0,
        pools: Object.fromEntries(POOL_KEYS.map((k) => [k, { ...POOL_META[k], ids: cfg.pools[k].ban }])) }),
        { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }));
    if (url.pathname === "/rules.json") return jsonResponse(RULES_INDEX_JSON, 300);
    if (url.pathname === "/ident-modes.json") return jsonResponse(IDENT_MODES_JSON, 300); // 身份模式表(各人数默认配比/胜利条件)
    if (url.pathname.startsWith("/rules/") && url.pathname.endsWith(".html")) { // 规则集正文整页(iframe)
      const page = RULE_PAGES.get(url.pathname.slice(7, -5));
      return page ? htmlResponse(page) : new Response("no such rule", { status: 404 });
    }
    if (url.pathname === "/pool" || url.pathname === "/pool/") return htmlResponse(POOL_HTML); // 将池编辑页
    // 三国杀房间页:根路径(历史入口,手机收藏的链接不变)+ /sgs
    if (url.pathname === "/" || url.pathname === "/sgs" || url.pathname === "/sgs/" || url.pathname === "/index.html") return htmlResponse(ROOM_HTML);
  }
  return null;
}

// 三国杀全局配置 DO(单例 idFromName("global")):各环境的白名单(可发将)+ 黑名单(禁将)。
//   存储(key "pool"):{ pools:{ [环境key]:{white:[id],ban:[id]} }, seen:[id], updatedAt }
//   旧格式 {ids,seen,updatedAt}(2026-10-01 首版只有一份白名单)读取时自动迁移:ids → 军争白名单,黑名单取文件种子。
// 不继承 RoomDOBase —— 没有 WebSocket、没有 2h TTL 闹钟,数据长期保留。绑定 SGS_CONFIG(wrangler.toml 迁移 v3)。
export class SgsConfigDO {
  constructor(state) { this.state = state; }
  async load() {
    const raw = await this.state.storage.get("pool");
    const pools = {};
    for (const k of POOL_KEYS) {
      const p = raw && raw.pools && raw.pools[k];
      pools[k] = {
        white: p ? (p.white || []) : (k === POOL_KEYS[0] ? ((raw && raw.ids) || POOL_SEED.ids || []) : []),
        ban: p ? (p.ban || []) : (BANNED_DATA.pools[k].ids || []),
      };
    }
    return { pools, seen: (raw && raw.seen) || [], updatedAt: (raw && raw.updatedAt) || null };
  }
  async fetch(request) {
    const noStore = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
    const norm = (a) => [...new Set((Array.isArray(a) ? a : []).map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 5000);
    if (request.method === "PUT") {
      let body;
      try { body = await request.json(); } catch { return new Response(JSON.stringify({ error: "BAD_JSON" }), { status: 400, headers: noStore }); }
      const cur = await this.load();
      const pools = {};
      for (const k of POOL_KEYS) {
        const b = body && body.pools && body.pools[k];
        pools[k] = b ? { white: norm(b.white), ban: norm(b.ban) } : cur.pools[k]; // 没带的环境保持原样
      }
      if (body && Array.isArray(body.ids) && !(body.pools && body.pools[POOL_KEYS[0]])) pools[POOL_KEYS[0]].white = norm(body.ids); // 兼容旧客户端 {ids}
      const saved = { pools, seen: body && body.seen ? norm(body.seen) : cur.seen, updatedAt: Date.now() };
      await this.state.storage.put("pool", saved);
      return new Response(JSON.stringify({ ok: true, updatedAt: saved.updatedAt,
        counts: Object.fromEntries(POOL_KEYS.map((k) => [k, { white: pools[k].white.length, ban: pools[k].ban.length }])) }), { headers: noStore });
    }
    const cfg = await this.load();
    for (const k of POOL_KEYS) Object.assign(cfg.pools[k], POOL_META[k]);
    cfg.ids = cfg.pools[POOL_KEYS[0]].white; // 兼容:旧字段=军争白名单
    return new Response(JSON.stringify(cfg), { headers: noStore });
  }
}

// 三国杀房间 DO。类名 RoomDO 不能改(wrangler.toml 绑定 + 已有 DO 迁移 v1)。
export class RoomDO extends RoomDOBase {
  // 把服务端配置里的黑名单同步进 RoomCore 的禁将判定(20 秒节流;/pool 页改完,房间里最多 20 秒后生效)。
  // cfgRev 进 roomState,客户端发现变了就重拉 /banned-generals.json 刷新禁将面板。
  async syncConfig(force = false) {
    const now = Date.now();
    if (!force && this._cfgAt && now - this._cfgAt < 20000) {
      if (this.core && this._cfg) this.core.cfgRev = this._cfg.updatedAt || 0; // core 可能是解散后新建的
      return this._cfg;
    }
    try {
      const cfg = await getConfig(this.env);
      applyBans(Object.fromEntries(POOL_KEYS.map((k) => [k, cfg.pools[k].ban])));
      this._cfg = cfg; this._cfgAt = now;
      if (this.core) this.core.cfgRev = cfg.updatedAt || 0;
    } catch { /* 读不到就沿用上次/文件默认 */ }
    return this._cfg;
  }
  async onMessage(ws, data) { await this.ensureCore(); await this.syncConfig(); return super.onMessage(ws, data); }
  createCore() { return new RoomCore("room", SEAT_COUNT); }
  hydrateCore(saved) { return RoomCore.hydrate(saved); }
  onGameMessage(ws, msg, core) {
    const id = this.dev(ws);
    switch (msg.type) {
      case "setBanEnabled": return core.setBanEnabled(msg.on);                      // ② 禁将总开关(房内共享,任何玩家可切)
      case "setGeneral": return core.setGeneral(id, msg.seatNo, msg.generalId);      // 别静默吞错(否则"工具没变"却无提示)
      case "setFaction": return core.setFaction(id, msg.seatNo, msg.faction);        // 神将自选势力
      // ── 线上发将 ──
      case "dealStart": return this.dealStart(id, msg, core);                        // async:先读全局将池白名单
      case "dealSwap": return core.dealSwap(id, msg);
      case "dealPick": return core.dealPick(id, msg);
      case "dealReveal": return core.dealReveal(id);
      case "dealCancel": return core.dealCancel(id);
      // ── 身份自动发放 / 新一局 ──
      case "identStart": return core.identStart(id, { mode: msg.mode, counts: msg.counts || null, lost: msg.lost, clearGenerals: msg.clearGenerals !== false });
      case "identShow": return core.identShow(id, msg);
      case "identPeek": return core.identPeek(id, msg);
      case "identBizhong": return core.identBizhong(id, msg);
      case "identSwapLost": return core.identSwapLost(id, msg);
      case "identBizhongDone": return core.identBizhongDone(id, msg);
      case "identShowAll": return core.identShowAll(id);
      case "identClear": return core.identClear(id);
      case "newGame": return core.newGame(id);
      default: return undefined;
    }
  }
  // 发将开局:名单从 SgsConfigDO 现读(/pool 页保存的那份)。
  //   环境 = msg.pool(发将设置里手选)或按座位数自动;该环境白名单为空 → 沿用军争白名单;黑名单用该环境自己的(房内禁将开关关着则不禁)。
  async dealStart(id, msg, core) {
    const cfg = await this.syncConfig(true);
    if (!cfg) return { error: "POOL_UNAVAILABLE" };
    const key = POOL_KEYS.includes(msg.pool) ? msg.pool : banPoolForSeats(core.seatNos().length);
    const own = cfg.pools[key].white;
    const wl = own.length ? own : cfg.pools[POOL_KEYS[0]].white;
    if (!wl.length) return { error: "POOL_NOT_SET" };
    const banned = core.banEnabled !== false ? cfg.pools[key].ban : [];
    const pools = buildDealPools({ heroes: GENERALS_DATA, whitelist: wl, banned, mode: msg.mode });
    return core.dealStart(id, { mode: msg.mode, lordSeat: msg.lordSeat, pools, poolKey: key, poolLabel: POOL_META[key].label + (own.length ? "" : "·沿用军争池") });
  }
}
