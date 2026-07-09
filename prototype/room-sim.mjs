// 房间协议 "可执行规格" —— 吕布主动夺炁 + 本回合锁 + 狂魔转移 + 吕布被杀 + fallback 代持
// 复用与真实 Workers 同一份核心逻辑(./shared/room-logic.mjs)。rng 固定 ()=>0 复现随机分支。
// node prototype/room-sim.mjs

import { RoomCore, cardLabel } from "./shared/room-logic.mjs";

let passed = 0, failed = 0;
function check(name, cond, detail = "") {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail ? "  <- " + detail : ""}`); }
}
const eqSet = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();
const LT = (dev) => room.viewFor(dev).seats[1].toolState; // 座位1=吕布的 toolState 视图

const room = new RoomCore("4271", 5, () => 0); // rng=0 → 随机总选"未被夺炁的第一张"
const dev = {}; for (let i = 1; i <= 5; i++) dev[i] = `dev${i}`;
for (let i = 1; i <= 5; i++) room.claimSeat(dev[i], i);
room.setGeneral(dev[1], 1, "lvbu");

const S2 = [{ s: "H", r: "3", n: "桃" }, { s: "S", r: "7", n: "杀" }, { s: "D", r: "2", n: "闪" }, { s: "C", r: "K", n: "过河拆桥" }];
room.action(dev[2], { targetSeat: 1, bySeat: 2, toolAction: { type: "registerQi", cards: S2 } });
room.action(dev[3], { targetSeat: 1, bySeat: 3, toolAction: { type: "registerQi", cards: [{ s: "S", r: "6", n: "杀" }, { s: "H", r: "Q", n: "无中生有" }] } });
room.action(dev[4], { targetSeat: 1, bySeat: 4, toolAction: { type: "registerQi", cards: [{ s: "D", r: "5", n: "木牛流马" }] } });
room.action(dev[5], { targetSeat: 1, bySeat: 5, toolAction: { type: "registerQi", cards: [{ s: "S", r: "2", n: "杀" }, { s: "H", r: "4", n: "桃" }] } });
room.action(dev[1], { targetSeat: 1, bySeat: 1, toolAction: { type: "registerQi", cards: [{ s: "C", r: "9", n: "杀" }, { s: "S", r: "A", n: "决斗" }, { s: "D", r: "J", n: "闪" }] } });

console.log("\n=== 场景 1:登记与保密(吕布本人也登炁)===");
check("吕布本人已登记3张", room.seats[1].toolState.qiRegister["1"].cards.length === 3);
check("吕布看不到别人牌面(mine 只含自己座位1)", eqSet(Object.keys(LT(dev[1]).qiRegister.mine), ["1"]));
check("吕布能看到各座位剩余数量", LT(dev[1]).qiRegister.counts["2"] === 4 && LT(dev[1]).qiRegister.counts["5"] === 2);
check("座位2 只看到自己牌面", eqSet(Object.keys(LT(dev[2]).qiRegister.mine), ["2"]));
check("系统(DO 内部)持有全部明细", eqSet(Object.keys(room.seats[1].toolState.qiRegister), ["1", "2", "3", "4", "5"]));

console.log("\n=== 场景 2:吕布主动夺炁,失去方零操作也知情 ===");
const r2 = room.action(dev[1], { targetSeat: 1, bySeat: 1, toolAction: { type: "duoqi", fromSeat: 2 } });
const exp = cardLabel(S2[0]); // rng=0 → 座位2第一张 ♥3 桃
check("吕布拿到系统随机指定的那张", r2.ok && r2.card === exp, JSON.stringify(r2));
check("吕布'已获得炁'里出现这张(罡拳用)", LT(dev[1]).gained.some((g) => g.label === exp));
check("★被夺者零操作,但自己界面那张已标 taken(知道交哪张)", LT(dev[2]).qiRegister.mine["2"].cards[0].taken === true);
check("吕布仍看不到座位2 其余牌面", LT(dev[1]).qiRegister.mine["2"] === undefined);
check("座位2 剩余数量降为3(公开)", LT(dev[1]).qiRegister.counts["2"] === 3);
check("其他玩家只见数量,拿不到牌面", LT(dev[5]).qiRegister.mine["2"] === undefined && LT(dev[5]).qiRegister.counts["2"] === 3);
check("其他玩家看不到吕布 gained 明细,只见数量", LT(dev[5]).gained.count !== undefined && !Array.isArray(LT(dev[5]).gained));

console.log("\n=== 场景 3:本回合锁 —— 同一座位一回合只夺一次 ===");
check("本回合再夺座位2 被拒", room.action(dev[1], { targetSeat: 1, bySeat: 1, toolAction: { type: "duoqi", fromSeat: 2 } }).error === "ALREADY_STOLEN_THIS_TURN");
room.action(dev[1], { targetSeat: 1, bySeat: 1, toolAction: { type: "newTurn" } });
const r3 = room.action(dev[1], { targetSeat: 1, bySeat: 1, toolAction: { type: "duoqi", fromSeat: 2 } });
check("开新回合后可再夺同一座位", r3.ok === true, JSON.stringify(r3));
check("座位2 剩余再降为2", LT(dev[1]).qiRegister.counts["2"] === 2);

console.log("\n=== 场景 4:权限 ===");
check("非吕布不能夺炁", room.action(dev[3], { targetSeat: 1, bySeat: 3, toolAction: { type: "duoqi", fromSeat: 2 } }).error === "NOT_LVBU_ACTION");
check("吕布不能夺自己", room.action(dev[1], { targetSeat: 1, bySeat: 1, toolAction: { type: "duoqi", fromSeat: 1 } }).error === "CANT_STEAL_SELF");

console.log("\n=== 场景 5:fallback —— 座位2 没电,座位5 代持后可替其查看/登记 ===");
room.releaseSeat(dev[2], 2);
room.claimSeat(dev[5], 2);
check("座位5 现在认领 [5,2]", eqSet(room.viewFor(dev[5]).youHold, [5, 2]));
check("代持者能看到座位2 明细(含已被夺 taken 的牌)", eqSet(Object.keys(LT(dev[5]).qiRegister.mine), ["5", "2"]) && LT(dev[5]).qiRegister.mine["2"].cards[0].taken === true);
check("代持者可替座位2 重新登记", room.action(dev[5], { targetSeat: 1, bySeat: 2, toolAction: { type: "registerQi", cards: [{ s: "H", r: "5", n: "桃" }] } }).ok === true);

console.log("\n=== 场景 6:狂魔 —— 击败后立即重新指定,入魔状态保持 ===");
room.action(dev[1], { targetSeat: 1, bySeat: 1, toolAction: { type: "enterMo", kuangTarget: 3 } });
check("入魔状态对所有人公开", LT(dev[4]).entered === true && LT(dev[4]).kuangTarget === 3);
const before = LT(dev[1]).gained.length;
const r6 = room.action(dev[1], { targetSeat: 1, bySeat: 1, toolAction: { type: "defeatKuang" } });
check("狂角色座位3 交出2张", r6.moved === 2);
check("吕布已获得炁 +2", LT(dev[1]).gained.length === before + 2);
check("狂角色指定清空(待重新指定)", LT(dev[1]).kuangTarget === null);
const r6b = room.action(dev[1], { targetSeat: 1, bySeat: 1, toolAction: { type: "repickKuang", kuangTarget: 5 } });
check("重新指定座位5 为狂角色", r6b.ok && LT(dev[1]).kuangTarget === 5);
check("入魔状态依然保持(没有重新入魔)", LT(dev[1]).entered === true);
room.action(dev[1], { targetSeat: 1, bySeat: 1, toolAction: { type: "kuangDiedByOther" } });
check("狂角色被非吕布击杀后清空,入魔仍保持", LT(dev[1]).kuangTarget === null && LT(dev[1]).entered === true);

console.log("\n=== 场景 7:吕布被击杀 —— 只交出【初始】炁,夺来的不交 ===");
const gainedBefore = LT(dev[1]).gained.length;                       // 夺来的(应保留)
const initLeft = room.seats[1].toolState.qiRegister["1"].cards.filter((c) => !c.taken).length; // 吕布初始炁剩余
const r7 = room.action(dev[1], { targetSeat: 1, bySeat: 1, toolAction: { type: "lvbuKilled", killerSeat: 4 } });
check("交出的是初始炁(3张)", r7.given === initLeft && initLeft === 3);
check("夺来的炁(gained)原封不动", LT(dev[1]).gained.length === gainedBefore && gainedBefore > 0);
check("吕布初始炁已全部交出(标 taken)", room.seats[1].toolState.qiRegister["1"].cards.every((c) => c.taken));
check("交出记录都指向座位4", LT(dev[1]).given.length === r7.given && LT(dev[1]).given.every((g) => g.toSeat === 4));
check("被击杀公开事件可见", LT(dev[4]).log.some((l) => l.includes("被座位4击杀")));
check("他人看不到 given 明细,只见数量", LT(dev[5]).given.count === r7.given);

console.log("\n=== 场景 8:重置本局 —— 清空进度,保留座位武将,仅吕布可发起 ===");
room.action(dev[1], { targetSeat: 1, bySeat: 1, toolAction: { type: "finishReg" } }); // 先进入对局
const rr = room.action(dev[1], { targetSeat: 1, bySeat: 1, toolAction: { type: "resetGame" } });
check("重置成功", rr.ok && rr.reset === true);
check("回到登记阶段", LT(dev[1]).phase === "reg");
check("炁登记全部清空", Object.keys(room.seats[1].toolState.qiRegister).length === 0);
check("吕布已获得炁清空", LT(dev[1]).gained.length === 0);
check("入魔状态清空", LT(dev[1]).entered === false);
check("座位武将保留(仍是吕布)", room.seats[1].general === "lvbu");
check("非吕布不能重置", room.action(dev[3], { targetSeat: 1, bySeat: 3, toolAction: { type: "resetGame" } }).error === "NOT_LVBU_ACTION");

console.log(`\n结果: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
