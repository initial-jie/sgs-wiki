// 一夜终极狼人(One Night Ultimate Werewolf)角色图鉴 + 夜晚顺序 + 语音播报文案。
// 来源:基础版说明书 + 扩展《Daybreak》说明书(rulespal / ultraboardgames 转录),译名参考 Bezier Games 官方 app《Werewolf》的中文界面习惯。
// 被 onuw-logic.mjs(DO / node 模拟)与 client/onuw.html(经 /onuw/data.json)共用。
//
// 字段:key 内部键 / name 中文名 / en 英文名 / team 阵营(village 村民 | werewolf 狼人 | tanner 皮匠·第三方)/ max 一局最多几张
//       order 夜晚唤醒顺序(null=不睁眼)/ pack base|daybreak / icon / desc 图鉴说明 / tip 操作提示(夜晚行动面板)
//       narr 语音播报 {open 睁眼, close 闭眼}(没有 order 的角色不播报)

export const TEAMS = {
  village: { key: "village", name: "村民阵营", short: "村", color: "#5aa9ff" },
  werewolf: { key: "werewolf", name: "狼人阵营", short: "狼", color: "#ff5a4e" },
  tanner: { key: "tanner", name: "皮匠(独立)", short: "皮", color: "#c9a24a" },
};

export const ROLES = [
  { key: "sentinel", name: "哨兵", en: "Sentinel", team: "village", max: 1, order: 0, pack: "daybreak", icon: "🛡️",
    desc: "夜晚第一个睁眼。可以在另一名玩家的牌上放置一枚护盾。被护盾保护的牌整晚不能被任何人查看、移动或放置神器——包括它的主人自己(被护盾的强盗/女巫/酒鬼/失眠者对自己这张牌的能力也会失效,酒鬼的强制交换被取消)。护盾是公开的。",
    tip: "点击一名其他玩家的牌,放置护盾(也可以不放)。",
    narr: { open: "哨兵,请睁眼。你可以在另一名玩家的牌上放置护盾。", close: "哨兵,请闭眼。" } },
  { key: "doppelganger", name: "化身幽灵", en: "Doppelgänger", team: "village", max: 1, order: 1, pack: "base", icon: "👥",
    desc: "夜晚最早行动之一:查看另一名玩家的牌,从此你就是那个角色、属于那个阵营。如果那个角色有立即执行的夜晚行动(预言家/强盗/捣蛋鬼/酒鬼/女巫/头狼/神秘狼/学徒/灵异侦探/村庄白痴/哨兵),你现在就执行;如果是狼人/爪牙/守夜人/失眠者/揭露者/馆长,则在该角色被唤醒时一起睁眼;村民/猎人/皮匠/保镖/梦狼则什么都不做。最终持有化身幽灵牌的人就是她复制的那个角色。",
    tip: "点击一名其他玩家的牌,查看并成为那个角色。",
    narr: { open: "化身幽灵,请睁眼,查看另一名玩家的牌。你现在就是那个角色。如果那个角色有夜晚行动,请立刻执行。", close: "化身幽灵,请闭眼。" } },
  { key: "werewolf", name: "狼人", en: "Werewolf", team: "werewolf", max: 2, order: 2, pack: "base", icon: "🐺",
    desc: "狼人们睁眼互相确认。如果你是场上唯一的狼人,可以查看一张中央牌(便于伪装)。狼人阵营胜利条件:至少有一名狼人在场,且投票后没有任何狼人出局。",
    tip: "你是唯一的狼人时,可以点击一张中央牌查看。",
    narr: { open: "狼人,请睁眼,互相确认身份。如果你是唯一的狼人,可以查看一张中央牌。", close: "狼人,请闭眼。" } },
  { key: "alphawolf", name: "头狼", en: "Alpha Wolf", team: "werewolf", max: 1, order: 2.2, pack: "daybreak", icon: "👑",
    desc: "有头狼的局,中央会额外横放一张狼人牌(第 4 张中央牌)。头狼先与其他狼人一起睁眼,然后单独睁眼:必须把中央那张横放的狼人牌与任意一名非狼人玩家的牌交换(不能看任何一张)。被换到的玩家就变成了狼人。其他能查看/交换中央牌的角色也可以对这张横牌行动。",
    tip: "点击一名非狼人玩家的牌,把中央横放的狼人牌换给他(必须执行)。",
    narr: { open: "头狼,请睁眼。把中央横放的狼人牌与一名非狼人玩家的牌交换。", close: "头狼,请闭眼。" } },
  { key: "mysticwolf", name: "神秘狼", en: "Mystic Wolf", team: "werewolf", max: 1, order: 2.3, pack: "daybreak", icon: "🔮",
    desc: "先与其他狼人一起睁眼,然后单独睁眼,可以查看另一名玩家的牌。",
    tip: "点击一名其他玩家的牌查看(也可以不看)。",
    narr: { open: "神秘狼,请睁眼。你可以查看另一名玩家的牌。", close: "神秘狼,请闭眼。" } },
  { key: "dreamwolf", name: "梦狼", en: "Dream Wolf", team: "werewolf", max: 1, order: null, pack: "daybreak", icon: "😴",
    desc: "狼人阵营,但夜晚不睁眼。狼人被唤醒时,梦狼竖起大拇指让其他狼人(和爪牙)知道他是同伴;梦狼自己不知道其他狼人是谁。",
    tip: "", narr: null },
  { key: "minion", name: "爪牙", en: "Minion", team: "werewolf", max: 1, order: 3, pack: "base", icon: "🗡️",
    desc: "在狼人之后睁眼,得知所有狼人是谁(狼人不知道爪牙是谁)。爪牙属于狼人阵营:只要没有狼人出局,爪牙就赢,哪怕自己出局。如果场上没有狼人,爪牙在有非爪牙玩家出局时获胜。",
    tip: "", narr: { open: "爪牙,请睁眼。狼人,请竖起大拇指,让爪牙知道你们是谁。", close: "狼人,请放下大拇指。爪牙,请闭眼。" } },
  { key: "mason", name: "守夜人", en: "Mason", team: "village", max: 2, order: 4, pack: "base", icon: "🧱",
    desc: "两名守夜人睁眼互相确认。如果只有你一个守夜人睁眼,说明另一张守夜人在中央。",
    tip: "", narr: { open: "守夜人,请睁眼,互相确认身份。", close: "守夜人,请闭眼。" } },
  { key: "seer", name: "预言家", en: "Seer", team: "village", max: 1, order: 5, pack: "base", icon: "👁️",
    desc: "可以查看另一名玩家的牌,或者查看两张中央牌(不移动)。",
    tip: "点击一名其他玩家的牌,或者点选两张中央牌后确认。",
    narr: { open: "预言家,请睁眼。你可以查看另一名玩家的牌,或者查看两张中央牌。", close: "预言家,请闭眼。" } },
  { key: "apprenticeseer", name: "预言家学徒", en: "Apprentice Seer", team: "village", max: 1, order: 5.2, pack: "daybreak", icon: "🔭",
    desc: "可以查看一张中央牌。",
    tip: "点击一张中央牌查看。",
    narr: { open: "预言家学徒,请睁眼。你可以查看一张中央牌。", close: "预言家学徒,请闭眼。" } },
  { key: "pi", name: "灵异侦探", en: "Paranormal Investigator", team: "village", max: 1, order: 5.3, pack: "daybreak", icon: "🕵️",
    desc: "可以依次查看至多两名其他玩家的牌。如果看到狼人,你就变成狼人(狼人阵营)并立刻停止;看到皮匠,你就变成皮匠并停止。看到的是看过狼人的化身幽灵不会改变你的身份,可以继续看。",
    tip: "点击一名其他玩家的牌查看;看到狼人或皮匠会立刻停止。",
    narr: { open: "灵异侦探,请睁眼。你可以依次查看至多两名其他玩家的牌;看到狼人或皮匠就必须停止。", close: "灵异侦探,请闭眼。" } },
  { key: "robber", name: "强盗", en: "Robber", team: "village", max: 1, order: 6, pack: "base", icon: "🎭",
    desc: "可以把自己的牌与另一名玩家的牌交换,然后查看自己的新牌。你变成了新角色(属于它的阵营,但不执行它的夜晚行动);被抢的人变成了强盗(村民阵营)。",
    tip: "点击一名其他玩家的牌,与之交换并查看新牌(也可以不换)。",
    narr: { open: "强盗,请睁眼。你可以把自己的牌与另一名玩家交换,然后查看你的新牌。", close: "强盗,请闭眼。" } },
  { key: "witch", name: "女巫", en: "Witch", team: "village", max: 1, order: 6.2, pack: "daybreak", icon: "🧙",
    desc: "可以查看一张中央牌;如果看了,就必须把它与任意一名玩家(包括自己)的牌交换,不能看被换走的牌。女巫属于村民阵营,除非她把自己的牌换成了其他阵营的牌。",
    tip: "先点一张中央牌查看;看了就必须再点一名玩家(可以是自己)把它换过去。",
    narr: { open: "女巫,请睁眼。你可以查看一张中央牌;如果看了,就必须把它与任意一名玩家的牌交换。", close: "女巫,请闭眼。" } },
  { key: "troublemaker", name: "捣蛋鬼", en: "Troublemaker", team: "village", max: 1, order: 7, pack: "base", icon: "🔀",
    desc: "可以交换另外两名玩家的牌,不能看。",
    tip: "依次点击两名其他玩家的牌,然后确认交换。",
    narr: { open: "捣蛋鬼,请睁眼。你可以交换另外两名玩家的牌。", close: "捣蛋鬼,请闭眼。" } },
  { key: "villageidiot", name: "村庄白痴", en: "Village Idiot", team: "village", max: 1, order: 7.2, pack: "daybreak", icon: "🤪",
    desc: "可以把除自己以外所有玩家的牌整体向左或向右移动一位(被护盾保护的牌不动,中央牌不动)。",
    tip: "选择向左 / 向右,其他所有玩家的牌整体移动一位(也可以不动)。",
    narr: { open: "村庄白痴,请睁眼。你可以把其他所有玩家的牌向左或向右移动一位。", close: "村庄白痴,请闭眼。" } },
  { key: "drunk", name: "酒鬼", en: "Drunk", team: "village", max: 1, order: 8, pack: "base", icon: "🍺",
    desc: "必须把自己的牌与一张中央牌交换,不能看。你不知道自己变成了什么。",
    tip: "点击一张中央牌与之交换(必须执行,不能看)。",
    narr: { open: "酒鬼,请睁眼。把你的牌与一张中央牌交换,不要看。", close: "酒鬼,请闭眼。" } },
  { key: "insomniac", name: "失眠者", en: "Insomniac", team: "village", max: 1, order: 9, pack: "base", icon: "🛌",
    desc: "夜晚最后睁眼,查看自己的牌,确认有没有被换掉。",
    tip: "", narr: { open: "失眠者,请睁眼,查看你自己的牌。", close: "失眠者,请闭眼。" } },
  { key: "revealer", name: "揭露者", en: "Revealer", team: "village", max: 1, order: 10, pack: "daybreak", icon: "🔦",
    desc: "可以把另一名玩家的牌翻开(全场可见)。如果翻开的是狼人或皮匠,立刻翻回去(只有揭露者看到了)。",
    tip: "点击一名其他玩家的牌翻开;狼人/皮匠会被自动翻回。",
    narr: { open: "揭露者,请睁眼。你可以翻开另一名玩家的牌;如果是狼人或皮匠,就翻回去。", close: "揭露者,请闭眼。" } },
  { key: "curator", name: "馆长", en: "Curator", team: "village", max: 1, order: 11, pack: "daybreak", icon: "🏺",
    desc: "可以把一枚随机的神器面朝下放在任意一名玩家(包括自己)的牌上,不能看。天亮后持有神器的玩家可以偷看自己的神器;神器会改变角色(狼人之爪→狼人,村民烙印→村民,皮匠之棍→皮匠),或者只是限制行为(缄默面具/羞耻裹布),或者没有效果(虚无)。",
    tip: "点击一名玩家(可以是自己)的牌放置神器。",
    narr: { open: "馆长,请睁眼。你可以把一枚神器放在任意一名玩家的牌上。", close: "馆长,请闭眼。" } },
  { key: "villager", name: "村民", en: "Villager", team: "village", max: 3, order: null, pack: "base", icon: "👨‍🌾",
    desc: "没有特殊能力。村民阵营胜利条件:至少一名狼人出局;或者场上没有狼人且无人出局。",
    tip: "", narr: null },
  { key: "bodyguard", name: "保镖", en: "Bodyguard", team: "village", max: 1, order: null, pack: "daybreak", icon: "🥋",
    desc: "夜晚不睁眼。投票时保镖指向的玩家不会出局;如果那名玩家得票最多,则由得票次多的玩家(至少 2 票)出局。建议 5 人以上使用。",
    tip: "", narr: null },
  { key: "hunter", name: "猎人", en: "Hunter", team: "village", max: 1, order: null, pack: "base", icon: "🏹",
    desc: "夜晚不睁眼。如果猎人出局,他投票指向的玩家也一起出局。",
    tip: "", narr: null },
  { key: "tanner", name: "皮匠", en: "Tanner", team: "tanner", max: 1, order: null, pack: "base", icon: "🪢",
    desc: "独立阵营,只有自己出局才获胜。皮匠出局时狼人阵营必败;如果皮匠和狼人都出局,皮匠与村民阵营一起获胜。",
    tip: "", narr: null },
];
export const ROLE_BY_KEY = Object.fromEntries(ROLES.map((r) => [r.key, r]));

