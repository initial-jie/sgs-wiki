// 房间协议 "可执行规格" —— 吕布主动夺炁 + 本回合锁 + 狂魔转移 + 吕布被杀 + fallback 代持
// 复用与真实 Workers 同一份核心逻辑(./shared/room-logic.mjs)。rng 固定 ()=>0 复现随机分支。
// node prototype/room-sim.mjs

import { RoomCore, cardLabel, SQ_EFFECTS, DIANWEI_POOL, rollQiexie, XURONG_EFFECTS, pxComputeSlide, PEIXIU_MAPS, PUYUAN_FORGE } from "./shared/room-logic.mjs";

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

// ═══════════════ 谋董昭:先略(牌名 ownerSeatOnly 暗置)+ 顺机(公开台账·绑房间座位)═══════════════
const room9 = new RoomCore("5656", 5, () => 0);
const dzd = {}; for (let i = 1; i <= 5; i++) { dzd[i] = `dzd${i}`; room9.claimSeat(dzd[i], i); }
room9.setGeneral(dzd[2], 2, "dongzhao");         // 座位2 = 谋董昭
const DZT = (d) => room9.viewFor(d).seats[2].toolState;
const dzAct = (d, by, o) => room9.action(dzd[d], { targetSeat: 2, bySeat: by, toolAction: o });

console.log("\n=== 董昭1:先略记录 —— 牌名暗置仅本人可见,旁人只见有无 ===");
check("无记录时触发被拒(NO_RECORD)", dzAct(2, 2, { type: "xlTrigger" }).error === "NO_RECORD");
check("先略记录成功", dzAct(2, 2, { type: "xlRecord", name: "无中生有" }).ok === true);
check("董昭本人看得到牌名", Array.isArray(DZT(dzd[2]).rec) && DZT(dzd[2]).rec[0] === "无中生有");
check("★旁人只见有无记录(count=1),拿不到牌名", !Array.isArray(DZT(dzd[1]).rec) && DZT(dzd[1]).rec.count === 1);
check("★公开日志不泄露先略牌名", DZT(dzd[1]).log.every((l) => !l.includes("无中生有")));
check("重记录仍0或1张(覆盖)", dzAct(2, 2, { type: "xlRecord", name: "过河拆桥" }).ok && DZT(dzd[2]).rec.length === 1 && DZT(dzd[2]).rec[0] === "过河拆桥");

console.log("\n=== 董昭2:先略每回合限一次 + 新回合重置 ===");
check("先略触发成功、turnUsed 公开", dzAct(2, 2, { type: "xlTrigger" }).ok && DZT(dzd[1]).turnUsed === true);
check("本回合再触发被拒(ALREADY_TRIGGERED)", dzAct(2, 2, { type: "xlTrigger" }).error === "ALREADY_TRIGGERED");
check("新回合重置限次", dzAct(2, 2, { type: "xlNewTurn" }).ok && DZT(dzd[2]).turnUsed === false);

console.log("\n=== 董昭3:造王(限定技,公开)===");
check("造王发动、zw 公开", dzAct(2, 2, { type: "zwSet", on: true }).zw === true && DZT(dzd[1]).zw === true);
check("误触撤销造王", dzAct(2, 2, { type: "zwSet", on: false }).zw === false);

console.log("\n=== 董昭4:顺机座位限次 —— 绑房间座位号,公开台账 ===");
check("对座位4发动顺机(标记)", dzAct(2, 2, { type: "sjToggle", seatNo: 4 }).ok && DZT(dzd[2]).shunji.includes(4));
check("★公开:旁人也见 shunji 含座位4", DZT(dzd[3]).shunji.includes(4));
check("非法座位被拒(BAD_SEAT)", dzAct(2, 2, { type: "sjToggle", seatNo: 99 }).error === "BAD_SEAT");
check("再点取消标记", dzAct(2, 2, { type: "sjToggle", seatNo: 4 }).ok && !DZT(dzd[2]).shunji.includes(4));
dzAct(2, 2, { type: "sjToggle", seatNo: 1 }); dzAct(2, 2, { type: "sjToggle", seatNo: 5 });
const dze = dzAct(2, 2, { type: "sjEndRound" });
check("结束本轮:round→2 且 shunji 清空", dze.round === 2 && DZT(dzd[2]).shunji.length === 0);

console.log("\n=== 董昭5:顺机牌名账本(每名限一次,公开)===");
check("登记牌名【杀】成功", dzAct(2, 2, { type: "nameAdd", name: "杀" }).ok && DZT(dzd[2]).names.includes("杀"));
check("重复牌名被拒(NAME_DUP)", dzAct(2, 2, { type: "nameAdd", name: "杀" }).error === "NAME_DUP");
check("★公开:旁人也见牌名账本", DZT(dzd[3]).names.includes("杀"));
check("删除牌名成功", (dzAct(2, 2, { type: "nameAdd", name: "决斗" }), dzAct(2, 2, { type: "nameRm", index: 0 }).ok) && !DZT(dzd[2]).names.includes("杀"));

console.log("\n=== 董昭6:移势花色提醒(公开)===");
check("移势设♥提醒成功、公开", dzAct(2, 2, { type: "yishiSet", suit: "H" }).ok && DZT(dzd[1]).yishi === "H");
check("非法花色被拒(BAD_SUIT)", dzAct(2, 2, { type: "yishiSet", suit: "X" }).error === "BAD_SUIT");
check("清除移势提醒", dzAct(2, 2, { type: "yishiClear" }).ok && DZT(dzd[2]).yishi === null);

console.log("\n=== 董昭7:权限 + 重置 ===");
check("非董昭不能操作", dzAct(1, 1, { type: "xlRecord", name: "杀" }).error === "NOT_DONG_ACTION");
const dzrst = dzAct(2, 2, { type: "resetGame" });
check("董昭重置成功、rec/names/shunji 清空、round 回1", dzrst.reset === true && DZT(dzd[2]).rec.length === 0 && DZT(dzd[2]).names.length === 0 && DZT(dzd[2]).shunji.length === 0 && DZT(dzd[2]).round === 1);
check("座位武将保留(仍是董昭)", room9.seats[2].general === "dongzhao");

// ═══════════════ 神孙权:驭衡帝力(全公开生成器直通;随机在客户端,解析结果进 DO)═══════════════
const room10 = new RoomCore("7878", 5, () => 0);
const ssd = {}; for (let i = 1; i <= 5; i++) { ssd[i] = `ssd${i}`; room10.claimSeat(ssd[i], i); }
room10.setGeneral(ssd[3], 3, "shensunquan");     // 座位3 = 神孙权
const SST = (d) => room10.viewFor(d).seats[3].toolState;
const ssAct = (d, by, o) => room10.action(ssd[d], { targetSeat: 3, bySeat: by, toolAction: o });
const SK = (id, name) => ({ id, name, text: name + "的技能描述" });

console.log("\n=== 神孙权1:驭衡弃置随机获得(客户端 roll,结果进 DO;全公开)===");
check("设体力上限=4", ssAct(3, 3, { type: "setMaxHp", hp: 4 }).maxHp === 4);
const rl = ssAct(3, 3, { type: "rollYuheng", suits: ["s", "h"], skills: [SK("zhiheng", "制衡"), SK("anguo", "安国")] });
check("驭衡获得2个临时技能成功", rl.ok && SST(ssd[3]).temp.length === 2);
check("★公开:旁人也看得到临时技能名+全文", SST(ssd[1]).temp[0].name === "制衡" && SST(ssd[1]).temp[0].text.includes("制衡"));
check("临时技能生效时再驭衡被拒(TEMP_ACTIVE)", ssAct(3, 3, { type: "rollYuheng", suits: ["c"], skills: [SK("xiashu", "下书")] }).error === "TEMP_ACTIVE");
check("空技能列表被拒(NO_SKILLS)", (ssAct(3, 3, { type: "turnEnd" }), ssAct(3, 3, { type: "rollYuheng", suits: ["s"], skills: [] }).error === "NO_SKILLS"));

