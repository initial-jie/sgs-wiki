// 忍者之夜(Night of the Ninja)房间核心逻辑 —— 线上牌桌:系统发流派牌与忍者牌、手机上轮抽、夜晚五阶段先收齐声明再统一翻开按号结算、击杀弹反应窗、揭示计分、10 分胜。
// 被 ninja/ninja-sim.mjs(node 断言)与 ninja/worker.mjs(Durable Object)共用;座位/设备骨架继承 common/room-base.mjs。
// 规则来源 docs/ninja/README.md(官方规则书 + FAQ);官方没说的边界按 README §5 的默认值。
//
// 保密模型(按设备持有的座位过滤,见 _seatView/_roomView):
//   - 流派牌 house 仅本人可见(被变形者对调过的本人也看不到 cantLook);被盗贼/判官/捣乱者亮出(revealed)、轮末(roundEnd/over)全公开。
//   - 手牌 hand 仅本人可见(含已作废 burnt 标记);他人只见张数 handCount 与掘墓人面朝上留用的 faceUp。
//   - 荣誉标记 tokens(面值)与总分 points 仅本人可见;他人只见枚数 tokenCount;终局 result.points 全公开。
//   - 私密笔记 notes(密探/隐士/上忍/变形者/通灵商人看到的)仅本人可见。
//   - 打出的牌 played、死亡 dead、结算队列 queue、当前待决 pending(谁在决定、什么牌、击杀目标)公开;待决的私密部分(掘墓人翻到的两张、通灵商人/变形者看到的)只下发给当事人 pendingMine。
// 没有定时器:全部事件驱动。
//
// 动作 core.action(deviceId, {op,...}):
//   setConfig{config:{points,tokens:{2,3,4}}} / startGame / draftPick{seatNo,cardId} / declare{seatNo,cards:[id]} / resolve{seatNo,...按牌} / react{seatNo,cardId|null} / nextRound / newGame
// 阶段 phase:setup → draft(sub pick1 → pick2)→ night(sub declare → resolve,step 0..4 = 密探/隐士/骗徒/盲眼刺客/上忍)→ roundEnd → … → over

import { RoomBase, clone } from "../../common/room-base.mjs";
import { PHASES, CARD_BY_KEY, housesFor, houseFamily, houseRank, buildDeck, buildTokenPool, DEFAULT_TOKENS, DEFAULT_POINTS, TOKEN_VALUES, MIN_PLAYERS, MAX_PLAYERS, NAME_SETS, DEFAULT_NAMES, namesOf, houseNameIn, cardNameIn, phaseNameIn } from "./ninja-data.mjs";

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function defaultConfig() { return { points: DEFAULT_POINTS, tokens: { ...DEFAULT_TOKENS }, names: DEFAULT_NAMES }; } // names:牌名版本(见 ninja-data NAME_SETS),只影响显示/日志
const KILL_CARDS = ["blind", "shinobi"]; // 会触发镜僧/殉道者的击杀牌(判官不触发)

export class NinjaCore extends RoomBase {
  static MIN_SEATS = MIN_PLAYERS;
  static MAX_SEATS = MAX_PLAYERS;

  constructor(roomCode, seatCount, rng = Math.random) {
    super(roomCode, seatCount, rng);
    this.config = defaultConfig();
    this._resetGame();
  }