// 夜晚唤醒顺序(只列有 order 的角色);牌堆里有该角色(含中央牌)就会播报该阶段
export const NIGHT_ORDER = ROLES.filter((r) => r.order != null).sort((a, b) => a.order - b.order).map((r) => r.key);
// 狼人系(计入"狼人是否出局")
export const WOLF_ROLES = new Set(["werewolf", "alphawolf", "mysticwolf", "dreamwolf"]);
// 狼人阶段会睁眼的狼(梦狼不睁眼)
export const WAKE_WOLVES = new Set(["werewolf", "alphawolf", "mysticwolf"]);
// 化身幽灵复制后立即执行的角色;其余(狼人/爪牙/守夜人/失眠者/揭露者/馆长)在该角色阶段一起睁眼;村民/猎人/皮匠/保镖/梦狼无事
export const DG_IMMEDIATE = new Set(["sentinel", "seer", "apprenticeseer", "pi", "robber", "witch", "troublemaker", "villageidiot", "drunk", "alphawolf", "mysticwolf"]);
export const DG_GROUP = new Set(["werewolf", "alphawolf", "mysticwolf", "minion", "mason", "insomniac", "revealer", "curator"]);
// 必须执行(不能跳过)的夜晚行动
export const MANDATORY = new Set(["drunk", "alphawolf", "doppelganger"]);

