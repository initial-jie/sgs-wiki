// 三国杀 OL 全量武将爬虫 —— 生产版。
// 数据源:①列表 ld+json→花名册;②/api/v1/hero/info?gid= →hp/势力/标签/品质/生平/立绘;③详情页 HTML→技能。
// 用 curl(node fetch 被判 bot)。node18+。
//   node prototype/scrape-generals.mjs                    全量重爬(⚠ 先 graduate 手录将,否则重复)
//   node prototype/scrape-generals.mjs --ids 606,740      增量:只抓这些 id 合并进现库(graduate / 新将)
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { applyOverrides } from "./shared/generals-overrides.mjs"; // 人工修正层:线下武将 + 过时技能,re-scrape 不丢
const pexec = promisify(execFile);

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
const CONC = 8;

async function curl(url, referer) {
  const args = ["-sS", "--compressed", "--max-time", "25", "-A", UA];
  if (referer) args.push("-H", `Referer: ${referer}`);
  args.push(url);
  const { stdout } = await pexec("curl", args, { maxBuffer: 20 * 1024 * 1024 });
  return stdout;
}
async function curlRetry(url, referer, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { return await curl(url, referer); } catch (e) { last = e; }
  }
  throw last;
}

// 技能文本清洗:<br>→空格、去标签、解实体。
// 转换技官网会用 ### 拼三份(原文 / 阳高亮 / 阴高亮,游戏 UI 状态),只取第一份原文(段煨讨怀、武安国历勇)
function cleanSkill(s) {
  return (s || "").split("###")[0]
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ").trim();
}
const clean = (s) => (s || "").replace(/\s+/g, " ").trim();

// 系列前缀(展示用,从名字派生;genre 才是官方权威分组)
function seriesPrefix(name) {
  const m = name.match(/^(界|神|谋|魔|SP|星|势|阵|手|OL|贺|皮)/);
  return m ? m[1] : "标";
}

export async function fetchRoster() {
  const html = await curlRetry("https://www.sanguosha.com/hero");
  const m = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
  return JSON.parse(m[1]).itemListElement.map((it) => {
    const item = it.item || {};
    const id = Number((it.url || item.url || "").match(/\/hero\/(\d+)/)?.[1]);
    return { id, name: item.name, genre: item.genre };
  }).filter((h) => h.id);
}

function parseSkills(html) {
  const body = html.slice(html.indexOf("</head>"));
  const names = [...body.matchAll(/<div class="character-tab[^"]*">([^<]+)<\/div>/g)].map((m) => clean(m[1]));
  const block = body.match(/<p class="skill-text">([\s\S]*?)<\/p>/)?.[1] || "";
  const effects = [...block.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/g)].map((m) => cleanSkill(m[1]));
  return names.map((nm, i) => ({ name: nm, effect: effects[i] || "" }));
}

export async function fetchHero(h) {
  const ref = `https://www.sanguosha.com/hero/${h.id}`;
  const [apiRaw, detailHtml] = await Promise.all([
    curlRetry(`https://www.sanguosha.com/api/v1/hero/info?gid=${h.id}`, ref),
    curlRetry(ref, ref),
  ]);
  const info = JSON.parse(apiRaw)?.data?.info?.[0] || {};
  const faction = info.figure ?? null;          // 魏蜀吴群神
  const skills = parseSkills(detailHtml);
  return {
    id: h.id,
    name: info.name || h.name,
    genre: h.genre,                              // 官方权威系列(方案1:原样10类)
    series: seriesPrefix(info.name || h.name),   // 名字前缀(展示辅助)
    faction,
    factionSelectable: faction === "神",         // 神将 = 自选势力
    quality: info.quality ?? null,               // 品质 传说/稀有/普通…
    hp: info.hp ?? null,                          // 体力上限(勾玉总数)
    initialHp: info.initial_hp || null,          // 特殊起始体力(0/缺=同 hp)
    tags: info.label || [],                       // 定位 进攻/控制…
    skills,
    characteristic: clean(info.characteristic),
    cover: info.cover || null,
    avatar: avatarFromCover(info.cover),
    tool: null,                                   // 后处理填 12 工具映射
    offline: false,
  };
}

