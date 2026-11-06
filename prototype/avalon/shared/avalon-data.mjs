// 阿瓦隆(The Resistance: Avalon)角色图鉴 + 人数表 + 推荐配置。
// 来源:docs/avalon/README.md(基础版 + Avalon X + Big Box 规则书转录 §4.2/§4.3;任务人数表对照实体版图核过)。
// 被 avalon-logic.mjs(DO / node 模拟)与 client/avalon.html(经 /avalon/data.json)共用。
//
// 字段:key 内部键 / name 中文名 / en 英文名 / team good|evil(初始阵营;兰斯洛特可能中途互换)/ max 一局最多几张 / pack base|x|bigbox
//       icon 表情(没图时的退路)/ img 卡图文件名数组(assets/avalon/,同名角色多张时按发牌顺序轮用;见 docs/avalon/art-sources.md)
//       desc 图鉴说明 / short 卡面一句话(身份卡上显示)

export const TEAMS = {
  good: { key: "good", name: "亚瑟的忠臣", short: "好", color: "#4f8ef7" },
  evil: { key: "evil", name: "莫德雷德的爪牙", short: "坏", color: "#e5484d" },
};
export const ART_BASE = "https://initial-jie.github.io/sgs-wiki/assets/avalon/";

export const ROLES = [
  // ───────── 基础版 ─────────
  { key: "merlin", name: "梅林", en: "Merlin", team: "good", max: 1, pack: "base", icon: "🧙", img: ["merlin.jpg"], short: "知道坏人,必须隐藏自己",
    desc: "开局知道所有坏人是谁(莫德雷德除外)。必须小心隐藏身份:好人完成三次任务后,刺客会指认一名好人——指中梅林则坏人获胜。" },
  { key: "percival", name: "派西维尔", en: "Percival", team: "good", max: 1, pack: "base", icon: "🛡️", img: ["percival.jpg"], short: "知道梅林(和莫甘娜)",
    desc: "开局看到梅林与莫甘娜两个座位,但不知道哪个是哪个(没有莫甘娜时只看到梅林)。保护梅林、替他挡刀是你的任务。5 人局用派西维尔时必须加莫德雷德或莫甘娜。" },
  { key: "servant", name: "亚瑟的忠臣", en: "Loyal Servant of Arthur", team: "good", max: 5, pack: "base", icon: "⚔️", img: ["servant1.jpg", "servant2.jpg", "servant3.jpg", "servant4.jpg", "servant5.jpg"], short: "好人,没有特殊信息",
    desc: "好人阵营,没有任何特殊信息。执行任务时只能出「成功」。" },
  { key: "assassin", name: "刺客", en: "Assassin", team: "evil", max: 1, pack: "base", icon: "🗡️", img: ["assassin.jpg"], short: "三次任务成功后可刺杀梅林",
    desc: "坏人阵营,与其他坏人互认。好人完成三次任务后,坏人们公开商量,由刺客指认一名好人为梅林——指中则坏人获胜。几乎每局必带。" },
  { key: "morgana", name: "莫甘娜", en: "Morgana", team: "evil", max: 1, pack: "base", icon: "🔮", img: ["morgana.jpg"], short: "在派西维尔眼里像梅林",
    desc: "坏人阵营,与其他坏人互认。在派西维尔眼里她和梅林一模一样——用来迷惑派西维尔。必须和派西维尔一起用。" },
  { key: "mordred", name: "莫德雷德", en: "Mordred", team: "evil", max: 1, pack: "base", icon: "👑", img: ["mordred.jpg"], short: "梅林看不到他",
    desc: "坏人阵营,与其他坏人互认,但梅林看不到他。大幅削弱梅林,建议 7 人以上使用。" },
  { key: "oberon", name: "奥伯伦", en: "Oberon", team: "evil", max: 1, pack: "base", icon: "👹", img: ["oberon.jpg"], short: "不知道其他坏人,坏人也不知道他",
    desc: "坏人阵营,但不与其他坏人互认:他不知道其他坏人是谁,其他坏人也不知道他。梅林看得到他。削弱坏人,建议 7 人以上使用。" },
  { key: "minion", name: "莫德雷德的爪牙", en: "Minion of Mordred", team: "evil", max: 3, pack: "base", icon: "🩸", img: ["minion1.jpg", "minion2.jpg", "minion3.jpg"], short: "坏人,与其他坏人互认",
    desc: "坏人阵营,与其他坏人互认,没有其他特殊能力。执行任务时可出「成功」或「失败」。" },
  // ───────── Avalon X ─────────
  { key: "lancelot_good", name: "兰斯洛特(好)", en: "Lancelot", team: "good", max: 1, pack: "x", icon: "🏇", img: ["lancelot_good.jpg"], short: "知道坏兰斯洛特,或阵营会互换",
    desc: "必须与「兰斯洛特(坏)」成对使用。默认规则:两位兰斯洛特互相知道。变体规则(房间设置):两人不互知,每个任务开始时翻一张阵营卡,翻到「互换」则两人秘密互换阵营(从此按新阵营出任务卡、按新阵营胜负)。" },
  { key: "lancelot_evil", name: "兰斯洛特(坏)", en: "Lancelot", team: "evil", max: 1, pack: "x", icon: "🏇", img: ["lancelot_evil.jpg"], short: "知道好兰斯洛特,或阵营会互换",
    desc: "必须与「兰斯洛特(好)」成对使用。默认规则:两位兰斯洛特互相知道,他与其他坏人互认。变体规则:他不知道其他坏人,其他坏人知道他;阵营卡翻到「互换」时两人秘密互换阵营。" },
  // ───────── Big Box(简单角色)─────────
  { key: "lunatic", name: "疯子", en: "Lunatic", team: "evil", max: 1, pack: "bigbox", icon: "🤪", img: ["lunatic.jpg"], short: "参加的任务必须出失败",
    desc: "坏人阵营,与其他坏人互认。参加的每一次任务都必须出「失败」。建议 7 人以上。" },
  { key: "brute", name: "蛮兵", en: "Brute", team: "evil", max: 1, pack: "bigbox", icon: "🪓", img: ["brute.jpg"], short: "只能在前三个任务出失败",
    desc: "坏人阵营,与其他坏人互认。只能在第 1~3 个任务出「失败」,第 4、5 个任务只能出「成功」。建议 7 人以上。" },
  { key: "revealer", name: "揭示者", en: "Revealer", team: "evil", max: 1, pack: "bigbox", icon: "📣", img: ["revealer.jpg"], short: "第二次任务失败后公开身份",
    desc: "坏人阵营,与其他坏人互认。第二次任务失败后,身份自动对全桌公开。建议 7 人以上。" },
  { key: "cleric", name: "牧师", en: "Cleric", team: "good", max: 1, pack: "bigbox", icon: "✝️", img: ["cleric.jpg"], short: "开局得知首任队长的阵营",
    desc: "好人阵营。开局得知第一任队长是好人还是坏人(被骗子/捣蛋鬼骗到的除外)。建议 7 人以上。" },
  { key: "trickster", name: "骗子", en: "Trickster", team: "evil", max: 1, pack: "bigbox", icon: "🎭", img: ["trickster.jpg"], short: "被验时显示为好人",
    desc: "坏人阵营,与其他坏人互认。被牧师、湖中仙女等任何效果验阵营时可以说谎——本房间里他一律显示为「好人」。只在有验人效果的局里使用。" },
  { key: "troublemaker", name: "捣蛋鬼", en: "Troublemaker", team: "good", max: 1, pack: "bigbox", icon: "😈", img: ["troublemaker.jpg"], short: "被验时显示为坏人",
    desc: "好人阵营。被牧师、湖中仙女等任何效果验阵营时必须说谎——他一律显示为「坏人」。只在有验人效果的局里使用。" },
  // ───────── Big Box(进阶角色:要额外任务卡)─────────
  { key: "untrustworthy", name: "不忠的仆人", en: "Untrustworthy Servant", team: "good", max: 1, pack: "bigbox2", icon: "🤝", img: ["untrustworthy.jpg"], short: "知道刺客;梅林眼里是坏人;可能被招募",
    desc: "好人阵营,开局知道刺客是谁;在梅林眼里他是坏人;出任务只能出「成功」。好人三次任务成功后、刺杀前多一个「招募」阶段:刺客猜一次谁是不忠的仆人——猜中则他转为坏人并代替刺客执行刺杀,猜错刺客照常刺杀。必须有刺客。" },
  { key: "messenger_senior", name: "资深信使", en: "Senior Messenger", team: "good", max: 1, pack: "bigbox2", icon: "💌", img: ["messenger_senior.jpg"], short: "可出「好信」(整局最多 2 次)",
    desc: "好人阵营。出任务时可出「成功」或「好信」(好信=成功,整局最多出 2 张,每张在该任务上留下公开标记)。第 5 任务翻开后,场上 ≥3 张好信则第 5 任务去掉一张失败。好人胜后刺客可改为指认两名好信使(都对才赢)。可选规则:开局知道初级信使是谁。三张信使一起用。" },
  { key: "messenger_junior", name: "初级信使", en: "Junior Messenger", team: "good", max: 1, pack: "bigbox2", icon: "💌", img: ["messenger_junior.jpg"], short: "可出「好信」(整局最多 2 次)",
    desc: "好人阵营。出任务时可出「成功」或「好信」(好信=成功,整局最多出 2 张,每张在该任务上留下公开标记)。第 5 任务翻开后,场上 ≥3 张好信则第 5 任务去掉一张失败。好人胜后刺客可改为指认两名好信使(都对才赢)。三张信使一起用。" },
  { key: "messenger_evil", name: "坏信使", en: "Evil Messenger", team: "evil", max: 1, pack: "bigbox2", icon: "📨", img: ["messenger_evil.jpg"], short: "可出「坏信」",
    desc: "坏人阵营,与其他坏人互认。出任务时可出「成功」「失败」或「坏信」(坏信=失败,每张在该任务上留下公开标记)。第 5 任务翻开后,场上 ≥2 张坏信则第 5 任务多加一张失败(与 ≥3 好信同时满足则抵消)。三张信使一起用。" },
  { key: "rogue_good", name: "好盗贼", en: "Good Rogue", team: "good", max: 1, pack: "bigbox2", icon: "🗝️", img: ["rogue_good.jpg"], short: "出「盗贼成功」争取个人胜",
    desc: "好人阵营。只有他能出「盗贼成功」(效果同成功,翻开时公开可见)。队长每个任务把手表交给一名队员,持表者不能出盗贼卡(5~6 人前两任务没有手表)。若他在第 3 次任务成功时出了「盗贼成功」、且之前已出过至少 1 张,立即个人获胜(跳过刺杀,其他人都不算赢)。" },
  { key: "rogue_evil", name: "坏盗贼", en: "Evil Rogue", team: "evil", max: 1, pack: "bigbox2", icon: "🔓", img: ["rogue_evil.jpg"], short: "出「盗贼失败」争取个人胜;不与坏人互认",
    desc: "坏人阵营,但不与其他坏人互认(像奥伯伦;梅林看得到他)。只有他能出「盗贼失败」(效果同失败,翻开时公开可见)。队长每个任务把手表交给一名队员,持表者不能出盗贼卡。若他在第 3 次任务失败时出了「盗贼失败」、且之前已出过至少 1 张,立即个人获胜(其他人都不算赢)。" },
  { key: "sorcerer_good", name: "好巫师", en: "Good Sorcerer", team: "good", max: 1, pack: "bigbox2", icon: "✨", img: ["sorcerer_good.jpg"], short: "可出「魔法」反转任务结果",
    desc: "好人阵营。出任务时可出「成功」或「魔法」。任务翻开时若有奇数张魔法,任务结果反转(成功变失败、失败变成功);两张魔法互相抵消。" },
  { key: "sorcerer_evil", name: "坏巫师", en: "Evil Sorcerer", team: "evil", max: 1, pack: "bigbox2", icon: "🪄", img: ["sorcerer_evil.jpg"], short: "可出「魔法」反转任务结果;不能出失败",
    desc: "坏人阵营,与其他坏人互认。出任务时可出「成功」或「魔法」,不能出「失败」。任务翻开时若有奇数张魔法,任务结果反转;两张魔法互相抵消。可选规则(房间设置):他不在开局信息里亮相,梅林看不到他。" },
];

