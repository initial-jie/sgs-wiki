// 枪鸣锈语(游卡《枪鸣锈语 RUSTY GUNSHOTS》基础包,2026-05)静态数据 —— 被 qmxy-logic.mjs(DO/sim)与客户端(worker 下发 /qmxy/data.json)共用。
//
// 数据来源:实体卡 + 说明书照片转录(docs/qmxy/raw/*.md,2026-11-02),技能/牌面文本按卡面逐字录入。
// ⚠ verified:false 的牌照片里没有,文本来自说明书 FAQ/百度 AI 摘要的转述,待对照实体牌改正。
// 角色无势力、无称号(卡面只有名字 + 台词);hp=血量上限(也是手牌上限),supply=补给(每回合摸牌数),ammo=子弹上限。
// 图片:assets/qmxy/(GitHub Pages 托管,ART_BASE 直链)—— thumb/<id>.jpg 方形头像(座位/列表)、cards/<id>.jpg 整张实卡(贴吧实拍裁切,带拍照者气泡,待换官方扫图)、
//   art/<id>.jpg 干净立绘(目前只有 6 孙鲁班、8 貂蝉:皮肤吧修复图;扩展将 101+ 来自官方原画视频帧)。字段 card/art 标记有没有对应文件。
export const ART_BASE = "https://initial-jie.github.io/sgs-wiki/assets/qmxy/";

export const HEROES = [
  { id: 1, name: "张春华", hp: 4, supply: 3, ammo: 2, card: true, skills: [
    { name: "空间锚定", text: "若你未受伤，你视为装备着【真理之眼】。" },
    { name: "破碎花语", text: "你当前弹匣的最后 1 枚子弹造成的伤害+1。" } ] },
  { id: 2, name: "王异", hp: 5, supply: 2, ammo: 2, card: true, skills: [
    { name: "践踏命运", text: "你射击的命中判定生效前，你可以用牌堆顶的牌代替。" },
    { name: "赤血烙印", text: "每回合限一次，你可以将一张牌当【化血为剑】使用。" } ] },
  { id: 3, name: "霍光", hp: 4, supply: 2, ammo: 3, card: true, skills: [
    { name: "叠加态子弹", text: "你射击进行命中判定前，你可以令目标猜测本次能否命中；若猜错，你摸一张牌。" } ] },
  { id: 4, name: "大乔", hp: 4, supply: 2, ammo: 6, card: true, skills: [
    { name: "赌徒直觉", text: "每回合限一次，你可以将一张牌当【翻滚】使用。" },
    { name: "禁锢手铐", text: "你的【扫射】仅能当【点射】使用，除非此牌是你最后一张手牌。" } ] },
  { id: 5, name: "王莽", hp: 4, supply: 4, ammo: 4, card: true, skills: [
    { name: "时空乱流", text: "第一轮你不执行回合。" } ] },
  { id: 6, name: "孙鲁班", hp: 4, supply: 3, ammo: 2, card: true, art: true, skills: [
    { name: "翻云覆雨", text: "你射击的命中判定结果反转（命中改为未命中，未命中改为命中）。" } ] },
  { id: 7, name: "孙尚香", hp: 4, supply: 3, ammo: 2, card: true, skills: [
    { name: "滞留针", text: "你的【点射】造成伤害后，你可以将此牌当【EMP清道夫】放置于受伤角色面前。" } ] },
  { id: 8, name: "貂蝉", hp: 4, supply: 3, ammo: 2, card: true, art: true, skills: [
    { name: "杀意回眸", text: "其他角色回合结束时，若其有剩余子弹，你可以弃置一张牌对其依次发射其剩余子弹。" } ] },
  { id: 9, name: "霍去病", hp: 4, supply: 3, ammo: 2, card: true, skills: [
    { name: "虽远必诛", text: "你对非相邻角色的射击伤害+1。" } ] },
  { id: 10, name: "曹仁", hp: 4, supply: 3, ammo: 2, card: true, skills: [
    { name: "生命链接", text: "你可以对其他角色使用【静滞力场】；你可以将点数大于当前射击牌的牌当【静滞力场】使用。" } ] },
  { id: 11, name: "孙鲁育", hp: 4, supply: 3, ammo: 2, card: true, skills: [
    { name: "止干戈", text: "出牌阶段，你可以消耗任意枚子弹，令一名其他角色摸等量的牌。" },
    { name: "血与泪", text: "你使用【点射】时可以用你的血量代替子弹的消耗。" } ] },
  { id: 12, name: "孙策", hp: 5, supply: 3, ammo: 1, card: true, skills: [
    { name: "剑已出鞘", text: "若你本回合未受到过伤害，你可以将射击牌当【归零斩】使用。" },
    { name: "闪中恶鬼", text: "上家回合结束时，你可以将一张牌当【致命闪光】对你使用。" } ] },
  { id: 13, name: "黄月英", hp: 3, supply: 4, ammo: 2, card: true, skills: [
    { name: "机体过载", text: "你可以装备任意张装备牌；若你已有三张装备牌，你射击伤害+1。" } ] },
  { id: 14, name: "马超", hp: 5, supply: 2, ammo: 2, card: true, skills: [
    { name: "来肉搏吧!", text: "出牌阶段限一次，你可以令至多两名其他角色各将一张牌当【归零斩】对你使用。" },
    { name: "强壮胸肌", text: "当你受到非射击伤害后，你摸一张牌。" } ] },
  { id: 15, name: "甄宓", hp: 3, supply: 3, ammo: 3, card: true, skills: [
    { name: "幸运一击", text: "当你射击恰好命中时，你可令一名角色回复 1 点血量。" },
    { name: "偷龙转凤", text: "出牌阶段限一次，你可以观看牌堆顶的一张牌，并可以用一张手牌替换。" } ] },
  { id: 16, name: "司马懿", hp: 4, supply: 2, ammo: 3, card: true, skills: [
    { name: "时空赝品", text: "一次未命中的命中判定生效前，你可以用一张牌代替，然后若变成恰好命中（点数-1则无法命中），你摸两张牌。" } ] },
  { id: 17, name: "左慈", hp: 4, supply: 0, ammo: 0, card: true, skills: [
    { name: "一气化三清", text: "回合开始时，亮出牌堆顶的三张牌，令其中两张的点数分别作为本回合子弹数和补给，剩余一张加入手牌。" } ] },
  { id: 18, name: "徐庶", hp: 4, supply: 2, ammo: 3, card: true, skills: [
    { name: "窥探灵魂", text: "你下家的回合开始时，你可以观看两名角色的手牌（你可以合规地通牌！）；你说过话的回合结束时，你失去 1 点血量。" },
    { name: "索命轻语", text: "出牌阶段限一次，你可以呼唤一名角色的名字对其造成 1 点伤害。" } ] },
  { id: 19, name: "吕布", hp: 5, supply: 3, ammo: 2, card: true, skills: [
    { name: "死亡宣告", text: "你 4 点的判定牌点数视为爆头；你真正的爆头将直接杀死目标！" } ] },
  { id: 20, name: "蔡文姬", hp: 3, supply: 3, ammo: 3, card: true, skills: [
    { name: "包子炸弹", text: "出牌阶段限一次，你可以令场上一张装备牌视为【EMP清道夫】直到回合结束（可以对此牌射击！）" } ] },
  { id: 21, name: "小乔", hp: 4, supply: 3, ammo: 2, card: true, skills: [
    { name: "子弹诡计", text: "你射击的命中判定失败后，子弹将直接命中射击方向的下个角色（不能是射击者）。" } ] },
  { id: 22, name: "刘备", hp: 3, supply: 3, ammo: 3, card: true, skills: [
    { name: "游龙剑舞", text: "当你使用【翻滚】后，你可以将一张牌当【归零斩】使用并摸一张牌。" } ] },
  { id: 23, name: "甘宁", hp: 4, supply: 2, ammo: 3, card: true, skills: [
    { name: "窃神宴", text: "你可以将一张 1 点的手牌当【剥离】使用。" } ] },
  { id: 24, name: "曹操", hp: 4, supply: 2, ammo: 3, card: true, skills: [
    { name: "噬恶之心", text: "当你造成或受到伤害后，你可以消耗当前回合角色所有剩余子弹，然后摸等量的牌。" } ] },
];

