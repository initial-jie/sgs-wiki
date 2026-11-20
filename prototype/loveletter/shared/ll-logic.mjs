// 情书(Love Letter)房间核心逻辑 —— 线上版:系统洗牌发牌、轮到谁自动抽牌、打牌选目标、效果即时结算、轮末比点数发爱慕标记、集满结束。
// 被 loveletter/ll-sim.mjs(node 断言)与 loveletter/worker.mjs(Durable Object)共用;座位/设备骨架继承 common/room-base.mjs。
//
// 保密模型(按设备持有的座位过滤,见 _seatView/_roomView):
//   - 手牌 hand 仅本人可见(他人只见张数 handCount);轮次结束(roundEnd/over)全公开。
//   - 私密笔记 notes(神父偷看到的、男爵比牌看到的)仅本人可见,整局不公开。
//   - 弃牌堆 discards(按打出顺序)/ 受保护 protected / 出局 out / 标记 tokens / 当前回合 turn / 牌堆张数 deckCount / 2 人局翻开的 3 张 faceUp 公开。
//   - 开局移出的那张 removed 不公开(王子在牌堆空时抽它才进手牌)。
// 没有定时器:全部事件驱动。
//
// 组队模式(config.mode="team",用户线下玩法):6/8/9 人开局随机分队(seat.team),队友只对本队可见(终局公开),可对队友出牌;队内任一人集满 3 枚全队胜;牌组 29 张(见 ll-data TEAM)。
// 动作:core.action(deviceId, {op, ...}):setConfig{config:{edition,tokens,mode}} / startGame / play{seatNo,card,target?,guess?} / chancellor{seatNo,keep,bottom:[…]} / nextRound / newGame
// 阶段 phase:setup → play(sub "play" 等当前玩家打牌 | "chancellor" 等他从三张里留一张)→ roundEnd(本轮结算,等 nextRound)→ … → over

import { RoomBase, clone } from "../../common/room-base.mjs";
import { EDITIONS, DEFAULT_EDITION, CARD_BY_KEY, TEAM, MODES, buildDeck, rankOf, tokensToWin } from "./ll-data.mjs";

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const cn = (k) => (CARD_BY_KEY[k] ? CARD_BY_KEY[k].name : k);

export function defaultConfig() { return { edition: DEFAULT_EDITION, tokens: null, mode: "ffa" }; } // tokens:null=按人数表;数字=房规覆盖;mode ffa|team

export class LoveLetterCore extends RoomBase {
  static MIN_SEATS = 2;
  static MAX_SEATS = 9;

  constructor(roomCode, seatCount, rng = Math.random) {
    super(roomCode, seatCount, rng);
    this.config = defaultConfig();
    this._resetGame();
  }

  _newSeat(i) {
    return { seatNo: i, holderDevices: [],
      hand: [],          // 手牌 key 数组(本人可见;平时 1 张,轮到自己 2 张,大臣结算中最多 3 张)
      discards: [],      // 弃牌堆(公开,按打出/弃掉顺序)
      out: false,        // 本轮出局
      protected: false,  // 侍女保护中(到自己下个回合开始)
      tokens: 0,         // 爱慕标记
      team: null,        // 组队模式的队号 1..k(本队可见;终局公开)
      notes: [] };       // 私密笔记 [{round,text}]
  }
  _clearRoundSeat(s) { Object.assign(s, { hand: [], discards: [], out: false, protected: false, notes: [] }); }
  _resetGame() {
    this.phase = "setup";    // setup | play | roundEnd | over
    this.sub = null;         // play 阶段:play | chancellor
    this.round = 0;
    this.turn = null;        // 当前回合座位
    this.starter = null;     // 本轮先手(上轮赢家)
    this.deck = [];          // deck[0] 为牌堆顶
    this.removed = null;     // 开局移出的一张(盖着)
    this.faceUp = [];        // 2 人局额外翻开的 3 张(公开)
    this.roundResult = null; // 上一轮结算 {round,reason,hands,winners,spyBonus,sums}
    this.history = [];       // 每轮结算摘要
    this.result = null;      // 终局 {winners,need}
    this.log = [];
    for (const s of Object.values(this.seats)) { this._clearRoundSeat(s); s.tokens = 0; s.team = null; }
  }
  _log(msg) { this.log.unshift(msg); if (this.log.length > 300) this.log.pop(); }

