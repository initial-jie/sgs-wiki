// 一夜终极狼人房间核心逻辑(线上/线下通用:系统发牌、按黄昏/夜晚顺序逐角色"睁眼"、行动直接在 UI 里完成、天亮后多轮发言 + 限时投票 + 自动结算)。
// 被 onuw/onuw-sim.mjs(node 断言)与 onuw/worker.mjs(Durable Object)共用;座位/设备骨架继承 common/room-base.mjs。
//
// 保密模型(按设备持有的座位过滤,见 _seatView/_roomView):
//   - 初始角色 initRole 仅本人可见;当前牌 card 与印记 mark 整局对所有人(包括本人)保密 —— 只有通过行动获得的"笔记"(notes)本人可见;结算后全公开。
//   - 中央牌内容保密,结算后公开。护盾 / 被揭露者翻开的牌 / 是否有印记 / 是否已投票 公开。神器:持有者天亮后可看,结算后公开。
//   - 阶段只公开"现在轮到哪个角色",不公开谁在行动;各设备只看到自己持有座位的行动面板(night.me)。
//
// 时间:没有服务端定时器,服务端只记 startedAt;客户端按 serverNow 倒计时,到点发 tick,服务端 tick() 校验后推进(幂等)。
//   每阶段至少 phaseSec 秒(无该角色玩家也等这么久,不泄露信息);有行动者未完成则最多等到 phaseMaxSec(0=一直等)。
//   播报门控:开局的设备是播报员(narrator);它念完本阶段播报后发 narrDone,阶段计时从 narrDoneAt 起算;播报员 45s 没回报(关了页面)则按 startedAt 起算。
//   顺序发言 perSpeakSec(0=不限时,手动结束);自由讨论 freeSec(0=人数×60);投票 voteSec,超时=弃票。
//
// 扩展:Daybreak(护盾/神器)、Bonus Roles(气场预言家/王子/被诅咒者/那东西/旁观者/侍从/皮匠学徒/诺查丹玛斯)、
//       Vampire(黄昏阶段 order<0、印记 mark、模仿者、吸血鬼阵营;与狼人同场按 Epic Battle 规则:每个在场的邪恶阵营都得死人村民才赢,邪恶阵营要自己不死且对方死人)。
//
// 动作:core.action(deviceId, {op, ...}):setRoles / setConfig / startGame / nightAct{seatNo,kind,…} / nightAdvance{force} / dayNext{force} / startVote / vote{seatNo,target} / closeVote{force} / newGame / tick

import { RoomBase, clone } from "../../common/room-base.mjs";
import { ROLE_BY_KEY, NIGHT_ORDER, WOLF_ROLES, VAMP_ROLES, WAKE_WOLVES, DG_IMMEDIATE, DG_GROUP, MANDATORY, ARTIFACTS, ARTIFACT_BY_KEY, MARK_BY_KEY, defaultRoles } from "./onuw-data.mjs";

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const rn = (k) => (ROLE_BY_KEY[k] ? ROLE_BY_KEY[k].name : k);
const mn = (k) => (k && MARK_BY_KEY[k] ? MARK_BY_KEY[k].name : "没有印记");
const TEAM_NAME = { village: "村民", werewolf: "狼人", vampire: "吸血鬼", tanner: "皮匠", indep: "独立" };

export const NARR_TIMEOUT_MS = 45 * 1000; // 播报员失联兜底

export function defaultConfig() {
  return {
    phaseSec: 10, phaseMaxSec: 30,
    rounds: [{ mode: "order" }, { mode: "free" }, { mode: "order" }],
    perSpeakSec: 0, freeSec: 0, anchor: true,
    voteSec: 60,
  };
}

export class OnuwCore extends RoomBase {
  static MIN_SEATS = 3;
  static MAX_SEATS = 16; // 规则 3~10 人,但扩展后用户常 8~16 人

  constructor(roomCode, seatCount, rng = Math.random, now = () => Date.now()) {
    super(roomCode, seatCount, rng);
    this.now = now;
    this.roles = defaultRoles(this.seatNos().length);
    this.config = defaultConfig();
    this._resetGame();
  }

  _newSeat(i) {
    return { seatNo: i, holderDevices: [],
      initRole: null,   // 发到的角色(本人可见)
      card: null,       // 当前面前的牌(整局保密)
      mark: null,       // 印记 key(整局保密;是否有印记公开)
      shield: false,    // 哨兵护盾(公开)
      revealed: null,   // 揭露者翻开的牌(公开)
      artifact: null,   // 馆长放的神器 key(持有者天亮后可看)
      notes: [],        // 行动获得的信息 [{phase,text,cards:[{kind:"seat"|"center"|"mark",no,role}]}](本人可见)
      vote: null };     // 投票目标(结算前本人可见,他人只见是否已投)
  }
  _clearSeat(s) { Object.assign(s, { initRole: null, card: null, mark: null, shield: false, revealed: null, artifact: null, notes: [], vote: null }); }
  _resetGame() {
    this.phase = "setup";   // setup | night | day | vote | over
    this.center = [];       // 中央牌(3 张;有头狼则第 4 张=横放的狼人牌)
    this.wolfSlot = null;   // 头狼横牌在 center 里的下标
    this.night = null;      // { phases:[role], idx, startedAt, actors:[seat], acted:{seat:true}, sub:{seat:{…}} }
    this.day = null;        // { round, mode, order:[seat…], cur, startedAt, speakerStartedAt, anchorSeat }
    this.voting = null;     // { startedAt }
    this.result = null;
    this.dg = null;         // 化身幽灵 { seat, role, piRole, nostraTeam }
    this.copycat = null;    // 模仿者 { seat, role, piRole, nostraTeam }
    this.pi = null;         // 灵异侦探 { seat, found:null|"werewolf"|"vampire"|"tanner" }
    this.nostra = null;     // 诺查丹玛斯 { seat, team }
    this.vampTarget = null; // 吸血鬼们放置吸血鬼印记的目标(仁菲尔德看)
    this.touched = [];      // 查看/移动过牌或印记的座位(气场预言家看)
    this.dayNotice = null;  // 天亮时的公开宣布(诺查丹玛斯加入的阵营)
    this.narrator = this.narrator || null; // 播报员设备(开局者;可用 setNarrator 接管);跨局保留
    this.artifactDeck = [];
    this.log = [];          // 公开日志
    this.nightLog = [];     // 夜里发生了什么(结算后公开)
    for (const s of Object.values(this.seats)) this._clearSeat(s);
  }
  _log(msg) { this.log.unshift(msg); if (this.log.length > 200) this.log.pop(); }

  // 座位只在准备阶段可增减;若当前牌堆就是旧人数的推荐配置,增减后自动换成新人数的推荐配置(手动改过的不动)
  addSeat(id) { if (this.phase !== "setup") return { error: "NOT_SETUP" }; const was = this._isDefault(); const r = super.addSeat(id); if (r.ok && was) this.roles = defaultRoles(this.seatNos().length); return r; }
  removeSeat(id) { if (this.phase !== "setup") return { error: "NOT_SETUP" }; const was = this._isDefault(); const r = super.removeSeat(id); if (r.ok && was) this.roles = defaultRoles(this.seatNos().length); return r; }
  _isDefault() { const d = defaultRoles(this.seatNos().length); return d.length === this.roles.length && d.slice().sort().join() === this.roles.slice().sort().join(); }

  players() { return this.seatNos(); }
  deckSize() { return this.players().length + 3; }
  _neighbor(n, dir) { const s = this.seatNos(), i = s.indexOf(n); return s[(i + (dir === "right" ? 1 : s.length - 1)) % s.length]; }

