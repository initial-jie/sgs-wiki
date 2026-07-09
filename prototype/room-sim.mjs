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

// ═══════════════ 南华老仙:天书(ownerOnly 条件公开)═══════════════
const room2 = new RoomCore("5555", 5, () => 0);
const nd = {}; for (let i = 1; i <= 5; i++) { nd[i] = `nd${i}`; room2.claimSeat(nd[i], i); }
room2.setGeneral(nd[2], 2, "nanhua");           // 座位2 = 南华老仙
const NT = (d) => room2.viewFor(d).seats[2].toolState;
const own = (d) => NT(d).books.filter((b) => b.holder === 2);
const bookA = { timing: { level: 2, text: "准备阶段" }, effect: { level: 2, text: "你可以回复 1 点体力" } };
const bookB = { timing: { level: 1, text: "当你使用牌后" }, effect: { level: 1, text: "你可以摸 1 张牌" } };
const bookC = { timing: { level: 3, text: "一名其他角色死亡后" }, effect: { level: 3, text: "你可获得两张锦囊牌" } };

console.log("\n=== 南华1:书写天书,内容仅本人可见,旁人只见占位 ===");
const nw = room2.action(nd[2], { targetSeat: 2, bySeat: 2, toolAction: { type: "writeBook", book: bookA } });
check("南华写书成功", nw.ok === true, JSON.stringify(nw));
check("南华本人看得到时机+效果", NT(nd[2]).books[0].timing.text === "准备阶段" && NT(nd[2]).books[0].effect.text.includes("回复"));
check("新书 uses=2、未发动", NT(nd[2]).books[0].uses === 2 && NT(nd[2]).books[0].revealed === false);
check("★旁人只见占位(hidden),看不到内容", NT(nd[3]).books[0].hidden === true && NT(nd[3]).books[0].timing === undefined);
check("旁人仍能数出南华持有1册", NT(nd[3]).books.filter((b) => b.holder === 2).length === 1);

console.log("\n=== 南华2:合道上限 —— 满栏须替换,濒死升3册 ===");
room2.action(nd[2], { targetSeat: 2, bySeat: 2, toolAction: { type: "writeBook", book: bookB } });
check("cap=2 满栏后直接再写被拒(须替换)", room2.action(nd[2], { targetSeat: 2, bySeat: 2, toolAction: { type: "writeBook", book: bookA } }).error === "NEED_REPLACE");
const rep = room2.action(nd[2], { targetSeat: 2, bySeat: 2, toolAction: { type: "writeBook", book: bookC, replaceIndex: 0 } });
check("指定替换第0册成功", rep.ok && NT(nd[2]).books[0].timing.text === "一名其他角色死亡后");
check("升到 cap=3 后可写第3册", room2.action(nd[2], { targetSeat: 2, bySeat: 2, toolAction: { type: "setCap", cap: 3 } }).ok
  && room2.action(nd[2], { targetSeat: 2, bySeat: 2, toolAction: { type: "writeBook", book: bookA } }).ok);
check("南华现自留3册", own(nd[2]).length === 3);

console.log("\n=== 南华3:授术 —— 仅南华+受术者可见,第三方仍占位 ===");
// books: [0]=C(自留) [1]=B(自留) [2]=A(自留)
const gv = room2.action(nd[2], { targetSeat: 2, bySeat: 2, toolAction: { type: "giveBook", index: 0, toSeat: 4 } });
check("授术座位4 成功", gv.ok === true, JSON.stringify(gv));
check("南华仍能看到已授术天书内容", NT(nd[2]).books.find((b) => b.holder === 4)?.timing?.text === "一名其他角色死亡后");
check("★受术者座位4 能看到该天书内容", room2.viewFor(nd[4]).seats[2].toolState.books.find((b) => b.holder === 4)?.effect?.text.includes("锦囊"));
check("★第三方座位3 对该天书仅见占位", room2.viewFor(nd[3]).seats[2].toolState.books.find((b) => b.holder === 4)?.hidden === true);
check("授术后该册 uses=1、离开南华持有栏", NT(nd[2]).books.find((b) => b.holder === 4).uses === 1 && own(nd[2]).length === 2);
check("同一玩家已持一册,再授术被拒", room2.action(nd[2], { targetSeat: 2, bySeat: 2, toolAction: { type: "giveBook", index: 1, toSeat: 4 } }).error === "TARGET_HAS_BOOK");