  _newSeat(i) {
    return { seatNo: i, holderDevices: [],
      house: null,       // 流派牌 crane:1 / lotus:2 / ronin(本人可见)
      cantLook: false,   // 被变形者对调后本人不能再看
      revealed: false,   // 流派牌已被公开(盗贼/判官自亮、捣乱者亮别人)
      hand: [],          // 手里的忍者牌 [{id,key,num}](本人可见)
      kept: [],          // 轮抽中已留下的(轮抽结束并入 hand)
      picked: null,      // 轮抽中选中的 id(所有人选完才一起结算)
      burnt: [],         // 本轮该阶段没打、已作废的 id(本人可见)
      faceUp: [],        // 掘墓人留用、面朝上的 id(公开)
      played: [],        // 本轮已打出的牌(公开)
      dead: false,
      declared: null,    // 当前阶段的声明 [ids] / null=未声明
      tokens: [],        // 荣誉标记 [{id,v}](本人可见面值)
      notes: [] };       // 私密笔记 [{round,text}]
  }
  _clearRoundSeat(s) { Object.assign(s, { house: null, cantLook: false, revealed: false, hand: [], kept: [], picked: null, burnt: [], faceUp: [], played: [], dead: false, declared: null, notes: [] }); }
  _resetGame() {
    this.phase = "setup";   // setup | draft | night | roundEnd | over
    this.sub = null;        // draft: pick1|pick2;night: declare|resolve
    this.round = 0;
    this.step = 0;          // 夜晚阶段下标 0..4
    this.aside = [];        // 本轮没发出的忍者牌
    this.discard = [];      // 中央弃牌堆(掘墓人翻)
    this.tokenPool = [];    // 荣誉标记堆(数字朝下)
    this.queue = [];        // 当前阶段结算队列 [{card,owner,done,void}]
    this.cur = 0;
    this.pending = null;    // 当前待决 {stage,seat,card,...}
    this.roundResult = null;
    this.history = [];
    this.result = null;
    this.log = [];
    for (const s of Object.values(this.seats)) { this._clearRoundSeat(s); s.tokens = []; }
  }
  _log(msg) { this.log.unshift(msg); if (this.log.length > 400) this.log.pop(); }

  addSeat(id) { if (this.phase !== "setup") return { error: "NOT_SETUP" }; return super.addSeat(id); }
  removeSeat(id) { if (this.phase !== "setup") return { error: "NOT_SETUP" }; return super.removeSeat(id); }

  // ── 小工具 ──
  alive() { return this.seatNos().filter((n) => !this.seats[n].dead); }
  points(n) { return this.seats[n].tokens.reduce((a, t) => a + t.v, 0); }
  phaseKey() { return PHASES[this.step] ? PHASES[this.step].key : null; }
  _validSeat(n) { return Number.isInteger(n) && !!this.seats[n]; }
  _findCard(s, id) { return s.hand.find((c) => c.id === id) || null; }
  check() {
    const N = this.seatNos().length;
    if (N < MIN_PLAYERS || N > MAX_PLAYERS) return { error: "PLAYER_COUNT", min: MIN_PLAYERS, max: MAX_PLAYERS };
    return { ok: true, houses: housesFor(N) };
  }
  _drawToken() { return this.tokenPool.length ? this.tokenPool.pop() : null; }
  _award(n, why) {
    const t = this._drawToken();
    if (!t) { this._log(`荣誉标记堆已空,${n}号 没有拿到(${why})`); return false; }
    this.seats[n].tokens.push(t);
    return true;
  }
  _note(n, text) { this.seats[n].notes.push({ round: this.round, text }); }
  // 牌名版本(房规):流派名 / 牌名 / 阶段名 / 派名
  hn(h) { return houseNameIn(this.config.names, h); }
  cn(card) { return cardNameIn(this.config.names, card); }
  pn(i) { return phaseNameIn(this.config.names, PHASES[i].key); }
  famCn(f) { return namesOf(this.config.names).houses[f] + "派"; }
  _hdesc(n) { return `${n}号 的流派牌是「${this.hn(this.seats[n].house)}」`; }

  // ───────── 动作分派 ─────────
  action(id, msg) {
    this.connect(id);
    switch (msg.op) {
      case "setConfig": return this._setConfig(msg.config);
      case "startGame": return this._startGame();
      case "draftPick": return this._draftPick(id, msg);
      case "declare": return this._declare(id, msg);
      case "resolve": return this._resolve(id, msg);
      case "react": return this._react(id, msg);
      case "nextRound": return this._nextRound();
      case "newGame": return (this._resetGame(), this._log("新的一局:回到准备阶段"), { ok: true });
      default: return { error: "BAD_OP" };
    }
  }
  _setConfig(c) {
    if (this.phase !== "setup") return { error: "NOT_SETUP" };
    if (!c || typeof c !== "object") return { error: "BAD_CONFIG" };
    const cfg = clone(this.config);
    if (c.points !== undefined) { if (!(Number.isInteger(c.points) && c.points >= 1 && c.points <= 50)) return { error: "BAD_CONFIG" }; cfg.points = c.points; }
    if (c.names !== undefined) { if (!NAME_SETS[c.names]) return { error: "BAD_CONFIG" }; cfg.names = c.names; }
    if (c.tokens !== undefined) {
      if (!c.tokens || typeof c.tokens !== "object") return { error: "BAD_CONFIG" };
      const t = {};
      for (const v of TOKEN_VALUES) { const k = c.tokens[v] ?? cfg.tokens[v]; if (!(Number.isInteger(k) && k >= 0 && k <= 99)) return { error: "BAD_CONFIG" }; t[v] = k; }
      if (!Object.values(t).some((k) => k > 0)) return { error: "BAD_CONFIG" };
      cfg.tokens = t;
    }
    this.config = cfg;
    return { ok: true };
  }