// 任务卡种类:val 结算时按成功/失败计,magic 单独数(奇数张反转结果);who 只有这些角色能出(没有=所有队员按阵营)
export const CARDS = {
  success: { name: "成功", icon: "✓", val: "success" },
  fail: { name: "失败", icon: "✗", val: "fail" },
  goodMsg: { name: "好信", icon: "💌", val: "success", who: ["messenger_senior", "messenger_junior"] },
  evilMsg: { name: "坏信", icon: "📨", val: "fail", who: ["messenger_evil"] },
  rogueSuccess: { name: "盗贼成功", icon: "🗝️", val: "success", who: ["rogue_good"] },
  rogueFail: { name: "盗贼失败", icon: "🔓", val: "fail", who: ["rogue_evil"] },
  magic: { name: "魔法", icon: "✨", val: "magic", who: ["sorcerer_good", "sorcerer_evil"] },
};
export const GOOD_MSG_MAX = 2; // 每名好信使整局最多出几张好信
export const ROLE_BY_KEY = Object.fromEntries(ROLES.map((r) => [r.key, r]));
export const PACKS = { base: "基础版", x: "Avalon X(兰斯洛特)", bigbox: "Big Box", bigbox2: "Big Box 进阶(信使 / 盗贼 / 巫师 / 不忠的仆人)" };