console.log("\n=== 南华4:发动 —— 全场公开 + 用尽移除 ===");
const us = room2.action(nd[2], { targetSeat: 2, bySeat: 2, toolAction: { type: "useBook", index: 1 } }); // 发动自留 B(uses2→1)
check("南华发动自己天书成功", us.ok && us.revealed === true);
check("发动后 uses 减为1、未移除", NT(nd[2]).books[1].uses === 1);
check("★发动后第三方座位3 现在看得到内容", room2.viewFor(nd[3]).seats[2].toolState.books[1].timing?.text === "当你使用牌后");
const idx4 = NT(nd[2]).books.findIndex((b) => b.holder === 4);
room2.action(nd[4], { targetSeat: 2, bySeat: 4, toolAction: { type: "useBook", index: idx4 } }); // 受术者发动其 uses1 册
check("受术天书(uses1)发动后用尽移除", !NT(nd[2]).books.some((b) => b.holder === 4));

console.log("\n=== 南华5:权限与重置 ===");
check("非南华不能写书", room2.action(nd[3], { targetSeat: 2, bySeat: 3, toolAction: { type: "writeBook", book: bookA } }).error === "NOT_NANHUA_ACTION");
check("非持有者不能发动他人天书", room2.action(nd[3], { targetSeat: 2, bySeat: 3, toolAction: { type: "useBook", index: 0 } }).error === "NOT_BOOK_HOLDER");
const nrst = room2.action(nd[2], { targetSeat: 2, bySeat: 2, toolAction: { type: "resetGame" } });
check("南华重置成功", nrst.ok && nrst.reset === true);
check("重置后天书清空、cap 回2", NT(nd[2]).books.length === 0 && NT(nd[2]).cap === 2);
check("座位武将保留(仍是南华)", room2.seats[2].general === "nanhua");

// ═══════════════ 族荀攸:百出记录表(公开台账,无保密)═══════════════
const room3 = new RoomCore("6666", 5, () => 0);
const xd = {}; for (let i = 1; i <= 5; i++) { xd[i] = `xd${i}`; room3.claimSeat(xd[i], i); }
room3.setGeneral(xd[3], 3, "xunyou");            // 座位3 = 族荀攸
const XT = (d) => room3.viewFor(d).seats[3].toolState;
const xyAct = (d, by, o) => room3.action(xd[d], { targetSeat: 3, bySeat: by, toolAction: o });

console.log("\n=== 荀攸1:记录锦囊(首次组合)+ 全场公开 ===");
const xr = xyAct(3, 3, { type: "recordCard", key: "S-trick", name: "过河拆桥" });
check("荀攸记录 ♠锦囊→过河拆桥 成功", xr.ok === true, JSON.stringify(xr));
check("grid 已写入", XT(xd[3]).grid["S-trick"] === "过河拆桥");
check("★台账公开:旁人座位1 也能看到记录", XT(xd[1]).grid["S-trick"] === "过河拆桥");

console.log("\n=== 荀攸2:合法性 —— 格已满 / 牌名已记录 ===");
check("同格再记录被拒(CELL_FILLED)", xyAct(3, 3, { type: "recordCard", key: "S-trick", name: "顺手牵羊" }).error === "CELL_FILLED");
check("同牌名换格被拒(NAME_RECORDED)", xyAct(3, 3, { type: "recordCard", key: "H-trick", name: "过河拆桥" }).error === "NAME_RECORDED");
check("换格换牌名成功", xyAct(3, 3, { type: "recordCard", key: "H-trick", name: "无中生有" }).ok === true);

console.log("\n=== 荀攸3:奇策开关 + 结束本轮 ===");
check("初始未获奇策", XT(xd[3]).qice === false && XT(xd[3]).round === 1);
check("切换奇策 → true", xyAct(3, 3, { type: "toggleQice" }).qice === true);
const xe = xyAct(3, 3, { type: "endRound" });
check("结束本轮:round→2 且奇策清空", xe.round === 2 && XT(xd[3]).qice === false);

console.log("\n=== 荀攸4:权限 + 清格 + 重置 ===");
check("非荀攸不能记录", xyAct(1, 1, { type: "recordCard", key: "C-basic", name: "杀" }).error === "NOT_XUNYOU_ACTION");
check("清空格成功、grid 删除", xyAct(3, 3, { type: "clearCell", key: "S-trick" }).ok === true && XT(xd[3]).grid["S-trick"] === undefined);
check("清空格被夺去牌名可再用", xyAct(3, 3, { type: "recordCard", key: "C-trick", name: "过河拆桥" }).ok === true);
check("清空格(空格)被拒", xyAct(3, 3, { type: "clearCell", key: "D-equip" }).error === "CELL_EMPTY");
const xrst = xyAct(3, 3, { type: "resetGame" });
check("荀攸重置成功、grid 清空、round 回1", xrst.reset === true && Object.keys(XT(xd[3]).grid).length === 0 && XT(xd[3]).round === 1);
check("座位武将保留(仍是荀攸)", room3.seats[3].general === "xunyou");

