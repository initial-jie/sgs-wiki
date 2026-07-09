# SGS-Wiki 线下房间 · 交接文档

> 给新对话接续用。新会话可直接让我 **读 `docs/room-protocol.md` + 本文件 + `prototype/`**,并跑 `node prototype/room-sim.mjs`(应 64 passed)确认基线,即可继续。

## 一、项目背景

- **sgs-wiki**:三国杀线下速查 Wiki + 12 个武将线下化工具,纯静态 HTML,GitHub Pages 托管。仓库 `github.com/initial-jie/sgs-wiki`,本地 `/Users/bytedance/sgs-wiki`。已上线 v1.1。
- **在做的新功能**:**线下多人房间**——当牌桌上出现需要我们线下工具的武将时,玩家在各自手机上协作(登记暗牌、看台账、操作技能),零常驻后端、保密不弱于现状。
- **环境约束**:Claude 无外网。真实 WebSocket/部署要**用户本地**跑(`wrangler dev` / `deploy`);协议逻辑我用 node 模拟双端验证。

## 二、产品形态(已定)

- **房间 = 座位环 + 每座位一个武将 + 每武将挂对应工具**。
- 任意玩家开房,其他人加入、**选座、编辑自己座位的武将**;没有"主机玩家"特殊角色。
- **操作权归座位本人**,**查看权归其他人**(点头像看),受**保密规则**约束。
- **fallback**:座位与设备解耦,一个设备可认领多个座位 → 替没电的人代持;"传手机"是"单设备认领多座位"的自然退化。

## 三、六条地基原则

1. **DO 是唯一权威**(single source of truth),手机都是客户端;开房者不特殊。
2. **房间座位是唯一真相**,工具内花名册绑定座位号。
3. **保密在 DO 端按请求者身份过滤后才下发**,绝不"发全量到前端再隐藏"。
4. **座位 ≠ 设备**(解耦),支撑 fallback 代持。
5. **工具业务逻辑不动**,外面套"连房间壳"。
6. **DO 只管数据 + 可见性过滤 + 广播**;例外:需读取"对操作者保密数据"的结算(夺炁随机等)下沉 DO。

## 四、技术栈

- **Cloudflare Workers + Durable Objects**:一个房间 = 一个 DO 实例(按 4 位房间码 `idFromName` 路由),单点权威、内存态、持所有 WebSocket 并广播。DO 空闲无连接会被平台自动回收 ≈ 房间销毁(对刷新友好)。
- **前端**:静态 HTML(GitHub Pages,`https`),连 `wss://...workers.dev`。注意 https 页必须用 `wss`(本地 dev 才用 `ws://localhost`)。
- 决策已拍板:状态权威=**方案 a**(DO 存纯数据+过滤,reducer 在前端);房间码=**4 位**;接入顺序=**吕布 ✅ → 南华 ✅ → 其余(除魔孙权)→ 魔孙权**。
- **真机已上线**:worker 内联 room.html,根路径 `/` 直出客户端页,服务端地址自动同源 wss(零配置)。用户 Cloudflare 账号已注册,子域名 `dujie1995.workers.dev`,地址 `https://sgs-room.dujie1995.workers.dev`。改代码后需用户重跑 `npx wrangler deploy`。

## 五、当前代码 `prototype/`

```
prototype/
├─ shared/room-logic.mjs   核心权威逻辑(RoomCore + 可见性 + 吕布状态机),sim 与 worker 共用
├─ shared/deck.mjs         牌堆数据 + 登记牌合法性校验(花色级软规则;EXACT_CARDS 待补)
├─ room-sim.mjs            可执行规格:吕布全流程 40 条 node 断言
├─ deck-test.mjs           牌堆校验 19 条断言
├─ worker/src/index.js     Cloudflare Worker + RoomDO(WebSocket/广播/路由),通用不含业务
├─ worker/wrangler.toml    DO 绑定(SQLite-backed,免费计划可用)
├─ client/room.html        ★ 正式房间前端(多工具聚焦框架 + 吕布 + 南华,宣纸风,内联 deck 校验)
├─ client/index.html       早期裸调试页(协议已升级,仅留参考)
└─ README.md               本地怎么跑(含 Windows、2.5 节 room.html 剧本)
```
基线:`node prototype/room-sim.mjs` → 64 passed(吕布40 + 南华24);`node prototype/deck-test.mjs` → 19 passed;
room.html 内联 JS 可用 `new Function` 语法自检。
端到端可跑真机逻辑:`cd prototype/worker && npx wrangler dev --local`,再用 node WebSocket 客户端驱动(南华 e2e 脚本见提交历史 73ca74d 的验证过程,10/10)。

## 六、协议要点

**可见性原语**(每个 general 声明字段级 spec,DO 通用过滤):
- `public`(默认) / `secretHolding`(明细仅本人+代持可见、数量全场公开、系统内部全可读) / `ownerSeatOnly`(仅本座位可见明细,他人见数量) / `ownerOnly` ✅(**南华用**:字段是"每册自带 `owners` 名单 + `revealed`"的数组;发动 `revealed=true` 后全场公开,旁人只见占位可数册数。孙权暗选将复用)。

