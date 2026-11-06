// 阿瓦隆房间 "可执行规格" —— 人数表/配置校验/开局信息/投票与否决/任务卡约束/王者之剑/湖中仙女/揭示者/刺杀/兰斯洛特变体/保密/持久化
// 复用与真实 Workers 同一份核心逻辑(./shared/avalon-logic.mjs)。
// node prototype/avalon/avalon-sim.mjs

import { AvalonCore } from "./shared/avalon-logic.mjs";
import { ROLES, ROLE_BY_KEY, PLAYERS, twoFails, defaultRoles } from "./shared/avalon-data.mjs";

let passed = 0, failed = 0;
function check(name, cond, detail = "") {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail ? "  <- " + detail : ""}`); }
}
function lcg(seed) { let x = seed >>> 0; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); }

function mk(n, roles, seed = 1, config) {
  const room = new AvalonCore("1234", n, lcg(seed));
  const dev = {}; for (let i = 1; i <= n; i++) { dev[i] = `p${i}`; room.claimSeat(dev[i], i); }
  if (roles) room.action(dev[1], { op: "setRoles", roles });
  if (config) room.action(dev[1], { op: "setConfig", config });
  return { room, dev, V: (i) => room.viewFor(dev[i]), act: (i, o) => room.action(dev[i], o) };
}
// 开局后强行摆一副已知身份(seatRoles 按座位 1..N),重算开局信息并回到第 1 任务
function layout(room, seatRoles, leader = 1) {
  room.seatNos().forEach((n, i) => { room.seats[n].role = seatRoles[i]; room.seats[n].img = ROLE_BY_KEY[seatRoles[i]].img[0]; room.seats[n].notes = []; room.seats[n].revealedRole = null; room.seats[n].card = null; room.seats[n].vote = null; });
  room.roles = seatRoles.slice();
  room.leader = leader;
  if (room.lady) room.lady = { holder: room._prev(leader), used: [], history: [] };
  if (room.lancelot) { room.lancelot.drawn = []; room.lancelot.switched = false; if (room.lancelot.mode === "random") room.lancelot.deck = ["no", "switch", "no", "no", "no", "switch"]; if (room.lancelot.mode === "preset") room.lancelot.deck = ["no", "switch", "no", "switch", "no"]; }
  for (const q of room.quests) Object.assign(q, { leader: null, team: [], excalibur: null, sub: null, cards: null, fails: null, result: null, played: null, excaliburUse: null });
  room.history = []; room.result = null;
  room._computeKnows();
  room._beginQuest(1);
}
// 一次完整的"提议→全员赞成→出卡"
function runQuest(room, act, team, cards, opts = {}) {
  const r0 = act(room.leader, { op: "propose", team, excalibur: opts.excalibur ?? null }); if (r0.error) return r0;
  for (const n of room.seatNos()) act(n, { op: "vote", seatNo: n, approve: !(opts.reject || []).includes(n) });
  if (room.phase !== "quest") return { phase: room.phase };
  for (const n of team) { const r = act(n, { op: "questCard", seatNo: n, card: cards[n] || "success" }); if (r.error) return r; }
  const q = room.quests[room.questNo - 1];
  if (room.phase === "quest" && q.sub === "excalibur") { const r = act(q.excalibur, { op: "excalibur", seatNo: q.excalibur, target: opts.useExcalibur ?? null }); if (r.error) return r; }
  return { ok: true };
}

console.log("\n=== 数据 ===");
check("16 个角色,键唯一", ROLES.length === 16 && new Set(ROLES.map((r) => r.key)).size === 16);
check("人数表 5~10:好/坏 3:2 4:2 4:3 5:3 6:3 6:4", [5, 6, 7, 8, 9, 10].map((n) => PLAYERS[n].good + ":" + PLAYERS[n].evil).join(" ") === "3:2 4:2 4:3 5:3 6:3 6:4");
check("任务人数表(对照实体版图)", [5, 6, 7, 8, 9, 10].map((n) => PLAYERS[n].quests.join("")).join(" ") === "23233 23434 23344 34455 34455 34455");
check("7 人起第 4 任务需两张失败", !twoFails(6, 4) && twoFails(7, 4) && twoFails(10, 4) && !twoFails(10, 3));
check("推荐配置 5~10 人:张数=人数、坏人数对表", [5, 6, 7, 8, 9, 10].every((n) => defaultRoles(n).length === n && defaultRoles(n).filter((k) => ROLE_BY_KEY[k].team === "evil").length === PLAYERS[n].evil));
check("每个角色都有卡图文件名", ROLES.every((r) => Array.isArray(r.img) && r.img.length >= 1));

console.log("\n=== 准备阶段 / 配置校验 ===");
{
  const { room, act } = mk(7);
  check("5~10 座", AvalonCore.MIN_SEATS === 5 && AvalonCore.MAX_SEATS === 10);
  check("默认 7 人推荐配置", room.roles.join(",") === defaultRoles(7).join(","));
  check("角色超上限拒绝(2 梅林)", act(1, { op: "setRoles", roles: ["merlin", "merlin", "servant", "servant", "assassin", "minion", "minion"] }).error === "ROLE_MAX");
  check("张数≠人数不能开局", act(1, { op: "setRoles", roles: ["merlin", "assassin"] }).ok && act(1, { op: "startGame" }).error === "DECK_SIZE");
  check("坏人数不对不能开局(7 人要 3 坏)", act(1, { op: "setRoles", roles: ["merlin", "percival", "servant", "servant", "servant", "morgana", "assassin"] }).ok && act(1, { op: "startGame" }).error === "EVIL_COUNT");
  check("兰斯洛特必须成对", act(1, { op: "setRoles", roles: ["merlin", "percival", "servant", "lancelot_good", "morgana", "assassin", "minion"] }).ok && act(1, { op: "startGame" }).error === "LANCELOT_PAIR");
  check("莫甘娜需要派西维尔", act(1, { op: "setRoles", roles: ["merlin", "servant", "servant", "servant", "morgana", "assassin", "minion"] }).ok && act(1, { op: "startGame" }).error === "MORGANA_NEEDS_PERCIVAL");
  check("梅林需要刺客", act(1, { op: "setRoles", roles: ["merlin", "servant", "servant", "servant", "minion", "minion", "minion"] }).ok && act(1, { op: "startGame" }).error === "MERLIN_NEEDS_ASSASSIN");
  check("配置:兰斯洛特模式校验", act(1, { op: "setConfig", config: { lancelot: "foo" } }).error === "BAD_CONFIG" && act(1, { op: "setConfig", config: { lancelot: "random", lady: true, excalibur: true } }).ok && room.config.lady === true);
  check("牌堆=推荐配置时加减座位自动跟随;手动改过则不动", act(1, { op: "recommendRoles" }).ok && room.addSeat("p1").ok && room.roles.length === 8 && room.roles.join() === defaultRoles(8).join() && room.removeSeat("p1").ok && act(1, { op: "setRoles", roles: ["merlin", "percival", "servant", "servant", "mordred", "morgana", "assassin"] }).ok && room.addSeat("p1").ok && room.roles.length === 7 && room.removeSeat("p1").ok);
  check("准备页视图带 rolesCheck 与人数表", room.viewFor("p1").rolesCheck.ok && room.viewFor("p1").table.evil === 3);
  check("推荐配置可开局;开局后不能加座位", act(1, { op: "recommendRoles" }).ok && act(1, { op: "startGame" }).ok && room.phase === "teamBuild" && room.addSeat("p1").error === "NOT_SETUP");
  check("开局:每人有角色和卡图;忠臣卡图轮用不重复", room.seatNos().every((n) => room.seats[n].role && room.seats[n].img) && new Set(room.seatNos().filter((n) => room.seats[n].role === "servant").map((n) => room.seats[n].img)).size === 2);
}

console.log("\n=== 开局信息(10 人:梅林/派西维尔/忠臣×4/莫德雷德/莫甘娜/奥伯伦/刺客)===");
{
  const { room, act, V } = mk(10);
  act(1, { op: "startGame" });
  layout(room, ["merlin", "percival", "servant", "servant", "servant", "servant", "mordred", "morgana", "oberon", "assassin"], 3);
  const knows = (n) => V(n).seats[n].knows.map((k) => k.seat).join(",");
  check("梅林看到 莫甘娜/奥伯伦/刺客,看不到莫德雷德", knows(1) === "8,9,10" && V(1).seats[1].info.includes("莫德雷德"));
  check("派西维尔看到 梅林+莫甘娜,标签不分", knows(2) === "1,8" && V(2).seats[2].knows.every((k) => k.tag === "梅林或莫甘娜"));
  check("忠臣什么都不知道", knows(3) === "" && V(3).seats[3].info == null);
  check("莫德雷德看到 莫甘娜/刺客,看不到奥伯伦", knows(7) === "8,10" && V(7).seats[7].info.includes("奥伯伦"));
  check("刺客看到 莫德雷德/莫甘娜", knows(10) === "7,8");
  check("奥伯伦谁都不认识", knows(9) === "" && V(9).seats[9].info.includes("不知道"));
  check("保密:别人看不到我的角色/信息/卡图", V(3).seats[1].role === undefined && V(3).seats[1].knows === undefined && V(3).seats[1].img === undefined);
  check("首任队长 3 号公开", V(5).leader === 3 && V(5).seats[3].leader === true);
}

console.log("\n=== 投票 / 否决 / 5 连否决 ===");
{
  const { room, act, V } = mk(5);
  act(1, { op: "startGame" });
  layout(room, ["merlin", "percival", "servant", "morgana", "assassin"], 1);
  check("第 1 任务 2 人", room.questNo === 1 && room.quests[0].size === 2);
  check("非队长不能提议", act(2, { op: "propose", team: [1, 2] }).error === "NOT_LEADER");
  check("人数不对/重复座位拒绝", act(1, { op: "propose", team: [1] }).error === "BAD_TEAM" && act(1, { op: "propose", team: [1, 1] }).error === "BAD_TEAM");
  check("队长提议 → 投票阶段,队伍公开", act(1, { op: "propose", team: [2, 1] }).ok && room.phase === "vote" && V(3).proposal.team.join() === "1,2" && V(3).seats[2].onTeam);
  check("投票:只能投自己持有的座位", act(2, { op: "vote", seatNo: 3, approve: true }).error === "NOT_HOLDER");
  act(1, { op: "vote", seatNo: 1, approve: true }); act(2, { op: "vote", seatNo: 2, approve: false });
  check("投票中:他人只见是否已投,不见票面", V(3).seats[1].voted === true && V(3).seats[1].vote === undefined && V(3).proposal.votedCount === 2);
  check("可改票", act(2, { op: "vote", seatNo: 2, approve: true }).ok && room.seats[2].vote === true);
  act(3, { op: "vote", seatNo: 3, approve: false }); act(4, { op: "vote", seatNo: 4, approve: false }); act(5, { op: "vote", seatNo: 5, approve: false });
  check("2:3 否决 → 队长传给 2 号,否决计数 1,票面进 history 公开", room.phase === "teamBuild" && room.leader === 2 && room.voteTrack === 1 && V(5).history[0].approved === false && V(5).history[0].votes[1] === true && V(5).history[0].votes[3] === false);
  // 平票=否决(5 人 2:3 已测;再测 6 人 3:3)
  for (let i = 0; i < 3; i++) { act(room.leader, { op: "propose", team: [1, 2] }); for (const n of [1, 2, 3, 4, 5]) act(n, { op: "vote", seatNo: n, approve: false }); }
  check("否决 4 次后队长回到 5 号", room.voteTrack === 4 && room.leader === 5 && room.phase === "teamBuild");
  act(5, { op: "propose", team: [1, 2] }); for (const n of [1, 2, 3, 4, 5]) act(n, { op: "vote", seatNo: n, approve: false });
  check("第 5 次否决 → 坏人胜,结算公开全部身份", room.phase === "over" && room.result.winner === "evil" && room.result.reason.includes("5 次") && V(3).seats[4].role === "morgana" && V(3).seats[4].team === "evil" && room.result.winners.join() === "4,5");
}
{
  const { room, act } = mk(6);
  act(1, { op: "startGame" });
  layout(room, ["merlin", "percival", "servant", "servant", "morgana", "assassin"], 1);
  act(1, { op: "propose", team: [1, 2] }); [1, 2, 3].forEach((n) => act(n, { op: "vote", seatNo: n, approve: true })); [4, 5, 6].forEach((n) => act(n, { op: "vote", seatNo: n, approve: false }));
  check("3:3 平票 = 否决", room.phase === "teamBuild" && room.voteTrack === 1);
  act(2, { op: "propose", team: [1, 2] }); [1, 2, 3, 4].forEach((n) => act(n, { op: "vote", seatNo: n, approve: true })); [5, 6].forEach((n) => act(n, { op: "vote", seatNo: n, approve: false }));
  check("4:2 通过 → 任务阶段,否决计数清零", room.phase === "quest" && room.voteTrack === 0 && room.quests[0].team.join() === "1,2" && room.quests[0].leader === 2);
}

console.log("\n=== 任务卡 / 两张失败 / 刺杀 ===");
{
  const { room, act, V } = mk(7);
  act(1, { op: "startGame" });
  layout(room, ["merlin", "percival", "servant", "servant", "morgana", "oberon", "assassin"], 1);
  act(1, { op: "propose", team: [1, 5] }); for (const n of room.seatNos()) act(n, { op: "vote", seatNo: n, approve: true });
  check("非队员不能出卡;好人不能出失败", act(3, { op: "questCard", seatNo: 3, card: "success" }).error === "NOT_ON_TEAM" && act(1, { op: "questCard", seatNo: 1, card: "fail" }).error === "CARD_NOT_ALLOWED" && V(1).seats[1].allowed.join() === "success" && V(5).seats[5].allowed.join() === "success,fail");
  check("出卡后他人只见已出", act(1, { op: "questCard", seatNo: 1, card: "success" }).ok && V(3).seats[1].played === true && V(3).seats[1].card === undefined && V(3).quests[0].playedCount === 1);
  check("坏人出失败 → 第 1 任务失败(1 张即可),卡面只公开张数", act(5, { op: "questCard", seatNo: 5, card: "fail" }).ok && room.quests[0].result === "fail" && room.quests[0].fails === 1 && V(3).quests[0].cards.sort().join() === "fail,success" && V(3).quests[0].played === null);
  check("自动进入第 2 任务,队长顺时针", room.phase === "teamBuild" && room.questNo === 2 && room.leader === 2);
  check("第 2 任务 3 人:成功", runQuest(room, act, [1, 2, 3], {}).ok && room.quests[1].result === "success" && room.questNo === 3);
  check("第 3 任务:成功", runQuest(room, act, [1, 2, 3], {}).ok && room.quests[2].result === "success" && room.questNo === 4);
  check("第 4 任务 4 人需两张失败:只有 1 张失败 → 成功 → 三胜进入刺杀", room.quests[3].twoFails && runQuest(room, act, [1, 2, 3, 5], { 5: "fail" }).ok && room.quests[3].result === "success" && room.quests[3].fails === 1 && room.phase === "assassin");
  check("刺杀阶段:坏人看到刺客座位,好人看不到", V(5).assassin.seat === 7 && V(7).assassin.seat === 7 && V(1).assassin.seat === null);
  check("只有刺客能指认", act(5, { op: "assassinate", target: 1 }).error === "NOT_HOLDER");
  check("刺客指错 → 好人胜", act(7, { op: "assassinate", target: 2 }).ok && room.phase === "over" && room.result.winner === "good" && room.result.assassinTarget === 2 && room.result.winners.join() === "1,2,3,4");
  // 刺中
  act(1, { op: "newGame" }); act(1, { op: "startGame" });
  layout(room, ["merlin", "percival", "servant", "servant", "morgana", "oberon", "assassin"], 1);
  for (let i = 0; i < 3; i++) runQuest(room, act, i === 0 ? [1, 2] : [1, 2, 3], {});
  check("三连胜后刺客指中梅林 → 坏人胜", room.phase === "assassin" && act(7, { op: "assassinate", target: 1 }).ok && room.result.winner === "evil" && room.result.reason.includes("刺中"));
  // 三败
  act(1, { op: "newGame" }); act(1, { op: "startGame" });
  layout(room, ["merlin", "percival", "servant", "servant", "morgana", "oberon", "assassin"], 1);
  runQuest(room, act, [5, 1], { 5: "fail" }); runQuest(room, act, [5, 1, 2], { 5: "fail" });
  check("第 4 任务两张失败才败:2 张 → 失败 → 三败坏人胜", (runQuest(room, act, [1, 2, 3], {}), runQuest(room, act, [5, 6, 1, 2], { 5: "fail", 6: "fail" }), room.quests[3].result === "fail" && room.phase === "over" && room.result.winner === "evil"));
  check("结算后谁出了什么公开", V(1).quests[3].played[5] === "fail" && V(1).quests[3].played[1] === "success");
}

console.log("\n=== 王者之剑 / 湖中仙女 / 骗子·捣蛋鬼 / 揭示者 / 疯子·蛮兵 / 牧师 ===");
{
  const { room, act, V } = mk(8, null, 3, { lady: true, excalibur: true });
  act(1, { op: "setRoles", roles: ["merlin", "percival", "cleric", "troublemaker", "servant", "trickster", "lunatic", "assassin"] });
  check("Big Box 8 人配置可开局", act(1, { op: "startGame" }).ok);
  layout(room, ["merlin", "percival", "cleric", "troublemaker", "servant", "trickster", "lunatic", "assassin"], 4);
  check("湖中仙女开局在队长右手边(3 号)", room.lady.holder === 3 && V(1).seats[3].lady === true);
  check("牧师看到首任队长(捣蛋鬼)显示为坏人", V(3).seats[3].info.includes("4号") && V(3).seats[3].info.includes("坏人"));
  check("王者之剑:必须给队内非队长", act(4, { op: "propose", team: [4, 6, 1] }).error === "BAD_EXCALIBUR" && act(4, { op: "propose", team: [4, 6, 1], excalibur: 4 }).error === "BAD_EXCALIBUR" && act(4, { op: "propose", team: [4, 6, 1], excalibur: 1 }).ok && V(2).seats[1].excalibur === true);
  for (const n of room.seatNos()) act(n, { op: "vote", seatNo: n, approve: true });
  act(4, { op: "questCard", seatNo: 4, card: "success" }); act(1, { op: "questCard", seatNo: 1, card: "success" }); act(6, { op: "questCard", seatNo: 6, card: "fail" });
  check("全员出卡后进入王者之剑子阶段,不结算", room.phase === "quest" && room.quests[0].sub === "excalibur" && room.quests[0].result === null);
  check("持剑者换掉 6 号的卡 → 失败变成功,私密笔记记录原卡", act(1, { op: "excalibur", seatNo: 1, target: 6 }).ok && room.quests[0].result === "success" && V(1).seats[1].notes[0].includes("6号") && V(1).seats[1].notes[0].includes("失败") && V(2).seats[1].notes === undefined && V(2).quests[0].excaliburUse.target === 6 && V(2).quests[0].excaliburUse.original === undefined);
  // 第 2 任务:疯子必须出失败;蛮兵限制单测
  check("疯子只能出失败", room.questNo === 2 && room.allowedCards(7).join() === "fail");
  check("第 2 任务 4 人(含疯子)→ 失败;然后进入湖中仙女阶段", (() => { const r = runQuest(room, act, [7, 1, 2, 3], { 7: "fail" }, { excalibur: 1 }); return r.ok && room.quests[1].result === "fail" && room.phase === "lady"; })());
  check("湖中仙女:只有持有者能验;不能验自己", act(1, { op: "ladyCheck", target: 6 }).error === "NOT_HOLDER" && act(3, { op: "ladyCheck", target: 3 }).error === "BAD_TARGET");
  check("验骗子(坏)显示为好人,结果只有验人者可见,标记交给被验者", act(3, { op: "ladyCheck", target: 6 }).ok && V(3).seats[3].notes[0].includes("好人") && V(6).seats[3].notes === undefined && room.lady.holder === 6 && room.lady.used.join() === "3" && V(1).lady.history[0].target === 6 && room.questNo === 3);
  runQuest(room, act, [1, 2, 3, 5], {}, { excalibur: 1 });
  check("第 3 任务成功后再到湖中仙女:6 号不能回验 3 号", room.phase === "lady" && act(6, { op: "ladyCheck", target: 3 }).error === "LADY_USED");
  check("验捣蛋鬼(好)显示为坏人", act(6, { op: "ladyCheck", target: 4 }).ok && V(6).seats[6].notes.at(-1).includes("坏人") && room.questNo === 4);
  // 揭示者 + 蛮兵:另开一局
  const g2 = mk(7, ["merlin", "percival", "servant", "servant", "revealer", "brute", "assassin"], 5);
  g2.act(1, { op: "startGame" });
  layout(g2.room, ["merlin", "percival", "servant", "servant", "revealer", "brute", "assassin"], 1);
  runQuest(g2.room, g2.act, [6, 1], { 6: "fail" });
  check("蛮兵前三个任务可出失败", g2.room.quests[0].result === "fail" && g2.room.seats[5].revealedRole === null);
  runQuest(g2.room, g2.act, [5, 1, 2], { 5: "fail" });
  check("第二次失败 → 揭示者身份自动公开", g2.room.quests[1].result === "fail" && g2.V(1).seats[5].revealedRole === "revealer" && g2.V(1).seats[5].role === undefined);
  runQuest(g2.room, g2.act, [1, 2, 3], {});
  check("蛮兵第 4 任务只能出成功", g2.room.questNo === 4 && g2.room.allowedCards(6).join() === "success" && g2.act(g2.room.leader, { op: "propose", team: [6, 1, 2, 3] }).ok);
}

console.log("\n=== 兰斯洛特:默认互知 / 变体 1 随机互换 / 变体 2 预置 ===");
{
  const { room, act, V } = mk(7, ["merlin", "percival", "servant", "lancelot_good", "morgana", "lancelot_evil", "assassin"], 1, { lancelot: "know" });
  act(1, { op: "startGame" });
  layout(room, ["merlin", "percival", "servant", "lancelot_good", "morgana", "lancelot_evil", "assassin"], 1);
  check("默认:两位兰斯洛特互知;坏兰斯洛特与其他坏人互认;梅林看到坏兰斯洛特", V(4).seats[4].knows.some((k) => k.seat === 6 && k.tag.includes("兰斯洛特")) && V(6).seats[6].knows.map((k) => k.seat).sort().join() === "4,5,7" && V(5).seats[5].knows.map((k) => k.seat).join() === "6,7" && V(1).seats[1].knows.map((k) => k.seat).join() === "5,6,7");
  check("默认模式没有阵营卡", room.lancelot.mode === "know" && room.lancelot.drawn.length === 0 && V(1).lancelot.switched === false);
}
{
  const { room, act, V } = mk(7, ["merlin", "percival", "servant", "lancelot_good", "morgana", "lancelot_evil", "assassin"], 1, { lancelot: "random" });
  act(1, { op: "startGame" });
  layout(room, ["merlin", "percival", "servant", "lancelot_good", "morgana", "lancelot_evil", "assassin"], 1); // deck: no,switch,no,no,no,switch
  check("变体:两人不互知;坏兰斯洛特不认识其他坏人,其他坏人认识他", V(4).seats[4].knows.length === 0 && V(6).seats[6].knows.length === 0 && V(6).seats[6].info.includes("变体") && V(5).seats[5].knows.map((k) => k.seat).join() === "6,7");
  check("第 1 任务翻「不变」,公开", room.lancelot.drawn.join() === "no" && V(3).lancelot.drawn.join() === "no" && !room.lancelot.switched);
  check("好兰斯洛特此时只能出成功", room.allowedCards(4).join() === "success" && room.allowedCards(6).join() === "success,fail");
  runQuest(room, act, [4, 1], {});
  check("第 2 任务翻「互换」→ 阵营对调:好兰斯洛特能出失败、坏兰斯洛特只能出成功;teamNow 对调", room.questNo === 2 && room.lancelot.drawn.join() === "no,switch" && room.lancelot.switched && room.allowedCards(4).join() === "success,fail" && room.allowedCards(6).join() === "success" && room.teamNow(4) === "evil" && room.teamNow(6) === "good");
  runQuest(room, act, [4, 1, 2], { 4: "fail" });
  check("互换后的好兰斯洛特出失败 → 任务失败", room.quests[1].result === "fail");
  runQuest(room, act, [5, 2, 3], { 5: "fail" }); runQuest(room, act, [1, 2, 3, 4], {}); runQuest(room, act, [1, 2, 3, 4], {});
  check("5 个任务各翻一张(第 6 张不翻);2 胜 2 败后第 5 任务成功 → 刺杀", room.lancelot.drawn.length === 5 && room.lancelot.deck.length === 1 && room.phase === "assassin");
  act(7, { op: "assassinate", target: 2 });
  check("结算:兰斯洛特按互换后的阵营计胜负(4 号现在是坏人,6 号是好人)", room.phase === "over" && room.result.winner === "good" && room.result.teams[4] === "evil" && room.result.teams[6] === "good" && room.result.winners.includes(6) && !room.result.winners.includes(4));
}
{
  const { room, act, V } = mk(7, ["merlin", "percival", "servant", "lancelot_good", "morgana", "lancelot_evil", "assassin"], 1, { lancelot: "preset" });
  act(1, { op: "startGame" });
  layout(room, ["merlin", "percival", "servant", "lancelot_good", "morgana", "lancelot_evil", "assassin"], 1); // preset: no,switch,no,switch,no
  check("变体 2:5 张预置公开;第 1 任务不变", V(3).lancelot.preset.join() === "no,switch,no,switch,no" && !room.lancelot.switched);
  runQuest(room, act, [4, 1], {});
  check("第 2 任务互换", room.lancelot.switched === true);
  runQuest(room, act, [5, 2, 3], { 5: "fail" }); runQuest(room, act, [1, 2, 3], {});
  check("第 3 任务不变(仍互换态)、第 4 任务再换回来", room.questNo === 4 && room.lancelot.switched === false && room.allowedCards(4).join() === "success");
}

console.log("\n=== 持久化 / 新一局 ===");
{
  const { room, act } = mk(6, null, 9, { lady: true });
  act(1, { op: "startGame" });
  act(room.leader, { op: "propose", team: [1, 2] }); act(1, { op: "vote", seatNo: 1, approve: true });
  const saved = JSON.parse(JSON.stringify(room.serialize()));
  const back = AvalonCore.hydrate(saved);
  check("序列化/回灌:阶段、座位角色、提议、票、湖中仙女、history 一致", back.phase === "vote" && back.seats[1].role === room.seats[1].role && back.proposal.team.join() === "1,2" && back.seats[1].vote === true && back.lady.holder === room.lady.holder && back.isHolder("p1", 1));
  check("回灌后能继续投票并开票", (() => { for (const n of back.seatNos()) if (n !== 1) back.action(`p${n}`, { op: "vote", seatNo: n, approve: true }); return back.phase === "quest" && back.history.length === 1; })());
  check("新一局:回到准备,保留角色配置与房间设置,清空身份", act(1, { op: "newGame" }).ok && room.phase === "setup" && room.roles.length === 6 && room.config.lady === true && room.seats[1].role === null && room.history.length === 0);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