console.log("\n=== 神孙权2:回合结束失去临时技能 + 外来技能增删 ===");
ssAct(3, 3, { type: "rollYuheng", suits: ["s", "h", "c"], skills: [SK("zhiheng", "制衡"), SK("anguo", "安国"), SK("dimeng", "缔盟")] });
const te = ssAct(3, 3, { type: "turnEnd" });
check("回合结束:失去3临时技能、摸3张", te.drew === 3 && SST(ssd[3]).temp.length === 0);
check("添加外来技能成功、公开", ssAct(3, 3, { type: "addExt", name: "观星", note: "SP诸葛" }).ok && SST(ssd[1]).custom.length === 1 && SST(ssd[1]).custom[0].name === "观星");
const extId = SST(ssd[3]).custom[0].id;
check("移除外来技能成功", ssAct(3, 3, { type: "rmExt", id: extId }).ok && SST(ssd[3]).custom.length === 0);

console.log("\n=== 神孙权3:帝力觉醒 —— 失去技能换圣质/权道/持纲 + 临时固化 ===");
ssAct(3, 3, { type: "rollYuheng", suits: ["s", "h"], skills: [SK("zhiheng", "制衡"), SK("anguo", "安国")] });
ssAct(3, 3, { type: "addExt", name: "观星", note: "" });
const cId = SST(ssd[3]).custom[0].id;
// 失去:驭衡 + 1个临时(制衡) + 1个外来(观星) = 3个 → 获得圣质/权道/持纲
const aw = ssAct(3, 3, { type: "awaken", lose: ["yuheng", "t:zhiheng", "c:" + cId] });
check("觉醒成功、体力上限-1(4→3)", aw.ok && SST(ssd[3]).maxHp === 3);
check("失去驭衡(hasYuheng=false)", SST(ssd[3]).hasYuheng === false);
check("获得圣质/权道/持纲3个", SST(ssd[3]).gained.length === 3 && SST(ssd[3]).gained.join() === "shengzhi,quandao,chigang");
check("★驭衡已失去→未勾选的临时技能(安国)固化为永久", SST(ssd[3]).perm.length === 1 && SST(ssd[3]).perm[0].name === "安国" && SST(ssd[3]).temp.length === 0);
check("★公开:旁人看得到觉醒技能与永久技能", SST(ssd[2]).gained.length === 3 && SST(ssd[2]).perm[0].name === "安国");
check("重复觉醒被拒(ALREADY_AWAKENED)", ssAct(3, 3, { type: "awaken", lose: [] }).error === "ALREADY_AWAKENED");

console.log("\n=== 神孙权4:持纲翻面 + 觉醒回滚 ===");
check("持纲初始阳", SST(ssd[3]).chigangYang === true);
check("翻面→阴", ssAct(3, 3, { type: "flipChigang" }).yang === false && SST(ssd[3]).chigangYang === false);
const rb = ssAct(3, 3, { type: "rollbackAwaken" });
check("回滚觉醒成功", rb.ok === true);
check("回滚后体力上限恢复4、驭衡回来、觉醒清空", SST(ssd[3]).maxHp === 4 && SST(ssd[3]).hasYuheng === true && SST(ssd[3]).awakened === false && SST(ssd[3]).gained.length === 0);
check("无快照再回滚被拒(NO_SNAPSHOT)", ssAct(3, 3, { type: "rollbackAwaken" }).error === "NO_SNAPSHOT");

console.log("\n=== 神孙权5:权限 + 重置 ===");
check("非神孙权不能操作", ssAct(1, 1, { type: "setMaxHp", hp: 5 }).error === "NOT_SHEN_ACTION");
const ssrst = ssAct(3, 3, { type: "resetGame" });
check("重置成功、体力回4、技能/外来清空、驭衡回来", ssrst.reset === true && SST(ssd[3]).maxHp === 4 && SST(ssd[3]).custom.length === 0 && SST(ssd[3]).perm.length === 0 && SST(ssd[3]).hasYuheng === true && SST(ssd[3]).awakened === false);
check("座位武将保留(仍是神孙权)", room10.seats[3].general === "shensunquan");

// ═══════════════ 魔貂蝉:幻惑倾世(全公开台账 + 花名册绑座位;幻惑随机在 DO)═══════════════
const room11 = new RoomCore("9090", 5, () => 0); // rng=0 → roll 恒为第1张
const dcd = {}; for (let i = 1; i <= 5; i++) { dcd[i] = `dcd${i}`; room11.claimSeat(dcd[i], i); }
room11.setGeneral(dcd[1], 1, "diaochan");        // 座位1 = 魔貂蝉
for (let i = 2; i <= 5; i++) room11.setGeneral(dcd[i], i, "none"); // 其余座位在场(名字前端渲染)
const DCT = (d) => room11.viewFor(d).seats[1].toolState;
const dcAct = (d, by, o) => room11.action(dcd[d], { targetSeat: 1, bySeat: by, toolAction: o });

console.log("\n=== 貂蝉1:幻惑目标(至多2名,绑房间座位)+ 公开 ===");
check("指定幻惑目标座位2成功", dcAct(1, 1, { type: "hhToggle", pl: 2 }).ok && DCT(dcd[1]).hh.targets.includes(2));
check("★公开:旁人也见幻惑目标", DCT(dcd[3]).hh.targets.includes(2));
check("不能幻惑貂蝉自己(BAD_TARGET)", dcAct(1, 1, { type: "hhToggle", pl: 1 }).error === "BAD_TARGET");
check("再指定座位3、座位4 → 超2名被拒(HH_MAX_2)", (dcAct(1, 1, { type: "hhToggle", pl: 3 }), dcAct(1, 1, { type: "hhToggle", pl: 4 }).error === "HH_MAX_2"));
check("取消座位3", dcAct(1, 1, { type: "hhToggle", pl: 3 }).ok && !DCT(dcd[1]).hh.targets.includes(3));

console.log("\n=== 貂蝉2:幻惑向导 —— 报数→DO随机抽位置→强制使用/随机弃(共2次)===");
dcAct(1, 1, { type: "hhStart", pl: 2 });
check("开始向导→count-usable", DCT(dcd[1]).hh.wiz[2].stage === "count-usable");
const ru = dcAct(1, 1, { type: "hhRollUse", pl: 2, n: 4 });
check("报4张可用→DO抽中第1张(rng=0)、show-use", ru.roll === 1 && DCT(dcd[1]).hh.wiz[2].stage === "show-use");
check("★公开:被幻惑者本人也看得到自己的抽取结果", room11.viewFor(dcd[2]).seats[1].toolState.hh.wiz[2].roll === 1);
check("报0可用被拒(BAD_N)", dcAct(1, 1, { type: "hhRollUse", pl: 2, n: 0 }).error === "BAD_N");
dcAct(1, 1, { type: "hhUsed", pl: 2 });
check("已使用→uses=1、count-hand", DCT(dcd[1]).hh.wiz[2].uses === 1 && DCT(dcd[1]).hh.wiz[2].stage === "count-hand");
dcAct(1, 1, { type: "hhRollDiscard", pl: 2, n: 3 });
check("报3手牌→抽第1张弃、show-discard", DCT(dcd[1]).hh.wiz[2].roll === 1 && DCT(dcd[1]).hh.wiz[2].stage === "show-discard");
dcAct(1, 1, { type: "hhDiscarded", pl: 2 });
check("首轮弃置后未满2次→回 count-usable", DCT(dcd[1]).hh.wiz[2].stage === "count-usable");
dcAct(1, 1, { type: "hhRollUse", pl: 2, n: 2 }); dcAct(1, 1, { type: "hhUsed", pl: 2 });
const skip = dcAct(1, 1, { type: "hhRollDiscard", pl: 2, n: 0 });
check("第2次使用后报0手牌→跳过弃置且满2次→done", skip.skipped === true && DCT(dcd[1]).hh.wiz[2].stage === "done" && DCT(dcd[1]).hh.wiz[2].uses === 2);
check("无可用牌可随时终止", (dcAct(1, 1, { type: "hhToggle", pl: 5 }), dcAct(1, 1, { type: "hhStart", pl: 5 }), dcAct(1, 1, { type: "hhNoUsable", pl: 5 }).ok && DCT(dcd[1]).hh.wiz[5].stage === "ended"));