**消息**(WebSocket):
- 上行:`hello{deviceId}` / `claimSeat` / `releaseSeat` / `setGeneral{seatNo,generalId}` / `action{targetSeat,bySeat,toolAction}`。房间由 4 位码惰性创建,首连即开房。
- 下行:`roomState{seats:[按本设备过滤],youHold}`(每设备内容不同) / `actionResult{card}`(私密结果只回操作者) / `error{code}`。

**南华 `toolAction.type` 全集**(在 `room-logic.mjs`):
`writeBook{book:{timing,effect},replaceIndex?}`(南华写,满栏须指定替换的自留册下标) · `setCap{cap}`(2↔3,濒死升3册) · `giveBook{index,toSeat}`(授术,仅未动用 uses=2 可授,他人限持一册) · `useBook{index}`(发动:`revealed=true` 全场公开 + uses−1,用尽移除;操作权=持有座位本人) · `resetGame`。**随机抽牌在客户端跑**(南华写给自己/他人,无"对操作者保密"需求),只有成册 `writeBook` 进 DO。

**吕布 `toolAction.type` 全集**(在 `room-logic.mjs`):
`registerQi`(任意座位登记自己初始炁,含吕布) · `finishReg` · `duoqi{fromSeat}`(吕布主动夺,DO 随机,本回合同座位只一次) · `newTurn`(重置夺炁锁) · `enterMo{kuangTarget}` · `defeatKuang`(吕布击败狂角色,转移其全部剩余炁) · `repickKuang{kuangTarget}`(狂角色死后重新指定,入魔保持) · `kuangDiedByOther`(狂角色被非吕布杀,不转移) · `lvbuKilled{killerSeat}`(交出**初始**炁,不含夺来的) · `toggleDmg` · `endRound` · `resetGame`(重置工具保留武将,前端已不用、靠"新开房间"代替)。

## 七、反复打磨定下的关键设计(容易踩坑,务必保留)

1. **夺炁 = 吕布主动触发**(不是被夺者操作,避免人多操作乱);**被夺者零操作但知情**——被划走的牌在其自己 `qiRegister.mine` 里标 `taken`,他一看界面就知道交哪张。随机在 DO 端。
2. **吕布的炁分两类**:初始炁(`qiRegister[吕布座位]`)与夺来的炁(`gained`)。**被击杀只交初始炁,夺来的不交**。
3. **狂角色死亡→立即重新指定**(`repickKuang`),入魔状态保持,**不是重新入魔**。
4. **重开一局 = 全体、独立**:每个玩家都有「新开房间」→ 换新 4 位码;下一局与上局无关(有没有吕布都行)。不做"保留座位的重置"。房间销毁靠 DO 自动回收。
5. **改武将随时可改**:座位武将下拉含"其他武将,手动输入"(无工具的武将也能桌上显示名);改已有数据的座位会二次确认。
6. **保密必须 DO 端过滤**,不能前端隐藏(抓包即作弊)。

## 八、12 工具接房间可行性(体检结论)

- 11/12 状态纯 JSON 可序列化,无函数/DOM 混入。
- 保密逻辑只集中在 **吕布(暗牌)、孙权(暗选)、南华(未发动天书)** 三个;其余 9 个是"公开台账"直通。
- 自带花名册需绑定房间座位:貂蝉/董昭/孙权/吕布。
- **魔孙权是唯一硬骨头**(Set 非纯 JSON + 私密暗选 + 强座位模型),排最后。

## 九、待办(见任务列表)

| # | 事项 | 状态 / 触发 |
|---|---|---|
| #1 | 找 OL 军争**完整牌表**(花色+点数+牌名)填 `EXACT_CARDS`、开 `STRICT` → 精确校验 | 用户找表后我录入。已录:方片5·木牛流马 |
| #4 | **真机部署** | ✅ 已上线 `https://sgs-room.dujie1995.workers.dev`,吕布真机联调通过(广播/暗牌保密/夺炁私密)。改代码后需用户重跑 `wrangler deploy` |
| #5 | **多工具聚焦框架** | ✅ 大厅列"登场工具"→ 点座位进入整屏工具 → 返回大厅;补上"看别人工具"入口 |
| — | **南华老仙** | ✅ 逻辑+UI 全绿,e2e 10/10。**待用户真机测**(改了代码,需先 deploy) |

**已知原型限制**(正式化时处理):DO 纯内存态(未加 storage 持久化 + WebSocket hibernation);座位数固定 8。

## 十、下一步

1. **南华真机测**(眼下):用户 `npx wrangler deploy` 后,多手机测:南华写书旁人只见"持有N册"、授术后仅老仙+受术者见内容、发动后全场公开、聚焦/返回大厅顺畅。
2. **牌表**(并行不阻塞):用户拿到完整牌表 → 填 `EXACT_CARDS` 开精确校验(#1)。
3. **接下一个工具**:按顺序做**其余公开台账工具**(除魔孙权),多为"直通"型,套聚焦框架即可;魔孙权(Set 非纯 JSON + 私密暗选)排最后,复用 `ownerOnly`。
