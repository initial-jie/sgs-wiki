// 线上发将 —— 纯逻辑(组池规则)。RoomCore 的 dealStart 吃这里产出的 pools;sim 与 worker 共用。
//
// 概念:
//   将坑(group) = 同名可替换的一组武将版本(黄盖/界黄盖、荀彧/界荀彧/族荀彧、刘宏/闪刘宏 是同一个坑;神版独立成坑)。发将、换将都以坑为单位,
//                 全场一个坑只发给一个人;玩家从坑里任选一个版本登场。
//   白名单      = /pool 编辑页勾选的武将 id(服务端 SgsConfigDO)。坑里只要有一个"勾选且当前可用"的版本,整坑入池,
//                 且同名的其它版本也可选(用户 2026-10-02:只勾标黄盖,界黄盖也能选)——但被禁的版本除外。
//   禁将        = 当前座位数对应禁将池(房内禁将开关开着时);被禁版本从坑的可选项里剔除。
//
// 特殊规则:
//   - 可配置的两类(/pool「特殊规则」页按环境维护,见下面 POOL_RULE_KEYS;用户 2026-11-20 要求从写死改成可配):
//       lordOnly  仅主公候选:该版本只出现在君主位的「主公 6 选 1」里,其余座位的起手 / 换将都拿不到(默认:曹丕各版本,用户 2026-10-02 定)。
//       identOnly 仅身份局:该版本只在普通身份局可选(默认:董昭 355,机制依赖【忠臣】【反贼】身份;其它模式该坑只剩谋董昭)。
//   - 写死的:模式专属君主(暴君董卓/教主张角/昏君刘宏)只在对应模式、只进君主的额外候选,且必出。

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

