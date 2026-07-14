// 人工修正层 —— generals.json 由 scrape-generals.mjs 自动生成,手改会被 re-scrape 覆盖。
// 这里是"人工真相"单一来源:爬虫跑完(及现在)都 applyOverrides 一遍,改动永不丢失。
//
// ┌─ 更新武将 json 决策树(遇到要加/改的将,对号入座)──────────────────────────
// │ A. 官网有、技能也对          → 不碰这里。加进 scraper roster / 直接重爬即可。
// │ B. 官网有、但技能过时或错     → SKILL_OVERRIDES[id]={skills:{技能名:"新全文"}}。只改这几技,其余照爬。
// │ C. 官网没有 / 线下 / 其他服   → OFFLINE_HEROES 整条手录:
// │    C1 纯线下(永不上OL)       → 9000+ id,永久留着(例:孙寒华 9001)。
// │    C2 官网迟早会收(新将lag)  → 也先手录(9000+ id),等官网上线【重爬】后 scrape 带来真条目,
// │                                 届时【从 OFFLINE_HEROES 删掉这条】让 scrape 接管(真 id+立绘)。
// │                                 applyOverrides 末尾有重名告警:库里出现两个同名 = 该删了。
// └──────────────────────────────────────────────────────────────────────
// 维护:每条注明来源/原因;OFFLINE_HEROES 用 9000+ id 段,与 OL(≤7020)隔离。

export const SKILL_OVERRIDES = {
  // 曹纯(标·魏) 缮甲 —— 线下版全文。OCR 清理已经用户确认:开头"主"是多打字(已删)、"弃置过版啤"→"弃置过牌"
  426: { note: "曹纯 缮甲 线下版(OCR 清理已确认:去'主'、'版啤'→'牌')", skills: {
    "缮甲": "游戏开始时，你获得3个“损”。你失去一张装备牌后，你移去1个“损”。出牌阶段限一次，你可以摸三张牌，并可以使用一张【杀】。然后你此阶段使用的下X张手牌时，你弃置一张牌（X为“损”数）。若如此做，此阶段结束时，若你此阶段未因“缮甲”弃置过牌或仅弃置过装备牌，你可视为使用一张无距离限制的【杀】。",
  } },
  // 鲍三娘(标·蜀) 许身 —— 官方wiki过时,线下版无"回复体力至1点"结尾
  351: { note: "鲍三娘 许身 官方wiki过时", skills: {
    "许身": "限定技，当你进入濒死状态时，你可令一名其他角色选择一项：1.其失去所有技能获得“征南”；2.其获得“镇南”。",
  } },
  // 神张角 异兆/肆军/天劫 —— 线下版(比线上更对线下友好)
  227: { note: "神张角 三技 线下版(与线上描述不同)", skills: {
    "异兆": "锁定技，当你使用或打出牌结算结束后，你获得等同于此牌点数的“黄”，然后若“黄”标记数的十位数以此法改变，你摸一张牌。",
    "肆军": "准备阶段，若“黄”标记数大于牌堆的牌数，你可以弃置所有“黄”，亮出牌堆顶的一张牌并重复此流程直到以此法亮出的牌点数之和不小于36，然后你获得以此法亮出的所有牌。",
    "天劫": "每个回合结束时，若本回合牌堆切洗过，你可以选择至多三名其他角色，然后你依次展示这些角色的手牌并对其造成X点雷电伤害（X为你展示其手牌中【闪】的数量且至少为1）。",
  } },
  // 界郭皇后(界·魏) 矫诏 —— OL 原文只有基础一句、太模糊;补全"殚心"两级修改(用户提供清晰文本)
  726: { note: "界郭皇后 矫诏 补全三级(基础+殚心修改1/2)", skills: {
    "矫诏": "出牌阶段限一次，你可将一张牌当本轮未有角色使用过的基本或普通锦囊牌使用。（经“殚心”依次修改——修改1：每轮限一次，你可将一张牌当一张基本或普通锦囊牌使用；修改2：每轮限一次，你视为使用一张基本或普通锦囊牌。）",
  } },
};

