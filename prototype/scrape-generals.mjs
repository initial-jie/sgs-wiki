// 三国杀 OL 全量武将爬虫 —— 生产版。
// 数据源:①列表 ld+json→花名册;②/api/v1/hero/info?gid= →hp/势力/标签/品质/生平/立绘;③详情页 HTML→技能。
// 用 curl(node fetch 被判 bot)。node18+。
import { writeFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
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

// 技能文本清洗:<br>→空格、去标签、解实体
function cleanSkill(s) {
  return (s || "")
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

async function fetchRoster() {
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

async function fetchHero(h) {
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
    // ⚠️ API 的 info.avatar(dianjiang/{id}.png)是错的:低 id 返回别人皮肤、部分 404。
    // 正确小头像 = cover 的 xingxiang 换 dianjiang(同 {id}00.png,~25KB)。
    avatar: (info.cover || "").replace("xingxiang", "dianjiang") || null,
    tool: null,                                   // 后处理填 12 工具映射
    offline: false,
  };
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
const TOOL_NAMES = {
  "魔吕布": "lvbu", "南华老仙": "nanhua", "族荀攸": "xunyou", "谋黄月英": "huangyueying",
  "魔曹操": "caocao", "袁姬": "yuanji", "标钟琰": "zhongyan", "魔司马懿": "simayi",
  "谋董昭": "dongzhao", "神孙权": "shensunquan", "魔貂蝉": "diaochan", "魔孙权": "sunquan",
};

(async () => {
  console.log("① 拉花名册…");
  const roster = await fetchRoster();
  console.log(`   ${roster.length} 将`);
  console.log("② 逐将抓 API+详情(并发 " + CONC + ")…");
  const res = await pool(roster, fetchHero, CONC);
  const ok = res.filter((r) => !r.__err);
  const errs = res.filter((r) => r.__err);

  // 回填 tool
  const byName = new Map(ok.map((g) => [g.name, g]));
  const toolReport = [];
  for (const [nm, tool] of Object.entries(TOOL_NAMES)) {
    const g = byName.get(nm);
    if (g) { g.tool = tool; toolReport.push(`✔ ${tool} ← ${nm}(id ${g.id})`); }
    else toolReport.push(`✗ ${tool} ← "${nm}" 未在 OL 命中(可能是线下/别名,需手动)`);
  }

  writeFileSync(new URL("./generals.json", import.meta.url), JSON.stringify(ok, null, 2));

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