// 可配置的特殊规则:{ lordOnly:[武将id], identOnly:[武将id] },都按版本(想让整个坑仅主公 → 把同名各版本都标上)。
//   存在 /api/pool 的 pools[环境].rules;该环境从没存过 → 用 defaultPoolRules(= 改成可配之前写死的行为)。
//   环境白名单为空沿用军争时,规则也沿用军争的(与套组同规则,worker dealStart 按 src 取)。不分套组。
export const POOL_RULE_KEYS = ["lordOnly", "identOnly"];
export function defaultPoolRules(heroes) {
  return { lordOnly: (heroes || []).filter((h) => groupKey(h) === "曹丕").map((h) => h.id), identOnly: [355] };
}
// 存盘 / 读盘的规整:raw 不是对象 → 整份用 dflt;某一类没带 → 该类用 dflt(以后加新规则类型时老数据自动补默认)
export function normPoolRules(raw, dflt) {
  const ids = (a) => [...new Set((Array.isArray(a) ? a : []).map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 5000);
  const ok = raw && typeof raw === "object" && !Array.isArray(raw), out = {};
  for (const k of POOL_RULE_KEYS) out[k] = ids(ok && Array.isArray(raw[k]) ? raw[k] : (dflt && dflt[k]) || []);
  return out;
}
const MODE_EXCLUSIVE_GENRE = "不臣之君";
// 「同名整坑可选」的例外:线下包《蚀心入魔》的武将必须自己被勾进白名单才可选,不随同名坑带出
// (用户 2026-11-11:36 将里只有四个魔将进选将池,其余只进总库 —— 否则 嗔·赵云 会跟着赵云坑出现)。
const EXPLICIT_ONLY_GENRE = "蚀心入魔";
export function needsExplicit(h) { return !!h && h.genre === EXPLICIT_ONLY_GENRE; }

// 将池套组(用户 2026-11-20:同一环境里分「素将 / 荤将」等几套,发将时一键切换,不用来回重勾)。
//   套组 = 一套独立的黑白名单:{ id, name, white:[武将id], ban:[武将id] }。
//   发将时选了套组 → 白名单、黑名单都整份换成它的;没选 → 用环境的默认白名单 + 黑名单。
//   (首版做成「默认名单上的增减」→ 用户当天定「每套独立的名单」→ 再定「每个套组有自己的黑白名单,方便管理」:
//    同名整坑可选的规则下,想在某一套里只去掉强力版本、留弱版本,只能靠这一套自己的黑名单。)
//   临时 ban 池仍是环境级。房间里的「禁将池」面板与手动选将只认环境默认黑名单;线上牌桌(无名杀)只认默认白名单。
export const POOL_SET_MAX = 8;       // 每个环境最多几套
export const POOL_SET_NAME_MAX = 10; // 套组名最长字数
export function applyPoolSet({ white, ban }, set) {
  const ids = (a) => [...new Set([...(a || [])].map(Number))];
  return set ? { white: ids(set.white), ban: ids(set.ban) } : { white: ids(white), ban: ids(ban) };
}
// 存盘前的规整:丢掉非法项;套组 id / 武将 id 去重;名字截断
export function normPoolSets(raw) {
  const ids = (a) => [...new Set((Array.isArray(a) ? a : []).map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 5000);
  const out = [], seen = new Set();
  for (const s of Array.isArray(raw) ? raw : []) {
    if (!s || typeof s !== "object") continue;
    const id = String(s.id || "").trim(), name = String(s.name || "").trim().slice(0, POOL_SET_NAME_MAX);
    if (!/^[A-Za-z0-9_-]{1,16}$/.test(id) || !name || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name, white: ids(s.white), ban: ids(s.ban) });
    if (out.length >= POOL_SET_MAX) break;
  }
  return out;
}

// 与 room.html heroBaseName 同一前缀集(改一处要同步另一处)。
// 用户 2026-10-02:(标)界/谋/族/闪/SP 同名都算同一位武将。2026-10-02 审计:库里 族34/闪5/标1 全是前缀写法,无误伤。
// 「移动版」是版本来源标记,可再叠一个系列前缀(移动版谋韩当 → 韩当;用户 2026-10-02:与 OL 各版韩当同名可替换)。
// BASE_ALIAS:同一人的别名并进同一个坑(《蚀心入魔》实卡名 寇封=刘封、伏寿=伏皇后;晋势力版 晋司马懿 / 晋张春华 与其它各版同名,用户 2026-11-20)。
//   「晋」不做成通用前缀 —— 真有姓晋的人(晋宗),逐个列在这里更稳。以后再录「晋XX」同名版本,往这张表加一行(room.html 同步)。
const BASE_ALIAS = { 寇封: "刘封", 伏寿: "伏皇后", 晋司马懿: "司马懿", 晋张春华: "张春华" };
export function heroBaseName(name) { const b = (name || "").replace(/^(?:移动版|线下)?(?:[疑慢嗔贪痴]·)?(?:神|界|谋|魔|SP|梦|族|闪|标|教主|暴君|昏君)?/, ""); return BASE_ALIAS[b] || b; }
// 坑的 key:神版独立(神关羽 ≠ 关羽),其余按基名合并
export function groupKey(h) { return h.name.startsWith("神") ? h.name : heroBaseName(h.name); }
export function hasLordSkill(h) { return (h.skills || []).some((s) => /^主公技/.test(s.effect || "")); }

export const opt = (h) => ({ id: h.id, name: h.name, gid: h.tool || String(h.id), lord: hasLordSkill(h) });
export const DEAL_TEMPBAN_MIN = 3; // 临时 ban:每人至少 3 选 1 → 候选(临时 ban 池 ∩ 本局将池)至少 人数×3 张才能开;不够则发将设置里开关直接禁用(用户 2026-11-20:分了套组后候选会变少,要开局前校验;一度想放宽到人数×2,但 ≤6 人每人 ban 2 个会变成「看 2 ban 2」没得选,定回人数×3)
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
 * @param rules     特殊规则 { lordOnly:[id], identOnly:[id] };不传 = defaultPoolRules(heroes)
 * @returns { normal:[{key,opts}], lord:[{key,opts}], forced:{key,opts}|null }
 *   normal = 普通起手可发的坑(可选版本里不含「仅主公候选」的);lord = 君主额外候选的坑(至少一个可选版本带主公技,或被标了「仅主公候选」);
 *   forced = 该模式必出的专属君主坑(排在君主额外候选第一位;同名坑不再出现在 normal/lord)。
 */
export function buildDealPools({ heroes, whitelist, banned, mode = "normal", rules = null }) {
  const wl = new Set([...(whitelist || [])].map(Number));
  const ban = new Set([...(banned || [])].map(Number));
  const m = DEAL_MODES[mode] || DEAL_MODES.normal;
  const R = normPoolRules(rules, defaultPoolRules(heroes));
  const lordOnly = new Set(R.lordOnly), identOnly = new Set(R.identOnly);
  const usable = (h) => !ban.has(h.id) && h.genre !== MODE_EXCLUSIVE_GENRE && !(mode !== "normal" && identOnly.has(h.id));

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
    if (g.opts.some((o) => o.lord || lordOnly.has(o.id))) lord.push(slim); // 君主候选里整坑各版本都可选
    const rest = g.opts.filter((o) => !lordOnly.has(o.id));                 // 其余座位:去掉「仅主公候选」的版本,一个不剩则整坑不发
    if (rest.length) normal.push(rest.length === g.opts.length ? slim : { key: g.key, opts: rest });
  }
  return { normal, lord, forced };
}