  // ───────── 开局 / 开轮 ─────────
  _startGame() {
    if (this.phase !== "setup") return { error: "NOT_SETUP" };
    const chk = this.check(); if (chk.error) return chk;
    for (const s of Object.values(this.seats)) { this._clearRoundSeat(s); s.tokens = []; }
    this.round = 0; this.history = []; this.result = null; this.roundResult = null;
    this.tokenPool = shuffle(buildTokenPool(this.config.tokens), this.rng);
    const N = this.seatNos().length;
    this._log(`开局:${N} 人,流派牌 ${chk.houses.map((h) => this.hn(h)).join(" / ")};荣誉标记 ${this.tokenPool.length} 枚,先到 ${this.config.points} 分者胜`);
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
    const seats = this.seatNos();
    for (const n of seats) this._clearRoundSeat(this.seats[n]);
    const houses = shuffle(housesFor(seats.length), this.rng);
    seats.forEach((n, i) => { this.seats[n].house = houses[i]; });
    const deck = shuffle(buildDeck(), this.rng);
    for (const n of seats) this.seats[n].hand = deck.splice(0, 3);
    this.aside = deck; this.discard = [];
    this.queue = []; this.cur = 0; this.pending = null; this.step = 0;
    this.phase = "draft"; this.sub = "pick1";
    this._log(`第 ${this.round} 轮:流派牌已暗发,每人 3 张忍者牌,轮抽开始(留 1 张,其余传给左手 = 下一号)`);
  }

  // ───────── 轮抽 ─────────
  _draftPick(id, msg) {
    if (this.phase !== "draft") return { error: "NOT_DRAFT" };
    const n = Number(msg.seatNo);
    if (!this.isHolder(id, n)) return { error: "NOT_HOLDER" };
    const s = this.seats[n];
    if (!this._findCard(s, msg.cardId)) return { error: "NOT_IN_HAND" };
    s.picked = msg.cardId;
    if (this.seatNos().every((m) => this.seats[m].picked)) this._draftStep();
    return { ok: true };
  }
  _draftStep() {
    const seats = this.seatNos();
    if (this.sub === "pick1") {
      const passing = {};
      for (const n of seats) { const s = this.seats[n]; const c = this._findCard(s, s.picked); s.kept.push(c); passing[n] = s.hand.filter((x) => x.id !== c.id); }
      seats.forEach((n, i) => { const left = seats[(i + 1) % seats.length]; this.seats[left].hand = passing[n]; });
      for (const n of seats) this.seats[n].picked = null;
      this.sub = "pick2";
      this._log("轮抽:每人留下 1 张,其余 2 张传给了左手玩家;从收到的 2 张里再留 1 张");
    } else {
      for (const n of seats) { const s = this.seats[n]; const c = this._findCard(s, s.picked); s.kept.push(c); for (const x of s.hand) if (x.id !== c.id) this.discard.push(x); s.hand = s.kept; s.kept = []; s.picked = null; }
      this.discard = shuffle(this.discard, this.rng);
      this._log(`轮抽结束:每人 2 张忍者牌,中央弃牌堆 ${this.discard.length} 张;夜晚开始`);
      this.phase = "night";
      this._beginStep(0);
    }
  }