  // ───────── 角色判定 ─────────
  // 一张牌代表的角色:化身幽灵牌=她复制的角色;模仿者牌=他复制的角色;灵异侦探牌=他看到的(狼/吸血鬼/皮匠)
  cardRole(card) {
    const chain = (holder) => {
      const r = holder.role;
      if (r === "pi") return holder.piRole || "pi";
      if (r === "copycat" && this.copycat) return chain(this.copycat);
      return r || card;
    };
    if (card === "doppelganger" && this.dg) return chain(this.dg);
    if (card === "copycat" && this.copycat) return chain(this.copycat);
    if (card === "pi" && this.pi && this.pi.found) return this.pi.found;
    return card;
  }
  // 结算时座位的最终角色:神器覆盖 > 牌
  finalRole(n) {
    const s = this.seats[n];
    const art = s.artifact && ARTIFACT_BY_KEY[s.artifact];
    if (art && art.becomes) return art.becomes;
    return this.cardRole(s.card);
  }
  teamOfRole(k) {
    if (k === "pi" || k === "doppelganger" || k === "copycat") return "village";
    if (k === "nostradamus") return "village";
    return ROLE_BY_KEY[k] ? ROLE_BY_KEY[k].team : "village";
  }
  // 诺查丹玛斯牌加入的阵营(牌可能在化身幽灵/模仿者手里)
  _nostraTeamOfCard(card) {
    if (card === "nostradamus") return this.nostra ? this.nostra.team : "village";
    if (card === "doppelganger" && this.dg && this.dg.role === "nostradamus") return this.dg.nostraTeam || "village";
    if (card === "copycat" && this.copycat && this.copycat.role === "nostradamus") return this.copycat.nostraTeam || "village";
    return "village";
  }
  // 座位 n 现在"是不是角色 role"(初始角色,或化身幽灵/模仿者复制了它)
  _hasRole(n, role) {
    const s = this.seats[n];
    if (s.initRole === role) return true;
    if (s.initRole === "doppelganger" && this.dg && this.dg.seat === n && this.dg.role === role) return true;
    if (s.initRole === "copycat" && this.copycat && this.copycat.seat === n && this.copycat.role === role) return true;
    return false;
  }
  _roleNow(n) { // 当前有效身份(用于狼人/吸血鬼互认)
    const s = this.seats[n];
    if (s.initRole === "doppelganger" && this.dg && this.dg.seat === n) return this.dg.role;
    if (s.initRole === "copycat" && this.copycat && this.copycat.seat === n) return this.copycat.role;
    return s.initRole;
  }
  _isWolfNow(n) { return WOLF_ROLES.has(this._roleNow(n)); }
  _isVampNow(n) { return VAMP_ROLES.has(this._roleNow(n)) || this.seats[n].mark === "vampire"; }
  _wolvesNow() { return this.seatNos().filter((n) => this._isWolfNow(n)); }
  _vampsNow() { return this.seatNos().filter((n) => this._isVampNow(n)); }
  _dgIs(n, role) { return this.seats[n].initRole === "doppelganger" && !!this.dg && this.dg.seat === n && this.dg.role === role; }
  _ccIs(n, role) { return this.seats[n].initRole === "copycat" && !!this.copycat && this.copycat.seat === n && this.copycat.role === role; }
  _touch(n) { if (!this.touched.includes(n)) this.touched.push(n); }

  // ───────── 动作分派 ─────────
  action(id, msg) {
    this.connect(id);
    switch (msg.op) {
      case "setRoles": return this._setRoles(msg.roles);
      case "recommendRoles": return this.phase !== "setup" ? { error: "NOT_SETUP" } : (this.roles = defaultRoles(this.seatNos().length), { ok: true });
      case "setConfig": return this._setConfig(msg.config);
      case "startGame": { this.narrator = id; return this._startGame(); }
      case "setNarrator": { this.narrator = id; return { ok: true }; }
      case "narrDone": return this._narrDone(id, msg);
      case "nightAct": return this._nightAct(id, msg);
      case "nightAdvance": return this._nightAdvance(!!msg.force);
      case "dayNext": return this._dayNext(id, !!msg.force);
      case "startVote": return this.phase === "day" ? (this._startVote(), { ok: true }) : { error: "NOT_DAY" };
      case "vote": return this._vote(id, msg);
      case "closeVote": return this._closeVote(!!msg.force);
      case "newGame": return (this._resetGame(), this._log("新的一局:回到准备阶段"), { ok: true });
      case "tick": return this.tick();
      default: return { error: "BAD_OP" };
    }
  }

  _setRoles(roles) {
    if (this.phase !== "setup") return { error: "NOT_SETUP" };
    if (!Array.isArray(roles)) return { error: "BAD_ROLES" };
    const count = {};
    for (const k of roles) {
      if (!ROLE_BY_KEY[k] || ROLE_BY_KEY[k].virtual) return { error: "BAD_ROLES" };
      count[k] = (count[k] || 0) + 1;
      if (count[k] > ROLE_BY_KEY[k].max) return { error: "ROLE_MAX" };
    }
    this.roles = roles.slice();
    return { ok: true };
  }
  _setConfig(c) {
    if (this.phase !== "setup") return { error: "NOT_SETUP" };
    if (!c || typeof c !== "object") return { error: "BAD_CONFIG" };
    const cfg = { ...this.config };
    const num = (k, lo, hi) => { if (c[k] !== undefined) { const v = Number(c[k]); if (!(v >= lo && v <= hi)) return false; cfg[k] = v; } return true; };
    if (!num("phaseSec", 3, 120) || !num("phaseMaxSec", 0, 600) || !num("perSpeakSec", 0, 900) || !num("freeSec", 0, 3600) || !num("voteSec", 10, 600)) return { error: "BAD_CONFIG" };
    if (c.anchor !== undefined) cfg.anchor = !!c.anchor;
    if (c.rounds !== undefined) {
      if (!Array.isArray(c.rounds) || !c.rounds.length || c.rounds.length > 6 || !c.rounds.every((r) => r && (r.mode === "order" || r.mode === "free"))) return { error: "BAD_CONFIG" };
      cfg.rounds = c.rounds.map((r) => ({ mode: r.mode }));
    }
    this.config = cfg;
    return { ok: true };
  }

  // ───────── 开局 ─────────
  _phasesFor(roles) {
    const has = (k) => roles.includes(k);
    return NIGHT_ORDER.filter((k) => {
      if (!ROLE_BY_KEY[k].narr) return false;                       // 吸血鬼之主没有单独阶段
      if (k === "werewolf") return roles.some((r) => WOLF_ROLES.has(r));
      if (k === "vampire") return roles.some((r) => VAMP_ROLES.has(r));
      if (k === "lovers") return has("cupid");
      return has(k);
    });
  }
  _startGame() {
    if (this.phase !== "setup") return { error: "NOT_SETUP" };
    const seats = this.players();
    if (seats.length < OnuwCore.MIN_SEATS) return { error: "TOO_FEW_PLAYERS" };
    if (this.roles.length !== seats.length + 3) return { error: "DECK_SIZE" };
    for (const s of Object.values(this.seats)) this._clearSeat(s);
    const deck = shuffle(this.roles, this.rng);
    seats.forEach((n, i) => { this.seats[n].initRole = deck[i]; this.seats[n].card = deck[i]; });
    this.center = deck.slice(seats.length);
    this.wolfSlot = null;
    if (this.roles.includes("alphawolf")) { this.center.push("werewolf"); this.wolfSlot = this.center.length - 1; }
    this.dg = null; this.copycat = null; this.pi = null; this.nostra = null; this.vampTarget = null; this.touched = []; this.dayNotice = null;
    this.result = null; this.day = null; this.voting = null;
    this.nightLog = [];
    this.artifactDeck = shuffle(ARTIFACTS.map((a) => a.key), this.rng);
    const phases = this._phasesFor(this.roles);
    this.phase = "night";
    this.night = { phases, idx: -1, startedAt: this.now(), actors: [], acted: {}, sub: {} };
    this._log(`开局:${seats.length} 人,牌堆 ${this.roles.map(rn).join("、")}${this.wolfSlot != null ? "(+ 头狼中央狼人牌)" : ""}`);
    this._enterPhase(0);
    return { ok: true };
  }

