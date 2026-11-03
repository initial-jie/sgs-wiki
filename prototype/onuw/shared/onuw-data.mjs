// 一夜终极狼人(One Night Ultimate Werewolf)角色图鉴 + 夜晚顺序 + 语音播报文案。
// 来源:基础版说明书 + 扩展《Daybreak》《Vampire》说明书(rulespal / ultraboardgames 转录)+ Bonus Roles 包(one-night.fandom.com 角色模板 ability/prompt/wake-order),
//       译名参考 Bezier Games 官方 app《Werewolf》的中文界面习惯。
// 被 onuw-logic.mjs(DO / node 模拟)与 client/onuw.html(经 /onuw/data.json)共用。
//
// 字段:key 内部键 / name 中文名 / en 英文名 / team 阵营(village 村民 | werewolf 狼人 | vampire 吸血鬼 | tanner 皮匠 | indep 独立)/ max 一局最多几张
//       order 唤醒顺序(负数=黄昏 Dusk,吸血鬼包;null=不睁眼)/ pack base|daybreak|bonus|vampire / icon / desc 图鉴说明 / tip 操作提示(夜晚行动面板)
//       narr 语音播报 {open 睁眼, close 闭眼}(没有 order 的角色不播报)/ img 卡图文件名(assets/onuw/,见 docs/onuw/art-sources.md)

export const TEAMS = {
  village: { key: "village", name: "村民阵营", short: "村", color: "#5aa9ff" },
  werewolf: { key: "werewolf", name: "狼人阵营", short: "狼", color: "#ff5a4e" },
  vampire: { key: "vampire", name: "吸血鬼阵营", short: "吸", color: "#c084fc" },
  tanner: { key: "tanner", name: "皮匠(独立)", short: "皮", color: "#c9a24a" },
  indep: { key: "indep", name: "独立", short: "独", color: "#8fd3c8" },
};
// 卡图(需用户自行从 one-night.fandom.com 下载到 assets/onuw/,Pages 直链;没有文件时页面退回表情图标)
export const ART_BASE = "https://initial-jie.github.io/sgs-wiki/assets/onuw/";

