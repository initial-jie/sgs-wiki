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
  426: { note: "曹纯 缮甲 房间=OL 最新版(OL 官网 wiki 落后);实体卡与房间一致→无需 cardWarn(用户 2026-07-18 确认)", skills: {
    "缮甲": "游戏开始时，你获得3个“损”。你失去一张装备牌后，你移去1个“损”。出牌阶段限一次，你可以摸三张牌，并可以使用一张【杀】。然后你此阶段使用的下X张手牌时，你弃置一张牌（X为“损”数）。若如此做，此阶段结束时，若你此阶段未因“缮甲”弃置过牌或仅弃置过装备牌，你可视为使用一张无距离限制的【杀】。",
  } },
  // 鲍三娘(标·蜀) 许身 —— 官方wiki过时,线下版无"回复体力至1点"结尾
  351: { note: "鲍三娘 许身 房间=OL 最新版(官网 wiki 过时);实体卡略有出入→标记以房间为准(用户 2026-07-18)", cardWarn: "许身 房间已是 OL 最新版,你的实体卡略有出入——以本房间描述为准", skills: {
    "许身": "限定技，当你进入濒死状态时，你可令一名其他角色选择一项：1.其失去所有技能获得“征南”；2.其获得“镇南”。",
  } },
  // 神张角 异兆/肆军/天劫 —— 线下版(比线上更对线下友好)
  // 谢灵毓(2026-10-16 graduate 9023→769):官网「元嫡」文本里牌名图标组是 {0} 占位,按用户对卡订正为【杀】【闪】【桃】(无【酒】)
  769: { note: "谢灵毓 元嫡 {0} 占位 → 【杀】【闪】【桃】", skills: {
    "元嫡": "锁定技，当每回合首次有【杀】【闪】【桃】为一组的牌名均进入过弃牌堆后，你摸一张牌。若其中有牌不因使用进入弃牌堆，且剩余牌名大于一，你移除一个牌名。",
  } },
  // 谋黄月英(622)理贤:官网文本里 {0}{1} 是 OL 客户端的动态占位({0}=并才添加完牌名后补进来的「准备阶段/结束阶段」时机,{1}=并才添加的牌名列表「或【顺手牵羊】…」),
  // 实体卡面没有这两个占位 → 去掉;动态部分见并才与房间工具(2026-10-18 用户问「{0}{1} 是什么」)
  622: { note: "谋黄月英 理贤 去 OL 动态占位 {0}{1}", skills: {
    "理贤": "当你受到伤害后，你可将一张牌当【无中生有】使用。当你以此法使用过三种不同牌名的锦囊牌后，此技能于你的结束阶段也可发动。（并才为理贤添加的牌名也可当作使用；添加完后准备阶段也可发动）",
  } },
  // 薛灵芸(653)思泣:官网「至多{0}张」是 OL 动态数字占位,olwiki 同样是 {0};实体卡上的数字待用户核对(2026-10-18 先写 X)
  653: { note: "薛灵芸 思泣 {0} → X(待对卡)", cardWarn: "思泣「至多 X 张」的 X 在 OL 文本里是动态数字,请以实体卡为准(核对后告诉我改回具体数)", skills: {
    "思泣": "你的红色牌进入弃牌堆时，将之置于牌堆底。当你受到伤害后，你可以亮出牌堆底至多X张连续的红色牌，使用其中的【桃】、【无中生有】与装备牌（可指定其他角色为目标），然后摸等同于其中无法使用的牌数的牌。",
  } },
  // 秦朗(639):官网详情页只有占位「技能:(空)」,技能从 olwiki 抄(2026-10-18,用户报「秦朗没有技能描述」);skillsReplace 整组替换,重爬不丢
  639: { note: "秦朗 贤膺 官网空占位 → olwiki 文本", skillsReplace: [
    { name: "贤膺", effect: "准备阶段或当你受到伤害后，你可以摸两张牌并弃置任意张牌（不能是本轮以此法弃置过的张数），若弃置牌同名，你可以于本回合结束时视为使用之。" },
  ] },
  // SP赵云 本桌测试版(用户 2026-10-18,后续可能改回):体力上限 3→4;「冲阵」改为 龙胆使用/打出时 二选一(获得手牌 / 造成 1 点伤害)+ 令其失去最后手牌或濒死则摸两张
  108: { note: "SP赵云 测试版:上限 4;冲阵改写", hp: 4, cardWarn: "本桌测试版:体力上限 3→4;〖冲阵〗改为可二选一(获得手牌 / 造成 1 点伤害)并有摸两张的奖励。以本房间描述为准,后续可能改回", skills: {
    "冲阵": "每当你发动“龙胆”使用或打出一张手牌时，你可以立即获得对方的一张手牌或对对方造成1点伤害。若其因此失去最后一张手牌或进入濒死状态，你摸两张牌。（测试版：原为 当你发动“龙胆”时，你可以获得对方的一张手牌；体力上限原为3）",
  } },
  // 族荀淑「八龙」本桌测试版房规(用户 2026-10-17):摸至「与存活角色数相同」改为固定摸至 8 张。后续可能改回 —— 改回=删掉这一条再 rebake
  522: { note: "族荀淑 八龙 测试版房规:摸至存活角色数 → 固定摸至 8 张", cardWarn: "八龙 本桌测试版房规:摸至固定 8 张(原版为摸至与存活角色数相同)。以本房间描述为准,后续可能改回", skills: {
    "八龙": "锁定技，当你每回合体力值首次变化后，若你手牌中锦囊牌为唯一最多的类型，你展示手牌并摸至8张。（测试版：原为摸至与存活角色数相同）",
  } },
  227: { note: "神张角 三技 线下版;房间 app 已改成线下技能=实体卡,一致→无需 cardWarn(用户 2026-07-18 确认)", skills: {
    "异兆": "锁定技，当你使用或打出牌结算结束后，你获得等同于此牌点数的“黄”，然后若“黄”标记数的十位数以此法改变，你摸一张牌。",
    "肆军": "准备阶段，若“黄”标记数大于牌堆的牌数，你可以弃置所有“黄”，亮出牌堆顶的一张牌并重复此流程直到以此法亮出的牌点数之和不小于36，然后你获得以此法亮出的所有牌。",
    "天劫": "每个回合结束时，若本回合牌堆切洗过，你可以选择至多三名其他角色，然后你依次展示这些角色的手牌并对其造成X点雷电伤害（X为你展示其手牌中【闪】的数量且至少为1）。",
  } },
  // 界郭皇后(界·魏) 矫诏 —— OL 原文只有基础一句、太模糊;补全"殚心"两级修改(用户提供清晰文本)
  726: { note: "界郭皇后 矫诏 补全三级(基础+殚心修改1/2)", cardWarn: "矫诏 已把 OL 过简原文补全「殚心」两级说明——以本房间(OL现状)描述为准", skills: {
    "矫诏": "出牌阶段限一次，你可将一张牌当本轮未有角色使用过的基本或普通锦囊牌使用。（经“殚心”依次修改——修改1：每轮限一次，你可将一张牌当一张基本或普通锦囊牌使用；修改2：每轮限一次，你视为使用一张基本或普通锦囊牌。）",
  } },
  // 曹婴(标·魏) 凌人/伏间 —— OL 2026 增强版(用户提供;线上强化,凌人限次改"每回合"、伏间改"准备+结束阶段"且限"非全场唯一最多")
  353: { note: "曹婴 凌人/伏间 OL 增强版(2026,线上强化)", cardWarn: "OL 2026 增强版——以本房间描述(OL 现状)为准,而非你手上可能过时的实体卡", skills: {
    "凌人": "每回合限一次，当你使用【杀】或伤害锦囊牌时，你可以猜测其中一个目标的手牌中是否有基本牌、锦囊牌或装备牌，若至少猜对：1项，本回合你下次对其造成的伤害+1；2项，此牌不计入次数，你摸两张牌；3项，你获得“奸雄”“行殇”直到你下回合开始。",
    "伏间": "锁定技，准备阶段和结束阶段，你随机观看手牌数不是全场唯一最多的一名其他角色的手牌。",
  } },
  // 族王明山(族·魏) 弹雀/剩墨 —— OL 线上已改版,库里旧文本对不上(用户 2026-08-21 游戏内截图)。弹雀加"或手牌数";剩墨整条重写(每轮限一次+需要使用基本牌时触发+点数不可重复)。中流与线上一致未动。
  608: { note: "族王明山 弹雀/剩墨 OL 线上改版(2026-08,用户截图)", cardWarn: "弹雀/剩墨 已更新为 OL 线上现行版——以本房间描述为准,你手上的实体卡可能是旧版", skills: {
    "弹雀": "每回合限一次，当你使用牌后，你可以对一名体力值或手牌数为X的角色造成1点伤害（X为此牌点数与你上一张使用的牌的点数之差且不为0）。",
    "剩墨": "每轮限一次，当你需要使用基本牌时，你可以获得本回合弃牌堆中的一张牌（不能是以此法选择过的点数）。若此牌点数不为最大或最小，你视为使用未以此法使用过的基本牌。",
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
    "笔心": `During each character's own Preparation phase and End phase, you may declare a card type and draw 3 card(s) (each type may only be declared 1 time(s)). Then, use all hand cards of that type as one kind of basic card that you have not used this round.`,
    "洗墨": `Mandatory Skill. After you use 【笔心】, remove the first three words after "During" in its description. On the third use, remove the entire phrase "During End phase," instead, i.e. 【笔心】 becomes usable at any time, and additionally swap the two numbers in its description. Then, lose this skill and gain 【飞白】.`,
  },
  517: { // 文鸯
    "膂力": `Once per turn, after you deal damage, you may choose to either draw cards until your hand size is equal to your current health, or recover health until it equals the number of cards in your hand.`,
    "仇决": `Awakening Skill. Every time a turn ends, if the difference between your HP and hand size is no less than 3: lose 1 max HP, obtain “背水”, and increase the activation limit of “膂力” to twice during your own turn.`
  },
  518: { // 周处
    "善断": `Mandatory Skill. When your Draw/Play/Discard phase begins, you may freely allocate 1, 2, 3, and 4 as the default values for number of cards drawn/attack range/【杀】(Slash) use limit/max hand size. When you take damage outside your turn, +1 to the smallest number you can allocate next turn.`,
    "义烈": `You may use two cards of the same color as a basic card of a different name that you have already used this turn.`
  },
  519: { // 夏侯玄
    "宦浮": `When you target someone with 【杀】(Slash) or become the target of 【杀】, you may discard any number of cards (up to your max HP). Once 【杀】 resolves, if the total damage dealt is equal to the number of cards discarded, then draw twice the number of cards.`,
    "清议": `Once during each of your Play phases, you may select up to two other characters with hand cards to discard a card with you at the same time. If the card type is the same, then you may repeat the process. During your End phase, you may obtain one card of each color from the discarded cards.`,
    "迮阅": `One-Time Skill. During your Preparation phase, you may select another character that has dealt damage to you since your last turn (if this is your first turn, then after the game began) and remove one of the skills on their character card (excluding Mandatory, Awakening, and One-Time Skills). At the start of each round, that character is considered as using X number of 【杀】(Slash) against you (where X is the number of rounds since they lost their skill). If this 【杀】 deals damage, then they recover the skill they lost from this ability.`
  },
  520: { // 马日磾
    "秉节": `When your Play phase begins, you may choose to lose 1 max HP. If you do so, then during your turn, after you select the target(s) of 【杀】(Slash) or basic trick cards, all target characters excluding yourself must each discard one card.`,
    "正订": `Mandatory Skill. When you use or play a card in response to another character's card outside of your turn, if both cards share the same color, then increase your max HP by 1.`,
  },
  521: { // 阎柔
    "仇讨": `When you target someone with 【杀】(Slash) or become the target of 【杀】, you may discard a card from the user to cause this 【杀】 to be unblockable. If you are the user, then this 【杀】 does not count towards your play limit this turn.`,
    "襄戍": `Mandatory Skill. During your End phase, select a character who has less than their max HP to recover X HP and draw X cards (where X is the amount of damage you dealt this turn, up to 5).`
  },
  522: { // 族荀淑
    "蹈节": `Clan Skill, Mandatory Skill. The first time you use a non-attacking trick card each turn, lose 1 HP or one of your Mandatory Skills. Then, select a character from the same clan to gain that card.`,
    "神君": `When a character uses 【杀】(Slash) or a normal trick card, you may reveal all your hand cards of the same name and record them as “神君”. When the current phase ends, you may use X number of cards as any “神君” card (where X is the number of “神君” cards).`,
    "八龙": `Mandatory Skill. The first time your HP changes each turn, if the number of trick cards in your hand is strictly greater than all other card types, then reveal your hand and draw until you have 8 cards. (Test version - originally it was draw up to the number of surviving characters)`
  },
  523: { // 族荀谌
    "蹈节": `Clan Skill, Mandatory Skill. The first time you use a non-attacking trick card each turn, lose 1 HP or one of your Mandatory Skills. Then, select a character from the same clan to gain that card.`,
    "三恇": `Mandatory Skill. The first time you use a card of a unique type each round, select another character to give you at least X cards, then obtain the card you used (where X is the number of the following conditions that character satisfies: 1. has cards on the table; 2. has less than their max HP; 3. has less HP than the number of cards in their hand)`,
    "卑势": `Mandatory Skill. The first time each character affected by “三恇” loses all their hand cards, you recover 1 HP.`
  },
  524: { // 族荀采
    "蹈节": `Clan Skill, Mandatory Skill. The first time you use a non-attacking trick card each turn, lose 1 HP or one of your Mandatory Skills. Then, select a character from the same clan to gain that card.`,
    "烈誓": `During your Play phase, you may choose one of the following effects: 1. disable your judgement zone and take 1 fire damage from you; 2. discard all your 【闪】(Dodge); 3. discard all your 【杀】(Slash). Then, select a character who must carry out one of the other two options.`,
    "点盏": `Mandatory Skill. The first time you use a card of a unique suit each round, the sole target of that card becomes chained, and you recast all your hand cards of that suit. If both of the above take effect, draw a card.`,
    "还阴": `Mandatory Skill. When you enter the dying state, draw until you have 4 hand cards.`,
  },
  544: { // 张华
    "弼昏": `Mandatory Skill. When you use a card that targets another character, if your hand size exceeds your hand limit, cancel that use, and the sole target gains that card instead.`,
    "剑合": `During your Play phase, once per character: you may recast at least two cards of the same name, or at least two equipment cards; then, select a character who must choose one of the following: 1. recast an equal number of cards of the same type; 2. take 1 thunder damage from you.`,
    "穿屋": `Mandatory Skill. After you deal or take damage, you lose the first X skills on your character card until the end of the turn (where X = your attack range), then draw cards equal to the number of skills lost.`,
  },
  635: { // 谋庞统
    "鸿图": `At the end of each phase, if you gained at least two cards during that phase, you may draw 3 cards, then reveal 3 hand cards. Select another character to pick one of them to use, then discard one of the remaining two cards at random. If the rank of the used card among the three is the highest: they gain 【飞军】 until the end of their next turn; neither highest nor lowest: they gain 【潜袭】 until the end of their next turn; lowest: their hand limit +2 until the end of their next turn. If they do not use a card this way, you deal 1 fire damage to both them and yourself.`,
    "栖梧": `The first time you take damage each turn, if the damage source is within your attack range, you may discard a red card to prevent that instance of damage.`,
  },
};

