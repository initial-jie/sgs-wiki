// 枪鸣锈语房间核心逻辑(线下辅助形态:桌上用实体牌,手机管「身份保密 + 选角候选 + 血量/弹匣/装备/延时牌公开台账 + 命中判定辅助 + 安全协议 + 胜负」)。
// 被 qmxy/qmxy-sim.mjs(node 断言)与 qmxy/worker.mjs(Durable Object)共用;座位/设备骨架继承 common/room-base.mjs。
//
// 保密模型(按设备持有的座位过滤,见 _seatView):
//   - 身份:至高之脑开局公开;其余仅本人/代持可见,阵亡时公开(规则:死亡亮出身份牌),本局结束全公开。
//   - 角色候选(脑 5 张、其余 3 张)仅本人可见;选定的角色在 startGame / revealHeroes 后公开(脑选完即亮)。
//   - 血量、弹匣、装备、面前的延时牌、濒死/阵亡、回合、安全协议、日志:全公开(桌面本来就是明的)。日志不写秘密身份。
//
// 命中判定(hitCheck):翻牌点数 − 射手与目标之间隔的角色数(取最短路,NPC 算角色,阵亡者不算)− 扫射 2 + 向前翻滚 1 + 其他修正;
//   >0 命中。爆头无视修正直接命中且伤害 +1;哑火无视修正不中。「恰好命中」= 修正后点数为 1(甄宓/司马懿用)。
//   吕布〖死亡宣告〗:4 点视为爆头。偏折头盔:扫射与爆头对其无效。孙鲁班〖翻云覆雨〗:结果反转(爆头↔哑火)。
//   深渊(扩展《雾区·呓语》):座位 abyss=true 视为处于深渊;不同空间不能互射(射手装备【悖论视界】的点射例外:直接命中「精准」),
//   计算隔人只数同空间的角色;处于深渊者受到的射击伤害 +1。
//
// 动作:core.action(deviceId, {op, ...}),见 action() 内分派。

import { RoomBase, clone } from "../../common/room-base.mjs";
import { HEROES, HERO_BY_ID, NPCS, ID_KEYS, IDENTITIES, DEFAULT_ID_COUNTS, CARD_BY_KEY } from "./qmxy-data.mjs";

const HERO_HUANGYUEYING = 13, HERO_LVBU = 19, HERO_SUNLUBAN = 6;
const BRAIN_EXTRA_OFFERS = 2; // 至高之脑多发两张候选

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function defaultIdCounts(playerCount) {
  const d = DEFAULT_ID_COUNTS[playerCount];
  if (d) return { brain: d[0], immune: d[1], virus: d[2], mutant: d[3] };
  if (playerCount <= 2) return { brain: 1, immune: 0, virus: Math.max(0, playerCount - 1), mutant: 0 };
  return { brain: 1, immune: 2, virus: playerCount - 4, mutant: 1 }; // >8 人:说明书没有,按 8 人延展
}

