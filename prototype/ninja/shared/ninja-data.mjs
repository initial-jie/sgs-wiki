// 忍者之夜(Night of the Ninja)数据:流派牌 / 33 张忍者牌 / 夜晚阶段 / 人数表 / 荣誉标记默认分布。
// 被 ninja-logic.mjs(DO 与 node 模拟共用)与 worker.mjs(/ninja/data.json 下发前端)引用。
// 规则来源 docs/ninja/README.md(官方规则书 + FAQ;卡面原文见 §4)。
//
// 牌组 33 张:密探 / 隐士 / 盲眼刺客 / 上忍 各 6 张(编号 1~6)、骗徒 6 张(6 种各 1,编号 = 种类 1~6)、镜僧 / 殉道者 / 首脑 各 1。
//   规则书只说 33 张、同阶段按 1→6 结算;各类张数采用 PTT 玩家「每种忍者都有 1-6」+ 总数吻合(见 README §4)。
// 荣誉标记 35 枚,面值 2/3/4:简中说明书(hsuBnOediH/NightOfNinjaOnline 按实卡核对)为 2×14 / 3×14 / 4×7,作默认;房间可配。

export const HOUSES = {
  crane: { key: "crane", name: "仙鹤", en: "Crane House", icon: "🪶", color: "#c7343f" },
  lotus: { key: "lotus", name: "莲花", en: "Lotus House", icon: "🪷", color: "#3b74c4" },
  ronin: { key: "ronin", name: "浪人", en: "Ronin", icon: "🗡️", color: "#7b4ea3" },
};
// 流派牌实例:crane:1..5 / lotus:1..5 / ronin
export function houseFamily(h) { return h === "ronin" ? "ronin" : h.split(":")[0]; }
export function houseRank(h) { return h === "ronin" ? null : Number(h.split(":")[1]); }
export function houseName(h) {
  if (!h) return "?";
  const f = houseFamily(h), r = houseRank(h);
  return f === "ronin" ? "浪人" : `${HOUSES[f].name} ${r}`;
}
// 人数 → 本局用的流派牌(4 人 1~2,每多 2 人加一级;奇数加浪人)
export const MIN_PLAYERS = 4, MAX_PLAYERS = 11;
export function housesFor(n) {
  if (n < MIN_PLAYERS || n > MAX_PLAYERS) return null;
  const pairs = Math.floor(n / 2), out = [];
  for (let r = 1; r <= pairs; r++) out.push(`crane:${r}`, `lotus:${r}`);
  if (n % 2 === 1) out.push("ronin");
  return out;
}

// 夜晚五阶段(顺序固定)
export const PHASES = [
  { key: "spy",     name: "密探",   en: "Spy" },
  { key: "mystic",  name: "隐士",   en: "Mystic" },
  { key: "trickster", name: "骗徒", en: "Trickster" },
  { key: "blind",   name: "盲眼刺客", en: "Blind Assassin" },
  { key: "shinobi", name: "上忍",   en: "Shinobi" },
];
export const PHASE_BY_KEY = Object.fromEntries(PHASES.map((p) => [p.key, p]));

