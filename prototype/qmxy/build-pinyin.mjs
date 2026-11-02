// 生成枪鸣锈语角色名 → 拼音音节表(选角搜索支持拼音/首字母),写 shared/hero-pinyin.json。
// 格式同三国杀/风声:{"张春华":"zhang chun hua"},空格分音节、ü 写 v。worker 下发 /qmxy/data.json 时贴到 py 字段。
//   cd prototype && npm i --no-save --no-package-lock pinyin-pro@3   (已装可跳过)
//   node prototype/qmxy/build-pinyin.mjs      —— 新增/改名角色后跑
import { writeFileSync } from "node:fs";
import { HEROES, NPCS } from "./shared/qmxy-data.mjs";

let pinyin;
try { ({ pinyin } = await import("pinyin-pro")); }
catch {
  console.error("✗ 缺 pinyin-pro。先执行:cd prototype && npm i --no-save --no-package-lock pinyin-pro@3");
  process.exit(1);
}
const names = [...new Set([...HEROES.map((c) => c.name), ...Object.values(NPCS).map((n) => n.name)])].sort((a, b) => a.localeCompare(b, "zh"));
const out = {};
for (const name of names) {
  const syl = pinyin(name, { toneType: "none", type: "array", surname: "head", nonZh: "consecutive" })
    .map((s) => s.toLowerCase().replace(/ü/g, "v"));
  out[name] = syl.join(" ");
}
writeFileSync(new URL("./shared/hero-pinyin.json", import.meta.url), JSON.stringify(out, null, 1) + "\n");
console.log(`✓ hero-pinyin.json:${Object.keys(out).length} 个名字`);