// 人数 → 好/坏人数 与 5 个任务的队伍人数(对照实体版图)。7 人起第 4 任务需两张失败
export const PLAYERS = {
  5: { good: 3, evil: 2, quests: [2, 3, 2, 3, 3] },
  6: { good: 4, evil: 2, quests: [2, 3, 4, 3, 4] },
  7: { good: 4, evil: 3, quests: [2, 3, 3, 4, 4] },
  8: { good: 5, evil: 3, quests: [3, 4, 4, 5, 5] },
  9: { good: 6, evil: 3, quests: [3, 4, 4, 5, 5] },
  10: { good: 6, evil: 4, quests: [3, 4, 4, 5, 5] },
};
export const twoFails = (players, questNo) => players >= 7 && questNo === 4;

export const LANCELOT_MODES = {
  know: "默认:两人互知,不互换",
  random: "变体 1:每个任务开始翻一张阵营卡(4 不变 / 2 互换),翻到互换就秘密互换",
  preset: "变体 2:开局翻好 5 张摆在任务上,大家都知道哪个任务互换",
};

// 推荐配置(国内通行标准配置,docs/avalon/README.md §5)
export function defaultRoles(players) {
  switch (Math.max(5, Math.min(10, players))) {
    case 5: return ["merlin", "percival", "servant", "morgana", "assassin"];
    case 6: return ["merlin", "percival", "servant", "servant", "morgana", "assassin"];
    case 7: return ["merlin", "percival", "servant", "servant", "morgana", "oberon", "assassin"];
    case 8: return ["merlin", "percival", "servant", "servant", "servant", "morgana", "assassin", "minion"];
    case 9: return ["merlin", "percival", "servant", "servant", "servant", "servant", "mordred", "morgana", "assassin"];
    default: return ["merlin", "percival", "servant", "servant", "servant", "servant", "mordred", "morgana", "oberon", "assassin"];
  }
}