// 13 种牌。phase:spy|mystic|trickster|blind|shinobi|react|reveal;num 固定编号(骗徒),null = 实例各带 1~6;
// color 按阶段(前端卡面色块);desc 卡面中文(实现口径);text 卡面英文原文。
export const CARDS = [
  { key: "spy",       name: "密探",   en: "Spy",            phase: "spy",     num: null, icon: "👁️", color: "#c9962b",
    desc: "查看另一名玩家的流派牌。", text: "Look at another player's HOUSE card." },
  { key: "mystic",    name: "隐士",   en: "Mystic",         phase: "mystic",  num: null, icon: "🔮", color: "#d4701f",
    desc: "查看另一名玩家的流派牌,以及他手里随机一张忍者牌。", text: "Look at the HOUSE card and one NINJA card of another player." },
  { key: "shapeshifter", name: "变形者", en: "Shapeshifter", phase: "trickster", num: 1, icon: "🎭", color: "#b5362e",
    desc: "查看两名玩家的流派牌,然后可以秘密对调这两张牌。被对调的人不能查看自己的新流派牌。", text: "Look at the HOUSE cards of two players. You may secretly swap them around. They may not look at their new HOUSE." },
  { key: "gravedigger", name: "掘墓人", en: "Grave Digger", phase: "trickster", num: 2, icon: "⚰️", color: "#b5362e",
    desc: "从中央弃牌堆随机翻看两张忍者牌,拿走一张:可以立刻打出,或面朝上留在自己面前以后用。", text: "Look at two discarded NINJA cards and pick one. You may play it immediately or keep it in front of you for use later." },
  { key: "troublemaker", name: "捣乱者", en: "Troublemaker", phase: "trickster", num: 3, icon: "📣", color: "#b5362e",
    desc: "查看另一名玩家的流派牌,然后可以选择把它公开给所有人。", text: "Look at another player's HOUSE card. You may reveal it." },
  { key: "merchant",  name: "通灵商人", en: "Spirit Merchant", phase: "trickster", num: 4, icon: "🏮", color: "#b5362e",
    desc: "查看另一名玩家的一枚荣誉标记或流派牌(二选一),然后可以用自己的任一枚荣誉标记与他交换任一枚。", text: "Look at another player's HONOR token or HOUSE card. You may swap one HONOR token with them." },
  { key: "thief",     name: "盗贼",   en: "Thief",          phase: "trickster", num: 5, icon: "🧤", color: "#b5362e",
    desc: "亮出自己的流派牌。然后可以从一名荣誉标记比你多的玩家那里拿走一枚(随机)。", text: "Reveal your HOUSE card. You may take one HONOR token from a player who has more than you." },
  { key: "judge",     name: "判官",   en: "Judge",          phase: "trickster", num: 6, icon: "⚖️", color: "#b5362e",
    desc: "亮出自己的流派牌。选择一名玩家并杀死他。镜僧与殉道者对判官无效。", text: "Reveal your HOUSE card. Choose a player and KILL them. Mirror Monks and Martyrs do not work on the Judge." },
  { key: "blind",     name: "盲眼刺客", en: "Blind Assassin", phase: "blind",  num: null, icon: "🗡️", color: "#7b4ea3",
    desc: "选择一名玩家并杀死他(不查看流派牌)。", text: "Choose a player and KILL them." },
  { key: "shinobi",   name: "上忍",   en: "Shinobi",        phase: "shinobi", num: null, icon: "🌙", color: "#3b4fa3",
    desc: "选择一名玩家,查看他的流派牌,然后可以选择是否杀死他。", text: "Choose a player. Look at their HOUSE card. You may choose to KILL them." },
  { key: "mirror",    name: "镜僧",   en: "Mirror Monk",    phase: "react",   num: null, icon: "🪞", color: "#5a6a8c",
    desc: "当上忍或盲眼刺客选择杀死你时翻开:改为杀死他。", text: "Reveal this if a Shinobi or Blind Assassin chooses to KILL you. KILL them instead." },
  { key: "martyr",    name: "殉道者", en: "Martyr",         phase: "react",   num: null, icon: "🕯️", color: "#5a6a8c",
    desc: "当上忍或盲眼刺客选择杀死你时翻开:你仍然死去,但获得一枚荣誉标记。", text: "Reveal this if a Shinobi or Blind Assassin chooses to KILL you. Gain an HONOR token." },
  { key: "mastermind", name: "首脑",  en: "Mastermind",     phase: "reveal",  num: null, icon: "👑", color: "#5a6a8c",
    desc: "揭示阶段若你仍然存活,亮出此牌:你的流派直接赢得本轮。(若你是浪人,则本轮没有流派获胜。)", text: "If you are still alive during the Reveal Phase, your HOUSE wins the round. (If you are the Ronin, no HOUSES win this round.)" },
];
export const CARD_BY_KEY = Object.fromEntries(CARDS.map((c) => [c.key, c]));
export const SPECIAL_KEYS = ["mirror", "martyr", "mastermind"];

// 整副 33 张:实例 {id, key, num}
export function buildDeck() {
  const out = [];
  for (const k of ["spy", "mystic", "blind", "shinobi"]) for (let n = 1; n <= 6; n++) out.push({ id: `${k}-${n}`, key: k, num: n });
  for (const c of CARDS) if (c.phase === "trickster") out.push({ id: c.key, key: c.key, num: c.num });
  for (const k of SPECIAL_KEYS) out.push({ id: k, key: k, num: null });
  return out;
}
export const DECK_SIZE = 33;
export function cardName(card) { const c = CARD_BY_KEY[card.key]; return c ? (card.num != null && c.num == null ? `${c.name} ${card.num}` : c.name) : card.key; }