  // ───────── 黄昏 / 夜晚 ─────────
  _actors(role) {
    const seats = this.seatNos();
    switch (role) {
      case "werewolf": return seats.filter((n) => WAKE_WOLVES.has(this._roleNow(n)));
      case "vampire": return seats.filter((n) => VAMP_ROLES.has(this._roleNow(n)));
      case "lovers": return seats.filter((n) => this.seats[n].mark === "love");
      case "doppelganger": case "copycat": return seats.filter((n) => this.seats[n].initRole === role);
      default:
        return seats.filter((n) => this.seats[n].initRole === role || (DG_GROUP.has(role) && this._dgIs(n, role)) || this._ccIs(n, role));
    }
  }
  _note(n, text, cards) { this.seats[n].notes.push({ phase: this.night ? this.night.phases[this.night.idx] : null, text, cards: cards || [] }); }
  _seatCard(n) { return { kind: "seat", no: n, role: this.seats[n].card }; }
  _centerCard(i) { return { kind: "center", no: i, role: this.center[i] }; }
  _markCard(n) { return { kind: "mark", no: n, role: this.seats[n].mark }; }
  _list(arr) { return arr.map((x) => x + "号").join("、"); }
  _enterPhase(i) {
    const nt = this.night;
    if (i >= nt.phases.length) return this._startDay();
    nt.idx = i; nt.startedAt = this.now(); nt.narrDoneAt = null; nt.acted = {}; nt.sub = {};
    const role = nt.phases[i], isNight = ROLE_BY_KEY[role].order >= 0;
    nt.actors = this._actors(role);
    for (const n of nt.actors) {
      const sub = (nt.sub[n] = {});
      if (isNight && this.seats[n].mark === "fear") { // 恐惧印记:夜晚行动全部失效(黄昏不受影响)
        this._note(n, "你身上有恐惧印记,这个阶段无法行动。");
        nt.acted[n] = true; continue;
      }
      // 自动获得信息的阶段:直接写笔记并标记已完成
      if (role === "werewolf") {
        const wolves = this._wolvesNow();
        const others = wolves.filter((x) => x !== n);
        if (others.length) {
          this._note(n, "狼人同伴:" + others.map((x) => `${x}号(${rn(this._roleNow(x))}${this.seats[x].initRole === "dreamwolf" ? ",竖拇指" : ""})`).join("、"));
          nt.acted[n] = true;
        } else this._note(n, "你是场上唯一的狼人,可以查看一张中央牌。");
      } else if (role === "vampire") {
        const others = this._vampsNow().filter((x) => x !== n);
        this._note(n, (others.length ? "吸血鬼同伴:" + others.map((x) => `${x}号(${rn(this._roleNow(x))})`).join("、") : "你是唯一的吸血鬼。") + " 请任选一人给一名非吸血鬼玩家放置吸血鬼印记。");
      } else if (role === "count") {
        if (this.vampTarget == null && this._vampsNow().length) {} // 吸血鬼阶段没人放印记:伯爵仍要放恐惧印记
      } else if (role === "renfield") {
        const vamps = this._vampsNow().filter((x) => x !== n);
        this._note(n, (vamps.length ? "吸血鬼是:" + this._list(vamps) : "场上没有吸血鬼(都在中央),你属于村民阵营。") + (this.vampTarget != null ? ` 他们把吸血鬼印记给了 ${this.vampTarget}号。` : ""));
        this.seats[n].mark = "bat"; this._touch(n);
        this.nightLog.push(`仁菲尔德(${n}号)给自己放了蝙蝠印记`);
        nt.acted[n] = true;
      } else if (role === "priest") {
        this.seats[n].mark = "clarity"; this._touch(n);
        this._note(n, "你给自己放置了清明印记。还可以给另一名玩家放一枚。");
        this.nightLog.push(`牧师(${n}号)给自己放了清明印记`);
      } else if (role === "apprenticeassassin") {
        const ass = this.seatNos().filter((x) => x !== n && this._hasRole(x, "assassin"));
        if (ass.length) { this._note(n, "刺客是:" + this._list(ass)); nt.acted[n] = true; }
        else this._note(n, "场上没有刺客,由你来放置刺客印记。");
      } else if (role === "lovers") {
        const others = nt.actors.filter((x) => x !== n);
        this._note(n, others.length ? "你的恋人是:" + this._list(others) : "你持有爱之印记,但没有其他恋人。");
        nt.acted[n] = true;
      } else if (role === "minion") {
        const wolves = this._wolvesNow();
        this._note(n, wolves.length ? "狼人是:" + this._list(wolves) : "场上没有狼人(都在中央)。");
        nt.acted[n] = true;
      } else if (role === "apprenticetanner") {
        const t = this.seatNos().filter((x) => x !== n && this._hasRole(x, "tanner"));
        this._note(n, t.length ? "皮匠是:" + this._list(t) : "场上没有皮匠:你就按皮匠的规则,只有自己出局才赢。");
        nt.acted[n] = true;
      } else if (role === "mason") {
        const others = this._actors("mason").filter((x) => x !== n);
        this._note(n, others.length ? "另一名守夜人:" + this._list(others) : "没有其他守夜人睁眼,另一张守夜人在中央。");
        nt.acted[n] = true;
      } else if (role === "auraseer") {
        const t = this.touched.filter((x) => x !== n);
        this._note(n, t.length ? "竖起拇指(查看或移动过牌/印记)的玩家:" + this._list(t) : "没有人竖起拇指。");
        nt.acted[n] = true;
      } else if (role === "squire" || role === "beholder") {
        const targets = this.seatNos().filter((x) => x !== n && (role === "squire" ? this._isWolfNow(x) : (this._hasRole(x, "seer") || this._hasRole(x, "apprenticeseer"))));
        sub.targets = targets; sub.viewed = [];
        this._note(n, targets.length ? (role === "squire" ? "狼人是:" : "预言家/学徒是:") + this._list(targets) + ",你可以查看他们的牌。" : (role === "squire" ? "场上没有狼人:你要在自己存活且另有玩家出局时才获胜。" : "场上没有预言家和学徒。"));
        if (!targets.length) nt.acted[n] = true;
      } else if (role === "insomniac") {
        if (this.seats[n].shield) this._note(n, "你的牌被护盾保护,无法查看。");
        else { this._note(n, `你现在的牌是:${rn(this.cardRole(this.seats[n].card))}`, [this._seatCard(n)]); this._touch(n); }
        nt.acted[n] = true;
      }
    }
    this._log(`${isNight ? "🌙" : "🌆"} ${rn(role)} 阶段`);
  }
  // 行动者在当前阶段的"有效角色":化身幽灵复制后在本阶段立刻按复制的角色行动
  _effRole(n) {
    const nt = this.night, role = nt.phases[nt.idx];
    if (role === "doppelganger") return this.dg && this.dg.seat === n ? this.dg.role : "doppelganger";
    return role;
  }
  // 播报员念完本阶段 → 计时起点
  _narrDone(id, msg) {
    if (this.phase !== "night") return { error: "NOT_NIGHT" };
    const nt = this.night;
    if (Number(msg.idx) !== nt.idx) return { ok: true, changed: false };
    if (this.narrator && id !== this.narrator) return { error: "NOT_NARRATOR" };
    if (nt.narrDoneAt != null) return { ok: true, changed: false };
    nt.narrDoneAt = this.now();
    return { ok: true, changed: true };
  }
  _nightAdvance(force) {
    if (this.phase !== "night") return { error: "NOT_NIGHT" };
    const nt = this.night, now = this.now();
    if (force) { this._enterPhase(nt.idx + 1); return { ok: true, changed: true }; }
    let base = nt.narrDoneAt;
    if (base == null) { if (now - nt.startedAt < NARR_TIMEOUT_MS) return { ok: true, changed: false }; base = nt.startedAt; } // 播报员失联兜底
    const elapsed = now - base;
    const minMs = this.config.phaseSec * 1000, maxMs = this.config.phaseMaxSec * 1000;
    const allActed = nt.actors.every((n) => nt.acted[n]);
    if (elapsed >= minMs && (allActed || (maxMs > 0 && elapsed >= maxMs))) { this._enterPhase(nt.idx + 1); return { ok: true, changed: true }; }
    return { ok: true, changed: false };
  }

  _swapCards(a, b) { // a/b = {kind:"seat",no} | {kind:"center",no}
    const get = (x) => (x.kind === "seat" ? this.seats[x.no].card : this.center[x.no]);
    const set = (x, v) => { if (x.kind === "seat") this.seats[x.no].card = v; else this.center[x.no] = v; };
    const va = get(a), vb = get(b); set(a, vb); set(b, va);
  }
  _validSeat(n) { return Number.isInteger(n) && !!this.seats[n]; }
  _validCenter(i) { return Number.isInteger(i) && i >= 0 && i < this.center.length; }
  _piFound(card) { const role = this.cardRole(card); if (card === "doppelganger") return null; if (WOLF_ROLES.has(role)) return "werewolf"; if (VAMP_ROLES.has(role)) return "vampire"; if (role === "tanner") return "tanner"; return null; }
  _holderFor(n) { // 化身幽灵/模仿者复制的角色,其附加结果(pi/nostradamus)挂在复制者身上
    if (this.dg && this.dg.seat === n && this.seats[n].initRole === "doppelganger") return this.dg;
    if (this.copycat && this.copycat.seat === n && this.seats[n].initRole === "copycat") return this.copycat;
    return null;
  }