// ═══════════════ 谋黄月英:并才理贤(公开台账,无保密)═══════════════
const room4 = new RoomCore("7777", 5, () => 0);
const hd = {}; for (let i = 1; i <= 5; i++) { hd[i] = `hd${i}`; room4.claimSeat(hd[i], i); }
room4.setGeneral(hd[4], 4, "huangyueying");      // 座位4 = 谋黄月英
const HYT = (d) => room4.viewFor(d).seats[4].toolState;
const hyAct = (d, by, o) => room4.action(hd[d], { targetSeat: 4, bySeat: by, toolAction: o });

console.log("\n=== 黄月英1:并才添加牌名(理贤牌池随之扩展)===");
check("并才添加过河拆桥成功", hyAct(4, 4, { type: "bcAdd", name: "过河拆桥" }).ok === true);
check("重复添加被拒(BC_DUP)", hyAct(4, 4, { type: "bcAdd", name: "过河拆桥" }).error === "BC_DUP");
check("非三选之一被拒(BAD_BC_NAME)", hyAct(4, 4, { type: "bcAdd", name: "杀" }).error === "BAD_BC_NAME");
check("★台账公开:旁人也看得到 bc", HYT(hd[1]).bc.includes("过河拆桥"));

console.log("\n=== 黄月英2:理贤牌池 = 无中生有 + 已添加 ===");
check("用无中生有(默认池)成功", hyAct(4, 4, { type: "lxUse", name: "无中生有" }).ok === true);
check("用已添加的过河拆桥成功", hyAct(4, 4, { type: "lxUse", name: "过河拆桥" }).ok === true);
check("用未添加的顺手牵羊被拒(BAD_LX_NAME)", hyAct(4, 4, { type: "lxUse", name: "顺手牵羊" }).error === "BAD_LX_NAME");

console.log("\n=== 黄月英3:达成阈值 —— bc满3 / lx去重3 ===");
hyAct(4, 4, { type: "bcAdd", name: "顺手牵羊" });
hyAct(4, 4, { type: "bcAdd", name: "铁索连环" });
check("bc 集齐3个", HYT(hd[4]).bc.length === 3);
check("bc满(3个合法名均已用)再添加必是重复→BC_DUP", hyAct(4, 4, { type: "bcAdd", name: "过河拆桥" }).error === "BC_DUP");
hyAct(4, 4, { type: "lxUse", name: "顺手牵羊" }); // 现在池含顺手牵羊
check("lx 去重达3种(无中生有/过河拆桥/顺手牵羊)", new Set(HYT(hd[4]).lx).size === 3);

console.log("\n=== 黄月英4:删除 + 权限 + 重置 ===");
check("非黄月英不能操作", hyAct(1, 1, { type: "lxUse", name: "无中生有" }).error === "NOT_HYY_ACTION");
const lxLen = HYT(hd[4]).lx.length;
check("删除理贤记录成功", hyAct(4, 4, { type: "lxRm", index: 0 }).ok === true && HYT(hd[4]).lx.length === lxLen - 1);
check("删除并才牌名成功", hyAct(4, 4, { type: "bcRm", index: 0 }).ok === true && HYT(hd[4]).bc.length === 2);
check("删空位被拒(NO_LX)", hyAct(4, 4, { type: "lxRm", index: 99 }).error === "NO_LX");
const hrst = hyAct(4, 4, { type: "resetGame" });
check("黄月英重置成功、bc/lx 清空", hrst.reset === true && HYT(hd[4]).bc.length === 0 && HYT(hd[4]).lx.length === 0);

// ═══════════════ 魔曹操:覆载虚拟装备(公开;结果由客户端解析后进 DO)═══════════════
const room5 = new RoomCore("8888", 5, () => 0);
const cd = {}; for (let i = 1; i <= 5; i++) { cd[i] = `cd${i}`; room5.claimSeat(cd[i], i); }
room5.setGeneral(cd[5], 5, "caocao");            // 座位5 = 魔曹操
const CT = (d) => room5.viewFor(d).seats[5].toolState;
const caoAct = (d, by, o) => room5.action(cd[d], { targetSeat: 5, bySeat: by, toolAction: o });
const wpn2 = { n: "青钢剑", r: 2, d: "无视防具" }, arm2 = { n: "藤甲", d: "免疫" };

