# SGS-Wiki 房间 · 英文翻译贡献指南 (Translation Contributor Guide)

> **给协作者的 agent 读。** This guide is for a coding agent adding **English skill translations** to the offline-room hero library. Follow it **exactly** — the design uses a strict additive-overlay pattern, and deviating from it will break the maintainer's workflow.
>
> 维护者备注(中文):这份文档让协作者的 agent 按我们现有 pattern 加翻译,**只增不改、缺失回退中文**,不碰逻辑/爬虫产物。

---

## 0. Golden rules (read first, never break these)

1. **Translations are ADDITIVE only.** You only ever ADD English fields (`effect_en`, `text_en`). You NEVER edit, delete, or reword the Chinese (`effect`, `text`). Missing English always falls back to Chinese, so partial coverage is safe and expected.
2. **Never touch game logic.** Do not edit `prototype/shared/room-logic.mjs`, `prototype/room-sim.mjs`, the worker's business code, any `tools/*.html`, or any skill's **mechanics**. You are translating text, not changing rules.
3. **Never hand-edit generated/extracted files.** Specifically:
   - `prototype/shared/generals.json` — it is **baked** from the override layer. You edit the override source, then run the re-bake script. Never type into `generals.json` directly.
   - `prototype/shared/derived-skills.json` and `derived-cards.json` — these are **extracted from `index.html`**. Never edit them. Derived-skill English goes in a separate file (see §4).
4. **Translate faithfully, not creatively.** Preserve exact mechanics, numbers, timing, and conditions. When a term has a house translation (see §2 glossary), use it. Do not invent card names or paraphrase away precision.
5. **Same-name skills belong to specific heroes.** Different hero versions can share a skill name (e.g. 火计 exists in strong and weak variants). Everything is keyed **per hero**, never globally. Respect the keys exactly.
6. **Verify before you commit** (see §5). If the re-bake prints a warning or `room-sim` changes its pass count, you did something wrong — fix it, don't commit it.

---

## 1. Architecture — where English lives

There are **two** English channels. Both are pure overlays with Chinese fallback.

| What you're translating | Source file you edit | How it reaches the app |
|---|---|---|
| A hero's **own** skills (the ones on its character card) | `prototype/shared/generals-overrides.mjs` → `SKILL_EN` | `applyOverrides` bakes `effect_en` into `generals.json` (you run the re-bake script) |
| **Derived** skills / **derived** cards (the red-bordered "衍生技/衍生牌" section) | `prototype/shared/derived-en.json` | The worker merges `text_en` onto the served `/derived-skills.json` & `/derived-cards.json` at runtime |

The front-end (`prototype/client/room.html`) already reads these fields: when the user toggles **EN**, it shows `effect_en` / `text_en` if present, otherwise the Chinese. **You do not touch `room.html`.**

Why two files: hero skills come from the scraper (Chinese in `generals.json`), so their English must live in the override layer to survive a re-scrape. Derived skills/cards are extracted from `index.html`, so their English lives in `derived-en.json` to survive a re-extract. Both are the same idea: keep English in a side file that regeneration can't clobber.

---

## 2. Terminology glossary (MANDATORY — keep consistent)

Use these house translations so every hero reads as one voice. If you hit a term not listed, pick the clearest standard SGS-community English and **add it to this table in your PR**.

| 中文 | English | 中文 | English |
|---|---|---|---|
| 【杀】 | [Slash] | 【闪】 | [Dodge] |
| 【桃】 | [Peach] | 【酒】 | [Wine] |
| 摸牌 | draw card(s) | 弃置 | discard |
| 手牌 | hand card(s) | 手牌上限 | hand limit |
| 体力 / 1 点体力 | HP / 1 HP | 体力上限 | max HP |
| 回复体力 | restore HP | 失去体力 | lose HP |
| 出牌阶段 | Play phase | 摸牌阶段 | Draw phase |
| 准备阶段 | Preparation phase | 结束阶段 | End phase |
| 判定 / 判定区 | judgement / judgement zone | 濒死状态 | dying state |
| 锁定技 | Compulsory Skill | 限定技 | Limit Skill |
| 觉醒技 | Awakening Skill | 转换技 (阳/阴) | Transform Skill (Yang/Yin) |
| 主公技 | Lord Skill | 宗族技 | Clan Skill |
| 势力 | faction | 距离 | distance |
| 攻击范围 | attack range | 目标 / 唯一目标 | target / sole target |
| 基本牌 | basic card | 锦囊牌 / 普通锦囊 | trick card / normal trick |
| 装备牌 / 装备区 | equipment card / equipment zone | 花色 / 点数 | suit / rank |
| 重铸 | recast | 连环状态 | chained |
| 火焰伤害 / 雷电伤害 | fire damage / thunder damage | 属性伤害 | elemental damage |
| 横置 / 重置 | turn sideways / turn upright | 翻面 | flip |