export const OFFLINE_HEROES = [
  // 线下孙寒华 —— 三国杀移动版武将线下化。2026-10-17 改名加「线下」前缀:OL 自己出了孙寒华(olwiki 774,手录为 9027),两者是不同武将但同名可替换(heroBaseName 剥「线下」)。faction/hp 已确认(吴/3血)。
  // TODO(原画):用户后补图片文件(建议 prototype/sgs/client/assets/sunhanhua.jpg)或 URL 后,把下面 avatar/cover 接上;线下武将无 OL 图床,可能要给 worker 加静态图路由。
  {
    id: 9001, name: "线下孙寒华", genre: "线下", series: "线下", faction: "吴",
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
  // 界关平 —— 已上 OL(olwiki id 766,界一将)但官方 scrape 名册暂未含,先手录。技能取自 olwiki;图用官方图床 code=76600。蜀/4血(同基础关平 177)。⚠ 官网重爬收录后 graduate 删此条。
  {
    id: 9009, name: "界关平", genre: "界一将", series: "界", faction: "蜀",
    factionSelectable: false, quality: null, hp: 4, initialHp: null,
    tags: ["辅助", "进攻"],
    skills: [
      { name: "龙吟", effect: "当一名角色于其出牌阶段内使用【杀】时，你可以弃置一张牌，令此【杀】不计入此阶段使用次数，若此【杀】为红色，你摸一张牌。" },
      { name: "竭勇", effect: "你可将手牌中最后一张红色牌当【杀】使用或打出。" },
    ],
    characteristic: "龙吟帮全场刷【杀】次数并借红杀过牌，竭勇把最后一张红牌转【杀】。",
    cover: "https://web.sanguosha.com/220/h5_2/res/runtime/pc/activity/shequshow/xingxiang/76600.png",
    avatar: "https://web.sanguosha.com/220/h5_2/res/runtime/pc/activity/shequshow/dianjiang/76600.png",
    tool: null, offline: true,
  },
  // 神貂蝉 —— 纯线下武将(OL 无、olwiki 768 将也无,2026-08-22 查证)。用户提供技能文本。
  // 体力 3 = 用户 2026-08-22 确认。立绘走仓库 assets/heroes/(线下将无官方图床)。
  {
    id: 9016, name: "神貂蝉", genre: "神将", series: "神", faction: "神",
    factionSelectable: true, quality: "线下", hp: 3, initialHp: null,
    tags: ["控制", "爆发"],
    skills: [
      { name: "魅魂", effect: "结束阶段或当你成为【杀】的目标后，你可以令一名其他角色交给你一张你声明花色的牌，若其没有则你观看其手牌然后弃置其中一张。" },
      { name: "惑心", effect: "出牌阶段限一次，你可以展示两张花色相同的手牌并分别交给两名其他角色，然后令这两名角色拼点，没赢的角色获得一个“魅惑”标记。拥有2个或更多“魅惑”的角色回合即将开始时，该角色移去所有“魅惑”，此回合改为由你操控。" },
    ],
    characteristic: "线下武将。魅魂声明花色索牌、惑心叠“魅惑”标记夺取他人回合操控权。",
    cover: "https://initial-jie.github.io/sgs-wiki/assets/heroes/shendiaochan.jpg",
    avatar: "https://initial-jie.github.io/sgs-wiki/assets/heroes/shendiaochan.jpg",
    tool: null, offline: true,
  },
  // 梦貂蝉 —— 纯线下武将(OL/olwiki 均无)。用户提供技能文本。「梦」为线下系列前缀。
  // 体力 3 / 势力蜀 = 用户 2026-08-22 确认。立绘走仓库 assets/heroes/。
  {
    id: 9017, name: "梦貂蝉", genre: "线下", series: "梦", faction: "蜀",
    factionSelectable: false, quality: "线下", hp: 3, initialHp: null,
    tags: ["辅助", "控制", "爆发"],
    skills: [
      { name: "低语", effect: "每轮开始时，你可以令另一名角色本轮造成的伤害+1，然后你从“崩坏”“同疾”“弼昏”“义拒”中选择一个未选择过的技能令其获得。" },
      { name: "拂衣", effect: "当你成为【杀】的目标时，你可以为此牌选择一个额外目标并令所有目标摸一张牌，此牌被一名角色抵消后，对其余目标无效。" },
      { name: "就计", effect: "每轮结束后，你可以令两名角色依次执行一个仅能对对方使用牌且双方技能互换的额外回合。" },
    ],
    characteristic: "线下武将。低语给增伤并塞负面技，拂衣拉人分摊【杀】，就计安排两人互斗额外回合。",
    cover: "https://initial-jie.github.io/sgs-wiki/assets/heroes/mengdiaochan.jpg",
    avatar: "https://initial-jie.github.io/sgs-wiki/assets/heroes/mengdiaochan.jpg",
    tool: null, offline: true,
  },
  // 界钟会 —— OL 2026-09 测试上线、2026-11-06 正式版(技能按 olwiki 758 正式文本更新;官方花名册/API 仍未收录)。魏/4血/界一将-2。衍生技「排异」在 derived-skills-room.json。⚠ graduate 后删。
  {
    id: 9018, name: "界钟会", genre: "界限突破", series: "界", faction: "魏",
    factionSelectable: false, quality: null, hp: 4, initialHp: null,
    tags: ["卖血", "进攻"],
    skills: [
      { name: "权计", effect: "当你造成或受到1点伤害后，你可以摸一张牌，当前回合角色将一张手牌置于你的武将牌上，称为“权”。然后若你手牌数最多，你将一张手牌置为“权”。你每有一张“权”，你的手牌上限便+1。" },
      { name: "自立", effect: "觉醒技，每个准备阶段，若你“权”的数量大于等于3，你回复1点体力或摸两张牌，然后获得“排异”。" },
    ],
    characteristic: "造成伤害可权计，排异可两项都执行。",
    cover: "https://web.sanguosha.com/220/h5_2/res/runtime/pc/general/big/static/75800.png",
    avatar: "https://web.sanguosha.com/220/h5_2/res/runtime/pc/general/skinShop/75800.png",
    tool: null, offline: true,
  },
  // ───── 《不臣之心》实体扩展 = OL 2026「不臣之君」身份新玩法的三个模式专属将(数据源:萌娘百科 三国杀:张角/董卓/刘宏 「不臣之君」节,2026-09-24)。
  // 各自只能在对应模式当"君"用;模式规则写在 derived-skills-room.json 的说明卡里(查将带出)。
  // 立绘:OL 无独立 id 也无专属皮肤,实体卡插画网上无干净图 → 用户 2026-09-25 定:各挑一款 OL 高品质皮肤与标版区分(张角 大贤良师·传说 21206 / 董卓 西凉鬼豪·传说 4505 / 刘宏 俪觞妙舞·限定 50701,刘宏无传说皮)。路径 general/big/static + skinShop 同新将。
  // 教主张角 —— 失心疯模式教主专属。群/3血。教主技〖蔽众〗。
  {
    id: 9019, name: "教主张角", genre: "不臣之君", series: "不臣", faction: "群",
    factionSelectable: false, quality: "线下", hp: 3, initialHp: null,
    tags: ["模式专属", "控制", "爆发"],
    skills: [
      { name: "雷击", effect: "当你使用或打出【闪】或使用【闪电】时，你可以进行判定。当你进行判定后，若结果为：黑桃，你对一名角色造成2点雷电伤害；梅花，你回复1点体力，可以对一名角色造成1点雷电伤害。" },
      { name: "鬼道", effect: "当一名角色的判定牌生效前，你可以打出一张黑色牌替换之。若此牌为黑桃2-9，你摸一张牌。" },
      { name: "蔽众", effect: "教主技，你杀死失心不执行惩罚；游戏开始时，你可以选择一名不为失心的其他角色，观看其身份牌并令其成为失心，然后可以任意交换所有失心的身份牌。" },
    ],
    characteristic: "《不臣之心》失心疯模式教主专属将（只能作为教主使用）。模式规则见下方说明卡。",
    cover: "https://web.sanguosha.com/220/h5_2/res/runtime/pc/general/big/static/21206.png",
    avatar: "https://web.sanguosha.com/220/h5_2/res/runtime/pc/general/skinShop/21206.png",
    tool: null, offline: true,
  },
  // 暴君董卓 —— 暴虐无道模式暴君专属。群/6血(模式规则暴君初始体力上限再+2 → 8,面板手动加)。暴君技〖肆虐〗。
  {
    id: 9020, name: "暴君董卓", genre: "不臣之君", series: "不臣", faction: "群",
    factionSelectable: false, quality: "线下", hp: 6, initialHp: null,
    tags: ["模式专属", "进攻", "爆发"],
    skills: [
      { name: "诈觥", effect: "出牌阶段开始时，你可以令一名其他角色选择一项：1.本回合所有手牌视为【酒】并受到你对其造成的1点伤害；2.视为对你使用一张【酒】并对你造成1点伤害。" },
      { name: "凶戮", effect: "你可以将一张黑桃手牌当【酒】使用。你使用【酒】无次数限制。你使用【酒】【杀】需X张【闪】才能抵消（X为影响此【杀】的【酒】数量）。" },
      { name: "崩坏", effect: "锁定技，结束阶段，若你不是体力值最低的角色，你减1点体力上限或失去1点体力。" },
      { name: "肆虐", effect: "暴君技，锁定技，每轮开始时，你将体力回复至体力上限。每回合限一次，当你造成伤害时，你减1点体力上限并摸伤害值张牌，然后若受伤角色死亡，重置此技能。" },
    ],
    characteristic: "《不臣之心》暴虐无道模式暴君专属将（只能作为暴君使用）。牌面6血，模式规则暴君初始体力上限+2，登记后请在状态面板把上限改为8。模式规则见下方说明卡。",
    cover: "https://web.sanguosha.com/220/h5_2/res/runtime/pc/general/big/static/4505.png",
    avatar: "https://web.sanguosha.com/220/h5_2/res/runtime/pc/general/skinShop/4505.png",
    tool: null, offline: true,
  },
  // 昏君刘宏 —— 大忠似奸模式昏君专属。群/4血。昏君技〖障目〗;〖执笏〗是鬻爵授予他人的技能→放衍生技卡。
  {
    id: 9021, name: "昏君刘宏", genre: "不臣之君", series: "不臣", faction: "群",
    factionSelectable: false, quality: "线下", hp: 4, initialHp: null,
    tags: ["模式专属", "控制", "过牌"],
    skills: [
      { name: "鬻爵", effect: "出牌阶段限一次，你可以废除一个装备栏并选择一名有手牌的其他角色，令其交给你一张手牌，然后其获得〖执笏〗直到你的下回合开始。" },
      { name: "图兴", effect: "锁定技，当你废除一个装备栏时，你加1点体力上限并回复1点体力；当你所有的装备栏首次均废除后，你减4点体力上限，然后你本局游戏接下来造成的伤害+1。" },
      { name: "障目", effect: "昏君技，锁定技，当其他角色死亡时，若其不为义军，其身份不亮出，然后其他角色观看其身份；你杀死任意角色的奖惩均改为摸两张牌。" },
    ],
    characteristic: "《不臣之心》大忠似奸模式昏君专属将（只能作为昏君使用）。模式规则与授予他人的〖执笏〗见下方说明卡。",
    cover: "https://web.sanguosha.com/220/h5_2/res/runtime/pc/general/big/static/50701.png",
    avatar: "https://web.sanguosha.com/220/h5_2/res/runtime/pc/general/skinShop/50701.png",
    tool: null, offline: true,
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
  // 孙寒华(OL 版)—— olwiki 真 id 774(官网花名册 2026-10-17 未收录,olwiki 品质「未标注」= 测试版),用户已买到实体卡;graduate 候选。
  // 技能抄自 olwiki;衍生牌【彩莲】与衍生技 荡魔/济惠/霞举 在 derived-cards-room / derived-skills-room 的「孙寒华」条目
  {
    id: 9027, name: "孙寒华", genre: "璀璨星河", series: "标", faction: "吴",
    factionSelectable: false, quality: "测试版", hp: 3, initialHp: null,
    tags: ["形态切换", "过牌"],
    skills: [
      { name: "华光", effect: "每轮开始时、准备阶段，你可选择：1.将【彩莲】置入一个装备栏；2.修改【彩莲】花色。" },
      { name: "玄白", effect: "锁定技，当【彩莲】进入你的一个装备栏后，你切换为不同的形态：武器栏—荡魔；防具栏—济惠；宝物栏—霞举。" },
    ],
    characteristic: "将彩莲置入不同的装备栏切换形态获得更高收益。",
    cardWarn: "OL 测试版武将(olwiki 品质未标注),技能文本以本房间为准;正式版若有改动再同步",
    cover: "https://web.sanguosha.com/220/h5_2/res/runtime/pc/general/big/static/77400.png",
    avatar: "https://web.sanguosha.com/220/h5_2/res/runtime/pc/general/skinShop/77400.png",
    tool: null, offline: true,
  },
  // 界刘封 —— olwiki 真 id 776(官网花名册 2026-10-23 仍未收录),用户报 OL 新上线;graduate 候选。技能抄自 olwiki
  {
    id: 9028, name: "界刘封", genre: "界限突破", series: "界", faction: "蜀",
    factionSelectable: false, quality: null, hp: 4, initialHp: null,
    tags: ["控制", "进攻"],
    skills: [
      { name: "陷嗣", effect: "准备阶段，你可以将至多两名角色共计至多两张牌置于你的武将牌上，称为“逆”。其他角色可以移去两张“逆”视为对你使用一张【杀】。" },
      { name: "侵凌", effect: "每回合限一次，你可以弃置一张牌，视为使用一张【杀】。若此【杀】造成了伤害，你摸一张牌，否则将你弃置的牌置为“逆”。" },
    ],
    characteristic: "可灵活的对敌方角色手牌进行破坏并印杀。",
    cover: "https://web.sanguosha.com/220/h5_2/res/runtime/pc/general/big/static/77600.png",
    avatar: "https://web.sanguosha.com/220/h5_2/res/runtime/pc/general/skinShop/77600.png",
    tool: null, offline: true,
  },
  // 王皑 —— OL 2026-11-06 正式上线(olwiki 真 id 768,官网花名册/API 仍未收录);graduate 候选。技能抄自 olwiki(⚠ 原文「你摸一张牌」后疑似丢了「将其置为“勤励”牌」的图标位,待官网文本核对)
  {
    id: 9029, name: "王皑", genre: "其他", series: "璀璨星河", faction: "魏",
    factionSelectable: false, quality: null, hp: 4, initialHp: null,
    tags: ["卖血"],
    skills: [
      { name: "勤励", effect: "准备阶段或当你受到1点伤害后，你摸一张牌。每回合结束时，你可将所有“勤励”牌置入弃牌堆，对当前回合角色造成1点伤害。若你因此失去所有手牌，改为对其造成等量伤害。" },
    ],
    characteristic: "有灵活的防守反击能力，调整手牌可以打出较高上限。",
    cover: "https://web.sanguosha.com/220/h5_2/res/runtime/pc/general/big/static/76800.png",
    avatar: "https://web.sanguosha.com/220/h5_2/res/runtime/pc/general/skinShop/76800.png",
    tool: null, offline: true,
  },
  // 谋田丰 —— olwiki 真 id 659(官网花名册 2026-10-16 仍未收录),用户报 OL 当日上线;graduate 候选。技能文本抄自 olwiki(去掉"爆发/卖血"定位角标)
  {
    id: 9026, name: "谋田丰", genre: "谋", series: "谋", faction: "群",
    factionSelectable: false, quality: "传说", hp: 3, initialHp: null,
    tags: ["控制", "过牌"],
    skills: [
      { name: "执谏", effect: "出牌阶段限一次，你可以摸3-X张牌并交给一名其他角色一张牌，此牌称为“谏”至其下个回合结束时。然后若其使用的下一张牌不为“谏”，你可再对其发动此技能（X为此技能本回合此前已发动次数）。" },
      { name: "效竭", effect: "当你成为【杀】的目标后，你可令你不可响应之。若如此做，你于此【杀】结算完毕后，视为使用你使用的上一张普通锦囊牌或摸一张牌。" },
    ],
    characteristic: "能够转化锦囊牌，对同目标连续发动技能收益较高。",
    cover: "https://web.sanguosha.com/220/h5_2/res/runtime/pc/general/big/static/65900.png",
    avatar: "https://web.sanguosha.com/220/h5_2/res/runtime/pc/general/skinShop/65900.png",
    tool: null, offline: true,
  },
  {
    // 线下《蚀心入魔·疑》魔武将。来源:萌娘百科「三国杀:曹操」蚀心入魔·疑 节简略描述(2026-11-11 抓);OL 无此将(与 OL 魔系列无关)。
    id: 9030, name: "疑·魔曹操", genre: "蚀心入魔", series: "魔", faction: "魔",
    factionSelectable: true, quality: "线下", hp: 3, initialHp: null,
    tags: ["卖血", "控制", "过牌"],
    skills: [
      { name: "枯心", effect: "当你受到伤害后，你可以令所有其他角色依次展示任意张手牌，你选择获得所有角色展示的牌或一名其他角色未展示的所有手牌并展示之，若你未因此获得红桃牌，你弃置获得的牌并翻面。" },
      { name: "似故", effect: "出牌阶段限一次，你可以令一名其他角色进行判定并对其造成两次1点伤害，期间其根据判定结果视为拥有对应的“受到伤害后”的技能。判定结果对应的技能——A〖智迟〗、2〖刚烈〗、3〖反馈〗、4〖遗计〗、5〖节命〗、6〖放逐〗、7〖矢北〗、8〖称象〗、9〖智愚〗、10〖鸡肋〗、J〖贲育〗、Q〖筹策〗、K〖武魂〗。" },
    ],
    characteristic: "线下《蚀心入魔·疑》的核心魔武将（称号“一目窥九州”，编号 DE 001）。魔势力：与神将一样，游戏开始时任选一个势力。枯心卖血收全场手牌，似故令目标判定并挨两次伤害、期间临时拥有对应的卖血技（十三个技能原文见衍生技）。",
    cover: "https://initial-jie.github.io/sgs-wiki/assets/heroes/mo-caocao-yi.jpg",
    avatar: "https://initial-jie.github.io/sgs-wiki/assets/heroes/mo-caocao-yi-s.jpg",
    tool: null, offline: true,
  },
  {
    // 线下《蚀心入魔·慢》魔武将。来源:萌娘百科「三国杀:关羽」蚀心入魔·慢 节简略描述(2026-11-11 抓);OL 无此将(与 OL 魔系列无关)。
    id: 9031, name: "慢·魔关羽", genre: "蚀心入魔", series: "魔", faction: "魔",
    factionSelectable: true, quality: "线下", hp: 5, initialHp: null,
    tags: ["进攻", "控制", "辅助"],
    skills: [
      { name: "撼国", effect: "每轮开始时，你可以扣置一名上轮未选择过的其他角色所有牌直到本轮结束，本轮内：当你对其使用的【杀】对其造成伤害后，其死亡；其可以令除其外的角色选择是否替其使用或打出【闪】且响应的角色获得你一张牌。" },
      { name: "唯我", effect: "限定技，结束阶段，你可以令至多三名其他角色获得〖仁德〗、〖青囊〗、〖龙吟〗中各不同的一个技能（这些技能只能对你发动），然后你获得〖武神〗。" },
    ],
    characteristic: "线下《蚀心入魔·慢》的核心魔武将（称号“四海仰鼻息”，编号 DE 002）。魔势力：与神将一样，游戏开始时任选一个势力。撼国每轮扣置一名角色的所有牌并可用【杀】令其即死，唯我给至多三名其他角色各发一个只能对你发动的辅助技并获得武神。",
    cover: "https://initial-jie.github.io/sgs-wiki/assets/heroes/mo-guanyu-man.jpg",
    avatar: "https://initial-jie.github.io/sgs-wiki/assets/heroes/mo-guanyu-man-s.jpg",
    tool: null, offline: true,
  },
  {
    // 线下《蚀心入魔·嗔》魔武将。来源:萌娘百科「三国杀:周瑜」蚀心入魔·嗔 节简略描述(2026-11-11 抓);OL 无此将(与 OL 魔系列无关)。
    id: 9032, name: "嗔·魔周瑜", genre: "蚀心入魔", series: "魔", faction: "魔",
    factionSelectable: true, quality: "线下", hp: 4, initialHp: null,
    tags: ["爆发", "控制"],
    skills: [
      { name: "劫火", effect: "使命技，回合开始时，你可以令场上下次出现的伤害改为3点火焰伤害。失败：此伤害被造成时，若造成此伤害的角色不为你，你减1点体力上限。" },
      { name: "香饵", effect: "使命技，出牌阶段限一次，你可以令一名角色于其下个结束阶段回复2点体力，期间其不能使用点数大于6的牌。失败：此回复体力流程结束后，若期间其受到的伤害值小于2，你减1点体力上限。" },
      { name: "灭虢", effect: "使命技，额定回合结束后，你可以获得一名其他角色至多三张牌并令其选择等量的角色，然后你执行一个不能对其选择角色使用牌的额外回合。失败：此额外回合结束时，若此额外回合你未使用过牌，你减1点体力上限。" },
    ],
    characteristic: "线下《蚀心入魔·嗔》的核心魔武将（称号“哀弦万耳惊”，编号 DE 003）。魔势力：与神将一样，游戏开始时任选一个势力。三个使命技都只有失败条件：效果夸张，但每失败一个减1点体力上限且该技能本局失效。",
    cover: "https://initial-jie.github.io/sgs-wiki/assets/heroes/mo-zhouyu-chen.jpg",
    avatar: "https://initial-jie.github.io/sgs-wiki/assets/heroes/mo-zhouyu-chen-s.jpg",
    tool: null, offline: true,
  },
  {
    // 线下《蚀心入魔·贪》魔武将。来源:萌娘百科「三国杀:吕布」蚀心入魔·贪 节简略描述(2026-11-11 抓);同日用户给实卡照片(DE 004,画师 小罗没想好)→ 四个技能改成实卡原文,立绘/头像裁自该照片;OL 无此将(与 OL 魔系列无关)。
    id: 9033, name: "贪·魔吕布", genre: "蚀心入魔", series: "魔", faction: "魔",
    factionSelectable: true, quality: "线下", hp: 5, initialHp: null,
    tags: ["爆发", "过牌", "困难"],
    skills: [
      { name: "无厌", effect: "游戏开始时，你获得〖无前〗〖神愤〗和至多五个由你选择的不同限定技；然后你将获得的所有限定技改为每轮限一次并减等量体力上限。" },
      { name: "拘魔", effect: "锁定技，蓄力技（2/2），回合开始时，消耗2点蓄力点将本回合出牌和弃牌阶段改为摸牌阶段。" },
      { name: "乞宽", effect: "未受伤其他角色结束阶段，其可弃置两张基本牌令你获得1点蓄力点；然后你可令其加1点体力上限。" },
      { name: "噬啮", effect: "每回合限一次，当你需要移除“暴怒”标记时，你可以将一名其他角色的等量体力上限当“暴怒”来移除。" },
    ],
    characteristic: "线下《蚀心入魔·贪》的核心魔武将（称号“口吞三世佛”，编号 DE 004）。魔势力：与神将一样，游戏开始时任选一个势力。无厌开局拿无前、神愤，并从焚城、业炎、奋威、勇进、乱武、涅槃六个限定技里选至多五个（每拿一个减1点体力上限，限定技改为每轮限一次），噬啮用其他角色的体力上限代替“暴怒”；拘魔会把出牌和弃牌阶段改成摸牌阶段。",
    cover: "https://initial-jie.github.io/sgs-wiki/assets/heroes/mo-lvbu-tan.jpg",
    avatar: "https://initial-jie.github.io/sgs-wiki/assets/heroes/mo-lvbu-tan-s.jpg",
    tool: null, offline: true,
  },
  {
    // 线下《蚀心入魔·疑》普通武将(未进选将白名单)。来源:萌娘百科「三国杀:蒋干」蚀心入魔·疑 节简略描述(2026-11-11 抓)。
    id: 9034, name: "疑·蒋干", genre: "蚀心入魔", series: "蚀心入魔", faction: "魏",
    factionSelectable: false, quality: "线下", hp: 3, initialHp: null,
    tags: ["控制", "防御", "拼点"],
    skills: [
      { name: "纵横", effect: "准备阶段，你可以观看两名其他角色的手牌，你展示并获得其中一名角色一张手牌，然后你弃置另一名角色与展示牌类别、花色、点数相同的至多各一张手牌。" },
      { name: "对辩", effect: "当你每回合首次受到伤害时，你可以与伤害来源延时拼点并防止此伤害，然后其可以令你弃置其一张牌并公开结果：若其赢，你失去1点体力。" },
    ],
    characteristic: "线下《蚀心入魔·疑》武将（称号“舌锁千帆”，编号 WEI 075）。纵横看两名角色的手牌，拿走一张并拆掉另一人同类别、花色、点数的牌；对辩用延时拼点防止每回合首次受到的伤害。",
    cover: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-jianggan-yi.jpg",
    avatar: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-jianggan-yi-s.jpg",
    tool: null, offline: true,
  },
  {
    // 线下《蚀心入魔·疑》普通武将(未进选将白名单)。来源:萌娘百科「三国杀:曹丕」蚀心入魔·疑 节简略描述(2026-11-11 抓)。
    id: 9035, name: "疑·曹丕", genre: "蚀心入魔", series: "蚀心入魔", faction: "魏",
    factionSelectable: false, quality: "线下", hp: 3, initialHp: null,
    tags: ["控制", "回复", "过牌"],
    skills: [
      { name: "争嗣", effect: "出牌阶段，你可以选择包含你在内三名有手牌的角色，令其中一名角色先展示一张手牌，其余角色再同时展示一张手牌：点数最大的角色弃置两张手牌；点数最小的角色失去1点体力。" },
      { name: "承命", effect: "出牌阶段结束时，若你是本阶段〖争嗣〗角色中手牌数/体力值最大的，你可以回复2点体力/获得这些角色各一张牌。" },
    ],
    characteristic: "线下《蚀心入魔·疑》武将（称号“兄友弟恭”，编号 WEI 014）。争嗣拉两名角色一起比点数，最大者弃两张手牌、最小者失去体力；出牌阶段结束时按手牌数或体力值领先用承命回血或拿牌。",
    cover: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-caopi-yi.jpg",
    avatar: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-caopi-yi-s.jpg",
    tool: null, offline: true,
  },
  {
    // 线下《蚀心入魔·疑》普通武将(未进选将白名单)。来源:萌娘百科「三国杀:王垕」蚀心入魔·疑 节简略描述(2026-11-11 抓)。
    id: 9036, name: "疑·王垕", genre: "蚀心入魔", series: "蚀心入魔", faction: "魏",
    factionSelectable: false, quality: "线下", hp: 4, initialHp: null,
    tags: ["辅助", "控制"],
    skills: [
      { name: "聚谷", effect: "准备阶段，你可以依次选择任意角色的共计至多五张牌，将这些牌按你选择的顺序正面朝上置于牌堆顶，此回合结束时，这些角色获得牌堆顶各自被放置的牌（没有则跳过），然后各摸一张牌。" },
    ],
    characteristic: "线下《蚀心入魔·疑》武将（称号“一刀斩讫”，编号 WEI 198）。聚谷把任意角色共计至多五张牌明置于牌堆顶，回合结束时各自拿回并各摸一张——期间牌堆顶的牌可能被别人摸走。",
    cover: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-wanghou-yi.jpg",
    avatar: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-wanghou-yi-s.jpg",
    tool: null, offline: true,
  },
  {
    // 线下《蚀心入魔·疑》普通武将(未进选将白名单)。来源:萌娘百科「三国杀:荀彧」蚀心入魔·疑 节简略描述(2026-11-11 抓)。
    id: 9037, name: "疑·荀彧", genre: "蚀心入魔", series: "蚀心入魔", faction: "魏",
    factionSelectable: false, quality: "线下", hp: 3, initialHp: null,
    tags: ["进攻", "拼点", "防御"],
    skills: [
      { name: "回策", effect: "出牌阶段限一次，你可以依次进行两次拼点（目标不能相同），均结束后，赢的角色各对另一次拼点中没赢的角色造成1点伤害。" },
      { name: "异合", effect: "锁定技，你的回合内各限一次，当一名角色受到伤害时，若其和伤害来源的体力值与手牌数大小关系：不同，此伤害+1；相同，双方各摸两张牌。" },
      { name: "赍志", effect: "锁定技，其他角色不能对你使用【桃】；当你每回合首次进入濒死状态时，你回复1点体力。" },
    ],
    characteristic: "线下《蚀心入魔·疑》武将（称号“末路见疑”，编号 WEI 013）。回策连拼两次点让赢家打另一场的输家；异合在自己回合内按双方体力与手牌的大小关系加伤或各摸两张；赍志不能被【桃】救，但每回合首次濒死自己回复1点。",
    cover: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-xunyu-yi.jpg",
    avatar: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-xunyu-yi-s.jpg",
    tool: null, offline: true,
  },
  {
    // 线下《蚀心入魔·疑》普通武将(未进选将白名单)。来源:萌娘百科「三国杀:吕伯奢」蚀心入魔·疑 节简略描述(2026-11-11 抓)。
    id: 9038, name: "疑·吕伯奢", genre: "蚀心入魔", series: "蚀心入魔", faction: "群",
    factionSelectable: false, quality: "线下", hp: 4, initialHp: null,
    tags: ["辅助", "控制"],
    skills: [
      { name: "请君", effect: "每轮结束时，你可以选择一名其他角色，然后你与攻击范围内包含其的角色各摸两张牌并将一张牌扣置于武将牌上（称为“伏兵”，有“伏兵”的角色可以于不为自己的角色使用手牌时移去一张颜色和类别均与此牌相同的“伏兵”以令此牌无效），其获得一个额外回合。此回合结束时，移去以此法扣置的所有“伏兵”，以此法扣置“伏兵”且此回合未受到伤害的角色各视为对其使用一张【杀】。" },
    ],
    characteristic: "线下《蚀心入魔·疑》武将（称号“碧血东流”，编号 QUN 212）。请君每轮结束时送一名其他角色一个额外回合，自己与能打到他的角色各摸两张并扣一张“伏兵”（可用来无效同色同类别的牌），该回合没受伤的扣牌者再各砍他一刀。",
    cover: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-lvboshe-yi.jpg",
    avatar: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-lvboshe-yi-s.jpg",
    tool: null, offline: true,
  },
  {
    // 线下《蚀心入魔·疑》普通武将(未进选将白名单)。来源:萌娘百科「三国杀:华佗」蚀心入魔·疑 节简略描述(2026-11-11 抓)。
    id: 9039, name: "疑·华佗", genre: "蚀心入魔", series: "蚀心入魔", faction: "群",
    factionSelectable: false, quality: "线下", hp: 4, initialHp: null,
    tags: ["进攻", "回复", "过牌"],
    skills: [
      { name: "灭害", effect: "你可以将两张牌当无距离和次数限制的刺【杀】使用。此牌结算结束后，于此牌结算流程中正面朝上失去过黑桃牌且已受伤的角色各摸两张牌并回复1点体力。" },
    ],
    characteristic: "线下《蚀心入魔·疑》武将（称号“上医医国”，编号 QUN 001）。灭害把两张牌当无距离次数限制的刺【杀】用，结算中正面朝上失去过黑桃牌的已受伤角色各摸两张并回复1点体力。",
    cover: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-huatuo-yi.jpg",
    avatar: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-huatuo-yi-s.jpg",
    tool: null, offline: true,
  },
  {
    // 线下《蚀心入魔·疑》普通武将(未进选将白名单)。来源:萌娘百科「三国杀:伏皇后」蚀心入魔·疑 节简略描述(2026-11-11 抓)。
    id: 9040, name: "疑·伏寿", genre: "蚀心入魔", series: "蚀心入魔", faction: "群",
    factionSelectable: false, quality: "线下", hp: 4, initialHp: 3,
    tags: ["辅助", "过牌", "拼点"],
    skills: [
      { name: "密图", effect: "准备阶段，你可以令至多三名已受伤角色各摸一张牌并展示之，这些角色可以与你指定的另一名角色拼点，赢的角色视为对没赢的角色使用一张【杀】，然后你减X点体力上限（X为其中未用展示牌拼点的角色数）。" },
      { name: "潜流", effect: "当与你距离1以内的角色成为【杀】的目标后，你可以观看牌堆底的四张牌并将这些牌以任意顺序置于牌堆顶或牌堆底，若这些牌花色各不同，你可以展示并获得之。" },
    ],
    characteristic: "线下《蚀心入魔·疑》武将（称号“白绫蔽月”，编号 QUN 031）。体力上限4、起始体力3。密图让至多三名已受伤角色摸牌并去拼点砍人，没用展示牌拼点的人数会扣自己体力上限；潜流在身边角色被【杀】时观星牌堆底四张，花色各不同可全拿。",
    cover: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-fushou-yi.jpg",
    avatar: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-fushou-yi-s.jpg",
    tool: null, offline: true,
  },
  {
    // 线下《蚀心入魔·疑》普通武将(未进选将白名单)。来源:萌娘百科「三国杀:刘备」蚀心入魔·疑 节简略描述(2026-11-11 抓)。
    id: 9041, name: "疑·刘备", genre: "蚀心入魔", series: "蚀心入魔", faction: "群",
    factionSelectable: false, quality: "线下", hp: 4, initialHp: null,
    tags: ["进攻", "拼点", "过牌"],
    skills: [
      { name: "乘变", effect: "准备阶段和结束阶段，你可以与一名角色延时拼点并视为对其使用一张【决斗】，结算中双方可以将至少一半数量的手牌当【杀】打出；结算后公开结果，拼点赢的角色将手牌摸至体力上限。" },
    ],
    characteristic: "线下《蚀心入魔·疑》武将（称号“潜隐波涛”，编号 QUN 150）。乘变在准备和结束阶段先延时拼点再视为【决斗】，双方可把至少半数手牌当【杀】打出，结算后拼点赢的角色把手牌摸至体力上限。",
    cover: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-liubei-yi.jpg",
    avatar: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-liubei-yi-s.jpg",
    tool: null, offline: true,
  },
  {
    // 线下《蚀心入魔·慢》普通武将(未进选将白名单)。来源:萌娘百科「三国杀:庞德」蚀心入魔·慢 节简略描述(2026-11-11 抓)。
    id: 9042, name: "慢·庞德", genre: "蚀心入魔", series: "蚀心入魔", faction: "魏",
    factionSelectable: false, quality: "线下", hp: 4, initialHp: null,
    tags: ["进攻", "爆发"],
    skills: [
      { name: "搦战", effect: "准备阶段，你可以摸一张牌并令一名其他角色声明一种伤害类牌，然后你选择你或其视为对对方使用伤害+1的声明牌，若此牌未对目标造成伤害，使用者失去1点体力且你可以对相同角色重复此流程。" },
    ],
    characteristic: "线下《蚀心入魔·慢》武将（称号“狂徒”，编号 WEI 045）。搦战摸一张牌后让对方声明一种伤害类牌，由你决定谁对谁视为使用伤害+1的该牌；没造成伤害则使用者失去1点体力且可以重复。",
    cover: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-pangde-man.jpg",
    avatar: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-pangde-man-s.jpg",
    tool: null, offline: true,
  },
  {
    // 线下《蚀心入魔·慢》普通武将(未进选将白名单)。来源:萌娘百科「三国杀:刘封」蚀心入魔·慢 节简略描述(2026-11-11 抓)。
    id: 9043, name: "慢·寇封", genre: "蚀心入魔", series: "蚀心入魔", faction: "蜀",
    factionSelectable: false, quality: "线下", hp: 4, initialHp: null,
    tags: ["控制", "过牌"],
    skills: [
      { name: "怀兵", effect: "准备阶段，你可以选择两名角色，获得这些角色各一张手牌，然后你展示所有手牌，令其中体力值较小的角色下个摸牌阶段摸牌数、出牌阶段使用【杀】的次数上限、弃牌阶段手牌上限改为其中红色牌的数量。" },
    ],
    characteristic: "线下《蚀心入魔·慢》武将（称号“不动如山”，编号 SHU 030）。即刘封（实卡名寇封）。怀兵拿两名角色各一张手牌后展示全部手牌，其中体力较小者下个摸牌阶段的摸牌数、出牌阶段出【杀】的次数上限、弃牌阶段的手牌上限都改为你手里红色牌的数量。",
    cover: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-koufeng-man.jpg",
    avatar: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-koufeng-man-s.jpg",
    tool: null, offline: true,
  },
  {
    // 线下《蚀心入魔·慢》普通武将(未进选将白名单)。来源:萌娘百科「三国杀:关银屏」蚀心入魔·慢 节简略描述(2026-11-11 抓)。
    id: 9044, name: "慢·关银屏", genre: "蚀心入魔", series: "蚀心入魔", faction: "蜀",
    factionSelectable: false, quality: "线下", hp: 4, initialHp: null,
    tags: ["进攻", "过牌"],
    skills: [
      { name: "姻谋", effect: "男性角色的结束阶段，其可以连接你与其各一张未被连接的手牌。当你每回合首次失去连接牌后，本次一同失去连接牌的角色各摸X张牌（X为这些角色数且至多为5）。" },
      { name: "驱斥", effect: "出牌阶段限一次，你可以对一名角色造成1点火焰伤害，若其有连接牌，你重置其连接牌，令此伤害+1。" },
    ],
    characteristic: "线下《蚀心入魔·慢》武将（称号“天骄虎女”，编号 SHU 039）。姻谋让男性角色在结束阶段与你各连接一张手牌，连接牌一起失去时相关角色各摸牌；驱斥出牌阶段限一次打1点火焰伤害，目标有连接牌则重置之并加1点伤害。",
    cover: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-guanyinping-man.jpg",
    avatar: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-guanyinping-man-s.jpg",
    tool: null, offline: true,
  },
  {
    // 线下《蚀心入魔·慢》普通武将(未进选将白名单)。来源:萌娘百科「三国杀:糜芳」蚀心入魔·慢 节简略描述(2026-11-11 抓)。
    id: 9045, name: "慢·糜芳", genre: "蚀心入魔", series: "蚀心入魔", faction: "蜀",
    factionSelectable: false, quality: "线下", hp: 3, initialHp: null,
    tags: ["进攻", "过牌"],
    skills: [
      { name: "火厄", effect: "结束阶段，你可以视为对至多四名其他角色使用一张【火攻】，结算流程中若你：能造成伤害，你须造成伤害并取消其余目标；不能造成伤害，当前目标角色观看你的手牌。然后你分配因此展示的牌，若这些牌的点数之和小于13，你失去1点体力。" },
      { name: "贪惰", effect: "锁定技，若你的手牌数大于手牌上限，你的弃牌阶段改为摸牌阶段。" },
    ],
    characteristic: "线下《蚀心入魔·慢》武将（称号“负荆之臣”，编号 SHU 071A）。火厄结束阶段对至多四人视为【火攻】，能烧就必须烧并取消其余目标，烧不了则被看手牌；展示牌点数之和小于13自己掉血。贪惰在手牌超上限时把弃牌阶段改成摸牌阶段。",
    cover: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-mifang-man.jpg",
    avatar: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-mifang-man-s.jpg",
    tool: null, offline: true,
  },
  {
    // 线下《蚀心入魔·慢》普通武将(未进选将白名单)。来源:萌娘百科「三国杀:于禁」蚀心入魔·慢 节简略描述(2026-11-11 抓)。
    id: 9046, name: "慢·于禁", genre: "蚀心入魔", series: "蚀心入魔", faction: "蜀",
    factionSelectable: false, quality: "线下", hp: 4, initialHp: null,
    tags: ["辅助", "强命", "回复"],
    skills: [
      { name: "肃伍", effect: "准备阶段，你可以连接至多四名角色各一张手牌。若你有连接牌，有连接牌的角色每回合首次使用的伤害类牌不能被响应且结算结束后其摸两张牌。" },
      { name: "仁王", effect: "每回合限一次，你可以将一张连接牌当【桃】使用。" },
    ],
    characteristic: "线下《蚀心入魔·慢》武将（称号“立地成佛”，编号 SHU 112）。蜀势力于禁。肃伍连接至多四名角色各一张手牌，自己有连接牌时，有连接牌的角色每回合首张伤害牌不能被响应且之后摸两张；仁王每回合可把一张连接牌当【桃】。",
    cover: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-yujin-man.jpg",
    avatar: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-yujin-man-s.jpg",
    tool: null, offline: true,
  },
  {
    // 线下《蚀心入魔·慢》普通武将(未进选将白名单)。来源:萌娘百科「三国杀:吕蒙」蚀心入魔·慢 节简略描述(2026-11-11 抓)。
    id: 9047, name: "慢·吕蒙", genre: "蚀心入魔", series: "蚀心入魔", faction: "吴",
    factionSelectable: false, quality: "线下", hp: 4, initialHp: 3,
    tags: ["进攻", "拼点", "困难"],
    skills: [
      { name: "空志", effect: "锁定技，当你使用【杀】指定一名角色为唯一目标后，你获得其至多三张牌。若你已受伤，普通锦囊牌对你无效且你的基本牌均视为【闪】。" },
      { name: "鄙诈", effect: "结束阶段，你可以摸一张牌并与一名角色拼点：若其没赢，其失去2点体力并令你观看其手牌，然后你可以使用其中至多两张点数小于其拼点牌的牌；若你没赢，你减1点体力上限。" },
    ],
    characteristic: "线下《蚀心入魔·慢》武将（称号“病入膏肓”，编号 WU 003）。体力上限4、起始体力3。空志出【杀】指定唯一目标后拿其至多三张牌，但受伤后普通锦囊对自己无效、基本牌全当【闪】；鄙诈结束阶段拼点，对方没赢失去2点体力并被你用掉手里的小牌，你没赢则减体力上限。",
    cover: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-lvmeng-man.jpg",
    avatar: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-lvmeng-man-s.jpg",
    tool: null, offline: true,
  },
  {
    // 线下《蚀心入魔·慢》普通武将(未进选将白名单)。来源:萌娘百科「三国杀:陆逊」蚀心入魔·慢 节简略描述(2026-11-11 抓)。
    id: 9048, name: "慢·陆逊", genre: "蚀心入魔", series: "蚀心入魔", faction: "吴",
    factionSelectable: false, quality: "线下", hp: 3, initialHp: null,
    tags: ["控制", "过牌", "拼点"],
    skills: [
      { name: "谄谀", effect: "出牌阶段限一次，你可以令一名其他角色摸其体力值张牌并与其用各自点数最小的手牌拼点，然后双方展示手牌：赢的角色可以交换双方一种颜色或类别的所有手牌。" },
      { name: "从风", effect: "转换技，当你使用牌指定目标或成为牌的目标后，你可以：阳：与使用者各摸一张牌；阴：弃置使用者两张牌。" },
    ],
    characteristic: "线下《蚀心入魔·慢》武将（称号“孺子为将”，编号 WU 007）。谄谀让对方摸其体力值张牌后双方用最小点数的手牌拼点，赢家可交换双方一种颜色或类别的全部手牌；从风是转换技，用牌或成为目标后轮流“各摸一张 / 弃使用者两张”。",
    cover: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-luxun-man.jpg",
    avatar: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-luxun-man-s.jpg",
    tool: null, offline: true,
  },
  {
    // 线下《蚀心入魔·慢》普通武将(未进选将白名单)。来源:萌娘百科「三国杀:颜良文丑」蚀心入魔·慢 节简略描述(2026-11-11 抓)。
    id: 9049, name: "慢·颜良文丑", genre: "蚀心入魔", series: "蚀心入魔", faction: "群",
    factionSelectable: false, quality: "线下", hp: 5, initialHp: null,
    tags: ["进攻", "过牌", "防御"],
    skills: [
      { name: "骇变", effect: "每回合开始时，若你上回合使用过手牌，上回合最后一张黑色牌和红色牌的使用者各可以视为使用一张【决斗】。" },
      { name: "怯亡", effect: "锁定技，当与你距离1以内的角色受到伤害后，你摸一张牌且你的手牌本回合均视为【无懈可击】。" },
    ],
    characteristic: "线下《蚀心入魔·慢》武将（称号“土鸡瓦犬”，编号 QUN 005）。骇变在每个回合开始时结算：只要你上回合用过手牌，上回合最后一张黑色牌和红色牌的使用者各可以视为使用一张【决斗】；怯亡是锁定技，身边角色受伤后你摸一张牌，且你的手牌本回合都视为【无懈可击】。",
    cover: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-yanliangwenchou-man.jpg",
    avatar: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-yanliangwenchou-man-s.jpg",
    tool: null, offline: true,
  },
  {
    // 线下《蚀心入魔·嗔》普通武将(未进选将白名单)。来源:萌娘百科「三国杀:曹操」蚀心入魔·嗔 节简略描述(2026-11-11 抓)。
    id: 9050, name: "嗔·曹操", genre: "蚀心入魔", series: "蚀心入魔", faction: "魏",
    factionSelectable: false, quality: "线下", hp: 4, initialHp: null,
    tags: ["控制", "过牌"],
    skills: [
      { name: "揽娇", effect: "出牌阶段对每名角色限一次，你可以展示一名其他角色两张手牌，然后你获得展示的牌；其可以于展示时失去1点体力并摸一张牌，令你重新展示。若你于一回合内因此获得过红桃和方块牌，此技能本回合失效。" },
    ],
    characteristic: "线下《蚀心入魔·嗔》武将（称号“铜雀囚凤”，编号 WEI 001）。揽娇对每名角色每阶段一次，展示其两张手牌并拿走；对方可以失去1点体力摸一张牌让你重新展示。一回合内拿到过红桃和方块后本回合失效。",
    cover: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-caocao-chen.jpg",
    avatar: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-caocao-chen-s.jpg",
    tool: null, offline: true,
  },
  {
    // 线下《蚀心入魔·嗔》普通武将(未进选将白名单)。来源:萌娘百科「三国杀:曹仁」蚀心入魔·嗔 节简略描述(2026-11-11 抓)。
    id: 9051, name: "嗔·曹仁", genre: "蚀心入魔", series: "蚀心入魔", faction: "魏",
    factionSelectable: false, quality: "线下", hp: 4, initialHp: null,
    tags: ["防御", "过牌", "控制"],
    skills: [
      { name: "佯北", effect: "准备阶段或结束阶段，你可以翻面并摸三张牌。当你使用【杀】或普通锦囊牌指定一名角色为唯一目标后，其可以弃置所有手牌，令此技能本回合失效。" },
      { name: "阴锋", effect: "锁定技，当你每回合首次造成伤害后，直到你下回合开始，受伤角色的体力上限减至其体力值且其即将造成或受到的伤害均视为失去体力。" },
    ],
    characteristic: "线下《蚀心入魔·嗔》武将（称号“坚壳之蚌”，编号 WEI 011）。佯北在准备或结束阶段翻面摸三张，被你单体指定的角色可以弃光手牌让它本回合失效；阴锋令每回合首次被你打伤的角色体力上限减至体力值，且其造成和受到的伤害都视为失去体力，直到你下回合开始。",
    cover: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-caoren-chen.jpg",
    avatar: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-caoren-chen-s.jpg",
    tool: null, offline: true,
  },
  {
    // 线下《蚀心入魔·嗔》普通武将(未进选将白名单)。来源:萌娘百科「三国杀:诸葛亮」蚀心入魔·嗔 节简略描述(2026-11-11 抓)。
    id: 9052, name: "嗔·诸葛亮", genre: "蚀心入魔", series: "蚀心入魔", faction: "蜀",
    factionSelectable: false, quality: "线下", hp: 3, initialHp: null,
    tags: ["控制", "过牌", "辅助"],
    skills: [
      { name: "并驱", effect: "准备阶段，你可以与一名其他角色各声明一种普通锦囊牌，然后双方依次将半数手牌（向上取整）当对方声明的牌使用。" },
      { name: "燔心", effect: "游戏开始时或当“燔心”角色死亡后，你可以令一名其他角色获得〖狂暴〗和〖无谋〗；其回合开始时，你可以弃其至多5枚“暴怒”并摸等量的牌。" },
    ],
    characteristic: "线下《蚀心入魔·嗔》武将（称号“人也神也”，编号 LESHU 004）。实卡势力标为“蜀主”。并驱与一名角色各声明一种普通锦囊，双方把半数手牌当对方声明的牌使用；燔心给一名其他角色〖狂暴〗和〖无谋〗，其回合开始时你可以弃其至多5枚“暴怒”并摸等量的牌。",
    cover: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-zhugeliang-chen.jpg",
    avatar: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-zhugeliang-chen-s.jpg",
    tool: null, offline: true,
  },
  {
    // 线下《蚀心入魔·嗔》普通武将(未进选将白名单)。来源:萌娘百科「三国杀:赵云」蚀心入魔·嗔 节简略描述(2026-11-11 抓)。
    id: 9053, name: "嗔·赵云", genre: "蚀心入魔", series: "蚀心入魔", faction: "蜀",
    factionSelectable: false, quality: "线下", hp: 4, initialHp: null,
    tags: ["进攻", "控制"],
    skills: [
      { name: "诈夺", effect: "结束阶段，你可以获得两名其他角色各一张牌，视为对其中一名角色使用一张【杀】，然后另一名角色视为对你使用一张【决斗】；与其中一名角色的结算流程中，你视为拥有另一名角色的所有技能。" },
    ],
    characteristic: "线下《蚀心入魔·嗔》武将（称号“坐收渔利”，编号 SHU 005）。诈夺结束阶段拿两名其他角色各一张牌，视为对其中一人出【杀】、另一人对你【决斗】；与其中一人结算时，你视为拥有另一人的所有技能。",
    cover: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-zhaoyun-chen.jpg",
    avatar: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-zhaoyun-chen-s.jpg",
    tool: null, offline: true,
  },
  {
    // 线下《蚀心入魔·嗔》普通武将(未进选将白名单)。来源:萌娘百科「三国杀:贾华」蚀心入魔·嗔 节简略描述(2026-11-11 抓)。
    id: 9054, name: "嗔·贾华", genre: "蚀心入魔", series: "蚀心入魔", faction: "吴",
    factionSelectable: false, quality: "线下", hp: 5, initialHp: null,
    tags: ["进攻", "加伤", "过牌"],
    skills: [
      { name: "伏备", effect: "出牌阶段限一次，你可以将手牌摸至体力上限，然后将两张牌正面朝上置于牌堆顶前十张的任意位置；一名角色回合结束时，若牌堆顶的牌正面朝上，你对其造成1点伤害。" },
      { name: "殚瘁", effect: "契定技，当你造成伤害时，你可以弃置两张牌（无牌则不弃），令此伤害+1。" },
    ],
    characteristic: "线下《蚀心入魔·嗔》武将（称号“拔剑四顾”，编号 WU 114）。伏备把手牌摸至体力上限后将两张牌明置于牌堆顶前十张里，谁的回合结束时牌堆顶是明牌就挨1点伤害；殚瘁是契定技，弃两张牌令伤害+1，发动过一次后变成强制。",
    cover: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-jiahua-chen.jpg",
    avatar: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-jiahua-chen-s.jpg",
    tool: null, offline: true,
  },
  {
    // 线下《蚀心入魔·嗔》普通武将(未进选将白名单)。来源:萌娘百科「三国杀:鲁肃」蚀心入魔·嗔 节简略描述(2026-11-11 抓)。
    id: 9055, name: "嗔·鲁肃", genre: "蚀心入魔", series: "蚀心入魔", faction: "吴",
    factionSelectable: false, quality: "线下", hp: 3, initialHp: null,
    tags: ["辅助", "发育", "过牌"],
    skills: [
      { name: "万利", effect: "首轮开始时，你可以交给一名其他角色任意张牌；第四轮结束时，其交给你三倍数量的牌（此前其称为“万利”角色；不足则全给并失去所有技能）；若其不为“万利”角色或已死亡，摸牌阶段，你多摸三张牌。" },
      { name: "理说", effect: "当你成为黑色牌的目标后，你可以摸一张牌并与“万利”角色拼点：若你赢，其交给你牌的时机提前一轮。" },
    ],
    characteristic: "线下《蚀心入魔·嗔》武将（称号“养虺成蛇”，编号 WU 014）。万利首轮借出任意张牌，第四轮结束时对方要还三倍（不够则全给并失去所有技能）；对方死了或不再是“万利”角色则你摸牌阶段多摸三张。理说在成为黑色牌目标后拼点，赢了把还款提前一轮。",
    cover: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-lusu-chen.jpg",
    avatar: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-lusu-chen-s.jpg",
    tool: null, offline: true,
  },
  {
    // 线下《蚀心入魔·嗔》普通武将(未进选将白名单)。来源:萌娘百科「三国杀:孙尚香」蚀心入魔·嗔 节简略描述(2026-11-11 抓)。
    id: 9056, name: "嗔·孙尚香", genre: "蚀心入魔", series: "蚀心入魔", faction: "吴",
    factionSelectable: false, quality: "线下", hp: 3, initialHp: null,
    tags: ["控制", "辅助", "防御"],
    skills: [
      { name: "骄纵", effect: "准备阶段或当你成为【杀】的目标后，你可以将场上的一张装备牌移动至一名角色的装备区，其本回合不能使用与之颜色相同的牌且受到的伤害+1。" },
      { name: "妇随", effect: "限定技，出牌阶段，你可以令一名男性角色失去一个无标签技能，然后你与其获得〖比翼〗且防止你与其本轮受到的伤害。" },
    ],
    characteristic: "线下《蚀心入魔·嗔》武将（称号“生死相随”，编号 WU 008）。骄纵在准备阶段或被【杀】时移动场上一张装备，接收者本回合不能用同色牌且受伤+1；妇随是限定技，令一名男性角色失去一个无标签技能，你与其获得转换技〖比翼〗并免疫本轮伤害。",
    cover: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-sunshangxiang-chen.jpg",
    avatar: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-sunshangxiang-chen-s.jpg",
    tool: null, offline: true,
  },
  {
    // 线下《蚀心入魔·嗔》普通武将(未进选将白名单)。来源:萌娘百科「三国杀:张昭」蚀心入魔·嗔 节简略描述(2026-11-11 抓)。
    id: 9057, name: "嗔·张昭", genre: "蚀心入魔", series: "蚀心入魔", faction: "吴",
    factionSelectable: false, quality: "线下", hp: 3, initialHp: null,
    tags: ["控制", "过牌"],
    skills: [
      { name: "挟众", effect: "准备阶段，你可以令场上半数角色（向上取整）依次选择一项：1.摸两张牌，失去1点体力；2.将两张牌当【杀】使用。然后你可以令另一名角色执行两次被选择次数较多的一项。" },
      { name: "乞施", effect: "契定技，结束阶段，你可以获得本回合弃牌堆中其他角色置入的至多五张牌，然后你跳过下个摸牌阶段。" },
    ],
    characteristic: "线下《蚀心入魔·嗔》武将（称号“迂儒”，编号 WU 015A）。挟众让半数角色各选“摸两张并失去1点体力”或“两张牌当【杀】”，再令另一名角色执行两次被选得多的那项；乞施是契定技，结束阶段捡本回合其他角色进弃牌堆的至多五张牌并跳过下个摸牌阶段。",
    cover: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-zhangzhao-chen.jpg",
    avatar: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-zhangzhao-chen-s.jpg",
    tool: null, offline: true,
  },
  {
    // 线下《蚀心入魔·贪》普通武将(未进选将白名单)。来源:萌娘百科「三国杀:吕布」蚀心入魔·贪（饥鹰饱虎） 节简略描述(2026-11-11 抓)。
    id: 9058, name: "贪·梦吕布", genre: "蚀心入魔", series: "蚀心入魔", faction: "魏",
    factionSelectable: false, quality: "线下", hp: 5, initialHp: null,
    tags: ["进攻", "爆发", "困难"],
    skills: [
      { name: "辘辘", effect: "若你没有手牌，你可以将其他角色的一张牌当【决斗】使用；此牌指定目标后，所有角色同时选择是否展示并交给你一张手牌。" },
      { name: "择主", effect: "若你的手牌数全场最大，你可以将所有手牌当一张无距离次数限制的【杀】对至少半数角色使用；此牌于结算中被第二次抵消后，抵消角色获得之。" },
      { name: "累勋", effect: "限定技，结束阶段，你可以将你使用【杀】的次数上限改为你本回合使用的【杀】数。" },
    ],
    characteristic: "线下《蚀心入魔·贪》武将（称号“饥鹰饱虎”，编号 WEI 404?）。对标江山如故梦武将的“if 线”吕布（乞降成功、为曹操所用，魏势力，实卡编号 WEI 404?）。辘辘空城时把别人的牌当【决斗】并收全场的牌；择主手牌最多时把所有手牌当【杀】砍至少半数角色；累勋限定技把出【杀】次数上限改为本回合出【杀】数。",
    cover: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-lvbu-meng-tan.jpg",
    avatar: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-lvbu-meng-tan-s.jpg",
    tool: null, offline: true,
  },
  {
    // 线下《蚀心入魔·贪》普通武将(未进选将白名单)。来源:萌娘百科「三国杀:丁原」蚀心入魔·贪 节简略描述(2026-11-11 抓)。
    id: 9059, name: "贪·丁原", genre: "蚀心入魔", series: "蚀心入魔", faction: "群",
    factionSelectable: false, quality: "线下", hp: 4, initialHp: null,
    tags: ["控制", "过牌", "困难"],
    skills: [
      { name: "羁缚", effect: "每轮开始时，你可以获得一名其他角色所有手牌并占有其装备区直到本轮结束；期间其使用牌无距离次数限制且当其摸牌时，改为获得你等量的牌（不足则改为对你造成等量的伤害）。" },
    ],
    characteristic: "线下《蚀心入魔·贪》武将（称号“虎子无犬父”，编号 QUN 093）。羁缚每轮开始时拿走一名其他角色所有手牌并占有其装备区直到本轮结束；期间其用牌无距离次数限制，其摸牌改为从你这里拿等量的牌，你牌不够就改为对你造成等量伤害。",
    cover: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-dingyuan-tan.jpg",
    avatar: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-dingyuan-tan-s.jpg",
    tool: null, offline: true,
  },
  {
    // 线下《蚀心入魔·贪》普通武将(未进选将白名单)。来源:萌娘百科「三国杀:李肃」蚀心入魔·贪 节简略描述(2026-11-11 抓)。
    id: 9060, name: "贪·李肃", genre: "蚀心入魔", series: "蚀心入魔", faction: "群",
    factionSelectable: false, quality: "线下", hp: 3, initialHp: null,
    tags: ["辅助", "控制"],
    skills: [
      { name: "挥断", effect: "其他角色出牌阶段开始时，你可以交给其一张牌令其整肃；当其选择整肃奖励时，其可以背水：减1点体力上限且你获得相同奖励，此技能本轮失效。" },
      { name: "善诱", effect: "结束阶段，你可以选择一项执行并移除，然后将之作为选项加入本局整肃奖励：1.造成1点伤害；2.获得一名角色一张手牌；3.弃置场上两张牌。" },
    ],
    characteristic: "线下《蚀心入魔·贪》武将（称号“拨云见日”，编号 QUN 077）。挥断在其他角色出牌阶段开始时给一张牌令其整肃，其领奖时可背水（减1点体力上限）让你也拿同样的奖励；善诱每个结束阶段执行并移除“伤害 / 拿牌 / 拆场上两张”之一，并把它加进本局整肃奖励。",
    cover: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-lisu-tan.jpg",
    avatar: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-lisu-tan-s.jpg",
    tool: null, offline: true,
  },
  {
    // 线下《蚀心入魔·贪》普通武将(未进选将白名单)。来源:萌娘百科「三国杀:貂蝉」蚀心入魔·贪 节简略描述(2026-11-11 抓)。
    id: 9061, name: "贪·貂蝉", genre: "蚀心入魔", series: "蚀心入魔", faction: "群",
    factionSelectable: false, quality: "线下", hp: 3, initialHp: null,
    tags: ["过牌", "拼点", "辅助"],
    skills: [
      { name: "秘会", effect: "每轮结束时，你可以选择一名男性角色。你执行一个含三个你选择的阶段的额外回合，然后其执行一个含剩余三个阶段的额外回合。" },
      { name: "死志", effect: "准备阶段或当你受到伤害后，你可以摸两张牌并与一名角色拼点：除非赢的拼点牌为红色，否则你重复此流程。若如此做，本回合结束阶段，你失去没赢次数点体力。" },
    ],
    characteristic: "线下《蚀心入魔·贪》武将（称号“受困仙子”，编号 QUN 003）。秘会每轮结束时选一名男性角色，你先执行一个只含三个自选阶段的额外回合，他再执行含其余三个阶段的额外回合；死志摸两张后拼点，直到赢的那张拼点牌是红色才停，结束阶段按没赢次数失去体力。",
    cover: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-diaochan-tan.jpg",
    avatar: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-diaochan-tan-s.jpg",
    tool: null, offline: true,
  },
  {
    // 线下《蚀心入魔·贪》普通武将(未进选将白名单)。来源:萌娘百科「三国杀:陈宫」蚀心入魔·贪 节简略描述(2026-11-11 抓)。
    id: 9062, name: "贪·陈宫", genre: "蚀心入魔", series: "蚀心入魔", faction: "群",
    factionSelectable: false, quality: "线下", hp: 3, initialHp: null,
    tags: ["控制"],
    skills: [
      { name: "狭策", effect: "准备阶段，你可以令一名角色于其下个出牌阶段仅能使用一张手牌（此牌额外结算两次）。" },
      { name: "莽伏", effect: "其他角色准备阶段，你可以获得其至多两张手牌并将等量的牌扣置于武将牌上（称为“伏兵”，你可以于其他角色使用手牌时移去一张颜色和类别均与此牌相同的“伏兵”以令此牌无效），本回合结束时，你移去你的剩余“伏兵”并失去等量的体力。" },
    ],
    characteristic: "线下《蚀心入魔·贪》武将（称号“暴怒的军师”，编号 QUN 028）。狭策令一名角色下个出牌阶段只能用一张手牌，但这张牌额外结算两次；莽伏在其他角色准备阶段拿其至多两张手牌并扣等量“伏兵”（可无效同色同类别的牌），回合结束没用掉的伏兵每张让你失去1点体力。",
    cover: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-chengong-tan.jpg",
    avatar: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-chengong-tan-s.jpg",
    tool: null, offline: true,
  },
  {
    // 线下《蚀心入魔·贪》普通武将(未进选将白名单)。来源:萌娘百科「三国杀:陈珪陈登」蚀心入魔·贪 节简略描述(2026-11-11 抓)。
    id: 9063, name: "贪·陈珪陈登", genre: "蚀心入魔", series: "蚀心入魔", faction: "群",
    factionSelectable: false, quality: "线下", hp: 3, initialHp: null,
    tags: ["辅助", "防御", "控制"],
    skills: [
      { name: "鬻主", effect: "每轮开始时，你可以选择两名角色，你令其中一名角色本轮视为同时装备着【仁王盾】、【八卦阵】和【藤甲】且受到1点伤害后交给你与伤害来源各一张牌，另一名角色本轮视为装备着【青釭剑】。" },
      { name: "请丧", effect: "结束阶段，你可以令一名其他角色视为对你指定的一名角色使用一张【决斗】，目标角色打出【杀】响应此牌时，此牌对使用者造成的伤害+1。" },
    ],
    characteristic: "线下《蚀心入魔·贪》武将（称号“股掌戏虎”，编号 QUN 125&095）。鬻主每轮开始时给一名角色仁王盾+八卦阵+藤甲三合一（其受伤后要分别交给你和伤害来源各一张牌），给另一名角色青釭剑；请丧结束阶段指挥一名其他角色对你指定的人【决斗】，目标出【杀】响应时对使用者的伤害+1。",
    cover: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-chenguichendeng-tan.jpg",
    avatar: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-chenguichendeng-tan-s.jpg",
    tool: null, offline: true,
  },
  {
    // 线下《蚀心入魔·贪》普通武将(未进选将白名单)。来源:萌娘百科「三国杀:吕玲绮」蚀心入魔·贪 节简略描述(2026-11-11 抓)。
    id: 9064, name: "贪·吕玲绮", genre: "蚀心入魔", series: "蚀心入魔", faction: "群",
    factionSelectable: false, quality: "线下", hp: 4, initialHp: null,
    tags: ["过牌", "辅助"],
    skills: [
      { name: "嫁衣", effect: "准备阶段，你可以摸两张牌，然后使用游戏外或弃牌堆中拥有〖绝情〗的【女装】。" },
      { name: "饲骨", effect: "出牌阶段限一次，你可以令一名男性角色占有你的装备区，然后你获得其至多X张牌并将其中任意张牌交给其他角色（X为你装备区里牌的花色数）。" },
    ],
    characteristic: "线下《蚀心入魔·贪》武将（称号“落花逐流”，编号 QUN 089）。嫁衣准备阶段摸两张并装上带〖绝情〗的【女装】（伤害改为失去体力）；饲骨让一名男性角色占有你的装备区，你拿其至多X张牌并可分给别人（X为你装备区里牌的花色数）。",
    cover: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-lvlingqi-tan.jpg",
    avatar: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-lvlingqi-tan-s.jpg",
    tool: null, offline: true,
  },
  {
    // 线下《蚀心入魔·贪》普通武将(未进选将白名单)。来源:萌娘百科「三国杀:严夫人」蚀心入魔·贪 节简略描述(2026-11-11 抓)。
    id: 9065, name: "贪·严夫人", genre: "蚀心入魔", series: "蚀心入魔", faction: "群",
    factionSelectable: false, quality: "线下", hp: 3, initialHp: null,
    tags: ["辅助", "进攻"],
    skills: [
      { name: "保城", effect: "当与你距离1以内的角色每回合首次成为【杀】的唯一目标后，你可以将之改为【兵临城下】；当牌因此【兵临城下】的效果而被亮出后，若这些牌中有红桃牌，你可以令其获得这些红桃牌，然后使用者再亮出两倍获得牌数的牌（视为因此【兵临城下】的效果而被亮出的）。" },
      { name: "长醉", effect: "你的【酒】对一回合内的【杀】均生效。你可以将一张装备牌当【酒】使用。" },
    ],
    characteristic: "线下《蚀心入魔·贪》武将（称号“醉生梦死”，编号 QUN 133）。保城把身边角色每回合首次单体挨的【杀】改成【兵临城下】，亮出的红桃牌可以给目标，使用者再多亮两倍的牌；长醉让【酒】对一回合内所有【杀】生效，装备牌可当【酒】。",
    cover: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-yanfuren-tan.jpg",
    avatar: "https://initial-jie.github.io/sgs-wiki/assets/heroes/sxrm-yanfuren-tan-s.jpg",
    tool: null, offline: true,
  },
];

// 就地修改并返回 list。幂等:同 id 的线下武将已存在则整条替换。warn 收集未命中的技能名。
export function applyOverrides(list, warn = (m) => console.warn(m)) {
  let skillHits = 0, added = 0, reordered = 0, enHits = 0, pruned = 0;
  // 清孤儿:库里 offline 条目已不在 OFFLINE_HEROES(= 已 graduate 或删除)→ 移除,否则 rebake 永远留着旧 9000+ 条
  const offlineIds = new Set(OFFLINE_HEROES.map((h) => h.id));
  for (let i = list.length - 1; i >= 0; i--)
    if (list[i].offline && !offlineIds.has(list[i].id)) { list.splice(i, 1); pruned++; }
  for (const h of list) {
    const ov = SKILL_OVERRIDES[h.id];
    if (!ov) continue;
    if (ov.cardWarn) h.cardWarn = ov.cardWarn; else delete h.cardWarn; // ① 技能修正提示(幂等:去掉 cardWarn 的将 rebake 时清除旧标记)
    if (ov.hp != null) h.hp = ov.hp; // 体力上限覆盖(测试版房规用,如 SP赵云 3→4;删掉该条 rebake 会被官网原值覆盖回去)
    if (ov.skillsReplace) { h.skills = ov.skillsReplace.map((x) => ({ ...x })); skillHits += h.skills.length; } // 整组替换(官网占位空技能的将,如 秦朗 639)
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
  return { list, skillHits, added, reordered, enHits, pruned };
}
