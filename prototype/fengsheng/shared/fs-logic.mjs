// 风声房间核心逻辑(线下辅助形态:桌上用实体牌,手机管「秘密信息 + 公开台账 + 胜负判定」)。
// 被 fengsheng/fs-sim.mjs(node 断言)与 fengsheng/worker.mjs(Durable Object)共用;座位/设备骨架继承 common/room-base.mjs。
//
// 保密模型(按设备持有的座位过滤,见 _seatView):
//   - 身份(阵营 + 神秘人任务):仅本人/代持可见;阵亡或本局结束后公开。
//   - 角色 2 选 1 的候选:仅本人可见。选定的角色若是「隐藏角色」且面朝下,他人只见"隐藏角色",翻开后公开。
//   - 情报区、濒死/阵亡、当前回合、日志:全公开(桌面本来就是明的)。日志不写任何秘密内容。
//   - 「你可以宣胜」提示只看自己的情报区 + 自己的身份,不泄露队友信息。
//
// 动作:core.action(deviceId, {op, ...}),见 action() 内分派。

import { RoomBase, clone } from "../../common/room-base.mjs";
import { CHARACTERS, CHAR_BY_ID, TASKS, TASK_BY_KEY, FACTIONS, DEFAULT_ID_COUNTS, INTEL_KINDS } from "./fs-data.mjs";

const FACTION_KEYS = ["red", "blue", "green"];
const KIND_BY_KEY = Object.fromEntries(INTEL_KINDS.map((k) => [k.key, k]));

// 情报区计数:双色情报同时计入两种颜色
export function intelCounts(intel) {
  const c = { red: 0, blue: 0, black: 0, pureBlack: 0, total: (intel || []).length };
  for (const it of intel || []) {
    for (const col of it.colors) c[col]++;
    if (it.colors.length === 1 && it.colors[0] === "black") c.pureBlack++;
  }
  return c;
}

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function defaultIdCounts(n) {
  const d = DEFAULT_ID_COUNTS[n];
  if (d) return { red: d[0], blue: d[1], green: d[2] };
  return n < 3 ? { red: 1, blue: 1, green: Math.max(0, n - 2) } : { red: 3, blue: 3, green: n - 6 };
}

export class FsCore extends RoomBase {
  static MIN_SEATS = 3;
  static MAX_SEATS = 9;

  constructor(roomCode, seatCount, rng = Math.random) {
    super(roomCode, seatCount, rng);
    this._resetRoom();
  }

  _newSeat(i) {
    return { seatNo: i, holderDevices: [],
      offers: [],          // 角色 2 选 1 候选(仅本人可见)
      charId: null,        // 选定角色
      faceUp: true,        // 角色牌朝向;隐藏角色开局面朝下
      identity: null,      // { faction:"red"|"blue"|"green", task?:key }(仅本人可见,阵亡/结束公开)
      intel: [],           // 情报区 [{id, kind, colors:[…]}](公开)
      dying: false,        // 濒死:黑色情报 ≥3 且未确认死亡(可用【澄清】等救)
      dead: false };
  }

  _resetRoom() {
    this.phase = "setup";           // setup(选角/发身份) | play | over
    this.pack = "base";             // 角色/任务卡池:base | all
    this.idCounts = defaultIdCounts(Object.keys(this.seats).length);
    this.turn = null;               // 当前回合座位
    this.turnDeaths = [];           // 本回合死亡 [{seat, rb}](镇压者判定用;换回合清空)
    this.result = null;             // { winners:[座位], by, reason }
    this.log = [];
    this.intelSeq = 1;
  }

  _log(msg) { this.log.unshift(msg); if (this.log.length > 200) this.log.pop(); }
  _name(n) { return n + "号"; }
  _pool() { return CHARACTERS.filter((c) => this.pack === "all" || c.pack === "base"); }
  _taskPool() { return TASKS.filter((t) => this.pack === "all" || t.pack === "base"); }
  _alive() { return this.seatNos().filter((n) => !this.seats[n].dead); }

  // 座位数变了:默认身份配比跟着换(setup 阶段才有意义)
  addSeat(id) { const r = super.addSeat(id); if (r.ok) this.idCounts = defaultIdCounts(this.seatNos().length); return r; }
  removeSeat(id) { const r = super.removeSeat(id); if (r.ok) this.idCounts = defaultIdCounts(this.seatNos().length); return r; }