console.log("\n=== 曹操1:设定覆载装备(公开)===");
const se = caoAct(5, 5, { type: "setEquip", hp: "2", wpn: wpn2, arm: arm2 });
check("曹操设定2血装备成功", se.ok === true, JSON.stringify(se));
check("DO 存下 hp/wpn/arm", CT(cd[5]).hp === "2" && CT(cd[5]).wpn.n === "青钢剑" && CT(cd[5]).wpn.r === 2);
check("★覆载公开:旁人座位1 也看得到武器/防具", CT(cd[1]).wpn.n === "青钢剑" && CT(cd[1]).arm.n === "藤甲");

console.log("\n=== 曹操2:重抽覆盖 + 合法性 + 权限 ===");
check("重抽(换4血)覆盖旧装备", caoAct(5, 5, { type: "setEquip", hp: "4", wpn: { n: "方天画戟", r: 4, d: "" }, arm: { n: "白银狮子", d: "" } }).ok && CT(cd[5]).hp === "4");
check("缺字段被拒(BAD_EQUIP)", caoAct(5, 5, { type: "setEquip", hp: "3" }).error === "BAD_EQUIP");
check("非曹操不能设定", caoAct(1, 1, { type: "setEquip", hp: "2", wpn: wpn2, arm: arm2 }).error === "NOT_CAO_ACTION");

console.log("\n=== 曹操3:重置 ===");
const crst = caoAct(5, 5, { type: "resetGame" });
check("曹操重置成功、装备清空", crst.reset === true && CT(cd[5]).hp === null && CT(cd[5]).wpn === null);
check("座位武将保留(仍是曹操)", room5.seats[5].general === "caocao");

// ═══════════════ 袁姬:镜花水月(牌名 ownerSeatOnly,张数/节言公开)═══════════════
const room6 = new RoomCore("9999", 5, () => 0);
const yd = {}; for (let i = 1; i <= 5; i++) { yd[i] = `yd${i}`; room6.claimSeat(yd[i], i); }
room6.setGeneral(yd[1], 1, "yuanji");            // 座位1 = 袁姬
const YT = (d) => room6.viewFor(d).seats[1].toolState;
const yjAct = (d, by, o) => room6.action(yd[d], { targetSeat: 1, bySeat: by, toolAction: o });

console.log("\n=== 袁姬1:加标记牌 —— 张数公开、牌名仅本人可见 ===");
check("加2张镜花成功", yjAct(1, 1, { type: "addCards", zone: "jh", n: 2 }).ok === true);
check("袁姬本人看到明细数组", Array.isArray(YT(yd[1]).jh) && YT(yd[1]).jh.length === 2);
check("★旁人只见张数(count),看不到明细", !Array.isArray(YT(yd[2]).jh) && YT(yd[2]).jh.count === 2);
const jhId = YT(yd[1]).jh[0].id;
check("填花色+点数+牌名成功、只本人可见", yjAct(1, 1, { type: "editCard", zone: "jh", id: jhId, s: "S", r: "7", n: "杀" }).ok && YT(yd[1]).jh[0].s === "S" && YT(yd[1]).jh[0].n === "杀");
check("★旁人仍只见张数,拿不到花色/牌名", !Array.isArray(YT(yd[3]).jh) && YT(yd[3]).jh.count === 2);
check("清花色(传空)成功", yjAct(1, 1, { type: "editCard", zone: "jh", id: jhId, s: null }).ok && YT(yd[1]).jh[0].s === null);

console.log("\n=== 袁姬2:归位2张触发节言提示 + 节言失效 ===");
const pj = yjAct(1, 1, { type: "placeZone", zone: "jh" });
check("归位恰好2张且节言有效 → triggerJieyan", pj.ok && pj.triggerJieyan === true);
check("归位后镜花清空(张数0)", YT(yd[2]).jh.count === 0);
check("节言判负(花色不同)→ off", yjAct(1, 1, { type: "jieyanResult", same: false }).jieyan === "off");
check("★节言状态公开:旁人也见 off", YT(yd[3]).jieyan === "off");
check("节言已失效时归位2张不再触发", (yjAct(1, 1, { type: "addCards", zone: "sy", n: 2 }), yjAct(1, 1, { type: "placeZone", zone: "sy" }).triggerJieyan) === false);
check("新回合重置节言 → ok", yjAct(1, 1, { type: "resetJieyan" }).ok && YT(yd[1]).jieyan === "ok");

