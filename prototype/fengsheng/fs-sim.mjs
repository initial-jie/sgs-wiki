// 风声房间 "可执行规格" —— 选角保密 / 身份保密 / 情报区 / 濒死死亡 / 宣胜校验 / 篡夺者 / 镇压者 / 持久化
// 复用与真实 Workers 同一份核心逻辑(./shared/fs-logic.mjs)。
// node prototype/fengsheng/fs-sim.mjs

import { FsCore, intelCounts, defaultIdCounts } from "./shared/fs-logic.mjs";
import { CHARACTERS, CHAR_BY_ID, TASKS } from "./shared/fs-data.mjs";

let passed = 0, failed = 0;
function check(name, cond, detail = "") {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail ? "  <- " + detail : ""}`); }
}
// 可复现的伪随机(线性同余)
function lcg(seed) { let x = seed >>> 0; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); }

const N = 5;
const room = new FsCore("7788", N, lcg(42));
const dev = {}; for (let i = 1; i <= N; i++) { dev[i] = `p${i}`; room.claimSeat(dev[i], i); }
const V = (i) => room.viewFor(dev[i]);
const act = (i, o) => room.action(dev[i], o);

console.log("\n=== 数据 ===");
check("角色 49 名,基础包 28", CHARACTERS.length === 49 && CHARACTERS.filter((c) => c.pack === "base").length === 28);
check("每个角色都有技能文本", CHARACTERS.every((c) => c.skills.length && c.skills.every((k) => k.text)));
check("基础包神秘人任务 3 种", TASKS.filter((t) => t.pack === "base").length === 3);
check("5 人默认配比 2/2/1", JSON.stringify(defaultIdCounts(5)) === JSON.stringify({ red: 2, blue: 2, green: 1 }));
check("座位数上下限 3~9", FsCore.MIN_SEATS === 3 && FsCore.MAX_SEATS === 9);

console.log("\n=== 选角 2 选 1(候选仅本人可见)===");
check("发角色", act(1, { op: "dealChars", per: 2 }).ok);
const off1 = V(1).seats[1].offers;
check("1 号看到自己 2 张候选", Array.isArray(off1) && off1.length === 2);
check("2 号看不到 1 号候选,只见张数", V(2).seats[1].offers === undefined && V(2).seats[1].offerCount === 2);
check("候选全场不重复", new Set(room.seatNos().flatMap((n) => room.seats[n].offers)).size === 2 * N);
const notOffered = CHARACTERS.find((c) => !off1.includes(c.id)).id;
check("不能选候选外的角色", act(1, { op: "pickChar", seatNo: 1, charId: notOffered }).error === "NOT_OFFERED");
check("不能替别人选", act(2, { op: "pickChar", seatNo: 1, charId: off1[0] }).error === "NOT_HOLDER");
// 让 1 号选到一个隐藏角色:直接找候选里的隐藏角色,没有就用手选模式(清候选后登记李宁玉)
room.seats[1].offers = []; // 模拟"用实体牌选角"
check("无候选时可登记任意角色(李宁玉,隐藏)", act(1, { op: "pickChar", seatNo: 1, charId: 28 }).ok);
check("隐藏角色默认面朝下", room.seats[1].faceUp === false);
check("本人看得到自己的隐藏角色", V(1).seats[1].charId === 28);
check("他人看不到面朝下的隐藏角色", V(2).seats[1].charId === null && V(2).seats[1].hasChar === true);
check("日志不泄露隐藏角色名", !room.log.some((l) => l.includes("李宁玉")));
for (let i = 2; i <= N; i++) act(i, { op: "pickChar", seatNo: i, charId: V(i).seats[i].offers[0] });
{ const pub = [2, 3, 4, 5].filter((n) => !CHAR_BY_ID[room.seats[n].charId].hidden), hid = [2, 3, 4, 5].filter((n) => CHAR_BY_ID[room.seats[n].charId].hidden);
  check("公开角色他人可见", pub.every((n) => V(1).seats[n].charId === room.seats[n].charId), JSON.stringify(pub));
  check("候选里的隐藏角色选定后他人不可见", hid.every((n) => V(1).seats[n].charId === null)); }
check("翻开隐藏角色后全场可见", act(3, { op: "flipChar", seatNo: 1, faceUp: true }).ok && V(2).seats[1].charId === 28);
act(1, { op: "flipChar", seatNo: 1, faceUp: false });
check("翻回面朝下又隐藏", V(2).seats[1].charId === null);

console.log("\n=== 发身份(仅本人可见)===");
check("配比与座位数不符拒绝", (act(1, { op: "setIdCounts", red: 2, blue: 2, green: 2 }), act(1, { op: "dealIdentities" }).error === "COUNT_MISMATCH"));
act(1, { op: "setIdCounts", red: 2, blue: 2, green: 1 });
check("系统发身份", act(1, { op: "dealIdentities" }).ok);
const facs = room.seatNos().map((n) => room.seats[n].identity.faction);
check("配比正确 2/2/1", facs.filter((f) => f === "red").length === 2 && facs.filter((f) => f === "blue").length === 2 && facs.filter((f) => f === "green").length === 1);
const g = room.seatNos().find((n) => room.seats[n].identity.faction === "green");
check("神秘人抽到基础包任务", ["shuangmian", "zhenya", "cuanduo"].includes(room.seats[g].identity.task));
check("本人看得到自己身份", V(1).seats[1].identity?.faction === room.seats[1].identity.faction);
check("他人看不到身份", V(2).seats[1].identity === null && V(2).seats[1].hasIdentity === true);
check("日志不泄露身份", !room.log.some((l) => /潜伏战线|特工机关/.test(l) && !l.includes("系统发身份")));

// 固定身份,便于后续断言:1,2=红 3,4=蓝 5=神秘人
const setId = (i, faction, task) => act(i, { op: "setIdentity", seatNo: i, faction, task });
setId(1, "red"); setId(2, "red"); setId(3, "blue"); setId(4, "blue"); setId(5, "green", "cuanduo");
check("只能改自己的身份", act(2, { op: "setIdentity", seatNo: 1, faction: "blue" }).error === "NOT_HOLDER");
check("神秘人必须带合法任务", act(5, { op: "setIdentity", seatNo: 5, faction: "green", task: "nope" }).error === "BAD_TASK");

console.log("\n=== 情报区 / 濒死 / 死亡 ===");
check("开局", act(1, { op: "startGame", first: 1 }).ok && room.phase === "play" && room.turn === 1);
act(2, { op: "addIntel", seatNo: 3, kind: "k" });
act(2, { op: "addIntel", seatNo: 3, kind: "rk" });
check("双色情报同时计入两色", intelCounts(room.seats[3].intel).red === 1 && intelCounts(room.seats[3].intel).black === 2);
check("纯黑单独计数", intelCounts(room.seats[3].intel).pureBlack === 1);
act(2, { op: "addIntel", seatNo: 3, kind: "bk" });
check("黑色 3 张→濒死", room.seats[3].dying === true && !room.seats[3].dead);
const blackId = room.seats[3].intel.find((x) => x.kind === "k").id;
check("移除一张黑情报(澄清)→脱离濒死", act(4, { op: "removeIntel", seatNo: 3, intelId: blackId }).ok && room.seats[3].dying === false);
act(2, { op: "addIntel", seatNo: 3, kind: "k" });
check("再次濒死", room.seats[3].dying);
check("确认死亡", act(1, { op: "confirmDeath", seatNo: 3 }).ok && room.seats[3].dead);
check("死者身份全场公开", V(1).seats[3].identity?.faction === "blue");
check("本回合死亡被记录(红蓝合计 2)", room.turnDeaths.length === 1 && room.turnDeaths[0].rb === 2);
check("死者不能再加情报", act(1, { op: "addIntel", seatNo: 3, kind: "r" }).error === "DEAD");
check("撤销死亡", act(1, { op: "revive", seatNo: 3 }).ok && !room.seats[3].dead && room.seats[3].dying && room.turnDeaths.length === 0);
act(1, { op: "confirmDeath", seatNo: 3 });

console.log("\n=== 回合 ===");
check("下一回合跳过死者", (act(1, { op: "nextTurn" }), room.turn === 2) && (act(1, { op: "nextTurn" }), room.turn === 4));
check("换回合清空本回合死亡", room.turnDeaths.length === 0);

console.log("\n=== 宣胜 ===");
check("未满足不能宣胜(只回本人)", act(1, { op: "declareWin", seatNo: 1 }).error === "NOT_WIN_YET" && room.phase === "play");
act(4, { op: "addIntel", seatNo: 2, kind: "r" }); act(4, { op: "addIntel", seatNo: 2, kind: "r" }); act(4, { op: "addIntel", seatNo: 2, kind: "rk" });
check("2 号(红)可宣胜提示仅本人可见", V(2).seats[2].canWin === true && V(1).seats[2].canWin === undefined);
check("1 号自己情报不够→无提示", V(1).seats[1].canWin === false);
check("队友 2 号集齐,1 号宣胜也成立", act(1, { op: "declareWin", seatNo: 1 }).ok);
check("潜伏战线全员胜利(含队友)", room.phase === "over" && JSON.stringify(room.result.winners) === "[1,2]");
check("结束后所有身份公开", [1, 2, 3, 4, 5].every((n) => V(3).seats[n].identity));
check("结束后隐藏角色公开", V(3).seats[1].charId === 28);
check("结束后不能再改情报区", act(1, { op: "addIntel", seatNo: 1, kind: "r" }).error === "GAME_OVER");

console.log("\n=== 篡夺者:其回合有人宣胜 → 代替胜利 ===");
check("再来一局保留座位与持有者", act(1, { op: "newGame" }).ok && room.phase === "setup" && room.seats[1].holderDevices[0] === "p1" && !room.seats[1].identity);
setId(1, "red"); setId(2, "red"); setId(3, "blue"); setId(4, "blue"); setId(5, "green", "cuanduo");
act(1, { op: "startGame", first: 5 });
for (let k = 0; k < 3; k++) act(1, { op: "addIntel", seatNo: 3, kind: "b" });
check("3 号宣胜 → 被 5 号篡夺", act(3, { op: "declareWin", seatNo: 3 }).ok && JSON.stringify(room.result.winners) === "[5]");

console.log("\n=== 镇压者:其回合中红蓝≥2 的角色死亡 ===");
act(1, { op: "newGame" });
setId(1, "red"); setId(2, "red"); setId(3, "blue"); setId(4, "blue"); setId(5, "green", "zhenya");
act(1, { op: "startGame", first: 5 });
act(1, { op: "addIntel", seatNo: 1, kind: "r" }); act(1, { op: "addIntel", seatNo: 1, kind: "rk" });
check("还没人死,不能宣胜", act(5, { op: "declareWin", seatNo: 5 }).error === "NOT_WIN_YET");
act(1, { op: "confirmDeath", seatNo: 1 });
check("死亡后镇压者本人得到提示", V(5).seats[5].canWin === true);
check("镇压者宣胜成功,只有自己胜", act(5, { op: "declareWin", seatNo: 5 }).ok && JSON.stringify(room.result.winners) === "[5]");

console.log("\n=== 双面间谍 / 手动结算 ===");
act(1, { op: "newGame" });
setId(5, "green", "shuangmian"); act(1, { op: "startGame" });
for (let k = 0; k < 3; k++) act(1, { op: "addIntel", seatNo: 5, kind: "rk" });
check("双面间谍 3 红(双色)即可宣胜", act(5, { op: "declareWin", seatNo: 5 }).ok && JSON.stringify(room.result.winners) === "[5]");
act(1, { op: "newGame" });
check("手动结算", act(2, { op: "forceEnd", winners: [2, 4], note: "秦圆圆比翼双飞" }).ok && room.phase === "over" && room.result.reason.includes("比翼"));

console.log("\n=== 座位增减 / 持久化 ===");
act(1, { op: "newGame" });
check("加座位 → 配比随人数变(6人 2/2/2)", room.addSeat(dev[1]).ok && JSON.stringify(room.idCounts) === JSON.stringify({ red: 2, blue: 2, green: 2 }));
check("减座位不能低于 3", (room.removeSeat(dev[1]), room.removeSeat(dev[1]), room.removeSeat(dev[1]), room.removeSeat(dev[1]).error === "MIN_SEATS"));
setId(1, "blue"); act(2, { op: "addIntel", seatNo: 2, kind: "bk" }); act(1, { op: "setPack", pack: "all" });
const back = FsCore.hydrate(JSON.parse(JSON.stringify(room.serialize())));
check("序列化往返:身份/情报/卡池/持有", back.seats[1].identity.faction === "blue" && back.seats[2].intel.length === 1 && back.pack === "all" && back.isHolder("p2", 2));
check("往返后保密视图一致", JSON.stringify(back.viewFor("p3")) === JSON.stringify(room.viewFor("p3")));
check("往返后情报编号不重复", (back.action("p1", { op: "addIntel", seatNo: 1, kind: "r" }), new Set(back.seats[1].intel.concat(back.seats[2].intel).map((x) => x.id)).size === 2));
check("改名后座位与身份仍在", room.renameDevice("p1", "小明").ok && room.viewFor("小明").seats[1].identity?.faction === "blue");

console.log(`\n结果: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