// 纯函数:命中判定。ring = 桌上存活座位号(按座位顺序);opts = {shooter, target, mode:"single"|"spray", drawn:"1".."4"|"head"|"dud", bonus, shooterHero, targetEquips,
//   abyss:Set<座位>(处于深渊的座位), shooterEquips}
export function hitCheck(ringAll, opts) {
  const { shooter, target } = opts;
  const mode = opts.mode === "spray" ? "spray" : "single";
  const bonus = Number(opts.bonus) || 0;
  const abyss = opts.abyss || new Set();
  if (ringAll.indexOf(Number(shooter)) < 0 || ringAll.indexOf(Number(target)) < 0) return { error: "NOT_ON_TABLE" };
  if (Number(shooter) === Number(target)) return { error: "SELF_SHOT" };
  const sIn = abyss.has(Number(shooter)), tIn = abyss.has(Number(target));
  if (sIn !== tIn) { // 不同空间:只有装备【悖论视界】的点射能打,且「精准」直接命中
    if (mode === "single" && (opts.shooterEquips || []).includes("beilun")) {
      const helmet0 = (opts.targetEquips || []).includes("toukui");
      const dmg = 1 + (tIn ? 1 : 0);
      const r = { between: 0, mod: 0, mode, drawn: "", hit: true, exact: false, damage: dmg, notes: ["悖论视界:跨空间点射,精准 —— 目标不翻滚则不判定直接命中"], crossSpace: true };
      if (tIn) r.notes.push("目标处于深渊:射击伤害 +1");
      if (helmet0) r.notes.push("偏折头盔只防扫射与爆头,精准点射照常");
      return r;
    }
    return { error: "DIFF_SPACE" };
  }
  const ring = ringAll.filter((n) => abyss.has(n) === sIn); // 只数同空间的角色
  const i = ring.indexOf(Number(shooter)), j = ring.indexOf(Number(target));
  const n = ring.length, d = Math.abs(i - j);
  const between = Math.max(0, Math.min(d, n - d) - 1); // 最短路上隔着的角色数
  const mod = -between - (mode === "spray" ? 2 : 0) + bonus;
  const helmet = (opts.targetEquips || []).includes("toukui");
  let drawn = String(opts.drawn || "");
  if (drawn === "4" && opts.shooterHero === HERO_LVBU) drawn = "head"; // 吕布:4 点视为爆头
  const r = { between, mod, mode, drawn, hit: false, exact: false, damage: 0, notes: [] };
  if (drawn === "head") {
    r.hit = true; r.damage = 2; r.notes.push("爆头:无视修正直接命中,伤害 +1");
    if (opts.shooterHero === HERO_LVBU) r.notes.push("吕布〖死亡宣告〗:真正的爆头直接杀死目标(4 点视为爆头的不算)");
  } else if (drawn === "dud") {
    r.hit = false; r.notes.push("哑火:无视修正,未命中");
  } else {
    const p = Number(drawn);
    if (!(p >= 1 && p <= 4)) return { error: "BAD_DRAWN" };
    r.points = p + mod;
    r.hit = r.points > 0; r.exact = r.points === 1; r.damage = r.hit ? 1 : 0;
    if (r.exact) r.notes.push("恰好命中(修正后 1 点):甄宓〖幸运一击〗/ 司马懿〖时空赝品〗相关");
  }
  if (opts.shooterHero === HERO_SUNLUBAN) { // 孙鲁班:结果反转
    r.hit = !r.hit; r.damage = r.hit ? (drawn === "dud" ? 2 : 1) : 0;
    r.notes.push("孙鲁班〖翻云覆雨〗:结果反转" + (drawn === "head" ? "(爆头→哑火)" : drawn === "dud" ? "(哑火→爆头)" : ""));
  }
  if (helmet && (mode === "spray" || drawn === "head")) { r.hit = false; r.damage = 0; r.notes.push("偏折头盔:扫射与爆头对目标无效"); }
  if (r.hit && tIn) { r.damage += 1; r.notes.push("目标处于深渊:射击伤害 +1"); }
  if (sIn) r.notes.push("双方都在深渊:只数深渊内的角色算隔人");
  return r;
}

export class QmxyCore extends RoomBase {
  static MIN_SEATS = 3;
  static MAX_SEATS = 8;

  constructor(roomCode, seatCount, rng = Math.random) {
    super(roomCode, seatCount, rng);
    this._resetRoom();
  }

  _newSeat(i) {
    return { seatNo: i, holderDevices: [],
      npc: null,            // null | "zhan" | "jinbi":NPC 机器人座位(不发身份/角色,不行动)
      offers: [],           // 角色候选(仅本人可见)
      heroId: null,         // 选定角色
      heroRevealed: false,  // 角色是否已亮出(脑选完即亮;其余 startGame/revealHeroes 时亮)
      identity: null,       // "brain"|"immune"|"virus"|"mutant"(脑公开;其余本人/阵亡/结束可见)
      hp: 0, ammo: 0,       // 当前血量 / 当前子弹(公开台账)
      mods: { hp: 0, supply: 0, ammo: 0 }, // 手动修正(装备以外的上限变化)
      swap: false,          // 自我遥控器:角色牌补给数与子弹上限互换
      equips: [],           // 装备区 [cardKey](最多 3,黄月英不限)
      delays: [],           // 面前的延时牌 [cardKey](不能有两张同名)
      abyss: false,         // 处于深渊(扩展《雾区·呓语》:角色牌横置;受射击伤害 +1;不同空间不能互射)
      dying: false, dead: false, killedBy: null };
  }

