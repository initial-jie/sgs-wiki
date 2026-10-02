// 身份自动发放 —— 纯数据 + 纯逻辑(各模式的身份表 / 默认配比 / 校验)。RoomCore.identStart 吃这里;sim 与 worker 共用,
// worker 把 identModesForClient() 吐成 /ident-modes.json 供发身份设置弹层用(客户端不再抄一份)。
//
// 概念:
//   roles      = 该模式的身份牌(按展示顺序);counts = {身份名: 张数},张数之和必须等于入座人数。
//   lead       = 亮明身份并成为 1 号位的那张:普通身份局=主公 / 暴虐无道=暴君 / 失心疯=教主 / 大忠似奸=昏君;
//                明忠 = 随机一名忠臣(主公是暗的);无间道 = 两名主帅都亮明,随机其一为 1 号位。
//   失心(失心疯)= 不占位:从教主以外的人里随机挑 lost 人,把他们的身份牌盖住——全场只知道他是「失心」,
//                本人看不到自己的真实身份,教主可以看到。
//   牌背(无间道)= 身份名首字 龙/虎,全场公开(实体牌背面就分龙虎);内鬼的牌背是潜伏的那一方,真实阵营相反。
//
// 配比来源:普通身份局=标准配置;暴虐无道 4~6 人、失心疯 6~8 人、无间道 8 人 = 盒内规则卡;其余人数是按同样的比例推的(official:false),
// 发身份设置里可以手改。大忠似奸盒内规则卡没读到人数表,整张表都是推的(奸臣固定 1 名)。

const T = (rows) => Object.fromEntries(rows.map(([n, ...c]) => [n, c]));