  // ───────── 夜晚:声明 ─────────
  _beginStep(i) {
    this.step = i; this.sub = "declare"; this.queue = []; this.cur = 0; this.pending = null;
    for (const n of this.seatNos()) this.seats[n].declared = this.seats[n].dead ? [] : null; // 死人自动跳过
    this._log(`夜晚 · ${this.pn(i)}阶段:请每位存活者声明打出的牌(或跳过)`);
    this._checkDeclared();
  }
  _declare(id, msg) {
    if (this.phase !== "night" || this.sub !== "declare") return { error: "NOT_DECLARE" };
    const n = Number(msg.seatNo);
    if (!this.isHolder(id, n)) return { error: "NOT_HOLDER" };
    const s = this.seats[n];
    if (s.dead) return { error: "DEAD" };
    const ids = Array.isArray(msg.cards) ? msg.cards.map(String) : [];
    if (new Set(ids).size !== ids.length) return { error: "BAD_CARDS" };
    const pk = this.phaseKey();
    for (const cid of ids) { const c = this._findCard(s, cid); if (!c || c.key === undefined || CARD_BY_KEY[c.key].phase !== pk || s.burnt.includes(cid)) return { error: "BAD_CARDS" }; }
    s.declared = ids;
    this._checkDeclared();
    return { ok: true };
  }
  _checkDeclared() {
    if (this.seatNos().some((n) => this.seats[n].declared === null)) return;
    // 全员声明完毕:统一翻开 → 按编号排队;本阶段没打的同阶段牌作废
    const pk = this.phaseKey(), entries = [];
    for (const n of this.seatNos()) {
      const s = this.seats[n];
      for (const cid of s.declared) { const c = this._findCard(s, cid); s.hand = s.hand.filter((x) => x.id !== cid); s.faceUp = s.faceUp.filter((x) => x !== cid); s.played.push(c); entries.push({ card: c, owner: n, done: false, void: false }); }
      for (const c of s.hand) if (CARD_BY_KEY[c.key].phase === pk && !s.burnt.includes(c.id)) s.burnt.push(c.id);
      s.declared = null;
    }
    entries.sort((a, b) => (a.card.num ?? 99) - (b.card.num ?? 99) || a.owner - b.owner);
    this.queue = entries; this.cur = 0; this.sub = "resolve";
    if (!entries.length) this._log(`${this.pn(this.step)}阶段:无人出牌`);
    else this._log(`${this.pn(this.step)}阶段翻牌:${entries.map((e) => `${e.owner}号「${this.cn(e.card)}」`).join("、")},按编号依次结算`);
    this._advance();
  }
  // 推进结算队列:给下一张未结算的牌开待决;队列空则进下一阶段 / 揭示
  _advance() {
    while (this.cur < this.queue.length) {
      const q = this.queue[this.cur];
      if (q.done) { this.cur++; continue; }
      if (this.seats[q.owner].dead) { q.void = true; q.done = true; this._log(`${q.owner}号 已死亡,「${this.cn(q.card)}」作废`); this.cur++; continue; }
      this.pending = { stage: "main", seat: q.owner, card: q.card };
      return;
    }
    this.pending = null;
    if (this.step + 1 < PHASES.length) this._beginStep(this.step + 1);
    else this._reveal();
  }
  _finishCard() { this.queue[this.cur].done = true; this.pending = null; this.cur++; this._advance(); }

