// 忍者之夜房间 "可执行规格" —— 牌组/人数表/轮抽传牌/声明与作废/按号结算/13 种牌效果/镜僧殉道者反应/判官免疫/揭示比级与平手/首脑/浪人/计分与胜利/保密/持久化
// 复用与真实 Workers 同一份核心逻辑(./shared/ninja-logic.mjs)。
// node prototype/ninja/ninja-sim.mjs

import { NinjaCore } from "./shared/ninja-logic.mjs";
import { CARDS, PHASES, buildDeck, housesFor, buildTokenPool, houseName, cardName, NAME_SETS, DEFAULT_NAMES, houseNameIn, cardNameIn, phaseNameIn } from "./shared/ninja-data.mjs";

let passed = 0, failed = 0;
function check(name, cond, detail = "") {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail ? "  <- " + detail : ""}`); }
}
function lcg(seed) { let x = seed >>> 0; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); }
const DECK = buildDeck(), card = (id) => { const c = DECK.find((x) => x.id === id); if (!c) throw new Error("no card " + id); return { ...c }; };

function mk(n, seed = 1, config) {
  const room = new NinjaCore("1234", n, lcg(seed));
  const dev = {}; for (let i = 1; i <= n; i++) { dev[i] = `p${i}`; room.claimSeat(dev[i], i); }
  room.action(dev[1], { op: "setConfig", config: { names: "official" } }); // 断言按官方直译名写;牌名版本单独测
  if (config) room.action(dev[1], { op: "setConfig", config });
  return { room, dev, V: (i) => room.viewFor(dev[i]), act: (i, o) => room.action(dev[i], o) };
}
// 开局并走完轮抽(每人都选第一张),到夜晚密探阶段
function toNight(t) {
  t.act(1, { op: "startGame" });
  for (let k = 0; k < 2; k++) for (const n of t.room.seatNos()) t.act(n, { op: "draftPick", seatNo: n, cardId: t.room.seats[n].hand[0].id });
}
// 强行摆局:houses {seat:house} / hands {seat:[ids]} / discard [ids];并从指定阶段开始声明
function layout(room, houses, hands, step = 0, discard = []) {
  for (const n of room.seatNos()) { const s = room.seats[n]; s.house = houses[n] || s.house; s.hand = (hands[n] || []).map(card); s.burnt = []; s.faceUp = []; s.played = []; s.dead = false; s.revealed = false; s.cantLook = false; s.notes = []; }
  room.discard = discard.map(card); room.phase = "night";
  room._beginStep(step);
}
// 全员声明:decl {seat:[ids]},其余跳过
function declareAll(t, decl = {}) {
  for (const n of t.room.seatNos()) if (t.room.seats[n].dead && t.room.seats[n].declared === null) t.room.seats[n].declared = []; // 摆局时事后标死的座位
  for (const n of t.room.alive()) if (t.room.seats[n].declared === null) t.act(n, { op: "declare", seatNo: n, cards: decl[n] || [] });
}
// 跳过到揭示
function skipToReveal(t) { let guard = 0; while (t.room.phase === "night" && guard++ < 20) { declareAll(t); if (t.room.pending) throw new Error("unexpected pending " + JSON.stringify(t.room.pending)); } }
const tok = (room, n) => room.seats[n].tokens.length;

console.log("\n=== 数据 ===");
check("13 种牌,键唯一;五阶段顺序 密探→隐士→骗徒→盲眼刺客→上忍", CARDS.length === 13 && new Set(CARDS.map((c) => c.key)).size === 13 && PHASES.map((p) => p.key).join() === "spy,mystic,trickster,blind,shinobi");
check("牌组 33 张:密探/隐士/盲眼刺客/上忍 各 6(1~6)、骗徒 6 种编号 1~6、镜僧/殉道者/首脑各 1,id 唯一", DECK.length === 33 && new Set(DECK.map((c) => c.id)).size === 33 && ["spy", "mystic", "blind", "shinobi"].every((k) => DECK.filter((c) => c.key === k).map((c) => c.num).join() === "1,2,3,4,5,6") && DECK.filter((c) => CARDS.find((d) => d.key === c.key).phase === "trickster").map((c) => c.num).sort().join() === "1,2,3,4,5,6");
check("人数表:4 人 1~2;7 人 1~3+浪人;11 人 1~5+浪人;3/12 人无", housesFor(4).join() === "crane:1,lotus:1,crane:2,lotus:2" && housesFor(7).length === 7 && housesFor(7).includes("ronin") && housesFor(11).filter((h) => h.startsWith("crane")).length === 5 && !housesFor(3) && !housesFor(12));
check("荣誉标记默认 35 枚(2×14 3×14 4×7,按简中说明书)", buildTokenPool().length === 35 && buildTokenPool().filter((t) => t.v === 4).length === 7 && buildTokenPool().filter((t) => t.v === 2).length === 14);
check("名字:密探 3 / 判官 / 仙鹤 2 / 浪人", cardName(card("spy-3")) === "密探 3" && cardName(card("judge")) === "判官" && houseName("crane:2") === "仙鹤 2" && houseName("ronin") === "浪人");

console.log("\n=== 准备 / 配置 ===");
{
  const t = mk(3), { room, act, V } = t;
  check("4~11 座", NinjaCore.MIN_SEATS === 4 && NinjaCore.MAX_SEATS === 11);
  check("3 人不能开", act(1, { op: "startGame" }).error === "PLAYER_COUNT" && V(1).check.error === "PLAYER_COUNT");
  check("非法配置拒绝", act(1, { op: "setConfig", config: { points: 0 } }).error === "BAD_CONFIG" && act(1, { op: "setConfig", config: { tokens: { 2: 0, 3: 0, 4: 0 } } }).error === "BAD_CONFIG");
  check("改分数与标记分布", act(1, { op: "setConfig", config: { points: 6, tokens: { 4: 1 } } }).ok && room.config.points === 6 && room.config.tokens[4] === 1 && room.config.tokens[2] === 14);
  room.addSeat("p1"); room.claimSeat("p4", 4);
  check("4 人可开;标记堆 29 枚;每人 3 张,剩 21 张移出", act(1, { op: "startGame" }).ok && room.tokenPool.length === 29 && room.seatNos().every((n) => room.seats[n].hand.length === 3) && room.aside.length === 21 && room.phase === "draft" && room.sub === "pick1");
  check("开局后不能改配置/座位", act(1, { op: "setConfig", config: { points: 5 } }).error === "NOT_SETUP" && room.addSeat("p1").error === "NOT_SETUP");
  check("4 人流派牌 = 仙鹤 1~2 + 莲花 1~2,每人一张", room.seatNos().map((n) => room.seats[n].house).sort().join() === "crane:1,crane:2,lotus:1,lotus:2");
}

console.log("\n=== 轮抽 ===");
{
  const t = mk(5, 3), { room, act, V } = t;
  act(1, { op: "startGame" });
  const h1 = room.seats[1].hand.map((c) => c.id), h2 = room.seats[2].hand.map((c) => c.id);
  check("别人看不到我的 3 张,只见张数与是否已选", V(2).seats[1].hand === undefined && V(2).seats[1].handCount === 3 && V(2).seats[1].picked === false && V(1).seats[1].hand.length === 3);
  check("不能替别人选;不在手里的牌拒绝", act(2, { op: "draftPick", seatNo: 1, cardId: h1[0] }).error === "NOT_HOLDER" && act(1, { op: "draftPick", seatNo: 1, cardId: "nope" }).error === "NOT_IN_HAND");
  check("选了可改;全员未选完不结算", act(1, { op: "draftPick", seatNo: 1, cardId: h1[0] }).ok && act(1, { op: "draftPick", seatNo: 1, cardId: h1[1] }).ok && room.seats[1].picked === h1[1] && V(2).seats[1].picked === true && room.sub === "pick1");
  for (const n of [2, 3, 4, 5]) act(n, { op: "draftPick", seatNo: n, cardId: room.seats[n].hand[0].id });
  check("第一轮选完:留 1 张,其余 2 张传给左手(1→2,5→1)", room.sub === "pick2" && room.seats[1].kept[0].id === h1[1] && room.seats[2].hand.map((c) => c.id).sort().join() === [h1[0], h1[2]].sort().join() && room.seats[2].kept[0].id === h2[0] && room.seats[1].hand.length === 2);
  for (const n of room.seatNos()) act(n, { op: "draftPick", seatNo: n, cardId: room.seats[n].hand[0].id });
  check("第二轮选完:每人 2 张,弃牌堆 5 张,进夜晚密探阶段", room.phase === "night" && room.sub === "declare" && room.phaseKey() === "spy" && room.seatNos().every((n) => room.seats[n].hand.length === 2 && room.seats[n].kept.length === 0) && room.discard.length === 5);
  check("流派牌只有本人可见;5 人有浪人", V(2).seats[1].house === undefined && V(1).seats[1].house === room.seats[1].house && room.seatNos().some((n) => room.seats[n].house === "ronin"));
}

console.log("\n=== 声明 / 翻牌 / 作废 / 结算顺序 ===");
{
  const t = mk(4), { room, act, V } = t;
  toNight(t);
  layout(room, { 1: "crane:1", 2: "lotus:1", 3: "crane:2", 4: "lotus:2" }, { 1: ["spy-5", "shinobi-1"], 2: ["spy-2", "mystic-3"], 3: ["blind-4", "mirror"], 4: ["spy-3", "martyr"] });
  check("声明只能是本阶段的牌;重复拒绝;死人不能声明", act(1, { op: "declare", seatNo: 1, cards: ["shinobi-1"] }).error === "BAD_CARDS" && act(1, { op: "declare", seatNo: 1, cards: ["spy-5", "spy-5"] }).error === "BAD_CARDS");
  check("声明状态公开但内容不公开", act(1, { op: "declare", seatNo: 1, cards: ["spy-5"] }).ok && V(2).seats[1].declared === true && V(2).seats[1].played.length === 0 && V(1).seats[1].declaredIds.join() === "spy-5");
  act(2, { op: "declare", seatNo: 2, cards: ["spy-2"] }); act(3, { op: "declare", seatNo: 3, cards: [] });
  check("未全员声明不翻牌", room.sub === "declare");
  act(4, { op: "declare", seatNo: 4, cards: [] });
  check("全员声明后翻牌:队列按编号 密探2(2号)→密探5(1号);4 号没打的密探 3 作废", room.sub === "resolve" && room.queue.map((q) => q.owner + ":" + q.card.id).join() === "2:spy-2,1:spy-5" && room.seats[4].burnt.includes("spy-3") && V(4).seats[4].hand.find((c) => c.id === "spy-3").burnt === true);
  check("待决公开:2 号的密探 2;不是他不能结算", V(3).pending.seat === 2 && V(3).pending.card.id === "spy-2" && act(1, { op: "resolve", seatNo: 1, target: 2 }).error === "NOT_YOUR_CARD" && act(2, { op: "declare", seatNo: 2, cards: [] }).error === "NOT_DECLARE");
  check("密探不能看自己", act(2, { op: "resolve", seatNo: 2, target: 2 }).error === "BAD_TARGET");
  check("密探看 3 号 → 私密笔记,公开日志无流派;轮到 1 号的密探 5", act(2, { op: "resolve", seatNo: 2, target: 3 }).ok && V(2).seats[2].notes[0].text.includes("仙鹤 2") && !room.log[0].includes("仙鹤") && V(3).seats[2].notes === undefined && room.pending.seat === 1);
  act(1, { op: "resolve", seatNo: 1, target: 4 });
  check("密探阶段结束 → 隐士阶段声明;打出的牌公开在 played 里", room.phaseKey() === "mystic" && room.sub === "declare" && V(3).seats[1].played[0].id === "spy-5" && room.seats[1].hand.length === 1);
  act(1, { op: "declare", seatNo: 1, cards: [] }); act(3, { op: "declare", seatNo: 3, cards: [] }); act(4, { op: "declare", seatNo: 4, cards: [] });
  act(2, { op: "declare", seatNo: 2, cards: ["mystic-3"] });
  check("隐士:看流派 + 随机一张手牌(1 号只剩上忍 1)", act(2, { op: "resolve", seatNo: 2, target: 1 }).ok && V(2).seats[2].notes[1].text.includes("仙鹤 1") && V(2).seats[2].notes[1].text.includes("上忍 1"));
  check("骗徒阶段无人出牌直接到盲眼刺客", (declareAll(t), room.phaseKey() === "blind"));
  declareAll(t, { 3: ["blind-4"] });
  check("盲眼刺客:不能杀自己/死人;杀 4 号 → 4 号有殉道者,弹反应窗(公开目标与凶手)", act(3, { op: "resolve", seatNo: 3, target: 3 }).error === "BAD_TARGET" && act(3, { op: "resolve", seatNo: 3, target: 4 }).ok && room.pending.stage === "react" && V(1).pending.target === 4 && V(1).pending.killer === 3 && V(1).pendingMine === null && V(4).pendingMine.options.join() === "martyr");
  check("反应窗只有目标能答;凶手不能 resolve", act(3, { op: "react", seatNo: 3, cardId: null }).error === "NOT_YOUR_CARD" && act(3, { op: "resolve", seatNo: 3, target: 1 }).error === "NOT_RESOLVE");
  check("翻开殉道者:4 号死亡但得 1 枚标记", act(4, { op: "react", seatNo: 4, cardId: "martyr" }).ok && room.seats[4].dead && tok(room, 4) === 1 && room.seats[4].played.some((c) => c.key === "martyr") && V(1).seats[4].tokenCount === 1 && V(1).seats[4].tokens === undefined);
  check("死人的流派牌仍不公开;进上忍阶段,死人自动跳过声明", V(1).seats[4].house === undefined && room.phaseKey() === "shinobi" && room.seats[4].declared !== null);
  declareAll(t, { 1: ["shinobi-1"] });
  check("上忍:先看后决定;看 3 号写笔记", act(1, { op: "resolve", seatNo: 1, target: 3 }).ok && room.pending.stage === "decide" && V(1).seats[1].notes.at(-1).text.includes("仙鹤 2"));
  check("上忍放过 → 无人死;揭示:存活 仙鹤[1,2] vs 莲花[1] → 比次高,仙鹤胜;仙鹤成员各 1 枚", act(1, { op: "resolve", seatNo: 1, kill: false }).ok && room.phase === "roundEnd" && room.roundResult.winner === "crane" && room.roundResult.reason === "rank" && tok(room, 1) === 1 && tok(room, 3) === 1 && tok(room, 2) === 0 && tok(room, 4) === 1);
  check("轮末全公开流派牌;本人可见分数,他人只见枚数;下一轮重发", V(2).seats[1].house === "crane:1" && V(1).seats[1].points > 0 && V(2).seats[1].points === undefined && act(1, { op: "nextRound" }).ok && room.round === 2 && room.phase === "draft");
}

console.log("\n=== 镜僧 / 判官 / 死人牌作废 / 同号按座位 ===");
{
  const t = mk(4), { room, act, V } = t;
  toNight(t);
  layout(room, { 1: "crane:1", 2: "lotus:1", 3: "crane:2", 4: "lotus:2" }, { 1: ["shinobi-2"], 2: ["mirror", "shinobi-2"], 3: ["judge"], 4: ["martyr", "mirror"] }, 4);
  declareAll(t, { 1: ["shinobi-2"], 2: ["shinobi-2"] });
  check("同号按座位序:1 号先", room.queue.map((q) => q.owner).join() === "1,2");
  act(1, { op: "resolve", seatNo: 1, target: 2 });
  check("上忍杀 2 号 → 反应窗", act(1, { op: "resolve", seatNo: 1, kill: true }).ok && room.pending.stage === "react" && room.pending.target === 2);
  check("不是手里的反应牌拒绝", act(2, { op: "react", seatNo: 2, cardId: "martyr" }).error === "BAD_CARDS");
  check("镜僧反杀:1 号死,2 号活;2 号自己的上忍 2 继续结算", act(2, { op: "react", seatNo: 2, cardId: "mirror" }).ok && room.seats[1].dead && !room.seats[2].dead && room.pending && room.pending.seat === 2 && room.pending.card.id === "shinobi-2");
  act(2, { op: "resolve", seatNo: 2, target: 4 });
  check("2 号上忍杀 4 号 → 4 号两张反应牌可选", act(2, { op: "resolve", seatNo: 2, kill: true }).ok && V(4).pendingMine.options.sort().join() === "martyr,mirror");
  check("4 号不翻 → 直接死", act(4, { op: "react", seatNo: 4, cardId: null }).ok && room.seats[4].dead && room.phase === "roundEnd");
  check("揭示:存活 莲花[1] vs 仙鹤[2] → 莲花胜;已死的莲花 2 也得标记", room.roundResult.winner === "lotus" && tok(room, 2) === 1 && tok(room, 4) === 1 && tok(room, 3) === 0);
}
{
  const t = mk(4), { room, act } = t;
  toNight(t);
  layout(room, { 1: "crane:1", 2: "lotus:1", 3: "crane:2", 4: "lotus:2" }, { 1: ["judge"], 2: ["mirror", "martyr"], 3: ["blind-1"], 4: [] }, 2);
  declareAll(t, { 1: ["judge"] });
  check("判官:亮自己流派牌 + 处决,镜僧/殉道者无效(不弹反应窗)", act(1, { op: "resolve", seatNo: 1, target: 2 }).ok && room.seats[1].revealed && room.viewFor("p3").seats[1].house === "crane:1" && room.seats[2].dead && tok(room, 2) === 0 && room.phaseKey() === "blind");
  declareAll(t, { 3: ["blind-1"] });
  check("盲眼刺客目标不能是死人", act(3, { op: "resolve", seatNo: 3, target: 2 }).error === "BAD_TARGET" && act(3, { op: "resolve", seatNo: 3, target: 4 }).ok && room.seats[4].dead);
}
{
  const t = mk(4), { room, act } = t;
  toNight(t);
  layout(room, { 1: "crane:1", 2: "lotus:1", 3: "crane:2", 4: "lotus:2" }, { 1: ["blind-1"], 2: ["blind-3", "mirror"], 3: [], 4: [] }, 3);
  declareAll(t, { 1: ["blind-1"], 2: ["blind-3"] });
  act(1, { op: "resolve", seatNo: 1, target: 2 });
  check("2 号镜僧反杀 1 号;2 号自己的盲眼刺客 3 仍结算(他还活着)", act(2, { op: "react", seatNo: 2, cardId: "mirror" }).ok && room.seats[1].dead && room.pending.seat === 2);
  act(2, { op: "resolve", seatNo: 2, target: 3 });
  check("3 号死", room.seats[3].dead && room.phaseKey() === "shinobi");
}
{
  const t = mk(4), { room, act } = t;
  toNight(t);
  layout(room, { 1: "crane:1", 2: "lotus:1", 3: "crane:2", 4: "lotus:2" }, { 1: ["blind-1"], 2: ["mirror", "blind-5"], 3: ["blind-3"], 4: [] }, 3);
  declareAll(t, { 1: ["blind-1"], 3: ["blind-3"], 2: ["blind-5"] });
  act(1, { op: "resolve", seatNo: 1, target: 3 });
  check("1 号杀 3 号(无反应牌直接死)→ 3 号已翻开的盲眼刺客 3 作废 → 轮到 2 号", room.seats[3].dead && room.queue[1].void === true && room.pending.seat === 2);
}

console.log("\n=== 骗徒六张 ===");
{
  const t = mk(5), { room, act, V } = t;
  toNight(t);
  layout(room, { 1: "crane:1", 2: "lotus:1", 3: "crane:2", 4: "lotus:2", 5: "ronin" }, { 1: ["shapeshifter"], 2: ["troublemaker"], 3: ["gravedigger"], 4: ["merchant"], 5: ["thief"] }, 2, ["spy-1", "blind-6", "mastermind"]);
  room.seats[2].tokens = [{ id: "ta", v: 4 }, { id: "tb", v: 2 }]; room.seats[4].tokens = [{ id: "tc", v: 3 }];
  declareAll(t, { 1: ["shapeshifter"], 2: ["troublemaker"], 3: ["gravedigger"], 4: ["merchant"], 5: ["thief"] });
  check("队列按编号 1 变形者→2 掘墓人→3 捣乱者→4 通灵商人→5 盗贼", room.queue.map((q) => q.card.key).join() === "shapeshifter,gravedigger,troublemaker,merchant,thief");
  check("变形者:要两个不同座位", act(1, { op: "resolve", seatNo: 1, targets: [2] }).error === "BAD_TARGET" && act(1, { op: "resolve", seatNo: 1, targets: [2, 2] }).error === "BAD_TARGET");
  check("变形者看 2/5 号 → 笔记两张;待决进入决定,只有他看到 info", act(1, { op: "resolve", seatNo: 1, targets: [2, 5] }).ok && V(1).seats[1].notes[0].text.includes("莲花 1") && V(1).seats[1].notes[0].text.includes("浪人") && V(1).pendingMine.info[5] === "ronin" && V(2).pendingMine === null);
  check("对调:2 号变浪人、5 号变莲花 1;两人都看不到自己的流派牌;公开日志不说是否对调", act(1, { op: "resolve", seatNo: 1, swap: true }).ok && room.seats[2].house === "ronin" && room.seats[5].house === "lotus:1" && V(2).seats[2].house === undefined && V(2).seats[2].cantLook === true && V(5).seats[5].house === undefined && room.log[0].includes("只有他知道"));
  check("掘墓人:翻弃牌堆 2 张(只有他看到),弃牌堆剩 1", room.pending.seat === 3 && act(3, { op: "resolve", seatNo: 3 }).ok && V(3).pendingMine.offer.length === 2 && V(1).pendingMine === null && room.discard.length === 1);
  const offer = room.pending.offer.map((c) => c.id);
  check("挑不在两张里的拒绝", act(3, { op: "resolve", seatNo: 3, pick: "nope" }).error === "BAD_PICK");
  const pickId = offer.includes("blind-6") ? "blind-6" : offer[0];
  const r3 = act(3, { op: "resolve", seatNo: 3, pick: pickId, play: pickId === "mastermind" ? "now" : "keep" });
  check("挖出一张留面前:公开 faceUp,弃牌堆回到 2 张(首脑/反应牌即使选立刻打也只能留)", r3.ok && room.seats[3].hand.some((c) => c.id === pickId) && V(1).seats[3].faceUp.map((c) => c.id).join() === pickId && room.discard.length === 2);
  check("捣乱者看 4 号 → 决定公开", act(2, { op: "resolve", seatNo: 2, target: 4 }).ok && room.pending.stage === "decide" && act(2, { op: "resolve", seatNo: 2, reveal: true }).ok && room.seats[4].revealed && V(1).seats[4].house === "lotus:2");
  check("通灵商人:必须选看标记或流派", act(4, { op: "resolve", seatNo: 4, target: 2, look: "x" }).error === "BAD_LOOK");
  check("看 2 号一枚标记 → 笔记有面值;待决带 seen 与对方标记 id", act(4, { op: "resolve", seatNo: 4, target: 2, look: "honor" }).ok && /面值是 [24]/.test(V(4).seats[4].notes.at(-1).text) && V(4).pendingMine.seen && V(4).pendingMine.targetTokens.length === 2);
  const seen = room.pending.seen, seenV = room.seats[2].tokens.find((x) => x.id === seen).v;
  check("交换:给出 tc 拿回看过的那枚;双方枚数不变、面值互换;对方也得到私密笔记", act(4, { op: "resolve", seatNo: 4, give: "tc", take: seen }).ok && tok(room, 4) === 1 && tok(room, 2) === 2 && room.seats[4].tokens[0].v === seenV && room.seats[2].tokens.some((x) => x.id === "tc") && V(2).seats[2].notes.at(-1).text.includes("换走"));
  check("盗贼:亮自己流派牌(现在 5 号是莲花 1);只能从枚数比自己多的人拿", room.pending.seat === 5 && act(5, { op: "resolve", seatNo: 5, target: 3 }).error === "BAD_TARGET" && act(5, { op: "resolve", seatNo: 5, target: 2 }).ok && room.seats[5].revealed && V(1).seats[5].house === "lotus:1" && tok(room, 5) === 1 && tok(room, 2) === 1);
  check("骗徒阶段结束 → 盲眼刺客", room.phaseKey() === "blind");
}
{
  const t = mk(4), { room, act } = t;
  toNight(t);
  layout(room, { 1: "crane:1", 2: "lotus:1", 3: "crane:2", 4: "lotus:2" }, { 1: ["gravedigger"], 2: [], 3: [], 4: [] }, 2, ["spy-1"]);
  declareAll(t, { 1: ["gravedigger"] });
  act(1, { op: "resolve", seatNo: 1 });
  check("弃牌堆只有 1 张就翻 1 张;立刻打出过去阶段的密探 → 插进队列马上结算", room.pending.offer.length === 1 && act(1, { op: "resolve", seatNo: 1, pick: "spy-1", play: "now" }).ok && room.pending.card.id === "spy-1" && room.pending.seat === 1);
  check("密探结算 → 进下一阶段", act(1, { op: "resolve", seatNo: 1, target: 2 }).ok && room.phaseKey() === "blind" && room.seats[1].played.map((c) => c.id).join() === "gravedigger,spy-1");
  layout(room, { 1: "crane:1", 2: "lotus:1", 3: "crane:2", 4: "lotus:2" }, { 1: ["gravedigger"], 2: [], 3: [], 4: [] }, 2, []);
  declareAll(t, { 1: ["gravedigger"] });
  check("弃牌堆空:掘墓人无效果", room.phaseKey() === "blind" || (act(1, { op: "resolve", seatNo: 1 }).ok && room.phaseKey() === "blind"));
}
{
  const t = mk(4), { room, act } = t;
  toNight(t);
  layout(room, { 1: "crane:1", 2: "lotus:1", 3: "crane:2", 4: "lotus:2" }, { 1: ["thief"], 2: [], 3: [], 4: [] }, 2);
  declareAll(t, { 1: ["thief"] });
  check("盗贼没人比他多:只亮牌不拿", act(1, { op: "resolve", seatNo: 1 }).ok && room.seats[1].revealed && tok(room, 1) === 0 && room.phaseKey() === "blind");
  layout(room, { 1: "crane:1", 2: "lotus:1", 3: "crane:2", 4: "lotus:2" }, { 1: ["shapeshifter"], 2: [], 3: [], 4: [] }, 2);
  room.seats[2].revealed = true;
  declareAll(t, { 1: ["shapeshifter"] });
  check("变形者不能选已公开流派牌的人", act(1, { op: "resolve", seatNo: 1, targets: [2, 3] }).error === "BAD_TARGET" && act(1, { op: "resolve", seatNo: 1, targets: [1, 3] }).ok);
  check("可以把自己算进去并不对调", act(1, { op: "resolve", seatNo: 1, swap: false }).ok && room.seats[1].house === "crane:1" && !room.seats[1].cantLook);
}

console.log("\n=== 揭示 / 计分 / 首脑 / 浪人 / 胜利 ===");
{
  const t = mk(5), { room, act, V } = t;
  toNight(t);
  layout(room, { 1: "crane:1", 2: "lotus:1", 3: "crane:2", 4: "lotus:2", 5: "ronin" }, { 1: [], 2: [], 3: [], 4: [], 5: [] }, 4);
  room.seats[1].dead = true;
  skipToReveal(t);
  check("存活 仙鹤[2] vs 莲花[1,2] → 莲花胜;莲花两人 + 存活浪人各 1 枚", room.roundResult.winner === "lotus" && tok(room, 2) === 1 && tok(room, 4) === 1 && tok(room, 5) === 1 && tok(room, 1) === 0 && tok(room, 3) === 0);
  act(1, { op: "nextRound" });
  layout(room, { 1: "crane:1", 2: "lotus:1", 3: "crane:2", 4: "lotus:2", 5: "ronin" }, { 1: [], 2: [], 3: [], 4: [], 5: [] }, 4);
  room.seats[1].dead = true; room.seats[2].dead = true; room.seats[5].dead = true;
  skipToReveal(t);
  check("存活 仙鹤[2] vs 莲花[2] 完全平手 → 没有流派获胜,存活者各 1 枚;死掉的浪人没有", room.roundResult.reason === "tie" && room.roundResult.winner === null && tok(room, 3) === 1 && tok(room, 4) === 2 && tok(room, 5) === 1);
  act(1, { op: "nextRound" });
  layout(room, { 1: "crane:1", 2: "lotus:1", 3: "crane:2", 4: "lotus:2", 5: "ronin" }, { 1: [], 2: [], 3: [], 4: [], 5: [] }, 4);
  for (const n of [1, 2, 3, 4]) room.seats[n].dead = true;
  skipToReveal(t);
  check("两派全灭:没有流派获胜;浪人存活得 1 枚", room.roundResult.reason === "none" && tok(room, 5) === 2 && room.roundResult.awarded.length === 1);
  act(1, { op: "nextRound" });
  layout(room, { 1: "crane:1", 2: "lotus:1", 3: "crane:2", 4: "lotus:2", 5: "ronin" }, { 1: [], 2: [], 3: ["mastermind"], 4: [], 5: [] }, 4);
  room.seats[1].dead = true;
  skipToReveal(t);
  check("首脑:3 号(仙鹤 2)存活自动亮出 → 仙鹤胜(本该莲花 1 赢)", room.roundResult.reason === "mastermind" && room.roundResult.winner === "crane" && room.roundResult.mastermind === 3 && room.seats[3].played.some((c) => c.key === "mastermind"));
  act(1, { op: "nextRound" });
  layout(room, { 1: "crane:1", 2: "lotus:1", 3: "crane:2", 4: "lotus:2", 5: "ronin" }, { 1: [], 2: [], 3: [], 4: [], 5: ["mastermind"] }, 4);
  const before = [1, 2, 3, 4].map((n) => tok(room, n)).join();
  skipToReveal(t);
  check("浪人亮首脑:没有流派获胜,其他人不得分;浪人自己因存活得 1 枚", room.roundResult.winner === null && room.roundResult.reason === "mastermind" && [1, 2, 3, 4].map((n) => tok(room, n)).join() === before && tok(room, 5) === 4);
  act(1, { op: "nextRound" });
  layout(room, { 1: "crane:1", 2: "lotus:1", 3: "crane:2", 4: "lotus:2", 5: "ronin" }, { 1: [], 2: [], 3: ["mastermind"], 4: [], 5: [] }, 4);
  room.seats[3].dead = true;
  skipToReveal(t);
  check("死掉的首脑不生效:莲花 1 赢", room.roundResult.reason === "rank" && room.roundResult.winner === "lotus");
  check("历史每轮一条;轮末 roundResult 不含面值", room.history.length === 6 && JSON.stringify(V(1).roundResult).indexOf('"v"') < 0);
}
{
  const t = mk(4, 1, { points: 3, tokens: { 2: 0, 3: 1, 4: 0 } }), { room, act, V } = t;
  toNight(t);
  layout(room, { 1: "crane:1", 2: "lotus:1", 3: "crane:2", 4: "lotus:2" }, { 1: [], 2: [], 3: [], 4: [] }, 4);
  skipToReveal(t);
  check("标记堆只有 1 枚:仙鹤 1 号拿到,3 号拿不到(日志提示);1 号 3 分达标 → 终局,分数全公开", room.phase === "over" && room.result.winners.join() === "1" && room.result.points[1] === 3 && tok(room, 3) === 0 && V(2).result.points[1] === 3 && room.log.some((l) => l.includes("已空")));
  check("终局不能 nextRound;newGame 回准备清标记", act(1, { op: "nextRound" }).error === "NOT_ROUND_END" && act(1, { op: "newGame" }).ok && room.phase === "setup" && tok(room, 1) === 0);
}
{
  const t = mk(4, 1, { points: 4, tokens: { 2: 10, 3: 0, 4: 0 } }), { room } = t;
  toNight(t);
  layout(room, { 1: "crane:1", 2: "lotus:1", 3: "crane:2", 4: "lotus:2" }, { 1: [], 2: [], 3: [], 4: [] }, 4);
  room.seats[1].tokens = [{ id: "x", v: 2 }]; room.seats[3].tokens = [{ id: "y", v: 2 }];
  skipToReveal(t);
  check("同轮两人同时到 4 分 → 共享胜利", room.phase === "over" && room.result.winners.join() === "1,3");
}

console.log("\n=== 牌名版本(房规,只影响显示/日志)===");
check("四套牌名,默认用户版 iga;每套 13 张牌 + 3 流派都有名", Object.keys(NAME_SETS).join() === "iga,cn,manual,official" && DEFAULT_NAMES === "iga" && Object.values(NAME_SETS).every((st) => CARDS.every((c) => st.cards[c.key]) && st.houses.crane && st.houses.lotus && st.houses.ronin));
check("名字函数:iga 伊贺 2 / 百变者 / 刺客 3 / 大将军;cn 仙鹤 2 / 百变者;manual 灵魂商贩 / 首脑;official 变形者", houseNameIn("iga", "crane:2") === "伊贺 2" && cardNameIn("iga", { key: "shapeshifter", num: 1 }) === "百变者" && cardNameIn("manual", { key: "merchant" }) === "灵魂商贩" && cardNameIn("manual", { key: "mastermind" }) === "首脑" && cardNameIn("iga", { key: "blind", num: 3 }) === "刺客 3" && cardNameIn("iga", { key: "mastermind" }) === "大将军" && houseNameIn("cn", "crane:2") === "仙鹤 2" && cardNameIn("cn", { key: "shapeshifter", num: 1 }) === "百变者" && cardNameIn("official", { key: "shapeshifter", num: 1 }) === "变形者" && phaseNameIn("iga", "blind") === "刺客" && phaseNameIn("iga", "trickster") === "骗徒");
{
  const t = mk(4), { room, act, V } = t;
  check("默认(未改)是 iga;非法版本拒绝", new NinjaCore("x", 4).config.names === "iga" && act(1, { op: "setConfig", config: { names: "nope" } }).error === "BAD_CONFIG" && act(1, { op: "setConfig", config: { names: "iga" } }).ok && V(1).config.names === "iga");
  toNight(t);
  layout(room, { 1: "crane:1", 2: "lotus:1", 3: "crane:2", 4: "lotus:2" }, { 1: ["spy-1"], 2: [], 3: [], 4: [] }, 0);
  check("开局日志与阶段名用用户版名字", room.log.some((l) => l.includes("伊贺 1")) && room.log[0].includes("密探阶段"));
  declareAll(t, { 1: ["spy-1"] });
  check("笔记与日志按用户版:伊贺/刺客阶段", act(1, { op: "resolve", seatNo: 1, target: 3 }).ok && V(1).seats[1].notes[0].text.includes("伊贺 2") && (declareAll(t), declareAll(t), declareAll(t), room.log.some((l) => l.includes("刺客阶段"))));
  room.seats[2].dead = true; room.seats[4].dead = true;
  skipToReveal(t);
  check("揭示日志用用户版派名:伊贺派获胜", room.log[0].includes("伊贺派获胜") && room.log[0].includes("甲贺派 ["));
}

console.log("\n=== 持久化 ===");
{
  const t = mk(6, 11), { room, act } = t;
  toNight(t);
  declareAll(t, {});
  const saved = JSON.parse(JSON.stringify(room.serialize()));
  const back = NinjaCore.hydrate(saved, lcg(9));
  check("序列化/回灌:阶段、流派、手牌、弃牌堆、标记堆、持有者一致", back.phase === room.phase && back.phaseKey() === room.phaseKey() && back.seats[1].house === room.seats[1].house && back.seats[1].hand.map((c) => c.id).join() === room.seats[1].hand.map((c) => c.id).join() && back.discard.length === room.discard.length && back.tokenPool.length === room.tokenPool.length && back.isHolder("p1", 1) && back.config.points === 10);
  check("回灌后可继续声明", back.action("p1", { op: "declare", seatNo: 1, cards: [] }).ok);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
