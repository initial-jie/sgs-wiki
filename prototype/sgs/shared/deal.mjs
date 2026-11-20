// 线上发将 —— 纯逻辑(组池规则)。RoomCore 的 dealStart 吃这里产出的 pools;sim 与 worker 共用。
//
// 概念:
//   将坑(group) = 同名可替换的一组武将版本(黄盖/界黄盖、荀彧/界荀彧/族荀彧、刘宏/闪刘宏 是同一个坑;神版独立成坑)。发将、换将都以坑为单位,
//                 全场一个坑只发给一个人;玩家从坑里任选一个版本登场。
//   白名单      = /pool 编辑页勾选的武将 id(服务端 SgsConfigDO)。坑里只要有一个"勾选且当前可用"的版本,整坑入池,
//                 且同名的其它版本也可选(用户 2026-10-02:只勾标黄盖,界黄盖也能选)——但被禁的版本除外。
//   禁将        = 当前座位数对应禁将池(房内禁将开关开着时);被禁版本从坑的可选项里剔除。
//
// 特殊规则(用户 2026-10-02 定):
//   - LORD_ONLY:曹丕 只出现在君主位的「主公 6 选 1」里,其余身份不发。
//   - IDENTITY_ONLY:董昭(355)机制依赖【忠臣】【反贼】身份,只在普通身份局可选;其它模式该坑只剩谋董昭。
//   - 模式专属君主(暴君董卓/教主张角/昏君刘宏):只在对应模式、只进君主的额外候选,且必出。

export const DEAL_HAND = 6;        // 每人起手坑数
export const DEAL_LORD_EXTRA = 6;  // 君主位额外的主公技坑数

// mode → 展示名 / 君主称谓 / 该模式必出的专属君主(武将名)
export const DEAL_MODES = {
  normal:  { label: "身份局",   lordTitle: "主公", lordHero: null },
  baonue:  { label: "暴虐无道", lordTitle: "暴君", lordHero: "暴君董卓" },
  shixin:  { label: "失心疯",   lordTitle: "教主", lordHero: "教主张角" },
  dazhong: { label: "大忠似奸", lordTitle: "昏君", lordHero: "昏君刘宏" },
  // 斗地主(用户 2026-10-17):每人 3 坑、无主公技候选;发完有「叫地主」阶段,叫了的地主再多 2 坑(也可各换一次),不叫则顺位给下家,转满一圈没人叫 → 最初那位必须当
  douzhu:  { label: "斗地主",   lordTitle: "地主", lordHero: null, hand: 3, lordExtraHand: 2, call: true, noLordPool: true },
};

const LORD_ONLY_KEYS = new Set(["曹丕"]);
const IDENTITY_ONLY_IDS = new Set([355]); // 董昭
const MODE_EXCLUSIVE_GENRE = "不臣之君";
// 「同名整坑可选」的例外:线下包《蚀心入魔》的武将必须自己被勾进白名单才可选,不随同名坑带出
// (用户 2026-11-11:36 将里只有四个魔将进选将池,其余只进总库 —— 否则 嗔·赵云 会跟着赵云坑出现)。
const EXPLICIT_ONLY_GENRE = "蚀心入魔";
export function needsExplicit(h) { return !!h && h.genre === EXPLICIT_ONLY_GENRE; }

