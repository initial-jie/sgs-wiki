// 三国杀牌堆数据 + 登记牌合法性校验(军争 + 界限突破/OL 常见)
// 校验分两级,诚实标注可靠度:
//   warn(黄,可靠) —— 花色规则冲突,如"黑桃的桃""红色的雷杀"(规则性强,不会错)
//   info(灰,提醒) —— 牌名不在牌库,可能拼写错(牌库可能不全,只提醒不拦)
// 精确到每张实体牌(花色+点数)的校验,待 EXACT_CARDS 由你校对后再开启。

export const SUIT_NAME = { S: "黑桃", H: "红桃", C: "梅花", D: "方块" };
export const SUIT_GLYPH = { S: "♠", H: "♥", C: "♣", D: "♦" };
export const isRed = (s) => s === "H" || s === "D";

// ---- 花色规则(可靠,warn 级)：这些牌名只可能是特定花色 ----
export const SUIT_RULES = {
  桃:   ["H", "D"],       // 桃只有红色
  闪:   ["H", "D"],       // 闪只有红色
  火杀: ["H", "D"],       // 火【杀】红色
  雷杀: ["S", "C"],       // 雷【杀】黑色
  闪电: ["S", "H"],       // 闪电:黑桃(2~9) + 红桃Q;精确点数待 EXACT_CARDS
  // 杀/酒 等花色分布较广,不设硬规则(交由 EXACT_CARDS 精确表处理)
};

// ---- 牌库(军争 + 界限突破/OL 常见牌名全集,info 级存在性提醒)----
// 不全也没关系:不在库中只给灰色"请确认牌名",不阻止保存。缺哪张告诉我补。
export const KNOWN_CARDS = new Set([
  // 基本牌
  "杀", "火杀", "雷杀", "闪", "桃", "酒",
  // 普通锦囊
  "无中生有", "过河拆桥", "顺手牵羊", "决斗", "借刀杀人", "五谷丰登",
  "桃园结义", "南蛮入侵", "万箭齐发", "无懈可击", "火攻", "铁索连环",
  "以逸待劳", "知己知彼", "远交近攻", "调虎离山",
  // 延时锦囊
  "乐不思蜀", "兵粮寸断", "闪电",
  // 武器
  "诸葛连弩", "青龙偃月刀", "雌雄双股剑", "青釭剑", "丈八蛇矛", "贯石斧",
  "方天画戟", "麒麟弓", "朱雀羽扇", "寒冰剑", "古锭刀", "银月枪",
  // 防具
  "八卦阵", "仁王盾", "藤甲", "白银狮子",
  // +1 马
  "绝影", "大宛", "紫骍", "骐骥",
  // -1 马
  "赤兔", "的卢", "爪黄飞电", "骅骝",
  // 宝物 / 其他
  "木牛流马",
]);

// ---- 精确实体牌表(默认空,待校对)----
// TODO(牌堆): 调研 OL 军争完整牌堆(花色+点数+牌名)的数据来源,填满 EXACT_CARDS
//            后把 STRICT 置为 true,即可开启"这张具体实体牌在牌堆中是否存在"的精确校验。
//            当前阶段只做"牌名是否在牌库"的存在性校验(见 validateCard 的 info 级)。
// 结构建议:每张牌名 -> 该牌在整副牌里存在的 (花色,点数) 列表
// 例: { 桃: [["H","3"],["H","4"],["D","2"]], 诸葛连弩: [["C","A"],["D","A"]] }
// 填好并把 STRICT 打开后,选了牌堆里不存在的具体实体牌也会给 warn。
export const EXACT_CARDS = {
  木牛流马: [["D", "5"]], // OL 军争:方片5(你校对提供的第一条精确数据)
};
export const STRICT = false;

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

// card: { suit:'S'|'H'|'C'|'D', rank:'A'..'K', name:string }
// 返回 { level:'ok'|'warn'|'info', reason?:string }
export function validateCard(card) {
  const name = (card.name || "").trim();
  const { suit, rank } = card;

  if (suit && !SUIT_NAME[suit]) return { level: "warn", reason: "花色非法" };
  if (rank && !RANKS.includes(String(rank))) return { level: "warn", reason: "点数非法" };
  if (!name) return { level: "ok" }; // 牌名选填,沿用现有工具行为

  const rule = SUIT_RULES[name];
  if (rule && suit && !rule.includes(suit)) {
    const allow = rule.map((s) => SUIT_NAME[s]).join(" / ");
    return { level: "warn", reason: `${name}不应是${SUIT_NAME[suit]},只可能是 ${allow}` };
  }

  if (STRICT && EXACT_CARDS[name]) {
    const exists = EXACT_CARDS[name].some(([s, r]) => s === suit && String(r) === String(rank));
    if (suit && rank && !exists)
      return { level: "warn", reason: `牌堆中没有 ${SUIT_GLYPH[suit]}${rank} 的${name}` };
  }

  if (!KNOWN_CARDS.has(name))
    return { level: "info", reason: `"${name}"不在常见牌库,请确认牌名` };

  return { level: "ok" };
}