console.log("\n=== 貂蝉3:倾世入魔 + 分批分发 + 台账结算 ===");
check("未入魔不能分发(NOT_ENTERED)", dcAct(1, 1, { type: "qsDistribute", cards: [{ owner: 1, typ: "杀", s: "S", r: "7" }] }).error === "NOT_ENTERED");
check("入魔成功、公开", dcAct(1, 1, { type: "enterQingshi" }).ok && DCT(dcd[3]).entered === true);
check("重复入魔被拒(ALREADY_ENTERED)", dcAct(1, 1, { type: "enterQingshi" }).error === "ALREADY_ENTERED");
const dist = dcAct(1, 1, { type: "qsDistribute", cards: [
  { owner: 1, typ: "杀", s: "S", r: "7" }, { owner: 2, typ: "决斗", s: "H", r: "K" },
  { owner: 3, typ: "火杀", s: "D", r: "3" }, { owner: 4, typ: "其他", custom: "冰杀", s: "C", r: "9" }, { owner: 5, typ: "雷杀", s: "S", r: "A" }] });
check("第1批分发5张成功、batch=1", dist.batch === 1 && DCT(dcd[1]).qs.cards.length === 5);
check("★公开:旁人看得到倾世台账(座位+牌面)", DCT(dcd[3]).qs.cards[1].owner === 2 && DCT(dcd[3]).qs.cards[1].typ === "决斗");
check("倾世牌使用(未造成伤害)→used", dcAct(1, 1, { type: "qsUse", index: 1, dmg: false }).ok && DCT(dcd[1]).qs.cards[1].status === "used");
check("貂蝉自己的倾世牌造成伤害→dmgThisRound=true", dcAct(1, 1, { type: "qsUse", index: 0, dmg: true }).ok && DCT(dcd[1]).dmgThisRound === true);
check("非使用进弃牌堆→got(貂蝉获得)", dcAct(1, 1, { type: "qsGot", index: 2 }).ok && DCT(dcd[1]).qs.cards[2].status === "got");
check("其他方式离手→left", dcAct(1, 1, { type: "qsLeft", index: 3 }).ok && DCT(dcd[1]).qs.cards[3].status === "left");
check("误操作撤回→hand", dcAct(1, 1, { type: "qsUndo", index: 3 }).ok && DCT(dcd[1]).qs.cards[3].status === "hand");

console.log("\n=== 貂蝉4:每轮结算 + 阵亡追踪 + 权限 + 重置 ===");
check("结束本轮:round→2、清空幻惑、dmg 重置", (() => { const r = dcAct(1, 1, { type: "endRound" }); return r.ok && DCT(dcd[1]).round === 2 && DCT(dcd[1]).hh.targets.length === 0 && DCT(dcd[1]).dmgThisRound === false; })());
check("标记座位5阵亡、公开", dcAct(1, 1, { type: "toggleDead", pl: 5 }).ok && DCT(dcd[3]).dead.includes(5));
check("阵亡座位移出幻惑目标", (dcAct(1, 1, { type: "hhToggle", pl: 4 }), dcAct(1, 1, { type: "toggleDead", pl: 4 }), !DCT(dcd[1]).hh.targets.includes(4) && DCT(dcd[1]).dead.includes(4)));
check("取消阵亡", dcAct(1, 1, { type: "toggleDead", pl: 5 }).ok && !DCT(dcd[1]).dead.includes(5));
check("非貂蝉不能操作", dcAct(2, 2, { type: "hhToggle", pl: 3 }).error === "NOT_DIAO_ACTION");
const dcrst = dcAct(1, 1, { type: "resetGame" });
check("重置成功、入魔/台账/幻惑/阵亡清空、round 回1", dcrst.reset === true && DCT(dcd[1]).entered === false && DCT(dcd[1]).qs.cards.length === 0 && DCT(dcd[1]).hh.targets.length === 0 && DCT(dcd[1]).dead.length === 0 && DCT(dcd[1]).round === 1);
check("座位武将保留(仍是貂蝉)", room11.seats[1].general === "diaochan");

// ═══════════════ 魔孙权:权御暗选(secretPick 密封同时揭示)+ 天恩/乾纲 ═══════════════
const room12 = new RoomCore("1357", 5, () => 0);
const sd = {}; for (let i = 1; i <= 5; i++) { sd[i] = `sd${i}`; room12.claimSeat(sd[i], i); }
room12.setGeneral(sd[1], 1, "sunquan");          // 座位1 = 魔孙权
for (let i = 2; i <= 5; i++) room12.setGeneral(sd[i], i, "none");
const SQT = (d) => room12.viewFor(d).seats[1].toolState;
const sqAct = (d, by, o) => room12.action(sd[d], { targetSeat: 1, bySeat: by, toolAction: o });

console.log("\n=== 孙权1:权御暗选 —— 各自秘密选,翻开前谁都看不到内容(含孙权)===");
check("非孙权不能开启暗选", sqAct(2, 2, { type: "startPick" }).error === "NOT_SUN_ACTION");
check("孙权开启暗选→picking", sqAct(1, 1, { type: "startPick" }).ok && SQT(sd[1]).phase === "picking");
check("座位3为自己暗选白虹(0)成功", sqAct(3, 3, { type: "pick", effect: 0 }).ok);
check("座位3本人看得到自己的选择", SQT(sd[3]).picks[3].effect === 0 && SQT(sd[3]).picks[3].revealed === false);
check("★孙权也偷看不到座位3的内容(只见占位 hidden)", SQT(sd[1]).picks[3].hidden === true && SQT(sd[1]).picks[3].effect === undefined);
check("★旁人座位2也看不到座位3内容", SQT(sd[2]).picks[3].hidden === true);
check("孙权自己也暗选白虹(0)", sqAct(1, 1, { type: "pick", effect: 0 }).ok && SQT(sd[1]).picks[1].effect === 0);
check("★孙权的选择别人也看不到", SQT(sd[3]).picks[1].hidden === true && SQT(sd[3]).picks[1].effect === undefined);
check("能数出已选进度(座位1、3 各有占位)", Object.keys(SQT(sd[2]).picks).length === 2);
check("不能替别的座位选(BYSEAT_NOT_HELD)", sqAct(2, 3, { type: "pick", effect: 1 }).error === "BYSEAT_NOT_HELD");
check("非法效果被拒(BAD_EFFECT)", sqAct(3, 3, { type: "pick", effect: 9 }).error === "BAD_EFFECT");

console.log("\n=== 孙权2:同时翻开 —— DO 原子结算相同数与摸牌,全场公开 ===");
sqAct(2, 2, { type: "pick", effect: 0 }); // 座位2 白虹(与孙权同)
sqAct(4, 4, { type: "pick", effect: 1 }); // 座位4 青冥(不同)
sqAct(5, 5, { type: "pick", effect: 0 }); // 座位5 白虹(与孙权同)
const rv = sqAct(1, 1, { type: "reveal" });
check("翻开:与孙权相同3人(座位2/3/5)、孙权摸3张(至多3)", rv.match === 3 && rv.draw === 3);
check("★翻开后全场公开:旁人看得到孙权与各座位的选择", SQT(sd[4]).picks[1].effect === 0 && SQT(sd[4]).picks[3].effect === 0 && SQT(sd[4]).picks[3].revealed === true);
check("phase→revealed、lastReveal 记录", SQT(sd[1]).phase === "revealed" && SQT(sd[1]).lastReveal.match === 3 && SQT(sd[1]).lastReveal.draw === 3);
check("翻开后写入 used(每人所选记入历史,公开)", SQT(sd[2]).used["3"].includes(0) && SQT(sd[2]).used["4"].includes(1));

console.log("\n=== 孙权3:每人每项限一次 + 换项 ===");
sqAct(1, 1, { type: "endRound" });
check("结束本轮→round2、phase idle、picks 清空", SQT(sd[1]).round === 2 && SQT(sd[1]).phase === "idle" && Object.keys(SQT(sd[1]).picks).length === 0);
sqAct(1, 1, { type: "startPick" });
check("座位3重复选白虹被拒(EFFECT_USED)", sqAct(3, 3, { type: "pick", effect: 0 }).error === "EFFECT_USED");
check("座位3改选青冥(1)成功", sqAct(3, 3, { type: "pick", effect: 1 }).ok && SQT(sd[3]).picks[3].effect === 1);

