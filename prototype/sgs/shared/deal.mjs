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
};

const LORD_ONLY_KEYS = new Set(["曹丕"]);
const IDENTITY_ONLY_IDS = new Set([355]); // 董昭
const MODE_EXCLUSIVE_GENRE = "不臣之君";

// 与 room.html heroBaseName 同一前缀集(改一处要同步另一处)。
// 用户 2026-10-02:(标)界/谋/族/闪/SP 同名都算同一位武将。2026-10-02 审计:库里 族34/闪5/标1 全是前缀写法,无误伤。
export function heroBaseName(name) { return (name || "").replace(/^(神|界|谋|魔|SP|梦|族|闪|标|教主|暴君|昏君)/, ""); }
// 坑的 key:神版独立(神关羽 ≠ 关羽),其余按基名合并
export function groupKey(h) { return h.name.startsWith("神") ? h.name : heroBaseName(h.name); }
export function hasLordSkill(h) { return (h.skills || []).some((s) => /^主公技/.test(s.effect || "")); }

const opt = (h) => ({ id: h.id, name: h.name, gid: h.tool || String(h.id), lord: hasLordSkill(h) });

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
