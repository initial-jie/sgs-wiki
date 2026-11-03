// 一夜终极狼人房间 "可执行规格" —— 发牌/夜晚顺序与保密/各角色行动/定时推进/发言轮次/投票结算/持久化
// 复用与真实 Workers 同一份核心逻辑(./shared/onuw-logic.mjs)。
// node prototype/onuw/onuw-sim.mjs

import { OnuwCore, defaultConfig } from "./shared/onuw-logic.mjs";
import { ROLES, ROLE_BY_KEY, NIGHT_ORDER, defaultRoles, ARTIFACTS } from "./shared/onuw-data.mjs";

let passed = 0, failed = 0;
function check(name, cond, detail = "") {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail ? "  <- " + detail : ""}`); }
}
function lcg(seed) { let x = seed >>> 0; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); }
let T = 1_000_000; const now = () => T;
const SEC = 1000;

console.log("\n=== 数据 ===");
check("46 个角色(含虚拟恋人阶段),键唯一", ROLES.length === 46 && new Set(ROLES.map((r) => r.key)).size === 46);
check("唤醒顺序:黄昏 模仿者→吸血鬼→伯爵→仁菲尔德→病患→丘比特→煽动者→牧师→刺客→刺客学徒→恋人;夜晚 哨兵→…→馆长", NIGHT_ORDER.join(",") === "copycat,vampire,master,count,renfield,diseased,cupid,instigator,priest,assassin,apprenticeassassin,lovers,sentinel,doppelganger,werewolf,alphawolf,mysticwolf,minion,apprenticetanner,mason,thing,seer,apprenticeseer,pi,marksman,nostradamus,robber,witch,pickpocket,troublemaker,villageidiot,auraseer,gremlin,drunk,insomniac,squire,beholder,revealer,curator");
check("每个睁眼角色都有播报文案(吸血鬼之主并入吸血鬼阶段)", ROLES.filter((r) => r.order != null && r.key !== "master").every((r) => r.narr && r.narr.open && r.narr.close));
check("推荐配置 5 人 = 8 张(旧简单配置)", defaultRoles(5).length === 8 && defaultRoles(5).filter((k) => k === "werewolf").length === 2);
check("推荐配置 8 人 = 头狼/神秘狼/守夜人×2/预言家/强盗/女巫/捣蛋鬼/酒鬼/侍从/皮匠", defaultRoles(8).join(",") === "alphawolf,mysticwolf,mason,mason,seer,robber,witch,troublemaker,drunk,squire,tanner");
check("9 人+失眠者,10 人+猎人,11~14 +灵异侦探/馆长/哨兵/被诅咒者,15~16 +梦狼/旁观者;张数恒为人数+3", [8, 9, 10, 11, 12, 13, 14, 15, 16].every((n) => defaultRoles(n).length === n + 3) && defaultRoles(9).at(-1) === "insomniac" && defaultRoles(10).at(-1) === "hunter" && defaultRoles(14).slice(-4).join(",") === "pi,curator,sentinel,cursed" && defaultRoles(16).slice(-2).join(",") === "dreamwolf,beholder");
check("6 枚神器", ARTIFACTS.length === 6);

// 工具:开局后强行摆一副已知的牌(测试各角色分支),再重进第 0 阶段
function layout(room, seatRoles, center) {
  room.seatNos().forEach((n, i) => { room.seats[n].initRole = seatRoles[i]; room.seats[n].card = seatRoles[i]; room.seats[n].notes = []; room.seats[n].shield = false; room.seats[n].revealed = null; room.seats[n].artifact = null; });
  room.center = center.slice();
  room.wolfSlot = room.roles.includes("alphawolf") ? room.center.length - 1 : null;
  room.nightLog = [];
  room._enterPhase(0);
}
function mk(n, roles, seed = 1) {
  const room = new OnuwCore("1234", n, lcg(seed), now);
  const dev = {}; for (let i = 1; i <= n; i++) { dev[i] = `p${i}`; room.claimSeat(dev[i], i); }
  room.action(dev[1], { op: "setRoles", roles });
  return { room, dev, V: (i) => room.viewFor(dev[i]), act: (i, o) => room.action(dev[i], o), tick: () => room.action("x", { op: "tick" }) };
}

console.log("\n=== 准备阶段 ===");
{
  const { room, act } = mk(5, defaultRoles(5));
  check("3~16 座", OnuwCore.MIN_SEATS === 3 && OnuwCore.MAX_SEATS === 16);
  check("默认牌堆 = 人数+3", room.roles.length === 8 && room.deckSize() === 8);
  check("角色超上限拒绝(3 狼)", act(1, { op: "setRoles", roles: ["werewolf", "werewolf", "werewolf", "seer", "robber", "troublemaker", "villager", "villager"] }).error === "ROLE_MAX");
  check("未知角色拒绝", act(1, { op: "setRoles", roles: ["foo"] }).error === "BAD_ROLES");
  check("牌数不等于人数+3 不能开局", (act(1, { op: "setRoles", roles: ["werewolf", "seer"] }), act(1, { op: "startGame" }).error === "DECK_SIZE"));
  check("配置校验:voteSec 太小拒绝", act(1, { op: "setConfig", config: { voteSec: 1 } }).error === "BAD_CONFIG" && act(1, { op: "setConfig", config: { voteSec: 45, rounds: [{ mode: "free" }] } }).ok && room.config.voteSec === 45 && room.config.rounds.length === 1);
  check("牌堆=推荐配置时加减座位自动跟随;手动改过则不动", act(1, { op: "recommendRoles" }).ok && room.addSeat("p1").ok && room.roles.length === 9 && room.removeSeat("p1").ok && room.roles.length === 8 && act(1, { op: "setRoles", roles: ["werewolf", "seer", "robber", "troublemaker", "villager", "villager", "mason", "mason"] }).ok && room.addSeat("p1").ok && room.roles.length === 8 && room.removeSeat("p1").ok);
  check("加减座位只在准备阶段", act(1, { op: "recommendRoles" }).ok && act(1, { op: "startGame" }).ok && room.addSeat("p1").error === "NOT_SETUP");
}

console.log("\n=== 场景 A:6 人 哨兵/化身幽灵/头狼/预言家/强盗/捣蛋鬼(含护盾与中央横牌)===");
{
  const roles = ["sentinel", "doppelganger", "werewolf", "alphawolf", "seer", "robber", "troublemaker", "drunk", "insomniac"];
  const { room, V, act, tick } = mk(6, roles);
  check("开局进入黑夜,阶段表按牌堆生成", act(1, { op: "startGame" }).ok && room.phase === "night" && room.night.phases.join(",") === "sentinel,doppelganger,werewolf,alphawolf,seer,robber,troublemaker,drunk,insomniac");
  check("有头狼:中央 4 张,第 4 张固定为狼人横牌", room.center.length === 4 && room.center[3] === "werewolf" && room.wolfSlot === 3 && V(1).centerCount === 4 && V(1).wolfSlot === 3 && V(1).center === null);
  layout(room, ["sentinel", "doppelganger", "werewolf", "seer", "robber", "troublemaker"], ["alphawolf", "drunk", "insomniac", "werewolf"]);
  check("初始角色仅本人可见;当前牌对本人也保密", V(1).seats[1].initRole === "sentinel" && V(2).seats[1].initRole === undefined && V(1).seats[1].card === undefined);
  check("阶段 0 哨兵:行动面板只给持有者", V(1).night.role === "sentinel" && V(1).night.me[1].eff === "sentinel" && Object.keys(V(2).night.me).length === 0);
  check("非持有者/非行动者拒绝", act(2, { op: "nightAct", seatNo: 1, kind: "shield", target: 4 }).error === "NOT_HOLDER" && act(2, { op: "nightAct", seatNo: 2, kind: "shield", target: 4 }).error === "NOT_ACTOR");
  check("哨兵不能护自己", act(1, { op: "nightAct", seatNo: 1, kind: "shield", target: 1 }).error === "SELF_TARGET");
  check("哨兵给 4 号放护盾(公开)", act(1, { op: "nightAct", seatNo: 1, kind: "shield", target: 4 }).ok && V(3).seats[4].shield === true && V(1).night.me[1].acted === true);
  check("已行动不能再行动", act(1, { op: "nightAct", seatNo: 1, kind: "shield", target: 5 }).error === "ALREADY_ACTED");
  T += 5 * SEC; check("未到最短时长不推进", tick().changed === false && room.night.idx === 0);
  T += 5 * SEC; check("到 10s 且行动完成 → 推进到化身幽灵", tick().changed === true && room.night.idx === 1 && room.night.role !== "sentinel");
  check("化身幽灵必须选牌,不能跳过", act(2, { op: "nightAct", seatNo: 2, kind: "skip" }).error === "MANDATORY");
  check("不能看被护盾的 4 号", act(2, { op: "nightAct", seatNo: 2, kind: "copy", target: 4 }).error === "SHIELDED");
  check("化身幽灵复制 3 号(狼人)→ 记为狼,本阶段完成", act(2, { op: "nightAct", seatNo: 2, kind: "copy", target: 3 }).ok && room.dg.role === "werewolf" && room.night.acted[2] === true && V(2).seats[2].notes[0].cards[0].role === "werewolf");
  check("笔记他人不可见(只见条数)", V(3).seats[2].notes === undefined && V(3).seats[2].noteCount === 2);
  T += 10 * SEC; tick();
  check("狼人阶段:狼人与化身幽灵狼互认,自动完成", room.night.idx === 2 && room.night.actors.join(",") === "2,3" && room.night.acted[3] && room.night.acted[2] && V(3).seats[3].notes.at(-1).text.includes("2号") && V(2).seats[2].notes.at(-1).text.includes("3号"));
  check("非独狼不能看中央", act(3, { op: "nightAct", seatNo: 3, kind: "peekCenter", idx: 0 }).error === "ALREADY_ACTED");
  T += 10 * SEC; tick();
  check("头狼在中央:无行动者,10s 后自动过", room.night.idx === 3 && room.night.actors.length === 0 && (T += 10 * SEC, tick().changed) && room.night.idx === 4);
  check("预言家:不能看自己", act(4, { op: "nightAct", seatNo: 4, kind: "peekPlayer", target: 4 }).error === "SELF_TARGET");
  check("预言家看两张中央牌(含头狼横牌)", act(4, { op: "nightAct", seatNo: 4, kind: "peekCenter", idxs: [0, 3] }).ok && V(4).seats[4].notes.at(-1).text.includes("头狼") && V(4).seats[4].notes.at(-1).text.includes("狼人") && V(4).seats[4].notes.at(-1).cards.length === 2);
  T += 10 * SEC; tick();
  check("强盗不能抢被护盾的 4 号", room.night.idx === 5 && act(5, { op: "nightAct", seatNo: 5, kind: "swapSelf", target: 4 }).error === "SHIELDED");
  check("强盗抢 3 号 → 看到新牌狼人,3 号变强盗", act(5, { op: "nightAct", seatNo: 5, kind: "swapSelf", target: 3 }).ok && room.seats[5].card === "werewolf" && room.seats[3].card === "robber" && V(5).seats[5].notes.at(-1).text.includes("狼人"));
  T += 10 * SEC; tick();
  check("捣蛋鬼:行动未完成时 10s 不推进", room.night.idx === 6 && (T += 10 * SEC, tick().changed === false) && room.night.idx === 6);
  check("捣蛋鬼不能换被护盾的牌", act(6, { op: "nightAct", seatNo: 6, kind: "swapTwo", a: 4, b: 5 }).error === "SHIELDED");
  check("捣蛋鬼换 3、5 → 3 号又是狼人", act(6, { op: "nightAct", seatNo: 6, kind: "swapTwo", a: 3, b: 5 }).ok && room.seats[3].card === "werewolf" && room.seats[5].card === "robber");
  check("行动完成后立刻可推进", tick().changed === true && room.night.idx === 7);
  T += 10 * SEC; tick(); T += 10 * SEC; tick();
  check("酒鬼/失眠者都在中央 → 天亮", room.phase === "day" && room.day.round === 0 && room.day.mode === "order" && room.day.order.length === 6);
  const sp = room.currentSpeaker(), other = room.seatNos().find((n) => n !== sp);
  check("顺序发言:非发言者不能结束", act(other, { op: "dayNext" }).error === "NOT_SPEAKER" && V(sp).day.speaker === sp);
  check("发言者结束 → 下一位", act(sp, { op: "dayNext" }).ok && room.day.cur === 1);
  for (let i = 1; i < 6; i++) act(room.currentSpeaker(), { op: "dayNext" });
  check("第一轮走完 → 第二轮自由讨论,默认人数分钟", room.day.round === 1 && room.day.mode === "free" && room.day.freeMs === 6 * 60 * SEC);
  check("自由讨论未到时不自动结束,可强制", act(1, { op: "dayNext" }).error === "NOT_YET" && (T += 6 * 60 * SEC, tick().changed === true) && room.day.round === 2);
  check("最后一轮顺序发言含归票沉底:首位再发一次", room.day.mode === "order" && room.day.order.length === 7 && room.day.order[0] === room.day.order[6] && room.day.anchorSeat === room.day.order[0]);
  for (let i = 0; i < 7; i++) act(room.currentSpeaker(), { op: "dayNext" });
  check("三轮结束自动进入投票", room.phase === "vote" && V(1).voting.voted === 0);
  check("不能投自己", act(1, { op: "vote", seatNo: 1, target: 1 }).error === "SELF_TARGET");
  const votes = { 1: 3, 2: 4, 3: 1, 4: 3, 5: 3, 6: 1 };
  act(1, { op: "vote", seatNo: 1, target: 3 });
  check("他人只见是否已投,本人可见投给谁", V(2).seats[1].hasVoted === true && V(2).seats[1].vote === undefined && V(1).seats[1].vote === 3);
  check("未全投且未超时 → 不结算", tick().changed === false && room.phase === "vote");
  for (const n of [2, 3, 4, 5, 6]) act(n, { op: "vote", seatNo: n, target: votes[n] });
  check("全部投完 → 立即结算", room.phase === "over" && tick().changed === false);
  const r = room.result;
  check("3 号 3 票出局,是狼人 → 村民胜", r.deaths.join(",") === "3" && r.final[3] === "werewolf" && r.winTeams.join(",") === "village");
  check("化身幽灵牌=狼人阵营,不在胜者里;胜者 1,4,5,6", r.final[2] === "werewolf" && r.winners.join(",") === "1,4,5,6");
  check("结算后全公开:中央牌/当前牌/笔记/夜晚记录", V(1).center.length === 4 && V(1).seats[5].card === "robber" && Array.isArray(V(1).seats[4].notes) && V(1).nightLog.some((l) => l.includes("捣蛋鬼")));
  check("再来一局:回到准备阶段,牌堆配置保留", act(1, { op: "newGame" }).ok && room.phase === "setup" && room.roles.length === 9 && room.seats[3].card === null);
}

console.log("\n=== 场景 B:8 人 神秘狼/爪牙/守夜人/女巫/灵异侦探/村庄白痴/揭露者/皮匠 + 保镖/猎人在中央 ===");
{
  const roles = ["mysticwolf", "minion", "mason", "mason", "witch", "pi", "villageidiot", "revealer", "tanner", "hunter", "bodyguard"];
  const { room, V, act, tick } = mk(8, roles);
  act(1, { op: "startGame" });
  check("阶段表(狼人阶段由神秘狼触发)", room.night.phases.join(",") === "werewolf,mysticwolf,minion,mason,pi,witch,villageidiot,revealer");
  layout(room, ["mysticwolf", "minion", "mason", "witch", "pi", "villageidiot", "revealer", "tanner"], ["mason", "hunter", "bodyguard"]);
  check("独狼:提示可看中央牌,未自动完成", room.night.actors.join(",") === "1" && !room.night.acted[1] && V(1).night.me[1].lone === true);
  check("独狼看中央第 2 张:猎人", act(1, { op: "nightAct", seatNo: 1, kind: "peekCenter", idx: 1 }).ok && V(1).seats[1].notes.at(-1).text.includes("猎人"));
  T += 10 * SEC; tick();
  check("神秘狼看 8 号:皮匠", room.night.idx === 1 && act(1, { op: "nightAct", seatNo: 1, kind: "peekPlayer", target: 8 }).ok && V(1).seats[1].notes.at(-1).text.includes("皮匠"));
  T += 10 * SEC; tick();
  check("爪牙得知狼人是 1 号", room.night.idx === 2 && V(2).seats[2].notes.at(-1).text === "狼人是:1号");
  T += 10 * SEC; tick();
  check("单守夜人:另一张在中央", room.night.idx === 3 && V(3).seats[3].notes.at(-1).text.includes("中央"));
  T += 10 * SEC; tick();
  check("灵异侦探看 4 号(女巫)→ 还可以继续", room.night.idx === 4 && act(5, { op: "nightAct", seatNo: 5, kind: "peekPlayer", target: 4 }).ok && !room.night.acted[5]);
  check("不能重复看同一人", act(5, { op: "nightAct", seatNo: 5, kind: "peekPlayer", target: 4 }).error === "BAD_TARGET");
  check("看到皮匠 → 变成皮匠并停止", act(5, { op: "nightAct", seatNo: 5, kind: "peekPlayer", target: 8 }).ok && room.night.acted[5] && room.pi.found === "tanner" && room.cardRole("pi") === "tanner");
  T += 10 * SEC; tick();
  check("女巫看中央第 3 张(保镖)后不能跳过", room.night.idx === 5 && act(4, { op: "nightAct", seatNo: 4, kind: "peekCenter", idx: 2 }).ok && act(4, { op: "nightAct", seatNo: 4, kind: "skip" }).error === "MANDATORY");
  check("女巫把它换给自己 → 自己成保镖,中央第 3 张成女巫", act(4, { op: "nightAct", seatNo: 4, kind: "swapCenter", target: 4 }).ok && room.seats[4].card === "bodyguard" && room.center[2] === "witch");
  T += 10 * SEC; tick();
  check("村庄白痴向右移一位(自己除外)", room.night.idx === 6 && act(6, { op: "nightAct", seatNo: 6, kind: "shift", dir: "right" }).ok && [1, 2, 3, 4, 5, 6, 7, 8].map((n) => room.seats[n].card).join(",") === "tanner,mysticwolf,minion,mason,bodyguard,villageidiot,pi,revealer");
  T += 10 * SEC; tick();
  check("揭露者翻开 8 号(揭露者牌)→ 公开", room.night.idx === 7 && act(7, { op: "nightAct", seatNo: 7, kind: "reveal", target: 8 }).ok && V(2).seats[8].revealed === "revealer");
  T += 10 * SEC; tick();
  check("天亮;可直接发起投票", room.phase === "day" && act(1, { op: "startVote" }).ok && room.phase === "vote");
  const votes = { 1: 2, 2: 1, 3: 2, 4: 7, 5: 2, 6: 7, 7: 2, 8: 7 };
  for (const n of Object.keys(votes)) act(+n, { op: "vote", seatNo: +n, target: votes[n] });
  check("保镖(5 号)投 2 号 → 2 号 4 票受保护,3 票的 7 号出局;7 号是看过皮匠的灵异侦探=皮匠 → 皮匠胜,狼不胜", room.phase === "over" && room.result.deaths.join(",") === "7" && room.result.final[7] === "tanner" && room.result.winTeams.join(",") === "tanner" && room.result.winners.join(",") === "7" && room.result.lines.some((l) => l.includes("保镖")));
}

console.log("\n=== 场景 C:3 人 最长等待 / 猎人带人 / 结算视图 ===");
{
  const { room, V, act, tick } = mk(3, ["werewolf", "werewolf", "hunter", "villager", "seer", "troublemaker"]);
  act(1, { op: "setConfig", config: { rounds: [{ mode: "order" }], anchor: false, perSpeakSec: 20 } });
  act(1, { op: "startGame" });
  layout(room, ["hunter", "werewolf", "villager"], ["werewolf", "seer", "troublemaker"]);
  check("独狼不行动:10s 不推进,30s 最长等待后放弃推进", (T += 10 * SEC, tick().changed === false) && (T += 20 * SEC, tick().changed === true) && room.night.idx === 1);
  check("强制推进", act(1, { op: "nightAdvance", force: true }).ok && room.night.idx === 2 && act(1, { op: "nightAdvance", force: true }).ok && room.phase === "day");
  check("限时发言 20s:到点自动换人", room.day.order.length === 3 && (T += 20 * SEC, tick().changed === true) && room.day.cur === 1);
  act(1, { op: "startVote" });
  act(1, { op: "vote", seatNo: 1, target: 2 }); act(2, { op: "vote", seatNo: 2, target: 1 }); act(3, { op: "vote", seatNo: 3, target: 1 });
  check("猎人 1 号出局,带走他投的 2 号(狼)→ 村民胜", room.phase === "over" && room.result.deaths.join(",") === "1,2" && room.result.winTeams.join(",") === "village" && room.result.winners.join(",") === "1,3");
  check("结算视图:座位带最终角色与阵营", V(1).seats[2].finalRole === "werewolf" && V(1).seats[2].team === "werewolf" && V(1).seats[1].team === "village");
}

console.log("\n=== 场景 D:场上没有狼 —— 爪牙 / 无人出局 / 投票超时 ===");
{
  const { room, act, tick } = mk(3, ["minion", "villager", "villager", "werewolf", "werewolf", "seer"]);
  act(1, { op: "setConfig", config: { rounds: [{ mode: "free" }], freeSec: 30 } });
  act(1, { op: "startGame" }); layout(room, ["minion", "villager", "villager"], ["werewolf", "werewolf", "seer"]);
  for (let i = 0; i < 3; i++) act(1, { op: "nightAdvance", force: true });
  check("自由讨论 30s 到点 → 投票", room.phase === "day" && (T += 30 * SEC, tick().changed) && room.phase === "vote");
  act(1, { op: "vote", seatNo: 1, target: 2 }); act(3, { op: "vote", seatNo: 3, target: 2 });
  check("投票超时(60s)按弃票结算", (T += 59 * SEC, tick().changed === false) && (T += 1 * SEC, tick().changed === true) && room.phase === "over");
  check("没有狼,非爪牙的 2 号出局 → 爪牙胜", room.result.deaths.join(",") === "2" && room.result.winTeams.join(",") === "werewolf" && room.result.winners.join(",") === "1");
  act(1, { op: "newGame" }); act(1, { op: "startGame" }); layout(room, ["minion", "villager", "villager"], ["werewolf", "werewolf", "seer"]);
  for (let i = 0; i < 3; i++) act(1, { op: "nightAdvance", force: true });
  act(1, { op: "startVote" });
  act(1, { op: "vote", seatNo: 1, target: 2 }); act(2, { op: "vote", seatNo: 2, target: 3 }); act(3, { op: "vote", seatNo: 3, target: 2 });
  check("每人 1 票以下无人出局… 2 号 2 票出局(2 票算)", room.result.deaths.join(",") === "2");
  act(1, { op: "newGame" }); act(1, { op: "startGame" }); layout(room, ["minion", "villager", "villager"], ["werewolf", "werewolf", "seer"]);
  for (let i = 0; i < 3; i++) act(1, { op: "nightAdvance", force: true });
  act(1, { op: "startVote" });
  act(1, { op: "vote", seatNo: 1, target: 2 }); act(2, { op: "vote", seatNo: 2, target: 3 }); act(3, { op: "vote", seatNo: 3, target: 1 });
  check("各 1 票 → 无人出局,没有狼 → 村民胜", room.result.deaths.length === 0 && room.result.winTeams.join(",") === "village" && room.result.winners.join(",") === "2,3");
}

console.log("\n=== 场景 E:化身幽灵立即行动(复制强盗)/ 酒鬼与护盾 / 馆长神器 / 持久化 ===");
{
  const { room, V, act, tick } = mk(4, ["sentinel", "doppelganger", "robber", "drunk", "curator", "villager", "werewolf"]);
  act(1, { op: "startGame" });
  layout(room, ["sentinel", "doppelganger", "drunk", "curator"], ["robber", "villager", "werewolf"]);
  check("阶段表", room.night.phases.join(",") === "sentinel,doppelganger,werewolf,robber,drunk,curator");
  act(1, { op: "nightAct", seatNo: 1, kind: "shield", target: 3 });
  T += 10 * SEC; tick();
  check("化身幽灵复制酒鬼?不——复制 4 号馆长 → 馆长阶段一起睁眼", act(2, { op: "nightAct", seatNo: 2, kind: "copy", target: 4 }).ok && room.night.acted[2] && room.dg.role === "curator");
  // 回退重做:测立即行动的分支
  room.dg = null; room.night.acted = {}; room.night.sub = {}; room.seats[2].notes = [];
  room.seats[4].card = "robber"; room.seats[4].initRole = "robber"; room.center[0] = "curator";
  check("化身幽灵复制强盗 → 本阶段继续按强盗行动", act(2, { op: "nightAct", seatNo: 2, kind: "copy", target: 4 }).ok && !room.night.acted[2] && V(2).night.me[2].eff === "robber");
  check("化身幽灵-强盗与 4 号交换,看到新牌强盗", act(2, { op: "nightAct", seatNo: 2, kind: "swapSelf", target: 4 }).ok && room.night.acted[2] && room.seats[2].card === "robber" && room.seats[4].card === "doppelganger");
  T += 10 * SEC; tick(); // werewolf(中央)
  T += 10 * SEC; tick(); // robber 阶段:初始强盗是 4 号(已被换成化身幽灵牌,但行动按初始角色)
  check("强盗阶段行动者按初始角色(4 号)", room.night.idx === 3 && room.night.actors.join(",") === "4");
  act(4, { op: "nightAct", seatNo: 4, kind: "skip" });
  T += 10 * SEC; tick();
  check("被护盾的酒鬼不能换,可跳过", room.night.idx === 4 && act(3, { op: "nightAct", seatNo: 3, kind: "swapCenter", idx: 0 }).error === "SHIELDED" && act(3, { op: "nightAct", seatNo: 3, kind: "skip" }).ok);
  T += 10 * SEC; tick();
  check("馆长阶段:初始馆长已不在(被换成强盗)——行动者为空", room.night.idx === 5 && room.night.actors.length === 0);
  // 直接验证馆长动作:临时把 1 号设为馆长行动者
  room.seats[1].initRole = "curator"; room._enterPhase(5);
  check("馆长不能放到被护盾的 3 号;放到 2 号 → 2 号有神器,夜里本人看不到", act(1, { op: "nightAct", seatNo: 1, kind: "artifact", target: 3 }).error === "SHIELDED" && act(1, { op: "nightAct", seatNo: 1, kind: "artifact", target: 2 }).ok && V(3).seats[2].hasArtifact === true && V(2).seats[2].artifact === undefined);
  const saved = JSON.parse(JSON.stringify(room.serialize()));
  const room2 = OnuwCore.hydrate(saved, lcg(1)); room2.now = now;
  check("持久化:夜晚中途序列化/回灌后视图一致", JSON.stringify(room2.viewFor("p2")) === JSON.stringify(room.viewFor("p2")) && room2.night.idx === 5 && room2.dg.role === "robber");
  T += 10 * SEC; room2.action("x", { op: "tick" });
  check("回灌后能继续:天亮,持有者看到神器", room2.phase === "day" && typeof room2.viewFor("p2").seats[2].artifact === "string");
}

console.log("\n=== 场景 F:Bonus 包 —— 那东西/皮匠学徒/诺查丹玛斯/气场预言家/侍从/旁观者/王子/被诅咒者 ===");
{
  const roles = ["werewolf", "seer", "thing", "apprenticetanner", "nostradamus", "auraseer", "squire", "beholder", "prince", "cursed", "tanner", "villager", "robber"];
  const { room, V, act, tick } = mk(10, roles);
  act(1, { op: "startGame" });
  check("阶段表(按顺序)", room.night.phases.join(",") === "werewolf,apprenticetanner,thing,seer,nostradamus,robber,auraseer,squire,beholder");
  layout(room, ["werewolf", "seer", "thing", "apprenticetanner", "nostradamus", "auraseer", "squire", "beholder", "prince", "cursed"], ["tanner", "villager", "robber"]);
  act(1, { op: "nightAct", seatNo: 1, kind: "peekCenter", idx: 1 }); // 独狼看中央
  T += 10 * SEC; tick();
  check("皮匠学徒:场上没皮匠 → 按皮匠规则", room.night.idx === 1 && V(4).seats[4].notes.at(-1).text.includes("没有皮匠") && room.night.acted[4]);
  T += 10 * SEC; tick();
  check("那东西拍右边邻座(4 号)→ 4 号知道左边是那东西", room.night.idx === 2 && act(3, { op: "nightAct", seatNo: 3, kind: "tap", dir: "right" }).ok && V(4).seats[4].notes.at(-1).text.includes("左") && V(3).seats[3].notes.at(-1).text.includes("4号"));
  T += 10 * SEC; tick();
  act(2, { op: "nightAct", seatNo: 2, kind: "peekPlayer", target: 1 }); // 预言家看 1
  T += 10 * SEC; tick();
  check("诺查丹玛斯看村民牌可继续,看到皮匠即停止并加入皮匠阵营", room.night.idx === 4 && act(5, { op: "nightAct", seatNo: 5, kind: "peekCenter", idx: 1 }).ok && !room.night.acted[5] && act(5, { op: "nightAct", seatNo: 5, kind: "peekCenter", idx: 0 }).ok && room.night.acted[5] && room.nostra.team === "tanner");
  T += 10 * SEC; tick(); // robber 在中央
  T += 10 * SEC; tick();
  check("气场预言家看到竖拇指的人:1(看中央)、2(预言家)、5(诺查)——那东西/学徒不算", room.night.idx === 6 && V(6).seats[6].notes.at(-1).text === "竖起拇指(查看或移动过牌/印记)的玩家:1号、2号、5号");
  T += 10 * SEC; tick();
  check("侍从看到狼人 1 号,可查看其牌", room.night.idx === 7 && room.night.sub[7].targets.join(",") === "1" && act(7, { op: "nightAct", seatNo: 7, kind: "peekPlayer", target: 2 }).error === "BAD_TARGET" && act(7, { op: "nightAct", seatNo: 7, kind: "peekPlayer", target: 1 }).ok && room.night.acted[7]);
  T += 10 * SEC; tick();
  check("旁观者看到预言家 2 号", room.night.idx === 8 && room.night.sub[8].targets.join(",") === "2" && act(8, { op: "nightAct", seatNo: 8, kind: "skip" }).ok);
  T += 10 * SEC; tick();
  check("天亮公开宣布诺查丹玛斯加入皮匠阵营", room.phase === "day" && room.dayNotice === "诺查丹玛斯加入了皮匠阵营" && V(1).dayNotice === room.dayNotice);
  act(1, { op: "startVote" });
  // 王子 9 号得票最多但不算;次高 10 号(被诅咒者)出局,且狼 1 号投了他 → 变狼 → 村民胜
  const votes = { 1: 10, 2: 9, 3: 9, 4: 9, 5: 10, 6: 10, 7: 9, 8: 9, 9: 1, 10: 1 };
  for (const n of Object.keys(votes)) act(+n, { op: "vote", seatNo: +n, target: votes[n] });
  const r = room.result;
  check("王子票不算 → 10 号出局;被诅咒者被狼投 → 变狼 → 村民胜", room.phase === "over" && r.deaths.join(",") === "10" && r.final[10] === "werewolf" && r.winTeams.join(",") === "village");
  check("侍从(狼阵营)输;皮匠学徒(无皮匠=皮匠)未死输;诺查(皮匠阵营)未死输;王子/预言家等赢", !r.winners.includes(7) && !r.winners.includes(4) && !r.winners.includes(5) && r.winners.includes(9) && r.winners.includes(2));
  // 再来一局:没有狼在场时侍从
  act(1, { op: "newGame" }); act(1, { op: "setRoles", roles: ["squire", "villager", "villager", "werewolf", "werewolf", "seer"] });
  room.removeSeat("p1"); for (let i = 0; i < 6; i++) room.removeSeat("p1");
  act(1, { op: "startGame" }); layout(room, ["squire", "villager", "villager"], ["werewolf", "werewolf", "seer"]);
  for (let i = 0; i < 3; i++) act(1, { op: "nightAdvance", force: true });
  act(1, { op: "startVote" });
  act(1, { op: "vote", seatNo: 1, target: 2 }); act(2, { op: "vote", seatNo: 2, target: 3 }); act(3, { op: "vote", seatNo: 3, target: 2 });
  check("没有狼:侍从存活且他人出局 → 侍从胜", room.result.deaths.join(",") === "2" && room.result.winners.join(",") === "1");
}

console.log("\n=== 场景 G:吸血鬼包 —— 黄昏印记 / 模仿者 / 恐惧 / 恋人 / 神射手 / 扒手 / 小精灵 / 结算 ===");
{
  const roles = ["copycat", "vampire", "count", "renfield", "diseased", "cupid", "instigator", "priest", "assassin", "apprenticeassassin", "marksman", "pickpocket", "gremlin"];
  const { room, V, act, tick } = mk(10, roles);
  act(1, { op: "startGame" });
  check("阶段表:黄昏在前,恋人阶段紧随刺客学徒之后", room.night.phases.join(",") === "copycat,vampire,count,renfield,diseased,cupid,instigator,priest,assassin,apprenticeassassin,lovers,marksman,pickpocket,gremlin");
  layout(room, ["copycat", "vampire", "count", "renfield", "diseased", "cupid", "instigator", "priest", "marksman", "pickpocket"], ["assassin", "apprenticeassassin", "gremlin"]);
  check("黄昏阶段标记 dusk", V(1).night.dusk === true);
  check("模仿者看中央第 1 张(刺客)→ 成为刺客", act(1, { op: "nightAct", seatNo: 1, kind: "peekCenter", idx: 0 }).ok && room.copycat.role === "assassin" && room.cardRole("copycat") === "assassin");
  T += 10 * SEC; tick();
  check("吸血鬼阶段:吸血鬼 2 与伯爵 3 互认", room.night.idx === 1 && room.night.actors.join(",") === "2,3" && V(2).seats[2].notes.at(-1).text.includes("3号(伯爵)"));
  check("不能给吸血鬼放印记;伯爵代表放给 5 号 → 两人都完成", act(3, { op: "nightAct", seatNo: 3, kind: "mark", target: 2 }).error === "TARGET_IS_VAMP" && act(3, { op: "nightAct", seatNo: 3, kind: "mark", target: 5 }).ok && room.night.acted[2] && room.night.acted[3] && room.seats[5].mark === "vampire");
  check("印记内容保密,是否有印记公开", V(5).seats[5].mark === undefined && V(1).seats[5].hasMark === true);
  T += 10 * SEC; tick();
  check("伯爵不能跳过;给 9 号(神射手)恐惧印记", room.night.idx === 2 && act(3, { op: "nightAct", seatNo: 3, kind: "skip" }).error === "MANDATORY" && act(3, { op: "nightAct", seatNo: 3, kind: "mark", target: 9 }).ok && room.seats[9].mark === "fear");
  T += 10 * SEC; tick();
  check("仁菲尔德看到吸血鬼 2、3、5(印记)与印记目标,自带蝙蝠印记", room.night.idx === 3 && V(4).seats[4].notes.at(-1).text.includes("2号、3号、5号") && V(4).seats[4].notes.at(-1).text.includes("5号。") && room.seats[4].mark === "bat");
  T += 10 * SEC; tick();
  check("病患只能放邻座", room.night.idx === 4 && act(5, { op: "nightAct", seatNo: 5, kind: "mark", target: 8 }).error === "NOT_ADJACENT" && act(5, { op: "nightAct", seatNo: 5, kind: "mark", target: 6 }).ok && room.seats[6].mark === "disease");
  T += 10 * SEC; tick();
  check("丘比特给 7、10 爱之印记", room.night.idx === 5 && act(6, { op: "nightAct", seatNo: 6, kind: "markTwo", a: 7, b: 10 }).ok && room.seats[7].mark === "love" && room.seats[10].mark === "love");
  T += 10 * SEC; tick();
  check("煽动者给 2 号叛徒印记(替换无)", room.night.idx === 6 && act(7, { op: "nightAct", seatNo: 7, kind: "mark", target: 2 }).ok && room.seats[2].mark === "traitor");
  T += 10 * SEC; tick();
  check("牧师自动清明印记,再给 8 号自己?不行 → 给 1 号", room.night.idx === 7 && room.seats[8].mark === "clarity" && act(8, { op: "nightAct", seatNo: 8, kind: "mark", target: 8 }).error === "SELF_TARGET" && act(8, { op: "nightAct", seatNo: 8, kind: "mark", target: 1 }).ok && room.seats[1].mark === "clarity");
  T += 10 * SEC; tick();
  check("刺客阶段:模仿者-刺客是行动者,给 3 号刺客印记", room.night.idx === 8 && room.night.actors.join(",") === "1" && act(1, { op: "nightAct", seatNo: 1, kind: "mark", target: 3 }).ok && room.seats[3].mark === "assassin");
  T += 10 * SEC; tick(); // 刺客学徒在中央
  T += 10 * SEC; tick();
  check("恋人阶段:7、10 相认", room.night.idx === 10 && room.night.actors.join(",") === "7,10" && V(7).seats[7].notes.at(-1).text.includes("10号"));
  T += 10 * SEC; tick();
  check("神射手有恐惧印记 → 无法行动", room.night.idx === 11 && room.night.acted[9] && V(9).seats[9].notes.at(-1).text.includes("恐惧"));
  T += 10 * SEC; tick();
  check("扒手(爱之印记)与 8 号(清明)换印记 → 自己变清明并看到;8 号变爱之印记", room.night.idx === 12 && act(10, { op: "nightAct", seatNo: 10, kind: "swapMark", target: 8 }).ok && room.seats[10].mark === "clarity" && room.seats[8].mark === "love" && V(10).seats[10].notes.at(-1).text.includes("清明印记"));
  T += 10 * SEC; tick(); // 小精灵在中央 → 天亮
  T += 10 * SEC; tick();
  check("天亮", room.phase === "day");
  act(1, { op: "startVote" });
  // 吸血鬼在场:2(吸血鬼)、3(伯爵)、5(印记)。投票:3 号出局(刺客印记持有者 → 模仿者-刺客胜;吸血鬼死 → 村民胜)
  const votes = { 1: 3, 2: 3, 3: 1, 4: 3, 5: 1, 6: 3, 7: 6, 8: 3, 9: 3, 10: 3 };
  for (const n of Object.keys(votes)) act(+n, { op: "vote", seatNo: +n, target: votes[n] });
  const r = room.result;
  check("3 号出局:有吸血鬼出局 → 村民胜;吸血鬼阵营(2、3、5、仁菲尔德 4)输", room.phase === "over" && r.deaths.join(",") === "3" && r.winTeams.join(",") === "village" && !r.winners.includes(2) && !r.winners.includes(4) && !r.winners.includes(5));
  check("模仿者-刺客:刺客印记持有者出局 → 胜", r.winners.includes(1));
  check("投给疾病印记持有者 6 号的 7 号不能获胜", !r.winners.includes(7) && r.lines.some((l) => l.includes("疾病")));
  check("村民 6、8、10 赢;恐惧的神射手 9 也赢", [6, 8, 10, 9].every((n) => r.winners.includes(n)));
  check("结算公开印记", V(2).seats[5].mark === "vampire" && r.marks[8] === "love" && r.marks[10] === "clarity");
  // 叛徒印记:2 号(吸血鬼)有叛徒印记,吸血鬼阵营胜但同阵营无人死 → 2 号不胜
  act(1, { op: "newGame" }); act(1, { op: "startGame" });
  layout(room, ["copycat", "vampire", "count", "renfield", "diseased", "cupid", "instigator", "priest", "marksman", "pickpocket"], ["assassin", "apprenticeassassin", "gremlin"]);
  room.seats[2].mark = "traitor"; room.seats[9].mark = "love"; room.seats[10].mark = "love";
  for (let i = 0; i < 14; i++) if (room.phase === "night") act(1, { op: "nightAdvance", force: true });
  act(1, { op: "startVote" });
  const v2 = { 1: 9, 2: 9, 3: 9, 4: 9, 5: 9, 6: 9, 7: 9, 8: 9, 9: 1, 10: 1 };
  for (const n of Object.keys(v2)) act(+n, { op: "vote", seatNo: +n, target: v2[n] });
  const r2 = room.result;
  check("9 号出局,恋人 10 号殉情;没有吸血鬼出局 → 吸血鬼胜(3、4);2 号叛徒印记同阵营无人死 → 不胜", r2.deaths.join(",") === "9,10" && r2.winTeams.join(",") === "vampire" && r2.winners.includes(3) && r2.winners.includes(4) && !r2.winners.includes(2) && r2.lines.some((l) => l.includes("殉情")));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