// NPC 机器人:不由玩家控制、不行动、不摸牌;血量为 0 即死(无濒死)。人少时放在玩家之间隔座。
export const NPCS = {
  zhan: { key: "zhan", name: "占坑机器人", hp: 2, text: "“鉴定为NPC”" },
  jinbi: { key: "jinbi", name: "金币机器人", hp: 3, text: "杀死你的角色摸三张牌。“被打就会爆金币”" },
};

// 身份:至高之脑(主公,开局亮)/ 免疫官(忠)/ 病毒(反)/ 异变(内)
export const IDENTITIES = {
  brain: { key: "brain", name: "至高之脑", short: "脑", goal: "消灭所有病毒和异变。开局亮明身份,持有【超意识】。杀死免疫官要弃置所有牌。" },
  immune: { key: "immune", name: "免疫官", short: "免", goal: "保护至高之脑,消灭所有病毒和异变。" },
  virus: { key: "virus", name: "病毒", short: "毒", goal: "杀死至高之脑。" },
  mutant: { key: "mutant", name: "异变", short: "变", goal: "先消灭其他所有人,最后单挑杀死至高之脑;单挑时夺走脑的【超意识】。" },
};
export const ID_KEYS = ["brain", "immune", "virus", "mutant"];
// 推荐身份配置(玩家数 → [脑, 免疫官, 病毒, 异变]);说明书只给 3/5/6/7/8 人,4 人为推断(待核)。3 人另放 3 个 NPC 隔座。
export const DEFAULT_ID_COUNTS = { 3: [1, 0, 2, 0], 4: [1, 0, 2, 1], 5: [1, 1, 2, 1], 6: [1, 1, 3, 1], 7: [1, 2, 3, 1], 8: [1, 2, 4, 1] };

