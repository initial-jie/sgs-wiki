# SGS-Wiki 线下房间 · 交接文档

> 给新对话接续用。新会话可直接让我 **读 `docs/room-protocol.md` + 本文件 + `prototype/`**,并跑 `node prototype/room-sim.mjs`(应 226 passed)+ `node prototype/deck-test.mjs`(应 26 passed)确认基线,即可继续。

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
- 决策已拍板:状态权威=**方案 a**(DO 存纯数据+过滤,reducer 在前端);房间码=**4 位**;接入顺序=**吕布 ✅ → 南华 ✅ → A档6工具 ✅(荀攸/黄月英/曹操/袁姬/钟琰/司马懿)→ 董昭 ✅ + 神孙权 ✅ → 貂蝉(下一个,唯一剩的花名册)→ 魔孙权(`sunquan.html`,最后)**。
- ⚠️ **分类修正**:早期把"董昭/神孙权/貂蝉"笼统归为"B档花名册3工具",实测**神孙权无花名册也无保密**——它是"驭衡帝力追踪器",纯公开生成器(同钟琰/司马懿,随机在客户端、解析结果进 DO)。真正需绑座位环的花名册工具只剩 **貂蝉 + 魔孙权**(见第八节)。
- ⚠️ **命名澄清**:**魔孙权 = `tools/sunquan.html`**("魔孙权面杀追踪器",Set+暗选+强座位,唯一硬骨头,排最后);`tools/shensunquan.html` 是"神孙权",属 B档普通直通。
- **真机已上线**:worker 内联 room.html,根路径 `/` 直出客户端页,服务端地址自动同源 wss(零配置)。用户 Cloudflare 账号已注册,子域名 `dujie1995.workers.dev`,地址 `https://sgs-room.dujie1995.workers.dev`。改代码后需用户重跑 `npx wrangler deploy`。

## 五、当前代码 `prototype/`

```
prototype/
├─ shared/room-logic.mjs   核心权威逻辑(RoomCore + 可见性 + 11 工具状态机),sim 与 worker 共用
├─ shared/deck.mjs         牌堆数据 + 登记牌合法性校验(花色级软规则;EXACT_CARDS 待补)
├─ room-sim.mjs            可执行规格:11 工具全流程 226 条 node 断言
├─ deck-test.mjs           牌堆校验 19 条断言
├─ worker/src/index.js     Cloudflare Worker + RoomDO(WebSocket/广播/路由),通用不含业务
├─ worker/wrangler.toml    DO 绑定(SQLite-backed,免费计划可用)
├─ client/room.html        ★ 正式房间前端(多工具聚焦框架 + 11 工具,宣纸风,内联 deck 校验)
├─ client/index.html       早期裸调试页(协议已升级,仅留参考)
└─ README.md               本地怎么跑(含 Windows、2.5 节 room.html 剧本)
```
基线:`node prototype/room-sim.mjs` → **226 passed**(吕布40 + 南华24 + 荀攸15 + 黄月英15 + 曹操8 + 袁姬16 + 钟琰10 + 司马懿19 + 董昭26 + 神孙权22 + 貂蝉31);`node prototype/deck-test.mjs` → **26 passed**(含 STRICT 精确校验);
client 前端可用 node+vm DOM 桩冒烟测 view/bind(见提交历史,10 分支无抛错);
room.html 内联 JS 可用 `new Function` 语法自检。
端到端可跑真机逻辑:`cd prototype/worker && npx wrangler dev --local`,再用 node WebSocket 客户端驱动(南华 e2e 脚本见提交历史 73ca74d 的验证过程,10/10)。

**A档6工具接入范式(已固化,给 B/C 档复用)**:
- **直通(无保密)** = 荀攸/黄月英/曹操/钟琰/司马懿:room-logic 只加 `initToolState` 分支 + 一个 `if(target.general==="x"){…}` 派发块(操作权判定 `bySeat===本座位 && iHold`),**不写 VISIBILITY**;client 加 `GENERALS/hasTool/TOOLS/武将下拉` 四处注册 + `viewXxx/bindXxx`;sim 补断言。
- **生成器(曹操/钟琰/司马懿骤袭)**:随机在**客户端**跑(公开结果无"对操作者保密"需求),只把**解析好的结果对象**进 DO(仿南华 writeBook,DO 不校验牌表);技能池/候选是客户端本机配置。
- **半私密(袁姬)**:复用 `ownerSeatOnly` —— 镜花/水月**牌名仅本人可见、张数公开**;log 只记张数不记牌名。决策流(prompt)留客户端瞬态。
- **⚠️ 坑**:`toolAction.type` 是 action 类型,业务字段**别再用 `type`**(司马懿诡伏记录踩过:改用 `recType`)。

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
- 自带花名册需绑定房间座位:貂蝉 ✅/董昭 ✅/孙权(魔孙权)/吕布 ✅。(神孙权**不在**此列——无花名册)
- **魔孙权是唯一硬骨头**(Set 非纯 JSON + 私密暗选 + 强座位模型),排最后。

## 九、待办(见任务列表)