  _nightAct(id, msg) {
    if (this.phase !== "night") return { error: "NOT_NIGHT" };
    const n = Number(msg.seatNo);
    if (!this.isHolder(id, n)) return { error: "NOT_HOLDER" };
    const nt = this.night;
    if (!nt.actors.includes(n)) return { error: "NOT_ACTOR" };
    if (nt.acted[n]) return { error: "ALREADY_ACTED" };
    const eff = this._effRole(n), kind = msg.kind, me = this.seats[n];
    const sub = (nt.sub[n] = nt.sub[n] || {});
    const target = msg.target != null ? Number(msg.target) : null;
    const idx = msg.idx != null ? Number(msg.idx) : null;
    const done = () => { nt.acted[n] = true; return { ok: true }; };
    const chkOther = (t) => { if (!this._validSeat(t)) return "BAD_TARGET"; if (t === n) return "SELF_TARGET"; if (this.seats[t].shield) return "SHIELDED"; return null; };
    const chkAny = (t) => { if (!this._validSeat(t)) return "BAD_TARGET"; return null; };
    const setMark = (t, k, who) => { this.seats[t].mark = k; this._touch(n); this.nightLog.push(`${who}(${n}号)给 ${t}号 放了${mn(k)}`); };

    if (kind === "skip") {
      if (MANDATORY.has(eff) && !(eff === "drunk" && me.shield)) return { error: "MANDATORY" };
      if (eff === "witch" && sub.witchIdx != null) return { error: "MANDATORY" }; // 看了就必须换
      if (eff === "apprenticeassassin") return { error: "MANDATORY" };
      if (eff === "pi" && sub.viewed && sub.viewed.length) { this._piStop(n); return done(); }
      if (eff === "nostradamus") { this._nostraSet(n, "village"); return done(); }
      if (eff === "werewolf" && this._wolvesNow().length > 1) return { error: "ALREADY_ACTED" };
      this._note(n, "你选择不行动。");
      return done();
    }
    switch (eff) {
      case "copycat": {
        if (kind !== "peekCenter") return { error: "BAD_KIND" };
        if (!this._validCenter(idx)) return { error: "BAD_TARGET" };
        const role = this.center[idx];
        this.copycat = { seat: n, role, piRole: null, nostraTeam: null };
        this._touch(n);
        this._note(n, `你查看了中央第 ${idx + 1} 张牌:${rn(role)}。你现在就是${rn(role)},它被叫到时请一起行动。`, [this._centerCard(idx)]);
        this.nightLog.push(`模仿者(${n}号)查看了中央第 ${idx + 1} 张牌,成为${rn(role)}`);
        return done();
      }
      case "vampire": { // 吸血鬼们任一人放置吸血鬼印记
        if (kind !== "mark") return { error: "BAD_KIND" };
        const e = chkAny(target); if (e) return { error: e };
        if (this._isVampNow(target)) return { error: "TARGET_IS_VAMP" };
        setMark(target, "vampire", "吸血鬼");
        this.vampTarget = target;
        for (const x of nt.actors) { this._note(x, `吸血鬼印记放在了 ${target}号 面前(他现在也是吸血鬼)。`); nt.acted[x] = true; }
        return { ok: true };
      }
      case "count": {
        if (kind !== "mark") return { error: "BAD_KIND" };
        const e = chkAny(target); if (e) return { error: e };
        if (this._isVampNow(target)) return { error: "TARGET_IS_VAMP" };
        setMark(target, "fear", "伯爵");
        this._note(n, `你给 ${target}号 放置了恐惧印记。`);
        return done();
      }
      case "diseased": {
        if (kind !== "mark") return { error: "BAD_KIND" };
        const e = chkAny(target); if (e) return { error: e };
        if (target !== this._neighbor(n, "left") && target !== this._neighbor(n, "right")) return { error: "NOT_ADJACENT" };
        setMark(target, "disease", "病患");
        this._note(n, `你给 ${target}号 放置了疾病印记。`);
        return done();
      }
      case "cupid": {
        if (kind !== "markTwo") return { error: "BAD_KIND" };
        const a = Number(msg.a), b = Number(msg.b);
        if (a === b) return { error: "BAD_TARGET" };
        const e = chkAny(a) || chkAny(b); if (e) return { error: e };
        setMark(a, "love", "丘比特"); setMark(b, "love", "丘比特");
        this._note(n, `你给 ${a}号 和 ${b}号 放置了爱之印记。`);
        return done();
      }
      case "instigator": {
        if (kind !== "mark") return { error: "BAD_KIND" };
        const e = chkAny(target); if (e) return { error: e };
        setMark(target, "traitor", "煽动者");
        this._note(n, `你给 ${target}号 放置了叛徒印记。`);
        return done();
      }
      case "priest": {
        if (kind !== "mark") return { error: "BAD_KIND" };
        const e = chkOther(target); if (e && e !== "SHIELDED") return { error: e };
        setMark(target, "clarity", "牧师");
        this._note(n, `你也给 ${target}号 放置了清明印记。`);
        return done();
      }
      case "assassin": case "apprenticeassassin": {
        if (kind !== "mark") return { error: "BAD_KIND" };
        const e = chkAny(target); if (e) return { error: e };
        setMark(target, "assassin", eff === "assassin" ? "刺客" : "刺客学徒");
        this._note(n, `你给 ${target}号 放置了刺客印记。`);
        return done();
      }
      case "doppelganger": {
        if (kind !== "copy") return { error: "BAD_KIND" };
        const e = chkOther(target); if (e) return { error: e };
        const role = this.seats[target].card; // 此时只有黄昏印记与哨兵行动过,牌未移动
        this.dg = { seat: n, role, piRole: null, nostraTeam: null };
        this._touch(n);
        this._note(n, `你查看了 ${target}号 的牌:${rn(role)}。你现在就是${rn(role)}。`, [this._seatCard(target)]);
        this.nightLog.push(`化身幽灵(${n}号)查看了 ${target}号,成为${rn(role)}`);
        if (DG_IMMEDIATE.has(role)) {
          if (role === "drunk" && me.shield) return done();
          if (role === "alphawolf" && this.wolfSlot == null) return done(); // 没有中央狼人牌可换
          if (role === "thing" || role === "marksman" || role === "pickpocket" || role === "gremlin" || role === "nostradamus") { nt.sub[n] = sub; }
          return { ok: true }; // 继续在本阶段按新角色行动
        }
        if (DG_GROUP.has(role)) this._note(n, `你将在${rn(WAKE_WOLVES.has(role) ? "werewolf" : role)}阶段一起睁眼。`);
        return done();
      }
      case "sentinel": {
        if (kind !== "shield") return { error: "BAD_KIND" };
        if (!this._validSeat(target)) return { error: "BAD_TARGET" };
        if (target === n) return { error: "SELF_TARGET" };
        this.seats[target].shield = true;
        this._note(n, `你给 ${target}号 放置了护盾。`);
        this.nightLog.push(`哨兵(${n}号)给 ${target}号 放置了护盾`);
        this._log(`🛡️ ${target}号 的牌被放置了护盾`);
        return done();
      }
      case "werewolf": { // 独狼看一张中央牌
        if (kind !== "peekCenter") return { error: "BAD_KIND" };
        if (this._wolvesNow().length > 1) return { error: "NOT_LONE" };
        if (!this._validCenter(idx)) return { error: "BAD_TARGET" };
        this._touch(n);
        this._note(n, `你查看了中央第 ${idx + 1} 张牌:${rn(this.center[idx])}`, [this._centerCard(idx)]);
        this.nightLog.push(`独狼(${n}号)查看了中央第 ${idx + 1} 张牌`);
        return done();
      }
      case "mysticwolf": {
        if (kind === "peekCenter") { // 村规加强:也可以看一张中央牌
          if (!this._validCenter(idx)) return { error: "BAD_TARGET" };
          this._touch(n);
          this._note(n, `你查看了中央第 ${idx + 1} 张牌:${rn(this.center[idx])}`, [this._centerCard(idx)]);
          this.nightLog.push(`神秘狼(${n}号)查看了中央第 ${idx + 1} 张牌`);
          return done();
        }
        if (kind !== "peekPlayer") return { error: "BAD_KIND" };
        const e = chkOther(target); if (e) return { error: e };
        this._touch(n);
        this._note(n, `你查看了 ${target}号 的牌:${rn(this.cardRole(this.seats[target].card))}`, [this._seatCard(target)]);
        this.nightLog.push(`神秘狼(${n}号)查看了 ${target}号`);
        return done();
      }
      case "alphawolf": {
        if (kind !== "swapCenter") return { error: "BAD_KIND" };
        if (this.wolfSlot == null) return { error: "NO_WOLF_CARD" };
        const e = chkOther(target); if (e) return { error: e };
        if (this._isWolfNow(target)) return { error: "TARGET_IS_WOLF" };
        this._swapCards({ kind: "seat", no: target }, { kind: "center", no: this.wolfSlot });
        this._touch(n);
        this._note(n, `你把中央的狼人牌换给了 ${target}号(他现在是狼人)。`);
        this.nightLog.push(`头狼(${n}号)把中央狼人牌换给了 ${target}号`);
        return done();
      }
      case "seer": {
        if (kind === "peekPlayer") {
          const e = chkOther(target); if (e) return { error: e };
          this._touch(n);
          this._note(n, `你查看了 ${target}号 的牌:${rn(this.cardRole(this.seats[target].card))}`, [this._seatCard(target)]);
          this.nightLog.push(`预言家(${n}号)查看了 ${target}号`);
          return done();
        }
        if (kind === "peekCenter") {
          const ids = Array.isArray(msg.idxs) ? msg.idxs.map(Number) : [];
          if (ids.length !== 2 || ids[0] === ids[1] || !ids.every((i) => this._validCenter(i))) return { error: "BAD_TARGET" };
          this._touch(n);
          this._note(n, `你查看了中央第 ${ids[0] + 1}、${ids[1] + 1} 张牌:${ids.map((i) => rn(this.center[i])).join("、")}`, ids.map((i) => this._centerCard(i)));
          this.nightLog.push(`预言家(${n}号)查看了中央第 ${ids[0] + 1}、${ids[1] + 1} 张牌`);
          return done();
        }
        return { error: "BAD_KIND" };
      }
      case "apprenticeseer": {
        if (kind !== "peekCenter") return { error: "BAD_KIND" };
        if (!this._validCenter(idx)) return { error: "BAD_TARGET" };
        this._touch(n);
        this._note(n, `你查看了中央第 ${idx + 1} 张牌:${rn(this.center[idx])}`, [this._centerCard(idx)]);
        this.nightLog.push(`预言家学徒(${n}号)查看了中央第 ${idx + 1} 张牌`);
        return done();
      }
      case "pi": {
        if (kind !== "peekPlayer") return { error: "BAD_KIND" };
        const e = chkOther(target); if (e) return { error: e };
        sub.viewed = sub.viewed || [];
        if (sub.viewed.includes(target)) return { error: "BAD_TARGET" };
        const card = this.seats[target].card, role = this.cardRole(card);
        sub.viewed.push(target); this._touch(n);
        const found = this._piFound(card);
        this._note(n, `你查看了 ${target}号 的牌:${rn(role)}${found ? `。你变成了${rn(found)}!` : ""}`, [this._seatCard(target)]);
        this.nightLog.push(`灵异侦探(${n}号)查看了 ${target}号${found ? `,变成了${rn(found)}` : ""}`);
        if (found) { this._piSet(n, found); return done(); }
        if (sub.viewed.length >= 2) { this._piStop(n); return done(); }
        return { ok: true };
      }
      case "nostradamus": {
        if (kind !== "peekCenter") return { error: "BAD_KIND" };
        if (!this._validCenter(idx)) return { error: "BAD_TARGET" };
        sub.viewed = sub.viewed || [];
        if (sub.viewed.includes(idx)) return { error: "BAD_TARGET" };
        sub.viewed.push(idx); this._touch(n);
        const role = this.cardRole(this.center[idx]);
        let team = this.teamOfRole(role);
        if (WOLF_ROLES.has(role)) team = "werewolf"; else if (VAMP_ROLES.has(role)) team = "vampire";
        this._note(n, `你查看了中央第 ${idx + 1} 张牌:${rn(role)}${team !== "village" ? `。你加入了${TEAM_NAME[team]}阵营!` : ""}`, [this._centerCard(idx)]);
        this.nightLog.push(`诺查丹玛斯(${n}号)查看了中央第 ${idx + 1} 张牌`);
        if (team !== "village") { this._nostraSet(n, team); return done(); }
        if (sub.viewed.length >= 3) { this._nostraSet(n, "village"); return done(); }
        return { ok: true };
      }
      case "marksman": {
        if (kind !== "marksman") return { error: "BAD_KIND" };
        const ct = msg.cardTarget != null ? Number(msg.cardTarget) : null, mt = msg.markTarget != null ? Number(msg.markTarget) : null;
        if (ct == null && mt == null) return { error: "BAD_TARGET" };
        if (ct != null && mt != null && ct === mt) return { error: "BAD_TARGET" };
        if (ct != null) { const e = chkOther(ct); if (e) return { error: e }; }
        if (mt != null) { const e = chkAny(mt); if (e) return { error: e }; }
        this._touch(n);
        const cards = [];
        let text = "";
        if (ct != null) { text += `你查看了 ${ct}号 的牌:${rn(this.cardRole(this.seats[ct].card))}。`; cards.push(this._seatCard(ct)); }
        if (mt != null) { text += `你查看了 ${mt}号 的印记:${mn(this.seats[mt].mark)}。`; cards.push(this._markCard(mt)); }
        this._note(n, text, cards);
        this.nightLog.push(`神射手(${n}号)查看了${ct != null ? ` ${ct}号 的牌` : ""}${mt != null ? ` ${mt}号 的印记` : ""}`);
        return done();
      }
      case "robber": {
        if (kind !== "swapSelf") return { error: "BAD_KIND" };
        const e = chkOther(target); if (e) return { error: e };
        if (me.shield) return { error: "SHIELDED" };
        this._swapCards({ kind: "seat", no: n }, { kind: "seat", no: target });
        this._touch(n);
        this._note(n, `你与 ${target}号 交换了牌,你的新牌是:${rn(this.cardRole(me.card))}`, [this._seatCard(n)]);
        this.nightLog.push(`强盗(${n}号)与 ${target}号 交换了牌`);
        return done();
      }
      case "witch": {
        if (kind === "peekCenter") {
          if (sub.witchIdx != null) return { error: "BAD_KIND" };
          if (!this._validCenter(idx)) return { error: "BAD_TARGET" };
          sub.witchIdx = idx; this._touch(n);
          this._note(n, `你查看了中央第 ${idx + 1} 张牌:${rn(this.center[idx])},现在必须把它换给一名玩家。`, [this._centerCard(idx)]);
          return { ok: true };
        }
        if (kind === "swapCenter") {
          if (sub.witchIdx == null) return { error: "BAD_KIND" };
          if (!this._validSeat(target)) return { error: "BAD_TARGET" };
          if (this.seats[target].shield) return { error: "SHIELDED" };
          this._swapCards({ kind: "seat", no: target }, { kind: "center", no: sub.witchIdx });
          this._note(n, `你把中央第 ${sub.witchIdx + 1} 张牌(${rn(this.seats[target].card)})换给了 ${target}号${target === n ? "(自己)" : ""}。`);
          this.nightLog.push(`女巫(${n}号)把中央第 ${sub.witchIdx + 1} 张牌换给了 ${target}号`);
          return done();
        }
        return { error: "BAD_KIND" };
      }
      case "pickpocket": {
        if (kind !== "swapMark") return { error: "BAD_KIND" };
        const e = chkAny(target); if (e) return { error: e };
        if (target === n) return { error: "SELF_TARGET" };
        const a = me.mark, b = this.seats[target].mark; me.mark = b; this.seats[target].mark = a; this._touch(n);
        this._note(n, `你与 ${target}号 交换了印记,你的新印记是:${mn(me.mark)}`, [this._markCard(n)]);
        this.nightLog.push(`扒手(${n}号)与 ${target}号 交换了印记`);
        return done();
      }
      case "troublemaker": {
        if (kind !== "swapTwo") return { error: "BAD_KIND" };
        const a = Number(msg.a), b = Number(msg.b);
        if (a === b) return { error: "BAD_TARGET" };
        const e = chkOther(a) || chkOther(b); if (e) return { error: e };
        this._swapCards({ kind: "seat", no: a }, { kind: "seat", no: b });
        this._touch(n);
        this._note(n, `你交换了 ${a}号 和 ${b}号 的牌。`);
        this.nightLog.push(`捣蛋鬼(${n}号)交换了 ${a}号 和 ${b}号 的牌`);
        return done();
      }
      case "gremlin": {
        if (kind !== "swapTwo") return { error: "BAD_KIND" };
        const a = Number(msg.a), b = Number(msg.b), what = msg.what === "marks" ? "marks" : "cards";
        if (a === b) return { error: "BAD_TARGET" };
        const e = chkAny(a) || chkAny(b); if (e) return { error: e };
        if (what === "cards") {
          if (this.seats[a].shield || this.seats[b].shield) return { error: "SHIELDED" };
          this._swapCards({ kind: "seat", no: a }, { kind: "seat", no: b });
        } else { const t = this.seats[a].mark; this.seats[a].mark = this.seats[b].mark; this.seats[b].mark = t; }
        this._touch(n);
        this._note(n, `你交换了 ${a}号 和 ${b}号 的${what === "cards" ? "牌" : "印记"}。`);
        this.nightLog.push(`小精灵(${n}号)交换了 ${a}号 和 ${b}号 的${what === "cards" ? "牌" : "印记"}`);
        return done();
      }
      case "villageidiot": {
        if (kind !== "shift") return { error: "BAD_KIND" };
        const dir = msg.dir === "left" ? "left" : msg.dir === "right" ? "right" : null;
        if (!dir) return { error: "BAD_TARGET" };
        const ring = this.seatNos().filter((x) => x !== n && !this.seats[x].shield);
        if (ring.length >= 2) {
          const cards = ring.map((x) => this.seats[x].card);
          // right = 每张牌移到座位号更大的下一位(环形);left 反之
          const moved = dir === "right" ? [cards[cards.length - 1], ...cards.slice(0, -1)] : [...cards.slice(1), cards[0]];
          ring.forEach((x, i) => { this.seats[x].card = moved[i]; });
        }
        this._touch(n);
        this._note(n, `你把其他玩家的牌向${dir === "left" ? "左" : "右"}移动了一位${ring.length < this.seatNos().length - 1 ? "(被护盾保护的牌没动)" : ""}。`);
        this.nightLog.push(`村庄白痴(${n}号)把其他玩家的牌向${dir === "left" ? "左" : "右"}移了一位`);
        return done();
      }
      case "thing": {
        if (kind !== "tap") return { error: "BAD_KIND" };
        const dir = msg.dir === "left" ? "left" : msg.dir === "right" ? "right" : null;
        if (!dir) return { error: "BAD_TARGET" };
        const t = this._neighbor(n, dir);
        this._note(n, `你拍了 ${t}号(${dir === "left" ? "左" : "右"}边)的肩膀。`);
        this._note(t, `夜里有东西拍了你的${dir === "left" ? "右" : "左"}肩 —— 「那东西」就在你${dir === "left" ? "右" : "左"}边。`);
        this.nightLog.push(`那东西(${n}号)拍了 ${t}号 的肩膀`);
        return done();
      }
      case "drunk": {
        if (kind !== "swapCenter") return { error: "BAD_KIND" };
        if (me.shield) return { error: "SHIELDED" };
        if (!this._validCenter(idx)) return { error: "BAD_TARGET" };
        this._swapCards({ kind: "seat", no: n }, { kind: "center", no: idx });
        this._touch(n);
        this._note(n, `你把自己的牌与中央第 ${idx + 1} 张牌交换了(没有看)。`);
        this.nightLog.push(`酒鬼(${n}号)与中央第 ${idx + 1} 张牌交换`);
        return done();
      }
      case "squire": case "beholder": {
        if (kind !== "peekPlayer") return { error: "BAD_KIND" };
        if (!(sub.targets || []).includes(target)) return { error: "BAD_TARGET" };
        if (this.seats[target].shield) return { error: "SHIELDED" };
        sub.viewed = sub.viewed || [];
        if (sub.viewed.includes(target)) return { error: "BAD_TARGET" };
        sub.viewed.push(target); this._touch(n);
        this._note(n, `你查看了 ${target}号 的牌:${rn(this.cardRole(this.seats[target].card))}`, [this._seatCard(target)]);
        this.nightLog.push(`${rn(eff)}(${n}号)查看了 ${target}号`);
        if (sub.viewed.length >= sub.targets.length) return done();
        return { ok: true };
      }
      case "revealer": {
        if (kind !== "reveal") return { error: "BAD_KIND" };
        const e = chkOther(target); if (e) return { error: e };
        const role = this.cardRole(this.seats[target].card);
        this._touch(n);
        if (WOLF_ROLES.has(role) || VAMP_ROLES.has(role) || role === "tanner") {
          this._note(n, `你翻开了 ${target}号 的牌:${rn(role)} —— 立刻翻回去了,只有你看到。`, [this._seatCard(target)]);
          this.nightLog.push(`揭露者(${n}号)翻开了 ${target}号(${rn(role)}),又翻了回去`);
        } else {
          this.seats[target].revealed = this.seats[target].card;
          this._note(n, `你翻开了 ${target}号 的牌:${rn(role)},全场可见。`, [this._seatCard(target)]);
          this.nightLog.push(`揭露者(${n}号)翻开了 ${target}号 的牌:${rn(role)}`);
          this._log(`🔦 ${target}号 的牌被翻开:${rn(role)}`);
        }
        return done();
      }
      case "curator": {
        if (kind !== "artifact") return { error: "BAD_KIND" };
        if (!this._validSeat(target)) return { error: "BAD_TARGET" };
        if (this.seats[target].shield) return { error: "SHIELDED" };
        if (this.seats[target].artifact) return { error: "HAS_ARTIFACT" };
        this.seats[target].artifact = this.artifactDeck.shift() || "void";
        this._note(n, `你在 ${target}号 的牌上放了一枚神器(你不知道是什么)。`);
        this.nightLog.push(`馆长(${n}号)在 ${target}号 的牌上放了神器`);
        this._log(`🏺 ${target}号 的牌上被放置了神器`);
        return done();
      }
      default: return { error: "NO_ACTION" };
    }
  }
  _piSet(n, found) { const h = this._holderFor(n); if (h && h.role === "pi") h.piRole = found; else this.pi = { seat: n, found }; }
  _piStop(n) { const h = this._holderFor(n); if (!(h && h.role === "pi") && !this.pi) this.pi = { seat: n, found: null }; }
  _nostraSet(n, team) { const h = this._holderFor(n); if (h && h.role === "nostradamus") h.nostraTeam = team; else this.nostra = { seat: n, team }; }