console.log("\n=== 孙权4:天恩(不同项=目标本人选剑 / 相同项)+ 乾纲入魔失天恩 ===");
const tdi = sqAct(1, 1, { type: "teDiffInit", target: 4 });
check("孙权发起天恩·不同项→tePending 待座位4选、te.diff 尚未置真", tdi.ok && SQT(sd[2]).tePending.target === 4 && SQT(sd[1]).te.diff === false);
check("非目标座位2不能替选(NOT_TE_TARGET)", sqAct(2, 2, { type: "teDiffChoose", effect: 2 }).error === "NOT_TE_TARGET");
const tdc = sqAct(4, 4, { type: "teDiffChoose", effect: 2 });
check("★目标座位4本人选辟邪(2)→记入 used、te.diff 置真、tePending 清空、公开", tdc.ok && SQT(sd[2]).used["4"].includes(2) && SQT(sd[1]).te.diff === true && SQT(sd[1]).tePending === null);
check("发起天恩目标不能是孙权自己(BAD_TARGET)", sqAct(1, 1, { type: "teReset" }).ok && sqAct(1, 1, { type: "teDiffInit", target: 1 }).error === "BAD_TARGET");
check("天恩相同项开关、公开", sqAct(1, 1, { type: "teSame", on: true }).same === true && SQT(sd[3]).te.same === true);
check("天恩重置(含清 tePending)", sqAct(1, 1, { type: "teReset" }).ok && SQT(sd[1]).te.diff === false && SQT(sd[1]).te.same === false && SQT(sd[1]).tePending === null);
check("发动乾纲入魔、公开", sqAct(1, 1, { type: "gg", on: true }).gg === true && SQT(sd[4]).gg === true);
check("★入魔后天恩永久失效(GG_NO_TE)", sqAct(1, 1, { type: "teDiffInit", target: 4 }).error === "GG_NO_TE");
check("撤销入魔(误触回滚)", sqAct(1, 1, { type: "gg", on: false }).gg === false);

console.log("\n=== 孙权5:阵亡追踪 + 入魔反噬 + 权限 + 重置 ===");
check("标记座位5阵亡、公开", sqAct(1, 1, { type: "toggleAlive", seat: 5 }).ok && SQT(sd[3]).dead.includes(5));
check("阵亡座位不能暗选(DEAD)", (sqAct(5, 5, { type: "pick", effect: 3 })).error === "DEAD");
sqAct(1, 1, { type: "gg", on: true });
const er = sqAct(1, 1, { type: "endRound" }); // gg && 孙权存活 && 本轮未造成伤害 → 失体力
check("入魔本轮未造成伤害→结束时失1点体力", er.lostHp === true);
check("非孙权不能翻开", sqAct(2, 2, { type: "reveal" }).error === "NOT_SUN_ACTION");
check("SQ_EFFECTS 导出6项", SQ_EFFECTS.length === 6 && SQ_EFFECTS[0].n === "白虹");
const sqrst = sqAct(1, 1, { type: "resetGame" });
check("重置:轮次/暗选/used/天恩/乾纲/阵亡清空", sqrst.reset === true && SQT(sd[1]).round === 1 && Object.keys(SQT(sd[1]).picks).length === 0 && Object.keys(SQT(sd[1]).used).length === 0 && SQT(sd[1]).gg === false && SQT(sd[1]).dead.length === 0);
check("座位武将保留(仍是孙权)", room12.seats[1].general === "sunquan");

// ============ 场景 13:神将自选势力(setFaction,公开,cut 2)============
console.log("\n=== 场景 13:神将自选势力 ===");
const roomF = new RoomCore("1357", 4, () => 0);
const fd = {}; for (let i = 1; i <= 4; i++) { fd[i] = `fd${i}`; roomF.claimSeat(fd[i], i); }
roomF.setGeneral(fd[1], 1, "229");             // 座位1 = 神典韦(OL id 字符串,无工具)
check("初始 chosenFaction=null", roomF.seats[1].chosenFaction === null);
check("非持有者不能设势力", roomF.setFaction(fd[2], 1, "蜀").error === "NOT_HOLDER");
check("非法势力被拒", roomF.setFaction(fd[1], 1, "神").error === "BAD_FACTION");
check("本人设蜀成功", roomF.setFaction(fd[1], 1, "蜀").ok === true && roomF.seats[1].chosenFaction === "蜀");
check("chosenFaction 公开(他设备也看得到)", roomF.viewFor(fd[2]).seats[1].chosenFaction === "蜀");
check("可清空(null)", roomF.setFaction(fd[1], 1, null).ok === true && roomF.seats[1].chosenFaction === null);
roomF.setFaction(fd[1], 1, "吴");
roomF.setGeneral(fd[1], 1, "300");             // 改武将 → 自选势力重置
check("改武将后 chosenFaction 归零", roomF.seats[1].chosenFaction === null);

// ============ 场景 14:神典韦 挈挟 roll 池(生成器,cut 3)============
console.log("\n=== 场景 14:神典韦 挈挟 ===");
check("池共28张(16特殊+12白板)", DIANWEI_POOL.length === 28 && DIANWEI_POOL.filter(p => p.blank).length === 12);
const roll0 = rollQiexie(() => 0);
check("rng=0 抽5张确定性", roll0.length === 5 && roll0.map(p => p.name).join(",") === "关羽,赵云,马超,许褚,吕布");
check("关羽/张飞互斥(关羽在则无张飞)", roll0.some(p => p.name === "关羽") && !roll0.some(p => p.name === "张飞"));
const roomD = new RoomCore("2468", 4, () => 0);
const dd = {}; for (let i = 1; i <= 4; i++) { dd[i] = `dd${i}`; roomD.claimSeat(dd[i], i); }
roomD.setGeneral(dd[1], 1, "dianwei");
const dwAct = (by, o) => roomD.action(dd[by], { targetSeat: 1, bySeat: by, toolAction: o });
const DT = () => roomD.seats[1].toolState;
check("initToolState:slots2/round1/rolled null/weapons空", DT().slots === 2 && DT().round === 1 && DT().rolled === null && DT().weapons.length === 0);
check("非神典韦不能抽", dwAct(2, { type: "qiexie" }).error === "NOT_DW_ACTION");
dwAct(1, { type: "qiexie" });
check("挈挟抽出5张(公开可见)", DT().rolled.length === 5 && roomD.viewFor(dd[2]).seats[1].toolState.rolled.length === 5);
check("装备不在抽牌里的将被拒", dwAct(1, { type: "equipToggle", name: "貂蝉" }).error === "NOT_ROLLED");
dwAct(1, { type: "equipToggle", name: "关羽" });
dwAct(1, { type: "equipToggle", name: "赵云" });
check("装备2张成功", DT().weapons.length === 2 && DT().weapons[0].name === "关羽" && DT().weapons[0].range === 4);
check("满栏(slots=2)再装被拒", dwAct(1, { type: "equipToggle", name: "马超" }).error === "SLOTS_FULL");
dwAct(1, { type: "equipToggle", name: "关羽" }); // 卸下
check("卸下后可再装", DT().weapons.length === 1 && dwAct(1, { type: "equipToggle", name: "马超" }).ok === true && DT().weapons.length === 2);
dwAct(1, { type: "newTurn" });
check("下一轮:清抽牌、保留武器、轮次+1", DT().rolled === null && DT().weapons.length === 2 && DT().round === 2);
check("卸下已不在抽牌里的持留武器仍可(马超)", dwAct(1, { type: "equipToggle", name: "马超" }).ok === true && DT().weapons.length === 1);
check("重开清空", dwAct(1, { type: "resetGame" }).reset === true && DT().round === 1 && DT().weapons.length === 0 && DT().rolled === null);
check("重开后座位武将仍是神典韦", roomD.seats[1].general === "dianwei");