// ⚠️ API 的 info.avatar 不可靠(旧:dianjiang/{id}.png 低 id 返回别人皮肤、部分 404;新:skinShop/{id}.png 是 9KB 残图)。
// 正确小头像由 cover 派生(同 {id}00.png,~25KB):
//   旧路径 …/shequshow/xingxiang/{id}00.png → …/shequshow/dianjiang/{id}00.png
//   新路径 …/general/big/static/{id}00.png  → …/general/skinShop/{id}00.png(2026-09 起 API 对新将给这个)
export function avatarFromCover(cover) {
  if (!cover) return null;
  if (cover.includes("/general/big/static/")) return cover.replace("/general/big/static/", "/general/skinShop/");
  return cover.replace("xingxiang", "dianjiang");
}

// 并发池
async function pool(items, worker, conc) {
  const out = new Array(items.length);
  let i = 0, done = 0;
  await Promise.all(Array.from({ length: conc }, async () => {
    while (i < items.length) {
      const idx = i++;
      try { out[idx] = await worker(items[idx]); }
      catch (e) { out[idx] = { __err: true, id: items[idx].id, name: items[idx].name, msg: e.message }; }
      if (++done % 50 === 0) console.log(`  …${done}/${items.length}`);
    }
  }));
  return out;
}

// 12 个已接房间工具 → 按武将名匹配 OL,回填 tool 字段
export const TOOL_NAMES = {
  "魔吕布": "lvbu", "南华老仙": "nanhua", "族荀攸": "xunyou", "谋黄月英": "huangyueying",
  "魔曹操": "caocao", "袁姬": "yuanji", "钟琰": "zhongyan", "魔司马懿": "simayi",
  "谋董昭": "dongzhao", "神孙权": "shensunquan", "魔貂蝉": "diaochan", "魔孙权": "sunquan",
  "神典韦": "dianwei", "李傕": "lijue", "徐荣": "xurong", "郭照": "guozhao",
  "裴秀": "peixiu", // OL 已收录(id606,2026-09-15 由手录 9003 graduate)
  "蒲元": "puyuan", // OL 已收录(id510);tool 直接写进 generals.json,此处防全量重爬丢失
  "曹婴": "caoying", // OL 已收录(id353);伏间随机器,同蒲元法防重爬丢失
  "族王明山": "wangmingshan", // OL 已收录(id608);剩墨台账,同上防重爬丢失
  "贾充": "jiachong", // OL 已收录(id7019);凶竖秘密猜测,同上防重爬丢失
  "族陆郁生": "zuluyusheng", // OL 已收录(id751);拾昔花色台账,同上防重爬丢失
  "谋程昱": "mouchengyu", // OL 已收录(id734);胆持跨座位秘密选类型,同上防重爬丢失
};

// 按名回填 tool 字段,返回报告行。只匹配 OL 条目:graduate 时库里可能还残留同名旧手录(offline)条目,不能挂到它上面
export function applyTools(list) {
  const byName = new Map(list.filter((g) => !g.offline).map((g) => [g.name, g]));
  return Object.entries(TOOL_NAMES).map(([nm, tool]) => {
    const g = byName.get(nm);
    if (g) { g.tool = tool; return `✔ ${tool} ← ${nm}(id ${g.id})`; }
    return `✗ ${tool} ← "${nm}" 未在 OL 命中(可能是线下/别名,需手动)`;
  });
}