export const ARTIFACTS = [
  { key: "claw", name: "狼人之爪", desc: "你现在是狼人(狼人阵营)。", becomes: "werewolf" },
  { key: "brand", name: "村民烙印", desc: "你现在是普通村民,没有任何能力。", becomes: "villager" },
  { key: "cudgel", name: "皮匠之棍", desc: "你现在是皮匠:只有自己出局才赢;你出局狼人必败;狼人也出局则你与村民同胜。", becomes: "tanner" },
  { key: "void", name: "虚无", desc: "没有任何效果。", becomes: null },
  { key: "mask", name: "缄默面具", desc: "白天你不能说话,只能用手势(角色不变)。", becomes: null },
  { key: "shroud", name: "羞耻裹布", desc: "白天你要背对大家,不能看其他人和牌;可以说话;投票时由其他人决定你指向谁(角色不变)。", becomes: null },
];
export const ARTIFACT_BY_KEY = Object.fromEntries(ARTIFACTS.map((a) => [a.key, a]));

// 全局播报文案(非角色)
export const NARR = {
  nightStart: "天黑请闭眼。所有人请把牌面朝下放在面前。",
  nightEnd: "所有人请闭眼。天亮了,请所有人睁眼!",
  dayOrder: (round, total, seat) => `第${round}轮发言,顺序发言,从${seat}号开始。`,
  dayFree: (round, total, min) => `第${round}轮,自由讨论,${min}分钟。`,
  anchor: (seat) => `所有人发言完毕,由${seat}号归票沉底发言。`,
  vote: (sec) => `讨论结束,请投票。${sec}秒内选择你要出局的玩家。`,
  voteClosed: "投票结束,请所有人翻开自己的牌。",
};

// 推荐配置:按人数从前往后取 人数+3 张
export const DEFAULT_FILL = ["werewolf", "werewolf", "seer", "robber", "troublemaker", "villager", "villager", "mason", "mason", "minion", "insomniac", "drunk", "villager", "hunter", "tanner"];
export function defaultRoles(players) { return DEFAULT_FILL.slice(0, players + 3); }