  // ───────── 白天 ─────────
  _startDay() {
    this.phase = "day"; this.night.idx = this.night.phases.length;
    this._log("☀️ 天亮了");
    if (this.roles.includes("nostradamus")) { // 公开宣布诺查丹玛斯加入的阵营;他在中央时随机说一个
      const n = this.seatNos().find((x) => this._hasRole(x, "nostradamus"));
      let team;
      if (n != null) team = this._nostraTeamOfCard(this.seats[n].initRole === "nostradamus" ? "nostradamus" : this.seats[n].initRole) || "village";
      else { const pool = ["village", "werewolf", "vampire", "tanner"]; team = pool[Math.floor(this.rng() * pool.length)]; }
      this.dayNotice = `诺查丹玛斯加入了${TEAM_NAME[team]}阵营`;
      this._log("📣 " + this.dayNotice);
    }
    this._startRound(0);
  }
  _startRound(r) {
    const rounds = this.config.rounds;
    if (r >= rounds.length) return this._startVote();
    const seats = this.seatNos(), mode = rounds[r].mode, now = this.now();
    const start = seats[Math.floor(this.rng() * seats.length)];
    const i = seats.indexOf(start);
    let order = seats.slice(i).concat(seats.slice(0, i));
    const anchor = mode === "order" && r === rounds.length - 1 && this.config.anchor;
    if (anchor) order = order.concat([start]); // 归票位沉底:首位发言者最后再发一次
    this.day = { round: r, mode, order, cur: 0, startedAt: now, speakerStartedAt: now, anchorSeat: anchor ? start : null,
      freeMs: mode === "free" ? (this.config.freeSec || seats.length * 60) * 1000 : 0 };
    this._log(mode === "order" ? `🗣️ 第 ${r + 1} 轮顺序发言,从 ${start}号 开始` : `💬 第 ${r + 1} 轮自由讨论 ${Math.round(this.day.freeMs / 60000)} 分钟`);
  }
  currentSpeaker() { const d = this.day; return d && d.mode === "order" && d.cur < d.order.length ? d.order[d.cur] : null; }
  _dayNext(id, force) {
    if (this.phase !== "day") return { error: "NOT_DAY" };
    const d = this.day, now = this.now();
    if (d.mode === "order") {
      const sp = this.currentSpeaker();
      const timed = this.config.perSpeakSec > 0 && now - d.speakerStartedAt >= this.config.perSpeakSec * 1000;
      if (!force && !timed && !this.isHolder(id, sp)) return { error: "NOT_SPEAKER" };
      d.cur += 1; d.speakerStartedAt = now;
      if (d.cur >= d.order.length) this._startRound(d.round + 1);
      else if (d.anchorSeat != null && d.cur === d.order.length - 1) this._log(`📣 ${d.anchorSeat}号 归票沉底发言`);
      return { ok: true, changed: true };
    }
    const timed = now - d.startedAt >= d.freeMs;
    if (!force && !timed) return { error: "NOT_YET" };
    this._startRound(d.round + 1);
    return { ok: true, changed: true };
  }