// ============ 场景 15:李傕 狼袭(0~2 掷伤害)============
console.log("\n=== 场景 15:李傕 狼袭 ===");
let ljRng = 0;
const roomL = new RoomCore("3690", 3, () => ljRng);
const ld = {}; for (let i = 1; i <= 3; i++) { ld[i] = `ld${i}`; roomL.claimSeat(ld[i], i); }
roomL.setGeneral(ld[1], 1, "lijue");
const ljAct = (by, o) => roomL.action(ld[by], { targetSeat: 1, bySeat: by, toolAction: o });
const LJT = () => roomL.seats[1].toolState;
check("init:round1/lastRoll null", LJT().round === 1 && LJT().lastRoll === null);
check("非李傕不能掷", ljAct(2, { type: "langxi" }).error === "NOT_LIJUE_ACTION");
ljRng = 0;    check("rng=0 → 0 伤害", ljAct(1, { type: "langxi" }).dmg === 0 && LJT().lastRoll === 0);
ljRng = 0.5;  check("rng=.5 → 1 伤害", ljAct(1, { type: "langxi" }).dmg === 1);
ljRng = 0.99; check("rng=.99 → 2 伤害(封顶2)", ljAct(1, { type: "langxi" }).dmg === 2);
roomL.action(ld[1], { targetSeat: 1, bySeat: 1, toolAction: { type: "newTurn" } });
check("下一轮:round2、lastRoll 清空", LJT().round === 2 && LJT().lastRoll === null);
check("重开", ljAct(1, { type: "resetGame" }).reset === true && LJT().round === 1);

// ============ 场景 16:徐荣 暴戾(凶镬发放/三选一结算 + 杀绝濒死+1)============
console.log("\n=== 场景 16:徐荣 暴戾 ===");
const roomX = new RoomCore("4812", 4, () => 0); // rng=0 → 结算恒为效果0(灼伤)
const xrd = {}; for (let i = 1; i <= 4; i++) { xrd[i] = `xrd${i}`; roomX.claimSeat(xrd[i], i); }
roomX.setGeneral(xrd[1], 1, "xurong");
const xrAct = (by, o) => roomX.action(xrd[by], { targetSeat: 1, bySeat: by, toolAction: o });
const XRT = () => roomX.seats[1].toolState;
check("XURONG_EFFECTS 三项", XURONG_EFFECTS.length === 3 && XURONG_EFFECTS[0].n === "灼伤");
check("init:marks3/pending空", XRT().marks === 3 && Object.keys(XRT().pending).length === 0);
check("满3枚时濒死+1被拒", xrAct(1, { type: "gainMark" }).error === "MARK_FULL");
check("给自己被拒", xrAct(1, { type: "giveMark", toSeat: 1 }).error === "BAD_TARGET");
xrAct(1, { type: "giveMark", toSeat: 2 });
check("给座位2一枚:marks2、pending[2]=1", XRT().marks === 2 && XRT().pending[2] === 1);
check("非徐荣不能发", xrAct(3, { type: "giveMark", toSeat: 2 }).error === "NOT_XURONG_ACTION");
xrAct(1, { type: "gainMark" });
check("濒死+1回到3", XRT().marks === 3);
check("无 pending 座位不能结算", xrAct(1, { type: "resolveMark", seat: 3 }).error === "NO_PENDING");
check("旁人(非徐荣非本座)不能结算座2", xrAct(3, { type: "resolveMark", seat: 2 }).error === "NOT_ALLOWED");
const xrRv = roomX.action(xrd[2], { targetSeat: 1, bySeat: 2, toolAction: { type: "resolveMark", seat: 2 } }); // 收暴戾者本人结算
check("座位2本人结算成功(rng0→灼伤)", xrRv.ok === true && xrRv.effect.n === "灼伤" && XRT().pending[2] === undefined);
check("lastResolve 公开可见", roomX.viewFor(xd[4]).seats[1].toolState.lastResolve.n === "灼伤");
check("重开:marks归3、pending/lastResolve清", xrAct(1, { type: "resetGame" }).reset === true && XRT().marks === 3 && XRT().lastResolve === null);

// ============ 场景 17:徐氏 龙鳞贝(投2枚阴/阳定贝 + 龙怒 + 天泣觉醒)============
console.log("\n=== 场景 17:徐氏 龙鳞贝 ===");
let xsSeq = [];
const roomXs = new RoomCore("2580", 3, () => (xsSeq.length ? xsSeq.shift() : 0)); // 每次投贝消耗2个值:<.5=阳 ≥.5=阴
const xsd = {}; for (let i = 1; i <= 3; i++) { xsd[i] = `xsd${i}`; roomXs.claimSeat(xsd[i], i); }
roomXs.setGeneral(xsd[1], 1, "xushi");
const xsAct = (by, o) => roomXs.action(xsd[by], { targetSeat: 1, bySeat: by, toolAction: o });
const XST = () => roomXs.seats[1].toolState;
check("init:龙怒0/未觉醒/无roll", XST().longnu === 0 && XST().awakened === false && XST().lastRoll === null);
check("非徐氏不能投", xsAct(2, { type: "rollBei" }).error === "NOT_XUSHI_ACTION");
xsSeq = [0, 0]; const xsR1 = xsAct(1, { type: "rollBei" });
check("双阳→阳贝+1龙怒", xsR1.roll.bei === "阳贝" && xsR1.roll.gain === 1 && XST().longnu === 1);
xsSeq = [0.9, 0.9]; const xsR2 = xsAct(1, { type: "rollBei" });
check("双阴→阴贝+2龙怒(共3)", xsR2.roll.bei === "阴贝" && xsR2.roll.gain === 2 && XST().longnu === 3);
xsSeq = [0, 0.9]; const xsR3 = xsAct(1, { type: "rollBei" });
check("一阴一阳→圣贝+0", xsR3.roll.bei === "圣贝" && xsR3.roll.gain === 0 && XST().longnu === 3);
check("龙怒公开可见", roomXs.viewFor(xsd[2]).seats[1].toolState.longnu === 3);
xsAct(1, { type: "adjustNu", delta: -1 }); check("守心移去1→2", XST().longnu === 2);
xsAct(1, { type: "adjustNu", delta: -10 }); check("龙怒不低于0", XST().longnu === 0);
check("觉醒开关 on", xsAct(1, { type: "toggleAwaken" }).awakened === true && XST().awakened === true);
check("再点撤销觉醒", xsAct(1, { type: "toggleAwaken" }).awakened === false);
xsAct(1, { type: "adjustNu", delta: 2 }); xsAct(1, { type: "toggleAwaken" });
check("重开:龙怒0/未觉醒", xsAct(1, { type: "resetGame" }).reset === true && XST().longnu === 0 && XST().awakened === false);