  _resetRoom() {
    this.phase = "setup";           // setup | play | over
    this.pack = "base";             // 角色池:base 基础包 24 将 | all 含扩展《雾区·呓语》(pack:"wuqu")
    this.idCounts = defaultIdCounts(this._playerSeats().length);
    this.turn = null;               // 当前回合座位
    this.round = 0;                 // 轮数(王莽第一轮不行动)
    this.protocol = true;           // 安全协议:生效=每回合只能用一张射击牌;首个角色死亡后解除
    this.result = null;             // { winners:[座位], reason }
    this.log = [];
  }

  _log(msg) { this.log.unshift(msg); if (this.log.length > 200) this.log.pop(); }
  _name(n) { const s = this.seats[n]; return n + "号" + (s?.npc ? "(NPC)" : ""); }
  _playerSeats() { return this.seatNos().filter((n) => !this.seats[n].npc); }
  _alivePlayers() { return this._playerSeats().filter((n) => !this.seats[n].dead); }
  _ring() { return this.seatNos().filter((n) => !this.seats[n].dead); } // 桌上还在的角色(含 NPC)
  _abyssSet() { return new Set(this.seatNos().filter((n) => this.seats[n].abyss && !this.seats[n].dead)); }
  _pool() { return HEROES.filter((h) => this.pack === "all" || !h.pack || h.pack === "base"); }
  // 至高之脑固定坐 1 号:把整桌座位(含 NPC、持有者)按原顺序循环平移,使脑成为 1 号。返回 {from, shift} 或 null(已是 1 号/没有脑)。
  _rotateBrainToSeat1() {
    const brain = this._brainSeat();
    const nos = this.seatNos(); const N = nos.length;
    if (brain == null || brain === 1 || N < 2) return null;
    const shift = brain - 1; // 旧号 → 新号:((old - brain) mod N) + 1
    const next = {};
    for (const old of nos) { const nn = ((old - brain + N) % N) + 1; const st = this.seats[old]; st.seatNo = nn; next[nn] = st; }
    this.seats = next;
    for (const d of Object.values(this.devices)) d.holds = new Set([...d.holds].map((old) => ((old - brain + N) % N) + 1));
    if (this.turn != null) this.turn = ((this.turn - brain + N) % N) + 1;
    this._log(`至高之脑固定为 1 号位:全桌座位按原顺序平移(原 ${brain} 号 → 1 号,其余依次顺延)`);
    return { from: brain, shift };
  }
  _brainSeat() { return this.seatNos().find((n) => this.seats[n].identity === "brain") ?? null; }

  addSeat(id) { const r = super.addSeat(id); if (r.ok) this.idCounts = defaultIdCounts(this._playerSeats().length); return r; }
  removeSeat(id) { const r = super.removeSeat(id); if (r.ok) this.idCounts = defaultIdCounts(this._playerSeats().length); return r; }

  // ───────── 超意识 ─────────
  // 身份配置中病毒数 > 脑 + 免疫官数 → 超意识生效(血量/补给/子弹上限各 +1),持有者=脑;
  // 脑与异变单挑(存活玩家恰好只剩这两人)→ 异变夺走超意识。
  superMind() {
    const c = this.idCounts;
    const active = c.virus > c.brain + c.immune;
    if (!active) return { active: false, holder: null };
    const alive = this._alivePlayers();
    const brain = this._brainSeat();
    const mutant = alive.find((n) => this.seats[n].identity === "mutant");
    if (brain != null && mutant != null && alive.length === 2 && alive.includes(brain)) return { active: true, holder: mutant, seized: true };
    return { active: true, holder: brain, seized: false };
  }

  // 座位的上限三属性:角色牌(或 NPC)→ 自我遥控器互换 → 装备 → 超意识 → 手动修正
  stats(n) {
    const s = this.seats[n];
    let hp = 0, supply = 0, ammo = 0;
    if (s.npc) hp = NPCS[s.npc].hp;
    else if (s.heroId != null && HERO_BY_ID[s.heroId]) { const h = HERO_BY_ID[s.heroId]; hp = h.hp; supply = h.supply; ammo = h.ammo; }
    if (s.swap) [supply, ammo] = [ammo, supply];
    for (const k of s.equips) { const m = CARD_BY_KEY[k]?.mod; if (m) { hp += m.hp || 0; supply += m.supply || 0; ammo += m.ammo || 0; } }
    const sm = this.superMind();
    if (sm.active && sm.holder === n) { hp++; supply++; ammo++; }
    hp += s.mods.hp; supply += s.mods.supply; ammo += s.mods.ammo;
    return { hp: Math.max(0, hp), supply: Math.max(0, supply), ammo: Math.max(0, ammo) };
  }