  // ───────── 投票与结算 ─────────
  _startVote() {
    this.phase = "vote"; this.day = null;
    this.voting = { startedAt: this.now() };
    for (const s of Object.values(this.seats)) s.vote = null;
    this._log(`🗳️ 开始投票(${this.config.voteSec} 秒)`);
  }
  _vote(id, msg) {
    if (this.phase !== "vote") return { error: "NOT_VOTE" };
    const n = Number(msg.seatNo), t = Number(msg.target);
    if (!this.isHolder(id, n)) return { error: "NOT_HOLDER" };
    if (!this._validSeat(t)) return { error: "BAD_TARGET" };
    this.seats[n].vote = t; // 允许投自己(皮匠常用)
    this._closeVote(false); // 全员投完立即结算
    return { ok: true };
  }
  _closeVote(force) {
    if (this.phase !== "vote") return { error: "NOT_VOTE" };
    const all = this.seatNos().every((n) => this.seats[n].vote != null);
    const timed = this.now() - this.voting.startedAt >= this.config.voteSec * 1000;
    if (!force && !all && !timed) return { ok: true, changed: false };
    this._resolve();
    return { ok: true, changed: true };
  }
  _resolve() {
    const seats = this.seatNos();
    const final = {}; for (const n of seats) final[n] = this.finalRole(n);
    const votes = {}; const tally = {}; for (const n of seats) tally[n] = 0;
    for (const n of seats) { const t = this.seats[n].vote; votes[n] = t; if (t != null) tally[t] += 1; }
    const votersOf = (t) => seats.filter((v) => votes[v] === t);
    const lines = [];
    const mark = (n) => this.seats[n].mark;
    const isWolf = (n) => WOLF_ROLES.has(final[n]);
    const isVamp = (n) => VAMP_ROLES.has(final[n]) || mark(n) === "vampire";
    // 被诅咒者:有狼人/吸血鬼投他 → 转为狼人/吸血鬼
    for (const n of seats) if (final[n] === "cursed") {
      const vs = votersOf(n);
      if (vs.some(isWolf)) { final[n] = "werewolf"; lines.push(`🧟 ${n}号 被诅咒者被狼人投票,变成了狼人`); }
      else if (vs.some(isVamp)) { final[n] = "vampire"; lines.push(`🧟 ${n}号 被诅咒者被吸血鬼投票,变成了吸血鬼`); }
    }
    const wolvesInPlay = seats.filter(isWolf), vampsInPlay = seats.filter(isVamp);
    const tannerInPlay = seats.some((n) => final[n] === "tanner");
    const tannerLike = (n) => final[n] === "tanner" || (final[n] === "apprenticetanner" && !tannerInPlay);
    const assassinInPlay = seats.some((n) => final[n] === "assassin");
    const teamOf = (n) => {
      if (isVamp(n)) return "vampire";
      if (isWolf(n)) return "werewolf";
      const f = final[n];
      if (f === "renfield") return vampsInPlay.length ? "vampire" : "village";
      if (f === "nostradamus" || ((f === "doppelganger" || f === "copycat") && this._nostraTeamOfCard(this.seats[n].card) !== "village")) return this._nostraTeamOfCard(this.seats[n].card);
      if (tannerLike(n)) return "tanner";
      return this.teamOfRole(f);
    };
    const team = {}; for (const n of seats) team[n] = teamOf(n);
    // 保护:保镖指向者 / 吸血鬼之主被另一名吸血鬼投 / 王子(投他的票不算)
    const protectedSet = new Set(seats.filter((n) => final[n] === "bodyguard" && votes[n] != null).map((n) => votes[n]));
    for (const n of seats) {
      if (final[n] === "master" && votersOf(n).some((v) => v !== n && isVamp(v))) { protectedSet.add(n); lines.push(`🦇 吸血鬼之主 ${n}号 有吸血鬼同伴投他,受到保护`); }
      if (final[n] === "prince" && tally[n] > 0) { protectedSet.add(n); lines.push(`🤴 投给王子 ${n}号 的票不算数`); }
    }
    // 得票最多者出局(并列全出局);无人 ≥2 票则无人出局;被保护者不出局,若其得票最高则次高者(≥2)出局
    const counts = [...new Set(Object.values(tally))].filter((c) => c >= 2).sort((a, b) => b - a);
    let deaths = [];
    for (const c of counts) {
      const tier = seats.filter((n) => tally[n] === c);
      const unprotected = tier.filter((n) => !protectedSet.has(n));
      const prot = tier.filter((n) => protectedSet.has(n) && final[n] !== "prince" && final[n] !== "master");
      if (prot.length) lines.push(`🥋 保镖保护了 ${this._list(prot)}`);
      if (unprotected.length) { deaths = unprotected; break; }
    }
    if (!counts.length) lines.push("无人得到 2 票以上,没有人出局");
    // 猎人带人 / 恋人同死(可连锁)
    const dead = new Set(deaths);
    let changed = true;
    while (changed) {
      changed = false;
      for (const n of [...dead]) {
        if (final[n] === "hunter" && votes[n] != null && !dead.has(votes[n]) && !protectedSet.has(votes[n])) { dead.add(votes[n]); lines.push(`🏹 猎人 ${n}号 出局,带走了 ${votes[n]}号`); changed = true; }
        if (mark(n) === "love") for (const x of seats) if (x !== n && mark(x) === "love" && !dead.has(x)) { dead.add(x); lines.push(`💘 恋人 ${n}号 出局,${x}号 殉情`); changed = true; }
      }
    }
    deaths = seats.filter((n) => dead.has(n));
    const wolfDied = deaths.some(isWolf), vampDied = deaths.some(isVamp), tannerDied = deaths.some(tannerLike);
    const evilInPlay = (wolvesInPlay.length ? 1 : 0) + (vampsInPlay.length ? 1 : 0);
    const minionInPlay = seats.filter((n) => final[n] === "minion" || final[n] === "squire");
    const winTeams = [];
    let villageWin = false, wolfWin = false, vampWin = false;
    if (evilInPlay) {
      villageWin = (!wolvesInPlay.length || wolfDied) && (!vampsInPlay.length || vampDied);
      wolfWin = wolvesInPlay.length > 0 && !wolfDied && (!vampsInPlay.length || vampDied) && !tannerDied;
      vampWin = vampsInPlay.length > 0 && !vampDied && (!wolvesInPlay.length || wolfDied) && !tannerDied;
    } else {
      // 场上没有邪恶阵营:无人出局(或只有爪牙/侍从出局)村民胜;有爪牙/侍从且其他玩家出局 → 狼人阵营(爪牙)胜
      const nonMinionDied = deaths.some((n) => !minionInPlay.includes(n));
      villageWin = !nonMinionDied;
      wolfWin = minionInPlay.length > 0 && nonMinionDied && !tannerDied;
    }
    if (villageWin) winTeams.push("village");
    if (wolfWin) winTeams.push("werewolf");
    if (vampWin) winTeams.push("vampire");
    if (tannerDied) winTeams.push("tanner");
    // 逐人判定
    const reasons = {};
    const assassinMarkHolder = seats.find((n) => mark(n) === "assassin");
    const winners = seats.filter((n) => {
      const f = final[n], t = team[n];
      let w;
      if (t === "tanner") w = dead.has(n) || (f === "apprenticetanner" && tannerInPlay && deaths.some((x) => final[x] === "tanner"));
      else if (f === "assassin" || (f === "apprenticeassassin" && !assassinInPlay)) w = assassinMarkHolder != null && dead.has(assassinMarkHolder);
      else if (f === "apprenticeassassin") w = deaths.some((x) => final[x] === "assassin");
      else if (f === "squire" && !wolvesInPlay.length) w = !dead.has(n) && deaths.some((x) => x !== n);
      else if (f === "nostradamus" || this._nostraTeamOfCard(this.seats[n].card) !== "village") w = winTeams.includes(t) && !dead.has(n);
      else w = winTeams.includes(t);
      if (w && mark(n) === "traitor") { // 叛徒印记:同阵营另有人出局才赢(没有队友则无效)
        const mates = seats.filter((x) => x !== n && team[x] === t);
        if (mates.length && !mates.some((x) => dead.has(x))) { w = false; reasons[n] = "叛徒印记:同阵营无人出局"; }
      }
      if (w && votes[n] != null && mark(votes[n]) === "disease") { w = false; reasons[n] = `投给了带疾病印记的 ${votes[n]}号`; }
      return w;
    });
    for (const n of Object.keys(reasons)) lines.push(`🚫 ${n}号 不能获胜:${reasons[n]}`);
    if (evilInPlay) {
      const parts = [];
      if (wolvesInPlay.length) parts.push(wolfDied ? "有狼人出局" : "没有狼人出局");
      if (vampsInPlay.length) parts.push(vampDied ? "有吸血鬼出局" : "没有吸血鬼出局");
      lines.unshift(`${parts.join(",")} → ${villageWin ? "村民阵营获胜" : wolfWin ? "狼人阵营获胜" : vampWin ? "吸血鬼阵营获胜" : (tannerDied ? "皮匠出局,邪恶阵营不能获胜" : "邪恶阵营互有损失,无人获胜")}`);
    } else lines.unshift(villageWin ? "场上没有狼人/吸血鬼且无人出局(或只有爪牙出局)→ 村民阵营获胜" : (wolfWin ? "场上没有狼人,但有人出局 → 爪牙/侍从获胜" : "场上没有邪恶阵营,有人出局 → 村民阵营失败"));
    if (tannerDied) lines.push("🪢 皮匠出局 → 皮匠获胜");
    const marks = {}; for (const n of seats) marks[n] = mark(n);
    this.result = { deaths, tally, votes, winners, winTeams, lines, final, team, marks, center: this.center.slice(), dg: this.dg, copycat: this.copycat, pi: this.pi, nostra: this.nostra, wolfSlot: this.wolfSlot };
    this.phase = "over"; this.voting = null;
    this._log(`🏁 结算:${deaths.length ? deaths.map((n) => `${n}号(${rn(final[n])})`).join("、") + " 出局" : "无人出局"};胜方 ${winTeams.map((t) => TEAM_NAME[t]).join("+") || "无"}`);
  }