  addSeat(id) { if (this.phase !== "setup") return { error: "NOT_SETUP" }; return super.addSeat(id); }
  removeSeat(id) { if (this.phase !== "setup") return { error: "NOT_SETUP" }; return super.removeSeat(id); }

  edition() { return EDITIONS[this.config.edition] || EDITIONS[DEFAULT_EDITION]; }
  rank(k) { return rankOf(this.config.edition, k); }
  isTeam() { return this.config.mode === "team"; }
  need() { return this.config.tokens || (this.isTeam() ? TEAM.tokensToWin : tokensToWin(this.config.edition, this.seatNos().length)) || null; }
  teamOf(n) { return this.seats[n] ? this.seats[n].team : null; }
  teammates(n) { const t = this.teamOf(n); return t == null ? [] : this.seatNos().filter((m) => m !== n && this.seats[m].team === t); }
  players() { return this.seatNos(); }
  alive() { return this.seatNos().filter((n) => !this.seats[n].out); }
  _nextAlive(n) { const s = this.seatNos(); let i = s.indexOf(n); for (let k = 0; k < s.length; k++) { i = (i + 1) % s.length; if (!this.seats[s[i]].out) return s[i]; } return n; }
  _validSeat(n) { return Number.isInteger(n) && !!this.seats[n]; }
  // 开局前检查(准备页也用它显示问题)
  check() {
    const N = this.seatNos().length, ed = this.edition();
    if (this.isTeam()) return TEAM.players[N] ? { ok: true, teams: TEAM.players[N].teams, size: TEAM.players[N].size } : { error: "TEAM_COUNT" };
    if (N < ed.minPlayers || N > ed.maxPlayers) return { error: "PLAYER_COUNT", min: ed.minPlayers, max: ed.maxPlayers };
    return { ok: true };
  }
  // 当前回合玩家可选的目标:other = 其他未出局且未受保护;any = 再加自己
  targets() {
    if (this.phase !== "play" || this.turn == null) return { other: [], any: [] };
    const other = this.alive().filter((n) => n !== this.turn && !this.seats[n].protected);
    return { other, any: [this.turn, ...other] };
  }
  // 手里同时有伯爵夫人与国王/王子 → 必须出伯爵夫人
  countessForced(n) { const h = this.seats[n].hand; return h.includes("countess") && (h.includes("king") || h.includes("prince")); }

  // ───────── 动作分派 ─────────
  action(id, msg) {
    this.connect(id);
    switch (msg.op) {
      case "setConfig": return this._setConfig(msg.config);
      case "startGame": return this._startGame();
      case "play": return this._play(id, msg);
      case "chancellor": return this._chancellor(id, msg);
      case "nextRound": return this._nextRound();
      case "newGame": return (this._resetGame(), this._log("新的一局:回到准备阶段"), { ok: true });
      default: return { error: "BAD_OP" };
    }
  }

  _setConfig(c) {
    if (this.phase !== "setup") return { error: "NOT_SETUP" };
    if (!c || typeof c !== "object") return { error: "BAD_CONFIG" };
    const cfg = { ...this.config };
    if (c.edition !== undefined) { if (!EDITIONS[c.edition]) return { error: "BAD_CONFIG" }; cfg.edition = c.edition; }
    if (c.tokens !== undefined) { if (c.tokens !== null && !(Number.isInteger(c.tokens) && c.tokens >= 1 && c.tokens <= 20)) return { error: "BAD_CONFIG" }; cfg.tokens = c.tokens; }
    if (c.mode !== undefined) { if (!MODES[c.mode]) return { error: "BAD_CONFIG" }; cfg.mode = c.mode; }
    if (cfg.mode === "team") cfg.edition = TEAM.edition; // 组队牌组按 2019 版点数
    this.config = cfg;
    return { ok: true };
  }

