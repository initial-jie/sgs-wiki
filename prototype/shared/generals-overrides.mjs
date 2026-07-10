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
  return { list, skillHits, added };
}
