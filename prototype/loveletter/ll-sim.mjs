// 情书房间 "可执行规格" —— 牌堆构成/人数与标记表/开局发牌/各牌效果与边界/伯爵夫人强制/轮末比点与平手/间谍加成/大臣/保密/持久化
// 复用与真实 Workers 同一份核心逻辑(./shared/ll-logic.mjs)。
// node prototype/loveletter/ll-sim.mjs

import { LoveLetterCore } from "./shared/ll-logic.mjs";
import { CARDS, EDITIONS, TEAM, buildDeck, cardsOf, tokensToWin } from "./shared/ll-data.mjs";

let passed = 0, failed = 0;
function check(name, cond, detail = "") {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail ? "  <- " + detail : ""}`); }
}
function lcg(seed) { let x = seed >>> 0; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); }

function mk(n, seed = 1, config) {
  const room = new LoveLetterCore("1234", n, lcg(seed));
  const dev = {}; for (let i = 1; i <= n; i++) { dev[i] = `p${i}`; room.claimSeat(dev[i], i); }
  if (config) room.action(dev[1], { op: "setConfig", config });
  return { room, dev, V: (i) => room.viewFor(dev[i]), act: (i, o) => room.action(dev[i], o) };
}
// 开局后强行摆牌:hands 按座位 1..N(当前回合玩家给两张),deck 指定牌堆(deck[0] 为顶),turn 当前回合
function layout(room, hands, deck, turn = 1, removed = "guard") {
  room.seatNos().forEach((n, i) => { const s = room.seats[n]; s.hand = Array.isArray(hands[i]) ? hands[i].slice() : [hands[i]]; s.discards = []; s.out = false; s.protected = false; s.notes = []; });
  room.deck = deck.slice(); room.removed = removed; room.faceUp = []; room.turn = turn; room.phase = "play"; room.sub = "play";
}

console.log("\n=== 数据 ===");
check("10 种牌,键唯一", CARDS.length === 10 && new Set(CARDS.map((c) => c.key)).size === 10);
check("原版 16 张:侍卫5 神父2 男爵2 侍女2 王子2 国王1 伯爵夫人1 公主1", buildDeck("classic").length === 16 && cardsOf("classic").map((c) => c.rank + ":" + c.count).join(" ") === "1:5 2:2 3:2 4:2 5:2 6:1 7:1 8:1");
check("2019 版 21 张:间谍0×2 侍卫1×6 … 大臣6×2 国王7 伯爵夫人8 公主9", buildDeck("v2019").length === 21 && cardsOf("v2019").map((c) => c.rank + ":" + c.count).join(" ") === "0:2 1:6 2:2 3:2 4:2 5:2 6:2 7:1 8:1 9:1");
check("所需标记:原版 2人7 3人5 4人4;新版 2人6 3人5 4人4 5人3 6人3", [2, 3, 4].map((n) => tokensToWin("classic", n)).join() === "7,5,4" && [2, 3, 4, 5, 6].map((n) => tokensToWin("v2019", n)).join() === "6,5,4,3,3");
check("原版 2~4 人,新版 2~6 人", EDITIONS.classic.minPlayers === 2 && EDITIONS.classic.maxPlayers === 4 && EDITIONS.v2019.maxPlayers === 6);

console.log("\n=== 准备阶段 / 配置 ===");
{
  const { room, act, V } = mk(5);
  check("2~9 座(组队 9 人)", LoveLetterCore.MIN_SEATS === 2 && LoveLetterCore.MAX_SEATS === 9);
  check("默认原版;5 人不能开原版", room.config.edition === "classic" && act(1, { op: "startGame" }).error === "PLAYER_COUNT" && V(1).check.error === "PLAYER_COUNT");
  check("非法版本/标记数拒绝", act(1, { op: "setConfig", config: { edition: "x" } }).error === "BAD_CONFIG" && act(1, { op: "setConfig", config: { tokens: 0 } }).error === "BAD_CONFIG");
  check("切 2019 版后 5 人可开;所需 3 枚", act(1, { op: "setConfig", config: { edition: "v2019" } }).ok && V(1).check.ok && V(1).need === 3);
  check("房规覆盖标记数", act(1, { op: "setConfig", config: { tokens: 2 } }).ok && V(1).need === 2 && act(1, { op: "setConfig", config: { tokens: null } }).ok && V(1).need === 3);
  check("开局后不能改配置/座位", act(1, { op: "startGame" }).ok && act(1, { op: "setConfig", config: { edition: "classic" } }).error === "NOT_SETUP" && room.addSeat("p1").error === "NOT_SETUP");
  check("开局:每人手牌 1 张、先手 2 张,牌堆 21-1-5-1=14,盖了一张", room.seatNos().every((n) => room.seats[n].hand.length === (n === room.turn ? 2 : 1)) && room.deck.length === 14 && room.removed && room.faceUp.length === 0);
}
{
  const { room, act } = mk(2);
  act(1, { op: "startGame" });
  check("2 人局:翻开 3 张公开,牌堆 16-1-3-2-1=9", room.faceUp.length === 3 && room.deck.length === 9 && room.viewFor("p2").faceUp.length === 3);
}

console.log("\n=== 保密 ===");
{
  const { room, act, V } = mk(4, 3);
  act(1, { op: "startGame" });
  const t = room.turn, o = room.seatNos().find((n) => n !== t);
  check("别人看不到我的手牌,只见张数", V(o).seats[t].hand === undefined && V(o).seats[t].handCount === 2 && V(t).seats[t].hand.length === 2);
  check("看不到别人的笔记;看不到盖掉的牌", V(o).seats[t].notes === undefined && V(o).removed === undefined && V(o).deckCount === room.deck.length);
  check("isTurn / targets 公开", V(o).seats[t].isTurn === true && V(o).targets.other.length === 3);
}

console.log("\n=== 各牌效果(原版 4 人)===");
{
  const { room, act, V } = mk(4);
  act(1, { op: "startGame" });
  layout(room, [["guard", "priest"], "princess", "baron", "king"], ["handmaid", "prince", "guard", "guard", "countess", "guard"], 1);
  check("不是你的回合不能出", act(2, { op: "play", seatNo: 2, card: "princess" }).error === "NOT_YOUR_TURN");
  check("只能出自己座位", act(2, { op: "play", seatNo: 1, card: "guard" }).error === "NOT_HOLDER");
  check("不在手里的牌拒绝", act(1, { op: "play", seatNo: 1, card: "king" }).error === "NOT_IN_HAND");
  check("侍卫:不能猜侍卫 / 目标必须合法", act(1, { op: "play", seatNo: 1, card: "guard", target: 2, guess: "guard" }).error === "BAD_GUESS" && act(1, { op: "play", seatNo: 1, card: "guard", target: 1, guess: "princess" }).error === "BAD_TARGET");
  check("侍卫猜中 → 2 号出局,公主翻进弃牌堆", act(1, { op: "play", seatNo: 1, card: "guard", target: 2, guess: "princess" }).ok && room.seats[2].out && room.seats[2].discards.join() === "princess" && room.seats[2].hand.length === 0);
  check("回合传给 3 号(跳过出局),自动抽 1 张(handmaid)", room.turn === 3 && room.seats[3].hand.join() === "baron,handmaid");
  check("男爵:3 号(男爵,留 侍女 4)vs 4 号(国王 6)→ 3 号出局,双方各得笔记", act(3, { op: "play", seatNo: 3, card: "baron", target: 4 }).ok && room.seats[3].out && V(3).seats[3].notes.length === 1 && V(4).seats[4].notes[0].text.includes("男爵"));
  check("只剩 4 号与 1 号,回合到 4 号,抽到 prince", room.turn === 4 && room.seats[4].hand.join() === "king,prince");
  check("国王:与 1 号交换 → 4 号拿到 priest,1 号拿到 prince 并抽到 guard", act(4, { op: "play", seatNo: 4, card: "king", target: 1 }).ok && room.seats[4].hand.join() === "priest" && room.seats[1].hand.join() === "prince,guard" && room.turn === 1);
  layout(room, [["priest", "guard"], "x", "x", "prince"], ["guard"], 1); room.seats[2].out = room.seats[3].out = true; room.seats[2].hand = room.seats[3].hand = [];
  check("神父偷看 4 号 → 私密笔记写王子,公开日志不含牌名", act(1, { op: "play", seatNo: 1, card: "priest", target: 4 }).ok && V(1).seats[1].notes.at(-1).text.includes("王子") && !room.log[0].includes("王子") && V(4).seats[4].notes.length === 0);
}
{
  const { room, act } = mk(3);
  act(1, { op: "startGame" });
  layout(room, [["handmaid", "guard"], "guard", "priest"], ["baron", "king", "prince", "princess"], 1);
  check("侍女:1 号受保护", act(1, { op: "play", seatNo: 1, card: "handmaid" }).ok && room.seats[1].protected && room.turn === 2);
  check("2 号侍卫目标只剩 3 号;猜 1 号被拒", room.targets().other.join() === "3" && act(2, { op: "play", seatNo: 2, card: "guard", target: 1, guess: "princess" }).error === "BAD_TARGET");
  check("2 号猜 3 号「神父」(错,3 号手里是 神父+国王?)—— 3 号手牌 priest,猜对则出局", act(2, { op: "play", seatNo: 2, card: "guard", target: 3, guess: "priest" }).ok && room.seats[3].out === true);
  check("3 号出局后回合回到 1 号(跳过);保护解除", room.turn === 1 && room.seats[1].protected === false);
}
{
  const { room, act } = mk(2);
  act(1, { op: "startGame" });
  layout(room, ["prince", ["king", "baron"]], ["princess"], 2); room.seats[1].protected = true;
  check("对方受保护:国王无目标 → 打出无效果", act(2, { op: "play", seatNo: 2, card: "king", target: 1 }).ok && room.seats[2].hand.join() === "baron" && room.log[0].includes("无效果"));
}
{
  const { room, act } = mk(3);
  act(1, { op: "startGame" });
  layout(room, [["prince", "guard"], "princess", "priest"], ["baron", "king"], 1);
  check("王子逼 2 号弃公主 → 2 号出局且不补牌", act(1, { op: "play", seatNo: 1, card: "prince", target: 2 }).ok && room.seats[2].out && room.seats[2].discards.join() === "princess" && room.seats[2].hand.length === 0);
  check("回合到 3 号", room.turn === 3 && room.seats[3].hand.join() === "priest,baron");
  layout(room, ["guard", "x", ["prince", "priest"]], [], 3); room.seats[2].out = true; room.seats[2].hand = [];
  check("牌堆空时王子对自己 → 抽开局盖掉的那张(guard)", act(3, { op: "play", seatNo: 3, card: "prince", target: 3 }).ok && room.seats[3].discards.join() === "prince,priest" && room.history.at(-1).hands[3] === "guard" && room.removed === null);
  check("牌堆空 → 本轮结束(回合结束时判)", room.phase === "roundEnd" && room.roundResult.reason === "deck");
}
{
  const { room, act, V } = mk(3);
  act(1, { op: "startGame" });
  layout(room, [["countess", "king"], "guard", "guard"], ["baron", "priest", "guard"], 1);
  check("伯爵夫人+国王:必须出伯爵夫人", V(1).seats[1].countessForced === true && act(1, { op: "play", seatNo: 1, card: "king", target: 2 }).error === "COUNTESS_FORCED" && act(1, { op: "play", seatNo: 1, card: "countess" }).ok);
  layout(room, [["countess", "prince"], "guard", "guard"], ["baron", "priest", "guard"], 1);
  check("伯爵夫人+王子:同样强制", room.countessForced(1) && act(1, { op: "play", seatNo: 1, card: "prince", target: 2 }).error === "COUNTESS_FORCED");
  layout(room, [["countess", "guard"], "guard", "guard"], ["baron", "priest", "guard"], 1);
  check("伯爵夫人+侍卫:不强制,可出侍卫", !room.countessForced(1) && act(1, { op: "play", seatNo: 1, card: "guard", target: 2, guess: "priest" }).ok);
  layout(room, [["princess", "guard"], "guard", "guard"], ["baron", "priest", "guard"], 1);
  check("主动打出公主 → 自己出局", act(1, { op: "play", seatNo: 1, card: "princess" }).ok && room.seats[1].out && room.seats[1].discards.join() === "princess,guard");
}

console.log("\n=== 轮末结算 / 标记 / 终局 ===");
{
  const { room, act, V } = mk(3);
  act(1, { op: "startGame" });
  layout(room, [["guard", "priest"], "king", "baron"], ["handmaid"], 1);
  room.seats[2].discards = ["guard", "guard"]; room.seats[3].discards = ["prince"];
  act(1, { op: "play", seatNo: 1, card: "guard", target: 2, guess: "princess" });
  check("牌堆还有 1 张 → 继续,2 号抽走最后一张", room.phase === "play" && room.turn === 2 && room.deck.length === 0);
  act(2, { op: "play", seatNo: 2, card: "handmaid" });
  check("2 号回合结束牌堆空 → 结算:国王 6 > 男爵 3 > 神父 2,2 号赢 1 枚", room.phase === "roundEnd" && room.roundResult.winners.join() === "2" && room.seats[2].tokens === 1 && room.roundResult.hands[2] === "king");
  check("结算后手牌全公开;下轮先手=赢家", V(1).seats[2].hand.join() === "king" && room.starter === 2);
  check("roundEnd 不能出牌;nextRound 开新轮,2 号先手且有 2 张", act(2, { op: "play", seatNo: 2, card: "king" }).error === "NOT_PLAY" && act(1, { op: "nextRound" }).ok && room.round === 2 && room.turn === 2 && room.seats[2].hand.length === 2 && room.seats[2].discards.length === 0);
  layout(room, [["guard", "guard"], "king", "king"], [], 1);
  room.seats[2].discards = ["guard"]; room.seats[3].discards = ["prince"];
  act(1, { op: "play", seatNo: 1, card: "guard", target: 2, guess: "princess" });
  check("两人同持国王 → 比弃牌总和,3 号(5)胜 2 号(1)", room.phase === "roundEnd" && room.roundResult.winners.join() === "3" && room.roundResult.sums[3] === 5);
  act(1, { op: "nextRound" });
  layout(room, [["guard", "guard"], "king", "king"], [], 1);
  room.seats[2].discards = ["prince"]; room.seats[3].discards = ["prince"];
  act(1, { op: "play", seatNo: 1, card: "guard", target: 2, guess: "princess" });
  check("仍平手 → 两人都得标记", room.roundResult.winners.join() === "2,3" && room.seats[2].tokens >= 1 && room.seats[3].tokens >= 2);
  check("历史记录每轮一条", room.history.length === 3);
}
{
  const { room, act } = mk(2, 1, { tokens: 1 });
  act(1, { op: "startGame" });
  layout(room, [["princess", "guard"], "guard"], ["baron"], 1);
  act(1, { op: "play", seatNo: 1, card: "princess" });
  check("只剩一人 → 轮末;房规 1 枚即胜 → 终局 2 号胜", room.phase === "over" && room.result.winners.join() === "2" && room.roundResult.reason === "last");
  check("终局不能 nextRound;newGame 回准备、标记清零", act(1, { op: "nextRound" }).error === "NOT_ROUND_END" && act(1, { op: "newGame" }).ok && room.phase === "setup" && room.seats[2].tokens === 0);
}

console.log("\n=== 2019 新版:间谍 / 大臣 ===");
{
  const { room, act, V } = mk(3, 1, { edition: "v2019" });
  act(1, { op: "startGame" });
  layout(room, [["spy", "guard"], "king", "baron"], ["handmaid", "guard"], 1);
  check("间谍打出无效果", act(1, { op: "play", seatNo: 1, card: "spy" }).ok && room.turn === 2 && room.seats[1].discards.join() === "spy");
  act(2, { op: "play", seatNo: 2, card: "handmaid" });
  act(3, { op: "play", seatNo: 3, card: "guard", target: 1, guess: "priest" });
  check("轮末:2 号国王最高得 1;1 号是唯一出过间谍的在局者 +1", room.phase === "roundEnd" && room.roundResult.winners.join() === "2" && room.roundResult.spyBonus === 1 && room.seats[1].tokens === 1 && room.seats[2].tokens === 1);
  act(1, { op: "nextRound" });
  layout(room, [["spy", "guard"], ["spy"], "baron"], ["handmaid", "guard"], 1);
  room.seats[2].discards = ["spy"];
  act(1, { op: "play", seatNo: 1, card: "spy" }); act(2, { op: "play", seatNo: 2, card: "handmaid" }); act(3, { op: "play", seatNo: 3, card: "guard", target: 1, guess: "priest" });
  check("两人都出过间谍 → 无加成", room.phase === "roundEnd" && room.roundResult.spyBonus === null);
  act(1, { op: "nextRound" });
  layout(room, [["chancellor", "guard"], "king", "baron"], ["princess", "priest", "handmaid", "guard"], 1);
  check("大臣:抽 2 张进手牌,进入 chancellor 子阶段,他人只见 3 张", act(1, { op: "play", seatNo: 1, card: "chancellor" }).ok && room.sub === "chancellor" && room.seats[1].hand.join() === "guard,princess,priest" && V(2).seats[1].handCount === 3 && V(2).seats[1].hand === undefined);
  check("子阶段不能再 play;留牌必须在手里;放底必须恰是其余两张", act(1, { op: "play", seatNo: 1, card: "guard", target: 2, guess: "priest" }).error === "NOT_PLAY" && act(2, { op: "chancellor", seatNo: 2, keep: "king", bottom: [] }).error === "NOT_YOUR_TURN" && act(1, { op: "chancellor", seatNo: 1, keep: "king", bottom: ["guard", "priest"] }).error === "NOT_IN_HAND" && act(1, { op: "chancellor", seatNo: 1, keep: "princess", bottom: ["guard"] }).error === "BAD_BOTTOM");
  check("留公主,guard 先放 priest 最底 → 2 号抽走 handmaid,牌堆 guard,guard,priest", act(1, { op: "chancellor", seatNo: 1, keep: "princess", bottom: ["guard", "priest"] }).ok && room.seats[1].hand.join() === "princess" && room.turn === 2 && room.deck.join() === "guard,guard,priest");
  layout(room, [["chancellor", "guard"], "king", "baron"], [], 1);
  check("牌堆空时大臣无效果,直接结算", act(1, { op: "play", seatNo: 1, card: "chancellor" }).ok && room.phase === "roundEnd");
}

console.log("\n=== 组队模式(6 / 8 / 9 人随机分队,队内一人集 3 枚全队胜,29 张牌)===");
check("组队牌组 29 张:侍卫 9、2~6 点各 3,0/7/8/9 不变", buildDeck("v2019", "team").length === 29 && cardsOf("v2019", "team").map((c) => c.rank + ":" + c.count).join(" ") === "0:2 1:9 2:3 3:3 4:3 5:3 6:3 7:1 8:1 9:1");
check("分队表 6→3×2 / 8→4×2 / 9→3×3,3 枚胜", TEAM.players[6].teams === 3 && TEAM.players[8].teams === 4 && TEAM.players[9].size === 3 && TEAM.tokensToWin === 3);
{
  const { room, act, V } = mk(7);
  check("切组队:版本自动变 2019;7 人不能开", act(1, { op: "setConfig", config: { mode: "team" } }).ok && room.config.edition === "v2019" && V(1).check.error === "TEAM_COUNT" && act(1, { op: "startGame" }).error === "TEAM_COUNT");
  check("非法模式拒绝", act(1, { op: "setConfig", config: { mode: "x" } }).error === "BAD_CONFIG");
  room.removeSeat("p1");
  check("6 人可开;need 3;牌堆 29-1-6-1=21", V(1).check.ok && V(1).need === 3 && act(1, { op: "startGame" }).ok && room.deck.length === 21);
  const teams = room.seatNos().map((n) => room.seats[n].team);
  check("随机分 3 队每队 2 人", new Set(teams).size === 3 && [1, 2, 3].every((t) => teams.filter((x) => x === t).length === 2));
  const mate = room.teammates(1)[0], other = room.seatNos().find((n) => n !== 1 && n !== mate);
  check("队号只对本队可见:我看到自己和队友的队号,看不到别队的;别队看不到我的", V(1).seats[1].team === room.seats[1].team && V(1).seats[mate].team === room.seats[1].team && V(1).seats[other].team === undefined && V(other).seats[1].team === undefined);
  check("可以对队友出牌(目标池含队友)", room.targets().other.includes(room.teammates(room.turn)[0]));
  // 让 1 号集满 3 枚:先摆两枚,再赢一轮
  room.seats[1].tokens = 2;
  layout(room, [["guard", "princess"], "guard", "guard", "guard", "guard", "guard"], [], 1);
  for (const n of [2, 3, 4, 5, 6]) { room.seats[n].out = true; room.seats[n].hand = []; }
  room.seats[2].out = false; room.seats[2].hand = ["guard"];
  act(1, { op: "play", seatNo: 1, card: "guard", target: 2, guess: "priest" });
  check("1 号第 3 枚 → 终局,全队(1 号 + 队友)获胜,队号全部公开", room.phase === "over" && room.result.winners.slice().sort().join() === [1, mate].sort().join() && room.result.teams.join() === String(room.seats[1].team) && V(other).seats[1].team === room.seats[1].team && V(other).result.teamOf[mate] === room.seats[1].team);
  check("newGame 清队号", act(1, { op: "newGame" }).ok && room.seats[1].team === null);
  room.addSeat("p1"); room.addSeat("p1");
  check("8 人 → 4 队", act(1, { op: "startGame" }).ok && new Set(room.seatNos().map((n) => room.seats[n].team)).size === 4);
  act(1, { op: "newGame" }); room.addSeat("p1");
  check("9 人 → 3 队每队 3 人", act(1, { op: "startGame" }).ok && [1, 2, 3].every((t) => room.seatNos().filter((n) => room.seats[n].team === t).length === 3));
  check("切回个人赛:队号不再分配,版本保留 2019,9 人超上限", act(1, { op: "newGame" }).ok && act(1, { op: "setConfig", config: { mode: "ffa" } }).ok && room.config.edition === "v2019" && V(1).check.error === "PLAYER_COUNT");
}

console.log("\n=== 持久化 ===");
{
  const { room, act } = mk(4, 7);
  act(1, { op: "startGame" });
  const t = room.turn, hand = room.seats[t].hand.slice();
  const saved = JSON.parse(JSON.stringify(room.serialize()));
  const back = LoveLetterCore.hydrate(saved, lcg(9));
  room.seats[1].team = 2; const saved2 = LoveLetterCore.hydrate(JSON.parse(JSON.stringify(room.serialize())));
  check("队号随座位序列化", saved2.seats[1].team === 2 && saved2.config.mode === "ffa");
  check("序列化/回灌:阶段、牌堆、手牌、盖牌、持有者一致", back.phase === "play" && back.turn === t && back.seats[t].hand.join() === hand.join() && back.deck.join() === room.deck.join() && back.removed === room.removed && back.isHolder("p1", 1) && back.config.edition === "classic");
  const tg = back.targets().other[0];
  check("回灌后可继续出牌", back.action(`p${t}`, { op: "play", seatNo: t, card: hand[0], target: tg, guess: "priest" }).ok || back.action(`p${t}`, { op: "play", seatNo: t, card: hand[1], target: tg, guess: "priest" }).ok);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