console.log("\n=== 袁姬3:消散 + 权限 + 重置 ===");
yjAct(1, 1, { type: "addCards", zone: "jh", n: 1 });
const someId = YT(yd[1]).jh[0].id;
check("消散一张成功、张数减1", yjAct(1, 1, { type: "dissipate", zone: "jh", id: someId }).ok && YT(yd[1]).jh.length === 0);
check("非袁姬不能加牌", yjAct(2, 2, { type: "addCards", zone: "jh", n: 1 }).error === "NOT_YUANJI_ACTION");
check("非法区被拒(BAD_ZONE)", yjAct(1, 1, { type: "addCards", zone: "zz", n: 1 }).error === "BAD_ZONE");
const yrst = yjAct(1, 1, { type: "resetGame" });
check("袁姬重置成功、jh/sy 清空、节言回 ok", yrst.reset === true && YT(yd[1]).jh.length === 0 && YT(yd[1]).sy.length === 0 && YT(yd[1]).jieyan === "ok");

// ═══════════════ 标钟琰:博览生成技能(公开;随机在客户端,选定结果进 DO)═══════════════
const room7 = new RoomCore("1212", 5, () => 0);
const zd = {}; for (let i = 1; i <= 5; i++) { zd[i] = `zd${i}`; room7.claimSeat(zd[i], i); }
room7.setGeneral(zd[2], 2, "zhongyan");          // 座位2 = 标钟琰
const ZYT = (d) => room7.viewFor(d).seats[2].toolState;
const zyAct = (d, by, o) => room7.action(zd[d], { targetSeat: 2, bySeat: by, toolAction: o });

console.log("\n=== 钟琰1:选定技能(自己发动)—— 公开 + 入历史 ===");
const za = zyAct(2, 2, { type: "setActive", skill: { id: "qice", name: "奇策", text: "将所有手牌当一张普通锦囊使用。" }, owner: "self", cand: ["奇策", "制衡", "国色"] });
check("钟琰选定奇策成功", za.ok === true, JSON.stringify(za));
check("active 生效、owner=self", ZYT(zd[2]).active.name === "奇策" && ZYT(zd[2]).active.owner === "self");
check("★公开:旁人也看得到生效技能 + 候选历史", ZYT(zd[1]).active.name === "奇策" && ZYT(zd[1]).history[0].cand.length === 3);

console.log("\n=== 钟琰2:借技(带备注)+ 结束移除 ===");
const zb = zyAct(2, 2, { type: "setActive", skill: { id: "zhiheng", name: "制衡", text: "弃任意张牌摸等量。" }, owner: "lend", note: "3号位·反贼", cand: ["制衡", "奇策", "驱虎"] });
check("借技选定成功、owner=lend、note 记录", zb.ok && ZYT(zd[2]).active.owner === "lend" && ZYT(zd[2]).active.note === "3号位·反贼");
check("历史累计2条、seq=2", ZYT(zd[2]).history.length === 2 && ZYT(zd[2]).seq === 2);
check("结束移除 active(历史保留)", zyAct(2, 2, { type: "endActive" }).ok && ZYT(zd[2]).active === null && ZYT(zd[2]).history.length === 2);

console.log("\n=== 钟琰3:合法性 + 权限 + 重置 ===");
check("缺技能名被拒(BAD_SKILL)", zyAct(2, 2, { type: "setActive", skill: {}, owner: "self" }).error === "BAD_SKILL");
check("非钟琰不能选定", zyAct(1, 1, { type: "setActive", skill: { name: "奇策" }, owner: "self" }).error === "NOT_ZHONG_ACTION");
const zrst = zyAct(2, 2, { type: "resetGame" });
check("钟琰重置成功、active/history 清空、seq 回0", zrst.reset === true && ZYT(zd[2]).active === null && ZYT(zd[2]).history.length === 0 && ZYT(zd[2]).seq === 0);
check("座位武将保留(仍是钟琰)", room7.seats[2].general === "zhongyan");