  // ───────── 开局 / 开轮 ─────────
  _startGame() {
    if (this.phase !== "setup") return { error: "NOT_SETUP" };
    const chk = this.check(); if (chk.error) return chk;
    for (const s of Object.values(this.seats)) { this._clearRoundSeat(s); s.tokens = 0; s.team = null; }
    this.round = 0; this.history = []; this.result = null; this.roundResult = null;
    const seats = this.seatNos();
    this.starter = seats[Math.floor(this.rng() * seats.length)];
    if (this.isTeam()) { // 落座后随机分队:洗乱座位按队伍人数切块
      const { size } = TEAM.players[seats.length];
      shuffle(seats, this.rng).forEach((n, i) => { this.seats[n].team = Math.floor(i / size) + 1; });
      this._log(`开局:组队赛,${seats.length} 人随机分成 ${chk.teams} 队(每队 ${size} 人,队友只对本队可见),队内任一人集满 ${this.need()} 枚爱慕标记全队胜;随机 ${this.starter}号 先手`);
    } else this._log(`开局:${this.edition().name},${seats.length} 人,先集满 ${this.need()} 枚爱慕标记者胜;随机 ${this.starter}号 先手`);
    this._startRound();
    return { ok: true };
  }
  _nextRound() {
    if (this.phase !== "roundEnd") return { error: "NOT_ROUND_END" };
    this._startRound();
    return { ok: true };
  }
  _startRound() {
    this.round++;
    for (const s of Object.values(this.seats)) this._clearRoundSeat(s);
    const N = this.seatNos().length;
    this.deck = shuffle(buildDeck(this.config.edition, this.config.mode), this.rng);
    this.removed = this.deck.shift();
    this.faceUp = N === 2 ? [this.deck.shift(), this.deck.shift(), this.deck.shift()] : [];
    for (const n of this.seatNos()) this.seats[n].hand = [this.deck.shift()];
    this.phase = "play"; this.sub = "play";
    this.turn = this.starter;
    this._log(`第 ${this.round} 轮开始:每人 1 张手牌,盖掉 1 张${N === 2 ? `,翻开 ${this.faceUp.map(cn).join("/")}` : ""};${this.turn}号 先手`);
    this._beginTurn();
  }
  _beginTurn() {
    const s = this.seats[this.turn];
    s.protected = false; // 侍女保护到自己下个回合开始为止
    if (this.deck.length) s.hand.push(this.deck.shift());
    this.sub = "play";
  }

