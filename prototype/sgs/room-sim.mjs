// 房间协议 "可执行规格" —— 吕布主动夺炁 + 本回合锁 + 狂魔转移 + 吕布被杀 + fallback 代持
// 复用与真实 Workers 同一份核心逻辑(./shared/room-logic.mjs)。rng 固定 ()=>0 复现随机分支。
// node prototype/sgs/room-sim.mjs

import { RoomCore, cardLabel, SQ_EFFECTS, DIANWEI_POOL, rollQiexie, XURONG_EFFECTS, pxComputeSlide, PEIXIU_MAPS, PUYUAN_FORGE, setBannedPools, banPoolForSeats } from "./shared/room-logic.mjs";

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

console.log("\n=== 场景 5b:房内改名(原子改键,座位归属不丢)===");
check("改名空串被拒(EMPTY_NAME)", room.renameDevice(dev[5], "   ").error === "EMPTY_NAME");
check("改名撞已占名被拒(NAME_TAKEN)", room.renameDevice(dev[5], dev[1]).error === "NAME_TAKEN");
check("改名成同名=no-op ok", room.renameDevice(dev[5], dev[5]).ok === true);
const rnm = room.renameDevice(dev[5], "阿强");
check("改名成功返回 newId", rnm.ok === true && rnm.newId === "阿强");
check("新名保留原 holds [5,2]", eqSet(room.viewFor("阿强").youHold, [5, 2]));
check("旧名 device 已移除(youHold 空)", eqSet(room.viewFor(dev[5]).youHold, []));
check("座位2 holderDevices 已改到新名", room.seats[2].holderDevices.includes("阿强") && !room.seats[2].holderDevices.includes(dev[5]));
check("改名后仍能以新名操作座位(代座位2登记)", room.action("阿强", { targetSeat: 1, bySeat: 2, toolAction: { type: "registerQi", cards: [{ s: "S", r: "K", n: "杀" }] } }).ok === true);
check("改名进 serialize→hydrate 存活", (() => { const h = RoomCore.hydrate(room.serialize()); return h.seats[2].holderDevices.includes("阿强"); })());
room.renameDevice("阿强", dev[5]); // 复原,避免影响后续场景

console.log("\n=== 场景 5c:禁将四池(按座位数选池)+ 房内总开关 ===");
{
  // 军争池禁 曹婴(id)+神典韦(工具名);斗地主池禁 刘备(1);2v2/1v1 空
  setBannedPools({ junzheng: ["353", "dianwei"], "2v2": [], douzhu: ["1"], "1v1": [] });
  check("座位数→池映射", banPoolForSeats(8) === "junzheng" && banPoolForSeats(5) === "junzheng"
    && banPoolForSeats(4) === "2v2" && banPoolForSeats(3) === "douzhu" && banPoolForSeats(2) === "1v1");
  // 5 座 → 军争池
  const rb = new RoomCore("9099", 5, () => 0);
  const bd = {}; for (let i = 1; i <= 5; i++) { bd[i] = `bd${i}`; rb.claimSeat(bd[i], i); }
  check("默认 banEnabled=true", rb.banEnabled === true);
  check("军争池:禁将(id)落座被拒", rb.setGeneral(bd[1], 1, "353").error === "BANNED");
  check("军争池:禁将(工具名)落座被拒", rb.setGeneral(bd[1], 1, "dianwei").error === "BANNED");
  check("军争池:斗地主池的将不受影响", rb.setGeneral(bd[1], 1, "1").ok === true);
  check("viewFor 暴露 banEnabled/banPool", rb.viewFor(bd[2]).banEnabled === true && rb.viewFor(bd[2]).banPool === "junzheng");
  // 总开关关掉 → 全部放行
  rb.setBanEnabled(false);
  check("关掉开关后禁将可落座", rb.setGeneral(bd[1], 1, "353").ok === true && rb.seats[1].general === "353");
  check("viewFor 反映开关已关", rb.viewFor(bd[2]).banEnabled === false);
  rb.setBanEnabled(true);
  check("重新打开后又拦住", rb.setGeneral(bd[1], 1, "dianwei").error === "BANNED");
  check("开关进序列化/hydrate", (() => { rb.setBanEnabled(false); const h = RoomCore.hydrate(rb.serialize()); return h.banEnabled === false; })());
  rb.setBanEnabled(true);
  // 减到 3 座 → 换斗地主池(军争池的禁将放行、斗地主池的被拦)
  rb.removeSeat(bd[1]); rb.removeSeat(bd[1]);
  check("减到 3 座 → 池切到斗地主", Object.keys(rb.seats).length === 3 && rb.viewFor(bd[2]).banPool === "douzhu");
  check("斗地主池:刘备(1)被拒", rb.setGeneral(bd[1], 1, "1").error === "BANNED");
  check("斗地主池:军争池的曹婴放行", rb.setGeneral(bd[1], 1, "353").ok === true);
  setBannedPools({});
}

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
check("五势力全可选(含晋)", ["魏","蜀","吴","群","晋"].every((f) => roomF.setFaction(fd[1], 1, f).ok === true && roomF.seats[1].chosenFaction === f));
roomF.setFaction(fd[1], 1, "蜀"); // 复原,后续断言依赖
check("chosenFaction 公开(他设备也看得到)", roomF.viewFor(fd[2]).seats[1].chosenFaction === "蜀");
check("可清空(null)", roomF.setFaction(fd[1], 1, null).ok === true && roomF.seats[1].chosenFaction === null);
roomF.setFaction(fd[1], 1, "吴");
roomF.setGeneral(fd[1], 1, "300");             // 改武将 → 自选势力重置
check("改武将后 chosenFaction 归零", roomF.seats[1].chosenFaction === null);

// ============ 场景 14:神典韦 挈挟 roll 池(生成器,cut 3)============
console.log("\n=== 场景 14:神典韦 挈挟 ===");
check("池共33张(21特殊+12白板)", DIANWEI_POOL.length === 33 && DIANWEI_POOL.filter(p => p.blank).length === 12);
check("新增5将在池(神赵云/界陈宫/界太史慈/界夏侯氏/界刘禅)", ["神赵云", "界陈宫", "界太史慈", "界夏侯氏", "界刘禅"].every(n => DIANWEI_POOL.some(p => p.name === n && !p.blank && p.skills.length === 1)));
check("神赵云权重 0.5,其余无权重(默认1)", DIANWEI_POOL.find(p => p.name === "神赵云").w === 0.5 && DIANWEI_POOL.filter(p => p.w != null).length === 1);
// 加权统计:固定 LCG 跑 4000 次,神赵云出现率应≈赵云的一半(容差 ±25%);每次恰 5 张且不重复
{
  let seed = 12345; const lcg = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  let shen = 0, zhao = 0, bad = 0;
  for (let i = 0; i < 4000; i++) { const r = rollQiexie(lcg); if (r.length !== 5 || new Set(r.map(p => p.name)).size !== 5) bad++; for (const p of r) { if (p.name === "神赵云") shen++; if (p.name === "赵云") zhao++; } }
  const ratio = shen / zhao;
  check(`加权抽取:神赵云/赵云 出现比 ${ratio.toFixed(2)}(期望≈0.5)`, ratio > 0.375 && ratio < 0.625);
  check("4000 次抽取每次恰 5 张不重复", bad === 0);
}
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
// equipCard:神典韦装常规军争武器(#2 单一数据源=同一 weapons[])
const zhu = { name: "诸葛连弩", suit: "C", rank: "A", range: 1 };
check("非神典韦不能装源生武器", dwAct(2, { type: "equipCard", card: zhu }).error === "NOT_DW_ACTION");
check("空 card 被拒", dwAct(1, { type: "equipCard", card: null }).error === "BAD_CARD");
dwAct(1, { type: "equipCard", card: zhu });
check("装源生武器成功(kind:card/范围)", DT().weapons.length === 1 && DT().weapons[0].kind === "card" && DT().weapons[0].name === "诸葛连弩" && DT().weapons[0].range === 1);
check("再点同一源生武器=卸下(toggle)", dwAct(1, { type: "equipCard", card: zhu }).ok === true && DT().weapons.length === 0);
dwAct(1, { type: "qiexie" });                       // rng=0 抽出 关羽… 混装武将+源生
dwAct(1, { type: "equipToggle", name: "关羽" });
dwAct(1, { type: "equipCard", card: zhu });
check("武将+源生混装占同 slots(共2)", DT().weapons.length === 2 && DT().weapons.some(w => w.name === "关羽") && DT().weapons.some(w => w.kind === "card"));
check("满栏再装源生被拒", dwAct(1, { type: "equipCard", card: { name: "青龙偃月刀", suit: "S", rank: "5", range: 3 } }).error === "SLOTS_FULL");
dwAct(1, { type: "resetGame" });

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

// ============ 场景 15b:曹婴 伏间(排除自己+唯一最多,随机看牌目标)============
console.log("\n=== 场景 15b:曹婴 伏间 ===");
let cyRng = 0;
const roomC = new RoomCore("4680", 5, () => cyRng);
const cd2 = {}; for (let i = 1; i <= 5; i++) { cd2[i] = `cy${i}`; roomC.claimSeat(cd2[i], i); }
roomC.setGeneral(cd2[1], 1, "caoying");                     // 座位1 = 曹婴
for (let i = 2; i <= 4; i++) roomC.setGeneral(cd2[i], i, String(i)); // 2/3/4 登记武将;座位5 空着(不入候选)
const cyAct = (by, o) => roomC.action(cd2[by], { targetSeat: 1, bySeat: by, toolAction: o });
const CYT = () => roomC.seats[1].toolState;
check("init:round1/lastPeek null", CYT().round === 1 && CYT().lastPeek === null);
check("非曹婴不能发动", cyAct(2, { type: "fujian", maxSeat: null }).error === "NOT_CY_ACTION");
check("非法 maxSeat 被拒", cyAct(1, { type: "fujian", maxSeat: 99 }).error === "BAD_SEAT");
cyRng = 0;
check("唯一最多=座位2 → 候选3/4,rng=0 命中3", cyAct(1, { type: "fujian", maxSeat: 2, phase: "prep" }).target === 3 && CYT().lastPeek.target === 3);
cyRng = 0.9;
check("平手(null)→ 候选2/3/4,rng=.9 命中4;空座位5 不入候选", cyAct(1, { type: "fujian", maxSeat: null, phase: "end" }).target === 4);
check("maxSeat=曹婴自己 等价只排自己(候选2/3/4)", cyAct(1, { type: "fujian", maxSeat: 1 }).target === 4);
roomC.action(cd2[2], { targetSeat: 2, bySeat: 2, toolAction: { type: "panelSetHpMax", hp: 4 } });
roomC.action(cd2[2], { targetSeat: 2, bySeat: 2, toolAction: { type: "panelSetDead", dead: true } });
cyRng = 0;
check("阵亡座位2 不入候选(唯一最多=3 → 只剩4)", cyAct(1, { type: "fujian", maxSeat: 3 }).target === 4);
check("旁人可见结果(全公开)", roomC.viewFor(cd2[5]).seats[1].toolState.lastPeek.target === 4);
// 无合法目标:3人局,唯一最多是仅存的另一人
const roomC2 = new RoomCore("4681", 2, () => 0);
const ce = {}; for (let i = 1; i <= 2; i++) { ce[i] = `ce${i}`; roomC2.claimSeat(ce[i], i); }
roomC2.setGeneral(ce[1], 1, "caoying"); roomC2.setGeneral(ce[2], 2, "24");
check("无合法目标 → target null 并记日志", roomC2.action(ce[1], { targetSeat: 1, bySeat: 1, toolAction: { type: "fujian", maxSeat: 2 } }).target === null && roomC2.seats[1].toolState.log[0].includes("无合法目标"));
cyAct(1, { type: "newTurn" });
check("下一轮:round2、lastPeek 清空", CYT().round === 2 && CYT().lastPeek === null);
check("重开", cyAct(1, { type: "resetGame" }).reset === true && CYT().round === 1);

