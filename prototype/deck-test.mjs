// 牌堆校验测试:node prototype/deck-test.mjs
import { validateCard } from "./shared/deck.mjs";

let pass = 0, fail = 0;
function expect(card, level, note) {
  const r = validateCard(card);
  const ok = r.level === level;
  console.log(`  ${ok ? "PASS" : "FAIL"}  [${level}] ${note}${ok ? "" : `  <- 实际 ${r.level}`}${r.reason ? "  :" + r.reason : ""}`);
  ok ? pass++ : fail++;
}

console.log("\n=== 花色规则(warn,可靠)===");
expect({ suit: "S", rank: "2", name: "桃" }, "warn", "黑桃的桃(用户举的例子)");
expect({ suit: "H", rank: "3", name: "桃" }, "ok", "红桃的桃");
expect({ suit: "D", rank: "2", name: "桃" }, "ok", "方块的桃");
expect({ suit: "S", rank: "2", name: "闪" }, "warn", "黑桃的闪");
expect({ suit: "H", rank: "2", name: "闪" }, "ok", "红桃的闪");
expect({ suit: "H", rank: "4", name: "火杀" }, "ok", "红桃4火杀(军争存在)");
expect({ suit: "S", rank: "5", name: "火杀" }, "warn", "黑桃火杀(火杀应红)");
expect({ suit: "C", rank: "7", name: "雷杀" }, "ok", "梅花雷杀");
expect({ suit: "H", rank: "7", name: "雷杀" }, "warn", "红桃雷杀(雷杀应黑)");
expect({ suit: "S", rank: "A", name: "闪电" }, "ok", "黑桃A闪电(军争存在)");
expect({ suit: "H", rank: "Q", name: "闪电" }, "ok", "红桃Q 闪电(EX,存在,不该误报)");
expect({ suit: "C", rank: "3", name: "闪电" }, "warn", "梅花闪电(不存在,应警告)");

console.log("\n=== 精确实体牌校验(STRICT,由 CARD_INDEX 反推)===");
expect({ suit: "H", rank: "5", name: "火杀" }, "warn", "红桃5火杀(♥5是桃/麒麟弓/赤兔,牌堆无此张)");
expect({ suit: "S", rank: "3", name: "闪电" }, "warn", "黑桃3闪电(闪电只有♠A/♥Q,牌堆无此张)");
expect({ suit: "S", rank: "K", name: "杀" }, "warn", "黑桃K杀(♠K是南蛮/无懈/大宛,无杀)");
expect({ suit: "D", rank: "5", name: "贯石斧" }, "ok", "方块5贯石斧(军争存在)");
expect({ suit: "S", rank: "2", name: "藤甲" }, "ok", "黑桃2藤甲(军争存在)");
expect({ suit: "H", rank: "K", name: "爪黄飞电" }, "ok", "红桃K爪黄飞电(军争存在)");
expect({ suit: "D", rank: "Q", name: "无懈可击" }, "ok", "方块Q无懈可击(EX,存在)");

console.log("\n=== 无花色规则的牌(存在即 ok)===");
expect({ suit: "S", rank: "7", name: "杀" }, "ok", "黑桃杀");
expect({ suit: "D", rank: "6", name: "杀" }, "ok", "方块杀(普通杀不限花色)");
expect({ suit: "C", rank: "A", name: "诸葛连弩" }, "ok", "梅花A诸葛连弩(牌库内)");
expect({ suit: "S", rank: "5", name: "青龙偃月刀" }, "ok", "青龙偃月刀(牌库内)");
expect({ suit: "D", rank: "5", name: "木牛流马" }, "ok", "方片5木牛流马(OL军争)");

console.log("\n=== 牌名提醒(info,不拦)===");
expect({ suit: "S", rank: "5", name: "乱七八糟" }, "info", "不在牌库的牌名");
expect({ suit: "H", rank: "3", name: "" }, "ok", "牌名留空(选填,允许)");

console.log(`\n结果: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