  // ───────── 夜晚:结算 ─────────
  _resolve(id, msg) {
    if (this.phase !== "night" || this.sub !== "resolve" || !this.pending || this.pending.stage === "react") return { error: "NOT_RESOLVE" };
    const n = Number(msg.seatNo), p = this.pending;
    if (!this.isHolder(id, n)) return { error: "NOT_HOLDER" };
    if (n !== p.seat) return { error: "NOT_YOUR_CARD" };
    const s = this.seats[n], card = p.card, who = `${n}号`;
    const other = (t) => this._validSeat(t) && t !== n;
    const otherAlive = (t) => other(t) && !this.seats[t].dead;
    switch (card.key) {
      case "spy": {
        const t = Number(msg.target); if (!other(t)) return { error: "BAD_TARGET" };
        this._note(n, `密探:${this._hdesc(t)}`); this._log(`${who} 的${this.cn({key:"spy"})}查看了 ${t}号 的流派牌`);
        return this._finishCard(), { ok: true };
      }
      case "mystic": {
        const t = Number(msg.target); if (!other(t)) return { error: "BAD_TARGET" };
        const h = this.seats[t].hand, c = h.length ? h[Math.floor(this.rng() * h.length)] : null;
        this._note(n, `隐士:${this._hdesc(t)}${c ? `;他手里有一张「${this.cn(c)}」${this.seats[t].burnt.includes(c.id) ? "(已作废)" : ""}` : ";他手里没有忍者牌了"}`);
        this._log(`${who} 的${this.cn({key:"mystic"})}查看了 ${t}号 的流派牌和一张手牌`);
        return this._finishCard(), { ok: true };
      }
      case "shapeshifter": {
        if (p.stage === "main") {
          const ts = Array.isArray(msg.targets) ? msg.targets.map(Number) : [];
          if (ts.length !== 2 || ts[0] === ts[1] || !ts.every((t) => this._validSeat(t) && !this.seats[t].revealed)) return { error: "BAD_TARGET" };
          this._note(n, `变形者:${this._hdesc(ts[0])};${this._hdesc(ts[1])}`);
          p.stage = "decide"; p.targets = ts; p.info = { [ts[0]]: this.seats[ts[0]].house, [ts[1]]: this.seats[ts[1]].house };
          this._log(`${who} 的${this.cn({key:"shapeshifter"})}查看了 ${ts[0]}号 与 ${ts[1]}号 的流派牌,正在决定是否对调`);
          return { ok: true };
        }
        const [a, b] = p.targets;
        if (msg.swap) {
          [this.seats[a].house, this.seats[b].house] = [this.seats[b].house, this.seats[a].house];
          this.seats[a].cantLook = true; this.seats[b].cantLook = true;
          this._note(n, `变形者:你把 ${a}号 与 ${b}号 的流派牌对调了`);
        } else this._note(n, `变形者:你没有对调 ${a}号 与 ${b}号 的流派牌`);
        this._log(`${who} 的${this.cn({key:"shapeshifter"})}结算完毕(是否对调只有他知道)`);
        return this._finishCard(), { ok: true };
      }
      case "gravedigger": {
        if (p.stage === "main") {
          if (!this.discard.length) { this._log(`${who} 的${this.cn({key:"gravedigger"})}:弃牌堆是空的,无效果`); return this._finishCard(), { ok: true }; }
          const offer = this.discard.splice(0, Math.min(2, this.discard.length));
          p.stage = "decide"; p.offer = offer;
          this._log(`${who} 的${this.cn({key:"gravedigger"})}翻看了弃牌堆的 ${offer.length} 张牌,正在挑选`);
          return { ok: true };
        }
        const c = p.offer.find((x) => x.id === msg.pick); if (!c) return { error: "BAD_PICK" };
        for (const x of p.offer) if (x.id !== c.id) this.discard.push(x);
        const def = CARD_BY_KEY[c.key], canNow = PHASES.some((ph) => ph.key === def.phase);
        if (msg.play === "now" && canNow) {
          s.played.push(c);
          this.queue.splice(this.cur + 1, 0, { card: c, owner: n, done: false, void: false });
          this._log(`${who} 的${this.cn({key:"gravedigger"})}挖出「${this.cn(c)}」并立刻打出`);
        } else {
          s.hand.push(c); s.faceUp.push(c.id);
          this._log(`${who} 的${this.cn({key:"gravedigger"})}挖出「${this.cn(c)}」,面朝上留在面前`);
        }
        return this._finishCard(), { ok: true };
      }
      case "troublemaker": {
        if (p.stage === "main") {
          const t = Number(msg.target); if (!other(t)) return { error: "BAD_TARGET" };
          this._note(n, `捣乱者:${this._hdesc(t)}`);
          p.stage = "decide"; p.target = t;
          this._log(`${who} 的${this.cn({key:"troublemaker"})}查看了 ${t}号 的流派牌,正在决定是否公开`);
          return { ok: true };
        }
        if (msg.reveal) { this.seats[p.target].revealed = true; this._log(`${who} 的${this.cn({key:"troublemaker"})}公开:${this._hdesc(p.target)}`); }
        else this._log(`${who} 的${this.cn({key:"troublemaker"})}没有公开 ${p.target}号 的流派牌`);
        return this._finishCard(), { ok: true };
      }
      case "merchant": {
        if (p.stage === "main") {
          const t = Number(msg.target); if (!other(t)) return { error: "BAD_TARGET" };
          if (msg.look !== "honor" && msg.look !== "house") return { error: "BAD_LOOK" };
          const ts = this.seats[t];
          p.stage = "decide"; p.target = t; p.look = msg.look; p.seen = null;
          if (msg.look === "house") this._note(n, `通灵商人:${this._hdesc(t)}`);
          else if (ts.tokens.length) { const tk = ts.tokens[Math.floor(this.rng() * ts.tokens.length)]; p.seen = tk.id; this._note(n, `通灵商人:${t}号 的一枚荣誉标记(${tk.id})面值是 ${tk.v}`); }
          else this._note(n, `通灵商人:${t}号 没有荣誉标记`);
          this._log(`${who} 的${this.cn({key:"merchant"})}查看了 ${t}号 的${msg.look === "house" ? "流派牌" : "一枚荣誉标记"},正在决定是否交换`);
          return { ok: true };
        }
        const t = p.target, ts = this.seats[t];
        if (msg.give != null || msg.take != null) {
          const g = s.tokens.find((x) => x.id === msg.give), k = ts.tokens.find((x) => x.id === msg.take);
          if (!g || !k) return { error: "BAD_SWAP" };
          s.tokens = s.tokens.filter((x) => x !== g); ts.tokens = ts.tokens.filter((x) => x !== k);
          s.tokens.push(k); ts.tokens.push(g);
          this._note(n, `通灵商人:你用面值 ${g.v} 的标记换来了 ${t}号 面值 ${k.v} 的标记`);
          this._note(t, `通灵商人:${n}号 用一枚标记换走了你的一枚(你拿到的面值是 ${g.v},被换走的是 ${k.v})`);
          this._log(`${who} 的${this.cn({key:"merchant"})}与 ${t}号 交换了一枚荣誉标记`);
        } else this._log(`${who} 的${this.cn({key:"merchant"})}没有与 ${t}号 交换标记`);
        return this._finishCard(), { ok: true };
      }
      case "thief": {
        s.revealed = true;
        let txt = `${who} 的${this.cn({key:"thief"})}亮出流派牌「${this.hn(s.house)}」`;
        if (msg.target != null) {
          const t = Number(msg.target), ts = this.seats[t];
          if (!other(t) || ts.tokens.length <= s.tokens.length) return { error: "BAD_TARGET" };
          const k = ts.tokens.splice(Math.floor(this.rng() * ts.tokens.length), 1)[0];
          s.tokens.push(k);
          this._note(n, `盗贼:从 ${t}号 拿走的标记面值是 ${k.v}`);
          this._note(t, `盗贼:${n}号 拿走了你一枚面值 ${k.v} 的标记`);
          txt += `,从 ${t}号 拿走一枚荣誉标记`;
        }
        this._log(txt);
        return this._finishCard(), { ok: true };
      }
      case "judge": {
        const t = Number(msg.target); if (!otherAlive(t)) return { error: "BAD_TARGET" };
        s.revealed = true;
        this._log(`${who} 的${this.cn({key:"judge"})}亮出流派牌「${this.hn(s.house)}」,处决 ${t}号(${this.cn({key:"mirror"})}/${this.cn({key:"martyr"})}无效)`);
        this._kill(t);
        return this._finishCard(), { ok: true };
      }
      case "blind": {
        const t = Number(msg.target); if (!otherAlive(t)) return { error: "BAD_TARGET" };
        this._log(`${who} 的${this.cn({key:"blind"})}选择杀死 ${t}号`);
        return this._attemptKill(n, t, card), { ok: true };
      }
      case "shinobi": {
        if (p.stage === "main") {
          const t = Number(msg.target); if (!otherAlive(t)) return { error: "BAD_TARGET" };
          this._note(n, `上忍:${this._hdesc(t)}`);
          p.stage = "decide"; p.target = t;
          this._log(`${who} 的${this.cn({key:"shinobi"})}查看了 ${t}号 的流派牌,正在决定是否出手`);
          return { ok: true };
        }
        const t = p.target;
        if (!msg.kill) { this._log(`${who} 的${this.cn({key:"shinobi"})}放过了 ${t}号`); return this._finishCard(), { ok: true }; }
        this._log(`${who} 的${this.cn({key:"shinobi"})}选择杀死 ${t}号`);
        return this._attemptKill(n, t, card), { ok: true };
      }
      default: return { error: "BAD_CARD" };
    }
  }
  // 上忍/盲眼刺客的击杀:目标手里有镜僧或殉道者 → 开反应窗等目标决定;否则直接死
  _attemptKill(killer, target, card) {
    const ts = this.seats[target];
    const opts = ts.hand.filter((c) => c.key === "mirror" || c.key === "martyr").map((c) => c.id);
    if (opts.length) { this.pending = { stage: "react", seat: target, card, killer, target, options: opts }; return; }
    this._kill(target);
    this._finishCard();
  }
  _react(id, msg) {
    if (this.phase !== "night" || !this.pending || this.pending.stage !== "react") return { error: "NOT_REACT" };
    const p = this.pending, n = Number(msg.seatNo);
    if (!this.isHolder(id, n)) return { error: "NOT_HOLDER" };
    if (n !== p.target) return { error: "NOT_YOUR_CARD" };
    const s = this.seats[n];
    if (msg.cardId != null) {
      if (!p.options.includes(msg.cardId)) return { error: "BAD_CARDS" };
      const c = this._findCard(s, msg.cardId);
      s.hand = s.hand.filter((x) => x.id !== c.id); s.played.push(c);
      if (c.key === "mirror") { this._log(`${n}号 翻开${this.cn({key:"mirror"})}:反杀 ${p.killer}号!`); this._kill(p.killer); }
      else { this._log(`${n}号 翻开${this.cn({key:"martyr"})}:死去,但获得一枚荣誉标记`); this._kill(n); this._award(n, "殉道者"); }
    } else this._kill(n);
    this._finishCard();
    return { ok: true };
  }
  _kill(n) { const s = this.seats[n]; if (s.dead) return; s.dead = true; this._log(`💀 ${n}号 死亡(流派牌不公开)`); }

