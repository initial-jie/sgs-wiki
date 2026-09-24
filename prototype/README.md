# SGS 线下房间 · 原型(prototype)

房间协议的可运行原型。协议本身见 [`../docs/room-protocol.md`](../docs/room-protocol.md)。

```
common/                    ★ 公共房间库(游戏无关;新游戏直接复用)
  room-base.mjs            RoomBase:座位即身份——认领/独占/替换/释放/改名/增删座位/序列化
  visibility.mjs           字段级保密原语(ownerSeatOnly/secretPick/seatKeyed…),按设备持有座位过滤
  room-do.mjs              RoomDOBase:Durable Object 外壳(WebSocket/持久化/2h TTL/解散/广播)+ 响应小工具
  client/room-client.js    浏览器公共库 RoomClient:设备 ID/连接+断线重连/写阻断/改名/toast/加入表单
sgs/                       三国杀
  shared/room-logic.mjs    RoomCore extends RoomBase:武将工具/全场面板/禁将,被 sim 与 worker 共用
  shared/*.json|mjs        武将库/衍生技/装备/牌堆等数据
  worker.mjs               三国杀 HTTP 路由 + RoomDO(DO 类名固定)
  client/room.html         ★ 三国杀房间前端(宣纸风)
  room-sim.mjs             "可执行规格":node 断言
  deck-test.mjs / build-*.mjs / scrape-generals.mjs / rebake-overrides.mjs  数据与测试脚本
fengsheng/                 风声(游卡典藏版,线下辅助形态)——同一套 common/ 上的第二个游戏
  shared/fs-logic.mjs      FsCore extends RoomBase:选角/身份保密、情报区、濒死死亡、回合、宣胜校验
  shared/fs-data.mjs       角色/功能牌/神秘人任务/身份配比
  worker.mjs               /fs 页面 + /fs/data.json + FsRoomDO
  client/fs.html           风声房间前端(民国谍报档案风)
  fs-sim.mjs               node 断言:node prototype/fengsheng/fs-sim.mjs
  build-pinyin.mjs         角色名拼音 → shared/char-pinyin.json(选角拼音搜索)
worker/                    一个 worker 托管所有游戏:src/index.js 只做路由
```

新增一个游戏 = 新建 `<game>/`:`XxxCore extends RoomBase` + `XxxRoomDO extends RoomDOBase` + 客户端页引 `/common/room-client.js`,
再在 `worker/src/index.js` 挂路由、`wrangler.toml` 加 DO 绑定与迁移。

## 1. 跑逻辑测试(最快,不用装任何东西)

```bash
node prototype/sgs/room-sim.mjs
# 期望:全部 passed, 0 failed(当前 589)
```

改了 `sgs/shared/room-logic.mjs` 后务必重跑,保证协议不回退。

## 2. 本地起服务端 + 多标签联调(真实 WebSocket)

前置:装了 node。首次会用 npx 拉 wrangler(需一次联网下载 workerd,之后离线可用)。

**Mac / Linux:**
```bash
cd prototype/worker
npx wrangler dev          # 起在 http://localhost:8787
```
**Windows(家里那台,PowerShell):** 命令一模一样
```powershell
cd prototype\worker
npx wrangler dev
```

然后**双击打开 `prototype/sgs/client/index.html`**(直接 file:// 即可),多开几个标签页:

1. 每个标签是一台"设备"。点左上角蓝色 deviceId 可改成不同值,模拟不同手机(或用隐身窗口)。
2. 所有标签填**同一个房间码**(如 1234)→ 点「连接」。
3. 标签 A 认领「座位1」→ 选武将「魔吕布」。
4. 标签 B 认领「座位2」→ 在吕布台账里「以座位2登记我的初始牌」填 `杀,闪,桃`。
5. **观察保密**:
   - 标签 B(座位2)看得到自己登记的 `杀 闪 桃`;
   - 标签 A(吕布)**只看到「座位2=3」这个数量,看不到牌名**;
   - 吕布点「夺炁 从座位2 第0张」→ 只有吕布标签弹出「★ 夺到炁牌:杀」,别的标签看不到夺了啥牌名,只看到公开记录「吕布从座位2夺走1张炁」。
6. **试 fallback**:让标签 B 关掉(模拟没电),标签 A 或新标签点座位2「认领(可代持)」→ 代持者就能看到座位2 的牌了,而吕布仍然看不到。

这一套跑通,就等于在真实 WebSocket 上复现了 `room-sim.mjs` 的 18 条断言。

## 2.5 正式吕布房间前端(room.html)

起好 worker(`cd prototype/worker && npx wrangler dev`)后,浏览器开 **`prototype/sgs/client/room.html`**,开几个标签(每个标签点"本设备 ID"改成不同值,或用隐身窗口,模拟不同手机)。验证剧本:

1. 填服务端 `ws://localhost:8787`、同一房间码 → 连接。
2. 标签A 认领座位1 → 选「魔吕布」;标签B 认领座位2;标签C 认领座位3。
3. 各标签为自己座位登记初始炁(花色 + 点数 + 牌名)。**故意登一张"♠黑桃的桃"**,看是否弹黄色警告;登"乱写的牌名"看灰色提醒。
4. 吕布(标签A)点「全部登记完毕,进入对局」。
5. 吕布点「夺炁 → 座位2」:
   - 吕布这边弹出**炁揭示牌** + "你的炁"列表新增一张;
   - **座位2 标签**自己那张炁被划掉标记(⚔),提示交给吕布;
   - **座位3 标签**只看到"座位2 余N"数字,拿不到牌面。
6. 吕布再点座位2 → 按钮显示"本回合已夺"禁用;点「开新回合」→ 又能夺。
7. 入魔指定狂角色 → 击败 → 看其全部炁转移;试「吕布被击杀」交出全部炁。
8. **fallback**:关掉座位2 标签(模拟没电),另一标签点座位2「认领」代持,能看到座位2 的炁明细替其交牌。

## 3. 部署到真机(手机联网玩)

```bash
cd prototype/worker
npx wrangler login        # 弹浏览器,登你的 Cloudflare 账号
npx wrangler deploy       # 得到 https://sgs-room.<你的账号>.workers.dev
```
**部署即一体化**:worker 把 `client/room.html` 内联打包,根路径 `/` 直接吐客户端页。
手机浏览器开 `https://sgs-room.<你的账号>.workers.dev/` 就是房间界面,「服务端」一栏
已自动填成同源 `wss://...`(page 走 https → 自动 wss),**无需手填地址**。各手机填同一
房间码即进同一桌。(房间页依赖 worker 下发的 `/common/room-client.js`,本地请走 `wrangler dev` 打开 http://localhost:8787,不再支持 file:// 直开。)

## 已知原型限制(待正式化时处理)

- DO 状态目前**纯内存**:一局游戏期间 DO 常驻没问题,但 DO 长时间空闲被回收后房间会清空。正式版加 `state.storage` 持久化 + WebSocket hibernation。
- 座位数固定 8;正式版由开房参数决定。
- 客户端是调试用的裸 UI,不是正式吕布界面。