export const IDENT_MODES = {
  normal: {
    label: "身份局", roles: ["主公", "忠臣", "反贼", "内奸"], lead: ["主公"], official: [2, 10],
    table: T([[2, 1, 0, 1, 0], [3, 1, 0, 1, 1], [4, 1, 1, 1, 1], [5, 1, 1, 2, 1], [6, 1, 1, 3, 1], [7, 1, 2, 3, 1], [8, 1, 2, 4, 1], [9, 1, 3, 4, 1], [10, 1, 3, 4, 2]]),
    win: { 主公: "所有反贼和内奸死亡。", 忠臣: "所有反贼和内奸死亡(保护主公)。", 反贼: "主公死亡。", 内奸: "除自己外所有人死亡(最后单挑胜过主公)。" },
  },
  mingzhong: {
    label: "明忠", roles: ["主公", "忠臣", "反贼", "内奸"], lead: ["忠臣"], official: [6, 6], rule: "mingzhong", noLord: true,
    table: T([[4, 1, 1, 1, 1], [5, 1, 1, 2, 1], [6, 1, 1, 3, 1], [7, 1, 2, 3, 1], [8, 1, 2, 4, 1], [9, 1, 3, 4, 1], [10, 1, 3, 4, 2]]),
    win: { 主公: "所有反贼和内奸死亡。你的身份是暗的:明忠(1 号位)替你挡在明面上。", 忠臣: "所有反贼和内奸死亡(保护主公)。", 反贼: "主公死亡。", 内奸: "除自己外所有人死亡。" },
  },
  baonue: {
    label: "暴虐无道", roles: ["暴君", "诤臣", "间者", "逆乱"], lead: ["暴君"], official: [4, 6], rule: "baonue",
    table: T([[3, 1, 0, 1, 1], [4, 1, 1, 1, 1], [5, 1, 1, 1, 2], [6, 1, 2, 1, 2], [7, 1, 2, 1, 3], [8, 1, 2, 1, 4], [9, 1, 3, 1, 4], [10, 1, 3, 1, 5]]),
    win: { 暴君: "所有其他角色死亡。上限 +2;每击杀一名角色回复 1 点体力。", 诤臣: "逆乱和暴君死亡。", 间者: "在你的回合内其他身份达成胜利条件,则你单独获胜。", 逆乱: "暴君死亡,且此时有逆乱存活。" },
  },
  shixin: {
    label: "失心疯", roles: ["教主", "护法", "官兵", "内奸"], lead: ["教主"], official: [6, 8], rule: "shixinfeng", lost: true,
    table: T([[4, 1, 1, 1, 1], [5, 1, 1, 2, 1], [6, 1, 2, 2, 1], [7, 1, 2, 3, 1], [8, 1, 2, 3, 2], [9, 1, 3, 3, 2], [10, 1, 3, 4, 2]]),
    lostTable: { 4: 1, 5: 1, 6: 1, 7: 1, 8: 2, 9: 2, 10: 2 },
    win: { 教主: "所有官兵和内奸死亡。体力上限与体力各 +1;你可以看到失心的真实身份。", 护法: "与教主一致:所有官兵和内奸死亡。", 官兵: "教主死亡。", 内奸: "除自己外所有人死亡。" },
  },
  dazhong: {
    label: "大忠似奸", roles: ["昏君", "奸臣", "忠臣", "义军"], lead: ["昏君"], official: null, rule: "dazhong",
    table: T([[4, 1, 1, 1, 1], [5, 1, 1, 1, 2], [6, 1, 1, 1, 3], [7, 1, 1, 2, 3], [8, 1, 1, 2, 4], [9, 1, 1, 3, 4], [10, 1, 1, 3, 5]]),
    win: { 昏君: "所有忠臣和义军死亡。", 奸臣: "所有忠臣死亡且昏君存活。", 忠臣: "所有奸臣和义军死亡且昏君存活。", 义军: "昏君死亡。义军彼此知晓身份。" },
    // 本桌变种规则「昏君二线」(rules.json dazhong-variant)在「我的身份」里的提示:主要给昏君(只有他的胜利条件会变)
    variantRule: "dazhong-variant",
    variant: {
      昏君: [
        "奸臣首次濒死时亮明身份,你随即获得〖袒佞〗:锁定技。防止你对已明置身份的奸臣造成的伤害;不能选其为延时锦囊的目标;你的【过河拆桥】【顺手牵羊】只能对其判定区的牌生效;其濒死时你若不对其用【桃】,须展示手牌。",
        "奸臣阵亡时分线一次(之后不再变):",
        "忠臣数 ≥ 义军数 →【昏庸无道】你的胜利条件改为与奸臣一致:所有忠臣死亡且你存活(不必再杀义军)。",
        "忠臣数 < 义军数 →【幡然醒悟】你减 1 点体力上限,并入忠臣阵营:所有奸臣和义军死亡且你存活;此后你杀死忠臣须弃置所有牌。",
        "你若选的是昏君刘宏:不触发〖袒佞〗(障目令非义军阵亡不亮身份),奸臣阵亡后一律进入昏庸无道线。",
      ],
      奸臣: ["你首次濒死时须亮明身份,昏君随即获得〖袒佞〗(不能伤害你、不能对你用延时锦囊)。", "你的胜利条件不变。你阵亡时昏君按 忠臣数/义军数 分线(≥ 昏庸无道 / < 幡然醒悟)。"],
      忠臣: ["你的胜利条件不变。", "奸臣阵亡时:忠臣数 ≥ 义军数 → 昏君转入【昏庸无道】,要杀光忠臣才赢(与你为敌);忠臣数 < 义军数 → 昏君【幡然醒悟】并入你方阵营。"],
      义军: ["你的胜利条件不变(昏君死亡)。", "奸臣阵亡时:忠臣数 ≥ 义军数 → 昏君只需杀光忠臣即胜;忠臣数 < 义军数 → 昏君并入忠臣阵营,与你为敌。"],
    },
  },
  wujian: {
    label: "无间道", roles: ["龙主帅", "龙护卫", "龙内鬼", "虎主帅", "虎护卫", "虎内鬼"], lead: ["龙主帅", "虎主帅"], official: [8, 8], rule: "wujiandao", camps: true, noLord: true,
    table: T([[4, 1, 0, 1, 1, 0, 1], [6, 1, 1, 1, 1, 1, 1], [8, 1, 2, 1, 1, 2, 1], [10, 1, 3, 1, 1, 3, 1]]),
    win: {
      龙主帅: "龙军:消灭潜伏在龙军里的内鬼(龙内鬼)。体力上限与体力各 +1。", 龙护卫: "龙军:消灭潜伏在龙军里的内鬼(龙内鬼)。",
      龙内鬼: "你的真实阵营是【虎军】,潜伏在龙军里:骗取龙军信任,消灭敌方的内鬼(虎内鬼)。",
      虎主帅: "虎军:消灭潜伏在虎军里的内鬼(虎内鬼)。体力上限与体力各 +1。", 虎护卫: "虎军:消灭潜伏在虎军里的内鬼(虎内鬼)。",
      虎内鬼: "你的真实阵营是【龙军】,潜伏在虎军里:骗取虎军信任,消灭敌方的内鬼(龙内鬼)。",
    },
  },
};