// ============ 场景 18:裴秀 十六州地图(展开/尽览推箱子走位/池/三选一/新回合)============
console.log("\n=== 场景 18:裴秀 十六州地图 ===");
let pxSeq = [];
const roomPx = new RoomCore("1616", 3, () => (pxSeq.length ? pxSeq.shift() : 0));
const pxd = {}; for (let i = 1; i <= 3; i++) { pxd[i] = `pxd${i}`; roomPx.claimSeat(pxd[i], i); }
roomPx.setGeneral(pxd[1], 1, "peixiu");
const pxAct = (by, o) => roomPx.action(pxd[by], { targetSeat: 1, bySeat: by, toolAction: o });
const PXT = () => roomPx.seats[1].toolState;
check("init:未展开/无token/池空", PXT().active === null && PXT().token === null && PXT().turnStates.length === 0 && PXT().cycle.length === 16);
check("非裴秀不能展开", pxAct(2, { type: "pxExpand", map: "并州" }).error === "NOT_PX_ACTION");
check("未展开时尽览NO_MAP", pxAct(1, { type: "pxGo", dir: "N" }).error === "NO_MAP");
check("空池结束阶段EMPTY_POOL", pxAct(1, { type: "pxEndPhase" }).error === "EMPTY_POOL");
const pe = pxAct(1, { type: "pxExpand", map: "并州" });
check("展开并州:active/token=start[3,0]/州技入池", pe.ok && PXT().active === "并州" && PXT().token.join() === "3,0" && PXT().turnStates[0] === "并州");
check("并州从无重复循环移除(剩15)", PXT().cycle.length === 15 && !PXT().cycle.includes("并州"));
// 尽览:北 从 [3,0] 爬到 雁门[3,4] 触发 move:down:2 → 停 [3,2](不继续滑)
const pg = pxAct(1, { type: "pxGo", dir: "N" });
check("★北尽览:雁门move:down:2触发→停[3,2]", pg.ok && PXT().token.join() === "3,2" && PXT().visited[1] === true);
check("雁门城技入池", PXT().turnCities.some((c) => c.name === "雁门" && c.map === "并州"));
check("东贴墙BLOCKED不移动", pxAct(1, { type: "pxGo", dir: "E" }).error === "BLOCKED" && PXT().token.join() === "3,2");
pxAct(1, { type: "pxGo", dir: "W" }); // [3,2]→九原[2,2]摸→停[1,2]
check("西:经九原停[1,2]", PXT().token.join() === "1,2" && PXT().visited[2] === true);
pxAct(1, { type: "pxGo", dir: "S" }); // [1,2]→祁县[1,1]摸→停[1,1]
pxAct(1, { type: "pxGo", dir: "E" }); // [1,1]→武乡[4,1]摸→停[4,1]
check("四城走完 visited=4", Object.keys(PXT().visited).length === 4 && PXT().token.join() === "4,1");
check("池=州技1 + 城技4", PXT().turnStates.length === 1 && PXT().turnCities.length === 4);
check("走位/池全场公开可见", roomPx.viewFor(pxd[2]).seats[1].toolState.token.join() === "4,1");
pxAct(1, { type: "pxResetToken" }); check("回起点[3,0](不清池)", PXT().token.join() === "3,0" && PXT().turnCities.length === 4);
pxSeq = [0, 0, 0, 0]; const ph = pxAct(1, { type: "pxEndPhase" });
check("结束阶段:池5→随机3候选", ph.ok && PXT().endChoices.length === 3);
const pc = pxAct(1, { type: "pxChoose", k: 0 });
check("三选一:选定→retained,清候选", pc.ok && PXT().retained && PXT().retained.pt && PXT().endChoices === null);
check("retained 全场公开可见", roomPx.viewFor(pxd[3]).seats[1].toolState.retained !== null);
check("坏候选 pxChoose 报错", pxAct(1, { type: "pxChoose", k: 9 }).error === "BAD_CHOICE");
pxSeq = [0]; const pn = pxAct(1, { type: "pxNewTurn" });
check("新回合:清池 + 茂著随机展开新图", pn.ok && PXT().turnCities.length === 0 && PXT().turnStates.length === 1 && PXT().active !== null && PXT().visited && Object.keys(PXT().visited).length === 0);
check("裴秀 retained 跨回合保留(持续到本回合结束)", PXT().retained !== null);
const prr = pxAct(1, { type: "resetGame" });
check("重置:active/池全清", prr.reset === true && PXT().active === null && PXT().turnStates.length === 0 && PXT().retained === null && PXT().cycle.length === 16);
check("非裴秀不能重置", pxAct(2, { type: "resetGame" }).error === "NOT_PX_ACTION");
// bug 修复 1:已画过的城市在完成该图前变惰性,再经过不触发/move 不停留(pxComputeSlide 纯函数单测)
const bing = PEIXIU_MAPS["并州"];
const slUnvisited = pxComputeSlide(bing, [3, 2], "N", {}); // 雁门未画:move:down:2 触发→停[3,2]
check("未画雁门:北滑触发 move→停[3,2]", slUnvisited.events.length === 1 && slUnvisited.path[slUnvisited.path.length - 1].join() === "3,2");
const slVisited = pxComputeSlide(bing, [3, 2], "N", { 1: true }); // 雁门已画:惰性,滑过到边界[3,4]不触发
check("★已画雁门:北滑过惰性城→停边界[3,4]不触发", slVisited.events.length === 0 && slVisited.path[slVisited.path.length - 1].join() === "3,4");
// bug 修复 2:陈留 move:right:1(兖州),新方向 right
const yan = PEIXIU_MAPS["兖州"];
check("陈留 icon = move:right:1", yan.cities.find((c) => c.name === "陈留").icon === "move:right:1");
const slChenliu = pxComputeSlide(yan, [1, 0], "W", {}); // 西入陈留[0,0]→move:right:1→[1,0]
check("★陈留 move:right:1:西入触发→右移1停[1,0]", slChenliu.events.length === 1 && slChenliu.events[0].city.name === "陈留" && slChenliu.path[slChenliu.path.length - 1].join() === "1,0");
// ★move 时序勘误(2026-07-16):先推到墙,再从墙位置走箭头 N 格(非到城即转向)
const slCd = pxComputeSlide(PEIXIU_MAPS["益州"], [2, 2], "N", {}); // 成都[2,3]move:down:2;北→先到墙[2,4]再南2→[2,2]
check("★成都:北滑先到墙[2,4]再向南2→停[2,2](非到成都即转)", slCd.events.some(e => e.city.name === "成都") && slCd.path[slCd.path.length - 1].join() === "2,2");
const slCdWall = pxComputeSlide(PEIXIU_MAPS["益州"], [2, 2], "N", {}).path.some(p => p.join() === "2,4");
check("★成都:滑行路径确实经过墙位[2,4]", slCdWall === true);
// move 撞墙夹停:豫州汝南 up:3 但顶行 y=4 全墙 → 只上移2格停[1,3](⚠ 若日后确认顶墙有误需同步改数据+此断言)
const slRunan = pxComputeSlide(PEIXIU_MAPS["豫州"], [1, 0], "N", {});
check("汝南 up:3 撞豫州顶墙夹停[1,3](只移2格)", slRunan.events[0].city.name === "汝南" && slRunan.path[slRunan.path.length - 1].join() === "1,3");

// ============ 场景 19:蒲元 神工锻造库(选类/锻造roll/去重占库存/销毁回池) ============
console.log("\n=== 场景 19:蒲元 神工锻造库 ===");
check("神工库 18 装备(武器6/防具6/宝物6)", PUYUAN_FORGE["武器"].length === 6 && PUYUAN_FORGE["防具"].length === 6 && PUYUAN_FORGE["宝物"].length === 6);
const roomPu = new RoomCore("5100", 3, () => 0); // rng=0 → shuffle 确定
const pud = {}; for (let i = 1; i <= 3; i++) { pud[i] = `pud${i}`; roomPu.claimSeat(pud[i], i); }
roomPu.setGeneral(pud[1], 1, "puyuan");
const puAct = (by, o) => roomPu.action(pud[by], { targetSeat: 1, bySeat: by, toolAction: o });
const PUT = () => roomPu.seats[1].toolState;
check("init:无类别/无锻造中", PUT().cat === null && PUT().active.length === 0 && PUT().rollId === 0);
check("非蒲元不能选类别", puAct(2, { type: "pySelCat", cat: "武器" }).error === "NOT_PY_ACTION");
check("未选类别不能锻造(NO_CAT)", puAct(1, { type: "pyForge", label: "完美锻造", n: 3 }).error === "NO_CAT");
check("坏副类别被拒(BAD_CAT)", puAct(1, { type: "pySelCat", cat: "坐骑" }).error === "BAD_CAT");
puAct(1, { type: "pySelCat", cat: "武器" });
const pf = puAct(1, { type: "pyForge", label: "完美锻造", n: 3 });
check("完美锻造抽3张", pf.ok && PUT().rolled.length === 3 && PUT().result.short === false);
puAct(1, { type: "pyPick", i: 0 });
check("选定→进锻造中(active=1)", PUT().active.length === 1 && PUT().active[0].card.name);
check("锻造中全场公开", roomPu.viewFor(pud[2]).seats[1].toolState.active.length === 1);
// 同一 roll 换选:pick 另一张仍只 1 件(不叠加)
puAct(1, { type: "pyForge", label: "成功", n: 2 });
puAct(1, { type: "pyPick", i: 0 }); puAct(1, { type: "pyPick", i: 1 });
check("同一roll换选不叠加(active=2:上次1+本次1)", PUT().active.length === 2);
// 连锻至库存不足
while (PUT().active.filter(a => a.cat === "武器").length < 5) { puAct(1, { type: "pyForge", label: "完美锻造", n: 3 }); puAct(1, { type: "pyPick", i: 0 }); }
const wCount = PUT().active.filter(a => a.cat === "武器").length;
check("武器已占5件且互不相同", wCount === 5 && new Set(PUT().active.filter(a => a.cat === "武器").map(a => a.card.name)).size === 5);
puAct(1, { type: "pyForge", label: "完美锻造", n: 3 });
check("★库存不足:完美3张缩到1张 + short", PUT().rolled.length === 1 && PUT().result.short === true);
const activeSet = new Set(PUT().active.map(a => a.card.name));
check("★候选排除锻造中的装备", PUT().rolled.every(c => !activeSet.has(c.name)));
// 销毁 → 回池可再抽
const destroyName = PUT().active.find(a => a.cat === "武器").card.name;
const did = PUT().active.find(a => a.cat === "武器").id;
puAct(1, { type: "pyDestroy", id: did });
check("销毁→active 减1", !PUT().active.some(a => a.id === did));
let reappeared = false; for (let k = 0; k < 12; k++) { puAct(1, { type: "pyForge", label: "完美锻造", n: 3 }); if (PUT().rolled.some(c => c.name === destroyName)) { reappeared = true; break; } }
check("★销毁的装备回池可再抽到", reappeared);
check("销毁不存在的 id 被拒(NO_ACTIVE)", puAct(1, { type: "pyDestroy", id: "nope" }).error === "NO_ACTIVE");
check("非蒲元不能重开", puAct(2, { type: "resetGame" }).error === "NOT_PY_ACTION");
check("重开→清空类别/锻造中", puAct(1, { type: "resetGame" }).reset === true && PUT().active.length === 0 && PUT().cat === null);