  // ───────── 打牌 ─────────
  _play(id, msg) {
    if (this.phase !== "play" || this.sub !== "play") return { error: "NOT_PLAY" };
    const n = Number(msg.seatNo);
    if (!this.isHolder(id, n)) return { error: "NOT_HOLDER" };
    if (n !== this.turn) return { error: "NOT_YOUR_TURN" };
    const s = this.seats[n], card = msg.card;
    if (!s.hand.includes(card)) return { error: "NOT_IN_HAND" };
    if (this.countessForced(n) && card !== "countess") return { error: "COUNTESS_FORCED" };
    const def = CARD_BY_KEY[card];
    const tg = this.targets();
    let target = null;
    if (def.target !== "none") {
      const pool = def.target === "any" ? tg.any : tg.other;
      if (pool.length) {
        target = Number(msg.target);
        if (!pool.includes(target)) return { error: "BAD_TARGET" };
      }
    }
    let guess = null;
    if (def.needGuess && target != null) {
      guess = msg.guess;
      if (!guess || !CARD_BY_KEY[guess] || guess === "guard" || !this.edition().deck[guess]) return { error: "BAD_GUESS" };
    }
    // 出牌:从手牌到弃牌堆
    s.hand.splice(s.hand.indexOf(card), 1);
    s.discards.push(card);
    const who = `${n}号`;
    if (def.target !== "none" && target == null) {
      this._log(`${who} 打出 ${cn(card)}:没有可选目标,无效果`);
    } else switch (card) {
      case "guard": {
        const t = this.seats[target], hit = t.hand[0] === guess;
        this._log(`${who} 打出 侍卫,猜 ${target}号 是「${cn(guess)}」:${hit ? "猜中!" : "猜错"}`);
        if (hit) this._eliminate(target, "被侍卫猜中");
        break;
      }
      case "priest": {
        const t = this.seats[target];
        s.notes.push({ round: this.round, text: `神父:${target}号 的手牌是「${cn(t.hand[0])}」` });
        this._log(`${who} 打出 神父,偷看了 ${target}号 的手牌`);
        break;
      }
      case "baron": {
        const t = this.seats[target], a = s.hand[0], b = t.hand[0], ra = this.rank(a), rb = this.rank(b);
        s.notes.push({ round: this.round, text: `男爵:与 ${target}号 比牌,他是「${cn(b)}」(${rb}),你是「${cn(a)}」(${ra})` });
        t.notes.push({ round: this.round, text: `男爵:${n}号 与你比牌,他是「${cn(a)}」(${ra}),你是「${cn(b)}」(${rb})` });
        if (ra === rb) this._log(`${who} 打出 男爵,与 ${target}号 比牌:点数相同,无事发生`);
        else { const loser = ra < rb ? n : target; this._log(`${who} 打出 男爵,与 ${target}号 比牌:${loser}号 点数低`); this._eliminate(loser, "男爵比牌落败"); }
        break;
      }
      case "handmaid":
        s.protected = true;
        this._log(`${who} 打出 侍女:到下个回合前不受影响`);
        break;
      case "prince": {
        const t = this.seats[target], dropped = t.hand.shift();
        t.discards.push(dropped);
        this._log(`${who} 打出 王子,让 ${target}号 弃掉「${cn(dropped)}」${target === n ? "(自己)" : ""}`);
        if (dropped === "princess") { this._eliminate(target, "被王子逼弃公主"); break; }
        if (this.deck.length) t.hand.push(this.deck.shift());
        else if (this.removed) { t.hand.push(this.removed); this.removed = null; this._log(`牌堆已空,${target}号 抽了开局盖掉的那张`); }
        break;
      }
      case "king": {
        const t = this.seats[target];
        [s.hand, t.hand] = [t.hand, s.hand];
        this._log(`${who} 打出 国王,与 ${target}号 交换手牌`);
        break;
      }
      case "chancellor": {
        if (!this.deck.length) { this._log(`${who} 打出 大臣:牌堆已空,无效果`); break; }
        const k = Math.min(2, this.deck.length);
        for (let i = 0; i < k; i++) s.hand.push(this.deck.shift());
        this.sub = "chancellor";
        this._log(`${who} 打出 大臣,抽 ${k} 张后从 ${s.hand.length} 张里留一张`);
        return { ok: true }; // 等他选留哪张
      }
      case "countess": this._log(`${who} 打出 伯爵夫人`); break;
      case "spy": this._log(`${who} 打出 间谍`); break;
      case "princess": this._log(`${who} 打出 公主!`); this._eliminate(n, "弃掉了公主"); break;
      default: this._log(`${who} 打出 ${cn(card)}`);
    }
    this._endTurn();
    return { ok: true };
  }
  _chancellor(id, msg) {
    if (this.phase !== "play" || this.sub !== "chancellor") return { error: "NOT_CHANCELLOR" };
    const n = Number(msg.seatNo);
    if (!this.isHolder(id, n)) return { error: "NOT_HOLDER" };
    if (n !== this.turn) return { error: "NOT_YOUR_TURN" };
    const s = this.seats[n], keep = msg.keep, bottom = Array.isArray(msg.bottom) ? msg.bottom.slice() : [];
    if (!s.hand.includes(keep)) return { error: "NOT_IN_HAND" };
    const rest = s.hand.slice(); rest.splice(rest.indexOf(keep), 1);
    if (bottom.length !== rest.length || rest.slice().sort().join() !== bottom.slice().sort().join()) return { error: "BAD_BOTTOM" };
    s.hand = [keep];
    for (const c of bottom) this.deck.push(c); // bottom[0] 先放(更靠上),bottom[last] 在最底
    this._log(`${n}号 留下一张,${bottom.length} 张放回牌堆底`);
    this._endTurn();
    return { ok: true };
  }
  // 出局:手牌翻开进弃牌堆(不结算效果)
  _eliminate(n, why) {
    const s = this.seats[n];
    s.out = true; s.protected = false;
    if (s.hand.length) { this._log(`${n}号 出局(${why}),翻开手牌「${s.hand.map(cn).join("/")}」`); s.discards.push(...s.hand); }
    else this._log(`${n}号 出局(${why})`);
    s.hand = [];
  }
  _endTurn() {
    this.sub = "play";
    const alive = this.alive();
    if (alive.length <= 1) return this._endRound("last");
    if (!this.deck.length) return this._endRound("deck");
    this.turn = this._nextAlive(this.turn);
    this._beginTurn();
  }

