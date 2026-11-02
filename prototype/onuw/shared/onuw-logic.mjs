// 一夜终极狼人房间核心逻辑(线上/线下通用:系统发牌、按夜晚顺序逐角色"睁眼"、行动直接在 UI 里完成、天亮后多轮发言 + 限时投票 + 自动结算)。
// 被 onuw/onuw-sim.mjs(node 断言)与 onuw/worker.mjs(Durable Object)共用;座位/设备骨架继承 common/room-base.mjs。
//
// 保密模型(按设备持有的座位过滤,见 _seatView/_roomView):
//   - 初始角色 initRole 仅本人可见;当前牌 card 整局对所有人(包括本人)保密 —— 只有通过夜晚行动获得的"笔记"(notes)本人可见;结算后全公开。
//   - 中央牌内容保密,结算后公开。护盾 / 被揭露者翻开的牌 / 是否已投票 公开。神器:持有者天亮后可看,结算后公开。
//   - 夜晚阶段只公开"现在轮到哪个角色",不公开谁在行动;各设备只看到自己持有座位的行动面板(night.me)。
//
// 时间:没有服务端定时器,服务端只记 startedAt;客户端按 serverNow 倒计时,到点发 tick,服务端 tick() 校验后推进(幂等)。
//   夜晚每阶段至少 phaseSec 秒(无该角色玩家也等这么久,不泄露信息);有行动者未完成则最多等到 phaseMaxSec(0=一直等)。
//   顺序发言 perSpeakSec(0=不限时,手动结束);自由讨论 freeSec(0=人数×60);投票 voteSec,超时=弃票。
//
// 动作:core.action(deviceId, {op, ...}):setRoles / setConfig / startGame / nightAct{seatNo,kind,…} / nightAdvance{force} / dayNext{force} / startVote / vote{seatNo,target} / closeVote{force} / newGame