// ============ 场景 15c:族王明山 剩墨台账(已选点数 + 已用基本牌)============
console.log("\n=== 场景 15c:族王明山 剩墨台账 ===");
const roomW = new RoomCore("5791", 3, () => 0);
const wd = {}; for (let i = 1; i <= 3; i++) { wd[i] = `wd${i}`; roomW.claimSeat(wd[i], i); }
roomW.setGeneral(wd[1], 1, "wangmingshan");
const wmsAct = (by, o) => roomW.action(wd[by], { targetSeat: 1, bySeat: by, toolAction: o });
const WT = () => roomW.seats[1].toolState;
check("init:round1/两台账皆空", WT().round === 1 && WT().usedRanks.length === 0 && WT().usedBasics.length === 0);
check("非本人不能操作", wmsAct(2, { type: "wmsToggleRank", rank: "A" }).error === "NOT_WMS_ACTION");
check("非法点数被拒", wmsAct(1, { type: "wmsToggleRank", rank: "14" }).error === "BAD_RANK");
check("非法基本牌被拒", wmsAct(1, { type: "wmsToggleBasic", basic: "闪电" }).error === "BAD_BASIC");
check("标记点数 A", wmsAct(1, { type: "wmsToggleRank", rank: "A" }).on === true && WT().usedRanks.includes("A"));
check("标记点数 10 与 K", wmsAct(1, { type: "wmsToggleRank", rank: "10" }).ok && wmsAct(1, { type: "wmsToggleRank", rank: "K" }).ok && WT().usedRanks.length === 3);
check("再点 A = 撤销(toggle)", wmsAct(1, { type: "wmsToggleRank", rank: "A" }).on === false && !WT().usedRanks.includes("A") && WT().usedRanks.length === 2);
check("标记基本牌 杀/桃", wmsAct(1, { type: "wmsToggleBasic", basic: "杀" }).ok && wmsAct(1, { type: "wmsToggleBasic", basic: "桃" }).ok && WT().usedBasics.length === 2);
check("再点 杀 = 撤销", wmsAct(1, { type: "wmsToggleBasic", basic: "杀" }).on === false && WT().usedBasics.length === 1);
check("台账全场公开(旁人可见)", roomW.viewFor(wd[2]).seats[1].toolState.usedRanks.length === 2);
wmsAct(1, { type: "newTurn" });
check("下一轮:round+1 但台账保留(整局累计)", WT().round === 2 && WT().usedRanks.length === 2 && WT().usedBasics.length === 1);
check("序列化/hydrate 存活", (() => { const h = RoomCore.hydrate(roomW.serialize()); const t = h.seats[1].toolState; return t.usedRanks.length === 2 && t.usedBasics.length === 1 && t.round === 2; })());
check("重开清空台账", wmsAct(1, { type: "resetGame" }).reset === true && WT().round === 1 && WT().usedRanks.length === 0 && WT().usedBasics.length === 0);

// —— 弹雀:上一张使用牌的点数(跨回合)+ X 计算 + 清空
check("init:lastRank/lastDiff 皆 null", WT().lastRank === null && WT().lastDiff === null);
check("非本人不能记点数", wmsAct(2, { type: "wmsSetRank", rank: "5" }).error === "NOT_WMS_ACTION");
check("非法点数被拒", wmsAct(1, { type: "wmsSetRank", rank: "Z" }).error === "BAD_RANK");
check("首次记 J:无前值→diff null(不能发动)", wmsAct(1, { type: "wmsSetRank", rank: "J" }).diff === null && WT().lastRank === "J");
check("再记 K:X=|13-11|=2", wmsAct(1, { type: "wmsSetRank", rank: "K" }).diff === 2 && WT().lastRank === "K" && WT().lastDiff === 2);
check("A(=1) 与 K(=13):X=12", wmsAct(1, { type: "wmsSetRank", rank: "A" }).diff === 12);
check("同点数:X=0(不能发动)", wmsAct(1, { type: "wmsSetRank", rank: "A" }).diff === 0);
check("10 与 A:X=9(10 按 10 计非 1+0)", wmsAct(1, { type: "wmsSetRank", rank: "10" }).diff === 9);
check("清空点数(剩墨印牌无点数)", wmsAct(1, { type: "wmsClearRank" }).ok === true && WT().lastRank === null && WT().lastDiff === null);
check("清空后再记 → 无前值 diff null", wmsAct(1, { type: "wmsSetRank", rank: "3" }).diff === null);
wmsAct(1, { type: "newTurn" });
check("跨回合保留点数(下一轮不清 lastRank)", WT().lastRank === "3");
check("跨回合算 X:回合外用 K → X=|13-3|=10", wmsAct(1, { type: "wmsSetRank", rank: "K" }).diff === 10);
check("弹雀态进序列化/hydrate", (() => { const h = RoomCore.hydrate(roomW.serialize()); return h.seats[1].toolState.lastRank === "K" && h.seats[1].toolState.lastDiff === 10; })());
check("重开清空弹雀态", wmsAct(1, { type: "resetGame" }).reset === true && WT().lastRank === null && WT().lastDiff === null);

// ============ 场景 15d:贾充 凶竖(秘密猜测 + 保密投影 + 揭晓)============
console.log("\n=== 场景 15d:贾充 凶竖 ===");
const roomJ = new RoomCore("6420", 4, () => 0);
const jd = {}; for (let i = 1; i <= 4; i++) { jd[i] = `jd${i}`; roomJ.claimSeat(jd[i], i); }
roomJ.setGeneral(jd[1], 1, "jiachong");
for (let i = 2; i <= 4; i++) roomJ.setGeneral(jd[i], i, String(i));
const jcAct = (by, o) => roomJ.action(jd[by], { targetSeat: 1, bySeat: by, toolAction: o });
const JT = () => roomJ.seats[1].toolState;
const JV = (dev) => roomJ.viewFor(dev).seats[1].toolState; // 经 VISIBILITY 投影的视图
check("init:round1/无 pending/无猜测", JT().round === 1 && JT().pending === null && JT().lastReveal === null);
check("非贾充不能发动", jcAct(2, { type: "xsStart", targetSeat: 2, cardName: "杀" }).error === "NOT_JC_ACTION");
check("不能以自己为目标", jcAct(1, { type: "xsStart", targetSeat: 1, cardName: "杀" }).error === "CANT_TARGET_SELF");
check("必须填牌名", jcAct(1, { type: "xsStart", targetSeat: 2, cardName: "  " }).error === "NEED_CARD_NAME");
check("首次发动弃 0 张(X=本轮此前次数)", jcAct(1, { type: "xsStart", targetSeat: 2, cardName: "杀" }).cost === 0);
check("pending 已建立", JT().pending.targetSeat === 2 && JT().pending.cardName === "杀");
check("重复发动被拒(已有 pending)", jcAct(1, { type: "xsStart", targetSeat: 3, cardName: "闪" }).error === "ALREADY_PENDING");
check("未猜测不能揭晓", jcAct(1, { type: "xsReveal", actual: "use" }).error === "NO_GUESS");
check("非法猜测被拒", jcAct(1, { type: "xsGuess", g: "maybe" }).error === "BAD_GUESS");
jcAct(1, { type: "xsGuess", g: "use" });
check("猜测已记录", JT().guess.g === "use");
check("⭐ 猜测锁定,不可更换", jcAct(1, { type: "xsGuess", g: "noUse" }).error === "ALREADY_GUESSED" && JT().guess.g === "use");
// —— 保密核心:旁人看不到猜测内容,只知道"已猜测"
check("⭐ 贾充本人看得到猜测内容", JV(jd[1]).guess.g === "use");
check("⭐ 旁人看不到猜测内容(只见 count=1)", JV(jd[2]).guess.g === undefined && JV(jd[2]).guess.count === 1);
check("目标与展示牌名对全场公开(牌本就展示)", JV(jd[3]).pending.targetSeat === 2 && JV(jd[3]).pending.cardName === "杀");
check("log 不泄露猜测内容", !JSON.stringify(JV(jd[2]).log).includes("use") && !JSON.stringify(JV(jd[2]).log).includes("会用"));
// —— 揭晓
check("非法 actual 被拒", jcAct(1, { type: "xsReveal", actual: "x" }).error === "BAD_ACTUAL");
check("猜对:造成1点伤害", jcAct(1, { type: "xsReveal", actual: "use" }).correct === true);
check("揭晓后 pending 清空、结果公开", JT().pending === null && JV(jd[2]).lastReveal.guess === "use" && JV(jd[2]).lastReveal.correct === true);
check("揭晓后猜测已清(不再泄露)", JV(jd[2]).guess.count === 0);
// —— 第二次发动:成本递增
check("第二次发动需弃 1 张", jcAct(1, { type: "xsStart", targetSeat: 3, cardName: "闪" }).cost === 1);
jcAct(1, { type: "xsGuess", g: "use" });
check("猜错:获得该牌", jcAct(1, { type: "xsReveal", actual: "noUse" }).correct === false && JT().lastReveal.correct === false);
check("第三次发动需弃 2 张", jcAct(1, { type: "xsStart", targetSeat: 4, cardName: "桃" }).cost === 2);
check("撤销可用", jcAct(1, { type: "xsCancel" }).ok === true && JT().pending === null);
jcAct(1, { type: "newRound" });
check("下一轮:成本归零、轮次+1", JT().round === 2 && JT().usedThisRound === 0);
check("序列化/hydrate 存活(含保密字段)", (() => { jcAct(1, { type: "xsStart", targetSeat: 2, cardName: "酒" }); jcAct(1, { type: "xsGuess", g: "noUse" }); const h = RoomCore.hydrate(roomJ.serialize()); return h.seats[1].toolState.guess.g === "noUse" && h.seats[1].toolState.pending.cardName === "酒"; })());
check("重开清空", jcAct(1, { type: "resetGame" }).reset === true && JT().round === 1 && JT().pending === null);

