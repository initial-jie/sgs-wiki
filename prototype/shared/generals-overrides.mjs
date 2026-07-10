// 人工修正层 —— generals.json 由 scrape-generals.mjs 自动生成,手改会被 re-scrape 覆盖。
// 这里是"人工真相"单一来源:爬虫跑完(及现在)都 applyOverrides 一遍,改动永不丢失。
// 两类:
//   ① SKILL_OVERRIDES —— 改现有 OL 条目的技能全文(官方wiki过时 / 线下与线上不一致),其余技能不动。
//   ② OFFLINE_HEROES  —— 纯线下武将(OL 没有),整条新增。
//
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
    cover: null, avatar: null, tool: null, offline: true,
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
    cover: null, avatar: null, tool: null, offline: true,
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
    cover: null, avatar: null, tool: null, offline: true,
  },
];

// 就地修改并返回 list。幂等:同 id 的线下武将已存在则整条替换。warn 收集未命中的技能名。
export function applyOverrides(list, warn = (m) => console.warn(m)) {
  let skillHits = 0, added = 0;
  for (const h of list) {
    const ov = SKILL_OVERRIDES[h.id];
    if (!ov) continue;
    for (const [sn, eff] of Object.entries(ov.skills || {})) {
      const s = (h.skills || []).find((x) => x.name === sn);
      if (s) { s.effect = eff; skillHits++; }
      else warn(`[overrides] id${h.id}「${h.name}」无技能「${sn}」,跳过(名字变了?)`);
    }
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
  return { list, skillHits, added };
}