// 蒲元·助力/妨害征集(房间投票结算):全场含蒲元表态、实时公开、选后不可改、可弃权、蒲元手动结算、按点数和定结果
console.log("\n--- 蒲元 助力/妨害投票结算 ---");
let puvSeq = [];
const roomPv = new RoomCore("5200", 4, () => (puvSeq.length ? puvSeq.shift() : 0));
const pvd = {}; for (let i = 1; i <= 4; i++) { pvd[i] = `pvd${i}`; roomPv.claimSeat(pvd[i], i); }
roomPv.setGeneral(pvd[1], 1, "puyuan");
roomPv.setGeneral(pvd[2], 2, "caocao"); roomPv.setGeneral(pvd[3], 3, "nanhua"); roomPv.setGeneral(pvd[4], 4, "lvbu");
const pv = (by, o) => roomPv.action(pvd[by], { targetSeat: 1, bySeat: by, toolAction: o });
const PVT = () => roomPv.seats[1].toolState;
pv(1, { type: "pySelCat", cat: "武器" });
pv(1, { type: "pyStartVote" });
check("发起征集→进投票模式", !!PVT().vote && PVT().vote.settled === false);
check("投票模式手动锻造被禁(VOTE_MODE)", pv(1, { type: "pyForge", label: "完美锻造", n: 3 }).error === "VOTE_MODE");
puvSeq = [0.35]; pv(1, { type: "pyVote", choice: "help" }); // 蒲元本人也投:助力 1+floor(0.35*13)=5
check("★蒲元本人也参与投票(助力5)", PVT().vote.entries[1].choice === "help" && PVT().vote.entries[1].point === 5);
check("★选后不可更改(ALREADY_VOTED)", pv(1, { type: "pyVote", choice: "hinder" }).error === "ALREADY_VOTED");
puvSeq = [0.58]; pv(2, { type: "pyVote", choice: "hinder" }); // 8
check("座位2 妨害·点数8(实时公开)", PVT().vote.entries[2].point === 8 && roomPv.viewFor(pvd[3]).seats[1].toolState.vote.entries[2].point === 8);
pv(3, { type: "pyVote", choice: "abstain" });
check("★弃权:记录且无点数", PVT().vote.entries[3].choice === "abstain" && PVT().vote.entries[3].point === undefined);
check("坏选项被拒(BAD_CHOICE)", pv(4, { type: "pyVote", choice: "xx" }).error === "BAD_CHOICE");
puvSeq = [0, 0, 0, 0, 0]; const stl = pv(1, { type: "pySettle" }); // 助力(蒲元5) vs 妨害(座2:8) → 5<8 失败(1)
check("★结算含蒲元票:助力5<妨害8→失败(1张)", stl.ok && PVT().result.label === "失败" && PVT().result.helpSum === 5 && PVT().result.hinderSum === 8);
pv(1, { type: "pyPick", i: 0 });
check("投票结算后蒲元可选定入库存", PVT().active.length === 1);
// 无人妨害 = 完美锻造(3):蒲元助力 + 旁人弃权
pv(1, { type: "pySelCat", cat: "防具" });
check("重选类别→清投票+回手动模式", PVT().vote === null && PVT().cat === "防具");
pv(1, { type: "pyStartVote" });
puvSeq = [0.35]; pv(1, { type: "pyVote", choice: "help" }); pv(2, { type: "pyVote", choice: "abstain" });
puvSeq = [0, 0, 0, 0, 0]; pv(1, { type: "pySettle" });
check("★无人妨害=完美锻造(3张)", PVT().result.label === "完美锻造" && PVT().result.n === 3);
// 助力和 = 妨害和 → 成功
pv(1, { type: "pySelCat", cat: "宝物" }); pv(1, { type: "pyStartVote" });
check("非蒲元不能揭示结算", pv(2, { type: "pySettle" }).error === "NOT_PY_ACTION");
puvSeq = [0.7]; pv(1, { type: "pyVote", choice: "help" }); // 1+floor(0.7*13)=10
puvSeq = [0.7]; pv(2, { type: "pyVote", choice: "hinder" }); // 10
puvSeq = [0, 0, 0, 0, 0]; pv(1, { type: "pySettle" });
check("助力和=妨害和→成功(2张)", PVT().result.label === "成功" && PVT().result.n === 2 && PVT().result.helpSum === 10 && PVT().result.hinderSum === 10);

// ═══════════════ 座位独占 + 解锁替换(③)═══════════════
console.log("\n=== 座位独占 + 解锁替换 ===");
const rmSeat = new RoomCore("2468", 4, () => 0);
check("设备A认领座位1成功", rmSeat.claimSeat("A", 1).ok && rmSeat.seats[1].holderDevices.length === 1);
check("★设备B再认领座位1被拒(SEAT_TAKEN)、指出持有者", (() => { const r = rmSeat.claimSeat("B", 1); return r.error === "SEAT_TAKEN" && r.by === "A"; })());
check("同一设备A重复认领幂等(仍单一持有)", rmSeat.claimSeat("A", 1).ok && rmSeat.seats[1].holderDevices.length === 1 && rmSeat.seats[1].holderDevices[0] === "A");
const tk = rmSeat.takeoverSeat("B", 1);
check("★设备B解锁替换座位1→独占、原持有者A被撤下", tk.ok && tk.took === "A" && rmSeat.seats[1].holderDevices[0] === "B" && !rmSeat.devices["A"].holds.has(1));
check("A 不再持有座位1(viewFor 不含)", !rmSeat.viewFor("A").youHold.includes(1) && rmSeat.viewFor("B").youHold.includes(1));
check("一个设备仍可持有多个座位", rmSeat.claimSeat("B", 2).ok && rmSeat.viewFor("B").youHold.includes(1) && rmSeat.viewFor("B").youHold.includes(2));

// ═══════════════ 持久化 serialize/hydrate(①)═══════════════
console.log("\n=== 房间持久化(serialize/hydrate)===");
const rmP = new RoomCore("9753", 5, () => 0);
rmP.claimSeat("dv1", 1); rmP.setGeneral("dv1", 1, "sunquan");
rmP.claimSeat("dv2", 2); rmP.claimSeat("dv2", 3);
rmP.action("dv1", { targetSeat: 1, bySeat: 1, toolAction: { type: "startPick" } });
const snap = JSON.parse(JSON.stringify(rmP.serialize())); // 模拟经 DO storage JSON 往返
const rmH = RoomCore.hydrate(snap);
check("hydrate 恢复座位武将", rmH.seats[1].general === "sunquan");
check("hydrate 恢复工具状态(phase=picking)", rmH.seats[1].toolState.phase === "picking");
check("★hydrate 恢复设备 holds(Set)", rmH.devices["dv2"].holds.has(2) && rmH.devices["dv2"].holds.has(3) && rmH.viewFor("dv1").youHold.includes(1));
check("恢复后可继续操作(座位独占仍生效)", rmH.claimSeat("dvX", 1).error === "SEAT_TAKEN");