| # | 事项 | 状态 / 触发 |
|---|---|---|
| #1 | 军争**完整牌表**填 `EXACT_CARDS`、开 `STRICT` → 精确校验 | ✅ 用户提供 161 张军争清单。deck.mjs 建 `CARD_INDEX`(花色→点数→牌名)+ 反推 `EXACT_CARDS` + `STRICT=true`;`deck-test` 26 passed。**吕布登记已改点选**:选完花色+点数直接点牌名(`cardsAt`),留「其他…」逃生口给扩展/EX 牌。room.html 内联一份 CARD_INDEX,已校验与 deck.mjs 52 格全一致 |
| #4 | **真机部署** | ✅ 已上线 `https://sgs-room.dujie1995.workers.dev`,吕布真机联调通过(广播/暗牌保密/夺炁私密)。改代码后需用户重跑 `wrangler deploy` |
| #5 | **多工具聚焦框架** | ✅ 大厅列"登场工具"→ 点座位进入整屏工具 → 返回大厅 |
| — | **南华老仙** | ✅ 逻辑+UI 全绿,e2e 10/10。**待用户真机测**(改了代码,需先 deploy) |
| — | **B档·董昭** | ✅ 谋董昭接房间(半私密):先略牌名暗置(`ownerSeatOnly`)、顺机座位限次绑房间座位环、造王/移势公开。**待用户真机测**(需先 deploy)|
| — | **B档·神孙权** | ✅ 神孙权接房间(**纯公开生成器,非花名册**):驭衡随机在客户端跑→解析技能进 DO、帝力觉醒结算(失技换圣质/权道/持纲+临时固化)在 DO、持纲阴阳翻面、觉醒可回滚(DO 存 `preAwaken` 快照)。无 VISIBILITY。room-sim 195 passed、view/bind 冒烟通过。**待用户真机测**(需先 deploy)|
| — | **B档·貂蝉** | ✅ 魔貂蝉接房间(**全公开台账 + 花名册绑座位**,无保密):花名册=房间座位(名字派生 general,`dead[]` 叠加追踪阵亡);幻惑多步向导随机**下沉 DO**(报数公开、rng 可测);倾世入魔→分发表单(客户端瞬态)→一次性 `qsDistribute` 进 DO→台账 used/got/left/hand 结算。无 VISIBILITY。room-sim 226 passed、view/bind 冒烟 9 分支通过。**待用户真机测**(需先 deploy)|
| — | **A档6工具** | ✅ 荀攸/黄月英/曹操/袁姬/钟琰/司马懿 全部接房间,client JS 语法通过。真机测已修:①荀攸4×3表格对齐(`.pick`的`flex:0 0 auto`盖过`.grow`→改内联`flex:1 1 0`);②袁姬记录牌改「花色+点数→点选牌名」(复用 cardsAt,同吕布);③切武将工具没变(worker 静默吞 setGeneral 错误→已回传 error;RoomCore 座位号统一 `Number()` 防 holds 不匹配)|

**已知原型限制**(正式化时处理):DO 纯内存态(未加 storage 持久化 + WebSocket hibernation);座位数固定 8。生成器类工具(曹操/钟琰/司马懿)的技能池/自定义配置是**客户端本机**态,刷新即回默认(游戏无关,可接受)。

## 十、下一步

1. **真机测 A档6工具 + 南华**(眼下):用户 `npx wrangler deploy` 后多手机测。重点验:①荀攸/黄月英/曹操/钟琰纯公开台账多设备同步;②袁姬镜花/水月旁人只见张数、牌名仅本人可见、节言状态公开;③司马懿诡伏满3入魔→骤袭三选一→持有技公开;④各工具"操作权归本座位、他人只读"、聚焦/返回大厅顺畅。
2. **牌表**(并行不阻塞):用户拿到完整牌表 → 填 `EXACT_CARDS` 开精确校验(#1)。
3. **接剩余工具**:董昭 ✅ + 神孙权 ✅ + 貂蝉 ✅ 已完成 → 只剩 **魔孙权 `sunquan.html`(下一个,收尾硬骨头)**——Set 非纯 JSON + 私密暗选 + 强座位模型,复用 `ownerOnly`(暗选将复用南华"每册自带 owners + revealed"原语)。之后做**前端 wiki 页的"房间"大 section**(放线下工具上方,用户已授权改前端 repo 并 push+merge main)。

**董昭接入范式(半私密,已固化)**:先略记录的锦囊牌名 = **暗置**(`rec: ownerSeatOnly`,他人只见 `{count:0|1}`=有无记录、拿不到牌名;log 只记"记录了一张"不记牌名 —— 仿袁姬"不弱于现状")。顺机的自带座位限次(原 `seatN`+`seats{}`)**改绑房间座位号**(`shunji:[座位号]`,`sjToggle{seatNo}` 校验 `this.seats[sn]` 存在)—— 这就是"花名册绑座位"的最小范式,神孙权/貂蝉复用。顺机牌名账本/造王/移势全公开。`toolAction.type` 全集:`xlRecord{name}`/`xlTrigger`/`xlNewTurn`/`zwSet{on}`/`sjToggle{seatNo}`/`sjEndRound`/`nameAdd{name}`/`nameRm{index}`/`yishiSet{suit}`/`yishiClear`/`resetGame`。
