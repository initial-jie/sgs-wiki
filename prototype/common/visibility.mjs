// 字段级保密原语(游戏无关)。一个"可见性 spec" = { 字段名: { kind } },未列出的字段默认 public。
// applyVisibility(spec, state, holds, ctx) 按请求设备持有的座位(holds: Set<seatNo>)把 state 过滤成它该看到的样子。
// ctx.ownerSeat = 这份 state 属于哪个座位(ownerSeatOnly 用)。
//
// kind 一览:
//   public            全场可见(默认)
//   ownerSeatOnly     仅 ownerSeat 的持有者可见;他人只见 {count}(数组长度 / 对象键数)
//   secretHolding     { [座位]: {cards:[{…,taken}]} }:明细仅该座位本人/代持可见,他人只见每座位剩余张数 counts
//   secretPick        { [座位]: {holder, revealed, …} }:翻开前仅该座位本人可见内容,他人只见 {holder, hidden}
//   ownerOnly         [{holder, owners:[座位], revealed, …}]:owners 之一的持有者或 revealed 后可见,旁人只见占位
//   pendingTargetOnly {c?}:可见者 = state.pending.targetSeat 的持有者,或 pending.revealed 后全场;他人只见 {count}
//   seatKeyed         { [座位]: 任意 }:每个座位只看得到自己那一格,他人只见 {hidden:true}(发身份/私密手牌用)

import { clone } from "./room-base.mjs";

export function applyVisibility(spec, state, holds, ctx = {}) {
  if (!spec) return clone(state);
  const out = {};
  for (const [field, val] of Object.entries(state || {})) {
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
      out[field] = holds.has(ctx.ownerSeat)
        ? clone(val)
        : { count: Array.isArray(val) ? val.length : Object.keys(val).length };
      continue;
    }
    if (rule.kind === "pendingTargetOnly") {
      const p = state.pending;
      out[field] = (p && (p.revealed || holds.has(p.targetSeat)))
        ? clone(val)
        : { count: val && val.c ? 1 : 0 };
      continue;
    }
    if (rule.kind === "secretPick") {
      const out2 = {};
      for (const [s, pk] of Object.entries(val || {}))
        out2[s] = (pk.revealed || holds.has(Number(s))) ? clone(pk) : { holder: pk.holder, hidden: true };
      out[field] = out2;
      continue;
    }
    if (rule.kind === "ownerOnly") {
      out[field] = (val || []).map((bk) =>
        (bk.revealed || (bk.owners || []).some((s) => holds.has(s)))
          ? clone(bk)
          : { holder: bk.holder, hidden: true }
      );
      continue;
    }
    if (rule.kind === "seatKeyed") {
      const out2 = {};
      for (const [s, v] of Object.entries(val || {}))
        out2[s] = holds.has(Number(s)) ? clone(v) : { hidden: true };
      out[field] = out2;
      continue;
    }
    out[field] = clone(val); // 未知 kind:按 public 处理(不应发生)
  }
  return out;
}