// 游戏牌(108 张,每张左上角带命中点数:1 点 40 / 2 点 30 / 3 点 20 / 4 点 10 / 爆头 4 / 哑火 4)
export const POINT_DISTRIBUTION = [["1", 40], ["2", 30], ["3", 20], ["4", 10], ["爆头", 4], ["哑火", 4]];
// type: basic 基本 / tactic 战术 / delay 延时战术 / equip 装备。ammo=true 使用要消耗子弹。verified=false 文本待核(见文件头)。
export const CARDS = [
  { key: "dianshe", name: "点射", type: "basic", ammo: true, text: "对一名目标发射 1 枚子弹，成功命中则造成 1 点伤害。（自己无法对自己射击）" },
  { key: "saoshe", name: "扫射", type: "basic", ammo: true, text: "对一名目标清空弹匣：依次发射你当前弹匣所有剩余子弹，此过程中你的命中判定 -2。" },
  { key: "fangun", name: "翻滚", type: "basic", text: "向前翻滚（每回合限一次）：出牌阶段使用，令你本回合使用下一张射击牌的过程中命中判定 +1。\n向后翻滚：抵消向你发射的 1 枚子弹。" },
  { key: "buding", name: "补丁", type: "basic", text: "出牌阶段对自己使用：你回复 1 点血量。有角色进入濒死状态时，可以对该角色使用，其回复 1 点血量。" },

  { key: "huaxue", name: "化血为剑", type: "tactic", text: "令一名体力值大于等于你的角色摸两张牌，然后将其 1 点血量转化为你的 1 枚子弹。" },
  { key: "lunpan", name: "轮盘赌", type: "tactic", text: "将一名其他角色的一张手牌与牌堆顶的五张牌混洗；其与你轮流翻开其中一张牌，翻出射击牌的角色受到 2 点伤害。（FAQ:有人受伤即结束;没翻出射击牌则无事发生）" },
  { key: "jingzhi", name: "静滞力场", type: "tactic", text: "其他角色对你进行命中判定时（判定牌已亮出）使用，令点数 -1，然后你摸一张牌。" },
  { key: "guiling", name: "归零斩", type: "tactic", verified: false, text: "（待核）令目标对你使用一张【点射】，否则你对其造成 1 点伤害。目标以【点射】响应时你需用【翻滚】抵消，否则进行命中判定。" },
  { key: "duoqu", name: "夺取", type: "tactic", ammo: true, verified: false, text: "（待核）令一名角色展示一张手牌并选择：交给你这张牌，或令你依次发射其子弹。你没有子弹时目标可以不给牌。" },
  { key: "boli", name: "剥离", type: "tactic", ammo: true, verified: false, text: "（待核）弃置一名其他角色的一张牌（或其面前的延时牌），然后可以消耗一颗子弹获得被弃置的牌。" },
  { key: "wuzhong", name: "无中生有", type: "tactic", ammo: true, verified: false, text: "（待核）消耗子弹摸牌。" },
  { key: "wuxie", name: "无懈可击", type: "tactic", verified: false, text: "（待核）抵消一张战术牌（含目标回合开始时引爆的延时牌）对所有角色的效果。" },

  { key: "heidong", name: "微型黑洞", type: "delay", text: "放置在你面前，你的下回合开始时引爆：所有其他角色各受到 2 点伤害。此牌被提前引爆时改为失效。所有角色对此牌命中判定 -1。" },
  { key: "shanguang", name: "致命闪光", type: "delay", text: "放置于一名角色面前，目标下个回合开始时引爆：本回合内所有角色命中判定 -999。" },
  { key: "emp", name: "EMP清道夫", type: "delay", text: "放置于一名角色面前，目标下个回合开始时引爆：目标及其相邻角色依次受到 1 点伤害。" },

  { key: "zhenli", name: "真理之眼", type: "equip", text: "若目标未使用【翻滚】抵消你的【点射】，则不进行判定直接命中。" },
  { key: "shoubi", name: "手臂拓展", type: "equip", mod: { supply: 1 }, text: "你的补给数 +1。" },
  { key: "caihong", name: "彩虹弹匣", type: "equip", mod: { ammo: 1 }, text: "你的子弹上限 +1。（FAQ:不立刻得子弹,下个摸牌阶段补至上限）" },
  { key: "wusheng", name: "无声的伪装", type: "equip", text: "当一次对你射击的命中判定失败时，你可以摸一张牌。" },
  { key: "aida", name: "挨打机器人", type: "equip", text: "其他角色优先弃置和获得此牌；此牌离开你的装备区时你摸两张牌。" },
  { key: "toukui", name: "偏折头盔", type: "equip", text: "【扫射】和判定为爆头的射击对你无效。" },
  { key: "yaokong", name: "自我遥控器", type: "equip", swap: true, text: "可以对你或对其他角色使用；你角色牌上的补给数与子弹上限互换。" },
  { key: "yasuo", name: "空气压缩炮", type: "equip", text: "你使用【点射】不消耗子弹。" },
];

export const HERO_BY_ID = Object.fromEntries(HEROES.map((h) => [h.id, h]));
export const CARD_BY_KEY = Object.fromEntries(CARDS.map((c) => [c.key, c]));
