// 把 generals-overrides.mjs 的全部覆盖(SKILL_OVERRIDES / SKILL_ORDER / SKILL_EN / OFFLINE_HEROES)
// 就地应用到 shared/generals.json —— 不联网、不重爬。改完覆盖层后跑这个即可:
//   node prototype/rebake-overrides.mjs
// (scrape-generals.mjs 联网重爬时也会 applyOverrides 一遍,二者产物一致;本脚本是"只烘焙不爬"的快捷方式。)
import { readFileSync, writeFileSync } from "fs";
import { applyOverrides } from "./shared/generals-overrides.mjs";

const p = new URL("./shared/generals.json", import.meta.url);
const list = JSON.parse(readFileSync(p, "utf8"));
const warns = [];
const r = applyOverrides(list, (m) => warns.push(m));
writeFileSync(p, JSON.stringify(list, null, 2));
console.log(
  `✅ generals.json re-baked: ${list.length} 将 | skillHits=${r.skillHits} enHits=${r.enHits} reordered=${r.reordered} added=${r.added}`
);
if (warns.length) {
  console.log("⚠ 警告(通常是技能名对不上,检查是否拼错/版本名不同):");
  for (const w of warns) console.log("  " + w);
  process.exitCode = 1; // 有警告则非零退出,CI/人都能注意到
}