// ═══════════════ 魔司马懿:谋变骤袭(全公开;随机在客户端,选定结果进 DO)═══════════════
const room8 = new RoomCore("3434", 5, () => 0);
const md = {}; for (let i = 1; i <= 5; i++) { md[i] = `md${i}`; room8.claimSeat(md[i], i); }
room8.setGeneral(md[3], 3, "simayi");            // 座位3 = 魔司马懿
const MT = (d) => room8.viewFor(d).seats[3].toolState;
const smAct = (d, by, o) => room8.action(md[d], { targetSeat: 3, bySeat: by, toolAction: o });

console.log("\n=== 司马懿1:诡伏记录 + 谋变入魔门槛 ===");
check("记录【杀】成功", smAct(3, 3, { type: "addRecord", name: "杀", recType: "card" }).ok === true);
check("重复记录被拒(REC_DUP)", smAct(3, 3, { type: "addRecord", name: "杀", recType: "card" }).error === "REC_DUP");
check("不满3项不能入魔(NEED_3_RECORDS)", smAct(3, 3, { type: "enterDemon" }).error === "NEED_3_RECORDS");
smAct(3, 3, { type: "addRecord", name: "决斗", recType: "card" });
smAct(3, 3, { type: "addRecord", name: "鸩毒", recType: "skill" });
check("★记录公开:旁人也看得到3项", MT(md[1]).records.length === 3);
const dm = smAct(3, 3, { type: "enterDemon", closed: ["鸩毒"] });
check("满3入魔成功、demonized、roundNo=1", dm.ok && MT(md[3]).demonized === true && MT(md[3]).roundNo === 1);
check("重复入魔被拒(ALREADY_DEMON)", smAct(3, 3, { type: "enterDemon" }).error === "ALREADY_DEMON");

console.log("\n=== 司马懿2:诡伏之闪 + 入魔轮结算 ===");
check("闪+1", smAct(3, 3, { type: "flashInc" }).flashes === 1);
check("闪不为负(dec 到0止)", (smAct(3, 3, { type: "flashDec" }), smAct(3, 3, { type: "flashDec" }).flashes) === 0);
check("未造成伤害结束本轮 → lostHp=true、roundNo→2", (() => { const r = smAct(3, 3, { type: "endRound" }); return r.lostHp === true && MT(md[3]).roundNo === 2; })());
check("造成伤害后结束本轮 → lostHp=false", (smAct(3, 3, { type: "toggleDmg" }), smAct(3, 3, { type: "endRound" }).lostHp === false));

console.log("\n=== 司马懿3:骤袭三选一(需先入魔)+ 公开持有 ===");
const pk = smAct(3, 3, { type: "pickSkill", skill: { skill: "刚烈", hero: "界夏侯惇", note: "受伤后判定反击" }, drew: ["刚烈", "驱虎", "强袭"] });
check("骤袭选定刚烈成功", pk.ok === true, JSON.stringify(pk));
check("held 生效、round=1", MT(md[3]).held.skill === "刚烈" && MT(md[3]).round === 1);
check("★公开:旁人看得到骤袭持有技 + 抽取历史", MT(md[2]).held.skill === "刚烈" && MT(md[2]).history[0].drew.length === 3);
check("下回合技能失效(clearHeld)", smAct(3, 3, { type: "clearHeld" }).ok && MT(md[3]).held === null);

console.log("\n=== 司马懿4:骤袭需入魔 + 权限 + 移除 + 重置 ===");
const room8b = new RoomCore("3535", 3, () => 0);
const mb = {}; for (let i = 1; i <= 3; i++) { mb[i] = `mb${i}`; room8b.claimSeat(mb[i], i); }
room8b.setGeneral(mb[1], 1, "simayi");
check("未入魔不能骤袭(NOT_DEMON)", room8b.action(mb[1], { targetSeat: 1, bySeat: 1, toolAction: { type: "pickSkill", skill: { skill: "x" } } }).error === "NOT_DEMON");
check("非司马懿不能记录", smAct(1, 1, { type: "addRecord", name: "杀", recType: "card" }).error === "NOT_SIMA_ACTION");
check("移除记录成功", smAct(3, 3, { type: "removeRecord", index: 0 }).ok && MT(md[3]).records.length === 2);
const mrst = smAct(3, 3, { type: "resetGame" });
check("重置:入魔/记录/骤袭清空、roundNo 回1", mrst.reset === true && MT(md[3]).demonized === false && MT(md[3]).records.length === 0 && MT(md[3]).roundNo === 1);
check("座位武将保留(仍是司马懿)", room8.seats[3].general === "simayi");

console.log(`\n结果: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
