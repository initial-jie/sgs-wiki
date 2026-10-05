// 新录武将后的「配套数据」体检:一个武将不只在 generals.json 里,还有拼音/扩展包/性别/皮肤/将池 几处要跟上。
//   用法:node prototype/sgs/check-hero-data.mjs            → 列出所有配套数据有缺的武将
//         node prototype/sgs/check-hero-data.mjs --ids 9026,9027 → 只看这几个(刚录的)
//   退出码:有缺 → 1(可接在 rebake/scrape 后面当提醒)
// 各处怎么补,见 docs/HANDOFF.md「新录武将 checklist」。
import { readFileSync } from "node:fs";

const read = (p) => JSON.parse(readFileSync(new URL("./shared/" + p, import.meta.url), "utf8"));
const heroes = read("generals.json");
const pinyin = read("hero-pinyin.json");
const packs = read("hero-packs.json").packs;
const gender = read("hero-gender.json");
const skins = read("hero-skins.json");
const seed = read("hero-pool-seed.json"); // 只用来提示:新将不在仓库备份的白名单里很正常(/pool 页会标「新」,由用户定)

const arg = process.argv.indexOf("--ids");
const only = arg > 0 ? new Set(process.argv[arg + 1].split(",").map(Number)) : null;
const female = new Set(gender.female), reviewed = new Set(gender.reviewed || []);
const inPool = new Set((seed.ids || []).map(Number));

let bad = 0;
for (const h of heroes) {
  if (only && !only.has(h.id)) continue;
  const miss = [];
  if (!pinyin[h.name]) miss.push("拼音(node prototype/sgs/build-pinyin.mjs)");
  if (!packs[h.id]) miss.push(`扩展包(hero-packs.json 缺 → 图鉴/将池页落到「${h.genre || "其他"}」组)`);
  if (!skins.skins[h.id] && !skins.skins[skins.alias?.[h.id]] && !(skins.none || []).includes(h.id)) miss.push(h.id >= 9000 ? "皮肤(hero-skins.json:手录将可加 alias 借同名 OL 将)" : "皮肤(hero-skins.json 无条目,只显示默认立绘)");
  if (!female.has(h.id) && !reviewed.has(h.id)) miss.push("性别未核(默认按男;核过后把 id 加进 hero-gender.json reviewed,女将还要加进 female)");
  if (!h.cover || !h.avatar) miss.push("立绘/头像缺(线下将:用户给图放 assets/heroes/,或借 OL 皮肤图)");
  if (!miss.length && only && !inPool.has(h.id)) console.log(`${h.id} ${h.name}:配套齐全;未在将池白名单备份里(/pool 页标「新」,要不要进池由用户定)`);
  if (miss.length) { bad++; console.log(`${h.id} ${h.name}(${h.genre || "?"})\n  - ` + miss.join("\n  - ")); }
}
console.log(bad ? `\n${bad} 将有配套数据待补` : "全部武将配套数据齐全");
process.exit(bad ? 1 : 0);
