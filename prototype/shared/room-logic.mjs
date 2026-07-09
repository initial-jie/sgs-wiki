// 房间核心逻辑(运行时无关)—— 被两处共用:
//   1) prototype/room-sim.mjs      "可执行规格" node 断言
//   2) prototype/worker/src/index.js  真实 Cloudflare Workers Durable Object
// 方案 a:只存纯数据 + 可见性过滤;例外 = 炁转移的随机/结算在 DO 端执行(保密数据不出 DO)。
//
// 炁转移由【吕布本人】主动触发,系统随机/结算;失去方"零操作也知情"——
// 被划走的那张会在失去方自己的 qiRegister.mine 里标 taken,他一看自己界面就知道交哪张实体牌。
//   - 夺炁 duoqi         : 吕布选目标座位 → 随机划走其一张 → 进吕布 gained;本回合对同一座位只能夺一次
//   - newTurn           : 吕布开新回合,重置"本回合已夺"锁
//   - 狂角色被击败 defeatKuang : 吕布触发 → 狂角色全部剩余炁进吕布 gained;之后 repickKuang 重新指定
//   - 狂角色阵亡 kuangDiedByOther : 非吕布击杀,不转移;入魔保持,吕布重新指定下一个狂角色
//   - 吕布被击杀 lvbuKilled   : 吕布触发 → 只交出自己【初始】手牌的炁(不含夺来的 gained)
// 可见性:夺到的那张 —— 吕布(gained)可见、失去方(自己 mine 的 taken)可见、其他人仅见数量。

const GLYPH = { S: "♠", H: "♥", C: "♣", D: "♦" };
export function cardLabel(c) { return GLYPH[c.s] + c.r + (c.n ? " " + c.n : ""); }

// ---------- 可见性 spec(字段级原语;未列出的字段默认 public)----------
export const VISIBILITY = {
  lvbu: {
    qiRegister: { kind: "secretHolding" }, // 各座位初始炁:明细仅本人/代持可见;系统全可读;剩余数量全场公开
    gained: { kind: "ownerSeatOnly" },     // 吕布已获得的炁:仅吕布座位可见
    given: { kind: "ownerSeatOnly" },      // 吕布死亡交出的炁:仅吕布座位可见明细(他人见数量)
    // entered / kuangTarget / round / dmgThisRound / phase / stolenThisTurn / log 默认 public
  },
  nanhua: {
    // 天书:每册自带 owners(可见者)与 revealed(发动即全场公开);旁人只见占位、能数出"持有N册"
    books: { kind: "ownerOnly" },
    // cap / log 默认 public
  },
};

const clone = (x) => JSON.parse(JSON.stringify(x));

export function filterState(seat, holds) {
  const spec = VISIBILITY[seat.general];
  if (!spec) return clone(seat.toolState);
  const out = {};
  for (const [field, val] of Object.entries(seat.toolState)) {
    const rule = spec[field];
    if (!rule || rule.kind === "public") { out[field] = clone(val); continue; }

    if (rule.kind === "secretHolding") {
      const mine = {}, counts = {};
      for (const [bySeat, entry] of Object.entries(val)) {
        counts[bySeat] = entry.cards.filter((c) => !c.taken).length; // 剩余未被夺数量(公开)
        if (holds.has(Number(bySeat))) mine[bySeat] = clone(entry);   // 明细仅本人/代持
      }
      out[field] = { mine, counts };
      continue;
    }
    if (rule.kind === "ownerSeatOnly") {
      out[field] = holds.has(seat.seatNo)
        ? clone(val)
        : { count: Array.isArray(val) ? val.length : Object.keys(val).length };
      continue;
    }
    // ownerOnly:val 是"每册自带 owners 名单"的数组。发动(revealed)后转公开;
    // 否则仅当请求者代持某位 owner 时给全量,旁人只见占位(保留 holder → 可数出持有册数)。
    if (rule.kind === "ownerOnly") {
      out[field] = (val || []).map((bk) =>
        (bk.revealed || (bk.owners || []).some((s) => holds.has(s)))
          ? clone(bk)
          : { holder: bk.holder, hidden: true }
      );
      continue;
    }
  }
  return out;
}