// ═══════════════ 标郭照:椒遇声明色(公开)+ 内训牌标记(牌名 ownerSeatOnly,张数公开)═══════════════
const roomGz = new RoomCore("6262", 5, () => 0);
const gzd = {}; for (let i = 1; i <= 5; i++) { gzd[i] = `gzd${i}`; roomGz.claimSeat(gzd[i], i); }
roomGz.setGeneral(gzd[1], 1, "guozhao");          // 座位1 = 标郭照
const GZT = (d) => roomGz.viewFor(d).seats[1].toolState;
const gzAct = (d, by, o) => roomGz.action(gzd[d], { targetSeat: 1, bySeat: by, toolAction: o });

console.log("\n=== 郭照1:椒遇声明色(全场公开)===");
check("声明黑成功", gzAct(1, 1, { type: "setColor", color: "black" }).ok && GZT(gzd[1]).color === "black");
check("★声明色对旁人公开", GZT(gzd[3]).color === "black");
check("改声明红", gzAct(1, 1, { type: "setColor", color: "red" }).ok && GZT(gzd[2]).color === "red");
check("清除声明色(null)", gzAct(1, 1, { type: "setColor", color: null }).ok && GZT(gzd[1]).color === null);
check("非法颜色被拒(BAD_COLOR)", gzAct(1, 1, { type: "setColor", color: "green" }).error === "BAD_COLOR");
check("非郭照不能声明色(NOT_GZ_ACTION)", gzAct(2, 2, { type: "setColor", color: "black" }).error === "NOT_GZ_ACTION");

console.log("\n=== 郭照2:内训牌标记 —— 张数公开、牌名仅本人可见 ===");
check("加1张内训牌成功", gzAct(1, 1, { type: "addNeixun" }).ok && GZT(gzd[1]).neixun.length === 1);
check("★旁人只见张数(count),看不到明细", !Array.isArray(GZT(gzd[2]).neixun) && GZT(gzd[2]).neixun.count === 1);
const nxId = GZT(gzd[1]).neixun[0].id;
check("填花色+点数+牌名成功、仅本人可见", gzAct(1, 1, { type: "editNeixun", id: nxId, s: "H", r: "K", n: "桃" }).ok && GZT(gzd[1]).neixun[0].s === "H" && GZT(gzd[1]).neixun[0].n === "桃");
check("★旁人仍只见张数,拿不到花色/牌名", !Array.isArray(GZT(gzd[3]).neixun) && GZT(gzd[3]).neixun.count === 1);
check("非郭照不能加内训牌", gzAct(2, 2, { type: "addNeixun" }).error === "NOT_GZ_ACTION");

console.log("\n=== 郭照3:消散 + 回合结束清空 + 重置 ===");
gzAct(1, 1, { type: "addNeixun" }); // 现2张
check("现有2张内训牌", GZT(gzd[1]).neixun.length === 2);
check("消散一张(离手)成功、张数减1", gzAct(1, 1, { type: "dissipateNeixun", id: nxId }).ok && GZT(gzd[1]).neixun.length === 1);
check("消散不存在的牌被拒(NO_CARD)", gzAct(1, 1, { type: "dissipateNeixun", id: "zzz" }).error === "NO_CARD");
check("★回合结束→所有内训标记消散", gzAct(1, 1, { type: "endTurn" }).ok && GZT(gzd[1]).neixun.length === 0);
gzAct(1, 1, { type: "setColor", color: "black" }); gzAct(1, 1, { type: "addNeixun" });
const grst = gzAct(1, 1, { type: "resetGame" });
check("郭照重置成功、声明色清空、内训清空", grst.reset === true && GZT(gzd[1]).color === null && GZT(gzd[1]).neixun.length === 0);

// ═══════════ 全场状态面板(#1):血量/翻面/横置/连环/阵亡 —— 全公开,任意座位可改任意座位 ═══════════
const roomPanel = new RoomCore("7070", 5, () => 0);
const pd = {}; for (let i = 1; i <= 5; i++) { pd[i] = `pd${i}`; roomPanel.claimSeat(pd[i], i); }
roomPanel.setGeneral(pd[1], 1, "guozhao");  // 座位1 有武将
roomPanel.setGeneral(pd[2], 2, "lvbu");     // 座位2 有武将;座位3 故意留空(无武将)
const PV = (d, n) => roomPanel.viewFor(d).seats[n];
const pAct = (d, tgt, o) => roomPanel.action(pd[d], { targetSeat: tgt, bySeat: d, toolAction: o });

console.log("\n=== 面板1:血量播种 + 绝对置数 + 上限夹取(全公开)===");
check("初始未播种 hp/hpMax=null", PV(pd[1], 1).hp === null && PV(pd[1], 1).hpMax === null);
check("播种体力上限4 → hp=hpMax=4", pAct(1, 1, { type: "panelSetHpMax", hp: 4 }).ok && PV(pd[1], 1).hp === 4 && PV(pd[1], 1).hpMax === 4);
check("★面板对旁人公开(dev2 看座位1 血量=4)", PV(pd[2], 1).hp === 4);
check("绝对置数 hp=2", pAct(1, 1, { type: "panelSetHp", hp: 2 }).ok && PV(pd[1], 1).hp === 2);
check("置数超上限被夹到4", pAct(1, 1, { type: "panelSetHp", hp: 9 }).ok && PV(pd[1], 1).hp === 4);
check("置数负数被夹到0(濒死)", pAct(1, 1, { type: "panelSetHp", hp: -3 }).ok && PV(pd[1], 1).hp === 0);
check("调低上限3→当前血夹到3", (pAct(1, 1, { type: "panelSetHp", hp: 4 }), pAct(1, 1, { type: "panelSetHpMax", hp: 3 }).ok) && PV(pd[1], 1).hp === 3 && PV(pd[1], 1).hpMax === 3);

console.log("\n=== 面板2:翻面/横置/连环 切换 + 阵亡 ===");
check("翻面 toggle on", pAct(1, 1, { type: "panelToggle", flag: "flipped" }).ok && PV(pd[1], 1).flipped === true);
check("翻面 toggle off", pAct(1, 1, { type: "panelToggle", flag: "flipped" }).ok && PV(pd[1], 1).flipped === false);
check("横置 on", pAct(1, 1, { type: "panelToggle", flag: "tapped" }).ok && PV(pd[1], 1).tapped === true);
check("连环 on", pAct(1, 1, { type: "panelToggle", flag: "chained" }).ok && PV(pd[1], 1).chained === true);
check("非法 flag 被拒(BAD_FLAG)", pAct(1, 1, { type: "panelToggle", flag: "zzz" }).error === "BAD_FLAG");
check("阵亡置 true", pAct(1, 1, { type: "panelSetDead", dead: true }).ok && PV(pd[1], 1).dead === true);
check("复生置 false", pAct(1, 1, { type: "panelSetDead", dead: false }).ok && PV(pd[1], 1).dead === false);

console.log("\n=== 面板3:任意座位可改任意座位(无 holder 守卫)+ 空座位拒绝 + 换将重置 ===");
check("★dev2 改座位1血量(跨座位无守卫)成功", pAct(2, 1, { type: "panelSetHp", hp: 1 }).ok && PV(pd[1], 1).hp === 1);
check("★dev1 改座位2翻面(跨座位)成功", pAct(1, 2, { type: "panelToggle", flag: "flipped" }).ok && PV(pd[1], 2).flipped === true);
check("空座位(无武将)面板动作被拒(BAD_TARGET)", pAct(1, 3, { type: "panelSetHp", hp: 3 }).error === "BAD_TARGET");
pAct(1, 1, { type: "panelToggle", flag: "chained" }); // 座位1 先挂上连环+血量
roomPanel.setGeneral(pd[1], 1, "simayi");             // 换武将
check("★换武将→面板全重置(hp/hpMax=null,翻面/横置/连环/阵亡=false)",
  PV(pd[1], 1).hp === null && PV(pd[1], 1).hpMax === null && PV(pd[1], 1).flipped === false && PV(pd[1], 1).tapped === false && PV(pd[1], 1).chained === false && PV(pd[1], 1).dead === false);

console.log(`\n结果: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