// 荣誉标记
export const TOKEN_VALUES = [2, 3, 4];
export const DEFAULT_TOKENS = { 2: 14, 3: 14, 4: 7 }; // 共 35;按简中说明书
export const DEFAULT_POINTS = 10;
export function buildTokenPool(dist = DEFAULT_TOKENS) {
  const out = []; let k = 0;
  for (const v of TOKEN_VALUES) for (let i = 0; i < (dist[v] || 0); i++) out.push({ id: `t${++k}`, v });
  return out;
}

// ── 牌名版本(房规可切,只影响显示与日志,不影响规则)──
// iga:用户手里那版(2026-11-27 口述:流派 伊贺 / 甲贺(无来源,按用户记忆)、商人、刺客、大将军;骗徒 1 三个来源都是「百变者」,其余按 cn 套补齐);
// cn:国内另一印次的译名(网页版 Byte-Git-hub/NinjaNight 的 CARD_CN:百变者 / 商人 / 盗贼 / 裁判 / 刺客 / 还施者 / 大将军),与用户记忆吻合;
// manual:简中说明书版(hsuBnOediH/NightOfNinjaOnline 按实体说明书与 33 张实卡照片核对:灵魂商贩 / 窃贼 / 盲眼刺客 / 还施僧 / 首脑);
// official:对照官方英文的直译(本仓库最初的拟名)。
export const NAME_SETS = {
  iga: { key: "iga", name: "伊贺 / 甲贺版(我们这套)", note: "流派按记忆 伊贺 / 甲贺;百变者 / 商人 / 刺客 / 大将军",
    houses: { crane: "伊贺", lotus: "甲贺", ronin: "浪人" },
    cards: { spy: "密探", mystic: "隐士", shapeshifter: "百变者", gravedigger: "掘墓人", troublemaker: "捣蛋鬼", merchant: "商人", thief: "盗贼", judge: "裁判", blind: "刺客", shinobi: "上忍", mirror: "还施者", martyr: "殉道者", mastermind: "大将军" } },
  cn: { key: "cn", name: "简中版(仙鹤 / 莲花)", note: "与上一套同名,只是流派叫仙鹤 / 莲花",
    houses: { crane: "仙鹤", lotus: "莲花", ronin: "浪人" },
    cards: { spy: "密探", mystic: "隐士", shapeshifter: "百变者", gravedigger: "掘墓人", troublemaker: "捣蛋鬼", merchant: "商人", thief: "盗贼", judge: "裁判", blind: "刺客", shinobi: "上忍", mirror: "还施者", martyr: "殉道者", mastermind: "大将军" } },
  manual: { key: "manual", name: "简中说明书版", note: "按实体说明书核对:灵魂商贩 / 窃贼 / 盲眼刺客 / 还施僧 / 首脑",
    houses: { crane: "仙鹤", lotus: "莲花", ronin: "浪人" },
    cards: { spy: "密探", mystic: "隐士", shapeshifter: "百变者", gravedigger: "掘墓人", troublemaker: "捣蛋鬼", merchant: "灵魂商贩", thief: "窃贼", judge: "裁判", blind: "盲眼刺客", shinobi: "上忍", mirror: "还施僧", martyr: "殉道者", mastermind: "首脑" } },
  official: { key: "official", name: "官方直译", note: "对照英文卡面",
    houses: { crane: "仙鹤", lotus: "莲花", ronin: "浪人" },
    cards: Object.fromEntries(CARDS.map((c) => [c.key, c.name])) },
};
export const DEFAULT_NAMES = "iga";
export function namesOf(k) { return NAME_SETS[k] || NAME_SETS[DEFAULT_NAMES]; }
export function houseNameIn(k, h) {
  if (!h) return "?";
  const set = namesOf(k), f = houseFamily(h);
  return f === "ronin" ? set.houses.ronin : `${set.houses[f]} ${houseRank(h)}`;
}
export function cardNameIn(k, card) {
  const set = namesOf(k), c = CARD_BY_KEY[card.key], nm = set.cards[card.key] || (c ? c.name : card.key);
  return c && card.num != null && c.num == null ? `${nm} ${card.num}` : nm;
}
// 阶段名跟着牌名走(骗徒阶段固定叫骗徒)
export function phaseNameIn(k, phaseKey) {
  if (phaseKey === "trickster") return "骗徒";
  if (phaseKey === "react") return "反应";
  if (phaseKey === "reveal") return "揭示";
  const set = namesOf(k); return set.cards[phaseKey] || (PHASE_BY_KEY[phaseKey] ? PHASE_BY_KEY[phaseKey].name : phaseKey);
}