  // ───────── 动作 ─────────
  action(id, msg) {
    if (!this.devices[id]) return { error: "NO_DEVICE" };
    const op = msg.op;
    const seatNo = Number(msg.seatNo);
    const s = this.seats[seatNo];
    const holder = s && this.isHolder(id, seatNo);
    const needSeat = () => (!s ? { error: "BAD_SEAT" } : null);
    const overGuard = () => (this.phase === "over" ? { error: "GAME_OVER" } : null);
    const setupGuard = () => (this.phase !== "setup" ? { error: "NOT_SETUP" } : null);

    switch (op) {
      // ── 开局设置(任意玩家可点;都是公开操作)──
      case "setNpc": { // 把某座位标成 NPC 机器人(3 人局玩家间各放 1 个)/ 取消
        const e = needSeat() || setupGuard(); if (e) return e;
        const k = msg.npc == null || msg.npc === "" ? null : String(msg.npc);
        if (k && !NPCS[k]) return { error: "BAD_NPC" };
        s.npc = k; s.offers = []; s.heroId = null; s.heroRevealed = false; s.identity = null;
        s.hp = k ? NPCS[k].hp : 0; s.ammo = 0;
        this.idCounts = defaultIdCounts(this._playerSeats().length);
        this._log(k ? `${seatNo}号设为 NPC:${NPCS[k].name}` : `${seatNo}号取消 NPC`);
        return { ok: true };
      }
      case "setPack": {
        if (!["base", "all"].includes(msg.pack)) return { error: "BAD_PACK" };
        this.pack = msg.pack; this._log(`角色池切换为「${msg.pack === "base" ? "基础包" : "基础包 + 雾区·呓语"}」`);
        return { ok: true };
      }
      case "setIdCounts": {
        const c = {};
        for (const k of ID_KEYS) { const v = Math.round(Number(msg[k])); if (!Number.isFinite(v) || v < 0 || v > 8) return { error: "BAD_COUNTS" }; c[k] = v; }
        if (c.brain !== 1) return { error: "ONE_BRAIN" };
        this.idCounts = c;
        return { ok: true };
      }
      case "dealIdentities": { // 系统随机发身份(配比总数 = 玩家座位数);脑公开
        const g = setupGuard(); if (g) return g;
        const players = this._playerSeats();
        const c = this.idCounts;
        if (c.brain + c.immune + c.virus + c.mutant !== players.length) return { error: "COUNT_MISMATCH" };
        const ids = shuffle([...Array(c.brain).fill("brain"), ...Array(c.immune).fill("immune"), ...Array(c.virus).fill("virus"), ...Array(c.mutant).fill("mutant")], this.rng);
        players.forEach((n, i) => { this.seats[n].identity = ids[i]; });
        const b = this._brainSeat();
        this._log(`系统发身份:脑 ${c.brain} · 免疫官 ${c.immune} · 病毒 ${c.virus} · 异变 ${c.mutant};至高之脑是 ${this._name(b)}`);
        this._rotateBrainToSeat1();
        return { ok: true };
      }
      case "setIdentity": { // 本人登记(用实体身份牌时)
        const e = needSeat(); if (e) return e;
        if (!holder) return { error: "NOT_HOLDER" };
        if (s.npc) return { error: "IS_NPC" };
        if (msg.identity == null || msg.identity === "") { s.identity = null; return { ok: true }; }
        if (!IDENTITIES[msg.identity]) return { error: "BAD_IDENTITY" };
        if (msg.identity === "brain") for (const n of this.seatNos()) if (n !== seatNo && this.seats[n].identity === "brain") this.seats[n].identity = null; // 只能有一个脑
        s.identity = msg.identity;
        this._log(msg.identity === "brain" ? `${this._name(seatNo)}登记为至高之脑(公开)` : `${this._name(seatNo)}登记了身份`); // 非脑不写内容
        if (msg.identity === "brain" && this.phase === "setup") this._rotateBrainToSeat1();
        return { ok: true };
      }
      case "dealHeroes": { // 每名玩家发候选:脑 3+2 张,其余 3 张(24 将不够时按人数缩减);覆盖上一轮候选与已选角色
        const g = setupGuard(); if (g) return g;
        const players = this._playerSeats();
        const brain = this._brainSeat();
        const all = this._pool();
        const per = Math.max(1, Math.min(3, Math.floor((all.length - (brain != null ? BRAIN_EXTRA_OFFERS : 0)) / players.length)));
        const pool = shuffle(all, this.rng).map((h) => h.id);
        let at = 0;
        for (const n of players) {
          const k = per + (n === brain ? BRAIN_EXTRA_OFFERS : 0);
          const st = this.seats[n];
          st.offers = pool.slice(at, at + k); at += k;
          st.heroId = null; st.heroRevealed = false;
        }
        this._log(`发角色:每人 ${per} 选 1` + (brain != null ? `,至高之脑 ${per + BRAIN_EXTRA_OFFERS} 选 1(先选先亮)` : ""));
        return { ok: true };
      }
      case "pickHero": { // 本人从候选里选;没有候选时(用实体牌选角)可直接登记任意角色。脑选完即亮,其余等 startGame/revealHeroes
        const e = needSeat(); if (e) return e;
        if (!holder) return { error: "NOT_HOLDER" };
        if (s.npc) return { error: "IS_NPC" };
        const hid = Number(msg.heroId);
        const h = HERO_BY_ID[hid]; if (!h) return { error: "BAD_HERO" };
        if (s.offers.length && !s.offers.includes(hid)) return { error: "NOT_OFFERED" };
        // 同一角色只有一张实体牌:只拦「别人已亮出」的同名(未亮的不查,否则拒绝本身就泄露)
        if (this.seatNos().some((n) => n !== seatNo && this.seats[n].heroId === hid && this.seats[n].heroRevealed)) return { error: "HERO_TAKEN" };
        s.heroId = hid; s.offers = [];
        s.heroRevealed = s.identity === "brain" || this.phase !== "setup";
        this._log(s.heroRevealed ? `${this._name(seatNo)}选定角色:${h.name}` : `${this._name(seatNo)}选定了角色(未亮)`);
        return { ok: true };
      }
      case "clearHero": {
        const e = needSeat(); if (e) return e;
        if (!holder) return { error: "NOT_HOLDER" };
        s.heroId = null; s.heroRevealed = false;
        return { ok: true };
      }
      case "revealHeroes": { // 全员同时亮出角色
        for (const n of this._playerSeats()) if (this.seats[n].heroId != null) this.seats[n].heroRevealed = true;
        this._log("全员亮出角色:" + this._playerSeats().filter((n) => this.seats[n].heroId != null).map((n) => `${n}号 ${HERO_BY_ID[this.seats[n].heroId].name}`).join("、"));
        return { ok: true };
      }
      case "startGame": { // 进入对局:亮角色、血量/子弹填满、安全协议生效;默认至高之脑先手
        const g = setupGuard(); if (g) return g;
        const players = this._playerSeats();
        if (players.length < 2) return { error: "TOO_FEW_PLAYERS" };
        const first = Number(msg.first) || this._brainSeat() || players[0];
        if (!this.seats[first] || this.seats[first].npc) return { error: "BAD_SEAT" };
        for (const n of this.seatNos()) {
          const st = this.seats[n];
          if (!st.npc && st.heroId != null) st.heroRevealed = true;
          const t = this.stats(n); st.hp = t.hp; st.ammo = t.ammo; st.dying = false; st.dead = false; st.killedBy = null;
        }
        this.phase = "play"; this.turn = first; this.round = 1; this.protocol = true;
        this._log(`对局开始,${this._name(first)}先手。安全协议生效:每回合只能用一张射击牌`);
        return { ok: true };
      }

      // ── 对局中的公开台账(任意玩家可改)──
      case "adjHp": { // 扣血/回血;血量 ≤0 进入濒死(NPC 直接死亡)
        const e = needSeat() || overGuard(); if (e) return e;
        if (s.dead) return { error: "DEAD" };
        const d = Math.round(Number(msg.delta)); if (!d) return { error: "BAD_DELTA" };
        const max = this.stats(seatNo).hp;
        s.hp = Math.min(max, s.hp + d);
        this._log(`${this._name(seatNo)}${d > 0 ? "回复" : "受到"} ${Math.abs(d)} 点 → 血量 ${s.hp}/${max}`);
        if (s.hp <= 0) {
          if (s.npc) return this._die(seatNo, msg.killer != null ? Number(msg.killer) : null);
          if (!s.dying) { s.dying = true; this._log(`⚠ ${this._name(seatNo)}进入濒死:可用【补丁】救,否则确认死亡`); }
        } else if (s.dying) { s.dying = false; this._log(`${this._name(seatNo)}脱离濒死`); }
        return { ok: true };
      }
      case "adjAmmo": { // 消耗/获得子弹;允许暂时超过上限(化血为剑),下个摸牌阶段调整
        const e = needSeat() || overGuard(); if (e) return e;
        if (s.dead) return { error: "DEAD" };
        const d = Math.round(Number(msg.delta)); if (!d) return { error: "BAD_DELTA" };
        const max = this.stats(seatNo).ammo;
        s.ammo = Math.max(0, Math.min(max + 3, s.ammo + d));
        this._log(`${this._name(seatNo)}子弹 ${d > 0 ? "+" : ""}${d} → ${s.ammo}/${max}`);
        return { ok: true };
      }
      case "refillAmmo": { // 回合开始:子弹调整至上限
        const e = needSeat() || overGuard(); if (e) return e;
        if (s.dead) return { error: "DEAD" };
        s.ammo = this.stats(seatNo).ammo;
        this._log(`${this._name(seatNo)}子弹补满 → ${s.ammo}`);
        return { ok: true };
      }
      case "setMods": { // 手动修正上限(技能/临时效果)
        const e = needSeat(); if (e) return e;
        const m = {};
        for (const k of ["hp", "supply", "ammo"]) { const v = Math.round(Number(msg[k] ?? s.mods[k])); if (!Number.isFinite(v) || Math.abs(v) > 9) return { error: "BAD_MOD" }; m[k] = v; }
        s.mods = m;
        this._clampHp(seatNo);
        this._log(`${this._name(seatNo)}上限修正:血量${m.hp >= 0 ? "+" : ""}${m.hp} 补给${m.supply >= 0 ? "+" : ""}${m.supply} 子弹${m.ammo >= 0 ? "+" : ""}${m.ammo}`);
        return { ok: true };
      }
      case "toggleSwap": { // 自我遥控器:补给数与子弹上限互换
        const e = needSeat(); if (e) return e;
        s.swap = !s.swap; this._clampHp(seatNo);
        this._log(`${this._name(seatNo)}${s.swap ? "被自我遥控器互换补给与子弹上限" : "取消补给/子弹互换"}`);
        return { ok: true };
      }
      case "addEquip": {
        const e = needSeat() || overGuard(); if (e) return e;
        const c = CARD_BY_KEY[msg.card]; if (!c || c.type !== "equip") return { error: "BAD_CARD" };
        if (s.equips.length >= 3 && s.heroId !== HERO_HUANGYUEYING) return { error: "EQUIP_FULL" };
        s.equips.push(c.key); this._clampHp(seatNo);
        this._log(`${this._name(seatNo)}装备【${c.name}】`);
        return { ok: true };
      }
      case "removeEquip": {
        const e = needSeat() || overGuard(); if (e) return e;
        const i = s.equips.indexOf(msg.card); if (i < 0) return { error: "BAD_CARD" };
        s.equips.splice(i, 1); this._clampHp(seatNo);
        this._log(`${this._name(seatNo)}失去装备【${CARD_BY_KEY[msg.card].name}】` + (msg.card === "aida" ? "(挨打机器人离开:摸两张)" : ""));
        return { ok: true };
      }
      case "addDelay": { // 延时牌放到某人面前;同名不能有两张
        const e = needSeat() || overGuard(); if (e) return e;
        const c = CARD_BY_KEY[msg.card]; if (!c || c.type !== "delay") return { error: "BAD_CARD" };
        if (s.delays.includes(c.key)) return { error: "DUP_DELAY" };
        s.delays.push(c.key);
        this._log(`【${c.name}】放置于${this._name(seatNo)}面前`);
        return { ok: true };
      }
      case "removeDelay": { // 引爆/失效/被剥离/无懈
        const e = needSeat() || overGuard(); if (e) return e;
        const i = s.delays.indexOf(msg.card); if (i < 0) return { error: "BAD_CARD" };
        s.delays.splice(i, 1);
        this._log(`${this._name(seatNo)}面前的【${CARD_BY_KEY[msg.card].name}】${msg.how === "explode" ? "引爆" : "移除"}`);
        return { ok: true };
      }
      case "toggleAbyss": { // 进入/离开深渊(坍缩/捕食/次元裂缝/技能):角色牌横置
        const e = needSeat() || overGuard(); if (e) return e;
        if (s.dead) return { error: "DEAD" };
        s.abyss = !s.abyss;
        this._log(`${this._name(seatNo)}${s.abyss ? "进入深渊(角色牌横置,受射击伤害 +1)" : "离开深渊"}`);
        return { ok: true };
      }
      case "logShot": { // 命中判定辅助:算修正、记结果(公开)
        const g = overGuard(); if (g) return g;
        const sh = Number(msg.shooter), tg = Number(msg.target);
        if (!this.seats[sh] || !this.seats[tg]) return { error: "BAD_SEAT" };
        const r = hitCheck(this._ring(), { shooter: sh, target: tg, mode: msg.mode, drawn: msg.drawn, bonus: msg.bonus,
          shooterHero: this.seats[sh].heroId, targetEquips: this.seats[tg].equips, shooterEquips: this.seats[sh].equips, abyss: this._abyssSet() });
        if (r.error) return r;
        const dn = r.drawn === "head" ? "爆头" : r.drawn === "dud" ? "哑火" : r.drawn ? r.drawn + "点" : "不判定";
        this._log(`🔫 ${this._name(sh)} ${r.mode === "spray" ? "扫射" : "点射"} ${this._name(tg)}:` + (r.crossSpace ? "悖论视界跨空间精准 → " : `翻出${dn},修正 ${r.mod >= 0 ? "+" : ""}${r.mod}(隔 ${r.between} 人)→ `) + `${r.hit ? "命中" + (r.damage > 1 ? " 伤害 " + r.damage : "") : "未命中"}`);
        return { ok: true, result: r };
      }
      case "confirmDeath": { // 濒死无人救 → 死亡:亮身份、清区域、奖惩、首死解除安全协议、判终局
        const e = needSeat() || overGuard(); if (e) return e;
        if (s.dead) return { error: "DEAD" };
        return this._die(seatNo, msg.killer != null && msg.killer !== "" ? Number(msg.killer) : null);
      }
      case "revive": { // 误操作撤销
        const e = needSeat() || overGuard(); if (e) return e;
        if (!s.dead) return { error: "NOT_DEAD" };
        s.dead = false; s.dying = s.hp <= 0 && !s.npc; s.killedBy = null;
        if (s.hp <= 0 && s.npc) s.hp = 1;
        this._log(`${this._name(seatNo)}撤销死亡`);
        return { ok: true };
      }
      case "setProtocol": {
        const g = overGuard(); if (g) return g;
        this.protocol = !!msg.on;
        this._log(this.protocol ? "安全协议恢复生效" : "安全协议解除:射击牌无次数限制,点射/扫射可互转");
        return { ok: true };
      }
      case "setTurn": {
        const e = needSeat() || overGuard(); if (e) return e;
        if (s.npc) return { error: "IS_NPC" };
        this.turn = seatNo;
        this._log(`回合 → ${this._name(seatNo)}`);
        return { ok: true };
      }
      case "nextTurn": { // 按座位号顺序跳到下一名存活玩家(跳过 NPC 与阵亡);绕回去算新一轮
        const g = overGuard(); if (g) return g;
        const alive = this._alivePlayers(); if (!alive.length) return { error: "NO_ALIVE" };
        const cur = this.turn ?? 0;
        let nx = alive.find((n) => n > cur);
        if (nx == null) { nx = alive[0]; this.round++; }
        this.turn = nx;
        this._log(`回合 → ${this._name(nx)}` + (nx === alive[0] ? `(第 ${this.round} 轮)` : ""));
        return { ok: true };
      }

      // ── 结束 ──
      case "forceEnd": {
        const g = overGuard(); if (g) return g;
        const winners = (msg.winners || []).map(Number).filter((n) => this.seats[n]);
        this._end(winners, "手动结算" + (msg.note ? ":" + String(msg.note).slice(0, 60) : ""));
        return { ok: true };
      }
      case "newGame": { // 再来一局:清角色/身份/台账,保留座位、持有者、NPC 标记、配比
        const keep = { idCounts: this.idCounts, pack: this.pack };
        for (const n of this.seatNos()) {
          const old = this.seats[n]; const ns = this._newSeat(n);
          ns.holderDevices = old.holderDevices; ns.npc = old.npc; ns.hp = old.npc ? NPCS[old.npc].hp : 0;
          this.seats[n] = ns;
        }
        this._resetRoom(); Object.assign(this, keep);
        this._log("新的一局");
        return { ok: true };
      }
    }
    return { error: "UNKNOWN_OP" };
  }

