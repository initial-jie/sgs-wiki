// 情书(Love Letter)数据:卡牌表 + 版本(原版 2012 / 2019 新版)+ 人数→所需爱慕标记。
// 被 ll-logic.mjs(DO 与 node 模拟共用)与 worker.mjs(/loveletter/data.json 下发前端)引用。
//
// 版本差异(规则来源 docs/loveletter/README.md):
//   classic  原版 16 张,2~4 人:侍卫×5(1) 神父×2(2) 男爵×2(3) 侍女×2(4) 王子×2(5) 国王(6) 伯爵夫人(7) 公主(8);所需标记 2人7 / 3人5 / 4人4
//   v2019    Z-Man 新版 21 张,2~6 人:加 间谍×2(0) 大臣×2(6),侍卫 6 张,国王/伯爵夫人/公主 点数各 +1(7/8/9);所需标记 2人6 / 3人5 / 4人4 / 5人3 / 6人3
// 卡图:assets/loveletter/<key>.jpg(Pages 直链 ART_BASE),缺图前端退回 icon + 点数。

export const ART_BASE = "https://initial-jie.github.io/sgs-wiki/assets/loveletter/";

// key 唯一;rank 按版本可能不同(见 EDITIONS[*].ranks);target:谁能当目标 none / other / any;needGuess 侍卫要猜牌
export const CARDS = [
  { key: "spy",       name: "间谍",   en: "Spy",       icon: "🕵️", target: "none",  desc: "打出或弃掉时没有效果。本轮结束时,若你是仍在局内的玩家中唯一一个打出过或弃掉过间谍的人,额外获得 1 枚爱慕标记。", pack: "v2019" },
  { key: "guard",     name: "侍卫",   en: "Guard",     icon: "🛡️", target: "other", needGuess: true, desc: "选择另一名玩家并猜一张牌(不能猜侍卫)。若对方手牌正是那张牌,对方出局。" },
  { key: "priest",    name: "神父",   en: "Priest",    icon: "📿", target: "other", desc: "偷看另一名玩家的手牌(只有你看到)。" },
  { key: "baron",     name: "男爵",   en: "Baron",     icon: "⚔️", target: "other", desc: "与另一名玩家秘密比手牌点数:点数低的一方出局;相同则什么都不发生。" },
  { key: "handmaid",  name: "侍女",   en: "Handmaid",  icon: "🧺", target: "none",  desc: "直到你的下个回合开始前,你不受其他玩家牌效果的影响(不能被选为目标)。" },
  { key: "prince",    name: "王子",   en: "Prince",    icon: "🎠", target: "any",   desc: "选择一名玩家(可以是自己):他弃掉手牌(不结算效果)并补抽一张。牌堆已空则抽开局时移出的那张;弃的是公主则他出局。" },
  { key: "chancellor",name: "大臣",   en: "Chancellor",icon: "📜", target: "none",  desc: "从牌堆抽两张加入手牌,从这三张里留一张,其余两张按你选的顺序放回牌堆底。牌堆不足两张就抽剩下的;牌堆空则无效。", pack: "v2019" },
  { key: "king",      name: "国王",   en: "King",      icon: "👑", target: "other", desc: "与另一名玩家交换手牌。" },
  { key: "countess",  name: "伯爵夫人", en: "Countess", icon: "💍", target: "none",  desc: "打出时没有效果;但当你手里同时有伯爵夫人和国王或王子时,本回合必须打出伯爵夫人(不必说明原因)。" },
  { key: "princess",  name: "公主",   en: "Princess",  icon: "👸", target: "none",  desc: "无论因为什么原因,只要你打出或弃掉公主,你立刻出局。" },
];
export const CARD_BY_KEY = Object.fromEntries(CARDS.map((c) => [c.key, c]));

export const EDITIONS = {
  classic: {
    key: "classic", name: "原版(16 张)", en: "Love Letter (2012)", minPlayers: 2, maxPlayers: 4,
    deck: { guard: 5, priest: 2, baron: 2, handmaid: 2, prince: 2, king: 1, countess: 1, princess: 1 },
    ranks: { guard: 1, priest: 2, baron: 3, handmaid: 4, prince: 5, king: 6, countess: 7, princess: 8 },
    tokensToWin: { 2: 7, 3: 5, 4: 4 },
  },
  v2019: {
    key: "v2019", name: "2019 新版(21 张)", en: "Love Letter (2019, Z-Man)", minPlayers: 2, maxPlayers: 6,
    deck: { spy: 2, guard: 6, priest: 2, baron: 2, handmaid: 2, prince: 2, chancellor: 2, king: 1, countess: 1, princess: 1 },
    ranks: { spy: 0, guard: 1, priest: 2, baron: 3, handmaid: 4, prince: 5, chancellor: 6, king: 7, countess: 8, princess: 9 },
    tokensToWin: { 2: 6, 3: 5, 4: 4, 5: 3, 6: 3 },
  },
};
export const DEFAULT_EDITION = "classic";

// 某版本的整副牌(按 key 展开成数组)
export function buildDeck(editionKey) {
  const ed = EDITIONS[editionKey] || EDITIONS[DEFAULT_EDITION];
  const out = [];
  for (const [k, n] of Object.entries(ed.deck)) for (let i = 0; i < n; i++) out.push(k);
  return out;
}
export function rankOf(editionKey, cardKey) { const ed = EDITIONS[editionKey] || EDITIONS[DEFAULT_EDITION]; return ed.ranks[cardKey] ?? -1; }
export function tokensToWin(editionKey, players) { const ed = EDITIONS[editionKey] || EDITIONS[DEFAULT_EDITION]; return ed.tokensToWin[players] ?? null; }
// 该版本按点数排好的卡牌清单(图鉴 / 侍卫猜牌列表用)
export function cardsOf(editionKey) {
  const ed = EDITIONS[editionKey] || EDITIONS[DEFAULT_EDITION];
  return CARDS.filter((c) => ed.deck[c.key]).map((c) => ({ ...c, rank: ed.ranks[c.key], count: ed.deck[c.key] })).sort((a, b) => a.rank - b.rank);
}