  // ───────── 揭示 / 计分 ─────────
  _reveal() {
    const seats = this.seatNos(), alive = this.alive();
    // 首脑:存活持有者自动亮出(对他永远有利)
    let mm = null;
    for (const n of alive) { const c = this.seats[n].hand.find((x) => x.key === "mastermind"); if (c) { mm = n; this.seats[n].hand = this.seats[n].hand.filter((x) => x !== c); this.seats[n].played.push(c); } }
    for (const n of seats) this.seats[n].revealed = true; // 轮末全公开(简化:存活者翻牌,赢家摸标记时也暴露)
    const fam = (n) => houseFamily(this.seats[n].house);
    const ranks = (f) => alive.filter((n) => fam(n) === f).map((n) => houseRank(this.seats[n].house)).sort((a, b) => a - b);
    const cr = ranks("crane"), lo = ranks("lotus");
    let winner = null, reason;
    if (mm != null) { winner = fam(mm) === "ronin" ? null : fam(mm); reason = "mastermind"; }
    else {
      let i = 0;
      for (;;) {
        if (i >= cr.length && i >= lo.length) { winner = null; reason = cr.length || lo.length ? "tie" : "none"; break; }
        if (i >= cr.length) { winner = "lotus"; reason = "rank"; break; }
        if (i >= lo.length) { winner = "crane"; reason = "rank"; break; }
        if (cr[i] !== lo[i]) { winner = cr[i] < lo[i] ? "crane" : "lotus"; reason = "rank"; break; }
        i++;
      }
    }
    const awarded = [];
    if (winner) for (const n of seats) if (fam(n) === winner && this._award(n, "本轮获胜")) awarded.push({ seat: n, why: `${this.seats[n].dead ? "已死亡的" : ""}${this.famCn(winner)}成员` });
    if (reason === "tie") for (const n of alive) if (this._award(n, "完全平手")) awarded.push({ seat: n, why: "完全平手的存活者" });
    for (const n of alive) if (fam(n) === "ronin" && reason !== "tie" && this._award(n, "浪人存活")) awarded.push({ seat: n, why: "浪人存活" });
    const survivors = Object.fromEntries(alive.map((n) => [n, this.seats[n].house]));
    const houses = Object.fromEntries(seats.map((n) => [n, this.seats[n].house]));
    const dead = seats.filter((n) => this.seats[n].dead);
    this.roundResult = { round: this.round, winner, reason, mastermind: mm, crane: cr, lotus: lo, survivors, houses, dead, awarded, tokenCount: Object.fromEntries(seats.map((n) => [n, this.seats[n].tokens.length])) };
    this.history.push(clone(this.roundResult));
    const why = reason === "mastermind" ? `${mm}号 亮出${this.cn({ key: "mastermind" })}` : reason === "rank" ? `存活者 ${this.famCn("crane")} [${cr.join(",")}] vs ${this.famCn("lotus")} [${lo.join(",")}]` : reason === "tie" ? "存活者等级完全相同,没有流派获胜" : "两派都没有存活者";
    this._log(`揭示:${winner ? `${this.famCn(winner)}获胜` : "没有流派获胜"}(${why});${awarded.length ? awarded.map((a) => `${a.seat}号`).join("/") + " 各摸 1 枚荣誉标记" : "无人得分"}`);
    // 胜利检查(轮末)
    const need = this.config.points;
    const champs = seats.filter((n) => this.points(n) >= need);
    if (champs.length) {
      const top = Math.max(...champs.map((n) => this.points(n)));
      const best = champs.filter((n) => this.points(n) === top);
      this.result = { winners: best, need, points: Object.fromEntries(seats.map((n) => [n, this.points(n)])), tokens: Object.fromEntries(seats.map((n) => [n, this.seats[n].tokens.map((t) => t.v)])) };
      this._log(`🏆 ${best.join("/")}号 达到 ${need} 分(${top} 分),获胜!`);
      this.phase = "over";
    } else this.phase = "roundEnd";
    this.sub = null; this.pending = null;
  }