  // ───────── 定时推进(客户端到点发 tick;幂等)─────────
  tick() {
    if (this.phase === "night") return this._nightAdvance(false);
    if (this.phase === "day") {
      const d = this.day, now = this.now();
      if (d.mode === "order") { if (this.config.perSpeakSec > 0 && now - d.speakerStartedAt >= this.config.perSpeakSec * 1000) return this._dayNext(null, true); return { ok: true, changed: false }; }
      if (now - d.startedAt >= d.freeMs) return this._dayNext(null, true);
      return { ok: true, changed: false };
    }
    if (this.phase === "vote") return this._closeVote(false);
    return { ok: true, changed: false };
  }

  // ───────── 视图 ─────────
  _seatView(s, holds) {
    const mine = holds.has(s.seatNo), over = this.phase === "over";
    const v = { seatNo: s.seatNo, holderDevices: s.holderDevices.slice(), shield: s.shield, revealed: s.revealed, hasVoted: s.vote != null, hasArtifact: !!s.artifact, hasMark: !!s.mark, noteCount: s.notes.length };
    if (mine || over) {
      v.initRole = s.initRole; v.notes = clone(s.notes); v.vote = s.vote;
      if (over || this.phase !== "night") v.artifact = s.artifact;
    }
    if (over) { v.card = s.card; v.mark = s.mark; v.finalRole = this.result ? this.result.final[s.seatNo] : this.finalRole(s.seatNo); v.team = this.result ? this.result.team[s.seatNo] : this.teamOfRole(v.finalRole); }
    return v;
  }
  _roomView(holds) {
    const over = this.phase === "over";
    const nt = this.night;
    let night = null;
    if (this.phase === "night" && nt) {
      const me = {};
      for (const n of holds) if (nt.actors.includes(n)) me[n] = { eff: this._effRole(n), acted: !!nt.acted[n], sub: clone(nt.sub[n] || {}), lone: nt.phases[nt.idx] === "werewolf" ? this._wolvesNow().length === 1 : undefined };
      const role = nt.phases[nt.idx];
      night = { idx: nt.idx, total: nt.phases.length, role, dusk: ROLE_BY_KEY[role].order < 0, phases: nt.phases.slice(), startedAt: nt.startedAt, narrDoneAt: nt.narrDoneAt ?? null, me };
    }
    const voting = this.phase === "vote" ? { startedAt: this.voting.startedAt, voted: this.seatNos().filter((n) => this.seats[n].vote != null).length } : null;
    return {
      phase: this.phase, roles: this.roles.slice(), config: clone(this.config), deckSize: this.deckSize(),
      centerCount: this.center.length, wolfSlot: this.wolfSlot, center: over ? this.center.slice() : null,
      night, day: this.day ? { ...clone(this.day), speaker: this.currentSpeaker() } : null, voting, dayNotice: this.dayNotice, narrator: this.narrator,
      result: this.result ? clone(this.result) : null, log: this.log.slice(0, 80), nightLog: over ? this.nightLog.slice() : null,
      serverNow: this.now(),
    };
  }
  _serializeExtra() {
    return { phase: this.phase, roles: this.roles, config: this.config, center: this.center, wolfSlot: this.wolfSlot, night: this.night, day: this.day, voting: this.voting, result: this.result,
      dg: this.dg, copycat: this.copycat, pi: this.pi, nostra: this.nostra, vampTarget: this.vampTarget, touched: this.touched, dayNotice: this.dayNotice, narrator: this.narrator, artifactDeck: this.artifactDeck, log: this.log, nightLog: this.nightLog };
  }
  _hydrateExtra(d) {
    for (const k of ["phase", "roles", "config", "center", "wolfSlot", "night", "day", "voting", "result", "dg", "copycat", "pi", "nostra", "vampTarget", "touched", "dayNotice", "narrator", "artifactDeck", "log", "nightLog"]) if (d[k] !== undefined) this[k] = d[k];
    for (const s of Object.values(this.seats)) { // 旧版字段兜底
      if (!s.notes) s.notes = [];
      if (s.shield === undefined) s.shield = false;
      if (s.mark === undefined) s.mark = null;
    }
    if (!Array.isArray(this.touched)) this.touched = [];
    if (this.config) this.config = { ...defaultConfig(), ...this.config };
  }
}