// 将池套组(用户 2026-11-21:同一环境里分「素将 / 荤将」等几套,发将时一键切换,不用来回重勾)。
//   套组 = 在该环境基础名单上的增减:{ id, name, plus:[武将id], minus:[武将id] }
//   生效白名单 = (基础白名单 ∪ plus) − minus;生效黑名单 = 基础黑名单 ∪ minus。
//   minus 按版本排除(同黑名单语义:排除界黄盖,标黄盖照常);plus 同白名单语义(勾一个版本整坑入池)。
//   基础白名单里新加的武将自动进所有套组(除非该套组 minus 了它)。
export const POOL_SET_MAX = 8;       // 每个环境最多几套
export const POOL_SET_NAME_MAX = 10; // 套组名最长字数
export function applyPoolSet({ white, ban }, set) {
  const w = new Set([...(white || [])].map(Number)), b = new Set([...(ban || [])].map(Number));
  if (set) {
    for (const id of set.plus || []) w.add(Number(id));
    for (const id of set.minus || []) { w.delete(Number(id)); b.add(Number(id)); }
  }
  return { white: [...w], ban: [...b] };
}
// 存盘前的规整:丢掉非法项;id 去重;同一武将同时在 plus 和 minus → 以 minus 为准
export function normPoolSets(raw) {
  const ids = (a) => [...new Set((Array.isArray(a) ? a : []).map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 5000);
  const out = [], seen = new Set();
  for (const s of Array.isArray(raw) ? raw : []) {
    if (!s || typeof s !== "object") continue;
    const id = String(s.id || "").trim(), name = String(s.name || "").trim().slice(0, POOL_SET_NAME_MAX);
    if (!/^[A-Za-z0-9_-]{1,16}$/.test(id) || !name || seen.has(id)) continue;
    seen.add(id);
    const minus = ids(s.minus), m = new Set(minus);
    out.push({ id, name, plus: ids(s.plus).filter((i) => !m.has(i)), minus });
    if (out.length >= POOL_SET_MAX) break;
  }
  return out;
}

// 与 room.html heroBaseName 同一前缀集(改一处要同步另一处)。
// 用户 2026-10-02:(标)界/谋/族/闪/SP 同名都算同一位武将。2026-10-02 审计:库里 族34/闪5/标1 全是前缀写法,无误伤。
// 「移动版」是版本来源标记,可再叠一个系列前缀(移动版谋韩当 → 韩当;用户 2026-10-02:与 OL 各版韩当同名可替换)。
// BASE_ALIAS:同一人的别名并进同一个坑(《蚀心入魔》实卡名 寇封=刘封、伏寿=伏皇后)。
const BASE_ALIAS = { 寇封: "刘封", 伏寿: "伏皇后" };
export function heroBaseName(name) { const b = (name || "").replace(/^(?:移动版|线下)?(?:[疑慢嗔贪痴]·)?(?:神|界|谋|魔|SP|梦|族|闪|标|教主|暴君|昏君)?/, ""); return BASE_ALIAS[b] || b; }
// 坑的 key:神版独立(神关羽 ≠ 关羽),其余按基名合并
export function groupKey(h) { return h.name.startsWith("神") ? h.name : heroBaseName(h.name); }
export function hasLordSkill(h) { return (h.skills || []).some((s) => /^主公技/.test(s.effect || "")); }

export const opt = (h) => ({ id: h.id, name: h.name, gid: h.tool || String(h.id), lord: hasLordSkill(h) });
export const DEAL_TEMPBAN_MIN = 3; // 临时 ban:每人至少 3 选 1 才能开
export const DEAL_TEMPBAN_MAX = 5; // 每人最多看 5 个候选
export const DEAL_TEMPBAN_SMALL = 6; // 人数 ≤ 此值每人 ban 2 个,否则 1 个(用户 2026-10-18)
// 从组池里剔除指定武将 id(按版本:SP刘备被 ban,其它版本刘备照旧);整坑没版本了就删坑;专属君主被剔则 forced=null
export function dropIdsFromPools(pools, ids) {
  const bad = new Set([...ids].map(Number));
  const cut = (list) => (list || []).map((g) => ({ key: g.key, opts: g.opts.filter((o) => !bad.has(o.id)) })).filter((g) => g.opts.length);
  const forced = pools.forced ? cut([pools.forced])[0] || null : null;
  return { normal: cut(pools.normal), lord: cut(pools.lord), forced };
}

/**
 * 组池。
 * @param heroes    全量武将库(generals.json)
 * @param whitelist 可迭代的白名单武将 id
 * @param banned    可迭代的被禁武将 id(当前禁将池;禁将开关关着就传空)
 * @param mode      DEAL_MODES 的 key
 * @returns { normal:[{key,opts}], lord:[{key,opts}], forced:{key,opts}|null }
 *   normal = 普通起手可发的坑;lord = 君主额外候选的坑(至少一个可选版本带主公技,含 LORD_ONLY);
 *   forced = 该模式必出的专属君主坑(排在君主额外候选第一位;同名坑不再出现在 normal/lord)。
 */
export function buildDealPools({ heroes, whitelist, banned, mode = "normal" }) {
  const wl = new Set([...(whitelist || [])].map(Number));
  const ban = new Set([...(banned || [])].map(Number));
  const m = DEAL_MODES[mode] || DEAL_MODES.normal;
  const usable = (h) => !ban.has(h.id) && h.genre !== MODE_EXCLUSIVE_GENRE && !(mode !== "normal" && IDENTITY_ONLY_IDS.has(h.id));

  const groups = new Map(); // key → { key, opts:[], wl:bool }
  for (const h of heroes) {
    if (!usable(h)) continue;
    if (needsExplicit(h) && !wl.has(h.id)) continue; // 蚀心入魔:没被勾选就不随同名坑带出
    const key = groupKey(h);
    if (!groups.has(key)) groups.set(key, { key, opts: [], wl: false });
    const g = groups.get(key);
    g.opts.push(opt(h));
    if (wl.has(h.id)) g.wl = true; // 至少一个"勾选且可用"的版本 → 整坑入池
  }

  let forced = null;
  if (m.lordHero) {
    const ex = heroes.find((h) => h.name === m.lordHero);
    if (ex) {
      const key = groupKey(ex);
      const same = groups.get(key);
      forced = { key, opts: [opt(ex), ...(same && same.wl ? same.opts : [])] }; // 专属君主在前;同名坑已入池则其版本也可选
      groups.delete(key);
    }
  }

  const normal = [], lord = [];
  for (const g of groups.values()) {
    if (!g.wl) continue;
    const slim = { key: g.key, opts: g.opts };
    if (g.opts.some((o) => o.lord)) lord.push(slim);
    if (!LORD_ONLY_KEYS.has(g.key)) normal.push(slim);
  }
  return { normal, lord, forced };
}