  // ───────── 视图 ─────────
  _seatView(s, holds) {
    const mine = holds.has(s.seatNo), ended = this.phase === "roundEnd" || this.phase === "over";
    const v = { seatNo: s.seatNo, holderDevices: s.holderDevices, dead: s.dead, revealed: s.revealed, handCount: s.hand.length + s.kept.length,
      faceUp: s.hand.filter((c) => s.faceUp.includes(c.id)), played: s.played, tokenCount: s.tokens.length,
      picked: this.phase === "draft" ? !!s.picked : undefined, declared: this.phase === "night" && this.sub === "declare" ? s.declared !== null : undefined };
    if (s.house && (s.revealed || ended || (mine && !s.cantLook))) v.house = s.house;
    if (mine) {
      v.hand = s.hand.map((c) => ({ ...c, burnt: s.burnt.includes(c.id), faceUp: s.faceUp.includes(c.id) }));
      v.kept = s.kept; v.pickedId = s.picked; v.cantLook = s.cantLook; v.notes = s.notes; v.tokens = s.tokens; v.points = this.points(s.seatNo);
      if (this.phase === "night" && this.sub === "declare") v.declaredIds = s.declared;
    }
    return clone(v);
  }
  _roomView(holds) {
    const p = this.pending;
    let pending = null, pendingMine = null;
    if (p) {
      pending = { stage: p.stage, seat: p.seat, card: p.card, target: p.target ?? null, killer: p.killer ?? null, targets: p.targets ?? null };
      if (holds.has(p.seat)) {
        pendingMine = {};
        if (p.offer) pendingMine.offer = p.offer;
        if (p.info) pendingMine.info = p.info;
        if (p.options) pendingMine.options = p.options;
        if (p.look) { pendingMine.look = p.look; pendingMine.seen = p.seen; pendingMine.targetTokens = this.seats[p.target].tokens.map((t) => t.id); }
      }
    }
    return clone({ phase: this.phase, sub: this.sub, round: this.round, step: this.step, phaseKey: this.phaseKey(), config: this.config, check: this.check(),
      discardCount: this.discard.length, asideCount: this.aside.length, poolCount: this.tokenPool.length,
      queue: this.queue, cur: this.cur, pending, pendingMine, roundResult: this.roundResult, history: this.history, result: this.result, log: this.log });
  }
  _serializeExtra() {
    return { config: this.config, phase: this.phase, sub: this.sub, round: this.round, step: this.step, aside: this.aside, discard: this.discard, tokenPool: this.tokenPool,
      queue: this.queue, cur: this.cur, pending: this.pending, roundResult: this.roundResult, history: this.history, result: this.result, log: this.log };
  }
  _hydrateExtra(d) {
    this.config = { ...defaultConfig(), ...(d.config || {}) };
    if (d.config && d.config.tokens) this.config.tokens = { ...DEFAULT_TOKENS, ...d.config.tokens };
    for (const k of ["phase", "sub", "round", "step", "aside", "discard", "tokenPool", "queue", "cur", "pending", "roundResult", "history", "result", "log"]) if (d[k] !== undefined) this[k] = d[k];
    for (const s of Object.values(this.seats)) for (const [k, v] of Object.entries(this._newSeat(s.seatNo))) if (s[k] === undefined) s[k] = v;
  }
}
