// 生成风声角色名 → 拼音音节表(选角搜索支持拼音/首字母),写 shared/char-pinyin.json。
// 格式同三国杀 sgs/build-pinyin.mjs:{"李宁玉":"li ning yu"},空格分音节、ü 写 v。worker 下发 /fs/data.json 时贴到 py 字段。
//   cd prototype && npm i --no-save --no-package-lock pinyin-pro@3   (已装可跳过)
//   node prototype/fengsheng/build-pinyin.mjs      —— 新增/改名角色后跑
import { writeFileSync } from "node:fs";
import { CHARACTERS } from "./shared/fs-data.mjs";

let pinyin;
try { ({ pinyin } = await import("pinyin-pro")); }
catch {
  console.error("✗ 缺 pinyin-pro。先执行:cd prototype && npm i --no-save --no-package-lock pinyin-pro@3");
  process.exit(1);
}
const out = {};
for (const name of [...new Set(CHARACTERS.map((c) => c.name))].sort((a, b) => a.localeCompare(b, "zh"))) {
  const syl = pinyin(name, { toneType: "none", type: "array", surname: "head", nonZh: "consecutive" })
    .map((s) => s.toLowerCase().replace(/ü/g, "v"));
  out[name] = syl.join(" ");
}
writeFileSync(new URL("./shared/char-pinyin.json", import.meta.url), JSON.stringify(out, null, 1) + "\n");
console.log(`✓ char-pinyin.json:${Object.keys(out).length} 个角色名`);
