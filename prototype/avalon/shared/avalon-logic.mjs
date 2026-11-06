// 阿瓦隆房间核心逻辑(线上/线下通用:系统发身份(替代闭眼脚本)→ 队长组队 → 全桌投票 → 队员出任务卡 → 洗乱公布 → 记分 → 湖中仙女 → 刺杀 → 结算)。
// 被 avalon/avalon-sim.mjs(node 断言)与 avalon/worker.mjs(Durable Object)共用;座位/设备骨架继承 common/room-base.mjs。
//
// 保密模型(按设备持有的座位过滤,见 _seatView/_roomView):
//   - 角色 role / 开局信息 knows / 私密笔记 notes(湖中仙女验到的、王者之剑看到的)仅本人可见;结算后全公开。
//   - 投票:投票中只公开"谁已投",全员投完一起亮票(进 history 公开)。任务卡:只公开成功/失败张数,谁出了什么整局保密(结算后公开)。
//   - 队长 / 队伍 / 湖中仙女持有者 / 王者之剑持有者 / 揭示者公开的身份 公开。
// 没有定时器:全部事件驱动(全员投完自动开票,队员全出自动结算),所以不需要 tick。
//
// 动作:core.action(deviceId, {op, ...}):setRoles / recommendRoles / setConfig / startGame / propose{seatNo,team,excalibur} / vote{seatNo,approve}
//       / questCard{seatNo,card} / excalibur{seatNo,target} / ladyCheck{seatNo,target} / assassinate{seatNo,target} / newGame

import { RoomBase, clone } from "../../common/room-base.mjs";
import { ROLE_BY_KEY, PLAYERS, twoFails, LANCELOT_MODES, defaultRoles } from "./avalon-data.mjs";

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const rn = (k) => (ROLE_BY_KEY[k] ? ROLE_BY_KEY[k].name : k);
const TEAM_NAME = { good: "好人", evil: "坏人" };
const EVIL_HIDDEN_FROM_EVIL = new Set(["oberon"]); // 其他坏人看不到的坏人

export function defaultConfig() {
  return { lancelot: "know", lady: false, excalibur: false };
}

export class AvalonCore extends RoomBase {
  static MIN_SEATS = 5;
  static MAX_SEATS = 10;

  constructor(roomCode, seatCount, rng = Math.random) {
    super(roomCode, seatCount, rng);
    this.roles = defaultRoles(this.seatNos().length);
    this.config = defaultConfig();
    this._resetGame();
  }

  _newSeat(i) {
    return { seatNo: i, holderDevices: [],
      role: null, img: null,   // 角色 / 卡图文件名(本人可见)
      knows: [],               // 开局信息 [{seat,tag}](本人可见)
      info: null,              // 开局一句话(牧师等;本人可见)
      notes: [],               // 私密笔记(湖中仙女/王者之剑)
      revealedRole: null,      // 揭示者公开的身份(公开)
      vote: null,              // 本次提议的票 true/false(开票前他人只见是否已投)
      card: null };            // 本次任务出的卡 success/fail(整局保密)
  }
  _clearSeat(s) { Object.assign(s, { role: null, img: null, knows: [], info: null, notes: [], revealedRole: null, vote: null, card: null }); }
  _resetGame() {
    this.phase = "setup";   // setup | teamBuild | vote | quest | lady | assassin | over
    this.questNo = 0;
    this.quests = [];       // [{no,size,twoFails,leader,team,excalibur,sub:"play"|"excalibur"|null,cards:[公开洗乱],fails,result,played:{seat:card},excaliburUse}]
    this.voteTrack = 0;     // 本轮(本任务)连续否决次数,5 = 坏人胜
    this.leader = null;
    this.proposal = null;   // { team:[], excalibur:seat|null }
    this.history = [];      // 所有投票 [{quest,attempt,leader,team,excalibur,votes:{seat:bool},approved}]
    this.lady = null;       // { holder, used:[], history:[{quest,by,target}] }
    this.lancelot = null;   // { mode, deck:[], drawn:[], switched }
    this.result = null;
    this.log = [];
    for (const s of Object.values(this.seats)) this._clearSeat(s);
  }
  _log(msg) { this.log.unshift(msg); if (this.log.length > 200) this.log.pop(); }