  _clampHp(n) { const s = this.seats[n]; const max = this.stats(n).hp; if (this.phase === "play" && s.hp > max) s.hp = max; }

  _die(n, killer) {
    const s = this.seats[n];
    s.dead = true; s.dying = false; s.killedBy = killer;
    const who = this._name(n);
    const k = killer != null && this.seats[killer] ? this.seats[killer] : null;
    let line = `✝ ${who}死亡` + (k ? `(被 ${this._name(killer)} 杀死)` : "");
    if (!s.npc) line += `,亮出身份:${IDENTITIES[s.identity]?.name || "未登记"}`;
    line += ";弃置其所有牌";
    const rewards = [];
    if (k && (s.identity === "virus" || s.npc === "jinbi")) rewards.push(`${this._name(killer)}摸三张牌`);
    if (k && k.identity === "brain" && s.identity === "immune") rewards.push(`至高之脑杀死免疫官:${this._name(killer)}弃置所有牌`);
    if (rewards.length) line += "。奖惩:" + rewards.join(";");
    s.equips = []; s.delays = []; s.abyss = false;
    this._log(line);
    if (this.protocol) { this.protocol = false; this._log("🔓 首个角色死亡,安全协议解除:射击牌无次数限制,点射/扫射可互转"); }
    const sm = this.superMind();
    if (sm.seized) this._log(`脑与异变单挑:超意识被 ${this._name(sm.holder)} 夺走`);
    this._checkEnd();
    return { ok: true };
  }