**Conventions:**
- Keep the **skill name in Chinese** (the friend sees the Chinese name on the physical card). Only the effect text becomes English.
- It's fine (and consistent with existing entries) for the English to begin with the tag word, e.g. `"Compulsory Skill. ..."`, even though a colored `锁定技` chip also shows.
- Keep card names in 【】 brackets, e.g. `【Slash】` or leave the Chinese `【杀】` — match how neighboring entries do it; when in doubt keep the Chinese card name in 【】 so it maps to the physical card.

---

## 3. How to add a hero's OWN skills (`SKILL_EN`)

### Step 3.1 — Look up the hero's id + exact skill names + Chinese text

```bash
node -e '
const g=require("./prototype/shared/generals.json");
const h=g.find(x=>x.name==="张华");   // <- put the hero name here
console.log("id:", h.id, "| faction:", h.faction, "| hp:", h.hp);
for(const s of h.skills) console.log("【"+s.name+"】", s.effect);
'
```
- The **id** is the `SKILL_EN` key.
- Each **skill name** (`s.name`) is an inner key and must match **character-for-character**.
- Translate each `s.effect` into English.

> If the name matches several heroes (e.g. `界张华`, `谋X`), search by exact name or inspect ids to pick the right one. Every version has its own id, so translate the version you mean.

### Step 3.2 — Add the entry to `SKILL_EN` in `prototype/shared/generals-overrides.mjs`

Find `export const SKILL_EN = { ... }` and add one block. Use backtick strings (they tolerate both `"` and `'` and 【】). Example (already in the repo — copy its shape):

```js
export const SKILL_EN = {
  544: { // 张华   ← id + a comment with the hero name
    "弼昏": `Compulsory Skill. When you use a card that targets another character, if your hand size exceeds your hand limit, cancel that use, and the sole target gains that card.`,
    "剑合": `During your Play phase, once per character: ...`,
    "穿屋": `Compulsory Skill. After you deal or take damage, ...`,
  },
  // ... add your new hero id block here ...
};
```

Rules:
- Inner keys = the exact Chinese skill names from Step 3.1.
- You may translate a subset of a hero's skills; untranslated ones fall back to Chinese.
- Do **not** add or change any `effect` (Chinese) — only this `SKILL_EN` map.

### Step 3.3 — Re-bake `generals.json`

```bash
node prototype/rebake-overrides.mjs
```
Expected: `✅ generals.json re-baked: ... enHits=<n>` with **exit code 0 and no warnings**. `enHits` should have gone up by the number of skills you added. A warning like `id544「张华」EN 无技能「弼错」` means your inner key doesn't match a real skill name — fix the typo.

Both `generals-overrides.mjs` **and** `generals.json` will show as changed in git. Commit **both** (the baked json is committed on purpose).

---

## 4. How to add DERIVED skills / cards (`derived-en.json`)

These are the entries shown under "衍生技(该武将技能中提及)" / "衍生牌(该武将可产生)" in the skill popup — e.g. 张芝's 飞白, 谋庞统's 飞军/潜袭, 蒲元's forged equipment.

### Step 4.1 — Find the entry's hero key + exact name

```bash
node -e '
const s=require("./prototype/shared/derived-skills.json");
const c=require("./prototype/shared/derived-cards.json");
const r1=require("./prototype/shared/derived-skills-room.json");
const r2=require("./prototype/shared/derived-cards-room.json");
for(const src of [s,c,r1,r2]) for(const hero of Object.keys(src))
  if(hero.includes("庞统")) console.log(hero, "->", src[hero].map(x=>x.name).join(", "));
'
```
- The **hero key** is the hero name with `·` and spaces removed — i.e. `hero.name.replace(/[·\s]/g,"")`. In these JSON files the keys are already in that normalized form; **use the key exactly as it appears**.
- The **entry name** (`.name`) is the derived skill/card name (e.g. `飞白`, `折戟`).