// ============ 场景 15d2:谋程昱 胆持(受伤角色跨座位秘密选类型 + 程昱公开 + 结算)============
console.log("\n=== 场景 15d2:谋程昱 胆持 ===");
const roomDanchi = new RoomCore("5173", 4, () => 0);
const dcDev = {}; for (let i = 1; i <= 4; i++) { dcDev[i] = `cy${i}`; roomDanchi.claimSeat(dcDev[i], i); }
roomDanchi.setGeneral(dcDev[1], 1, "mouchengyu");
for (let i = 2; i <= 3; i++) roomDanchi.setGeneral(dcDev[i], i, String(i)); // 座位4 空(未登记武将)
const danchiAct = (by, o) => roomDanchi.action(dcDev[by], { targetSeat: 1, bySeat: by, toolAction: o });
const dcTS = () => roomDanchi.seats[1].toolState;
const dcView = (dev) => roomDanchi.viewFor(dev).seats[1].toolState;
check("init:无 pending/choice 空/无结算", dcTS().pending === null && Object.keys(dcTS().choice).length === 0 && dcTS().settle === null);
check("非程昱不能发动", danchiAct(2, { type: "dcStart", targetSeat: 2 }).error === "NOT_CY_ACTION");
check("目标须已登记武将", danchiAct(1, { type: "dcStart", targetSeat: 4 }).error === "BAD_SEAT");
check("未发动不能选择", danchiAct(2, { type: "dcChoose", c: "basic" }).error === "NO_PENDING");
check("发动:座位2受伤、来源座位3", danchiAct(1, { type: "dcStart", targetSeat: 2, sourceSeat: 3 }).ok === true && dcTS().pending.targetSeat === 2 && dcTS().pending.sourceSeat === 3 && dcTS().pending.revealed === false);
check("每回合限一次(已有 pending 再发动被拒)", danchiAct(1, { type: "dcStart", targetSeat: 3 }).error === "ALREADY_PENDING");
check("未选择不能公开", danchiAct(2, { type: "dcReveal" }).error === "NO_CHOICE");
check("⭐ 程昱看不到内容,故也不能公开(公开权在受伤角色)", danchiAct(1, { type: "dcReveal" }).error === "NOT_DC_TARGET");
check("⭐ 只有受伤角色能选(程昱不行)", danchiAct(1, { type: "dcChoose", c: "basic" }).error === "NOT_DC_TARGET");
check("⭐ 只有受伤角色能选(来源不行)", danchiAct(3, { type: "dcChoose", c: "basic" }).error === "NOT_DC_TARGET");
check("非法类型被拒", danchiAct(2, { type: "dcChoose", c: "weapon" }).error === "BAD_TYPE");
check("受伤角色选择锦囊牌", danchiAct(2, { type: "dcChoose", c: "trick" }).ok === true && dcTS().choice.c === "trick");
check("⭐ 选择锁定不可改", danchiAct(2, { type: "dcChoose", c: "equip" }).error === "ALREADY_CHOSEN" && dcTS().choice.c === "trick");
// —— 保密核心
check("⭐ 受伤角色本人看得到选择", dcView(dcDev[2]).choice.c === "trick");
check("⭐ 伤害来源看不到(只见 count=1)", dcView(dcDev[3]).choice.c === undefined && dcView(dcDev[3]).choice.count === 1);
check("⭐ 程昱公开前也看不到(只见 count=1)", dcView(dcDev[1]).choice.c === undefined && dcView(dcDev[1]).choice.count === 1);
check("⭐ 接管受伤座位的设备看得到(原设备失去)", (() => { roomDanchi.takeoverSeat(dcDev[4], 2); const ok = dcView(dcDev[4]).choice.c === "trick" && dcView(dcDev[2]).choice.count === 1; roomDanchi.takeoverSeat(dcDev[2], 2); return ok; })());
check("log 不泄露选择内容", !JSON.stringify(dcView(dcDev[3]).log).includes("trick") && !JSON.stringify(dcView(dcDev[3]).log).includes("锦囊"));
check("未公开不能结算", danchiAct(1, { type: "dcSettle", actual: "basic" }).error === "NOT_REVEALED");
check("⭐ 无关座位不能公开", danchiAct(3, { type: "dcReveal" }).error === "NOT_DC_TARGET");
check("⭐ 程昱不能代为公开(防误触泄露)", danchiAct(1, { type: "dcReveal" }).error === "NOT_DC_TARGET" && dcTS().pending.revealed === false);
check("受伤角色本人公开 → 返回类型", danchiAct(2, { type: "dcReveal" }).c === "trick" && dcTS().pending.revealed === true);
check("⭐ 公开后全场可见", dcView(dcDev[3]).choice.c === "trick" && dcView(dcDev[1]).choice.c === "trick");
check("公开后不能重复公开", danchiAct(2, { type: "dcReveal" }).error === "ALREADY_REVEALED");
check("公开后受伤角色不能再选", danchiAct(2, { type: "dcChoose", c: "basic" }).error === "ALREADY_REVEALED");
check("结算:来源用基本牌(与锦囊不同)→ diff", danchiAct(1, { type: "dcSettle", actual: "basic" }).diff === true && dcView(dcDev[3]).settle.diff === true);
check("结算可重录纠错:锦囊(相同)→ 无额外杀", danchiAct(1, { type: "dcSettle", actual: "trick" }).diff === false && dcTS().settle.actual === "trick");
check("结算非法类型被拒", danchiAct(1, { type: "dcSettle", actual: "x" }).error === "BAD_TYPE");
check("序列化/hydrate 存活", (() => { const h = RoomCore.hydrate(JSON.parse(JSON.stringify(roomDanchi.serialize()))); const s = h.seats[1].toolState; return s.choice.c === "trick" && s.pending.revealed === true && s.settle.actual === "trick"; })());
check("非程昱不能清空", danchiAct(2, { type: "dcReset" }).error === "NOT_CY_ACTION");
check("回合结束清空重来(保留记录)", danchiAct(1, { type: "dcReset" }).reset === true && dcTS().pending === null && Object.keys(dcTS().choice).length === 0 && dcTS().settle === null && dcTS().log.length > 3);
check("清空后可再次发动(对自己,不指定来源)", danchiAct(1, { type: "dcStart", targetSeat: 1 }).ok === true && dcTS().pending.sourceSeat === null);
check("目标为自己时程昱本人选择并可见(旁人仍只见 count)", danchiAct(1, { type: "dcChoose", c: "equip" }).ok === true && dcView(dcDev[1]).choice.c === "equip" && dcView(dcDev[2]).choice.count === 1);
check("⭐ 目标为自己时,公开权也在程昱(他就是受伤角色)", danchiAct(1, { type: "dcReveal" }).c === "equip" && dcView(dcDev[2]).choice.c === "equip");

// ============ 场景 15e:族陆郁生 拾昔(每花色首张单目标普通锦囊台账)============
console.log("\n=== 场景 15e:族陆郁生 拾昔 ===");
const roomL2 = new RoomCore("3579", 3, () => 0);
const ld2 = {}; for (let i = 1; i <= 3; i++) { ld2[i] = `ly${i}`; roomL2.claimSeat(ld2[i], i); }
roomL2.setGeneral(ld2[1], 1, "zuluyusheng");
const lysAct = (by, o) => roomL2.action(ld2[by], { targetSeat: 1, bySeat: by, toolAction: o });
const LYT = () => roomL2.seats[1].toolState;
check("init:四花色皆空", ["S", "H", "C", "D"].every((k) => LYT().records[k] === null));
check("非本人不能记录", lysAct(2, { type: "sxRecord", suit: "S", cardName: "决斗" }).error === "NOT_LYS_ACTION");
check("非法花色被拒", lysAct(1, { type: "sxRecord", suit: "X", cardName: "决斗" }).error === "BAD_SUIT");
check("空牌名被拒", lysAct(1, { type: "sxRecord", suit: "S", cardName: "  " }).error === "NEED_CARD_NAME");
check("记录黑桃→决斗", lysAct(1, { type: "sxRecord", suit: "S", cardName: "决斗" }).ok === true && LYT().records.S === "决斗");
check("⭐ 首次语义:同花色不可覆盖", lysAct(1, { type: "sxRecord", suit: "S", cardName: "火攻" }).error === "ALREADY_RECORDED" && LYT().records.S === "决斗");
check("其他花色互不影响", lysAct(1, { type: "sxRecord", suit: "H", cardName: "无中生有" }).ok === true && LYT().records.S === "决斗" && LYT().records.H === "无中生有");
check("手填扩展锦囊也能记", lysAct(1, { type: "sxRecord", suit: "C", cardName: "调虎离山" }).ok === true && LYT().records.C === "调虎离山");
check("台账全场公开(旁人可见)", roomL2.viewFor(ld2[2]).seats[1].toolState.records.S === "决斗");
check("未记录的花色不能清除", lysAct(1, { type: "sxClear", suit: "D" }).error === "NOT_RECORDED");
check("清除后可重录(纠错)", lysAct(1, { type: "sxClear", suit: "S" }).ok === true && LYT().records.S === null
  && lysAct(1, { type: "sxRecord", suit: "S", cardName: "顺手牵羊" }).ok === true && LYT().records.S === "顺手牵羊");
check("序列化/hydrate 存活", (() => { const h = RoomCore.hydrate(roomL2.serialize()); const r = h.seats[1].toolState.records; return r.S === "顺手牵羊" && r.H === "无中生有" && r.C === "调虎离山" && r.D === null; })());
check("重开清空四花色", lysAct(1, { type: "resetGame" }).reset === true && ["S", "H", "C", "D"].every((k) => LYT().records[k] === null));

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

// ═══════════ 全场状态面板(#1):血量/翻面/连环/阵亡 —— 全公开,任意座位可改任意座位(横置并入连环)═══════════
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

console.log("\n=== 面板2:翻面/连环 切换 + 阵亡(横置并入连环,只留 chained)===");
check("翻面 toggle on", pAct(1, 1, { type: "panelToggle", flag: "flipped" }).ok && PV(pd[1], 1).flipped === true);
check("翻面 toggle off", pAct(1, 1, { type: "panelToggle", flag: "flipped" }).ok && PV(pd[1], 1).flipped === false);
check("连环 on", pAct(1, 1, { type: "panelToggle", flag: "chained" }).ok && PV(pd[1], 1).chained === true);
check("横置 flag 已废除(BAD_FLAG)", pAct(1, 1, { type: "panelToggle", flag: "tapped" }).error === "BAD_FLAG");
check("非法 flag 被拒(BAD_FLAG)", pAct(1, 1, { type: "panelToggle", flag: "zzz" }).error === "BAD_FLAG");
check("阵亡置 true", pAct(1, 1, { type: "panelSetDead", dead: true }).ok && PV(pd[1], 1).dead === true);
check("复生置 false", pAct(1, 1, { type: "panelSetDead", dead: false }).ok && PV(pd[1], 1).dead === false);

console.log("\n=== 面板3:任意座位可改任意座位(无 holder 守卫)+ 空座位拒绝 + 换将重置 ===");
check("★dev2 改座位1血量(跨座位无守卫)成功", pAct(2, 1, { type: "panelSetHp", hp: 1 }).ok && PV(pd[1], 1).hp === 1);
check("★dev1 改座位2翻面(跨座位)成功", pAct(1, 2, { type: "panelToggle", flag: "flipped" }).ok && PV(pd[1], 2).flipped === true);
check("空座位(无武将)面板动作被拒(BAD_TARGET)", pAct(1, 3, { type: "panelSetHp", hp: 3 }).error === "BAD_TARGET");
pAct(1, 1, { type: "panelToggle", flag: "chained" }); // 座位1 先挂上连环+血量