  addSeat(id) { if (this.phase !== "setup") return { error: "NOT_SETUP" }; const was = this._isDefault(); const r = super.addSeat(id); if (r.ok && was) this.roles = defaultRoles(this.seatNos().length); return r; }
  removeSeat(id) { if (this.phase !== "setup") return { error: "NOT_SETUP" }; const was = this._isDefault(); const r = super.removeSeat(id); if (r.ok && was) this.roles = defaultRoles(this.seatNos().length); return r; }
  _isDefault() { const d = defaultRoles(this.seatNos().length); return d.length === this.roles.length && d.slice().sort().join() === this.roles.slice().sort().join(); }

  players() { return this.seatNos(); }
  table() { return PLAYERS[this.players().length] || PLAYERS[Math.max(5, Math.min(10, this.players().length))]; }
  _next(n) { const s = this.seatNos(), i = s.indexOf(n); return s[(i + 1) % s.length]; }      // 顺时针下一位
  _prev(n) { const s = this.seatNos(), i = s.indexOf(n); return s[(i + s.length - 1) % s.length]; } // 右手边(逆时针)
  _validSeat(n) { return Number.isInteger(n) && !!this.seats[n]; }
  _roleOf(n) { return this.seats[n].role; }
  _isLancelot(n) { const r = this._roleOf(n); return r === "lancelot_good" || r === "lancelot_evil"; }
  // 座位现在的阵营:兰斯洛特互换后对调
  teamNow(n) {
    const r = this._roleOf(n); if (!r) return null;
    const base = ROLE_BY_KEY[r].team;
    if (this._isLancelot(n) && this.lancelot && this.lancelot.switched) return base === "good" ? "evil" : "good";
    return base;
  }
  // 被验阵营时显示什么:骗子显示好,捣蛋鬼显示坏,其余按当前阵营
  loyaltyShown(n) { const r = this._roleOf(n); if (r === "trickster") return "good"; if (r === "troublemaker") return "evil"; return this.teamNow(n); }
  _evilSeats() { return this.seatNos().filter((n) => ROLE_BY_KEY[this._roleOf(n)].team === "evil"); }
  _seatWithRole(k) { return this.seatNos().find((n) => this._roleOf(n) === k) ?? null; }
  _lancelotVariant() { return this.lancelot && this.lancelot.mode !== "know"; }