  // ───────── 轮末结算 ─────────
  _endRound(reason) {
    const alive = this.alive();
    const hands = {}, sums = {};
    for (const n of this.seatNos()) { hands[n] = this.seats[n].hand[0] || null; sums[n] = this.seats[n].discards.reduce((a, c) => a + this.rank(c), 0); }
    let winners;
    if (alive.length === 1) winners = alive.slice();
    else {
      const top = Math.max(...alive.map((n) => this.rank(hands[n])));
      const tied = alive.filter((n) => this.rank(hands[n]) === top);
      if (tied.length === 1) winners = tied;
      else { const ts = Math.max(...tied.map((n) => sums[n])); winners = tied.filter((n) => sums[n] === ts); }
    }
    for (const n of winners) this.seats[n].tokens++;
    // 2019 新版间谍:仍在局内的玩家中唯一打出/弃过间谍的人 +1
    let spyBonus = null;
    if (this.edition().deck.spy) { const spies = alive.filter((n) => this.seats[n].discards.includes("spy")); if (spies.length === 1) { spyBonus = spies[0]; this.seats[spyBonus].tokens++; } }
    this.roundResult = { round: this.round, reason, hands, sums, winners, spyBonus, tokens: Object.fromEntries(this.seatNos().map((n) => [n, this.seats[n].tokens])) };
    this.history.push(clone(this.roundResult));
    this._log(`第 ${this.round} 轮结束(${reason === "last" ? "只剩一人" : "牌堆抽完"}):${winners.join("/")}号 获得爱慕标记${spyBonus != null ? `;${spyBonus}号 间谍加成 +1` : ""}`);
    // 下轮先手:赢家(多人并列取座位号最小的那位)
    this.starter = winners.slice().sort((a, b) => a - b)[0];
    this.turn = null;
    const need = this.need();
    const champs = this.seatNos().filter((n) => this.seats[n].tokens >= need);
    if (champs.length) {
      const top = Math.max(...champs.map((n) => this.seats[n].tokens));
      const best = champs.filter((n) => this.seats[n].tokens === top);
      if (this.isTeam()) { // 队内任一人集满 → 全队胜(多队同时集满则都算赢)
        const teams = [...new Set(best.map((n) => this.teamOf(n)))];
        this.result = { winners: this.seatNos().filter((n) => teams.includes(this.teamOf(n))), need, teams, by: best, teamOf: Object.fromEntries(this.seatNos().map((n) => [n, this.teamOf(n)])) };
        this._log(`🏆 ${best.join("/")}号 集满 ${need} 枚爱慕标记,第 ${teams.join("/")} 队(${this.result.winners.join("/")}号)全队获胜!`);
      } else {
        this.result = { winners: best, need };
        this._log(`🏆 ${best.join("/")}号 集满 ${need} 枚爱慕标记,获胜!`);
      }
      this.phase = "over";
    } else this.phase = "roundEnd";
  }

  // ───────── 视图 ─────────
  _seatView(s, holds) {
    const mine = holds.has(s.seatNo), revealed = this.phase === "roundEnd" || this.phase === "over";
    const v = { seatNo: s.seatNo, holderDevices: s.holderDevices, discards: s.discards, out: s.out, protected: s.protected, tokens: s.tokens, handCount: s.hand.length, isTurn: this.turn === s.seatNo };
    if (mine || revealed) v.hand = s.hand.slice();
    // 队号:本队(我持有的任一座位同队)可见;终局公开
    if (s.team != null && (this.phase === "over" || [...holds].some((h) => this.seats[h] && this.seats[h].team === s.team))) v.team = s.team;
    if (mine) { v.notes = s.notes.slice(); if (this.phase === "play" && this.turn === s.seatNo) v.countessForced = this.countessForced(s.seatNo); }
    return clone(v);
  }
  _roomView() {
    return clone({ phase: this.phase, sub: this.sub, round: this.round, turn: this.turn, starter: this.starter, config: this.config, need: this.need(), check: this.check(),
      teamTable: this.isTeam() ? TEAM.players[this.seatNos().length] || null : null,
      deckCount: this.deck.length, removedTaken: this.removed == null && this.phase === "play", faceUp: this.faceUp, targets: this.targets(),
      roundResult: this.roundResult, history: this.history, result: this.result, log: this.log });
  }
  _serializeExtra() {
    return { config: this.config, phase: this.phase, sub: this.sub, round: this.round, turn: this.turn, starter: this.starter, deck: this.deck, removed: this.removed, faceUp: this.faceUp,
      roundResult: this.roundResult, history: this.history, result: this.result, log: this.log };
  }
  _hydrateExtra(d) {
    this.config = { ...defaultConfig(), ...(d.config || {}) };
    for (const k of ["phase", "sub", "round", "turn", "starter", "deck", "removed", "faceUp", "roundResult", "history", "result", "log"]) if (d[k] !== undefined) this[k] = d[k];
    for (const s of Object.values(this.seats)) for (const [k, v] of Object.entries(this._newSeat(s.seatNo))) if (s[k] === undefined) s[k] = v;
  }
}