console.log("\n=== 面板4:装备区5槽 + 废除/恢复(#2 ④层)===");
const HORSE = { name: "赤兔", suit: "H", rank: "5", type: "-1马" };
const WEAPON = { name: "青龙偃月刀", suit: "S", rank: "5", type: "武器", range: 3 };
check("挂进攻马(atkHorse)成功", pAct(1, 1, { type: "panelSetEquip", slot: "atkHorse", card: HORSE }).ok && PV(pd[1], 1).atkHorse?.name === "赤兔");
check("★装备对旁人公开(dev2 看座位1)", PV(pd[2], 1).atkHorse?.name === "赤兔");
check("挂武器(weapon)成功", pAct(1, 1, { type: "panelSetEquip", slot: "weapon", card: WEAPON }).ok && PV(pd[1], 1).weapon?.range === 3);
check("挂宝物(treasure)成功", pAct(1, 1, { type: "panelSetEquip", slot: "treasure", card: { name: "木牛流马", suit: "D", rank: "5", type: "宝物" } }).ok && PV(pd[1], 1).treasure?.name === "木牛流马");
check("卸下进攻马(card=null)", pAct(1, 1, { type: "panelSetEquip", slot: "atkHorse", card: null }).ok && PV(pd[1], 1).atkHorse === null);
check("非法 slot 被拒(BAD_SLOT)", pAct(1, 1, { type: "panelSetEquip", slot: "zzz", card: HORSE }).error === "BAD_SLOT");
check("废除武器槽", pAct(1, 1, { type: "panelAbolish", slot: "weapon", on: true }).ok && PV(pd[1], 1).abolished.weapon === true);
check("恢复武器槽(delete)", pAct(1, 1, { type: "panelAbolish", slot: "weapon", on: false }).ok && !PV(pd[1], 1).abolished.weapon);
check("废除非法 slot 被拒", pAct(1, 1, { type: "panelAbolish", slot: "zzz", on: true }).error === "BAD_SLOT");

console.log("\n=== 面板5:君主 +1 体力上限(主公/地主/主帅)===");
pAct(1, 1, { type: "panelSetHpMax", hp: 4 }); pAct(1, 1, { type: "panelSetHp", hp: 4 }); // 置满 4/4
check("开君主加成→当前血也+1(5/5)", pAct(1, 1, { type: "panelSetLord", on: true }).ok && PV(pd[1], 1).hp === 5 && PV(pd[1], 1).lordBonus === true);
check("有效上限=基础4+1,置数6被夹到5", pAct(1, 1, { type: "panelSetHp", hp: 6 }).ok && PV(pd[1], 1).hp === 5);
check("关君主加成→血夹回4", pAct(1, 1, { type: "panelSetLord", on: false }).ok && PV(pd[1], 1).hp === 4 && PV(pd[1], 1).lordBonus === false);

console.log("\n=== 面板6:判定区(#2 ⑤层)—— 乐/兵/闪电 可叠加 + 整区废除 ===");
check("加乐不思蜀", pAct(1, 1, { type: "panelToggleJudge", kind: "乐不思蜀" }).ok && PV(pd[1], 1).judgments.includes("乐不思蜀"));
check("再加闪电(可叠加,同时有2张)", pAct(1, 1, { type: "panelToggleJudge", kind: "闪电" }).ok && PV(pd[1], 1).judgments.length === 2);
check("★判定区对旁人公开", PV(pd[2], 1).judgments.includes("闪电"));
check("再点乐→移除(toggle)", pAct(1, 1, { type: "panelToggleJudge", kind: "乐不思蜀" }).ok && !PV(pd[1], 1).judgments.includes("乐不思蜀") && PV(pd[1], 1).judgments.length === 1);
check("非法判定牌被拒(BAD_JUDGE)", pAct(1, 1, { type: "panelToggleJudge", kind: "杀" }).error === "BAD_JUDGE");
check("废除判定区(slot=judgment)", pAct(1, 1, { type: "panelAbolish", slot: "judgment", on: true }).ok && PV(pd[1], 1).abolished.judgment === true);
check("恢复判定区", pAct(1, 1, { type: "panelAbolish", slot: "judgment", on: false }).ok && !PV(pd[1], 1).abolished.judgment);

pAct(1, 1, { type: "panelSetEquip", slot: "atkHorse", card: HORSE }); // 换将前挂满,验证重置
pAct(1, 1, { type: "panelSetLord", on: true }); pAct(1, 1, { type: "panelAbolish", slot: "weapon", on: true });
pAct(1, 1, { type: "panelToggleJudge", kind: "兵粮寸断" });
roomPanel.setGeneral(pd[1], 1, "simayi");             // 换武将
const R = PV(pd[1], 1);
check("★换武将→面板全重置(血/状态/坐骑/武器/宝物/废除/君主/判定 全清)",
  R.hp === null && R.hpMax === null && R.flipped === false && R.dead === false && R.lordBonus === false &&
  R.weapon === null && R.armor === null && R.atkHorse === null && R.defHorse === null && R.treasure === null &&
  Object.keys(R.abolished).length === 0 && R.judgments.length === 0);

// ═══════════ 动态座位数(#2):2~10,只从末位增减,删占用位撤持有 ═══════════
const roomSeat = new RoomCore("8080", 3, () => 0); // 起始 3 座
const stv = "seatdev";
roomSeat.claimSeat(stv, 3); roomSeat.setGeneral(stv, 3, "guozhao"); // 座位3 占上

console.log("\n=== 座位增减:边界 + 末位 + 撤持有 ===");
check("加座位→4号出现", roomSeat.addSeat(stv).seatNo === 4 && !!roomSeat.seats[4] && Object.keys(roomSeat.seats).length === 4);
check("新座位面板字段就位(hp=null)", roomSeat.seats[4].hp === null && roomSeat.seats[4].general === null);
// 连加到 10
while (Object.keys(roomSeat.seats).length < 10) roomSeat.addSeat(stv);
check("加到 10 座", Object.keys(roomSeat.seats).length === 10);
check("超过 10 被拒(MAX_SEATS)", roomSeat.addSeat(stv).error === "MAX_SEATS");
// 减回去(末位空座位)
check("减座位→删最高号 10", roomSeat.removeSeat(stv).removed === 10 && !roomSeat.seats[10] && Object.keys(roomSeat.seats).length === 9);
while (Object.keys(roomSeat.seats).length > 4) roomSeat.removeSeat(stv);
check("减到 4 座(座位3 武将仍在,未被误删)", Object.keys(roomSeat.seats).length === 4 && roomSeat.seats[3].general === "guozhao");
// 删占用的末位:先让 4 号被 sd 认领,再删到 4
roomSeat.claimSeat(stv, 4);
check("sd 持有座位4", roomSeat.devices[stv].holds.has(4));
check("删末位4(占用)→座位没了 + 持有被撤", roomSeat.removeSeat(stv).removed === 4 && !roomSeat.seats[4] && !roomSeat.devices[stv].holds.has(4));
// 减到底 2 后不能再减
while (Object.keys(roomSeat.seats).length > 2) roomSeat.removeSeat(stv);
check("减到 2 座", Object.keys(roomSeat.seats).length === 2);
check("低于 2 被拒(MIN_SEATS)", roomSeat.removeSeat(stv).error === "MIN_SEATS");
// 持久化往返:动态座位数应存活(JSON 往返模拟 DO storage.put 落盘的结构化克隆)
const seatSnap = JSON.parse(JSON.stringify(roomSeat.serialize())); // 2 座快照
check("hydrate 还原 2 座快照", Object.keys(RoomCore.hydrate(seatSnap).seats).length === 2);
roomSeat.addSeat(stv); // 现 3 座
const seatSnap2 = JSON.parse(JSON.stringify(roomSeat.serialize()));
const hy2 = RoomCore.hydrate(seatSnap2);
check("序列化含动态座位数(2→再加→3)", !!hy2.seats[3] && Object.keys(hy2.seats).length === 3);