  // ───────── 动作分派 ─────────
  action(id, msg) {
    this.connect(id);
    switch (msg.op) {
      case "setRoles": return this._setRoles(msg.roles);
      case "recommendRoles": return this.phase !== "setup" ? { error: "NOT_SETUP" } : (this.roles = defaultRoles(this.seatNos().length), { ok: true });
      case "setConfig": return this._setConfig(msg.config);
      case "startGame": return this._startGame();
      case "propose": return this._propose(id, msg);
      case "vote": return this._vote(id, msg);
      case "questCard": return this._questCard(id, msg);
      case "excalibur": return this._excalibur(id, msg);
      case "ladyCheck": return this._ladyCheck(id, msg);
      case "assassinate": return this._assassinate(id, msg);
      case "newGame": return (this._resetGame(), this._log("新的一局:回到准备阶段"), { ok: true });
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
    if (c.lancelot !== undefined) { if (!LANCELOT_MODES[c.lancelot]) return { error: "BAD_CONFIG" }; cfg.lancelot = c.lancelot; }
    if (c.lady !== undefined) cfg.lady = !!c.lady;
    if (c.excalibur !== undefined) cfg.excalibur = !!c.excalibur;
    this.config = cfg;
    return { ok: true };
  }
  // 开局前的配置检查(准备页也用它显示问题)
  checkRoles() {
    const seats = this.players(), N = seats.length, t = PLAYERS[N];
    if (!t) return { error: "PLAYER_COUNT" };
    if (this.roles.length !== N) return { error: "DECK_SIZE" };
    const evil = this.roles.filter((k) => ROLE_BY_KEY[k].team === "evil").length;
    if (evil !== t.evil) return { error: "EVIL_COUNT", evil, need: t.evil };
    const hasG = this.roles.includes("lancelot_good"), hasE = this.roles.includes("lancelot_evil");
    if (hasG !== hasE) return { error: "LANCELOT_PAIR" };
    if (this.roles.includes("morgana") && !this.roles.includes("percival")) return { error: "MORGANA_NEEDS_PERCIVAL" };
    if (this.roles.includes("merlin") && !this.roles.includes("assassin")) return { error: "MERLIN_NEEDS_ASSASSIN" };
    return { ok: true };
  }

  // ───────── 开局:发身份 + 开局信息 ─────────
  _startGame() {
    if (this.phase !== "setup") return { error: "NOT_SETUP" };
    const chk = this.checkRoles(); if (chk.error) return chk;
    const seats = this.players();
    for (const s of Object.values(this.seats)) this._clearSeat(s);
    const deck = shuffle(this.roles, this.rng);
    const imgIdx = {};
    seats.forEach((n, i) => {
      const k = deck[i], r = ROLE_BY_KEY[k];
      this.seats[n].role = k;
      const j = imgIdx[k] = (imgIdx[k] || 0); imgIdx[k]++;
      this.seats[n].img = r.img[j % r.img.length];
    });
    this.quests = this.table().quests.map((size, i) => ({ no: i + 1, size, twoFails: twoFails(seats.length, i + 1), leader: null, team: [], excalibur: null, sub: null, cards: null, fails: null, result: null, played: null, excaliburUse: null }));
    this.history = []; this.result = null; this.voteTrack = 0;
    this.leader = seats[Math.floor(this.rng() * seats.length)];
    this.lady = this.config.lady ? { holder: this._prev(this.leader), used: [], history: [] } : null;
    if (this.roles.includes("lancelot_good")) {
      const mode = this.config.lancelot;
      const l = { mode, deck: [], drawn: [], switched: false };
      if (mode === "random") l.deck = shuffle(["no", "no", "no", "no", "switch", "switch"], this.rng);
      if (mode === "preset") l.deck = shuffle(["no", "no", "no", "no", "no", "switch", "switch"], this.rng).slice(0, 5);
      this.lancelot = l;
    } else this.lancelot = null;
    this._computeKnows();
    this._log(`开局:${seats.length} 人(好 ${this.table().good} / 坏 ${this.table().evil}),角色 ${this.roles.map(rn).join("、")};首任队长 ${this.leader}号${this.lady ? `;湖中仙女在 ${this.lady.holder}号` : ""}${this.config.excalibur ? ";启用王者之剑" : ""}`);
    if (this.lancelot && this.lancelot.mode === "preset") this._log(`兰斯洛特阵营卡(按任务 1~5):${this.lancelot.deck.map((c) => (c === "switch" ? "互换" : "不变")).join(" / ")}`);
    this._beginQuest(1);
    return { ok: true };
  }
  _computeKnows() {
    const seats = this.seatNos(), evil = this._evilSeats(), variant = this._lancelotVariant();
    for (const n of seats) {
      const s = this.seats[n], r = s.role, me = ROLE_BY_KEY[r];
      s.knows = []; s.info = null;
      if (r === "merlin") {
        for (const e of evil) if (this._roleOf(e) !== "mordred") s.knows.push({ seat: e, tag: "坏人" });
        s.info = evil.some((e) => this._roleOf(e) === "mordred") ? "坏人里有莫德雷德,你看不到他。" : null;
      } else if (r === "percival") {
        for (const x of seats) if (this._roleOf(x) === "merlin" || this._roleOf(x) === "morgana") s.knows.push({ seat: x, tag: this.roles.includes("morgana") ? "梅林或莫甘娜" : "梅林" });
      } else if (r === "cleric") {
        s.info = `首任队长 ${this.leader}号 显示为「${TEAM_NAME[this.loyaltyShown(this.leader)]}」。`;
      } else if (me.team === "evil") {
        const blind = r === "oberon" || (variant && r === "lancelot_evil"); // 奥伯伦 / 变体下的坏兰斯洛特:不认识其他坏人
        if (!blind) for (const e of evil) if (e !== n && !EVIL_HIDDEN_FROM_EVIL.has(this._roleOf(e))) s.knows.push({ seat: e, tag: "坏人同伴" });
        if (r === "oberon") s.info = "你不知道其他坏人,他们也不知道你。";
        else if (variant && r === "lancelot_evil") s.info = "变体规则:你不知道其他坏人,但他们知道你。";
        else if (evil.some((e) => this._roleOf(e) === "oberon")) s.info = "坏人里还有一个奥伯伦,你看不到他。";
      }
      if (this._isLancelot(n) && this.lancelot && this.lancelot.mode === "know") {
        const other = seats.find((x) => x !== n && this._isLancelot(x));
        if (other != null) s.knows.push({ seat: other, tag: "另一位兰斯洛特(对立阵营)" });
      }
    }
  }

  // ───────── 任务轮 ─────────
  _beginQuest(k) {
    if (k > 1) this.leader = this._next(this.leader); // 每个任务结算后队长顺时针传
    this.questNo = k; this.voteTrack = 0; this.proposal = null;
    if (this.lancelot) {
      const l = this.lancelot; let card = null;
      if (l.mode === "random") card = l.deck.shift() || "no";
      if (l.mode === "preset") card = l.deck[k - 1];
      if (card) { l.drawn.push(card); if (card === "switch") { l.switched = !l.switched; this._log(`🔄 第 ${k} 任务开始:兰斯洛特阵营卡「互换」—— 两位兰斯洛特秘密互换阵营`); } else this._log(`第 ${k} 任务开始:兰斯洛特阵营卡「不变」`); }
    }
    this.phase = "teamBuild";
    this._log(`🏰 第 ${k} 任务(${this.quests[k - 1].size} 人${this.quests[k - 1].twoFails ? ",需两张失败" : ""}),队长 ${this.leader}号 组队`);
  }
  _propose(id, msg) {
    if (this.phase !== "teamBuild") return { error: "NOT_TEAMBUILD" };
    if (!this.isHolder(id, this.leader)) return { error: "NOT_LEADER" };
    const q = this.quests[this.questNo - 1];
    const team = Array.isArray(msg.team) ? msg.team.map(Number) : [];
    if (team.length !== q.size || new Set(team).size !== team.length || !team.every((n) => this._validSeat(n))) return { error: "BAD_TEAM" };
    let ex = null;
    if (this.config.excalibur) {
      ex = msg.excalibur != null ? Number(msg.excalibur) : null;
      if (ex == null || !team.includes(ex) || ex === this.leader) return { error: "BAD_EXCALIBUR" };
    }
    for (const s of Object.values(this.seats)) s.vote = null;
    this.proposal = { team: team.slice().sort((a, b) => a - b), excalibur: ex };
    this.phase = "vote";
    this._log(`📜 ${this.leader}号 提议队伍:${team.map((n) => n + "号").join("、")}${ex != null ? `(王者之剑给 ${ex}号)` : ""},请投票`);
    return { ok: true };
  }
  _vote(id, msg) {
    if (this.phase !== "vote") return { error: "NOT_VOTE" };
    const n = Number(msg.seatNo);
    if (!this.isHolder(id, n)) return { error: "NOT_HOLDER" };
    this.seats[n].vote = !!msg.approve;
    if (this.seatNos().every((x) => this.seats[x].vote != null)) this._resolveVote();
    return { ok: true };
  }
  _resolveVote() {
    const seats = this.seatNos(), votes = {}; let yes = 0;
    for (const n of seats) { votes[n] = this.seats[n].vote; if (votes[n]) yes++; }
    const approved = yes * 2 > seats.length;
    const p = this.proposal, attempt = this.voteTrack + 1;
    this.history.push({ quest: this.questNo, attempt, leader: this.leader, team: p.team.slice(), excalibur: p.excalibur, votes, approved });
    this._log(`🗳️ 第 ${this.questNo} 任务第 ${attempt} 次投票:赞成 ${yes} / 反对 ${seats.length - yes} → ${approved ? "通过" : "否决"}`);
    for (const s of Object.values(this.seats)) s.vote = null;
    if (approved) {
      const q = this.quests[this.questNo - 1];
      Object.assign(q, { leader: this.leader, team: p.team.slice(), excalibur: p.excalibur, sub: "play", played: {} });
      for (const s of Object.values(this.seats)) s.card = null;
      this.proposal = null; this.phase = "quest"; this.voteTrack = 0;
      return;
    }
    this.voteTrack = attempt;
    this.proposal = null;
    if (this.voteTrack >= 5) return this._gameOver("evil", "同一任务连续 5 次否决");
    this.leader = this._next(this.leader);
    this.phase = "teamBuild";
    this._log(`队长传给 ${this.leader}号(本任务已否决 ${this.voteTrack} 次)`);
  }
  // 该座位本次任务能出哪些卡
  allowedCards(n) {
    const r = this._roleOf(n), team = this.teamNow(n);
    if (team === "good") return ["success"];
    if (r === "lunatic") return ["fail"];
    if (r === "brute" && this.questNo > 3) return ["success"];
    return ["success", "fail"];
  }
  _questCard(id, msg) {
    if (this.phase !== "quest") return { error: "NOT_QUEST" };
    const q = this.quests[this.questNo - 1];
    if (q.sub !== "play") return { error: "CARDS_LOCKED" };
    const n = Number(msg.seatNo);
    if (!this.isHolder(id, n)) return { error: "NOT_HOLDER" };
    if (!q.team.includes(n)) return { error: "NOT_ON_TEAM" };
    if (!this.allowedCards(n).includes(msg.card)) return { error: "CARD_NOT_ALLOWED" };
    this.seats[n].card = msg.card;
    if (q.team.every((x) => this.seats[x].card != null)) {
      q.played = {}; for (const x of q.team) q.played[x] = this.seats[x].card;
      if (q.excalibur != null) q.sub = "excalibur"; else this._resolveQuest();
    }
    return { ok: true };
  }
  _excalibur(id, msg) {
    if (this.phase !== "quest") return { error: "NOT_QUEST" };
    const q = this.quests[this.questNo - 1];
    if (q.sub !== "excalibur") return { error: "NOT_EXCALIBUR" };
    if (!this.isHolder(id, q.excalibur)) return { error: "NOT_HOLDER" };
    const t = msg.target != null ? Number(msg.target) : null;
    if (t != null) {
      if (!q.team.includes(t) || t === q.excalibur) return { error: "BAD_TARGET" };
      const orig = q.played[t];
      q.played[t] = orig === "success" ? "fail" : "success";
      q.excaliburUse = { by: q.excalibur, target: t, original: orig };
      this.seats[q.excalibur].notes.push(`第 ${q.no} 任务:你用王者之剑换掉了 ${t}号 的卡,他原本出的是「${orig === "fail" ? "失败" : "成功"}」`);
      this._log(`⚔️ ${q.excalibur}号 用王者之剑换掉了 ${t}号 的任务卡`);
    } else this._log(`⚔️ ${q.excalibur}号 没有使用王者之剑`);
    this._resolveQuest();
    return { ok: true };
  }
  _resolveQuest() {
    const q = this.quests[this.questNo - 1];
    const vals = Object.values(q.played);
    q.fails = vals.filter((c) => c === "fail").length;
    q.cards = shuffle(vals, this.rng);
    q.result = q.fails >= (q.twoFails ? 2 : 1) ? "fail" : "success";
    q.sub = null;
    for (const s of Object.values(this.seats)) s.card = null;
    this._log(`${q.result === "success" ? "✅" : "❌"} 第 ${q.no} 任务${q.result === "success" ? "成功" : "失败"}:成功 ${vals.length - q.fails} 张 / 失败 ${q.fails} 张`);
    const fails = this.quests.filter((x) => x.result === "fail").length, succ = this.quests.filter((x) => x.result === "success").length;
    if (fails === 2) for (const n of this.seatNos()) if (this._roleOf(n) === "revealer" && !this.seats[n].revealedRole) { this.seats[n].revealedRole = "revealer"; this._log(`📣 第二次任务失败:${n}号 的身份公开 —— 揭示者(坏人)`); }
    if (fails >= 3) return this._gameOver("evil", "三次任务失败");
    if (succ >= 3) {
      if (this.roles.includes("merlin") && this._seatWithRole("assassin") != null) { this.phase = "assassin"; this._log("🎯 三次任务成功!坏人请商量,由刺客指认梅林"); return; }
      return this._gameOver("good", "三次任务成功(本局没有梅林/刺客,无刺杀)");
    }
    if (this.lady && [2, 3, 4].includes(q.no)) { this.phase = "lady"; this._log(`🧝 湖中仙女:${this.lady.holder}号 请验一名玩家`); return; }
    this._beginQuest(q.no + 1);
  }
  _ladyCheck(id, msg) {
    if (this.phase !== "lady") return { error: "NOT_LADY" };
    const L = this.lady, t = Number(msg.target);
    if (!this.isHolder(id, L.holder)) return { error: "NOT_HOLDER" };
    if (!this._validSeat(t) || t === L.holder) return { error: "BAD_TARGET" };
    if (L.used.includes(t)) return { error: "LADY_USED" };
    const shown = this.loyaltyShown(t);
    this.seats[L.holder].notes.push(`第 ${this.questNo} 任务后:湖中仙女验 ${t}号 —— 显示为「${TEAM_NAME[shown]}」`);
    L.history.push({ quest: this.questNo, by: L.holder, target: t });
    L.used.push(L.holder);
    this._log(`🧝 ${L.holder}号 用湖中仙女验了 ${t}号,标记交给 ${t}号`);
    L.holder = t;
    this._beginQuest(this.questNo + 1);
    return { ok: true };
  }
  _assassinate(id, msg) {
    if (this.phase !== "assassin") return { error: "NOT_ASSASSIN" };
    const a = this._seatWithRole("assassin"), t = Number(msg.target);
    if (!this.isHolder(id, a)) return { error: "NOT_HOLDER" };
    if (!this._validSeat(t) || t === a) return { error: "BAD_TARGET" };
    const hit = this._roleOf(t) === "merlin";
    this._log(`🗡️ 刺客 ${a}号 指认 ${t}号 为梅林 → ${hit ? "命中!" : "不是梅林"}`);
    this._gameOver(hit ? "evil" : "good", hit ? `刺客刺中梅林(${t}号)` : `刺客指错(${t}号 是${rn(this._roleOf(t))}),三次任务成功`, { assassinTarget: t });
    return { ok: true };
  }
  _gameOver(winner, reason, extra) {
    this.phase = "over"; this.proposal = null;
    const roles = {}, teams = {};
    for (const n of this.seatNos()) { roles[n] = this._roleOf(n); teams[n] = this.teamNow(n); }
    this.result = { winner, reason, roles, teams, winners: this.seatNos().filter((n) => teams[n] === winner), ...(extra || {}) };
    this._log(`🏁 ${TEAM_NAME[winner]}获胜:${reason}`);
  }

  // ───────── 视图 ─────────
  _seatView(s, holds) {
    const mine = holds.has(s.seatNo), over = this.phase === "over";
    const q = this.phase === "quest" ? this.quests[this.questNo - 1] : null;
    const team = this.phase === "vote" ? this.proposal.team : q ? q.team : [];
    const v = { seatNo: s.seatNo, holderDevices: s.holderDevices.slice(),
      leader: this.leader === s.seatNo, onTeam: team.includes(s.seatNo),
      voted: this.phase === "vote" && s.vote != null,
      played: !!(q && q.sub === "play" && s.card != null),
      excalibur: (this.phase === "vote" && this.proposal.excalibur === s.seatNo) || (q != null && q.excalibur === s.seatNo),
      lady: !!(this.lady && this.lady.holder === s.seatNo),
      revealedRole: s.revealedRole };
    if (mine || over) { v.role = s.role; v.img = s.img; v.knows = clone(s.knows); v.info = s.info; v.notes = s.notes.slice(); v.vote = s.vote; v.card = s.card; v.allowed = this.phase === "quest" && team.includes(s.seatNo) ? this.allowedCards(s.seatNo) : null; }
    if (over) v.team = this.result ? this.result.teams[s.seatNo] : this.teamNow(s.seatNo);
    return v;
  }
  _roomView(holds) {
    const over = this.phase === "over", N = this.seatNos().length;
    const q = this.phase === "quest" ? this.quests[this.questNo - 1] : null;
    const quests = this.quests.map((x) => ({ no: x.no, size: x.size, twoFails: x.twoFails, leader: x.leader, team: x.team.slice(), excalibur: x.excalibur, sub: x.sub, cards: x.cards, fails: x.fails, result: x.result,
      playedCount: x.sub === "play" ? x.team.filter((n) => this.seats[n].card != null).length : null, played: over ? x.played : null, excaliburUse: over ? x.excaliburUse : (x.excaliburUse ? { by: x.excaliburUse.by, target: x.excaliburUse.target } : null) }));
    // 刺杀阶段:坏人(本设备持有的座位里有坏人)看到刺客是谁,好人只看到"刺客选择中"
    let assassin = null;
    if (this.phase === "assassin") { const a = this._seatWithRole("assassin"); const iAmEvil = [...holds].some((n) => this.seats[n] && ROLE_BY_KEY[this.seats[n].role]?.team === "evil"); assassin = { seat: iAmEvil || holds.has(a) ? a : null }; }
    return {
      phase: this.phase, roles: this.roles.slice(), config: clone(this.config), table: PLAYERS[N] ? clone(PLAYERS[N]) : null, rolesCheck: this.phase === "setup" ? this.checkRoles() : null,
      questNo: this.questNo, quests, voteTrack: this.voteTrack, leader: this.leader,
      proposal: this.proposal ? { team: this.proposal.team.slice(), excalibur: this.proposal.excalibur, votedCount: this.seatNos().filter((n) => this.seats[n].vote != null).length } : null,
      history: clone(this.history),
      lady: this.lady ? { holder: this.lady.holder, used: this.lady.used.slice(), history: clone(this.lady.history) } : null,
      lancelot: this.lancelot ? { mode: this.lancelot.mode, drawn: this.lancelot.drawn.slice(), preset: this.lancelot.mode === "preset" ? this.lancelot.deck.slice() : null, switched: this.lancelot.mode === "know" ? false : this.lancelot.switched } : null,
      assassin, result: this.result ? clone(this.result) : null, log: this.log.slice(0, 80),
    };
  }
  _serializeExtra() {
    return { phase: this.phase, roles: this.roles, config: this.config, questNo: this.questNo, quests: this.quests, voteTrack: this.voteTrack, leader: this.leader, proposal: this.proposal, history: this.history, lady: this.lady, lancelot: this.lancelot, result: this.result, log: this.log };
  }
  _hydrateExtra(d) {
    for (const k of ["phase", "roles", "config", "questNo", "quests", "voteTrack", "leader", "proposal", "history", "lady", "lancelot", "result", "log"]) if (d[k] !== undefined) this[k] = d[k];
    if (this.config) this.config = { ...defaultConfig(), ...this.config };
    for (const s of Object.values(this.seats)) { if (!s.knows) s.knows = []; if (!s.notes) s.notes = []; }
  }
}