export const ROLES = [
  // ───────── 黄昏(吸血鬼包,order<0)─────────
  { key: "copycat", name: "模仿者", en: "Copycat", team: "village", max: 1, order: -8, pack: "vampire", icon: "🪞", img: "copycat.png",
    desc: "黄昏最先睁眼:查看一张中央牌,你从此就是那个角色、属于那个阵营;之后那个角色被叫到时,你一起睁眼执行它的行动。最终持有模仿者牌的人就是她复制的那个角色。",
    tip: "点击一张中央牌查看并成为那个角色。",
    narr: { open: "模仿者,请睁眼,查看一张中央牌。你现在就是那个角色,它被叫到时请一起行动。", close: "模仿者,请闭眼。" } },
  { key: "vampire", name: "吸血鬼", en: "Vampire", team: "vampire", max: 2, order: -6, pack: "vampire", icon: "🧛", img: "vampire.png",
    desc: "黄昏与其他吸血鬼一起睁眼互认,然后共同选择一名非吸血鬼玩家,给他「吸血鬼印记」——他从此也是吸血鬼(保留自己的夜晚行动和投票)。吸血鬼阵营胜利条件:至少一名吸血鬼在场且没有吸血鬼出局(若场上同时有狼人,还要至少一名狼人出局)。",
    tip: "吸血鬼们任选一人点击一名非吸血鬼玩家,放置吸血鬼印记。",
    narr: { open: "吸血鬼,请睁眼,互相确认身份。然后给任意一名非吸血鬼玩家放置吸血鬼印记。", close: "吸血鬼,请闭眼。" } },
  { key: "master", name: "吸血鬼之主", en: "The Master", team: "vampire", max: 1, order: -6, pack: "vampire", icon: "🦇", img: "master.png",
    desc: "与其他吸血鬼一起睁眼并放置吸血鬼印记。投票时,如果有另一名吸血鬼投给他,他受到保护不会出局,改由得票次多的玩家出局。",
    tip: "", narr: null },
  { key: "count", name: "伯爵", en: "The Count", team: "vampire", max: 1, order: -5.8, pack: "vampire", icon: "🎩", img: "count.png",
    desc: "与其他吸血鬼一起睁眼放置吸血鬼印记;之后单独睁眼,必须给一名非吸血鬼玩家放置「恐惧印记」——持有者整晚不能执行夜晚行动(黄昏行动不受影响)。",
    tip: "点击一名非吸血鬼玩家放置恐惧印记(必须)。",
    narr: { open: "伯爵,请睁眼。给任意一名非吸血鬼玩家放置恐惧印记。", close: "伯爵,请闭眼。" } },
  { key: "renfield", name: "仁菲尔德", en: "Renfield", team: "vampire", max: 1, order: -5.7, pack: "vampire", icon: "🕷️", img: "renfield.png",
    desc: "吸血鬼闭眼后指向他们放置印记的玩家;仁菲尔德睁眼看到所有吸血鬼和他们选的人,然后给自己放「蝙蝠印记」(没有效果)。他属于吸血鬼阵营:只要没有吸血鬼出局就赢,哪怕自己出局;场上没有吸血鬼时属于村民阵营。",
    tip: "", narr: { open: "吸血鬼,请指向你们放置印记的玩家。仁菲尔德,请睁眼,看清吸血鬼是谁,然后给自己放置蝙蝠印记。", close: "吸血鬼,请放下手。仁菲尔德,请闭眼。" } },
  { key: "diseased", name: "病患", en: "Diseased", team: "village", max: 1, order: -5, pack: "vampire", icon: "🤒", img: "diseased.png",
    desc: "把「疾病印记」放在左边或右边相邻的一名玩家面前。投票时投给疾病印记持有者的人不能获胜(即便其阵营获胜);印记持有者本人照常结算。",
    tip: "选择左边或右边的邻座放置疾病印记。",
    narr: { open: "病患,请睁眼。把疾病印记放在你左边或右边的玩家面前。", close: "病患,请闭眼。" } },
  { key: "cupid", name: "丘比特", en: "Cupid", team: "village", max: 1, order: -4, pack: "vampire", icon: "💘", img: "cupid.png",
    desc: "可以给任意两名玩家放置「爱之印记」。恋人会在夜里一起睁眼相认;一人出局,另一人也一起出局(即使被保护)。",
    tip: "依次点击两名玩家(可含自己)放置爱之印记,然后确认。",
    narr: { open: "丘比特,请睁眼。你可以给任意两名玩家放置爱之印记。", close: "丘比特,请闭眼。" } },
  { key: "instigator", name: "煽动者", en: "Instigator", team: "village", max: 1, order: -3, pack: "vampire", icon: "📣", img: "instigator.png",
    desc: "可以给任意一名玩家放置「叛徒印记」:持有者只有在自己阵营的另一名玩家出局时才获胜(没有队友则无效果)。",
    tip: "点击一名玩家放置叛徒印记(也可以不放)。",
    narr: { open: "煽动者,请睁眼。你可以给任意一名玩家放置叛徒印记。", close: "煽动者,请闭眼。" } },
  { key: "priest", name: "牧师", en: "Priest", team: "village", max: 1, order: -2, pack: "vampire", icon: "✝️", img: "priest.png",
    desc: "给自己放置「清明印记」(自动),还可以给另一名玩家也放一枚。清明印记持有者的阵营和角色以牌为准(印记只有一枚,会替换掉原来的印记)。",
    tip: "你自己已获得清明印记;可再点击一名其他玩家也放一枚(也可以不放)。",
    narr: { open: "牧师,请睁眼。给自己放置清明印记,也可以给另一名玩家放一枚。", close: "牧师,请闭眼。" } },
  { key: "assassin", name: "刺客", en: "Assassin", team: "indep", max: 1, order: -1, pack: "vampire", icon: "🗡️", img: "assassin-0.png",
    desc: "独立阵营。给任意一名玩家放置「刺客印记」。刺客印记持有者出局则刺客获胜(无论阵营);若结束时刺客自己持有该印记,则只有自己出局才赢。",
    tip: "点击一名玩家放置刺客印记。",
    narr: { open: "刺客,请睁眼。把刺客印记放在任意一名玩家面前。", close: "刺客,请闭眼。" } },
  { key: "apprenticeassassin", name: "刺客学徒", en: "Apprentice Assassin", team: "indep", max: 1, order: -0.8, pack: "vampire", icon: "🔪", img: "apprentice_assassin.png",
    desc: "在刺客还睁着眼时睁眼,看清刺客是谁。刺客出局则学徒获胜(学徒不需要活着)。如果没有刺客在场,学徒代替刺客放置刺客印记,并按刺客的条件获胜。",
    tip: "没有刺客在场时:点击一名玩家放置刺客印记。",
    narr: { open: "刺客学徒,请睁眼,看清刺客是谁。如果没有刺客,请你放置刺客印记。", close: "刺客和刺客学徒,请闭眼。" } },
  { key: "lovers", name: "恋人", en: "Lovers", team: "village", max: 0, order: -0.5, pack: "vampire", icon: "💞", virtual: true,
    desc: "(虚拟阶段)持有爱之印记的玩家一起睁眼相认。", tip: "",
    narr: { open: "持有爱之印记的恋人,请睁眼,互相看看对方。", close: "恋人,请闭眼。" } },
  // ───────── 夜晚 ─────────
  { key: "sentinel", name: "哨兵", en: "Sentinel", team: "village", max: 1, order: 0, pack: "daybreak", icon: "🛡️", img: "sentinel.png",
    desc: "夜晚第一个睁眼。可以在另一名玩家的牌上放置一枚护盾。被护盾保护的牌整晚不能被任何人查看、移动或放置神器——包括它的主人自己(被护盾的强盗/女巫/酒鬼/失眠者对自己这张牌的能力也会失效,酒鬼的强制交换被取消)。护盾是公开的。",
    tip: "点击一名其他玩家的牌,放置护盾(也可以不放)。",
    narr: { open: "哨兵,请睁眼。你可以在另一名玩家的牌上放置护盾。", close: "哨兵,请闭眼。" } },
  { key: "doppelganger", name: "化身幽灵", en: "Doppelgänger", team: "village", max: 1, order: 1, pack: "base", icon: "👥", img: "doppleganger.jpg",
    desc: "夜晚最早行动之一:查看另一名玩家的牌,从此你就是那个角色、属于那个阵营。如果那个角色有立即执行的夜晚行动(预言家/强盗/捣蛋鬼/酒鬼/女巫/头狼/神秘狼/学徒/灵异侦探/村庄白痴/哨兵/那东西/神射手/扒手/小精灵/诺查丹玛斯),你现在就执行;如果是狼人/爪牙/守夜人/失眠者/揭露者/馆长/侍从/旁观者/皮匠学徒/气场预言家,则在该角色被唤醒时一起睁眼;村民/猎人/皮匠/保镖/梦狼/王子/被诅咒者则什么都不做。最终持有化身幽灵牌的人就是她复制的那个角色。",
    tip: "点击一名其他玩家的牌,查看并成为那个角色。",
    narr: { open: "化身幽灵,请睁眼,查看另一名玩家的牌。你现在就是那个角色。如果那个角色有夜晚行动,请立刻执行。", close: "化身幽灵,请闭眼。" } },
  { key: "werewolf", name: "狼人", en: "Werewolf", team: "werewolf", max: 2, order: 2, pack: "base", icon: "🐺", img: "werewolf.jpg",
    desc: "狼人们睁眼互相确认。如果你是场上唯一的狼人,可以查看一张中央牌(便于伪装)。狼人阵营胜利条件:至少有一名狼人在场,且投票后没有任何狼人出局(若场上同时有吸血鬼,还要至少一名吸血鬼出局)。",
    tip: "你是唯一的狼人时,可以点击一张中央牌查看。",
    narr: { open: "狼人,请睁眼,互相确认身份。如果你是唯一的狼人,可以查看一张中央牌。", close: "狼人,请闭眼。" } },
  { key: "alphawolf", name: "头狼", en: "Alpha Wolf", team: "werewolf", max: 1, order: 2.2, pack: "daybreak", icon: "👑", img: "alpha_wolf.png",
    desc: "有头狼的局,中央会额外横放一张狼人牌(第 4 张中央牌)。头狼先与其他狼人一起睁眼,然后单独睁眼:必须把中央那张横放的狼人牌与任意一名非狼人玩家的牌交换(不能看任何一张)。被换到的玩家就变成了狼人。其他能查看/交换中央牌的角色也可以对这张横牌行动。",
    tip: "点击一名非狼人玩家的牌,把中央横放的狼人牌换给他(必须执行)。",
    narr: { open: "头狼,请睁眼。把中央横放的狼人牌与一名非狼人玩家的牌交换。", close: "头狼,请闭眼。" } },
  { key: "mysticwolf", name: "神秘狼", en: "Mystic Wolf", team: "werewolf", max: 1, order: 2.3, pack: "daybreak", icon: "🔮", img: "mystic_wolf.png",
    desc: "先与其他狼人一起睁眼,然后单独睁眼,可以查看另一名玩家的牌。",
    tip: "点击一名其他玩家的牌查看(也可以不看)。",
    narr: { open: "神秘狼,请睁眼。你可以查看另一名玩家的牌。", close: "神秘狼,请闭眼。" } },
  { key: "dreamwolf", name: "梦狼", en: "Dream Wolf", team: "werewolf", max: 1, order: null, pack: "daybreak", icon: "😴", img: "dreamwolf.png",
    desc: "狼人阵营,但夜晚不睁眼。狼人被唤醒时,梦狼竖起大拇指让其他狼人(和爪牙)知道他是同伴;梦狼自己不知道其他狼人是谁。",
    tip: "", narr: null },
  { key: "minion", name: "爪牙", en: "Minion", team: "werewolf", max: 1, order: 3, pack: "base", icon: "🗡️", img: "minion.jpg",
    desc: "在狼人之后睁眼,得知所有狼人是谁(狼人不知道爪牙是谁)。爪牙属于狼人阵营:只要没有狼人出局,爪牙就赢,哪怕自己出局。如果场上没有狼人,爪牙在有非爪牙玩家出局时获胜。",
    tip: "", narr: { open: "爪牙,请睁眼。狼人,请竖起大拇指,让爪牙知道你们是谁。", close: "狼人,请放下大拇指。爪牙,请闭眼。" } },
  { key: "apprenticetanner", name: "皮匠学徒", en: "Apprentice Tanner", team: "tanner", max: 1, order: 3.2, pack: "bonus", icon: "🧵", img: "apprentice_tanner.png",
    desc: "睁眼看皮匠竖起的大拇指,得知皮匠是谁。皮匠出局则学徒获胜;如果场上没有皮匠,学徒就按皮匠的规则——只有自己出局才赢。",
    tip: "", narr: { open: "皮匠学徒,请睁眼。皮匠,请竖起大拇指,让学徒知道你是谁。", close: "皮匠,请放下大拇指。皮匠学徒,请闭眼。" } },
  { key: "mason", name: "守夜人", en: "Mason", team: "village", max: 2, order: 4, pack: "base", icon: "🧱", img: "mason.png",
    desc: "两名守夜人睁眼互相确认。如果只有你一个守夜人睁眼,说明另一张守夜人在中央。",
    tip: "", narr: { open: "守夜人,请睁眼,互相确认身份。", close: "守夜人,请闭眼。" } },
  { key: "thing", name: "那东西", en: "Thing (that goes bump in the night)", team: "village", max: 1, order: 4.2, pack: "bonus", icon: "👋", img: "thing.png",
    desc: "睁眼后可以拍一下左边或右边邻座玩家的肩膀。被拍的玩家会知道「那东西」就在自己的左/右边。",
    tip: "选择拍左边还是右边邻座的肩膀(也可以不拍)。",
    narr: { open: "那东西,请睁眼。你可以拍一下你左边或右边玩家的肩膀。", close: "那东西,请闭眼。" } },
  { key: "seer", name: "预言家", en: "Seer", team: "village", max: 1, order: 5, pack: "base", icon: "👁️", img: "seer-0.png",
    desc: "可以查看另一名玩家的牌,或者查看两张中央牌(不移动)。",
    tip: "点击一名其他玩家的牌,或者点选两张中央牌后确认。",
    narr: { open: "预言家,请睁眼。你可以查看另一名玩家的牌,或者查看两张中央牌。", close: "预言家,请闭眼。" } },
  { key: "apprenticeseer", name: "预言家学徒", en: "Apprentice Seer", team: "village", max: 1, order: 5.2, pack: "daybreak", icon: "🔭", img: "apprentice_seer.png",
    desc: "可以查看一张中央牌。",
    tip: "点击一张中央牌查看。",
    narr: { open: "预言家学徒,请睁眼。你可以查看一张中央牌。", close: "预言家学徒,请闭眼。" } },
  { key: "pi", name: "灵异侦探", en: "Paranormal Investigator", team: "village", max: 1, order: 5.3, pack: "daybreak", icon: "🕵️", img: "paranormal_investigator.png",
    desc: "可以依次查看至多两名其他玩家的牌。如果看到狼人,你就变成狼人(狼人阵营)并立刻停止;看到皮匠,你就变成皮匠并停止;看到吸血鬼则变成吸血鬼。看到的是看过狼人的化身幽灵不会改变你的身份,可以继续看。",
    tip: "点击一名其他玩家的牌查看;看到狼人/吸血鬼/皮匠会立刻停止。",
    narr: { open: "灵异侦探,请睁眼。你可以依次查看至多两名其他玩家的牌;看到狼人或皮匠就必须停止。", close: "灵异侦探,请闭眼。" } },
  { key: "marksman", name: "神射手", en: "Marksman", team: "village", max: 1, order: 5.4, pack: "vampire", icon: "🎯", img: "marksman.png",
    desc: "可以查看一名玩家的牌,以及另一名玩家的印记(两者不能是同一人;也可以只看其中一样)。",
    tip: "点击一名玩家看牌,再点击另一名玩家看印记;选好后确认。",
    narr: { open: "神射手,请睁眼。你可以查看一名玩家的牌和另一名玩家的印记。", close: "神射手,请闭眼。" } },
  { key: "nostradamus", name: "诺查丹玛斯", en: "Nostradamus", team: "indep", max: 1, order: 5.5, pack: "bonus", icon: "🔮", img: "nostradamus.png",
    desc: "依次查看至多三张中央牌;一旦看到非村民阵营的牌就必须停止,并加入那个阵营(都是村民牌则属于村民阵营)。天亮时系统会公开宣布他加入了哪个阵营(他在中央时随机宣布一个)。他只有在自己阵营获胜且自己存活时才获胜。",
    tip: "点击一张中央牌查看;看到非村民牌立刻停止。",
    narr: { open: "诺查丹玛斯,请睁眼。你可以依次查看至多三张中央牌,看到非村民阵营的牌就停止。", close: "诺查丹玛斯,请闭眼。" } },
  { key: "robber", name: "强盗", en: "Robber", team: "village", max: 1, order: 6, pack: "base", icon: "🎭", img: "robber.png",
    desc: "可以把自己的牌与另一名玩家的牌交换,然后查看自己的新牌。你变成了新角色(属于它的阵营,但不执行它的夜晚行动);被抢的人变成了强盗(村民阵营)。",
    tip: "点击一名其他玩家的牌,与之交换并查看新牌(也可以不换)。",
    narr: { open: "强盗,请睁眼。你可以把自己的牌与另一名玩家交换,然后查看你的新牌。", close: "强盗,请闭眼。" } },
  { key: "witch", name: "女巫", en: "Witch", team: "village", max: 1, order: 6.2, pack: "daybreak", icon: "🧙", img: "witch.png",
    desc: "可以查看一张中央牌;如果看了,就必须把它与任意一名玩家(包括自己)的牌交换,不能看被换走的牌。女巫属于村民阵营,除非她把自己的牌换成了其他阵营的牌。",
    tip: "先点一张中央牌查看;看了就必须再点一名玩家(可以是自己)把它换过去。",
    narr: { open: "女巫,请睁眼。你可以查看一张中央牌;如果看了,就必须把它与任意一名玩家的牌交换。", close: "女巫,请闭眼。" } },
  { key: "pickpocket", name: "扒手", en: "Pickpocket", team: "village", max: 1, order: 6.3, pack: "vampire", icon: "🧤", img: "pickpocket.png",
    desc: "可以把自己的印记与另一名玩家的印记交换(对方没有印记时相当于把自己的印记给他),然后查看自己的新印记。",
    tip: "点击一名其他玩家,与之交换印记并查看新印记(也可以不换)。",
    narr: { open: "扒手,请睁眼。你可以与另一名玩家交换印记,然后查看你的新印记。", close: "扒手,请闭眼。" } },
  { key: "troublemaker", name: "捣蛋鬼", en: "Troublemaker", team: "village", max: 1, order: 7, pack: "base", icon: "🔀", img: "troublemaker.png",
    desc: "可以交换另外两名玩家的牌,不能看。",
    tip: "依次点击两名其他玩家的牌,然后确认交换。",
    narr: { open: "捣蛋鬼,请睁眼。你可以交换另外两名玩家的牌。", close: "捣蛋鬼,请闭眼。" } },
  { key: "villageidiot", name: "村庄白痴", en: "Village Idiot", team: "village", max: 1, order: 7.2, pack: "daybreak", icon: "🤪", img: "village_idiot.png",
    desc: "可以把除自己以外所有玩家的牌整体向左或向右移动一位(被护盾保护的牌不动,中央牌不动)。",
    tip: "选择向左 / 向右,其他所有玩家的牌整体移动一位(也可以不动)。",
    narr: { open: "村庄白痴,请睁眼。你可以把其他所有玩家的牌向左或向右移动一位。", close: "村庄白痴,请闭眼。" } },
  { key: "auraseer", name: "气场预言家", en: "Aura Seer", team: "village", max: 1, order: 7.3, pack: "bonus", icon: "🌀", img: "aura_seer.png",
    desc: "睁眼后看到到目前为止所有「查看或移动过牌/印记」的玩家竖起的大拇指(被叫到但什么都没做的人不竖拇指)。",
    tip: "", narr: { open: "气场预言家,请睁眼。所有人:如果你查看或移动过任何牌,请竖起大拇指。", close: "所有人,请放下拇指。气场预言家,请闭眼。" } },
  { key: "gremlin", name: "小精灵", en: "Gremlin", team: "village", max: 1, order: 7.4, pack: "vampire", icon: "👺", img: "gremlin.png",
    desc: "可以交换任意两名玩家(可含自己)的牌,或者交换他们的印记(二选一),不能看。",
    tip: "先选「换牌」或「换印记」,再依次点击两名玩家,确认。",
    narr: { open: "小精灵,请睁眼。你可以交换任意两名玩家的牌,或者交换他们的印记。", close: "小精灵,请闭眼。" } },
  { key: "drunk", name: "酒鬼", en: "Drunk", team: "village", max: 1, order: 8, pack: "base", icon: "🍺", img: "drunk.png",
    desc: "必须把自己的牌与一张中央牌交换,不能看。你不知道自己变成了什么。",
    tip: "点击一张中央牌与之交换(必须执行,不能看)。",
    narr: { open: "酒鬼,请睁眼。把你的牌与一张中央牌交换,不要看。", close: "酒鬼,请闭眼。" } },
  { key: "insomniac", name: "失眠者", en: "Insomniac", team: "village", max: 1, order: 9, pack: "base", icon: "🛌", img: "insomniac.png",
    desc: "夜晚最后睁眼,查看自己的牌,确认有没有被换掉。",
    tip: "", narr: { open: "失眠者,请睁眼,查看你自己的牌。", close: "失眠者,请闭眼。" } },
  { key: "squire", name: "侍从", en: "Squire", team: "werewolf", max: 1, order: 9.3, pack: "bonus", icon: "🛎️", img: "squire.png",
    desc: "狼人阵营但不是狼。睁眼看狼人竖起的大拇指,还可以查看他们现在的牌,确认他们有没有被换掉。只要没有狼人出局侍从就赢(自己出局也算);场上没有狼人时,侍从要在自己存活且另有玩家出局时才获胜。",
    tip: "可点击狼人的牌逐个查看(也可以不看)。",
    narr: { open: "侍从,请睁眼。狼人,请竖起大拇指。侍从,你可以查看狼人的牌。", close: "狼人,请放下拇指。侍从,请闭眼。" } },
  { key: "beholder", name: "旁观者", en: "Beholder", team: "village", max: 1, order: 9.9, pack: "bonus", icon: "🧿", img: "beholder.png",
    desc: "睁眼看预言家和预言家学徒竖起的大拇指,还可以查看他们现在的牌,确认他们有没有被换掉。",
    tip: "可点击预言家/学徒的牌逐个查看(也可以不看)。",
    narr: { open: "旁观者,请睁眼。预言家和预言家学徒,请竖起大拇指。旁观者,你可以查看他们的牌。", close: "预言家,请放下拇指。旁观者,请闭眼。" } },
  { key: "revealer", name: "揭露者", en: "Revealer", team: "village", max: 1, order: 10, pack: "daybreak", icon: "🔦", img: "revealer.png",
    desc: "可以把另一名玩家的牌翻开(全场可见)。如果翻开的是狼人、吸血鬼或皮匠,立刻翻回去(只有揭露者看到了)。",
    tip: "点击一名其他玩家的牌翻开;狼人/吸血鬼/皮匠会被自动翻回。",
    narr: { open: "揭露者,请睁眼。你可以翻开另一名玩家的牌;如果是狼人或皮匠,就翻回去。", close: "揭露者,请闭眼。" } },
  { key: "curator", name: "馆长", en: "Curator", team: "village", max: 1, order: 11, pack: "daybreak", icon: "🏺", img: "curator.png",
    desc: "可以把一枚随机的神器面朝下放在任意一名玩家(包括自己)的牌上,不能看。天亮后持有神器的玩家可以偷看自己的神器;神器会改变角色(狼人之爪→狼人,村民烙印→村民,皮匠之棍→皮匠),或者只是限制行为(缄默面具/羞耻裹布),或者没有效果(虚无)。",
    tip: "点击一名玩家(可以是自己)的牌放置神器。",
    narr: { open: "馆长,请睁眼。你可以把一枚神器放在任意一名玩家的牌上。", close: "馆长,请闭眼。" } },
  // ───────── 不睁眼 ─────────
  { key: "villager", name: "村民", en: "Villager", team: "village", max: 3, order: null, pack: "base", icon: "👨‍🌾", img: "villager.png",
    desc: "没有特殊能力。村民阵营胜利条件:每个在场的邪恶阵营(狼人/吸血鬼)都至少有一人出局;或者场上没有邪恶阵营且无人出局。",
    tip: "", narr: null },
  { key: "bodyguard", name: "保镖", en: "Bodyguard", team: "village", max: 1, order: null, pack: "daybreak", icon: "🥋", img: "bodyguard.png",
    desc: "夜晚不睁眼。投票时保镖指向的玩家不会出局;如果那名玩家得票最多,则由得票次多的玩家(至少 2 票)出局。建议 5 人以上使用。",
    tip: "", narr: null },
  { key: "hunter", name: "猎人", en: "Hunter", team: "village", max: 1, order: null, pack: "base", icon: "🏹", img: "hunter.png",
    desc: "夜晚不睁眼。如果猎人出局,他投票指向的玩家也一起出局。",
    tip: "", narr: null },
  { key: "prince", name: "王子", en: "Prince", team: "village", max: 1, order: null, pack: "bonus", icon: "🤴", img: "prince.png",
    desc: "夜晚不睁眼。投给王子的票不算数:如果王子得票最多,改由得票次多的玩家出局。",
    tip: "", narr: null },
  { key: "cursed", name: "被诅咒者", en: "Cursed", team: "village", max: 1, order: null, pack: "bonus", icon: "🧟", img: "cursed.png",
    desc: "夜晚不睁眼。属于村民阵营——除非投票时至少有一名狼人(或吸血鬼)投给他,他就变成狼人(或吸血鬼)并加入那个阵营。也就是说被诅咒者得票最多且其中有狼人的票时,村民阵营获胜。",
    tip: "", narr: null },
  { key: "tanner", name: "皮匠", en: "Tanner", team: "tanner", max: 1, order: null, pack: "base", icon: "🪢", img: "tanner.png",
    desc: "独立阵营,只有自己出局才获胜。皮匠出局时狼人/吸血鬼阵营必败;如果皮匠和狼人都出局,皮匠与村民阵营一起获胜。",
    tip: "", narr: null },
];
export const ROLE_BY_KEY = Object.fromEntries(ROLES.map((r) => [r.key, r]));
export const PACKS = { base: "基础版", daybreak: "Daybreak 扩展", bonus: "Bonus Roles 扩展", vampire: "Vampire 扩展" };