// ============ 场景 20:线上发将(组池规则 + 发/换/选/亮 全流程 + 保密)============
console.log("\n=== 场景 20:线上发将 ===");
{
  const { readFileSync } = await import("node:fs");
  const { buildDealPools, DEAL_HAND, DEAL_LORD_EXTRA, groupKey } = await import("./shared/deal.mjs");
  const HEROES = JSON.parse(readFileSync(new URL("./shared/generals.json", import.meta.url), "utf8"));
  const SEED = JSON.parse(readFileSync(new URL("./shared/hero-pool-seed.json", import.meta.url), "utf8")).ids;
  const byName = (n) => HEROES.find((h) => h.name === n);
  const idOf = (n) => byName(n).id;
  const P = (o) => buildDealPools({ heroes: HEROES, ...o });
  const grp = (pools, key, which = "normal") => pools[which].find((g) => g.key === key);
  const names = (g) => (g ? g.opts.map((o) => o.name) : []);

  // —— 组池规则 ——
  let p = P({ whitelist: [idOf("黄盖")] });
  check("同名成坑:只勾标黄盖,界黄盖也可选", names(grp(p, "黄盖")).includes("黄盖") && names(grp(p, "黄盖")).includes("界黄盖") && p.normal.length === 1);
  p = P({ whitelist: [idOf("黄盖")], banned: [idOf("界黄盖")] });
  check("被禁版本从坑里剔除(界黄盖被禁→只剩标黄盖)", names(grp(p, "黄盖")).join() === "黄盖");
  p = P({ whitelist: [idOf("界黄盖")], banned: [idOf("界黄盖")] });
  check("唯一勾选的版本被禁 → 整坑不入池", !grp(p, "黄盖"));
  p = P({ whitelist: [idOf("神关羽")] });
  check("神版独立成坑(勾神关羽不带出关羽)", !!grp(p, "神关羽") && !grp(p, "关羽") && names(grp(p, "神关羽")).join() === "神关羽");
  p = P({ whitelist: [idOf("曹丕"), idOf("黄盖")] });
  check("曹丕只进君主池,不进普通池", !grp(p, "曹丕") && !!grp(p, "曹丕", "lord") && !grp(p, "黄盖", "lord"));
  p = P({ whitelist: [idOf("董昭"), idOf("谋董昭")] });
  check("身份局:董昭/谋董昭 都可选", names(grp(p, "董昭")).includes("董昭") && names(grp(p, "董昭")).includes("谋董昭"));
  p = P({ whitelist: [idOf("董昭"), idOf("谋董昭")], mode: "dazhong" });
  check("非身份局:董昭坑只剩谋董昭", names(grp(p, "董昭")).join() === "谋董昭");
  p = P({ whitelist: [idOf("董昭")], mode: "baonue" });
  check("非身份局且只勾了董昭 → 该坑不入池", !grp(p, "董昭"));
  p = P({ whitelist: [idOf("昏君刘宏"), idOf("暴君董卓"), idOf("黄盖")] });
  check("身份局:模式专属君主不出现、无必出坑", p.forced === null && p.normal.length === 1);
  p = P({ whitelist: [idOf("黄盖")], mode: "dazhong" });
  check("大忠似奸:必出坑=昏君刘宏(未勾也出)", p.forced && p.forced.opts[0].name === "昏君刘宏" && p.forced.opts.length === 1);
  p = P({ whitelist: [idOf("刘宏")], mode: "dazhong" });
  check("大忠似奸:刘宏已入池 → 并入必出坑(含闪刘宏),普通池/君主池不再重复", names(p.forced).join() === "昏君刘宏,刘宏,闪刘宏" && !grp(p, "刘宏") && !grp(p, "刘宏", "lord") && !p.lord.some((g) => names(g).includes("闪刘宏")));
  // 同名前缀:族 / 闪 / 标 也算同一位武将(用户 2026-10-02 报 bug:闪刘宏、族荀彧 被当成独立武将)
  p = P({ whitelist: [idOf("族荀彧")] });
  check("⭐ 族版同名成坑:荀彧/界荀彧/族荀彧 是一个坑", p.normal.length === 1 && ["荀彧", "界荀彧", "族荀彧"].every((n) => names(grp(p, "荀彧")).includes(n)));
  p = P({ whitelist: [idOf("闪刘宏"), idOf("刘宏")] });
  check("⭐ 闪版同名成坑:刘宏/闪刘宏 是一个坑(不出两个)", p.normal.length === 1 && names(grp(p, "刘宏")).join() === "刘宏,闪刘宏");
  p = P({ whitelist: [idOf("标袁术")] });
  check("标版同名成坑:袁术/标袁术/谋袁术", ["袁术", "标袁术", "谋袁术"].every((n) => names(grp(p, "袁术")).includes(n)));
  check("神版仍独立(神赵云 不并入 赵云/闪赵云)", (() => { const q = P({ whitelist: [idOf("闪赵云"), idOf("神赵云")] }); return q.normal.length === 2 && !names(grp(q, "赵云")).includes("神赵云") && names(grp(q, "赵云")).includes("闪赵云"); })());
  check("暴虐无道必出暴君董卓 / 失心疯必出教主张角", P({ whitelist: [], mode: "baonue" }).forced.opts[0].name === "暴君董卓" && P({ whitelist: [], mode: "shixin" }).forced.opts[0].name === "教主张角");
  p = P({ whitelist: [idOf("魔曹操")] });
  check("带工具的将 gid=工具名(落座后工具可用)", grp(p, "曹操").opts.find((o) => o.name === "魔曹操").gid === "caocao");

  // —— 全流程:线上真实白名单快照,4 人,大忠似奸,座位1为昏君 ——
  let seed = 7; const lcg = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const room = new RoomCore("9020", 5, lcg);
  const dv = {}; for (let i = 1; i <= 4; i++) { dv[i] = `dl${i}`; room.claimSeat(dv[i], i); } // 座位5 无人
  const pools = () => P({ whitelist: SEED, banned: [], mode: "dazhong" });
  check("未入房设备不能发将", room.dealStart("ghost", { mode: "dazhong", lordSeat: 1, pools: pools() }).error === "NO_DEVICE");
  check("君主座位须是已入座的座位", room.dealStart(dv[1], { mode: "dazhong", lordSeat: 5, pools: pools() }).error === "BAD_LORD");
  check("非法模式被拒", room.dealStart(dv[1], { mode: "xx", lordSeat: 1, pools: pools() }).error === "BAD_MODE");
  check("将池太小被拒(带 need/have)", (() => { const r = room.dealStart(dv[1], { mode: "normal", lordSeat: null, pools: P({ whitelist: [idOf("黄盖")] }) }); return r.error === "POOL_TOO_SMALL" && r.need === 24 && r.have === 1; })());
  check("发将成功(只发已入座的 4 人)", room.dealStart(dv[1], { mode: "dazhong", lordSeat: 1, pools: pools() }).players === 4);
  check("重复发将被拒", room.dealStart(dv[2], { mode: "normal", lordSeat: null, pools: pools() }).error === "DEAL_ACTIVE");
  const D = () => room.deal, H = (n) => room.deal.hands[n];
  check("君主 = 额外主公技坑 + 6 起手;其余人 6 坑;空座位不发", H(1).slots.filter((s) => s.src === "lord").length === Math.min(DEAL_LORD_EXTRA, 1 + pools().lord.length) && H(1).slots.filter((s) => s.src === "init").length === DEAL_HAND && H(2).slots.length === DEAL_HAND && !D().hands[5]);
  check("君主额外候选第一坑=昏君刘宏", H(1).slots[0].opts[0].name === "昏君刘宏" && H(1).slots[0].src === "lord");
  check("君主额外坑都带主公技版本(专属君主除外)", H(1).slots.filter((s) => s.src === "lord").slice(1).every((s) => s.opts.some((o) => o.lord)));
  const allKeys = () => Object.values(D().hands).flatMap((h) => h.slots.map((s) => s.key));
  check("⭐ 全场一坑一人(无重复),且已发的坑不在剩余池里", new Set(allKeys()).size === allKeys().length && !D().pool.some((g) => allKeys().includes(g.key)));
  check("⭐ 曹丕不出现在任何人的普通坑里", !Object.values(D().hands).some((h) => h.slots.some((s) => s.src !== "lord" && s.key === "曹丕")));
  // 保密
  const V = (d) => room.viewFor(d).deal;
  check("⭐ 本人看得到自己的候选明细", V(dv[2]).seats[2].slots.length === 6 && V(dv[2]).seats[2].slots[0].opts.length >= 1);
  check("⭐ 别人只见坑数,看不到明细", V(dv[2]).seats[3].slots === undefined && V(dv[2]).seats[3].slotCount === 6 && V(dv[2]).seats[3].picked === false);
  check("未入座设备看不到任何明细", Object.values(V("ghost2").seats).every((s) => s.slots === undefined));
  check("剩余将池内容不下发(只给数量)", V(dv[2]).pool === undefined && typeof V(dv[2]).poolLeft === "number");
  // 选将顺序
  const first = (n, i = 0) => H(n).slots[i].opts[0];
  check("君主未选,其余人不能选(LORD_FIRST)", room.dealPick(dv[2], { seatNo: 2, slot: 0, heroId: first(2).id }).error === "LORD_FIRST");
  check("不是持有者不能替别人选/换", room.dealPick(dv[2], { seatNo: 1, slot: 0, heroId: first(1).id }).error === "NOT_HOLDER" && room.dealSwap(dv[2], { seatNo: 3, slot: 0 }).error === "NOT_HOLDER");
  check("选了不在该坑里的将被拒", room.dealPick(dv[1], { seatNo: 1, slot: 0, heroId: 999999 }).error === "BAD_PICK");
  // 换将(君主)
  const lordInitIdx = H(1).slots.findIndex((s) => s.src === "init");
  const oldKey = H(1).slots[lordInitIdx].key, poolBefore = D().pool.length;
  check("君主额外坑不可换", room.dealSwap(dv[1], { seatNo: 1, slot: 0 }).error === "CANT_SWAP");
  check("起手坑可换一次", room.dealSwap(dv[1], { seatNo: 1, slot: lordInitIdx }).ok === true);
  check("换来的坑:不与起手 6 坑重复、标记 swap、原坑回池、池子大小不变", H(1).slots[lordInitIdx].src === "swap" && !H(1).initKeys.includes(H(1).slots[lordInitIdx].key) && D().pool.some((g) => g.key === oldKey) && D().pool.length === poolBefore);
  check("换来的坑不可再换", room.dealSwap(dv[1], { seatNo: 1, slot: lordInitIdx }).error === "CANT_SWAP");
  check("换将后仍然全场一坑一人", new Set(allKeys()).size === allKeys().length);
  // 君主选定 → 立即亮出落座
  check("君主选昏君刘宏", room.dealPick(dv[1], { seatNo: 1, slot: 0, heroId: idOf("昏君刘宏") }).ok === true);
  check("⭐ 君主选定即落座(公开),且对别人可见是谁", room.seats[1].general === String(idOf("昏君刘宏")) && V(dv[3]).seats[1].pick.name === "昏君刘宏" && V(dv[3]).lordPicked === true);
  check("君主选定后不可再改/再换", room.dealPick(dv[1], { seatNo: 1, slot: 1, heroId: first(1, 1).id }).error === "ALREADY_PICKED" && room.dealSwap(dv[1], { seatNo: 1, slot: 7 }).error === "ALREADY_PICKED");
  // 其余人暗选
  check("座位2 暗选", room.dealPick(dv[2], { seatNo: 2, slot: 0, heroId: first(2).id }).ok === true);
  check("⭐ 暗选内容别人看不到(只见已选定),座位未落座", V(dv[3]).seats[2].picked === true && V(dv[3]).seats[2].pick === undefined && room.seats[2].general === null);
  check("亮出前可改选", room.dealPick(dv[2], { seatNo: 2, slot: 1, heroId: first(2, 1).id }).ok === true && H(2).pick.slot === 1);
  check("换掉已暗选的坑 → 选择被清空", room.dealSwap(dv[2], { seatNo: 2, slot: 1 }).ok === true && H(2).pick === null);
  check("未全员选定不能亮出", room.dealReveal(dv[1]).error === "NOT_ALL_PICKED");
  const picks = {};
  for (const n of [2, 3, 4]) { const o = first(n, 2); picks[n] = o; room.dealPick(dv[n], { seatNo: n, slot: 2, heroId: o.id }); }
  check("进度:4/4 已选", V(dv[1]).picked === 4 && V(dv[1]).total === 4);
  // 持久化往返(发将中途 DO 被回收也不丢)
  check("序列化/hydrate 保住发将状态", (() => { const h = RoomCore.hydrate(JSON.parse(JSON.stringify(room.serialize()))); return h.deal && h.deal.hands[3].pick.heroId === picks[3].id && h.deal.pool.length === D().pool.length; })());
  check("亮出:全员落座,发将结束", room.dealReveal(dv[4]).ok === true && room.deal === null && [2, 3, 4].every((n) => room.seats[n].general === picks[n].gid) && room.viewFor(dv[1]).deal === null);
  check("君主武将保持不变", room.seats[1].general === String(idOf("昏君刘宏")));
  // 无君主局 + 中止
  check("无君主:可直接选,不卡 LORD_FIRST", room.dealStart(dv[1], { mode: "normal", lordSeat: null, pools: P({ whitelist: SEED }) }).ok === true && room.dealPick(dv[3], { seatNo: 3, slot: 0, heroId: room.deal.hands[3].slots[0].opts[0].id }).ok === true && room.deal.hands[1].slots.length === 6);
  check("任何人可中止发将", room.dealCancel(dv[2]).ok === true && room.deal === null && room.dealCancel(dv[2]).error === "NO_DEAL");
  // 环境(将池)标识透传 + 服务端名单版本号
  room.dealStart(dv[1], { mode: "normal", lordSeat: null, pools: P({ whitelist: SEED }), poolKey: "douzhu", poolLabel: "斗地主(3人)" });
  check("发将视图带所用环境(poolKey/poolLabel)", V(dv[2]).poolKey === "douzhu" && V(dv[2]).poolLabel === "斗地主(3人)");
  room.dealCancel(dv[1]);
  check("cfgRev 默认 0,由 DO 同步后进 roomState", room.viewFor(dv[1]).cfgRev === 0 && ((room.cfgRev = 123), room.viewFor(dv[1]).cfgRev === 123));
  // 多种子:规则不变量
  let bad = 0;
  for (let s = 1; s <= 200; s++) {
    let x = s * 7919; const r = () => (x = (x * 1103515245 + 12345) % 2147483648) / 2147483648;
    const rm = new RoomCore("t", 8, r); for (let i = 1; i <= 8; i++) rm.claimSeat("p" + i, i);
    if (!rm.dealStart("p1", { mode: "normal", lordSeat: 3, pools: P({ whitelist: SEED }) }).ok) { bad++; continue; }
    for (let k = 0; k < 6; k++) rm.dealSwap("p5", { seatNo: 5, slot: k });
    const ks = Object.values(rm.deal.hands).flatMap((h) => h.slots.map((q) => q.key));
    if (new Set(ks).size !== ks.length) bad++;
    if (Object.entries(rm.deal.hands).some(([n, h]) => h.slots.some((q) => q.src !== "lord" && q.key === "曹丕"))) bad++;
    if (rm.deal.hands[5].slots.some((q) => q.src !== "swap")) bad++;                          // 6 坑全换成功
    if (rm.deal.hands[5].slots.some((q) => rm.deal.hands[5].initKeys.includes(q.key))) bad++; // 换来的不与起手重复
    if (rm.deal.hands[3].slots.length !== 6 + Math.min(DEAL_LORD_EXTRA, P({ whitelist: SEED }).lord.length)) bad++;
  }
  check("200 个随机种子 × 8 人局:一坑一人/曹丕仅君主/换将不重复 全部成立", bad === 0);
  // 模式专属君主(教主张角/暴君董卓/昏君刘宏)只允许出现在「对应模式 + 君主的额外候选」;白名单里勾了也不例外(SEED 里三位都勾着)
  {
    const { DEAL_MODES } = await import("./shared/deal.mjs");
    const exIds = new Set(["教主张角", "暴君董卓", "昏君刘宏"].map(idOf));
    let stray = 0, forcedOk = 0, runs = 0;
    for (const mode of Object.keys(DEAL_MODES)) for (const lord of [1, null]) for (let s = 1; s <= 40; s++) {
      let x = s * 104729; const r = () => (x = (x * 1103515245 + 12345) % 2147483648) / 2147483648;
      const rm = new RoomCore("t", 8, r); for (let i = 1; i <= 8; i++) rm.claimSeat("p" + i, i);
      rm.dealStart("p1", { mode, lordSeat: lord, pools: P({ whitelist: SEED, mode }) }); runs++;
      for (let k = 0; k < 6; k++) for (let n = 2; n <= 8; n++) rm.dealSwap("p" + n, { seatNo: n, slot: k });
      const want = DEAL_MODES[mode].lordHero;
      for (const [n, h] of Object.entries(rm.deal.hands)) for (const q of h.slots) for (const o of q.opts) {
        if (!exIds.has(o.id)) continue;
        if (+n === lord && q.src === "lord" && o.name === want) forcedOk++; else stray++;
      }
      for (const g of rm.deal.pool) for (const o of g.opts) if (exIds.has(o.id)) stray++;
    }
    check("⭐ 模式专属君主不越界(4 模式×有/无君主×40 种子,含全员换将后与剩余将池)", stray === 0 && runs === 320);
    check("对应模式且有君主时,专属君主必在君主额外候选里", forcedOk === 3 * 40);
  }
}