// 增量模式:只抓指定 id,合并进现有 generals.json(同 id 整条替换,新 id 插在手录 9000+ 段之前),再 applyOverrides。
// graduate 手录将 = 先从 OFFLINE_HEROES 删掉该条,再 --ids 真 id;applyOverrides 会清掉库里残留的旧 9000+ 条目。
async function scrapeIds(ids) {
  const p = new URL("./shared/generals.json", import.meta.url);
  const list = JSON.parse(readFileSync(p, "utf8"));
  const roster = await fetchRoster();
  const rosterById = new Map(roster.map((h) => [h.id, h]));
  const missing = ids.filter((id) => !rosterById.has(id));
  if (missing.length) { console.error(`✗ 官网花名册无这些 id:${missing.join(",")}`); process.exit(1); }
  const res = await pool(ids.map((id) => rosterById.get(id)), fetchHero, CONC);
  const errs = res.filter((r) => r.__err);
  if (errs.length) { console.error("✗ 抓取失败:", errs.map((e) => `${e.id}:${e.name}(${e.msg})`).join(" ")); process.exit(1); }
  for (const g of res) {
    if (!g.skills.length || g.hp == null) console.warn(`⚠ ${g.id}:${g.name} 数据不全(技能${g.skills.length} hp=${g.hp})`);
    const i = list.findIndex((h) => h.id === g.id);
    if (i >= 0) { list[i] = g; continue; }
    const j = list.findIndex((h) => h.id >= 9000);
    list.splice(j < 0 ? list.length : j, 0, g);
  }
  const toolReport = applyTools(list).filter((l) => ids.some((id) => l.includes(`(id ${id})`)));
  const ovr = applyOverrides(list);
  writeFileSync(p, JSON.stringify(list, null, 2));
  console.log(`✅ 合并 ${res.length} 将:${res.map((g) => `${g.id}${g.name}`).join(" ")} | 库 ${list.length} 将 | 清孤儿手录 ${ovr.pruned}`);
  if (toolReport.length) console.log(toolReport.join("\n"));
  console.log("→ 记得跑 node prototype/build-pinyin.mjs(如有新名字)");
}

const isMain = import.meta.url === pathToFileURL(process.argv[1] || "").href;
const idsArg = process.argv.indexOf("--ids");
if (isMain && idsArg >= 0) {
  scrapeIds(process.argv[idsArg + 1].split(",").map(Number).filter(Boolean));
} else if (isMain) (async () => {
  console.log("① 拉花名册…");
  const roster = await fetchRoster();
  console.log(`   ${roster.length} 将`);
  console.log("② 逐将抓 API+详情(并发 " + CONC + ")…");
  const res = await pool(roster, fetchHero, CONC);
  const ok = res.filter((r) => !r.__err);
  const errs = res.filter((r) => r.__err);

  // 回填 tool
  const toolReport = applyTools(ok);

  // 人工修正层:改过时/线下技能 + 追加纯线下武将(OL 没有)。放在 tool 回填之后、写盘之前。
  const ovr = applyOverrides(ok);
  console.log(`\n--- overrides:改 ${ovr.skillHits} 条技能,追加 ${ovr.added} 名线下武将 ---`);

  // 写入 app 实际读取的 shared/generals.json(worker import 的就是这个;旧路径 ./generals.json 是错的)
  writeFileSync(new URL("./shared/generals.json", import.meta.url), JSON.stringify(ok, null, 2));

  // 概览
  const byGenre = {}, byFaction = {}, noSkill = [], noHp = [];
  for (const g of ok) {
    byGenre[g.genre] = (byGenre[g.genre] || 0) + 1;
    byFaction[g.faction] = (byFaction[g.faction] || 0) + 1;
    if (!g.skills.length) noSkill.push(`${g.id}:${g.name}`);
    if (g.hp == null) noHp.push(`${g.id}:${g.name}`);
  }
  console.log(`\n===== 完成:${ok.length}/${roster.length} 将,写入 generals.json =====`);
  console.log("genre:", byGenre);
  console.log("势力:", byFaction);
  console.log(`无技能: ${noSkill.length}`, noSkill.slice(0, 10).join(" ") || "");
  console.log(`无HP: ${noHp.length}`, noHp.slice(0, 10).join(" ") || "");
  console.log(`失败: ${errs.length}`, errs.slice(0, 10).map((e) => `${e.id}:${e.name}(${e.msg})`).join(" ") || "");
  console.log("\n--- 12 工具映射 ---\n" + toolReport.join("\n"));
})();
