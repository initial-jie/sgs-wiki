// 房间公共基类(游戏无关)—— 座位即身份的多设备房间骨架。
//   设备(deviceId) ⇄ 座位(seatNo) 的认领 / 独占 / 替换 / 释放 / 改名 / 动态增减座位 / 序列化。
// 各游戏继承 RoomBase,只写自己的座位字段(_newSeat)、动作(action)与视图(_seatView/_roomView)。
// 纯逻辑,不含 IO / WebSocket:node 模拟(各游戏的 *-sim.mjs)与 Cloudflare DO(room-do.mjs)共用同一份。
//
// 约定:
//   - deviceId 同时是身份 key 与显示名(改名走 renameDevice 原子改键,座位不丢)。
//   - devices[id].holds 是 Set<seatNo>;一个设备可代持多个座位(没电的朋友),一个座位同时只归一个设备。
//   - 座位号永远 1..N 连续,只从末位增减。

export const clone = (x) => JSON.parse(JSON.stringify(x));

export class RoomBase {
  static MIN_SEATS = 2;
  static MAX_SEATS = 10;

  constructor(roomCode, seatCount, rng = Math.random) {
    this.roomCode = roomCode;
    this.rng = rng; // 注入随机源:worker 用 Math.random,sim 传确定值以复现
    this.seats = {};
    for (let i = 1; i <= seatCount; i++) this.seats[i] = this._newSeat(i);
    this.devices = {};
  }

  // ── 子类覆写点 ──
  _newSeat(i) { return { seatNo: i, holderDevices: [] }; }
  _seatView(s /* , holds, id */) { return clone(s); }          // 该设备看到的单个座位(保密过滤在此做)
  _roomView(/* holds, id */) { return {}; }                    // 房间级附加字段(并入 viewFor 顶层)
  _serializeExtra() { return {}; }                              // 房间级附加持久化字段
  _hydrateExtra(/* data */) {}

  // ── 设备 / 座位 ──
  connect(id) { if (!this.devices[id]) this.devices[id] = { holds: new Set() }; }
  holdsOf(id) { return this.devices[id]?.holds ?? new Set(); }
  isHolder(id, n) { return !!this.devices[id]?.holds.has(Number(n)); }
  seatNos() { return Object.keys(this.seats).map(Number).sort((a, b) => a - b); }

  claimSeat(id, n) {
    n = Number(n); // 座位号统一转数字,holds 比对不会因字符串/数字不一致而 NOT_HOLDER
    const s = this.seats[n];
    if (!s) return { error: "BAD_SEAT" };
    // 座位独占:已被别的设备持有则拒绝(需显式 takeoverSeat 替换),避免两台设备同坐一座位
    if (s.holderDevices.length && !s.holderDevices.includes(id))
      return { error: "SEAT_TAKEN", by: s.holderDevices[0] };
    this.connect(id); this.devices[id].holds.add(n);
    s.holderDevices = [id]; // 单一持有者
    return { ok: true };
  }
  // 解锁替换:强制把座位从原持有设备转到 id(前端二次确认)。断线设备不会锁死座位——任何人可替换。
  takeoverSeat(id, n) {
    n = Number(n);
    const s = this.seats[n]; if (!s) return { error: "BAD_SEAT" };
    for (const prev of s.holderDevices) if (prev !== id) this.devices[prev]?.holds.delete(n); // 撤下原持有者
    this.connect(id); this.devices[id].holds.add(n);
    const took = s.holderDevices.find((d) => d !== id) || null;
    s.holderDevices = [id];
    return { ok: true, took };
  }
  releaseSeat(id, n) {
    n = Number(n);
    this.devices[id]?.holds.delete(n);
    if (this.seats[n]) this.seats[n].holderDevices = this.seats[n].holderDevices.filter((d) => d !== id);
    return { ok: true };
  }
  // 房内改名:deviceId 同时是身份 key(devices/holderDevices)与显示名,故原子改键——搬 holds + 更新座位持有者标记,座位归属不丢
  renameDevice(oldId, newId) {
    newId = (newId ?? "").toString().trim().slice(0, 12); // 同入口 maxlength 12
    if (!newId) return { error: "EMPTY_NAME" };
    if (newId === oldId) return { ok: true, newId };
    if (this.devices[newId]) return { error: "NAME_TAKEN" };            // 房内重名(含占着座位的别的设备)→ 拒绝
    this.devices[newId] = this.devices[oldId] || { holds: new Set() };  // 搬 holds(oldId 从未连接→空册)
    delete this.devices[oldId];
    for (const s of Object.values(this.seats))
      if (s.holderDevices.includes(oldId)) s.holderDevices = s.holderDevices.map((d) => (d === oldId ? newId : d));
    return { ok: true, newId };
  }

  // 动态座位数(MIN~MAX,只从末位增减,永远 1..N 连续,不删中间/不重编号)。任意设备可点(无 holder 守卫)
  addSeat(id) {
    this.connect(id);
    const nos = this.seatNos();
    const n = nos.length ? nos[nos.length - 1] : 0;
    if (n >= this.constructor.MAX_SEATS) return { error: "MAX_SEATS" };
    const next = n + 1;
    this.seats[next] = this._newSeat(next);
    return { ok: true, seatNo: next };
  }
  removeSeat(id) { // 删最高号座位;撤下其在各设备的持有(前端对已占用座位二次确认)
    this.connect(id);
    const nos = this.seatNos();
    if (nos.length <= this.constructor.MIN_SEATS) return { error: "MIN_SEATS" };
    const last = nos[nos.length - 1];
    for (const d of Object.keys(this.devices)) this.devices[d].holds.delete(last);
    delete this.seats[last];
    return { ok: true, removed: last };
  }

  // ── 视图 / 持久化 ──
  viewFor(id) {
    const holds = this.holdsOf(id);
    const seats = {};
    for (const [n, s] of Object.entries(this.seats)) seats[n] = this._seatView(s, holds, id);
    return { roomCode: this.roomCode, youHold: [...holds], seats, ...this._roomView(holds, id) };
  }
  // devices.holds 是 Set,序列化成数组(worker 落 DO storage 用)
  serialize() {
    const devices = {};
    for (const id of Object.keys(this.devices)) devices[id] = { holds: [...this.devices[id].holds] };
    return { roomCode: this.roomCode, seatCount: Object.keys(this.seats).length, seats: this.seats, devices, ...this._serializeExtra() };
  }
  static hydrate(data, rng = Math.random) {
    const core = new this(data?.roomCode ?? "room", data?.seatCount ?? 8, rng);
    if (data?.seats) core.seats = data.seats;
    core.devices = {};
    for (const id of Object.keys(data?.devices || {})) core.devices[id] = { holds: new Set(data.devices[id].holds || []) };
    core._hydrateExtra(data || {});
    return core;
  }
}