// 默认配比:{身份名:张数}(+ 失心疯的 lost)。该人数没有表 → null(设置弹层里手填)
export function identDefaults(mode, n) {
  const m = IDENT_MODES[mode]; if (!m) return null;
  const row = m.table[n]; if (!row) return null;
  const counts = {}; m.roles.forEach((r, i) => { counts[r] = row[i]; });
  return { counts, lost: m.lost ? (m.lostTable[n] || 0) : 0 };
}

// 校验并规整配比。返回 { counts, lost } 或 { error }
export function identCheck(mode, n, counts, lost = 0) {
  const m = IDENT_MODES[mode]; if (!m) return { error: "BAD_MODE" };
  const out = {}; let sum = 0;
  for (const r of m.roles) {
    const c = Number(counts?.[r] ?? 0);
    if (!Number.isInteger(c) || c < 0) return { error: "BAD_COUNTS" };
    out[r] = c; sum += c;
  }
  if (sum !== n) return { error: "COUNT_MISMATCH", need: n, have: sum };
  if (mode === "mingzhong") { if (out["主公"] !== 1 || out["忠臣"] < 1) return { error: "BAD_LEAD" }; } // 明忠:主公 1 名(暗)+ 至少 1 名忠臣
  else if (m.lead.some((r) => out[r] !== 1)) return { error: "BAD_LEAD" };
  lost = m.lost ? Number(lost) || 0 : 0;
  if (!Number.isInteger(lost) || lost < 0 || lost > n - 1) return { error: "BAD_LOST" };
  return { counts: out, lost };
}

// 明忠(1 号位亮明的忠臣)按所选武将获得的技能:男性且加成前体力上限 ≤ 3 → 明察;其余 → 舍身
export const MINGZHONG_SKILLS = {
  明察: "游戏开始时,你可以查看一名其他玩家的身份牌。准备阶段,你可以弃置场上的一张牌。",
  舍身: "锁定技,当主公即将死亡时,其亮明身份,并加 1 点体力上限,回复体力至 X 点并获得你手牌区和装备区的所有牌,然后你死亡(X 为你的体力值)。",
};
export function mingzhongSkill(hero) { // hero = {name,hp,female} | null(还没选将/查不到)
  if (!hero) return null;
  return !hero.female && Number(hero.hp) <= 3 ? "明察" : "舍身";
}
export const BIZHONG_HERO = "教主张角"; // 〖蔽众〗(教主技):游戏开始时令一名非失心的其他角色成为失心,然后任意交换所有失心的身份牌

// 牌背阵营(无间道):身份名首字
export const identCamp = (mode, role) => (IDENT_MODES[mode]?.camps ? role[0] : null);

// 给客户端的模式表(发身份设置弹层 / 我的身份弹层 / 疑似身份标记共用)
export function identModesForClient() {
  const out = {};
  for (const [k, m] of Object.entries(IDENT_MODES)) {
    const defaults = {};
    for (const n of Object.keys(m.table)) defaults[n] = identDefaults(k, Number(n));
    out[k] = { label: m.label, roles: m.roles, lead: m.lead, official: m.official, rule: m.rule || null, lost: !!m.lost, camps: !!m.camps, noLord: !!m.noLord, win: m.win, defaults };
  }
  return out;
}