// 技能顺序修正:OL 爬到的顺序若与线下改版不一致,在此强制。顺序对"前X个技能"类技能(如张华穿屋)有机制意义。
// 键=id,值=技能名数组(全序);applyOverrides 按此重排 h.skills,不在数组里的技能保持相对靠后。
export const SKILL_ORDER = {
  // 张华(改版·晋) —— 官方改版把技能顺序调为 弼昏/剑合/穿屋(削弱手段=调换技能顺序:穿屋"失去武将牌上前X个技能"因此覆盖到剑合而非初版顺序)。
  544: ["弼昏", "剑合", "穿屋"],
};

// 技能英文层(英文版房间用):键=id,值={技能名:英文全文};applyOverrides 写入 s.effect_en。
// 缺失即回退中文(room.html 按 LANG 取 effect_en||effect)。存覆盖层→重爬不丢,单一真相。
// 语言绑定技(如张芝洗墨"改自己描述文字")用功能/复刻式英文,须懂机制的人核对。术语见对话术语表。
export const SKILL_EN = {
  516: { // 张芝
    "笔心": `During each character's own Preparation phase and End phase, you may declare a card type and draw 3 cards (each type only once). Then use all hand cards of that type as one kind of basic card that you have not used this round.`,
    "洗墨": `Compulsory Skill. After you use 【笔心】, remove the first three words after "During" in its description. (On the third use, remove the entire phrase "During End phase," instead — so 【笔心】 becomes usable at any time.) On the third use, also swap the two numbers in its description; then lose this skill and gain 【飞白】.`,
  },
  524: { // 族荀采
    "蹈节": `Clan Skill, Compulsory Skill. The first time each turn you use a non-damage trick card, lose 1 HP or one of your Compulsory Skills; then a same-clan character gains that card.`,
    "烈誓": `During your Play phase, you may choose one: 1. disable your judgement zone and take 1 fire damage from you; 2. discard all your 【闪】(Dodge); 3. discard all your 【杀】(Slash). Then choose a character who must carry out one of the other two options.`,
    "点盏": `Compulsory Skill. The first time each round you use a card of a given suit, the sole target of that card becomes chained, and you recast all your hand cards of that suit. If you do both, draw a card.`,
    "还阴": `Compulsory Skill. When you enter the dying state, draw cards until you have 4 hand cards.`,
  },
  544: { // 张华
    "弼昏": `Compulsory Skill. When you use a card that targets another character, if your hand size exceeds your hand limit, cancel that use, and the sole target gains that card.`,
    "剑合": `During your Play phase, once per character: you may recast at least two cards of the same name, or equipment cards; then choose a character who must pick one: 1. recast an equal number of cards of the same type; 2. take 1 thunder damage from you.`,
    "穿屋": `Compulsory Skill. After you deal or take damage, you lose the first X skills on your character card until the end of the turn (X = your attack range), then draw cards equal to the number of skills lost.`,
  },
  635: { // 谋庞统
    "鸿图": `At the end of each phase, if you gained at least two cards during that phase, you may draw 3 cards, then reveal 3 hand cards: one other character chooses one of them to use, and one of the remaining two is discarded at random. By the used card's rank among the three — highest: they gain 【飞军】 until the end of their next turn; neither highest nor lowest: they gain 【潜袭】 until the end of their next turn; lowest: their hand limit +2 until the end of their next turn. If they do not use a card this way, you deal 1 fire damage to both them and yourself.`,
    "栖梧": `The first time each turn you take damage, if the damage source is within your attack range, you may discard a red card to prevent that damage.`,
  },
};