  _checkEnd() {
    const players = this._playerSeats();
    const alive = this._alivePlayers();
    const idOf = (n) => this.seats[n].identity;
    const brain = this._brainSeat();
    if (brain != null && this.seats[brain].dead) {
      const mutants = alive.filter((n) => idOf(n) === "mutant");
      if (alive.length === 1 && mutants.length === 1) return this._end(mutants, "至高之脑死亡,异变是唯一存活者:异变获胜");
      return this._end(players.filter((n) => idOf(n) === "virus"), "至高之脑死亡:病毒获胜");
    }
    const threats = players.filter((n) => ["virus", "mutant"].includes(idOf(n)));
    if (threats.length && threats.every((n) => this.seats[n].dead))
      return this._end(players.filter((n) => ["brain", "immune"].includes(idOf(n))), "所有病毒与异变死亡:至高之脑与免疫官获胜");
  }

  _end(winners, reason) {
    this.phase = "over";
    this.result = { winners, reason };
    this._log(`🏁 本局结束:${reason}。胜者 ${winners.map((n) => this._name(n)).join("、") || "无"}`);
  }

  // ───────── 视图(保密过滤)─────────
  _seatView(s, holds) {
    const mine = holds.has(s.seatNo);
    const open = this.phase === "over";
    const v = { seatNo: s.seatNo, holderDevices: s.holderDevices.slice(), npc: s.npc,
      hp: s.hp, ammo: s.ammo, stats: this.stats(s.seatNo), mods: clone(s.mods), swap: s.swap,
      equips: s.equips.slice(), delays: s.delays.slice(), abyss: !!s.abyss, dying: !!s.dying, dead: !!s.dead, killedBy: s.killedBy,
      heroRevealed: !!s.heroRevealed, hasHero: s.heroId != null, hasIdentity: !!s.identity };
    v.heroId = (s.heroId != null && (s.heroRevealed || mine || open)) ? s.heroId : null;
    v.identity = (s.identity && (mine || open || s.dead || s.identity === "brain")) ? s.identity : null;
    if (mine) v.offers = s.offers.slice(); else v.offerCount = s.offers.length;
    return v;
  }
  _roomView() {
    return { game: "qmxy", phase: this.phase, pack: this.pack, idCounts: clone(this.idCounts), playerCount: this._playerSeats().length,
      turn: this.turn, round: this.round, protocol: this.protocol, superMind: this.superMind(), brainSeat: this._brainSeat(),
      result: clone(this.result), log: this.log.slice(0, 80) };
  }
  _serializeExtra() {
    return { qmxy: { phase: this.phase, pack: this.pack, idCounts: this.idCounts, turn: this.turn, round: this.round, protocol: this.protocol, result: this.result, log: this.log } };
  }
  _hydrateExtra(data) { if (data.qmxy) Object.assign(this, data.qmxy); }
}