// ───────── 身份自动发放 / 转座 / 发将武将锁定 / 新一局 ─────────
{
  const { IDENT_MODES, identDefaults, identCheck } = await import("./shared/identity.mjs");
  const mkRng = (seed) => { let x = seed * 104729; return () => (x = (x * 1103515245 + 12345) % 2147483648) / 2147483648; };
  const mkRoom = (seats, held, seed = 7) => { const rm = new RoomCore("t", seats, mkRng(seed)); for (const n of held) rm.claimSeat("p" + n, n); return rm; };
  const seatOf = (rm, dev) => [...rm.holdsOf(dev)][0];

  // 配比表:每个模式每个人数张数之和 = 人数,且过校验
  let tblBad = 0;
  for (const [k, m] of Object.entries(IDENT_MODES)) for (const n of Object.keys(m.table).map(Number)) {
    const d = identDefaults(k, n); const c = identCheck(k, n, d.counts, d.lost);
    if (c.error || Object.values(c.counts).reduce((a, b) => a + b, 0) !== n) tblBad++;
  }
  check("身份配比表:各模式各人数 张数之和=人数 且过校验", tblBad === 0);
  check("明忠 6 人 = 1主1忠3反1内(用户给的配置)", JSON.stringify(identDefaults("mingzhong", 6).counts) === JSON.stringify({ 主公: 1, 忠臣: 1, 反贼: 3, 内奸: 1 }));
  check("配比不等于人数 → COUNT_MISMATCH", identCheck("normal", 5, { 主公: 1, 忠臣: 1, 反贼: 1, 内奸: 1 }).error === "COUNT_MISMATCH");
  check("没有主公 → BAD_LEAD", identCheck("normal", 4, { 主公: 0, 忠臣: 2, 反贼: 1, 内奸: 1 }).error === "BAD_LEAD");

  // 普通身份局 8 人:主公亮明并成为 1 号位,其余按环形次序顺延
  {
    let ok = 0, runs = 0;
    for (let s = 1; s <= 60; s++) {
      const rm = mkRoom(8, [1, 2, 3, 4, 5, 6, 7, 8], s); runs++;
      const r = rm.identStart("p1", { mode: "normal" });
      const w = r.leadWas; // 抽到主公的原座位
      const rot = (o) => ((o - w + 8) % 8) + 1;
      const seatsOk = [1, 2, 3, 4, 5, 6, 7, 8].every((o) => seatOf(rm, "p" + o) === rot(o) && rm.seats[rot(o)].holderDevices[0] === "p" + o && rm.seats[rot(o)].seatNo === rot(o));
      const roles = Object.values(rm.ident.roles).map((x) => x.role).sort().join("");
      if (r.ok && seatsOk && rm.ident.roles[1].role === "主公" && rm.ident.roles[1].shown && Object.values(rm.ident.roles).filter((x) => x.shown).length === 1
        && roles === ["主公", "忠臣", "忠臣", "反贼", "反贼", "反贼", "反贼", "内奸"].sort().join("")) ok++;
    }
    check("⭐ 身份局 8 人×60 种子:主公亮明且变 1 号位,其余人按原环形次序顺延(6变1 7变2 8变3 1变4…)", ok === runs);
  }
  // 有空座:入座的人压到 1..k,空座排末尾
  {
    const rm = mkRoom(8, [2, 3, 5, 6, 8], 3);
    const r = rm.identStart("p2", { mode: "normal" });
    const order = [2, 3, 5, 6, 8], k = order.indexOf(r.leadWas);
    const exp = [...order.slice(k), ...order.slice(0, k)];
    check("5 人坐 8 座:入座者按环形次序压到 1~5 号,6~8 号为空座", r.ok && exp.every((o, i) => seatOf(rm, "p" + o) === i + 1) && [6, 7, 8].every((n) => rm.seats[n].holderDevices.length === 0) && Object.keys(rm.ident.roles).join() === "1,2,3,4,5");
    check("座位号仍是 1..8 连续", rm.seatNos().join() === "1,2,3,4,5,6,7,8");
  }
  // 保密
  {
    const rm = mkRoom(6, [1, 2, 3, 4, 5, 6], 11);
    rm.identStart("p1", { mode: "normal" });
    let leak = 0, mineOk = 0;
    for (let o = 1; o <= 6; o++) {
      const v = rm.viewFor("p" + o).ident, me = seatOf(rm, "p" + o);
      for (const [n, sv] of Object.entries(v.seats)) {
        if (+n === me) { if (sv.mine && sv.mine.role === rm.ident.roles[n].role && sv.mine.win) mineOk++; }
        else { if (sv.mine) leak++; if (+n !== 1 && sv.pub !== null) leak++; }
      }
      if (v.seats[1].pub !== "主公") leak++;
      if (JSON.stringify(v).includes('"roles"')) leak++;
    }
    check("⭐ 保密:别人座位只见 pub(仅主公亮明),看不到 mine", leak === 0);
    check("本人座位可见自己的身份与胜利条件", mineOk === 6);
    const spy = [2, 3, 4, 5, 6].find((n) => rm.ident.roles[n].role === "内奸"), dev = rm.seats[spy].holderDevices[0], other = rm.seats[spy === 2 ? 3 : 2].holderDevices[0];
    check("别人不能替活人亮身份 → NOT_HOLDER", rm.identShow(other, { seatNo: spy }).error === "NOT_HOLDER");
    rm.seats[spy].dead = true;
    check("已阵亡的座位任何人可代亮", rm.identShow(other, { seatNo: spy }).ok && rm.viewFor(other).ident.seats[spy].pub === "内奸");
    const reb = [2, 3, 4, 5, 6].find((n) => rm.ident.roles[n].role === "反贼");
    check("本人亮明 → 全场可见", rm.identShow(rm.seats[reb].holderDevices[0], { seatNo: reb }).ok && rm.viewFor(dev).ident.seats[reb].pub === "反贼");
    rm.identShowAll(dev);
    check("本局结束全部亮明", Object.values(rm.viewFor(other).ident.seats).every((x) => x.pub));
    const back = RoomCore.hydrate(JSON.parse(JSON.stringify(rm.serialize())));
    check("身份进 serialize/hydrate", back.ident && back.ident.over && back.ident.roles[1].role === "主公");
    check("identClear 清掉", rm.identClear(dev).ok && rm.viewFor(dev).ident === null);
  }
  // 明忠:主公暗、一名忠臣亮明坐 1 号位;忠臣>1 称储君
  {
    const rm = mkRoom(6, [1, 2, 3, 4, 5, 6], 5); rm.identStart("p1", { mode: "mingzhong" });
    const pubs = Object.values(rm.viewFor("zz").ident.seats).map((x) => x.pub).filter(Boolean);
    check("明忠 6 人:只亮明 1 号位的明忠,主公是暗的", rm.ident.roles[1].role === "忠臣" && rm.ident.roles[1].title === "明忠" && pubs.join() === "明忠");
    const r8 = mkRoom(8, [1, 2, 3, 4, 5, 6, 7, 8], 5); r8.identStart("p1", { mode: "mingzhong" });
    check("明忠 8 人(2 忠):亮明的那位称储君,另一名忠臣仍暗", r8.ident.roles[1].title === "储君" && Object.values(r8.ident.roles).filter((x) => x.shown).length === 1);
    check("明忠没有忠臣 → BAD_LEAD", mkRoom(3, [1, 2, 3]).identStart("p1", { mode: "mingzhong", counts: { 主公: 1, 忠臣: 0, 反贼: 1, 内奸: 1 } }).error === "BAD_LEAD");
  }
  // 失心疯:失心不占位,全场见「失心」,本人看不到真身,教主看得到
  {
    let ok = 0, runs = 0;
    for (let s = 1; s <= 40; s++) {
      const rm = mkRoom(8, [1, 2, 3, 4, 5, 6, 7, 8], s); rm.identStart("p1", { mode: "shixin" }); runs++;
      const lostSeats = Object.entries(rm.ident.roles).filter(([, r]) => r.lost).map(([n]) => +n);
      const master = rm.viewFor(rm.seats[1].holderDevices[0]).ident;
      const blindOk = lostSeats.every((n) => { const v = rm.viewFor(rm.seats[n].holderDevices[0]).ident.seats[n]; return v.pub === "失心" && v.mine.role === null && v.mine.win === null && !JSON.stringify(v).includes(rm.ident.roles[n].role); });
      const masterOk = lostSeats.every((n) => master.seats[1].mine.knows.some((t) => t.includes("座位 " + n) && t.includes(rm.ident.roles[n].role)));
      const othersBlind = [2, 3, 4, 5, 6, 7, 8].every((n) => lostSeats.every((l) => l === n || !rm.viewFor(rm.seats[n].holderDevices[0]).ident.seats[l].mine));
      if (rm.ident.roles[1].role === "教主" && lostSeats.length === 2 && !lostSeats.includes(1) && blindOk && masterOk && othersBlind) ok++;
    }
    check("⭐ 失心疯 8 人×40 种子:2 张失心、教主不会失心;失心本人看不到真身、教主看得到", ok === runs);
  }
  // 大忠似奸:义军互知
  {
    const rm = mkRoom(8, [1, 2, 3, 4, 5, 6, 7, 8], 9); rm.identStart("p1", { mode: "dazhong" });
    const yi = Object.entries(rm.ident.roles).filter(([, r]) => r.role === "义军").map(([n]) => +n);
    const v = rm.viewFor(rm.seats[yi[0]].holderDevices[0]).ident.seats[yi[0]].mine.knows.join();
    const zhong = +Object.entries(rm.ident.roles).find(([, r]) => r.role === "忠臣")[0];
    check("大忠似奸:义军看得到其他义军的座位,忠臣看不到", yi.length === 4 && yi.slice(1).every((n) => v.includes(String(n))) && rm.viewFor(rm.seats[zhong].holderDevices[0]).ident.seats[zhong].mine.knows.length === 0);
    check("大忠似奸:昏君亮明坐 1 号位,奸臣固定 1 名", rm.ident.roles[1].role === "昏君" && rm.ident.counts["奸臣"] === 1);
  }
  // 无间道:两主帅亮明,其一为 1 号位;牌背公开;主帅知道己方安插的内鬼
  {
    let ok = 0, runs = 0; const first = new Set();
    for (let s = 1; s <= 40; s++) {
      const rm = mkRoom(8, [1, 2, 3, 4, 5, 6, 7, 8], s); rm.identStart("p1", { mode: "wujian" }); runs++;
      const R = rm.ident.roles, find = (role) => +Object.entries(R).find(([, r]) => r.role === role)[0];
      first.add(R[1].role);
      const shown = Object.values(R).filter((r) => r.shown).map((r) => r.role).sort().join();
      const anyView = rm.viewFor("zz").ident.seats;
      const campOk = Object.entries(R).every(([n, r]) => anyView[n].camp === r.role[0]);
      const longV = rm.viewFor(rm.seats[find("龙主帅")].holderDevices[0]).ident.seats[find("龙主帅")].mine.knows.join("|");
      const knowOk = longV.includes(`座位 ${find("虎内鬼")}:虎内鬼(你方安插的自己人)`) && !longV.includes("龙内鬼") && !longV.includes("龙护卫");
      if (R[1].role.endsWith("主帅") && shown === "虎主帅,龙主帅" && campOk && knowOk) ok++;
    }
    check("⭐ 无间道 8 人×40 种子:两主帅亮明、1 号位是主帅、牌背公开、龙主帅只看到虎牌背(含己方安插的虎内鬼)", ok === runs);
    check("无间道:1 号位在龙/虎主帅之间随机", first.size === 2);
    check("无间道 7 人没有默认配比 → NO_DEFAULT", mkRoom(8, [1, 2, 3, 4, 5, 6, 7]).identStart("p1", { mode: "wujian" }).error === "NO_DEFAULT");
  }
  // 暴虐无道 5 人 + 自定义配比
  {
    const rm = mkRoom(5, [1, 2, 3, 4, 5], 2); rm.identStart("p1", { mode: "baonue" });
    check("暴虐无道 5 人 = 暴君1 诤臣1 间者1 逆乱2,暴君 1 号位", rm.ident.roles[1].role === "暴君" && Object.values(rm.ident.roles).filter((r) => r.role === "逆乱").length === 2);
    const c = mkRoom(5, [1, 2, 3, 4, 5], 2); c.identStart("p1", { mode: "normal", counts: { 主公: 1, 忠臣: 0, 反贼: 3, 内奸: 1 } });
    check("自定义配比生效", Object.values(c.ident.roles).filter((r) => r.role === "反贼").length === 3);
  }
  // 发身份与武将 / 发将的联动
  {
    const rm = mkRoom(4, [1, 2, 3, 4], 4);
    rm.setGeneral("p2", 2, "lvbu");
    rm.identStart("p1", { mode: "normal", clearGenerals: false });
    const ns = seatOf(rm, "p2");
    check("不清武将时,武将跟着人转座", rm.seats[ns].general === "lvbu" && rm.seatNos().filter((n) => rm.seats[n].general).length === 1);
    rm.identStart("p1", { mode: "normal" });
    check("默认发身份=新一局,清空全场武将", rm.seatNos().every((n) => !rm.seats[n].general));
    rm.deal = { mode: "normal", hands: {}, pool: [] };
    check("发将进行中不能发身份 → DEAL_ACTIVE", rm.identStart("p1", { mode: "normal" }).error === "DEAL_ACTIVE");
    rm.deal = null;
    check("只有 1 人入座 → NO_PLAYERS", mkRoom(4, [1]).identStart("p1", { mode: "normal" }).error === "NO_PLAYERS");
  }
  // 身份技能按所选武将给:明忠〖明察/舍身〗、教主张角〖蔽众〗、大忠似奸变种规则提示、明忠/无间道不发主公技候选
  {
    const { setHeroInfo } = await import("./shared/room-logic.mjs");
    const { readFileSync } = await import("node:fs");
    const HEROES2 = JSON.parse(readFileSync(new URL("./shared/generals.json", import.meta.url), "utf8"));
    const FEMALE = new Set(JSON.parse(readFileSync(new URL("./shared/hero-gender.json", import.meta.url), "utf8")).female);
    setHeroInfo(Object.fromEntries(HEROES2.map((h) => [h.tool || String(h.id), { name: h.name, hp: h.hp, female: FEMALE.has(h.id) }])));
    const gid = (name) => { const h = HEROES2.find((x) => x.name === name); return h.tool || String(h.id); };
    check("性别表:貂蝉/孙尚香/族荀采 女,关羽/郭嘉 男;女将 id 都是数字", ["貂蝉", "孙尚香", "族荀采"].every((n) => FEMALE.has(HEROES2.find((x) => x.name === n).id)) && ["关羽", "郭嘉"].every((n) => !FEMALE.has(HEROES2.find((x) => x.name === n).id)) && [...FEMALE].every(Number.isInteger));

    // 明忠技能
    const rm = mkRoom(6, [1, 2, 3, 4, 5, 6], 5); rm.identStart("p1", { mode: "mingzhong" });
    const mz = rm.seats[1].holderDevices[0], t3 = rm.seats[3].holderDevices[0];
    const mine = () => rm.viewFor(mz).ident.seats[1].mine;
    check("明忠没选将:技能待定,不能明察 → NO_SKILL", mine().skill.needHero && !mine().canPeek && rm.identPeek(mz, { seatNo: 1, targetSeat: 3 }).error === "NO_SKILL");
    rm.setGeneral(mz, 1, gid("关羽"));
    check("明忠选 4 血男将(关羽)→ 舍身,不能明察", mine().skill.name === "舍身" && !mine().canPeek && rm.identPeek(mz, { seatNo: 1, targetSeat: 3 }).error === "NO_SKILL");
    rm.setGeneral(mz, 1, gid("貂蝉"));
    check("明忠选 3 血女将(貂蝉)→ 舍身", mine().skill.name === "舍身" && !mine().canPeek);
    rm.setGeneral(mz, 1, gid("郭嘉"));
    check("明忠选 3 血男将(郭嘉)→ 明察", mine().skill.name === "明察" && mine().skill.hero === "郭嘉" && mine().canPeek);
    check("明察:别人不能替明忠看 / 不能看自己 / 非明忠没有", rm.identPeek(t3, { seatNo: 1, targetSeat: 2 }).error === "NOT_HOLDER" && rm.identPeek(mz, { seatNo: 1, targetSeat: 1 }).error === "BAD_TARGET" && rm.identPeek(t3, { seatNo: 3, targetSeat: 2 }).error === "NO_IDENT");
    check("⭐ 明察:明忠秘密看到目标身份,整局一次,别人看不到结果", rm.identPeek(mz, { seatNo: 1, targetSeat: 3 }).ok
      && mine().knows.some((t) => t.includes("座位 3") && t.includes(rm.ident.roles[3].role)) && !mine().canPeek
      && rm.identPeek(mz, { seatNo: 1, targetSeat: 4 }).error === "ALREADY_PEEKED" && !JSON.stringify(rm.viewFor(t3).ident).includes("明察") && rm.viewFor(t3).ident.seats[3].pub === null);
    check("非明忠座位没有 skill 字段", rm.viewFor(t3).ident.seats[3].mine.skill === undefined);

    // 明忠 / 无间道:发将不给主公技候选
    const g = (k, id, lord = false) => ({ key: k, opts: [{ id, name: k, gid: String(id), lord }] });
    const pools = () => ({ normal: Array.from({ length: 60 }, (_, i) => g("将" + i, 100 + i)), lord: Array.from({ length: 8 }, (_, i) => g("主" + i, 300 + i, true)), forced: null });
    rm.dealStart(mz, { mode: "normal", lordSeat: 1, pools: pools() });
    check("⭐ 明忠模式发将:不发主公技候选(每人 6 坑全是起手)", Object.values(rm.deal.hands).every((h) => h.slots.length === 6 && h.slots.every((q) => q.src === "init")));
    rm.dealCancel(mz);
    { // 明忠先选先亮,其余人随后暗选、一起亮出(用户 2026-10-02 报的 bug:原来全员一起亮)
      rm.dealStart(t3, { mode: "normal", lordSeat: 4, pools: pools() }); // 传别的君主座位也以明忠为准
      const d = rm.deal, pick = (dev, n) => rm.dealPick(dev, { seatNo: n, slot: 0, heroId: d.hands[n].slots[0].opts[0].id });
      const v3 = () => rm.viewFor(t3).deal;
      check("明忠模式发将:先选的是明忠(1 号位),称谓「明忠」", d.lordSeat === 1 && d.lordTitle === "明忠" && v3().lordTitle === "明忠" && !d.lordPicked);
      check("明忠没选定前,其余人不能选 → LORD_FIRST", pick(t3, 3).error === "LORD_FIRST");
      const want = d.hands[1].slots[0].opts[0];
      check("⭐ 明忠选定即亮出落座、锁定、不可改;别人立刻看得到", pick(mz, 1).ok && d.lordPicked && rm.seats[1].general === want.gid && rm.seats[1].genLocked
        && v3().seats[1].final && v3().seats[1].pick.name === want.name && rm.dealPick(mz, { seatNo: 1, slot: 1, heroId: d.hands[1].slots[1].opts[0].id }).error === "ALREADY_PICKED");
      check("其余人随后暗选:选完前别人看不到,武将还没落座", pick(t3, 3).ok && !rm.seats[3].general && rm.viewFor(mz).deal.seats[3].pick === undefined && rm.viewFor(mz).deal.seats[3].picked);
      for (const n of [2, 4, 5, 6]) pick(rm.seats[n].holderDevices[0], n);
      check("全员选完一起亮出", rm.dealReveal(mz).ok && rm.deal === null && [2, 3, 4, 5, 6].every((n) => rm.seats[n].general && rm.seats[n].genLocked));
      const r8 = mkRoom(8, [1, 2, 3, 4, 5, 6, 7, 8], 5); r8.identStart("p1", { mode: "mingzhong" });
      r8.dealStart("p1", { mode: "normal", lordSeat: null, pools: pools() });
      check("明忠 8 人(2 忠):先选的是储君(1 号位),另一名暗忠臣与其他人一起", r8.deal.lordSeat === 1 && r8.deal.lordTitle === "储君");
    }
    const wj = mkRoom(8, [1, 2, 3, 4, 5, 6, 7, 8], 3); wj.identStart("p1", { mode: "wujian" });
    wj.dealStart("p1", { mode: "normal", lordSeat: 1, pools: pools() });
    check("无间道发将:不发主公技候选(每人 6 坑)", wj.deal.lordSeat === null && Object.values(wj.deal.hands).every((h) => h.slots.length === 6));
    { // 两名主帅先各自暗选,都选定后一起亮出;其余人再选(用户 2026-10-02)
      const d = wj.deal, R = wj.ident.roles, dev = (n) => wj.seats[n].holderDevices[0];
      const [la, lb] = Object.keys(R).map(Number).filter((n) => R[n].role.endsWith("主帅")), other = [1, 2, 3, 4, 5, 6, 7, 8].find((n) => n !== la && n !== lb);
      const pick = (n, k = 0) => wj.dealPick(dev(n), { seatNo: n, slot: k, heroId: d.hands[n].slots[k].opts[0].id });
      check("无间道发将:先选的是两名主帅,称谓「主帅」", JSON.stringify(d.firstSeats) === JSON.stringify([la, lb]) && d.lordTitle === "主帅" && wj.viewFor(dev(other)).deal.firstSeats.length === 2);
      check("主帅没亮完,其余人不能选 → LORD_FIRST", pick(other).error === "LORD_FIRST");
      check("⭐ 一名主帅先选:暗置、未落座、对方看不到内容、还能改", pick(la).ok && !d.lordPicked && !wj.seats[la].general && !d.hands[la].pick.final
        && wj.viewFor(dev(lb)).deal.seats[la].picked && wj.viewFor(dev(lb)).deal.seats[la].pick === undefined && pick(la, 1).ok && pick(other).error === "LORD_FIRST");
      const wantA = d.hands[la].slots[1].opts[0], wantB = d.hands[lb].slots[0].opts[0];
      check("⭐ 另一名主帅选定 → 两人一起亮出落座并锁定", pick(lb).ok && d.lordPicked && wj.seats[la].general === wantA.gid && wj.seats[lb].general === wantB.gid
        && wj.seats[la].genLocked && wj.seats[lb].genLocked && wj.viewFor(dev(other)).deal.seats[la].pick.name === wantA.name && pick(la).error === "ALREADY_PICKED");
      check("主帅亮完后其余人暗选,全员选完一起亮出", pick(other).ok && !wj.seats[other].general && wj.dealReveal(dev(other)).error === "NOT_ALL_PICKED"
        && [1, 2, 3, 4, 5, 6, 7, 8].filter((n) => n !== la && n !== lb && n !== other).every((n) => pick(n).ok) && wj.dealReveal(dev(other)).ok && wj.seatNos().every((n) => wj.seats[n].general));
    }
    { // 立绘皮肤:公开、仅持有者可换、换将重置
      const sk = mkRoom(4, [1, 2], 2);
      check("没选将不能设皮肤 → NO_GENERAL", sk.setSkin("p1", 1, 2407).error === "NO_GENERAL");
      sk.setGeneral("p1", 1, gid("貂蝉"));
      check("皮肤:持有者可设,全场可见;别人不能设;非法 id 拒绝", sk.setSkin("p1", 1, 2407).ok && sk.viewFor("p2").seats[1].skin === 2407
        && sk.setSkin("p2", 1, 2401).error === "NOT_HOLDER" && sk.setSkin("p1", 1, "x").error === "BAD_SKIN" && sk.setSkin("p1", 1, -3).error === "BAD_SKIN");
      const back = RoomCore.hydrate(JSON.parse(JSON.stringify(sk.serialize())));
      check("皮肤进 serialize;设 null 回默认;换将重置", back.seats[1].skin === 2407 && sk.setSkin("p1", 1, null).ok && sk.seats[1].skin === null
        && sk.setSkin("p1", 1, 2401).ok && sk.setGeneral("p1", 1, gid("郭嘉")).ok && sk.seats[1].skin === null);
      const SK = JSON.parse(readFileSync(new URL("./shared/hero-skins.json", import.meta.url), "utf8"));
      const libIds = new Set(HEROES2.map((h) => h.id));
      check("皮肤表:条目格式 [id,名,品质];alias 的源都在库里、目标都有皮肤", Object.values(SK.skins).every((l) => l.length && l.every((x) => Number.isInteger(x[0]) && x[1] && typeof x[2] === "string"))
        && Object.entries(SK.alias).every(([a, b]) => libIds.has(+a) && SK.skins[b]) && SK.skins[24].some((x) => x[0] === 2407));
    }
    const nm = mkRoom(4, [1, 2, 3, 4], 3); nm.identStart("p1", { mode: "normal" });
    nm.dealStart("p1", { mode: "normal", lordSeat: 1, pools: pools() });
    check("普通身份局发将:君主照常多 6 个主公技候选,称谓「主公」", nm.deal.lordSeat === 1 && nm.deal.hands[1].slots.length === 12 && nm.deal.lordTitle === "主公");

    // 大忠似奸变种规则提示
    const dz = mkRoom(8, [1, 2, 3, 4, 5, 6, 7, 8], 9); dz.identStart("p1", { mode: "dazhong" });
    const dzMine = (n) => dz.viewFor(dz.seats[n].holderDevices[0]).ident.seats[n].mine;
    check("大忠似奸:昏君的「我的身份」带变种规则(袒佞 + 两条分线 + 刘宏例外)", dzMine(1).variant.rule === "dazhong-variant" && ["袒佞", "昏庸无道", "幡然醒悟", "昏君刘宏"].every((k) => dzMine(1).variant.lines.join().includes(k)));
    check("大忠似奸:其余身份也有各自的变种提示;别的模式没有", [2, 3, 4, 5, 6, 7, 8].every((n) => dzMine(n).variant.lines.length) && nm.viewFor("p1").ident.seats[[...nm.holdsOf("p1")][0]].mine.variant === undefined);

    // 蔽众
    let ok = 0, runs = 0;
    for (let s = 1; s <= 30; s++) {
      const sx = mkRoom(8, [1, 2, 3, 4, 5, 6, 7, 8], s); sx.identStart("p1", { mode: "shixin" }); runs++;
      const jz = sx.seats[1].holderDevices[0], R = sx.ident.roles, jm = () => sx.viewFor(jz).ident.seats[1].mine;
      const lost0 = Object.keys(R).filter((n) => R[n].lost).map(Number), tgt = [2, 3, 4, 5, 6, 7, 8].find((n) => !R[n].lost), tdev = sx.seats[tgt].holderDevices[0];
      let good = jm().bz === undefined && sx.identBizhong(jz, { seatNo: 1, targetSeat: tgt }).error === "NO_SKILL"; // 没选教主张角 → 没有蔽众
      sx.setGeneral(jz, 1, gid("教主张角"));
      good = good && jm().bz.stage === "can"
        && sx.identBizhong(tdev, { seatNo: 1, targetSeat: tgt }).error === "NOT_HOLDER"
        && sx.identBizhong(jz, { seatNo: 1, targetSeat: lost0[0] }).error === "BAD_TARGET"   // 已是失心
        && sx.identBizhong(jz, { seatNo: 1, targetSeat: 1 }).error === "BAD_TARGET"
        && sx.identSwapLost(jz, { seatNo: 1, a: lost0[0], b: lost0[1] }).error === "NO_SKILL"; // 还没发动不能换
      const before = sx.viewFor(tdev).ident.seats[tgt].mine.role, tRole = R[tgt].role;
      good = good && before === tRole && sx.identBizhong(jz, { seatNo: 1, targetSeat: tgt }).ok;
      const tv = sx.viewFor(tdev).ident.seats[tgt];
      good = good && tv.pub === "失心" && tv.mine.role === null && tv.mine.win === null                       // 目标变失心:自己看不到了
        && sx.viewFor("zz").ident.lost === 3 && sx.viewFor("zz").ident.seats[tgt].pub === "失心"
        && jm().bz.stage === "swap" && jm().bz.lost.length === 3 && jm().bz.lost.find((x) => x.seat === tgt).role === tRole // 教主看到其身份
        && sx.identBizhong(jz, { seatNo: 1, targetSeat: [2, 3, 4, 5, 6, 7, 8].find((n) => !R[n].lost) }).error === "ALREADY_USED";
      const a = lost0[0], ra = R[a].role;
      good = good && sx.identSwapLost(jz, { seatNo: 1, a, b: tgt }).ok && R[a].role === tRole && R[tgt].role === ra
        && sx.identSwapLost(jz, { seatNo: 1, a, b: a }).error === "BAD_TARGET"
        && sx.identSwapLost(jz, { seatNo: 1, a, b: [2, 3, 4, 5, 6, 7, 8].find((n) => !R[n].lost) }).error === "BAD_TARGET" // 非失心不能换
        && sx.identSwapLost(jz, { seatNo: 1, a: lost0[1], b: tgt }).ok                                                    // 可多次
        && jm().knows.filter((t) => t.includes("失心")).length === 3
        && Object.values(R).map((x) => x.role).sort().join() === ["教主", "护法", "护法", "官兵", "官兵", "官兵", "内奸", "内奸"].sort().join() // 身份牌总数不变
        && sx.identBizhongDone(jz, { seatNo: 1 }).ok && jm().bz.stage === "done"
        && sx.identSwapLost(jz, { seatNo: 1, a, b: tgt }).error === "NO_SKILL";
      for (const n of [2, 3, 4, 5, 6, 7, 8]) if (JSON.stringify(sx.viewFor(sx.seats[n].holderDevices[0]).ident).includes('"bz"')) good = false; // 别人看不到蔽众面板
      if (good) ok++;
    }
    check("⭐ 蔽众 8 人×30 种子:仅教主张角可发动、目标变失心且自己看不到、教主可任意交换失心身份(多次)、完成后关闭、别人看不到", ok === runs);
    setHeroInfo({});
  }
  // 线上发将亮出的武将锁定,不可再手动改;新一局 / 重新发将才解
  {
    const g = (k, id) => ({ key: k, opts: [{ id, name: k, gid: String(id), lord: false }] });
    const pools = { normal: Array.from({ length: 30 }, (_, i) => g("将" + i, 100 + i)), lord: [], forced: null };
    const rm = mkRoom(4, [1, 2], 6);
    rm.dealStart("p1", { mode: "normal", lordSeat: null, pools });
    for (const n of [1, 2]) rm.dealPick("p" + n, { seatNo: n, slot: 0, heroId: rm.deal.hands[n].slots[0].opts[0].id });
    rm.dealReveal("p1");
    const g1 = rm.seats[1].general;
    check("⭐ 发将亮出后武将锁定:手动改 → GENERAL_LOCKED,武将不变", rm.seats[1].genLocked && rm.setGeneral("p1", 1, "lvbu").error === "GENERAL_LOCKED" && rm.seats[1].general === g1 && rm.viewFor("p1").seats[1].genLocked === true);
    rm.claimSeat("p3", 3);
    check("没参与发将的座位照常手动选", rm.setGeneral("p3", 3, "lvbu").ok && !rm.seats[3].genLocked);
    check("重新发将 → 参与座位解锁", rm.dealStart("p1", { mode: "normal", lordSeat: null, pools }).ok && !rm.seats[1].genLocked);
    rm.dealCancel("p1"); rm.seats[2].genLocked = true;
    rm.identStart("p1", { mode: "normal" });
    check("新一局:清空武将/身份/锁定,座位持有不动", rm.newGame("p2").ok && rm.ident === null && rm.seatNos().every((n) => !rm.seats[n].general && !rm.seats[n].genLocked) && rm.holdsOf("p1").size === 1 && rm.holdsOf("p3").size === 1);
  }
}

console.log(`\n结果: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