export function initToolState(generalId) {
  if (generalId === "lvbu")
    return {
      qiRegister: {},        // { [seat]: { cards:[{s,r,n,taken}] } }  含吕布本人座位
      phase: "reg",          // reg | game
      entered: false,        // 是否入魔
      kuangTarget: null,     // 狂角色座位
      round: 1,
      dmgThisRound: false,
      stolenThisTurn: [],    // 本回合已被夺过的座位(每回合对同一角色只夺一次)
      gained: [],            // [{label, from}]  吕布现有的炁(罡拳用)
      given: [],             // [{label, toSeat}] 吕布死亡时交出的炁
      log: [],               // 公开事件
    };
  if (generalId === "nanhua")
    return {
      cap: 2,   // 合道上限:2(初始)/ 3(濒死后)—— 仅约束南华本人持有栏
      books: [],// [{owners:[座位…], holder:座位, uses, revealed, timing:{level,text}, effect:{level,text}}]
      log: [],  // 公开事件
    };
  return {};
}

// ---------- 房间权威(纯逻辑,不含 IO / WebSocket)----------
export class RoomCore {
  constructor(roomCode, seatCount, rng = Math.random) {
    this.roomCode = roomCode;
    this.rng = rng; // 注入随机源:worker 用 Math.random,sim 传确定值以复现
    this.seats = {};
    for (let i = 1; i <= seatCount; i++)
      this.seats[i] = { seatNo: i, general: null, holderDevices: [], toolState: {} };
    this.devices = {};
  }

  connect(id) { if (!this.devices[id]) this.devices[id] = { holds: new Set() }; }
  claimSeat(id, n) {
    this.connect(id); this.devices[id].holds.add(n);
    const s = this.seats[n]; if (s && !s.holderDevices.includes(id)) s.holderDevices.push(id);
    return { ok: true };
  }
  releaseSeat(id, n) {
    this.devices[id]?.holds.delete(n);
    if (this.seats[n]) this.seats[n].holderDevices = this.seats[n].holderDevices.filter((d) => d !== id);
    return { ok: true };
  }
  setGeneral(id, n, g) {
    if (!this.devices[id]?.holds.has(n)) return { error: "NOT_HOLDER" };
    this.seats[n].general = g; this.seats[n].toolState = initToolState(g);
    return { ok: true };
  }

  _log(ts, msg) { ts.log.unshift(msg); if (ts.log.length > 200) ts.log.pop(); }