// 唤醒顺序(只列有 order 的角色,含虚拟阶段 lovers);牌堆里有该角色(含中央牌)就会播报该阶段
export const NIGHT_ORDER = ROLES.filter((r) => r.order != null).sort((a, b) => a.order - b.order).map((r) => r.key);
// 狼人系(计入"狼人是否出局")/ 吸血鬼系 / 狼人阶段会睁眼的狼(梦狼不睁眼)
export const WOLF_ROLES = new Set(["werewolf", "alphawolf", "mysticwolf", "dreamwolf"]);
export const VAMP_ROLES = new Set(["vampire", "master", "count"]);
export const WAKE_WOLVES = new Set(["werewolf", "alphawolf", "mysticwolf"]);
// 化身幽灵复制后立即执行的角色;其余"群体阶段"角色在该角色阶段一起睁眼;村民/猎人/皮匠/保镖/梦狼/王子/被诅咒者无事
export const DG_IMMEDIATE = new Set(["sentinel", "seer", "apprenticeseer", "pi", "robber", "witch", "troublemaker", "villageidiot", "drunk", "alphawolf", "mysticwolf", "thing", "marksman", "pickpocket", "gremlin", "nostradamus"]);
export const DG_GROUP = new Set(["werewolf", "alphawolf", "mysticwolf", "minion", "mason", "insomniac", "revealer", "curator", "squire", "beholder", "apprenticetanner", "auraseer"]);
// 必须执行(不能跳过)的行动
export const MANDATORY = new Set(["drunk", "alphawolf", "doppelganger", "copycat", "count", "diseased", "assassin"]);

