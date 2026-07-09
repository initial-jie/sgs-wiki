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

// 荀攸百出:格子 key = "花色-类型",如 "S-basic";用于日志人读标签
const TYPE_LABEL = { basic: "基本牌", trick: "锦囊牌", equip: "装备牌" };
export function xyKeyLabel(key) {
  const [s, t] = String(key).split("-");
  return (GLYPH[s] || "?") + (TYPE_LABEL[t] || "?");
}

// 谋黄月英并才:可添加的三个锦囊牌名(理贤牌池 = 无中生有 + 已添加的这些)
export const HYY_BC_NAMES = ["顺手牵羊", "过河拆桥", "铁索连环"];

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
  yuanji: {
    // 镜花/水月标记牌 = 袁姬手牌:牌名明细仅袁姬本人/代持可见,他人只见张数(桌上卡夹可数)
    jh: { kind: "ownerSeatOnly" },
    sy: { kind: "ownerSeatOnly" },
    // jieyan / seq / log 默认 public(节言状态全场相关;log 只记张数不记牌名)
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
  if (generalId === "xunyou")
    return {
      grid: {},    // { "花色-类型": 锦囊牌名 }  百出:每格记录首次使用组合对应的一张普通锦囊
      qice: false, // 本轮是否已获得奇策
      round: 1,
      log: [],     // 公开事件(百出全程公开,无保密)
    };
  if (generalId === "huangyueying")
    return {
      bc: [],   // 并才:已添加的牌名(HYY_BC_NAMES 子集,≤3 不重复);集齐3个→理贤准备阶段可发
      lx: [],   // 理贤:使用记录(可重复;取自 无中生有+bc);去重≥3→理贤结束阶段可发
      log: [],  // 公开事件
    };
  if (generalId === "caocao")
    return {
      hp: null,   // 当前体力档:'4'|'3'|'2'|'1'|'king'
      wpn: null,  // 覆载虚拟武器 {n,r,d,sp?}(客户端按血量池随机后解析好的结果,公开)
      arm: null,  // 覆载虚拟防具 {n,d}
      log: [],    // 公开事件
    };
  if (generalId === "yuanji")
    return {
      jh: [],              // 镜花标记牌 [{id,s,r,n}]花色/点数/牌名(ownerSeatOnly:他人只见张数)
      sy: [],              // 水月标记牌 [{id,s,r,n}]
      jieyan: "ok",        // 节言状态:'ok' 有效 / 'off' 本回合失效(公开)
      seq: { jh: 0, sy: 0 },// 标记牌 id 自增计数(不依赖时间戳,worker/sim 一致)
      log: [],             // 公开事件(只记张数,不记牌名)
    };
  if (generalId === "zhongyan")
    return {
      active: null,   // 当前生效技能 {id,name,text,owner:'self'|'lend',note}(公开;随机在客户端,选定才进 DO)
      history: [],    // 博览记录 [{n,name,owner,note,cand:[候选名]}](公开)
      seq: 0,         // 发动次数计数
    };
  if (generalId === "simayi")
    return {
      records: [],      // 诡伏伤害记录 [{name,type:'card'|'skill'}](公开;满3可入魔)
      flashes: 0,       // 诡伏之闪计数(公开)
      demonized: false, // 是否入魔(公开)
      dmg: false,       // 入魔后本轮是否已造成伤害(公开)
      roundNo: 1,       // 入魔后轮次(公开)
      held: null,       // 当前骤袭持有技 {skill,hero,note}(公开;随机在客户端,选定才进 DO)
      round: 0,         // 骤袭抽取次数
      history: [],      // 公开事件 [{type,...}](入魔/轮次结算/骤袭选定)
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
    n = Number(n); // 座位号统一转数字,holds 与 setGeneral 比对不会因字符串/数字不一致而 NOT_HOLDER
    this.connect(id); this.devices[id].holds.add(n);
    const s = this.seats[n]; if (s && !s.holderDevices.includes(id)) s.holderDevices.push(id);
    return { ok: true };
  }
  releaseSeat(id, n) {
    n = Number(n);
    this.devices[id]?.holds.delete(n);
    if (this.seats[n]) this.seats[n].holderDevices = this.seats[n].holderDevices.filter((d) => d !== id);
    return { ok: true };
  }
  setGeneral(id, n, g) {
    n = Number(n);
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

    // ───────── 族荀攸:百出记录表(全程公开台账,无保密;pick/确认等瞬态留客户端)─────────
    if (target.general === "xunyou") {
      const xSeat = targetSeat;
      const isXunyou = bySeat === xSeat && iHold(xSeat); // 荀攸本人(或代持其座位)
      if (t === "recordCard") {
        if (!isXunyou) return { error: "NOT_XUNYOU_ACTION" };
        const { key, name } = toolAction;
        if (!key || !name) return { error: "BAD_RECORD" };
        if (ts.grid[key]) return { error: "CELL_FILLED" };                       // 该格已记录
        if (Object.values(ts.grid).includes(name)) return { error: "NAME_RECORDED" }; // 该锦囊牌名全局唯一
        ts.grid[key] = name;
        this._log(ts, `百出:首次使用${xyKeyLabel(key)},记录【${name}】`);
        return { ok: true };
      }
      if (t === "clearCell") {
        if (!isXunyou) return { error: "NOT_XUNYOU_ACTION" };
        const old = ts.grid[toolAction.key];
        if (old == null) return { error: "CELL_EMPTY" };
        delete ts.grid[toolAction.key];
        this._log(ts, `清除格${xyKeyLabel(toolAction.key)}(原记录【${old}】)`);
        return { ok: true };
      }
      if (t === "toggleQice") {
        if (!isXunyou) return { error: "NOT_XUNYOU_ACTION" };
        ts.qice = !ts.qice;
        this._log(ts, ts.qice ? "百出:非首次组合,本轮获得奇策" : "撤销:本轮奇策标记");
        return { ok: true, qice: ts.qice };
      }
      if (t === "endRound") {
        if (!isXunyou) return { error: "NOT_XUNYOU_ACTION" };
        this._log(ts, `第${ts.round}轮结束${ts.qice ? "(奇策失效)" : ""}`);
        ts.round++; ts.qice = false;
        return { ok: true, round: ts.round };
      }
      if (t === "resetGame") {
        if (!isXunyou) return { error: "NOT_XUNYOU_ACTION" };
        target.toolState = initToolState(target.general);
        return { ok: true, reset: true };
      }
      return { error: "UNKNOWN_ACTION" };
    }

    // ───────── 谋黄月英:并才理贤(全程公开台账,无保密)─────────
    if (target.general === "huangyueying") {
      const hSeat = targetSeat;
      const isHyy = bySeat === hSeat && iHold(hSeat); // 黄月英本人(或代持其座位)
      if (t === "bcAdd") {
        if (!isHyy) return { error: "NOT_HYY_ACTION" };
        const name = toolAction.name;
        if (!HYY_BC_NAMES.includes(name)) return { error: "BAD_BC_NAME" };  // 只能是三选之一
        if (ts.bc.includes(name)) return { error: "BC_DUP" };               // 不可重复
        if (ts.bc.length >= 3) return { error: "BC_FULL" };
        ts.bc.push(name);
        this._log(ts, `并才:为理贤添加牌名【${name}】`);
        if (ts.bc.length >= 3) this._log(ts, "达成:理贤可于准备阶段发动");
        return { ok: true };
      }
      if (t === "bcRm") {
        if (!isHyy) return { error: "NOT_HYY_ACTION" };
        const i = toolAction.index;
        if (ts.bc[i] == null) return { error: "NO_BC" };
        this._log(ts, `撤回并才牌名【${ts.bc[i]}】`);
        ts.bc.splice(i, 1);
        return { ok: true };
      }
      if (t === "lxUse") {
        if (!isHyy) return { error: "NOT_HYY_ACTION" };
        const name = toolAction.name;
        const pool = ["无中生有", ...ts.bc];              // 理贤牌池 = 无中生有 + 已添加
        if (!pool.includes(name)) return { error: "BAD_LX_NAME" };
        const before = new Set(ts.lx).size;
        ts.lx.push(name);
        this._log(ts, `理贤:将一张牌当【${name}】使用`);
        if (before < 3 && new Set(ts.lx).size >= 3) this._log(ts, "达成:理贤可于结束阶段发动");
        return { ok: true };
      }
      if (t === "lxRm") {
        if (!isHyy) return { error: "NOT_HYY_ACTION" };
        const i = toolAction.index;
        if (ts.lx[i] == null) return { error: "NO_LX" };
        this._log(ts, `删除理贤记录:第${i + 1}次【${ts.lx[i]}】`);
        ts.lx.splice(i, 1);
        return { ok: true };
      }
      if (t === "resetGame") {
        if (!isHyy) return { error: "NOT_HYY_ACTION" };
        target.toolState = initToolState(target.general);
        return { ok: true, reset: true };
      }
      return { error: "UNKNOWN_ACTION" };
    }

    // ───────── 魔曹操:覆载虚拟装备(公开;随机在客户端跑,只有解析好的结果进 DO)─────────
    if (target.general === "caocao") {
      const cSeat = targetSeat;
      const isCao = bySeat === cSeat && iHold(cSeat); // 曹操本人(或代持其座位)
      if (t === "setEquip") {
        if (!isCao) return { error: "NOT_CAO_ACTION" };
        const { hp, wpn, arm } = toolAction;
        if (!hp || !wpn || !arm) return { error: "BAD_EQUIP" };
        ts.hp = hp; ts.wpn = wpn; ts.arm = arm;
        this._log(ts, `覆载:${hp === "king" ? "主公/地主/5血" : hp + "血"} → 武器【${wpn.n}】(范围${wpn.r})/防具【${arm.n}】`);
        return { ok: true };
      }
      if (t === "resetGame") {
        if (!isCao) return { error: "NOT_CAO_ACTION" };
        target.toolState = initToolState(target.general);
        return { ok: true, reset: true };
      }
      return { error: "UNKNOWN_ACTION" };
    }

    // ───────── 袁姬:镜花水月标记牌(牌名 ownerSeatOnly,张数/节言公开;prompt 流留客户端)─────────
    if (target.general === "yuanji") {
      const ySeat = targetSeat;
      const isYuanji = bySeat === ySeat && iHold(ySeat); // 袁姬本人(或代持其座位)
      const ZN = (z) => (z === "jh" ? "镜花" : "水月");
      const okZone = (z) => z === "jh" || z === "sy";
      if (t === "addCards") {
        if (!isYuanji) return { error: "NOT_YUANJI_ACTION" };
        const z = toolAction.zone;
        if (!okZone(z)) return { error: "BAD_ZONE" };
        const n = Math.max(1, Math.min(10, Math.floor(toolAction.n) || 1));
        for (let i = 0; i < n; i++) { ts.seq[z]++; ts[z].push({ id: z + ts.seq[z], s: null, r: null, n: "" }); }
        this._log(ts, `${ZN(z)} +${n}(现持有${ts[z].length})`);
        return { ok: true };
      }
      if (t === "editCard") {
        if (!isYuanji) return { error: "NOT_YUANJI_ACTION" };
        const c = okZone(toolAction.zone) ? ts[toolAction.zone].find((x) => x.id === toolAction.id) : null;
        if (!c) return { error: "NO_CARD" };
        // 记录牌身份(花色/点数/牌名),均仅袁姬可见(ownerSeatOnly);像吕布一样选花色+点数再点牌名
        if ("s" in toolAction) c.s = toolAction.s || null;
        if ("r" in toolAction) c.r = toolAction.r || null;
        if ("n" in toolAction) c.n = String(toolAction.n || "").slice(0, 20);
        return { ok: true };
      }
      if (t === "dissipate") {
        if (!isYuanji) return { error: "NOT_YUANJI_ACTION" };
        const z = toolAction.zone;
        if (!okZone(z)) return { error: "BAD_ZONE" };
        const before = ts[z].length;
        ts[z] = ts[z].filter((x) => x.id !== toolAction.id);
        if (ts[z].length === before) return { error: "NO_CARD" };
        this._log(ts, `${ZN(z)}牌消散(现持有${ts[z].length})`);
        return { ok: true };
      }
      if (t === "placeZone") {
        if (!isYuanji) return { error: "NOT_YUANJI_ACTION" };
        const z = toolAction.zone;
        if (!okZone(z)) return { error: "BAD_ZONE" };
        const n = ts[z].length;
        ts[z] = [];
        this._log(ts, n ? `${ZN(z)} ${n} 张置于牌堆${z === "jh" ? "底" : "顶"}` : `${ZN(z)}归位:当前无标记牌`);
        // 归位恰好2张且节言有效 → 提示袁姬自身可发动节言(prompt 由客户端弹)
        return { ok: true, triggerJieyan: n === 2 && ts.jieyan === "ok" };
      }
      if (t === "jieyanResult") {
        if (!isYuanji) return { error: "NOT_YUANJI_ACTION" };
        if (toolAction.same === false) { ts.jieyan = "off"; this._log(ts, "节言:花色不同,本回合失效"); }
        else this._log(ts, "节言:两端各摸一张展示,花色相同,技能保持有效");
        return { ok: true, jieyan: ts.jieyan };
      }
      if (t === "resetJieyan") {
        if (!isYuanji) return { error: "NOT_YUANJI_ACTION" };
        ts.jieyan = "ok";
        this._log(ts, "新回合:节言状态重置为有效");
        return { ok: true };
      }
      if (t === "resetGame") {
        if (!isYuanji) return { error: "NOT_YUANJI_ACTION" };
        target.toolState = initToolState(target.general);
        return { ok: true, reset: true };
      }
      return { error: "UNKNOWN_ACTION" };
    }

    // ───────── 标钟琰:博览生成技能(公开;随机在客户端跑,只有选定结果 + 候选进 DO)─────────
    if (target.general === "zhongyan") {
      const zSeat = targetSeat;
      const isZhong = bySeat === zSeat && iHold(zSeat); // 钟琰本人(或代持其座位)
      if (t === "setActive") {
        if (!isZhong) return { error: "NOT_ZHONG_ACTION" };
        const sk = toolAction.skill || {};
        if (!sk.name) return { error: "BAD_SKILL" };
        const owner = toolAction.owner === "lend" ? "lend" : "self";
        const note = owner === "lend" ? String(toolAction.note || "").slice(0, 40) : "";
        const cand = Array.isArray(toolAction.cand) ? toolAction.cand.map((x) => String(x).slice(0, 20)) : [];
        ts.seq++;
        ts.active = { id: sk.id || "", name: String(sk.name).slice(0, 20), text: String(sk.text || "").slice(0, 200), owner, note };
        ts.history.push({ n: ts.seq, name: ts.active.name, owner, note, cand });
        if (ts.history.length > 100) ts.history.shift();
        return { ok: true };
      }
      if (t === "endActive") {
        if (!isZhong) return { error: "NOT_ZHONG_ACTION" };
        ts.active = null;
        return { ok: true };
      }
      if (t === "resetGame") {
        if (!isZhong) return { error: "NOT_ZHONG_ACTION" };
        target.toolState = initToolState(target.general);
        return { ok: true, reset: true };
      }
      return { error: "UNKNOWN_ACTION" };
    }

    // ───────── 魔司马懿:谋变骤袭(全公开;随机在客户端跑,选定结果进 DO;技能池是本机配置)─────────
    if (target.general === "simayi") {
      const mSeat = targetSeat;
      const isSima = bySeat === mSeat && iHold(mSeat); // 司马懿本人(或代持其座位)
      const hist = (e) => { ts.history.unshift(e); if (ts.history.length > 80) ts.history.pop(); };
      if (t === "addRecord") {
        if (!isSima) return { error: "NOT_SIMA_ACTION" };
        const name = String(toolAction.name || "").trim().slice(0, 10);
        const recType = toolAction.recType === "skill" ? "skill" : "card"; // 注意:不能用 toolAction.type,它是 action 类型
        if (!name) return { error: "BAD_RECORD" };
        if (ts.records.some((r) => r.name === name)) return { error: "REC_DUP" };
        ts.records.push({ name, type: recType });
        return { ok: true, count: ts.records.length };
      }
      if (t === "removeRecord") {
        if (!isSima) return { error: "NOT_SIMA_ACTION" };
        if (ts.records[toolAction.index] == null) return { error: "NO_RECORD" };
        ts.records.splice(toolAction.index, 1);
        return { ok: true };
      }
      if (t === "enterDemon") {
        if (!isSima) return { error: "NOT_SIMA_ACTION" };
        if (ts.demonized) return { error: "ALREADY_DEMON" };
        if (ts.records.length < 3) return { error: "NEED_3_RECORDS" }; // 谋变:记录满3方可入魔
        ts.demonized = true; ts.dmg = false; ts.roundNo = 1;
        const closed = Array.isArray(toolAction.closed) ? toolAction.closed.map((x) => String(x).slice(0, 20)) : [];
        hist({ type: "demon", txt: `入魔!获得记录:${ts.records.map((r) => r.name).join("、")}` + (closed.length ? `(骤袭池关闭同名技:${closed.join("、")})` : "") });
        return { ok: true };
      }
      if (t === "flashInc") { if (!isSima) return { error: "NOT_SIMA_ACTION" }; ts.flashes++; return { ok: true, flashes: ts.flashes }; }
      if (t === "flashDec") { if (!isSima) return { error: "NOT_SIMA_ACTION" }; if (ts.flashes > 0) ts.flashes--; return { ok: true, flashes: ts.flashes }; }
      if (t === "toggleDmg") { if (!isSima) return { error: "NOT_SIMA_ACTION" }; ts.dmg = !ts.dmg; return { ok: true, dmg: ts.dmg }; }
      if (t === "endRound") {
        if (!isSima) return { error: "NOT_SIMA_ACTION" };
        if (!ts.demonized) return { error: "NOT_DEMON" };
        const lost = !ts.dmg;
        hist({ type: "round", txt: lost ? `第${ts.roundNo}轮结束:本轮未造成伤害→失去1点体力` : `第${ts.roundNo}轮结束:受你伤害的角色各视为对你使用一张【杀】` });
        ts.roundNo++; ts.dmg = false;
        return { ok: true, lostHp: lost };
      }
      if (t === "pickSkill") {
        if (!isSima) return { error: "NOT_SIMA_ACTION" };
        if (!ts.demonized) return { error: "NOT_DEMON" };  // 骤袭需先入魔解锁
        const sk = toolAction.skill || {};
        if (!sk.skill) return { error: "BAD_SKILL" };
        const drew = Array.isArray(toolAction.drew) ? toolAction.drew.map((x) => String(x).slice(0, 20)) : [];
        ts.round++;
        ts.held = { skill: String(sk.skill).slice(0, 20), hero: String(sk.hero || "").slice(0, 20), note: String(sk.note || "").slice(0, 200) };
        hist({ type: "draw", r: ts.round, drew, got: ts.held.skill });
        return { ok: true };
      }
      if (t === "clearHeld") { if (!isSima) return { error: "NOT_SIMA_ACTION" }; ts.held = null; return { ok: true }; }
      if (t === "resetGame") {
        if (!isSima) return { error: "NOT_SIMA_ACTION" };
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