  // ───────── 胜负 ─────────
  // 某座位"凭自己"是否满足胜利条件(用于私密提示;不看队友)
  _selfCanWin(n) {
    const s = this.seats[n]; if (!s?.identity || s.dead) return false;
    const c = intelCounts(s.intel);
    const f = s.identity.faction;
    if (f === "red") return c.red >= 3;
    if (f === "blue") return c.blue >= 3;
    const t = s.identity.task;
    if (t === "shuangmian") return c.red >= 3 || c.blue >= 3;
    if (t === "zhenya") return this.turn === n && this.turnDeaths.some((d) => d.rb >= 2);
    if (t === "qingdao") return this.turn === n && this.turnDeaths.some((d) => d.redLe1 && d.blueLe1);
    if (t === "xianxing") return false; // 死亡时判定(阵亡者不能宣胜,由手动结算)
    return false;
  }
  // 宣胜校验:返回 {ok, winners, reason} 或 {error}
  _checkDeclare(n) {
    const s = this.seats[n];
    if (!s.identity) return { error: "NO_IDENTITY" };
    if (s.dead) return { error: "DEAD" };
    const f = s.identity.faction;
    const members = this.seatNos().filter((k) => this.seats[k].identity?.faction === f);
    if (f === "red" || f === "blue") {
      const col = f; // 阵营色 = 情报色
      const hit = members.find((k) => !this.seats[k].dead && intelCounts(this.seats[k].intel)[col] >= 3);
      if (hit == null) return { error: "NOT_WIN_YET" };
      return { ok: true, winners: members, reason: `${FACTIONS[f].name}收集齐 3 张${col === "red" ? "红" : "蓝"}色情报(${this._name(hit)})` };
    }
    if (!this._selfCanWin(n)) return { error: "NOT_WIN_YET" };
    return { ok: true, winners: [n], reason: `神秘人·${TASK_BY_KEY[s.identity.task]?.name || "?"}完成任务` };
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

    switch (op) {
      // ── 开局设置(任意玩家可点;都是公开操作)──
      case "setPack": {
        if (!["base", "all"].includes(msg.pack)) return { error: "BAD_PACK" };
        this.pack = msg.pack; this._log(`卡池切换为「${msg.pack === "base" ? "基础包" : "全部角色"}」`);
        return { ok: true };
      }
      case "setIdCounts": {
        const c = {};
        for (const k of FACTION_KEYS) { const v = Math.round(Number(msg[k])); if (!Number.isFinite(v) || v < 0 || v > 9) return { error: "BAD_COUNTS" }; c[k] = v; }
        this.idCounts = c;
        return { ok: true };
      }
      case "dealChars": { // 每座位发 N 张候选(不放回);覆盖上一轮候选与已选角色
        const per = Math.max(1, Math.min(3, Number(msg.per) || 2));
        const nos = this.seatNos();
        const pool = shuffle(this._pool(), this.rng);
        if (pool.length < per * nos.length) return { error: "POOL_TOO_SMALL" };
        nos.forEach((n, i) => {
          const st = this.seats[n];
          st.offers = pool.slice(i * per, i * per + per).map((c) => c.id);
          st.charId = null; st.faceUp = true;
        });
        this._log(`发角色:每人 ${per} 选 1`);
        return { ok: true };
      }
      case "pickChar": { // 本人从候选里选;没有候选时(用实体牌选角)可直接登记任意角色
        const e = needSeat(); if (e) return e;
        if (!holder) return { error: "NOT_HOLDER" };
        const cid = Number(msg.charId);
        const ch = CHAR_BY_ID[cid]; if (!ch) return { error: "BAD_CHAR" };
        if (s.offers.length && !s.offers.includes(cid)) return { error: "NOT_OFFERED" };
        s.charId = cid; s.faceUp = !ch.hidden; s.offers = [];
        this._log(`${this._name(seatNo)}选定角色` + (ch.hidden ? "(隐藏角色,面朝下)" : `:${ch.name}`));
        return { ok: true };
      }
      case "clearChar": {
        const e = needSeat(); if (e) return e;
        if (!holder) return { error: "NOT_HOLDER" };
        s.charId = null; s.faceUp = true;
        return { ok: true };
      }
      case "flipChar": { // 翻开/翻回:技能会翻别人的牌(钱敏/玛利亚…),故任意玩家可操作,记日志
        const e = needSeat(); if (e) return e;
        if (s.charId == null) return { error: "NO_CHAR" };
        s.faceUp = !!msg.faceUp;
        const ch = CHAR_BY_ID[s.charId];
        this._log(s.faceUp ? `${this._name(seatNo)}角色牌翻开:${ch.name}` : `${this._name(seatNo)}角色牌翻至面朝下`);
        return { ok: true };
      }
      case "dealIdentities": { // 系统随机发身份(配比需与座位数一致);神秘人随机抽任务(不重复)
        const nos = this.seatNos();
        const c = this.idCounts;
        if (c.red + c.blue + c.green !== nos.length) return { error: "COUNT_MISMATCH" };
        const ids = shuffle([...Array(c.red).fill("red"), ...Array(c.blue).fill("blue"), ...Array(c.green).fill("green")], this.rng);
        const tasks = shuffle(this._taskPool(), this.rng);
        if (c.green > tasks.length) return { error: "TOO_MANY_GREEN" };
        let ti = 0;
        nos.forEach((n, i) => {
          const f = ids[i];
          this.seats[n].identity = f === "green" ? { faction: f, task: tasks[ti++].key } : { faction: f };
        });
        this._log(`系统发身份:潜伏 ${c.red} · 特工 ${c.blue} · 神秘人 ${c.green}`);
        return { ok: true };
      }
      case "setIdentity": { // 本人登记(用实体身份牌时)/ 技能换身份(顾小梦承志);task 仅神秘人
        const e = needSeat(); if (e) return e;
        if (!holder) return { error: "NOT_HOLDER" };
        if (msg.faction == null) { s.identity = null; return { ok: true }; }
        if (!FACTION_KEYS.includes(msg.faction)) return { error: "BAD_FACTION" };
        if (msg.faction === "green" && !TASK_BY_KEY[msg.task]) return { error: "BAD_TASK" };
        s.identity = msg.faction === "green" ? { faction: "green", task: msg.task } : { faction: msg.faction };
        this._log(`${this._name(seatNo)}登记/更改了身份`); // 不写内容
        return { ok: true };
      }
      case "startGame": { // 进入对局:从指定座位(默认 1 号)开始回合
        const nos = this.seatNos();
        const first = Number(msg.first) || nos[0];
        if (!this.seats[first]) return { error: "BAD_SEAT" };
        this.phase = "play"; this.turn = first; this.turnDeaths = [];
        this._log(`对局开始,${this._name(first)}先手`);
        return { ok: true };
      }

      // ── 对局中:情报区 / 生死 / 回合(任意玩家可改,全公开)──
      case "addIntel": {
        const e = needSeat() || overGuard(); if (e) return e;
        const k = KIND_BY_KEY[msg.kind]; if (!k) return { error: "BAD_KIND" };
        if (s.dead) return { error: "DEAD" };
        s.intel.push({ id: this.intelSeq++, kind: k.key, colors: k.colors.slice() });
        const c = intelCounts(s.intel);
        this._log(`${this._name(seatNo)}获得${k.label}情报(红${c.red}/蓝${c.blue}/黑${c.black})`);
        if (c.black >= 3 && !s.dying) { s.dying = true; this._log(`⚠ ${this._name(seatNo)}黑色情报达 3 张,进入濒死`); }
        return { ok: true };
      }
      case "removeIntel": { // 弃置/烧毁/被拿走:统一为从情报区移除
        const e = needSeat() || overGuard(); if (e) return e;
        const i = s.intel.findIndex((x) => x.id === Number(msg.intelId));
        if (i < 0) return { error: "BAD_INTEL" };
        const [it] = s.intel.splice(i, 1);
        this._log(`${this._name(seatNo)}移除一张${KIND_BY_KEY[it.kind]?.label || ""}情报`);
        if (s.dying && intelCounts(s.intel).black < 3) { s.dying = false; this._log(`${this._name(seatNo)}脱离濒死`); }
        return { ok: true };
      }
      case "confirmDeath": { // 濒死无人救 / 其他致死 → 确认死亡:身份公开,记入本回合死亡(镇压者/清道夫)
        const e = needSeat() || overGuard(); if (e) return e;
        if (s.dead) return { error: "DEAD" };
        const c = intelCounts(s.intel);
        s.dead = true; s.dying = false;
        this.turnDeaths.push({ seat: seatNo, rb: c.red + c.blue, redLe1: c.red <= 1, blueLe1: c.blue <= 1 });
        const idn = s.identity ? FACTIONS[s.identity.faction].name + (s.identity.task ? "·" + TASK_BY_KEY[s.identity.task].name : "") : "未登记";
        this._log(`✝ ${this._name(seatNo)}死亡,身份公开:${idn}`);
        return { ok: true };
      }
      case "revive": { // 误操作撤销
        const e = needSeat() || overGuard(); if (e) return e;
        if (!s.dead) return { error: "NOT_DEAD" };
        s.dead = false; s.dying = intelCounts(s.intel).black >= 3;
        this.turnDeaths = this.turnDeaths.filter((d) => d.seat !== seatNo);
        this._log(`${this._name(seatNo)}撤销死亡`);
        return { ok: true };
      }
      case "setTurn": {
        const e = needSeat() || overGuard(); if (e) return e;
        this.turn = seatNo; this.turnDeaths = [];
        this._log(`回合 → ${this._name(seatNo)}`);
        return { ok: true };
      }
      case "nextTurn": { // 按座位号顺序跳到下一名存活角色
        const g = overGuard(); if (g) return g;
        const alive = this._alive(); if (!alive.length) return { error: "NO_ALIVE" };
        const cur = this.turn ?? 0;
        const nx = alive.find((n) => n > cur) ?? alive[0];
        this.turn = nx; this.turnDeaths = [];
        this._log(`回合 → ${this._name(nx)}`);
        return { ok: true };
      }

      // ── 宣胜 / 结束 ──
      case "declareWin": { // 本人宣胜:服务端校验,不满足只回本人错误(不泄露)
        const e = needSeat() || overGuard(); if (e) return e;
        if (!holder) return { error: "NOT_HOLDER" };
        const r = this._checkDeclare(seatNo);
        if (r.error) return r;
        // 篡夺者:当前回合角色是存活的篡夺者且不是宣胜者本人 → 代替其胜利
        const t = this.turn != null ? this.seats[this.turn] : null;
        if (t && this.turn !== seatNo && !t.dead && t.identity?.faction === "green" && t.identity.task === "cuanduo") {
          this._end([this.turn], seatNo, `${this._name(seatNo)}宣胜(${r.reason}),但被篡夺者 ${this._name(this.turn)} 在其回合中代替胜利`);
        } else {
          this._end(r.winners, seatNo, r.reason);
        }
        return { ok: true };
      }
      case "forceEnd": { // 手动结算(技能特殊胜利/规则争议的逃生口):任意玩家,前端二次确认
        const g = overGuard(); if (g) return g;
        const winners = (msg.winners || []).map(Number).filter((n) => this.seats[n]);
        this._end(winners, null, "手动结算" + (msg.note ? ":" + String(msg.note).slice(0, 60) : ""));
        return { ok: true };
      }
      case "newGame": { // 再来一局:清空角色/身份/情报,保留座位与持有者、配置
        const keep = { pack: this.pack, idCounts: this.idCounts };
        for (const n of this.seatNos()) { const hd = this.seats[n].holderDevices; this.seats[n] = this._newSeat(n); this.seats[n].holderDevices = hd; }
        this._resetRoom(); Object.assign(this, keep);
        this._log("新的一局");
        return { ok: true };
      }
    }
    return { error: "UNKNOWN_OP" };
  }

