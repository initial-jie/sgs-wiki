// 生成武将名 → 拼音音节表(选将搜索支持拼音/首字母),写 shared/hero-pinyin.json。
// 形如 {"关羽":"guan yu","界关羽":"jie guan yu","吕布":"lv bu"} —— 空格分音节(客户端靠音节边界做前缀匹配),ü 统一写 v。
// worker 启动时把它贴到每个武将的 py 字段上,客户端零依赖。
//
// 依赖 pinyin-pro(仓库零依赖,不入 package.json;node_modules 已 gitignore):
//   cd prototype && npm i --no-save --no-package-lock pinyin-pro@3
//   node prototype/sgs/build-pinyin.mjs
// 何时跑:新增/改名武将后(rebake-overrides.mjs 会提示缺拼音的将)。
import { readFileSync, writeFileSync } from "node:fs";

let pinyin;
try { ({ pinyin } = await import("pinyin-pro")); }
catch {
  console.error("✗ 缺 pinyin-pro。先执行:cd prototype && npm i --no-save --no-package-lock pinyin-pro@3");
  process.exit(1);
}

const generals = JSON.parse(readFileSync(new URL("./shared/generals.json", import.meta.url), "utf8"));
const out = {};
for (const name of [...new Set(generals.map((h) => h.name))].sort((a, b) => a.localeCompare(b, "zh"))) {
  // surname:"head" 让首字按姓氏读音(乐进=yue、张郃=he、单福=shan、尉迟=yuchi);nonZh 让 "SP" 这类整段保留
  const syl = pinyin(name, { toneType: "none", type: "array", surname: "head", nonZh: "consecutive" })
    .map((s) => s.toLowerCase().replace(/ü/g, "v"));
  out[name] = syl.join(" ");
}
writeFileSync(new URL("./shared/hero-pinyin.json", import.meta.url), JSON.stringify(out, null, 1) + "\n");
console.log(`✓ hero-pinyin.json:${Object.keys(out).length} 个武将名`);