import { RoomBase, clone } from "../../common/room-base.mjs";
import { ROLES, ROLE_BY_KEY, NIGHT_ORDER, WOLF_ROLES, WAKE_WOLVES, DG_IMMEDIATE, DG_GROUP, MANDATORY, ARTIFACTS, ARTIFACT_BY_KEY, defaultRoles } from "./onuw-data.mjs";

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const rn = (k) => (ROLE_BY_KEY[k] ? ROLE_BY_KEY[k].name : k);

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
  static MAX_SEATS = 10;

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
      shield: false,    // 哨兵护盾(公开)
      revealed: null,   // 揭露者翻开的牌(公开)
      artifact: null,   // 馆长放的神器 key(持有者天亮后可看)
      notes: [],        // 夜晚获得的信息 [{phase,text,cards:[{kind:"seat"|"center",no,role}]}](本人可见)
      vote: null };     // 投票目标(结算前本人可见,他人只见是否已投)
  }
  _clearSeat(s) { Object.assign(s, { initRole: null, card: null, shield: false, revealed: null, artifact: null, notes: [], vote: null }); }
  _resetGame() {
    this.phase = "setup";   // setup | night | day | vote | over
    this.center = [];       // 中央牌(3 张;有头狼则第 4 张=横放的狼人牌)
    this.wolfSlot = null;   // 头狼横牌在 center 里的下标
    this.night = null;      // { phases:[role], idx, startedAt, actors:[seat], acted:{seat:true}, sub:{seat:{…}} }
    this.day = null;        // { round, mode, order:[seat…], cur, startedAt, speakerStartedAt, anchorSeat }
    this.voting = null;     // { startedAt }
    this.result = null;
    this.dg = null;         // 化身幽灵 { seat, role, piRole }
    this.pi = null;         // 灵异侦探 { seat, viewed:[seat], found:null|"werewolf"|"tanner" }
    this.artifactDeck = [];
    this.log = [];          // 公开日志
    this.nightLog = [];     // 夜晚发生了什么(结算后公开)
    for (const s of Object.values(this.seats)) this._clearSeat(s);
  }
  _log(msg) { this.log.unshift(msg); if (this.log.length > 200) this.log.pop(); }

  // 座位只在准备阶段可增减
  addSeat(id) { if (this.phase !== "setup") return { error: "NOT_SETUP" }; return super.addSeat(id); }
  removeSeat(id) { if (this.phase !== "setup") return { error: "NOT_SETUP" }; return super.removeSeat(id); }

  players() { return this.seatNos(); }
  deckSize() { return this.players().length + 3; }

  // ───────── 角色判定 ─────────
  // 一张牌代表的角色:化身幽灵牌=她复制的角色;灵异侦探牌=他看到的(狼/皮匠)
  cardRole(card) {
    if (card === "doppelganger" && this.dg) {
      if (this.dg.role === "pi") return this.dg.piRole || "pi";
      return this.dg.role || "doppelganger";
    }
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
  teamOfRole(k) { return k === "pi" || k === "doppelganger" ? "village" : (ROLE_BY_KEY[k] ? ROLE_BY_KEY[k].team : "village"); }
  // 夜晚:座位 n 当下算不算狼(头狼选目标 / 狼人互认用)—— 初始角色或化身幽灵复制了狼
  _isWolfNow(n) {
    const s = this.seats[n];
    if (WOLF_ROLES.has(s.initRole)) return true;
    return s.initRole === "doppelganger" && !!this.dg && WOLF_ROLES.has(this.dg.role);
  }
  _wolvesNow() { return this.seatNos().filter((n) => this._isWolfNow(n)); }
  _dgIs(n, role) { const s = this.seats[n]; return s.initRole === "doppelganger" && !!this.dg && this.dg.seat === n && this.dg.role === role; }

  // ───────── 动作分派 ─────────
  action(id, msg) {
    this.connect(id);
    switch (msg.op) {
      case "setRoles": return this._setRoles(msg.roles);
      case "setConfig": return this._setConfig(msg.config);
      case "startGame": return this._startGame();
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
      if (!ROLE_BY_KEY[k]) return { error: "BAD_ROLES" };
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
    this.dg = null; this.pi = null; this.result = null; this.day = null; this.voting = null;
    this.nightLog = [];
    this.artifactDeck = shuffle(ARTIFACTS.map((a) => a.key), this.rng);
    // 夜晚阶段:牌堆里有的角色按顺序唤醒(狼人阶段:任一狼系角色在牌堆即有)
    const has = (k) => this.roles.includes(k);
    const phases = NIGHT_ORDER.filter((k) => (k === "werewolf" ? this.roles.some((r) => WOLF_ROLES.has(r)) : has(k)));
    this.phase = "night";
    this.night = { phases, idx: -1, startedAt: this.now(), actors: [], acted: {}, sub: {} };
    this._log(`开局:${seats.length} 人,牌堆 ${this.roles.map(rn).join("、")}${this.wolfSlot != null ? "(+ 头狼中央狼人牌)" : ""}`);
    this._enterPhase(0);
    return { ok: true };
  }

  // ───────── 夜晚 ─────────
  _actors(role) {
    const seats = this.seatNos();
    const byInit = (k) => seats.filter((n) => this.seats[n].initRole === k);
    switch (role) {
      case "werewolf": return seats.filter((n) => WAKE_WOLVES.has(this.seats[n].initRole) || (this.seats[n].initRole === "doppelganger" && this.dg && WAKE_WOLVES.has(this.dg.role)));
      case "minion": case "mason": case "insomniac": case "revealer": case "curator":
        return seats.filter((n) => this.seats[n].initRole === role || this._dgIs(n, role));
      default: return byInit(role);
    }
  }
  _note(n, text, cards) { this.seats[n].notes.push({ phase: this.night ? this.night.phases[this.night.idx] : null, text, cards: cards || [] }); }
  _seatCard(n) { return { kind: "seat", no: n, role: this.seats[n].card }; }
  _centerCard(i) { return { kind: "center", no: i, role: this.center[i] }; }
  _enterPhase(i) {
    const nt = this.night;
    if (i >= nt.phases.length) return this._startDay();
    nt.idx = i; nt.startedAt = this.now(); nt.acted = {}; nt.sub = {};
    const role = nt.phases[i];
    nt.actors = this._actors(role);
    for (const n of nt.actors) {
      // 自动获得信息的阶段:直接写笔记并标记已完成
      if (role === "werewolf") {
        const wolves = this._wolvesNow();
        const others = wolves.filter((x) => x !== n);
        if (others.length) {
          this._note(n, "狼人同伴:" + others.map((x) => `${x}号(${rn(this.seats[x].initRole === "doppelganger" ? this.dg.role : this.seats[x].initRole)}${this.seats[x].initRole === "dreamwolf" ? ",竖拇指" : ""})`).join("、"));
          nt.acted[n] = true;
        } else this._note(n, "你是场上唯一的狼人,可以查看一张中央牌。");
      } else if (role === "minion") {
        const wolves = this._wolvesNow();
        this._note(n, wolves.length ? "狼人是:" + wolves.map((x) => x + "号").join("、") : "场上没有狼人(都在中央)。");
        nt.acted[n] = true;
      } else if (role === "mason") {
        const others = this._actors("mason").filter((x) => x !== n);
        this._note(n, others.length ? "另一名守夜人:" + others.map((x) => x + "号").join("、") : "没有其他守夜人睁眼,另一张守夜人在中央。");
        nt.acted[n] = true;
      } else if (role === "insomniac") {
        if (this.seats[n].shield) this._note(n, "你的牌被护盾保护,无法查看。");
        else this._note(n, `你现在的牌是:${rn(this.cardRole(this.seats[n].card))}`, [this._seatCard(n)]);
        nt.acted[n] = true;
      }
    }
    this._log(`🌙 ${rn(role)} 阶段`);
  }
  // 行动者在当前阶段的"有效角色":化身幽灵复制后在本阶段立刻按复制的角色行动
  _effRole(n) {
    const nt = this.night, role = nt.phases[nt.idx], s = this.seats[n];
    if (role === "doppelganger") return this.dg && this.dg.seat === n ? this.dg.role : "doppelganger";
    if (role === "werewolf") return "werewolf";
    return role;
  }
  _nightAdvance(force) {
    if (this.phase !== "night") return { error: "NOT_NIGHT" };
    const nt = this.night, elapsed = this.now() - nt.startedAt;
    const minMs = this.config.phaseSec * 1000, maxMs = this.config.phaseMaxSec * 1000;
    const allActed = nt.actors.every((n) => nt.acted[n]);
    if (force) { this._enterPhase(nt.idx + 1); return { ok: true, changed: true }; }
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

    if (kind === "skip") {
      if (MANDATORY.has(eff) && !(eff === "drunk" && me.shield)) return { error: "MANDATORY" };
      if (eff === "witch" && sub.witchIdx != null) return { error: "MANDATORY" }; // 看了就必须换
      if (eff === "pi" && sub.viewed && sub.viewed.length) { this._piStop(n, sub); return done(); }
      this._note(n, "你选择不行动。");
      return done();
    }
    switch (eff) {
      case "doppelganger": {
        if (kind !== "copy") return { error: "BAD_KIND" };
        const e = chkOther(target); if (e) return { error: e };
        const role = this.seats[target].card; // 此时只有哨兵行动过,牌未移动
        this.dg = { seat: n, role, piRole: null };
        this._note(n, `你查看了 ${target}号 的牌:${rn(role)}。你现在就是${rn(role)}。`, [this._seatCard(target)]);
        this.nightLog.push(`化身幽灵(${n}号)查看了 ${target}号,成为${rn(role)}`);
        if (DG_IMMEDIATE.has(role)) {
          if (role === "drunk" && me.shield) return done();
          if (role === "alphawolf" && this.wolfSlot == null) return done(); // 没有中央狼人牌可换
          return { ok: true }; // 继续在本阶段按新角色行动
        }
        if (role === "werewolf" || role === "alphawolf" || role === "mysticwolf" || role === "minion" || role === "mason" || role === "insomniac" || role === "revealer" || role === "curator") this._note(n, `你将在${rn(role === "alphawolf" || role === "mysticwolf" ? "werewolf" : role)}阶段一起睁眼。`);
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
        this._note(n, `你查看了中央第 ${idx + 1} 张牌:${rn(this.center[idx])}`, [this._centerCard(idx)]);
        this.nightLog.push(`独狼(${n}号)查看了中央第 ${idx + 1} 张牌`);
        return done();
      }
      case "mysticwolf": {
        if (kind !== "peekPlayer") return { error: "BAD_KIND" };
        const e = chkOther(target); if (e) return { error: e };
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
        this._note(n, `你把中央的狼人牌换给了 ${target}号(他现在是狼人)。`);
        this.nightLog.push(`头狼(${n}号)把中央狼人牌换给了 ${target}号`);
        return done();
      }
      case "seer": {
        if (kind === "peekPlayer") {
          const e = chkOther(target); if (e) return { error: e };
          this._note(n, `你查看了 ${target}号 的牌:${rn(this.cardRole(this.seats[target].card))}`, [this._seatCard(target)]);
          this.nightLog.push(`预言家(${n}号)查看了 ${target}号`);
          return done();
        }
        if (kind === "peekCenter") {
          const ids = Array.isArray(msg.idxs) ? msg.idxs.map(Number) : [];
          if (ids.length !== 2 || ids[0] === ids[1] || !ids.every((i) => this._validCenter(i))) return { error: "BAD_TARGET" };
          this._note(n, `你查看了中央第 ${ids[0] + 1}、${ids[1] + 1} 张牌:${ids.map((i) => rn(this.center[i])).join("、")}`, ids.map((i) => this._centerCard(i)));
          this.nightLog.push(`预言家(${n}号)查看了中央第 ${ids[0] + 1}、${ids[1] + 1} 张牌`);
          return done();
        }
        return { error: "BAD_KIND" };
      }
      case "apprenticeseer": {
        if (kind !== "peekCenter") return { error: "BAD_KIND" };
        if (!this._validCenter(idx)) return { error: "BAD_TARGET" };
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
        sub.viewed.push(target);
        let found = null;
        if (card !== "doppelganger" && WOLF_ROLES.has(role)) found = "werewolf";
        else if (card !== "doppelganger" && role === "tanner") found = "tanner";
        this._note(n, `你查看了 ${target}号 的牌:${rn(role)}${found ? `。你变成了${rn(found)}!` : ""}`, [this._seatCard(target)]);
        this.nightLog.push(`灵异侦探(${n}号)查看了 ${target}号${found ? `,变成了${rn(found)}` : ""}`);
        if (found) { this._piSet(n, found); return done(); }
        if (sub.viewed.length >= 2) { this._piStop(n, sub); return done(); }
        return { ok: true };
      }
      case "robber": {
        if (kind !== "swapSelf") return { error: "BAD_KIND" };
        const e = chkOther(target); if (e) return { error: e };
        if (me.shield) return { error: "SHIELDED" };
        this._swapCards({ kind: "seat", no: n }, { kind: "seat", no: target });
        this._note(n, `你与 ${target}号 交换了牌,你的新牌是:${rn(this.cardRole(me.card))}`, [this._seatCard(n)]);
        this.nightLog.push(`强盗(${n}号)与 ${target}号 交换了牌`);
        return done();
      }
      case "witch": {
        if (kind === "peekCenter") {
          if (sub.witchIdx != null) return { error: "BAD_KIND" };
          if (!this._validCenter(idx)) return { error: "BAD_TARGET" };
          sub.witchIdx = idx;
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
      case "troublemaker": {
        if (kind !== "swapTwo") return { error: "BAD_KIND" };
        const a = Number(msg.a), b = Number(msg.b);
        if (a === b) return { error: "BAD_TARGET" };
        const e = chkOther(a) || chkOther(b); if (e) return { error: e };
        this._swapCards({ kind: "seat", no: a }, { kind: "seat", no: b });
        this._note(n, `你交换了 ${a}号 和 ${b}号 的牌。`);
        this.nightLog.push(`捣蛋鬼(${n}号)交换了 ${a}号 和 ${b}号 的牌`);
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
        this._note(n, `你把其他玩家的牌向${dir === "left" ? "左" : "右"}移动了一位${ring.length < this.seatNos().length - 1 ? "(被护盾保护的牌没动)" : ""}。`);
        this.nightLog.push(`村庄白痴(${n}号)把其他玩家的牌向${dir === "left" ? "左" : "右"}移了一位`);
        return done();
      }
      case "drunk": {
        if (kind !== "swapCenter") return { error: "BAD_KIND" };
        if (me.shield) return { error: "SHIELDED" };
        if (!this._validCenter(idx)) return { error: "BAD_TARGET" };
        this._swapCards({ kind: "seat", no: n }, { kind: "center", no: idx });
        this._note(n, `你把自己的牌与中央第 ${idx + 1} 张牌交换了(没有看)。`);
        this.nightLog.push(`酒鬼(${n}号)与中央第 ${idx + 1} 张牌交换`);
        return done();
      }
      case "revealer": {
        if (kind !== "reveal") return { error: "BAD_KIND" };
        const e = chkOther(target); if (e) return { error: e };
        const role = this.cardRole(this.seats[target].card);
        if (WOLF_ROLES.has(role) || role === "tanner") {
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
  _piSet(n, found) { if (this.dg && this.dg.seat === n && this.dg.role === "pi") this.dg.piRole = found; else this.pi = { seat: n, found }; }
  _piStop(n) { if (!(this.dg && this.dg.seat === n && this.dg.role === "pi") && !this.pi) this.pi = { seat: n, found: null }; }

  // ───────── 白天 ─────────
  _startDay() {
    this.phase = "day"; this.night.idx = this.night.phases.length;
    this._log("☀️ 天亮了");
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
    if (t === n) return { error: "SELF_TARGET" };
    this.seats[n].vote = t;
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
    const lines = [];
    const isWolf = (n) => WOLF_ROLES.has(final[n]);
    const protectedSet = new Set(seats.filter((n) => final[n] === "bodyguard" && votes[n] != null).map((n) => votes[n]));
    // 得票最多者出局(并列全出局);无人 ≥2 票则无人出局;保镖保护者不出局,若其得票最高则次高者(≥2)出局
    const counts = [...new Set(Object.values(tally))].filter((c) => c >= 2).sort((a, b) => b - a);
    let deaths = [];
    for (const c of counts) {
      const tier = seats.filter((n) => tally[n] === c);
      const unprotected = tier.filter((n) => !protectedSet.has(n));
      if (tier.some((n) => protectedSet.has(n))) lines.push(`🥋 保镖保护了 ${tier.filter((n) => protectedSet.has(n)).map((n) => n + "号").join("、")}`);
      if (unprotected.length) { deaths = unprotected; break; }
      // 本档全被保护 → 看次高档
    }
    if (!counts.length) lines.push("无人得到 2 票以上,没有人出局");
    // 猎人:出局时其投票目标一起出局(可连锁)
    const dead = new Set(deaths);
    let changed = true;
    while (changed) {
      changed = false;
      for (const n of [...dead]) if (final[n] === "hunter" && votes[n] != null && !dead.has(votes[n]) && !protectedSet.has(votes[n])) { dead.add(votes[n]); lines.push(`🏹 猎人 ${n}号 出局,带走了 ${votes[n]}号`); changed = true; }
    }
    deaths = seats.filter((n) => dead.has(n));
    const wolvesInPlay = seats.filter(isWolf);
    const wolfDied = deaths.some(isWolf);
    const tannerDied = deaths.some((n) => final[n] === "tanner");
    const minionInPlay = seats.filter((n) => final[n] === "minion");
    const winTeams = [];
    let villageWin = false, wolfWin = false;
    if (wolvesInPlay.length) {
      villageWin = wolfDied;
      wolfWin = !wolfDied && !tannerDied;
    } else {
      // 场上没有狼:无人出局(或只有爪牙出局)村民胜;有爪牙且非爪牙玩家出局 → 爪牙胜
      const nonMinionDied = deaths.some((n) => final[n] !== "minion");
      villageWin = !nonMinionDied;
      wolfWin = minionInPlay.length > 0 && nonMinionDied && !tannerDied;
    }
    if (villageWin) winTeams.push("village");
    if (wolfWin) winTeams.push("werewolf");
    if (tannerDied) winTeams.push("tanner");
    const winners = seats.filter((n) => {
      const t = this.teamOfRole(final[n]);
      if (t === "tanner") return dead.has(n);
      return winTeams.includes(t);
    });
    if (wolvesInPlay.length) lines.unshift(wolfDied ? "🐺 有狼人出局 → 村民阵营获胜" : (tannerDied ? "皮匠出局,狼人阵营不能获胜" : "没有狼人出局 → 狼人阵营获胜"));
    else lines.unshift(villageWin ? "场上没有狼人且无人出局(或只有爪牙出局)→ 村民阵营获胜" : (wolfWin ? "场上没有狼人,但有人出局 → 爪牙获胜" : "场上没有狼人,有人出局 → 村民阵营失败"));
    if (tannerDied) lines.push("🪢 皮匠出局 → 皮匠获胜");
    this.result = { deaths, tally, votes, winners, winTeams, lines, final, center: this.center.slice(), dg: this.dg, pi: this.pi, wolfSlot: this.wolfSlot };
    this.phase = "over"; this.voting = null;
    this._log(`🏁 结算:${deaths.length ? deaths.map((n) => `${n}号(${rn(final[n])})`).join("、") + " 出局" : "无人出局"};胜方 ${winTeams.map((t) => ({ village: "村民", werewolf: "狼人", tanner: "皮匠" })[t]).join("+") || "无"}`);
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
    const v = { seatNo: s.seatNo, holderDevices: s.holderDevices.slice(), shield: s.shield, revealed: s.revealed, hasVoted: s.vote != null, hasArtifact: !!s.artifact, noteCount: s.notes.length };
    if (mine || over) {
      v.initRole = s.initRole; v.notes = clone(s.notes); v.vote = s.vote;
      if (over || this.phase !== "night") v.artifact = s.artifact;
    }
    if (over) { v.card = s.card; v.finalRole = this.finalRole(s.seatNo); v.team = this.teamOfRole(v.finalRole); }
    return v;
  }
  _roomView(holds) {
    const over = this.phase === "over";
    const nt = this.night;
    let night = null;
    if (this.phase === "night" && nt) {
      const me = {};
      for (const n of holds) if (nt.actors.includes(n)) me[n] = { eff: this._effRole(n), acted: !!nt.acted[n], sub: clone(nt.sub[n] || {}), lone: nt.phases[nt.idx] === "werewolf" ? this._wolvesNow().length === 1 : undefined };
      night = { idx: nt.idx, total: nt.phases.length, role: nt.phases[nt.idx], phases: nt.phases.slice(), startedAt: nt.startedAt, me };
    }
    const voting = this.phase === "vote" ? { startedAt: this.voting.startedAt, voted: this.seatNos().filter((n) => this.seats[n].vote != null).length } : null;
    return {
      phase: this.phase, roles: this.roles.slice(), config: clone(this.config), deckSize: this.deckSize(),
      centerCount: this.center.length, wolfSlot: this.wolfSlot, center: over ? this.center.slice() : null,
      night, day: this.day ? { ...clone(this.day), speaker: this.currentSpeaker() } : null, voting,
      result: this.result ? clone(this.result) : null, log: this.log.slice(0, 80), nightLog: over ? this.nightLog.slice() : null,
      serverNow: this.now(),
    };
  }
  _serializeExtra() {
    return { phase: this.phase, roles: this.roles, config: this.config, center: this.center, wolfSlot: this.wolfSlot, night: this.night, day: this.day, voting: this.voting, result: this.result, dg: this.dg, pi: this.pi, artifactDeck: this.artifactDeck, log: this.log, nightLog: this.nightLog };
  }
  _hydrateExtra(d) {
    for (const k of ["phase", "roles", "config", "center", "wolfSlot", "night", "day", "voting", "result", "dg", "pi", "artifactDeck", "log", "nightLog"]) if (d[k] !== undefined) this[k] = d[k];
    for (const s of Object.values(this.seats)) { // 旧版字段兜底
      if (!s.notes) s.notes = [];
      if (s.shield === undefined) s.shield = false;
    }
    if (this.config) this.config = { ...defaultConfig(), ...this.config };
  }
}