export const OFFLINE_HEROES = [
  // 孙寒华 —— 三国杀移动版武将线下化,OL 无。faction/hp 已确认(吴/3血)。
  // TODO(原画):用户后补图片文件(建议 prototype/client/assets/sunhanhua.jpg)或 URL 后,把下面 avatar/cover 接上;线下武将无 OL 图床,可能要给 worker 加静态图路由。
  {
    id: 9001, name: "孙寒华", genre: "线下", series: "线下", faction: "吴",
    factionSelectable: false, quality: "线下", hp: 3, initialHp: null,
    tags: ["控制", "过牌"],
    skills: [
      { name: "冲虚", effect: "出牌阶段限一次，你可以展示牌堆顶的三张牌，然后获得其中一张，若此牌为黑色，则本回合你修改“妙剑”；红色，直到你下回合开始前，你修改“莲华”。" },
      { name: "妙剑", effect: "出牌阶段限一次，你可以将一张基本牌当刺【杀】使用，或将一张非基本牌当【无中生有】使用（若你修改“妙剑”，改为你可以视为使用一张刺【杀】或【无中生有】）。" },
      { name: "莲华", effect: "当你成为【杀】的目标时，你摸一张牌，然后若你修改“莲华”，使用者需弃置一张牌，否则此【杀】对你无效。" },
    ],
    characteristic: "移动版武将线下化。",
    // 原画在仓库 assets/heroes/(GitHub Pages 托管);room 页跨源加载无 CSP 问题。一图两用(缩略图34px/技能弹层60px,均 object-fit:cover)
    cover: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sunhanhua.jpg",
    avatar: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sunhanhua.jpg",
    tool: null, offline: true,
  },
  // 谋贾诩 —— OL 新将(官网未收录,先手录)。⚠ 临时:官网上线重爬后应从这里删掉,让 scrape 接管(会有真 id + 立绘)
  {
    id: 9002, name: "谋贾诩", genre: "谋", series: "谋", faction: "群",
    factionSelectable: false, quality: "传说", hp: 3, initialHp: null,
    tags: ["控制", "过牌", "加伤"],
    skills: [
      { name: "乱朝", effect: "限定技，每轮开始时，你可令所有角色依次选择从牌堆获得一张【杀】或【闪】。获得【杀】的角色本轮首次造成的伤害+1。" },
      { name: "完策", effect: "出牌阶段限一次，你可指定一名角色并声明一张指定唯一目标的普通锦囊牌，然后其依次将X张手牌当此牌使用（X为游戏轮数且至多为3）。其以此法指定目标时，你可弃置一张牌并更改目标。" },
      { name: "沉智", effect: "你每轮受到第X次以后的伤害时，你弃置一张牌防止之（X为游戏轮数且至多为3）。每轮结束时，若你本轮未发动此技能，则你可复原一名角色的一个限定技（每局游戏限一次）。" },
    ],
    characteristic: "有威力巨大的限定技，可以转化单目标锦囊牌，防御伤害可以刷新限定技。",
    cover: "https://initial-jie.github.io/sgs-wiki/assets/heroes/moujiaxu.jpg",
    avatar: "https://initial-jie.github.io/sgs-wiki/assets/heroes/moujiaxu.jpg",
    tool: null, offline: true,
  },
  // 裴秀 —— OL 新将(官网未收录,先手录)。地图机制,后续要开工具(暂缓,需完整机制)。⚠ 同样:官网上线后从这里删,让 scrape 接管
  {
    id: 9003, name: "裴秀", genre: "其他", series: "标", faction: "魏",
    factionSelectable: false, quality: "限定", hp: 4, initialHp: null,
    tags: ["进攻", "防御", "过牌"],
    skills: [
      { name: "茂著", effect: "锁定技，回合开始时，或你绘制了一幅“地图”的所有城市，你将手牌中的花色补至4，并展开一幅“地图”。回合结束时，你获得一个本回合已展开的“地图”技能，直到你下回合结束。" },
      { name: "尽览", effect: "当你于回合内使用♠/♥/♣/♦牌后，你可以绘制东/西/南/北方位的所有“地图”。你绘制一处城市后，执行对应城市的效果。" },
      { name: "采风", effect: "出牌阶段每幅地图限一次，你可以弃置任意张牌，然后从牌堆或弃牌堆中随机获得等量张其余花色的牌。" },
    ],
    characteristic: "可以在牌局中绘制地图赚取收益。",
    cover: "https://initial-jie.github.io/sgs-wiki/assets/heroes/peixiu.jpg",
    avatar: "https://initial-jie.github.io/sgs-wiki/assets/heroes/peixiu.jpg",
    tool: null, offline: true,
  },
  // SP徐氏 —— 线下/同人卡(吴,WU064,江魂龙谶),带专属工具 xushi。
  // ⚠ 命名:OL 已有「徐氏」(id390,问卦/伏诛),故线下版叫「SP徐氏」区分(SP前缀,搜"徐氏"仍命中),否则重名告警+选将歧义。
  {
    id: 9004, name: "SP徐氏", genre: "线下", series: "线下", faction: "吴",
    factionSelectable: false, quality: "线下", hp: 3, initialHp: null,
    tags: ["爆发", "恢复"],
    skills: [
      { name: "龙谶", effect: "出牌阶段限一次，你可以选择一项：1.对一名角色造成1点雷电伤害；2.令一名角色摸一张牌并回复1点体力。执行前你投掷龙鳞贝问询神明：〖圣贝〗一阴一阳，执行两次所选效果；〖阳贝〗双阳，执行所选效果并获得1枚“龙怒”；〖阴贝〗双阴，不执行所选效果并获得2枚“龙怒”。" },
      { name: "天泣", effect: "觉醒技，准备阶段若“龙怒”达到3枚，或当你处于濒死状态时，你减1点体力上限并回复体力至上限，然后你获得“守心”，并对所有男性角色各造成1点雷电伤害。" },
      { name: "守心", effect: "当你造成属性伤害后，你摸一张牌。当你成为其他角色使用牌的目标时，你可以移去1枚“龙怒”并取消之。" },
    ],
    characteristic: "投龙鳞贝定阴阳、攒龙怒觉醒天泣。",
    cover: "https://initial-jie.github.io/sgs-wiki/assets/heroes/xianxia-xushi.jpg",
    avatar: "https://initial-jie.github.io/sgs-wiki/assets/heroes/xianxia-xushi.jpg",
    tool: "xushi", offline: true,
  },
  // 留赞 —— 三国杀移动版(sanguosha.cn/hero-detail-93),OL 无此将故不加前缀。⚠ hp 页面未暴露,按 4 血录入待确认
  {
    id: 9005, name: "留赞", genre: "移动版", series: "移动版", faction: "吴",
    factionSelectable: false, quality: null, hp: 4, initialHp: null,
    tags: ["过牌"],
    skills: [
      { name: "奋音", effect: "你的回合内，每当你使用了一张与上一张颜色不同的牌时，你摸一张牌。" },
    ],
    characteristic: "使用颜色不同的牌可以摸牌。",
    cover: null, avatar: null, tool: null, offline: true,
  },
  // 移动版谋韩当 —— 三国杀移动版(sanguosha.cn/hero-detail-589)。OL 有韩当/界韩当,故加「移动版」前缀区分。⚠ hp 按 4 血录入待确认
  {
    id: 9006, name: "移动版谋韩当", genre: "移动版", series: "移动版", faction: "吴",
    factionSelectable: false, quality: null, hp: 4, initialHp: null,
    tags: ["进攻", "控制", "爆发"],
    skills: [
      { name: "弓骑", effect: "你的攻击范围+4。出牌阶段开始时，你可弃一张牌，若如此做，则此阶段你使用的牌其他角色只能使用或打出虚拟牌或与你弃置牌颜色相同的手牌响应。" },
      { name: "解烦", effect: "出牌阶段限一次，你可指定一名角色，令其选择一项：1.攻击范围内含有其的角色依次弃一张牌；2.其摸此时攻击范围内有其的角色数的牌；背水：此技能失效直至你杀死一名角色。" },
    ],
    characteristic: "可弃牌来让牌指定颜色方可响应，可以背水爆发摸牌并令其他人弃牌。",
    cover: null, avatar: null, tool: null, offline: true,
  },
  // 司马炎 —— 线下/OL未收录(用户提供文本+插画 assets/heroes/simayan.jpg)。晋主公,3血(用户 2026-07-13 确认)。
  {
    id: 9007, name: "司马炎", genre: "其他", series: "标", faction: "晋",
    factionSelectable: false, quality: null, hp: 3, initialHp: null,
    tags: ["过牌", "爆发", "控制"],
    skills: [
      { name: "举棋", effect: "转换技，阳：准备阶段，你摸三张牌/其他角色的准备阶段，其可以展示并交给你一张黑色手牌；阴：准备阶段，你本回合使用牌无次数限制且伤害+1/其他角色的准备阶段，其可以展示并交给你一张红色手牌。" },
      { name: "封土", effect: "当一名其他角色死亡后，你可以令一名未以此法减少过体力上限的角色减1点体力上限，然后其获得死亡角色位置每轮的额定回合。" },
      { name: "泰始", effect: "主公技，限定技，一名角色的回合开始前，你可以令所有隐匿角色依次登场。" },
    ],
    characteristic: "转换技举棋阴阳收牌/强化，封土削体力上限抢额定回合，泰始令隐匿角色登场。",
    cover: "https://initial-jie.github.io/sgs-wiki/assets/heroes/simayan.jpg",
    avatar: "https://initial-jie.github.io/sgs-wiki/assets/heroes/simayan.jpg",
    tool: null, offline: true,
  },
  // 神黄月英 —— 纯线下武将,OL 无此将(用户 2026-07-13 确认),永久保留(不 graduate)。繁体文本→已转简体+插画 assets/heroes/shenhuangyueying.jpg。衍生牌见 derived-cards-room.json。hp 3血(用户 2026-07-13 确认)。
  {
    id: 9008, name: "神黄月英", genre: "神将", series: "神", faction: "蜀",
    factionSelectable: false, quality: null, hp: 3, initialHp: null,
    tags: ["过牌", "装备", "控制"],
    skills: [
      { name: "藏巧", effect: "每轮开始时，你可以获得游戏外或弃牌堆中的【折戟】、【女装】、【驽马】各至多一张；当你使用上述牌时，你可以将手牌摸至体力上限。" },
      { name: "神机", effect: "每回合限一次，以你为唯一目标的黑色牌结算结束后，你可以将场上一张装备牌当未以此法使用过的延时锦囊牌使用（均使用过后重置）；此类锦囊牌在判定区内同时拥有被转化的装备牌的效果。" },
      { name: "化朽", effect: "出牌阶段限一次，你可以将一种“藏巧”装备牌效果修改为下述对应顺序的牌直到你的下回合开始：【魂·诸葛连弩】；【魂·八卦阵】；【軨軨】。" },
    ],
    characteristic: "藏巧取折戟/女装/驽马三神装并摸至上限，神机把装备当延时锦囊，化朽升级为魂装。",
    cover: "https://initial-jie.github.io/sgs-wiki/assets/heroes/shenhuangyueying.jpg",
    avatar: "https://initial-jie.github.io/sgs-wiki/assets/heroes/shenhuangyueying.jpg",
    tool: null, offline: true,
  },
];