  _end(winners, by, reason) {
    this.phase = "over";
    this.result = { winners, by, reason };
    this._log(`🏁 本局结束:${reason}。胜者 ${winners.map((n) => this._name(n)).join("、") || "无"}`);
  }

  // ───────── 视图(保密过滤)─────────
  _seatView(s, holds) {
    const mine = holds.has(s.seatNo);
    const open = this.phase === "over";
    const v = { seatNo: s.seatNo, holderDevices: s.holderDevices.slice(), intel: clone(s.intel), counts: intelCounts(s.intel),
      dying: !!s.dying, dead: !!s.dead, faceUp: !!s.faceUp, hasChar: s.charId != null, hasIdentity: !!s.identity };
    // 角色:面朝上 / 本人 / 结束 → 可见;否则只知道"有一张面朝下的隐藏角色"
    v.charId = (s.charId != null && (s.faceUp || mine || open)) ? s.charId : null;
    // 身份:本人 / 阵亡 / 结束 → 可见
    v.identity = (s.identity && (mine || s.dead || open)) ? clone(s.identity) : null;
    if (mine) {
      v.offers = s.offers.slice();
      v.canWin = this.phase === "play" && this._selfCanWin(s.seatNo);
    } else v.offerCount = s.offers.length;
    return v;
  }
  _roomView() {
    return { game: "fengsheng", phase: this.phase, pack: this.pack, idCounts: clone(this.idCounts), turn: this.turn,
      turnDeaths: clone(this.turnDeaths), result: clone(this.result), log: this.log.slice(0, 60) };
  }
  _serializeExtra() {
    return { fs: { phase: this.phase, pack: this.pack, idCounts: this.idCounts, turn: this.turn, turnDeaths: this.turnDeaths,
      result: this.result, log: this.log, intelSeq: this.intelSeq } };
  }
  _hydrateExtra(data) { if (data.fs) Object.assign(this, data.fs); }
}