### Step 4.2 — Add to `prototype/shared/derived-en.json`

Shape: `{ "<heroKey>": { "<entryName>": "<English>" } }`. Example (already in the repo):

```json
{
  "张芝": {
    "飞白": "Transform Skill, Compulsory Skill. Yang: when a non-black card of yours deals damage, that damage is increased by 1. Yin: when a non-red card of yours restores HP, that recovery is increased by 1."
  },
  "谋庞统": {
    "飞军": "Once per Play phase, you may discard a card, then choose one: ...",
    "潜袭": "During your Preparation phase, ..."
  }
}
```
- Merge into the existing object; don't duplicate a hero key — add entries under it.
- This file is **not** baked and **not** extracted — the worker reads it live. No re-bake needed for derived entries.
- Verify it's valid JSON: `node -e 'require("./prototype/shared/derived-en.json"); console.log("ok")'`.

---

## 5. Language-bound skills (rare — needs a human)

A few skills manipulate their own **Chinese text** (e.g. 张芝's 洗墨 "removes the first five characters of 笔心's description"). A literal English translation is meaningless. For these:
- Write a **functional / replica** translation that reproduces the *effect* in English (see 洗墨 in `SKILL_EN[516]` for the reference approach — it mirrors the "delete words" mechanic in English and spells out the staged result).
- **Flag it in your PR description** and ask the maintainer / a mechanics-literate reviewer to confirm — do not silently guess. These are the one case where machine/literal translation is guaranteed wrong.

---

## 6. Verification checklist (run before every commit)

```bash
# 1. Re-bake (only needed if you touched SKILL_EN). Must be exit 0, no warnings:
node prototype/rebake-overrides.mjs

# 2. derived-en.json must be valid JSON (only if you touched it):
node -e 'require("./prototype/shared/derived-en.json"); console.log("derived-en OK")'

# 3. The room simulator MUST still pass with the SAME count as before your change
#    (translations never touch logic, so this number must not move):
node prototype/room-sim.mjs | tail -1     # expect: 结果: 337 passed, 0 failed
```
If step 1 warns, or step 3's number changed, your change is wrong — fix it before committing.

Optional visual check (if you can run the room locally): open the skill popup, toggle **EN**, confirm your hero shows English and everything else still falls back to Chinese.

---

## 7. Git / PR workflow

- Work on a **branch**, open a **Pull Request** — do **not** push to `main` (the maintainer owns `main` and deploys from it).
- Keep each PR focused (e.g. "EN: translate 10 tool heroes"). Small PRs review faster.
- Commit message style (match the repo, Chinese conventional commits are fine):
  `feat(EN): 翻译 <hero names> 技能英文 (effect_en/derived-en)`
- In the PR description, list which heroes/skills you added, and **call out any language-bound skill** you had to interpret (§5).
- Files you may touch in a translation PR: `generals-overrides.mjs`, `generals.json` (only via re-bake), `derived-en.json`, and this guide's glossary. **Nothing else.**
- After merge, the **maintainer** runs `wrangler deploy` to push the room live — that's not your step.

---

## 8. Quick worked example (a hero's own skills, end to end)

```bash
# 1. look up 族荀采
node -e 'const g=require("./prototype/shared/generals.json");const h=g.find(x=>x.name==="族荀采");console.log(h.id);for(const s of h.skills)console.log(s.name,"=",s.effect)'
# -> id 524, skills 蹈节 / 烈誓 / 点盏 / 还阴

# 2. add to SKILL_EN in generals-overrides.mjs:
#    524: { "蹈节": `Clan Skill, Compulsory Skill. ...`, "烈誓": `...`, "点盏": `...`, "还阴": `...` },

# 3. re-bake + verify
node prototype/rebake-overrides.mjs        # enHits should increase by 4, exit 0
node prototype/room-sim.mjs | tail -1      # unchanged pass count

# 4. commit generals-overrides.mjs + generals.json on a branch, open PR
```

That's the whole loop. Reference heroes already done in the repo (read them for the exact style): **张芝 (516), 族荀采 (524), 张华 (544), 谋庞统 (635)** in `SKILL_EN`, and **张芝 / 谋庞统** in `derived-en.json`.