export const MARKS = [
  { key: "vampire", name: "吸血鬼印记", icon: "🧛", desc: "持有者成为吸血鬼(吸血鬼阵营),保留自己的夜晚行动和投票。" },
  { key: "fear", name: "恐惧印记", icon: "😱", desc: "持有者整晚不能执行夜晚行动(黄昏行动不受影响)。" },
  { key: "bat", name: "蝙蝠印记", icon: "🦇", desc: "仁菲尔德放在自己面前,没有效果。" },
  { key: "disease", name: "疾病印记", icon: "🤒", desc: "投给持有者的玩家不能获胜(即便其阵营获胜);持有者本人照常结算。" },
  { key: "love", name: "爱之印记", icon: "💘", desc: "恋人夜里一起睁眼相认;一人出局另一人也出局(即使被保护)。" },
  { key: "traitor", name: "叛徒印记", icon: "🗡️", desc: "持有者只有在自己阵营的另一名玩家出局时才获胜;没有队友则无效果。" },
  { key: "clarity", name: "清明印记", icon: "✨", desc: "持有者的阵营和角色以牌为准(没有其他效果)。" },
  { key: "assassin", name: "刺客印记", icon: "🎯", desc: "持有者出局则刺客获胜;结束时刺客自己持有则刺客只有出局才赢。" },
];
export const MARK_BY_KEY = Object.fromEntries(MARKS.map((m) => [m.key, m]));

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
  duskStart: "黄昏降临。所有人请把牌面朝下放在面前,闭上眼睛。",
  nightStart: "天黑请闭眼。所有人请把牌面朝下放在面前。",
  nightEnd: "所有人请闭眼。天亮了,请所有人睁眼!",
  voteClosed: "投票结束,请所有人翻开自己的牌。",
};

// 推荐配置:按人数从前往后取 人数+3 张
export const DEFAULT_FILL = ["werewolf", "werewolf", "seer", "robber", "troublemaker", "villager", "villager", "mason", "mason", "minion", "insomniac", "drunk", "villager", "hunter", "tanner"];
export function defaultRoles(players) { return DEFAULT_FILL.slice(0, players + 3); }