  action(id, { targetSeat, bySeat, toolAction }) {
    const dev = this.devices[id];
    if (!dev) return { error: "NO_DEVICE" };
    const target = this.seats[targetSeat];
    if (!target?.general) return { error: "BAD_TARGET" };
    const ts = target.toolState;
    const t = toolAction.type;
    const iHold = (s) => dev.holds.has(s);
    const isLvbu = bySeat === targetSeat && iHold(bySeat); // 吕布本人(或代持吕布座位)

    // ───────── 南华老仙:天书(条件公开 ownerOnly)。随机抽牌在客户端跑,只有成册进 DO ─────────
    if (target.general === "nanhua") {
      const nSeat = targetSeat;                       // 天书工具挂在南华座位上
      const isNanhua = bySeat === nSeat && iHold(nSeat); // 南华本人(或代持南华座位)
      const ownCount = () => ts.books.filter((b) => b.holder === nSeat).length;

      if (t === "setCap") {
        if (!isNanhua) return { error: "NOT_NANHUA_ACTION" };
        ts.cap = toolAction.cap === 3 ? 3 : 2;
        // 降上限:从尾部丢弃南华自留超出的册(授出的不算在持有栏内)
        while (ownCount() > ts.cap) {
          const i = ts.books.map((b, j) => j).reverse().find((j) => ts.books[j].holder === nSeat);
          ts.books.splice(i, 1);
        }
        return { ok: true, cap: ts.cap };
      }

      if (t === "writeBook") {
        if (!isNanhua) return { error: "NOT_NANHUA_ACTION" };
        const b = toolAction.book || {};
        if (!b.timing || !b.effect) return { error: "BAD_BOOK" };
        const book = { owners: [nSeat], holder: nSeat, uses: 2, revealed: false, timing: b.timing, effect: b.effect };
        if (ownCount() >= ts.cap) {
          const ri = toolAction.replaceIndex; // 满栏必须指定替换哪一册(books 全局下标,须是自留)
          if (ri == null || ts.books[ri]?.holder !== nSeat) return { error: "NEED_REPLACE" };
          ts.books[ri] = book;
        } else {
          ts.books.push(book);
        }
        this._log(ts, "南华书写天书一册");
        return { ok: true };
      }

      if (t === "giveBook") {
        if (!isNanhua) return { error: "NOT_NANHUA_ACTION" };
        const bk = ts.books[toolAction.index];
        if (!bk || bk.holder !== nSeat) return { error: "NOT_OWN_BOOK" };
        if (bk.uses < 2) return { error: "USED_CANT_GIVE" };  // 只能授术未动用(2次)的天书
        const to = toolAction.toSeat;
        if (to === nSeat) return { error: "CANT_GIVE_SELF" };
        if (ts.books.some((b) => b.holder === to)) return { error: "TARGET_HAS_BOOK" }; // 每名他人同持一册
        bk.holder = to; bk.owners = [nSeat, to]; bk.uses = 1;
        this._log(ts, `南华授术天书给座位${to}`);
        return { ok: true };
      }

      if (t === "useBook") {
        const bk = ts.books[toolAction.index];
        if (!bk) return { error: "NO_BOOK" };
        if (!iHold(bk.holder)) return { error: "NOT_BOOK_HOLDER" }; // 操作权归持有座位本人
        bk.revealed = true; // 发动即全场公开(宣示时机+效果)
        bk.uses -= 1;
        this._log(ts, `座位${bk.holder}发动天书:${bk.timing.text} → ${bk.effect.text}`);
        if (bk.uses <= 0) ts.books.splice(toolAction.index, 1);
        return { ok: true, revealed: true };
      }

      if (t === "resetGame") {
        if (!isNanhua) return { error: "NOT_NANHUA_ACTION" };
        target.toolState = initToolState(target.general);
        return { ok: true, reset: true };
      }

      return { error: "UNKNOWN_ACTION" };
    }

    // 任意座位登记自己(或代持)那份初始炁(含吕布本人)
    if (t === "registerQi") {
      if (!iHold(bySeat)) return { error: "BYSEAT_NOT_HELD" };
      ts.qiRegister[bySeat] = { cards: toolAction.cards.map((c) => ({ s: c.s, r: c.r, n: c.n || "", taken: false })) };
      return { ok: true };
    }
    if (t === "finishReg") {
      if (!isLvbu) return { error: "NOT_LVBU_ACTION" };
      ts.phase = "game"; this._log(ts, "炁牌登记完毕,进入对局"); return { ok: true };
    }

    // 夺炁:吕布选目标座位,系统随机划走其一张未被夺的炁(本回合对同一座位只能夺一次)
    if (t === "duoqi") {
      if (!isLvbu) return { error: "NOT_LVBU_ACTION" };
      const from = toolAction.fromSeat;
      if (from === targetSeat) return { error: "CANT_STEAL_SELF" };
      if (ts.stolenThisTurn.includes(from)) return { error: "ALREADY_STOLEN_THIS_TURN" };
      const pile = ts.qiRegister[from];
      const idxs = pile ? pile.cards.map((c, i) => i).filter((i) => !pile.cards[i].taken) : [];
      if (!idxs.length) return { error: "NO_QI" };
      const chosen = (toolAction.index != null && idxs.includes(toolAction.index))
        ? toolAction.index : idxs[Math.floor(this.rng() * idxs.length)];
      pile.cards[chosen].taken = true;
      const label = cardLabel(pile.cards[chosen]);
      ts.gained.push({ label, from: "夺自座位" + from });
      ts.stolenThisTurn.push(from);
      this._log(ts, `吕布对座位${from}夺炁,取得1张`);
      return { ok: true, card: label }; // 牌面仅回吕布本人;失去方经自己 mine 的 taken 得知
    }
    if (t === "newTurn") {
      if (!isLvbu) return { error: "NOT_LVBU_ACTION" };
      ts.stolenThisTurn = [];
      return { ok: true };
    }

    // 吕布本人:入魔并指定狂角色
    if (t === "enterMo") {
      if (!isLvbu) return { error: "NOT_LVBU_ACTION" };
      ts.entered = true; ts.kuangTarget = toolAction.kuangTarget; ts.dmgThisRound = false;
      this._log(ts, `吕布入魔,指定座位${toolAction.kuangTarget}为狂角色`);
      return { ok: true };
    }

    // 狂角色被吕布击败:吕布触发,狂角色全部剩余炁进吕布 gained
    if (t === "defeatKuang") {
      if (!isLvbu) return { error: "NOT_LVBU_ACTION" };
      const k = toolAction.kuangSeat ?? ts.kuangTarget;
      if (k == null) return { error: "NO_KUANG" };
      const pile = ts.qiRegister[k];
      let moved = 0;
      if (pile) for (const c of pile.cards) if (!c.taken) { c.taken = true; ts.gained.push({ label: cardLabel(c), from: "狂魔·座位" + k }); moved++; }
      if (ts.kuangTarget === k) ts.kuangTarget = null;
      this._log(ts, `吕布击败狂角色座位${k},转移其全部剩余炁(${moved}张)`);
      return { ok: true, moved };
    }

    // 狂角色死亡后:入魔状态保持,吕布立即在存活玩家中重新指定下一个狂角色
    if (t === "repickKuang") {
      if (!isLvbu) return { error: "NOT_LVBU_ACTION" };
      if (!ts.entered) return { error: "NOT_ENTERED" };
      ts.kuangTarget = toolAction.kuangTarget;
      this._log(ts, `重新指定座位${toolAction.kuangTarget}为狂角色`);
      return { ok: true };
    }
    // 狂角色被非吕布击杀:不转移炁,清空待重新指定
    if (t === "kuangDiedByOther") {
      if (!isLvbu) return { error: "NOT_LVBU_ACTION" };
      const k = ts.kuangTarget;
      ts.kuangTarget = null;
      this._log(ts, `狂角色座位${k}阵亡(非吕布击杀),不转移炁,待重新指定`);
      return { ok: true };
    }

    // 吕布被击杀:只交出【自己初始手牌】的炁给击杀者(不含从他人夺来的 gained)
    if (t === "lvbuKilled") {
      if (!isLvbu) return { error: "NOT_LVBU_ACTION" };
      const to = toolAction.killerSeat ?? ts.kuangTarget;
      const pile = ts.qiRegister[targetSeat];
      const out = [];
      if (pile) for (const c of pile.cards) if (!c.taken) { c.taken = true; out.push(cardLabel(c)); }
      ts.given.push(...out.map((label) => ({ label, toSeat: to })));
      this._log(ts, `吕布被座位${to}击杀,交出初始炁${out.length}张(夺来的炁不交)`);
      return { ok: true, given: out.length };
    }

    // 吕布本人:每轮结算(公开)
    if (t === "toggleDmg") {
      if (!isLvbu) return { error: "NOT_LVBU_ACTION" };
      ts.dmgThisRound = !ts.dmgThisRound; return { ok: true };
    }
    if (t === "endRound") {
      if (!isLvbu) return { error: "NOT_LVBU_ACTION" };
      const lost = ts.entered && !ts.dmgThisRound;
      this._log(ts, `第${ts.round}轮结束` + (lost ? ":本轮未造成伤害,吕布失去1点体力" : ""));
      ts.round++; ts.dmgThisRound = false;
      return { ok: true, lostHp: lost };
    }

    // 重置本局:清空工具进度回到登记阶段,保留座位武将(仅吕布可发起;前端二次确认防误触)
    if (t === "resetGame") {
      if (!isLvbu) return { error: "NOT_LVBU_ACTION" };
      target.toolState = initToolState(target.general);
      return { ok: true, reset: true };
    }

    return { error: "UNKNOWN_ACTION" };
  }

  viewFor(id) {
    const holds = this.devices[id]?.holds ?? new Set();
    const seats = {};
    for (const [n, s] of Object.entries(this.seats))
      seats[n] = { seatNo: s.seatNo, general: s.general, holderDevices: s.holderDevices.slice(), toolState: filterState(s, holds) };
    return { roomCode: this.roomCode, youHold: [...holds], seats };
  }
}
