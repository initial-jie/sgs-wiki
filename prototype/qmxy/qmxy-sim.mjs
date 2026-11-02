// 枪鸣锈语房间 "可执行规格" —— 身份保密(脑公开/阵亡公开)/ 选角候选 / 三属性与超意识 / 血量弹匣台账 / 装备延时牌 / 命中判定 / 安全协议 / 死亡奖惩与终局 / 持久化
// 复用与真实 Workers 同一份核心逻辑(./shared/qmxy-logic.mjs)。
// node prototype/qmxy/qmxy-sim.mjs

import { QmxyCore, hitCheck, defaultIdCounts } from "./shared/qmxy-logic.mjs";
import { HEROES, HERO_BY_ID, CARDS, NPCS, DEFAULT_ID_COUNTS } from "./shared/qmxy-data.mjs";

let passed = 0, failed = 0;
function check(name, cond, detail = "") {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail ? "  <- " + detail : ""}`); }
}
function lcg(seed) { let x = seed >>> 0; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); }

console.log("\n=== 数据 ===");
check("基础包 24 名 id 连续;扩展 11 名 id 101~111", HEROES.filter((h) => !h.pack).length === 24 && HEROES.filter((h) => !h.pack).every((h, i) => h.id === i + 1) && HEROES.filter((h) => h.pack === "wuqu").length === 11 && HEROES.filter((h) => h.pack === "wuqu").every((h, i) => h.id === 101 + i));
check("每个角色有血量/补给/子弹与技能文本", HEROES.every((h) => h.hp > 0 && h.supply >= 0 && h.ammo >= 0 && h.skills.length && h.skills.every((k) => k.name && k.text)));
check("左慈 0/0,大乔 6 弹", HERO_BY_ID[17].supply === 0 && HERO_BY_ID[17].ammo === 0 && HERO_BY_ID[4].ammo === 6);
check("牌表 4 类齐全(基础 8 装备;扩展 4 张)", ["basic", "tactic", "delay", "equip"].every((t) => CARDS.some((c) => c.type === t)) && CARDS.filter((c) => c.type === "equip" && !c.pack).length === 8 && CARDS.filter((c) => c.pack === "wuqu").length === 4);
check("待核牌标记 verified:false", CARDS.filter((c) => c.verified === false).map((c) => c.name).join(",") === "归零斩,夺取,剥离,无中生有,无懈可击");
check("身份表 3~8 人", [3, 4, 5, 6, 7, 8].every((n) => DEFAULT_ID_COUNTS[n].reduce((a, b) => a + b) === n));
check("5 人默认 1/1/2/1", JSON.stringify(defaultIdCounts(5)) === JSON.stringify({ brain: 1, immune: 1, virus: 2, mutant: 1 }));
check("座位 3~8", QmxyCore.MIN_SEATS === 3 && QmxyCore.MAX_SEATS === 8);

console.log("\n=== 命中判定(纯函数)===");
const ring = [1, 2, 3, 4, 5, 6];
const hc = (o) => hitCheck(ring, o);
check("相邻 隔 0 人", hc({ shooter: 1, target: 2, drawn: "1" }).between === 0 && hc({ shooter: 1, target: 6, drawn: "1" }).between === 0);
check("隔 1 人 -1:翻 1 点未中、2 点命中", !hc({ shooter: 1, target: 3, drawn: "1" }).hit && hc({ shooter: 1, target: 3, drawn: "2" }).hit);
check("对面(隔 2)取最短路", hc({ shooter: 1, target: 4, drawn: "3" }).between === 2 && hc({ shooter: 1, target: 4, drawn: "3" }).points === 1);
check("恰好命中标记", hc({ shooter: 1, target: 4, drawn: "3" }).exact === true && hc({ shooter: 1, target: 2, drawn: "2" }).exact === false);
check("扫射 -2、向前翻滚 +1", hc({ shooter: 1, target: 2, mode: "spray", drawn: "2" }).hit === false && hc({ shooter: 1, target: 2, mode: "spray", drawn: "2", bonus: 1 }).hit === true);
check("爆头无视修正且伤害 2", (() => { const r = hc({ shooter: 1, target: 4, mode: "spray", drawn: "head" }); return r.hit && r.damage === 2; })());
check("哑火无视修正不中", hc({ shooter: 1, target: 2, drawn: "dud", bonus: 5 }).hit === false);
check("吕布 4 点视为爆头", hc({ shooter: 1, target: 4, drawn: "4", shooterHero: 19 }).damage === 2);
check("偏折头盔:扫射/爆头无效,点射照常", !hc({ shooter: 1, target: 2, drawn: "head", targetEquips: ["toukui"] }).hit && !hc({ shooter: 1, target: 2, mode: "spray", drawn: "4", targetEquips: ["toukui"] }).hit && hc({ shooter: 1, target: 2, drawn: "4", targetEquips: ["toukui"] }).hit);
check("孙鲁班反转:哑火→命中、1 点隔 1 人→命中", hc({ shooter: 1, target: 2, drawn: "dud", shooterHero: 6 }).hit && hc({ shooter: 1, target: 3, drawn: "1", shooterHero: 6 }).hit && !hc({ shooter: 1, target: 2, drawn: "4", shooterHero: 6 }).hit);
check("自己打自己 / 不在桌上 报错", hc({ shooter: 1, target: 1, drawn: "1" }).error === "SELF_SHOT" && hitCheck([1, 2], { shooter: 1, target: 3, drawn: "1" }).error === "NOT_ON_TABLE");
{ const ab = new Set([2, 4]);
  check("深渊:不同空间不能互射", hc({ shooter: 1, target: 2, drawn: "4", abyss: ab }).error === "DIFF_SPACE");
  check("深渊:同空间隔人只数同空间(1→3 隔 2 号在深渊 → 隔 0)", hc({ shooter: 1, target: 3, drawn: "1", abyss: ab }).between === 0 && hc({ shooter: 1, target: 3, drawn: "1", abyss: ab }).hit);
  check("深渊内互射:2→4 隔 0", hc({ shooter: 2, target: 4, drawn: "1", abyss: ab }).hit && hc({ shooter: 2, target: 4, drawn: "1", abyss: ab }).between === 0);
  check("深渊内受射击伤害 +1", hc({ shooter: 2, target: 4, drawn: "2", abyss: ab }).damage === 2 && hc({ shooter: 2, target: 4, drawn: "head", abyss: ab }).damage === 3);
  check("悖论视界:跨空间点射精准直接命中,目标在深渊伤 2;扫射仍不行", (() => { const r = hc({ shooter: 1, target: 2, abyss: ab, shooterEquips: ["beilun"] }); return r.hit && r.crossSpace && r.damage === 2; })() && hc({ shooter: 1, target: 2, mode: "spray", drawn: "4", abyss: ab, shooterEquips: ["beilun"] }).error === "DIFF_SPACE"); }

console.log("\n=== 开局:NPC / 身份(脑公开)/ 选角候选 ===");
const N = 6;
const room = new QmxyCore("7788", N, lcg(7));
const dev = {}; for (let i = 1; i <= N; i++) { dev[i] = `p${i}`; room.claimSeat(dev[i], i); }
const V = (i) => room.viewFor(dev[i]);
const act = (i, o) => room.action(dev[i], o);
check("6 人默认配比 1/1/3/1", JSON.stringify(room.idCounts) === JSON.stringify({ brain: 1, immune: 1, virus: 3, mutant: 1 }));
check("6 号标成 NPC → 玩家 5 人,配比变 1/1/2/1", act(1, { op: "setNpc", seatNo: 6, npc: "jinbi" }).ok && room.seats[6].hp === 3 && JSON.stringify(room.idCounts) === JSON.stringify({ brain: 1, immune: 1, virus: 2, mutant: 1 }));
check("配比总数≠玩家数拒绝", (act(1, { op: "setIdCounts", brain: 1, immune: 1, virus: 3, mutant: 1 }), act(1, { op: "dealIdentities" }).error === "COUNT_MISMATCH"));
check("必须恰好一个脑", act(1, { op: "setIdCounts", brain: 2, immune: 0, virus: 2, mutant: 1 }).error === "ONE_BRAIN");
act(1, { op: "setIdCounts", brain: 1, immune: 1, virus: 2, mutant: 1 });
check("系统发身份", act(1, { op: "dealIdentities" }).ok);
const brain = room.seatNos().find((n) => room.seats[n].identity === "brain");
check("至高之脑固定为 1 号位", brain === 1 && room.log.some((l) => l.includes("固定为 1 号位")) || (brain === 1 && !room.log.some((l) => l.includes("固定为 1 号位"))));
{ // 座位平移保序:持有者跟着人走,NPC 也平移;原 6 号 NPC 现在在哪取决于脑原来的位置
  const npcSeat = room.seatNos().find((n) => room.seats[n].npc === "jinbi");
  check("NPC 随桌平移且仍被记为 NPC", npcSeat != null && room.seats[npcSeat].hp === 3);
  check("每个座位的持有者与 holds 一致", room.seatNos().every((n) => room.seats[n].seatNo === n && room.seats[n].holderDevices.every((d) => room.isHolder(d, n))));
  check("每个设备恰持一个座位", Object.values(room.devices).every((d) => d.holds.size === 1) && new Set(Object.values(room.devices).flatMap((d) => [...d.holds])).size === N);
  check("脑的持有者视图 youHold=[1]", room.viewFor(room.seats[1].holderDevices[0]).youHold.join() === "1");
}
for (let i = 1; i <= N; i++) dev[i] = room.seats[i].holderDevices[0]; // 平移后按新座位号重建「座位 i 的持有者」
const npcNo = room.seatNos().find((n) => room.seats[n].npc);
check("NPC 不发身份", room.seats[npcNo].identity === null);
check("脑对所有人公开", V(1).seats[brain].identity === "brain" && V(2).seats[brain].identity === "brain");
const nonBrain = room.seatNos().find((n) => n !== brain && !room.seats[n].npc);
check("非脑身份他人不可见、本人可见", V(brain).seats[nonBrain].identity === null && V(nonBrain).seats[nonBrain].identity === room.seats[nonBrain].identity);
check("日志只写脑是谁", room.log[0].includes(`至高之脑是 ${brain}号`) && !/免疫官是|病毒是/.test(room.log[0]));
check("病毒 2 ≤ 脑+免疫官 2 → 超意识不生效", room.superMind().active === false);

check("发角色:脑 5 张其余 3 张", act(1, { op: "dealHeroes" }).ok && room.seats[brain].offers.length === 5 && room.seats[nonBrain].offers.length === 3 && room.seats[npcNo].offers.length === 0);
check("候选仅本人可见", Array.isArray(V(nonBrain).seats[nonBrain].offers) && V(brain).seats[nonBrain].offers === undefined && V(brain).seats[nonBrain].offerCount === 3);
check("候选全场不重复", new Set(room.seatNos().flatMap((n) => room.seats[n].offers)).size === 5 + 3 * 4);
const notOffered = HEROES.find((h) => !room.seats[nonBrain].offers.includes(h.id)).id;
check("不能选候选外", act(nonBrain, { op: "pickHero", seatNo: nonBrain, heroId: notOffered }).error === "NOT_OFFERED");
check("不能替别人选", act(brain, { op: "pickHero", seatNo: nonBrain, heroId: room.seats[nonBrain].offers[0] }).error === "NOT_HOLDER");
const brainHero = room.seats[brain].offers[0];
check("脑选完即亮", act(brain, { op: "pickHero", seatNo: brain, heroId: brainHero }).ok && V(nonBrain).seats[brain].heroId === brainHero);
const nbHero = room.seats[nonBrain].offers[0];
check("其他人选完未亮:本人可见,他人只知已选", act(nonBrain, { op: "pickHero", seatNo: nonBrain, heroId: nbHero }).ok && V(nonBrain).seats[nonBrain].heroId === nbHero && V(brain).seats[nonBrain].heroId === null && V(brain).seats[nonBrain].hasHero === true);
check("日志不泄露未亮角色名", !room.log[0].includes(HERO_BY_ID[nbHero].name));
for (const n of room.seatNos()) if (!room.seats[n].npc && room.seats[n].heroId == null) act(n, { op: "pickHero", seatNo: n, heroId: room.seats[n].offers[0] });
check("亮出全员", act(1, { op: "revealHeroes" }).ok && V(brain).seats[nonBrain].heroId === nbHero);
check("NPC 不能选角色", act(npcNo, { op: "pickHero", seatNo: npcNo, heroId: 1 }).error === "IS_NPC");

console.log("\n=== 角色池 ===");
check("默认基础包,发角色只发基础包", room.pack === "base" && room.seatNos().every((n) => room.seats[n].offers.every((id) => !HERO_BY_ID[id].pack || HERO_BY_ID[id].pack === "base")));
check("切换角色池", act(1, { op: "setPack", pack: "all" }).ok && room.pack === "all" && act(1, { op: "setPack", pack: "x" }).error === "BAD_PACK");
act(1, { op: "setPack", pack: "base" });

console.log("\n=== 三属性 / 超意识 ===");
// 固定身份便于断言:1 脑 2 免疫官 3,4 病毒 5 异变(6 NPC);固定角色。先把 NPC 标回 6 号(平移后可能不在 6 号)
if (npcNo !== 6) { act(1, { op: "setNpc", seatNo: npcNo, npc: null }); act(1, { op: "setNpc", seatNo: 6, npc: "jinbi" }); }
const setId = (i, identity) => act(i, { op: "setIdentity", seatNo: i, identity });
check("手动登记脑到 3 号 → 平移为 1 号,原 1 号变 5 号", (() => { const h3 = room.seats[3].holderDevices[0]; act(3, { op: "setIdentity", seatNo: 3, identity: "brain" }); const ok = room.seats[1].identity === "brain" && room.seats[1].holderDevices[0] === h3 && room.isHolder(h3, 1); for (let i = 1; i <= N; i++) dev[i] = room.seats[i].holderDevices[0]; return ok; })());
check("再登记另一人为脑 → 旧脑身份清空并再次平移到 1 号", (() => { act(2, { op: "setIdentity", seatNo: 2, identity: "brain" }); for (let i = 1; i <= N; i++) dev[i] = room.seats[i].holderDevices[0]; return room.seats[1].identity === "brain" && room.seatNos().filter((n) => room.seats[n].identity === "brain").length === 1; })());
{ const npc2 = room.seatNos().find((n) => room.seats[n].npc); if (npc2 !== 6) { act(1, { op: "setNpc", seatNo: npc2, npc: null }); act(1, { op: "setNpc", seatNo: 6, npc: "jinbi" }); } }
setId(1, "brain"); setId(2, "immune"); setId(3, "virus"); setId(4, "virus"); setId(5, "mutant");
const setHero = (i, h) => { room.seats[i].offers = []; room.seats[i].heroId = h; room.seats[i].heroRevealed = true; };
setHero(1, 4); setHero(2, 13); setHero(3, 19); setHero(4, 17); setHero(5, 1); // 大乔 黄月英 吕布 左慈 张春华
check("大乔 4/2/6", JSON.stringify(room.stats(1)) === JSON.stringify({ hp: 4, supply: 2, ammo: 6 }));
check("NPC 金币机器人 3/0/0", JSON.stringify(room.stats(6)) === JSON.stringify({ hp: 3, supply: 0, ammo: 0 }));
act(1, { op: "setIdCounts", brain: 1, immune: 0, virus: 3, mutant: 1 }); // 改成病毒多:超意识生效
check("病毒 3 > 脑+免疫官 1 → 超意识给脑,大乔 5/3/7", room.superMind().holder === 1 && JSON.stringify(room.stats(1)) === JSON.stringify({ hp: 5, supply: 3, ammo: 7 }));
act(1, { op: "setIdCounts", brain: 1, immune: 1, virus: 2, mutant: 1 });
check("自我遥控器互换补给/子弹(大乔 6/2)", act(1, { op: "toggleSwap", seatNo: 1 }).ok && room.stats(1).supply === 6 && room.stats(1).ammo === 2);
act(1, { op: "toggleSwap", seatNo: 1 });
check("开局:默认脑先手,血量/子弹填满,安全协议生效", act(1, { op: "startGame" }).ok && room.turn === 1 && room.seats[1].hp === 4 && room.seats[1].ammo === 6 && room.seats[4].ammo === 0 && room.protocol === true && room.round === 1);
check("开局后不能再发身份/改 NPC", act(1, { op: "dealIdentities" }).error === "NOT_SETUP" && act(1, { op: "setNpc", seatNo: 6, npc: null }).error === "NOT_SETUP");

console.log("\n=== 装备 / 延时牌 ===");
check("彩虹弹匣 +1 子弹上限,手臂拓展 +1 补给", act(1, { op: "addEquip", seatNo: 3, card: "caihong" }).ok && act(1, { op: "addEquip", seatNo: 3, card: "shoubi" }).ok && room.stats(3).ammo === 3 && room.stats(3).supply === 4);
check("装备上限 3", act(1, { op: "addEquip", seatNo: 3, card: "zhenli" }).ok && act(1, { op: "addEquip", seatNo: 3, card: "wusheng" }).error === "EQUIP_FULL");
check("黄月英装备不限", [1, 2, 3, 4].every((k) => act(1, { op: "addEquip", seatNo: 2, card: ["zhenli", "wusheng", "aida", "toukui"][k - 1] }).ok) && room.seats[2].equips.length === 4);
check("卸下装备", act(1, { op: "removeEquip", seatNo: 3, card: "caihong" }).ok && room.stats(3).ammo === 2);
check("非装备牌不能装", act(1, { op: "addEquip", seatNo: 3, card: "dianshe" }).error === "BAD_CARD");
check("延时牌放到面前;同名第二张拒绝", act(1, { op: "addDelay", seatNo: 4, card: "emp" }).ok && act(1, { op: "addDelay", seatNo: 4, card: "emp" }).error === "DUP_DELAY" && act(1, { op: "addDelay", seatNo: 4, card: "shanguang" }).ok);
check("延时牌引爆移除", act(1, { op: "removeDelay", seatNo: 4, card: "emp", how: "explode" }).ok && JSON.stringify(room.seats[4].delays) === '["shanguang"]' && room.log[0].includes("引爆"));

console.log("\n=== 血量 / 弹匣 / 命中记录 ===");
check("扣血", act(1, { op: "adjHp", seatNo: 3, delta: -2 }).ok && room.seats[3].hp === 3);
check("回血不超上限", act(1, { op: "adjHp", seatNo: 3, delta: 5 }).ok && room.seats[3].hp === 5);
check("消耗子弹不低于 0", act(1, { op: "adjAmmo", seatNo: 3, delta: -5 }).ok && room.seats[3].ammo === 0);
check("子弹可暂超上限(化血为剑)", act(1, { op: "adjAmmo", seatNo: 3, delta: 4 }).ok && room.seats[3].ammo === 4);
check("回合开始补满到上限", act(1, { op: "refillAmmo", seatNo: 3 }).ok && room.seats[3].ammo === 2);
check("手动修正上限", act(1, { op: "setMods", seatNo: 5, hp: 1, supply: 0, ammo: 0 }).ok && room.stats(5).hp === 5);
check("命中记录:吕布(3 号)点射 5 号隔 1 人翻 4 点 = 爆头", (() => { const r = act(1, { op: "logShot", shooter: 3, target: 5, mode: "single", drawn: "4" }); return r.ok && r.result.damage === 2 && room.log[0].includes("爆头") && room.log[0].includes("命中"); })());
check("进入深渊后台账:横置标记、跨空间报错、离开恢复", act(1, { op: "toggleAbyss", seatNo: 5 }).ok && room.seats[5].abyss && V(1).seats[5].abyss === true && act(1, { op: "logShot", shooter: 1, target: 5, drawn: "4" }).error === "DIFF_SPACE" && act(1, { op: "toggleAbyss", seatNo: 5 }).ok && !room.seats[5].abyss);
check("命中记录:NPC 也算隔人(1 号→5 号隔 6 号 NPC 走短路 0 人? 1-5 隔 6 号)", act(1, { op: "logShot", shooter: 1, target: 5, drawn: "1" }).result.between === 1);
check("打自己报错", act(1, { op: "logShot", shooter: 1, target: 1, drawn: "1" }).error === "SELF_SHOT");

console.log("\n=== 濒死 / 死亡奖惩 / 安全协议 / 终局 ===");
check("血量到 0 濒死", act(1, { op: "adjHp", seatNo: 3, delta: -5 }).ok && room.seats[3].dying && !room.seats[3].dead);
check("补丁回 1 脱离濒死", act(1, { op: "adjHp", seatNo: 3, delta: 1 }).ok && !room.seats[3].dying);
act(1, { op: "adjHp", seatNo: 3, delta: -1 });
check("NPC 血量到 0 直接死亡、杀金币机器人摸三张、首死解除协议", act(1, { op: "adjHp", seatNo: 6, delta: -3, killer: 2 }).ok && room.seats[6].dead && room.log.some((l) => l.includes("2号摸三张牌")) && room.protocol === false);
check("NPC 死后不在桌上(1 号→5 号隔 0 人)", act(1, { op: "logShot", shooter: 1, target: 5, drawn: "1" }).result.between === 0);
check("协议可手动恢复", act(1, { op: "setProtocol", on: true }).ok && room.protocol === true);
check("确认死亡(3 号病毒,被 1 号脑杀):亮身份、摸三张、不结束", act(1, { op: "confirmDeath", seatNo: 3, killer: 1 }).ok && room.seats[3].dead && V(5).seats[3].identity === "virus" && room.log.some((l) => l.includes("亮出身份:病毒") && l.includes("1号摸三张牌")) && room.phase === "play");
check("死者装备/延时清空", room.seats[3].equips.length === 0);
check("撤销死亡", act(1, { op: "revive", seatNo: 3 }).ok && !room.seats[3].dead && room.seats[3].dying && V(5).seats[3].identity === null);
act(1, { op: "confirmDeath", seatNo: 3, killer: 1 });
check("脑杀免疫官:脑弃所有牌", act(1, { op: "confirmDeath", seatNo: 2, killer: 1 }).ok && room.log[0].includes("弃置所有牌"));
check("下一回合跳过死者与 NPC", (room.turn = 1, act(1, { op: "nextTurn" }), room.turn === 4) && (act(1, { op: "nextTurn" }), room.turn === 5) && (act(1, { op: "nextTurn" }), room.turn === 1 && room.round === 2));
check("设回合不能给 NPC", act(1, { op: "setTurn", seatNo: 6 }).error === "IS_NPC");
act(1, { op: "setIdCounts", brain: 1, immune: 0, virus: 3, mutant: 1 }); // 让超意识生效,验证单挑夺取
check("病毒全死后 脑 vs 异变:超意识被异变夺走", act(1, { op: "confirmDeath", seatNo: 4, killer: 5 }).ok && room.phase === "play" && room.superMind().holder === 5 && room.superMind().seized && room.stats(5).hp === 6 && room.stats(1).hp === 4);
check("脑死 → 异变唯一存活 → 异变胜", act(1, { op: "confirmDeath", seatNo: 1, killer: 5 }).ok && room.phase === "over" && JSON.stringify(room.result.winners) === "[5]" && room.result.reason.includes("异变"));
check("结束后身份全公开、台账冻结", V(5).seats[4].identity === "virus" && act(1, { op: "adjHp", seatNo: 5, delta: -1 }).error === "GAME_OVER");

console.log("\n=== 其他终局 / 再来一局 / 持久化 ===");
check("再来一局保留座位、NPC 与持有者", act(1, { op: "newGame" }).ok && room.phase === "setup" && room.seats[6].npc === "jinbi" && room.seats[6].hp === 3 && room.seats[1].holderDevices[0] === dev[1] && !room.seats[1].identity && room.seats[1].equips.length === 0);
setId(1, "brain"); setId(2, "immune"); setId(3, "virus"); setId(4, "virus"); setId(5, "mutant");
act(1, { op: "setIdCounts", brain: 1, immune: 1, virus: 2, mutant: 1 });
for (const [i, h] of [[1, 4], [2, 13], [3, 19], [4, 17], [5, 1]]) setHero(i, h);
act(1, { op: "startGame", first: 3 });
check("指定先手", room.turn === 3);
check("脑死而异变不是唯一存活 → 病毒胜(含已死病毒)", act(1, { op: "confirmDeath", seatNo: 3, killer: 2 }).ok && act(1, { op: "confirmDeath", seatNo: 1, killer: 4 }).ok && room.phase === "over" && JSON.stringify(room.result.winners) === "[3,4]");
act(1, { op: "newGame" });
setId(1, "brain"); setId(2, "immune"); setId(3, "virus"); setId(4, "virus"); setId(5, "mutant");
for (const [i, h] of [[1, 4], [2, 13], [3, 19], [4, 17], [5, 1]]) setHero(i, h);
act(1, { op: "startGame" });
act(1, { op: "confirmDeath", seatNo: 3 }); act(1, { op: "confirmDeath", seatNo: 4 });
check("病毒+异变全死 → 脑与免疫官胜", act(1, { op: "confirmDeath", seatNo: 5, killer: 1 }).ok && room.phase === "over" && JSON.stringify(room.result.winners) === "[1,2]");
check("手动结算", (act(1, { op: "newGame" }), act(1, { op: "forceEnd", winners: [2, 5], note: "争议" }).ok && room.result.reason.includes("争议")));
act(1, { op: "newGame" });
check("加座位到 8 后不能再加;减到 3 后不能再减", (room.addSeat("p1"), room.addSeat("p1"), room.addSeat("p1").error === "MAX_SEATS") && (room.removeSeat("p1"), room.removeSeat("p1"), room.removeSeat("p1"), room.removeSeat("p1"), room.removeSeat("p1"), room.removeSeat("p1").error === "MIN_SEATS"));
act(1, { op: "setNpc", seatNo: 3, npc: "zhan" }); // 3 座:2 玩家 + 1 NPC
check("玩家数随 NPC 变", room._playerSeats().length === 2 && room.idCounts.brain === 1);
setId(1, "brain"); act(1, { op: "addEquip", seatNo: 2, card: "caihong" }); act(1, { op: "addDelay", seatNo: 2, card: "emp" });
const back = QmxyCore.hydrate(JSON.parse(JSON.stringify(room.serialize())));
check("序列化往返:身份/装备/延时/NPC/持有", back.seats[1].identity === "brain" && back.seats[2].equips[0] === "caihong" && back.seats[2].delays[0] === "emp" && back.seats[3].npc === "zhan" && back.isHolder(dev[2], 2));
check("往返后保密视图一致", JSON.stringify(back.viewFor(dev[2])) === JSON.stringify(room.viewFor(dev[2])));
check("改名后座位与身份仍在", room.renameDevice("p1", "小明").ok && room.viewFor("小明").seats[1].identity === "brain");

console.log(`\n结果: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