// 就地修改并返回 list。幂等:同 id 的线下武将已存在则整条替换。warn 收集未命中的技能名。
export function applyOverrides(list, warn = (m) => console.warn(m)) {
  let skillHits = 0, added = 0, reordered = 0, enHits = 0;
  for (const h of list) {
    const ov = SKILL_OVERRIDES[h.id];
    if (!ov) continue;
    for (const [sn, eff] of Object.entries(ov.skills || {})) {
      const s = (h.skills || []).find((x) => x.name === sn);
      if (s) { s.effect = eff; skillHits++; }
      else warn(`[overrides] id${h.id}「${h.name}」无技能「${sn}」,跳过(名字变了?)`);
    }
  }
  // 技能英文层:写入 s.effect_en(缺失回退中文,由前端按语言取)
  for (const h of list) {
    const en = SKILL_EN[h.id];
    if (!en) continue;
    for (const [sn, eff] of Object.entries(en)) {
      const s = (h.skills || []).find((x) => x.name === sn);
      if (s) { s.effect_en = eff; enHits++; }
      else warn(`[overrides] id${h.id}「${h.name}」EN 无技能「${sn}」,跳过(名字变了?)`);
    }
  }
  // 技能顺序修正(如张华改版):按 SKILL_ORDER 排序;数组里没列到的技能保持相对靠后
  for (const h of list) {
    const ord = SKILL_ORDER[h.id];
    if (!ord || !Array.isArray(h.skills)) continue;
    const missing = ord.filter((n) => !h.skills.some((s) => s.name === n));
    if (missing.length) warn(`[overrides] id${h.id}「${h.name}」SKILL_ORDER 含不存在的技能「${missing.join("/")}」(名字变了?)`);
    h.skills.sort((a, b) => {
      const ia = ord.indexOf(a.name), ib = ord.indexOf(b.name);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    });
    reordered++;
  }
  for (const oh of OFFLINE_HEROES) {
    const i = list.findIndex((h) => h.id === oh.id);
    const clone = JSON.parse(JSON.stringify(oh));
    if (i >= 0) list[i] = clone; else { list.push(clone); added++; }
  }
  // 安全网:重名 = 某个"临时手录"的将已 graduate 到 OL(scrape 也有了),提醒从 OFFLINE_HEROES 删掉,否则库里两条
  const seen = {};
  for (const h of list) seen[h.name] = (seen[h.name] || 0) + 1;
  for (const [nm, c] of Object.entries(seen))
    if (c > 1) warn(`[overrides] ⚠ 重名 ${c}×「${nm}」—— 可能官网已收录该将,应从 OFFLINE_HEROES 删除临时条目`);
  return { list, skillHits, added, reordered, enHits };
}
