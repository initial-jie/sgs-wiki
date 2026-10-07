# SGS-Wiki 线下房间 · 交接文档

> 给新对话接续用。新会话可直接让我 **读 `docs/room-protocol.md` + 本文件 + `prototype/`**,并跑 `node prototype/sgs/room-sim.mjs`(应 **713 passed**)+ `node prototype/sgs/deck-test.mjs`(应 26 passed)+ `node prototype/fengsheng/fs-sim.mjs`(应 72 passed)确认基线,即可继续。

## ⭐⭐ 2026-09-24:多游戏架构 + 风声(游卡典藏版)房间 v1 —— 新会话先读这段,再读下面三国杀状态

**基线**:`node prototype/sgs/room-sim.mjs` → **589** · `node prototype/sgs/deck-test.mjs` → **26** · `node prototype/fengsheng/fs-sim.mjs` → **72**。

**目录重排(`git mv` 保历史)**:
- `prototype/common/` 公共房间库(游戏无关):`room-base.mjs`(RoomBase:座位认领/独占/替换/释放/改名/增删座位/序列化)· `visibility.mjs`(保密原语 applyVisibility,新增 `seatKeyed`)· `room-do.mjs`(RoomDOBase:WebSocket/持久化/2h TTL/解散/广播;游戏只写 `createCore/hydrateCore/onGameMessage`)· `client/room-client.js`(浏览器 RoomClient:设备 ID/断线重连/写阻断/改名/toast/加入表单,worker 在 `/common/room-client.js` 下发,wrangler.toml 有 Text 规则)。
- `prototype/sgs/` = 原三国杀全部(shared/ client/ worker.mjs + 各脚本)。`RoomCore extends RoomBase`,行为不变。**房间页不再支持 file:// 直开**(要 worker 下发公共 JS),本地一律 `wrangler dev`。
- `prototype/fengsheng/` = 风声。`prototype/worker/src/index.js` 只做路由。
- 新游戏 = 新目录 + `XxxCore extends RoomBase` + `XxxRoomDO extends RoomDOBase` + 页面引 `/common/room-client.js` + 路由 + wrangler DO 绑定/迁移。

**风声 v1(用户选「线下辅助」形态:桌上用实体牌,手机管秘密与台账)**,入口 `/fs`(三国杀连接页底部有互链),WebSocket `/api/fs/<码>/ws`,DO `FsRoomDO`(绑定 `FS_ROOM`,**迁移 v2**):
- 开局:卡池(基础包/全部)→ 随机发角色 2 选 1(候选仅本人可见;也可用实体牌后手动登记)→ 系统发身份(配比可改,神秘人随机抽任务)或各自手动登记 → 选先手开局。
- 保密:身份仅本人可见,**只在本局结束时公开(阵亡不公开,2026-09-30 用户实战勘误)**;隐藏角色面朝下时他人只见「隐藏角色」;「可宣胜」提示只看自己的情报+身份,不泄露队友;日志不写秘密。
- 台账(全公开,任何人可改):情报区 红/蓝/黑/红黑/蓝黑(双色同时计两色),黑≥3 自动濒死,澄清=移除情报可脱离;确认死亡=**身份不公开**,死者至多 3 张手牌交给一名其他角色(可选记录 giveTo,公开)、其余手牌与情报区进弃牌堆(App 清空情报区,备份 deathIntel 供撤销死亡还原);当前回合/下一回合(跳过死者)。
- 胜负:宣胜由服务端校验(阵营=任一队友集齐 3 张本色;神秘人按任务:双面间谍/镇压者/篡夺者自动判,篡夺者在其回合强制代替胜利);手动结算兜底;再来一局保留座位。
- 数据 `fengsheng/shared/fs-data.mjs`:49 角色 + 13 功能牌 + 7 神秘人任务,抽自开源典藏版复刻客户端 Death-alter/TheMessage(AGPL,只取文本不取代码)。**⚠ 基础包名单是推断的**(id 1~30 去掉铁屋子的连鸢/端木静 = 28 人,官方基础包应为 30 人)→ **待用户对照实体盒子核对**;功能牌 平衡/欲擒故纵 归属也待核对。牌堆构成网上查不到(线下辅助形态用不到)。
- **v1.1 三国杀同款交互(用户确认角色名单无误后提的)**:座位框上直接 认领/释放/替换/查看技能;自己座位「选角色 ▾」→ 搜索弹层(中文/拼音/首字母,排名逻辑已抽进公共库 `RoomClient.searchRank/searchList`,三国杀选将同用)→「查看技能」预览 → 选定。**隐藏角色选定时二选一:暗置(默认,面朝下仅本人可见)/ 公开**;之后「发动技能 · 翻开」/「翻回暗置」。别人已**公开**选用的角色不能重复选(`CHAR_TAKEN`;面朝下的不拦,否则泄露)。发过 2 选 1 时弹层只列候选。拼音 `fengsheng/build-pinyin.mjs` → `shared/char-pinyin.json`(改名/新增角色后重跑)。
- 风声数据 `/fs/data.json?v=<内容哈希>`:worker 启动时算哈希注入页面,deploy 后立即生效(风声不再有三国杀那个 1h 旧缓存坑;三国杀的 JSON 路由仍是旧方式)。
- ⚠ **须 `cd prototype/worker && npx wrangler deploy`**(本批含新 DO 迁移 v2)。

## ⭐ 最新状态(2026-09-22,graduate + 3 新将 + 谋程昱工具 + 神典韦池扩到 33,全部 push 到 main)—— 新会话先读这段

**基线**:`node prototype/sgs/room-sim.mjs` → **713 passed**;`node prototype/sgs/deck-test.mjs` → **26 passed**。

**规模**:武将库 **709 将**(692 OL = 官网花名册全量 + 17 手录/线下,含《不臣之君》3 模式将)· 房间工具 **24 个** · 装备库 **58 张** · 选将支持拼音。

**24 个工具**:魔吕布 / 南华老仙 / 族荀攸 / 谋黄月英 / 魔曹操 / 袁姬 / 钟琰 / 魔司马懿 / 谋董昭 / 神孙权 / 魔貂蝉 / 魔孙权 / 神典韦 / 李傕 / 徐荣 / SP徐氏 / 郭照 / 裴秀 / 蒲元 / 曹婴(伏间随机目标) / 族王明山(剩墨台账+弹雀点数) / 贾充(凶竖秘密猜测,保密) / 族陆郁生(拾昔四花色台账) / 谋程昱(胆持跨座位秘密选类型,保密)。

**房间级功能(已上线代码)**:
- 全场状态面板:血量/翻面/连环/阵亡(横置已并入连环);残血起手将按 initialHp 播种
- 动态座位 2–10;环形距离(阵亡跳过、坐骑非对称、✓可杀);每座位详情浮窗(5 装备槽+判定区+废除+君主+1)
- 装备库 58 张:全局去重(名|花色|点数);支持无花色虚拟牌(神黄忠赤血刃);神典韦可装源生武器
- 查将:衍生技/衍生牌、彩色技能标签、中英切换、**技能修正⚠提示**(仅"房间≠实体卡"时标,一律以房间为准,现 3 将:曹婴/鲍三娘/界郭皇后)、**同名可替换提示**(剥 神/界/谋/魔/SP/梦 前缀,神版独立)
- **禁将四池**:按座位数自动选池(≥5 军争 / 4 2v2 / 3 斗地主 / 2 1v1),军争池 15 将、其余空;房内共享**总开关**
- 房内改名(原子改键);神将自选势力含**晋**;**选将拼音/首字母搜索**
- **线上发将(2026-10-02,代替线下手抽武将)**:座位卡顶部「🎴 线上发将」→ 选模式(身份局/暴虐无道/失心疯/大忠似奸)+ 君主座位(可无)。只发给**已入座**的座位;每人 6 个「坑」(仅本人可见),起手坑各可换一次(原坑回池、重抽不与自己起手 6 坑重复的,换来的不可再换);君主位另得 6 个带主公技的坑(模式专属君主必出且排第一,不可换)。君主先选、选定即亮出落座且不可改;其余人随后暗选(亮出前可改),全员选完任何人点「亮出」→ 全部落座,发将结束;任何人可中止。
  - **坑 = 同名可替换组**(`shared/deal.mjs` groupKey:剥 界/谋/魔/SP/梦/**族/闪/标**/教主/暴君/昏君 前缀,前面可再带「移动版」(移动版谋韩当=韩当,2026-10-02);神版独立。族/闪/标 是 2026-10-02 用户实测报 bug 后补的——(标)界谋族闪SP 同名都算同一位武将;room.html `heroBaseName` 必须同步)。坑里只要有一个「白名单勾选且当前可用」的版本就整坑入池,同名其它版本也可选;**被禁版本剔除**(当前座位数的禁将池,房内禁将开关关着则不禁)。全场一坑一人。
  - **特殊规则**(deal.mjs 顶部常量):曹丕只进君主池(LORD_ONLY);董昭 355 只在身份局可选(IDENTITY_ONLY,其它模式该坑只剩谋董昭);genre=不臣之君 的专属君主只在对应模式作必出坑。
  - **实现**:组池纯函数 `buildDealPools`(deal.mjs)→ `RoomCore.dealStart/dealSwap/dealPick/dealReveal/dealCancel`(room-logic.mjs,`this.deal` 进 serialize);保密在 `_dealView`(自己座位给全量,别人只给坑数/是否已选,剩余池只给数量)。worker `dealStart` 是 async:先从 `SgsConfigDO` 读白名单,所以 `RoomDOBase.onMessage` 改成 `await this.onGameMessage(...)`。客户端 `viewDealRow/openDealSetup/openDeal/renderDeal`(room.html;入口与状态都在座位卡里)。
  - **✅ 分环境名单 + 黑名单上服务端(2026-10-02)**:`SgsConfigDO` 存储改为 `{pools:{junzheng|2v2|douzhu|1v1:{white,ban}}, seen, updatedAt}`(旧格式 `{ids}` 读取时自动迁移:ids→军争白名单,黑名单取 banned-generals.json 种子)。`/pool` 页顶部切环境 + 「白名单/黑名单」页签;非军争环境白名单留空=沿用军争(页面有「复制军争白名单」按钮)。**禁将从此在 /pool 页维护,保存即生效**:
    `RoomDO.syncConfig`(20 秒节流,每条消息前跑)把黑名单灌进 RoomCore 的 BANNED_POOLS 并设 `core.cfgRev`;`/banned-generals.json` 改为现读配置(no-store);客户端见 `roomState.cfgRev` 变了就重拉禁将面板。
    发将:环境=发将设置里手选的「将池」或按座位数自动(`banPoolForSeats`),白名单取该环境(空则军争),黑名单取该环境自己的。`banned-generals.json` 现在只提供四个环境的 label/seats 与黑名单种子。接口:`PUT /api/pool {pools:{key:{white,ban}}, seen}`(只带部分环境则其余不变;旧的 `{ids}` 仍兼容)。⚠ 浏览器双设备测试:设备名现在在公共库里,用 `RC.deviceId='xx'` 再 connect(直接改 `deviceId` 变量无效,两个标签页会被当成同一台)。
- **将池(发将白名单)编辑页 `/pool`**(2026-10-01,发将功能的地基):全部武将按「包」分组(`shared/hero-packs.json`,olwiki 各武将页「将灯」全量爬取 772 页;worker 贴成 generals.json 的 `pack` 字段,缺则回退 genre),点武将入池/出池,包级与大类级全选/清空(只作用于当前可见项,配合搜索/筛选),拼音搜索,已选/未选/新录入筛选。**保存直接写服务端**:新 DO `SgsConfigDO`(单例 `idFromName("global")`,绑定 `SGS_CONFIG`,迁移 v3;不继承 RoomDOBase,无 TTL),接口 `GET/PUT /api/pool` → `{ids,seen,updatedAt}`;**无鉴权(用户定)**,改完不用 deploy。`seen`=上次保存时的全量 id,之后新录的武将在编辑页标「新」。`shared/hero-pool-seed.json` 是服务端没存过时的回退 + 仓库备份(页面「导出」→ 覆盖该文件)。**与禁将表互不影响**:禁将=池内但当前环境不让用的强将;没进池的将不出现在禁将面板。大厅「房间设置」有入口链接。⚠ 新录武将后在 hero-packs.json 补一行包名(否则落到 genre 组)。**下一步=发将功能**(每人私密 6 将、每张可换一次、君主位额外 6 张主公技将、选模式则专属君主必进候选、选定自动落座;需求已与用户对齐,见记忆 product-ideas 末节)。
- **规则集**(2026-09-25):大厅禁将池下方目录卡,数据 `shared/rules.json` [{id,title,sub,html}];worker `/rules.json`(目录)+`/rules/{id}.html`(自包含整页,弹层 iframe 加载)。现 5 条:暴虐无道/失心疯/大忠似奸(官方)+大忠似奸·变种规则(房规)+无间道。**加规则=往 rules.json 追加一条+deploy**;武将衍生技里只留一行指引,正文只在规则集维护。**2026-10-01:「登场工具」卡已撤,工具入口直接放座位卡标题行(`工具 →`,所有人可见,本人为主色)**;大厅顺序 座位→全场状态→禁将池→规则集→房间设置。窄屏下 `.seat .st{min-width:max-content}` 让按钮整体换行而不是挤折武将名标签

**⚠ 部署**:worker 相关改动由用户自己 `cd prototype/worker && npx wrangler deploy`。贾充/族陆郁生/拼音搜索已 deploy(用户 2026-09-15 确认);**graduate + 3 新将 + 谋程昱工具 + 神典韦池这批(generals.json/hero-pinyin/禁将池/room-logic/room.html)待 deploy**;wiki 侧 tools/dianwei.html 已随 push 上 Pages。wiki 侧 `git push` 即 Pages 自动部署。

**进行中/悬而未决(下次可接)**:
1. **私密手牌助手**(方案已提,用户未拍板):曹金玉「夏晟」私密红黑计数器(只公开"红多/黑多")、董予安「和煦」非伤害牌类别清单(算手牌上限+N);两张争议牌 借刀杀人(倾向非伤害)/闪电(倾向伤害)分类待用户定。
2. **曹金玉「秋暮」改写工具**:规则已确认(一次改写=该技能描述里的"红色"全部替换;改写秋暮自身会自锁),未做。现只有衍生技文本。
3. **graduate 已完成(2026-09-15)**:8 个手录将换成官网真 id —— 9003→606裴秀(tool peixiu 跟过去、禁将池同步改 606)、9002→663谋贾诩、9010→765谋祝融(技能名订正为「刃掣」)、9011→230神黄忠、9012→740曹金玉、9013→775界步练师、9014→683刘璋、9015→755董予安。数据全以官方为准(差异仅定位标签、刘璋/董予安 genre=其他)。room.html `GRADUATED` 双向别名兜底旧房间/旧缓存。**剩余手录 9 个**:9001孙寒华(**线下版**,归「线下」包;olwiki 774 是 OL 自己的孙寒华,将来要录成另一条,不是 graduate)/9004SP徐氏/9005留赞/9006移动版谋韩当/9007司马炎/9008神黄月英/9016神貂蝉/9017梦貂蝉(均纯线下/移动版,不 graduate)+ **9009界关平**(olwiki 766)+ **9018界钟会**(olwiki 758)+ **2026-09-30 四将**:9022谋周瑜→770 / 9023谢灵毓→769 / 9024逢纪→679 / 9025族荀灌→748(用户报 OL 新上,官网仍未收录)——**6 个 graduate 候选**,官网收录后 `--ids …` + 删 OFFLINE_HEROES 条目。谢灵毓「元嫡」olwiki 原文 `{0}` 占位已由用户对卡订正为【杀】【闪】【桃】(无【酒】)。逢纪读 Páng Jì(姓氏音,游戏内亦然),`build-pinyin.mjs` 加了 `FIX` 覆盖表(逢纪/郭图逢纪),以后拼音库读错的姓往这里加。**手录将的 cardWarn 要直接写在 OFFLINE_HEROES 条目里**(SKILL_OVERRIDES 在追加手录将之前处理,贴不上)。
   - **已录官网 3 新将**:744唐棠(群/3/史诗)、763段煨(群/4/史诗,讨怀)、734谋程昱(魏/3/传说)。库与官网花名册 692 将**完全对齐**。
   - scraper 修:转换技官网用 `###` 拼三份(原文/阳高亮/阴高亮),`cleanSkill` 只取第一份;顺带修好老将 650武安国「历勇」。
   - ⚠ 全量 re-scrape 仍会把 9009/9018 重复(若官网届时已收录),先 graduate。
   - **olwiki 有、库无的 OL 将(2026-09-22 差集,排除国战/6xxx 娱乐将/老重复 id)共 35 个**,用户买实体卡遇到再按名录:571步度根 659谋田丰 660杨奉 667蔡贞姬 677谋郭嘉 678樊氏 **679逢纪(传说)** 684族荀爽 685韩氏五虎 695桥玄 708界孙鲁班 722郑玄 724族陆康 731闪张郃 733族韩馥 736族陈泰 743皇甫嵩 745界全琮 746界曹节 747界辛宪英 **748族荀灌(传说)** 754皇甫规 757许劭 762族陆昙 767界曹休 768王皑 **769谢灵毓(传说)** **770谋周瑜(限定)** 771族诸葛瞻 772族诸葛果 773族诸葛诞 776界刘封 779界朱然 798界朱桓;另 222神曹丕/223神甄姬(olwiki 标"普通",官网无)。"未标注"品质的多半是预告/未正式上线,录前看 olwiki 单页有无技能。**差集方法**:olwiki 图鉴页 JS 抓 `a[href*=general-game-]` 得 {id,name} → 与 generals.json id 集合 diff(老重复 id 31/32/33/60/102/138 是同名旧条目,库里已有别 id 的版本,忽略)。
4. 禁将池"4人=2v2、3人=斗地主"是按座位数推断的,若打 4 人身份局会套错池(现只有军争池非空暂无影响);管理员页/运行时改禁池暂缓。
5. 已知未修:数据 JSON 路由 `max-age=3600`,deploy 后老浏览器最长约 1 小时才看到新数据(用户说不急)。
6. brainstorm 池:威胁地图(谁能杀到我)、血量事件驱动技能提醒、身份场暗置助手、共享回合/阶段条;实体读牌硬件已搁置。

**谋程昱「胆持」工具(2026-09-15,第 24 个)**:第二个保密工具,也是**第一个"秘密选择权在工具主人以外的座位"**的工具 —— 程昱发动→【受伤角色本人】在自己 UI 秘密选类型(基本/锦囊/装备,锁定不可改)→ 伤害来源使用下一张牌后**由受伤角色本人点公开** → 程昱录入来源所用类型算结果(不同则可额外视为使用【杀】)→ 回合结束点「清空重来」(pending 存在 = 本回合已发动)。
- 新保密原语 `VISIBILITY.mouchengyu.choice = {kind:"pendingTargetOnly"}`:可见者 = `toolState.pending.targetSeat` 的持有者,或 `pending.revealed` 后全场;旁人(**含谋程昱本人**)只见 `{count:0|1}`。**程昱公开前也看不到**是刻意的,防止泄露给伤害来源。要改成"程昱可见"只需在 filterState 该分支加 `|| holds.has(seat.seatNo)`。
- **公开权也在受伤角色本人**(用户 2026-09-15 提的,已采纳):程昱看不到内容,若由他按,误触泄露的是他自己都不知道的信息,且正好泄露给还没出下一张牌的伤害来源;受伤角色本人按至少是知情的。对方不在场时程昱可「清空重来」,不会死锁。
- 跨座位操作沿用魔孙权天恩范式:`dcChoose`/`dcReveal` 的 `bySeat` 都必须是受伤座位(服务端校验持有)+ 全局横幅 `mcyPendingForMe` 两态(未选=「去选择」/已选未公开=「去公开」)。worker 零改。⚠ 客户端 `act(o,by)` 第二参必须传 `p.targetSeat`,漏传=服务端静默拒绝(改公开权时踩过)。
- 734.tool 直写 generals.json + scrape TOOL_NAMES 防重爬丢;room.html 函数名用 `viewMcyTool/bindMcy`(`viewCyTool` 已被曹婴占用)。**房间版 only**(座位概念房间原生,wiki 单人版未做,同曹婴)。

**神典韦挈挟池扩容 + 加权抽取(2026-09-22)**:池 28→**33**(21 特殊+12 白板),新增 神赵云·龙魂(**w=0.5 低概率**)/界陈宫·明策/界太史慈·天义/界夏侯氏·燕语/界刘禅·享乐。`rollQiexie` 改**加权无放回**(条目 `w` 默认 1;rng 恒 0 仍取首个候选,老 sim 断言不变);单人版 `tools/dianwei.html` 同算法 + **老存档迁移**(池存 localStorage,load 时按名补内置新将、老条目补 w)。⚠ **范围 = 武将体力上限**(挈挟原文),新加将必须按库里 hp 填 range(神赵云 2 血→范围 2,我一开始填错成 4);sim 有全池 range=hp 一致性审计的思路可复用(本次用 node 一次性核过)。⚠ 无放回连抽 5 张会压缩权重差:w=0.5 实测出现率≈普通将的 0.59 倍,要更稀有把 w 调到 0.3 左右。两处池 node 逐字校验一致(见 [[tool-logic-dup]] 同类内联)。

**《不臣之心》= OL 2026「不臣之君」身份新玩法的实体版(2026-09-24 录入)**:模式专属将 3 个已进库(9019 教主张角/9020 暴君董卓/9021 昏君刘宏,genre「不臣之君」,立绘沿用同名标准将官方图),各配一张模式规则说明卡在 `derived-skills-room.json`(查将带出):失心疯(教主/护法/官兵+失心,失心身份自己看不见教主可见)、暴虐无道(暴君/诤臣/逆乱/间者,暴君上限+2、杀人回血)、大忠似奸(昏君/奸臣/忠臣/义军,义军互知)。〖执笏〗作昏君刘宏衍生技。**大忠似奸房规「昏君二线」已进规则集(`rules.json` id=dazhong-variant,用户定稿格式:变种规则三条,奸臣首次濒死亮身份)**(2026-09-25 用户设计:奸臣濒死亮身份→昏君得锁定技〖袒佞〗护奸;奸臣阵亡按忠臣/义军人数分 昏庸无道线(昏君胜利条件改同奸臣)/幡然醒悟线(并入忠臣);刘宏一律昏庸无道)。实体规则卡照片(B站开箱)读到:奸臣固定 1 名;失心疯 6/7/8 人=教主1/护法2/官兵2·3·3/内奸1·1·2/失心1~2;暴虐无道 4/5/6 人=暴君1/诤臣1·1·2/间者1/逆乱1·2·2;无间道=8 人龙虎两阵营各有主帅/护卫/对方安插的内鬼,胜利=敌方内鬼死亡,主帅死不结束只令内鬼暴露(无专属将,未做说明卡)。盒内还见 蔡夫人 与另一版董卓(封赏/执柄)两张专属卡待用户核对后录。**数据源=萌娘百科 `三国杀:张角/董卓/刘宏` 页「不臣之君」节**(WebFetch 被 403,要用浏览器面板 JS 抓;体力数勾玉 img 个数)。萌百导航条确认该系列**只有这三将**;「无间道」在 OL 端未查到独立模式页,实体包若有请用户按说明书补。`heroBaseName` 前缀集加了 教主/暴君/昏君 → 与同名标准将互斥。这三将无 OL 独立 id,**不 graduate**(永久 offline)。

## ✅ 发将入口并进座位卡(2026-10-01 做完,纯 room.html;待 deploy)

顶部「线上发将」状态卡已撤(`viewDealBar` 删除),全部并进座位卡:

- 座位卡顶部那一行 = `viewDealRow()`:没在发将是「🎴 线上发将」入口;发将中是控制行「发将中 · 模式 · 将池 · 已选 x/y」+ 全员选完时的「亮出」+「中止」,下面一行提示(等君主先选 / 全员已选定)。
- 参与座位的标题行:君主称谓标(主公/暴君/教主/昏君,排在武将名前)+ 状态标 `… 未选` / `✓ 已选`;已亮出的只显示武将名。
- 自己持有的参与座位:「选武将 ▾」换成「选将 →」(主色)/「已暗选 · 可改」(调 `openDeal`,弹层 `renderDeal` 没动);君主亮出后不再给入口。发将期间参与座位不露手动选武将(防误点),没参与的座位照旧。
- 已验:本地 wrangler 双设备走完 大忠似奸 全流程(君主先选亮出 → 暗选 → 亮出落座 → 入口恢复),对方座位只见状态不见内容;375 宽无横向溢出;room-sim 648。

**上次留的两个口子,用户 2026-10-01 答复:都先不动**(① 手动选武将不拦模式专属君主;② 不加「当前环境」手动切换)。

## ✅ 身份自动发放 + 发将武将锁定 + 新一局(2026-10-01,待 deploy)

**基线**:room-sim **713**。

**发将亮出的武将锁定**:`seat.genLocked`(dealPick 君主 / dealReveal 落座时置 true)→ `setGeneral` 拒 `GENERAL_LOCKED`,座位卡不再给「选武将 ▾」。手动选将的座位不锁、下拉照旧。解锁 = 重新发将(参与座位)/ 发身份时清空武将 / 房间设置「🔄 新一局」(`newGame`:清全场武将+身份+进行中的发将,座位与持有者不动)。

**身份自动发放**(`shared/identity.mjs` 模式表 → `RoomCore.identStart/identShow/identPeek/identShowAll/identClear`,`this.ident` 进 serialize;worker `/ident-modes.json` 把模式表吐给客户端):
- 入口:座位卡顶部「🪪 发身份」→ 选模式 + 各身份张数(按**已入座人数**带默认配比,可手改,张数之和须=人数)+「同时清空上一局武将」(默认勾)。
- 发放:洗牌发给已入座座位 → 亮明君主 → **转座**(`_reseat`):君主变 1 号位,其余人按原环形次序顺延,空座排末尾(6 号抽到主公 → 6变1 7变2 8变3 1变4)。转座搬整个座位对象(持有者/武将/面板/工具状态)并重建 `devices.holds`;不清武将时,工具状态里引用别的座位号的字段**不会**跟着改。发将进行中不能发身份(`DEAL_ACTIVE`)。
- 六个模式:身份局(主公)/ **明忠**(主公暗;随机一名忠臣亮明坐 1 号位,忠臣>1 时称「储君」)/ 暴虐无道(暴君)/ 失心疯(教主;失心不占位,从教主以外随机盖 N 张,全场只见「失心」、本人看不到真身、教主看得到)/ 大忠似奸(昏君;义军互知)/ **无间道**(两主帅亮明、随机其一为 1 号位;龙/虎牌背全场公开;主帅看到对方牌背的全部身份 = 知道己方安插的内鬼)。
- 配比来源:身份局=标准;暴虐无道 4~6 人、失心疯 6~8 人、无间道 8 人=盒内规则卡;**其余人数与大忠似奸整张表是按比例推的**(设置弹层会标「按比例推的」),待用户对规则卡订正 → 改 `identity.mjs` 的 `table`。
- 保密在 `_identView(holds)`:别人座位只给 `pub`(亮明的身份 / 「失心」/ null)+ `camp`;自己持有的座位多给 `mine`{role,knows[],win,canPeek}。sim 有保密断言(别人拿不到 mine、失心本人 JSON 里没有真身)。
- 座位卡:亮明的身份红底标;自己座位「🪪 我的身份」弹层(身份大字 + 胜利条件 +「只有你知道」:义军同伴 / 主帅看到的内鬼 / 教主看到的失心真身 / 明察结果 +「亮明身份」);阵亡座位任何人可点「亮身份」;顶部一行 模式·配比 + 规则/全部亮明/重发/清除。
- **身份技能按所选武将给(2026-10-02)**:RoomCore 自己不带武将库,由 worker/sim 用 `setHeroInfo({generalId:{name,hp,female}})` 灌入(key 同 setGeneral 的 generalId:有工具→工具名,否则 String(id))。
  - **性别表 `shared/hero-gender.json`**(`female:[id…]`,其余按男):olwiki 各武将页 `.gender-attribute strong` 全量抓 772 页(浏览器面板里同源 fetch,curl 被 403)+ 7 个手录/线下女将人工标;worker 贴成 generals.json 的 `gender` 字段。**⚠ 新录女将要往这里加 id**(不加=按男性)。
  - **明忠技能**:明忠选定武将后「我的身份」显示获得的技能——男性且库里 hp ≤ 3 →〖明察〗(带查看按钮,`identPeek` 整局一次),其余 →〖舍身〗;没选将显示「选定武将后显示」。服务端判定,舍身/没选将调 identPeek → `NO_SKILL`。
  - **〖蔽众〗**(失心疯,教主的武将是教主张角才有):`identBizhong`(选一名非失心、未亮明的其他座位 → 变失心,全场可见,本人此后看不到自己的身份)→ `identSwapLost`(任意两名失心互换身份牌,可多次)→ `identBizhongDone`(关闭)。整局一次;教主在「只有你知道」里始终看得到各失心真身。
  - **大忠似奸变种规则提示**:`identity.mjs` dazhong.variant 按身份给几行提示(昏君=袒佞 + 两条分线 + 刘宏例外;其余身份=对自己的影响),「我的身份」里显示 +「看变种规则全文」。
  - **明忠 / 无间道发将不发主公技候选**:`IDENT_MODES[mode].noLord` → `dealStart` 不发君主额外候选(`lordExtra=false`),发将设置里君主座位下拉置灰并说明。**明忠仍有「先选先亮」**(用户 2026-10-02 报 bug 后改):`deal.lordSeat` = 亮明的明忠/储君座位(忽略客户端传的君主座位)、`deal.lordTitle` = 明忠/储君(客户端 `dealLordTitle()` 优先用它),明忠选定即亮出落座,其余人随后暗选、一起亮出。**无间道**:`deal.firstSeats` = 两名主帅(lordSeat=null),各自暗选(可改),**都选定时一起亮出落座**,其余人再暗选、一起亮出。`dealPick` 统一按 firstSeats 判(只有一位时=选定即亮出);客户端 `dealFirsts()`。
- **座位立绘 + OL 皮肤(2026-10-02;手机当武将牌用,实体卡没到也能玩)**:座位卡标题行左侧头像(`.sava`)→ 全屏立绘 `openArt/renderArt`(顶部 名字/势力/体力 +「技能」切换;底部皮肤横条)。座位持有者点皮肤 = `setSkin`(`seat.skin` 公开,全场看到同一张,换将重置);非持有者点 = 仅本机预览。
  - 皮肤表 `shared/hero-skins.json`(698 将 5660 张;`skins:{武将id:[[皮肤id,名,品质]…]}` + `alias` 手录/线下将借用的 olwiki 武将:graduate 候选指向自己的 olwiki id,不臣之君三将指向 张角/董卓/刘宏)→ worker `/hero-skins.json`,**点开立绘才拉**。图 = `…/pc/general/big/static/{皮肤id}.png`(大图 0.3~3MB)/ `skinShop/{皮肤id}.png`(缩略图)。
  - **数据来源**:olwiki 各武将页 `a.general-skin-card`(同名武将各版本共用一组皮肤)。重抓方法:浏览器面板开 olwiki → JS 同源 fetch 772 页 → 结果塞 `window.name` → 导航到本地 `python3` 小接收服务(127.0.0.1)页面再同源 POST 落盘(olwiki 页面直接 fetch 本地会被拦;curl olwiki 403)。新录武将没有皮肤条目时只显示默认立绘。
  - 座位行「查看技能」按钮缩成「技能」(给头像让位)。
- **武将图鉴**(2026-10-05,小伙伴提的;大厅规则集下方,纯 room.html):`viewHeroWiki/renderWikiGrid/bindWiki`。默认收起(展开状态存本机 `sgs_wikiOpen`);两级页签 **系列**(包名「-」前,顺序 `WIKI_FAM_ORDER` 与 /pool 页一致,国战最后)→ **扩展包**(系列内多包时才出第二行,含「系列全部」);「全部」页签 = 全库。搜索框只搜当前页签(`RoomClient.searchList`,中文/拼音/首字母),打字只刷网格不整页 render(输入框不丢焦点)。每将标 **池**(当前环境白名单,空则沿用军争;拉 `/api/pool` no-store,cfgRev 变了重拉)/ **禁**(当前禁将池 `isBanned`,禁优先)/ 无标=未入池;房内禁将开关关着时注明「禁标仅供参考」。点武将 → `previewHero(id,{viewOnly:true})`(只看不选,按钮为「关闭」)。
- 〖舍身〗的结算、明忠 +1 上限 +1 血、暴君 +2 上限等**不自动**,仍在面板手动改。
- **疑似身份标记**:每个未亮明座位一个「疑?」小标,点开选身份。**只存本机 localStorage**(key=房间码+本局 ident.id)→ 每人各标各的、互相看不到,重发身份自动作废;失心本人可以标自己。
- 发将设置弹层:本局发过身份 → 模式与君主座位(1 号位)自动带入(明忠/无间道没有先选的君主,不带)。
- 规则集新增「明忠」(`rules.json` id=mingzhong,用户口述的房规)。
- 已验:sim +36(转座 60 种子、保密、失心 40 种子、无间道 40 种子、明察、锁定、新一局);浏览器双设备走过 大忠似奸(发身份→转座→发将带入→亮出锁定→手动改被拒)、明忠明察、无间道、失心疯全部亮明;375 宽无溢出。
- 顺手修:`maybeSeedPanel` 的 panelSeeded 以前不清,同一座位 A→B→A(或新一局后同座同将)不再播种血量;现在座位换将/清空时忘掉旧记录。

**⚠ Cloudflare 免费额度告警(2026-10-06)→ DO WebSocket 改休眠模式(`common/room-do.mjs`,待 deploy)**:邮件「Durable Objects daily operation limit 90%」超的是 **duration(GB·s)** 不是请求数。原因:原先 `ws.accept()+addEventListener` 是非休眠 WebSocket,只要有一个连接挂着(手机后台留着页面、客户端自动重连)DO 就常驻内存按时长计费;免费额度 13,000 GB·s/天 ≈ 一个 128MB DO 活 29 小时,几间房各挂一台手机就超。现改为 **Hibernation API**:`state.acceptWebSocket(ws)` + `webSocketMessage/webSocketClose/webSocketError` 回调;连接↔deviceId 存 `ws.serializeAttachment({d})`(不能存 this 上,休眠会丢);`sockets()=state.getWebSockets()`;`this.core` 休眠后为 null 由 ensureCore 回灌;没人在线时 onClose 不回灌 core(让 DO 尽快空闲)。三国杀/风声共用同一基类,行为不变(本地双标签验过 认领/改名/广播/断线重连/解散/风声)。⚠ 本地 wrangler dev 里客户端直接关页面会打一行 `Uncaught Error: Network connection lost`——是运行时对异常断开的日志,无害。**deploy 后用量看**:dash.cloudflare.com → Workers & Pages → Durable Objects → 看 Duration 曲线应明显掉下来;若还高,再查 alarm/其它。

**⭐ 新录武将 checklist(2026-10-05 固化;用户要求每次都过一遍——一个武将不只在 generals.json,配套数据散在 6 处)**。跑 `node prototype/sgs/check-hero-data.mjs [--ids 9026,…]` 自动体检(rebake/scrape 跑完也会提醒):
1. **武将本体** `shared/generals.json`:官网有 → `scrape-generals.mjs --ids`;官网没有 → `generals-overrides.mjs` OFFLINE_HEROES(9000+)+ `rebake-overrides.mjs`。有工具的还要 `scrape-generals.mjs` TOOL_NAMES。
2. **拼音** `shared/hero-pinyin.json`:`node prototype/sgs/build-pinyin.mjs`(多音姓氏往 `FIX` 表加)。不跑=只能中文搜到。
3. **扩展包** `shared/hero-packs.json` `packs[id]`:包名照 olwiki 将灯(如 `璀璨星河-天极`)。不加=图鉴/将池页落到 genre 组。
4. **性别** `shared/hero-gender.json`:核过的 id 进 `reviewed`,女将再进 `female`。不加=按男(影响明忠〖明察/舍身〗判定)。
5. **皮肤** `shared/hero-skins.json`:OL 将 → 从 olwiki 武将页抓 `[皮肤id,名,品质]` 进 `skins[id]`(抓法见 memory skin-art);手录将 → `alias[id]`=借用的 olwiki 武将 id;确认没皮肤 → 进 `none`。不加=只显示默认立绘。
6. **将池**:`/pool` 页会标「新」,**勾不勾由用户定**;定完「导出」覆盖 `shared/hero-pool-seed.json` 备份。禁将同页黑名单。
7. **同名可替换前缀**:新前缀类型(如「教主」「移动版」)要同时加 `shared/deal.mjs` 与 `room.html` 的 `heroBaseName`。
8. 按需:`cardWarn`(手录将直接写在 OFFLINE_HEROES 条目)、`derived-skills-room.json` / `derived-cards-room.json`、线下立绘 `assets/heroes/`、graduate 候选记录。
9. **deploy**:`cd prototype/worker && npx wrangler deploy`(所有 shared/*.json 都是 worker import,改完必须 deploy;老浏览器 generals.json 还有 1h 缓存)。

**常用流程速查**:
- **官网已收录的将(新将 / graduate)**:`node prototype/sgs/scrape-generals.mjs --ids 744,763`(增量抓取合并,新 id 插在 9000+ 段前;graduate 时先删 OFFLINE_HEROES 条目,`applyOverrides` 会清掉库里残留孤儿)→ `node prototype/sgs/build-pinyin.mjs`。新将 API 给的是 `…/m/general/big/static/{id}00.png`,头像由 scraper 自动派生 `skinShop/{id}00.png`。
- **录官网还没有的 OL 新将**:olwiki `https://olwiki.hmty.top/generals/index.html` 搜名拿 href 真 id → `general-game-{id}.html` 抓技能/特点,JS 数 `.hp-row .hp-icon` 得体力 → 写 `generals-overrides.mjs` OFFLINE_HEROES(9000+) → `node prototype/sgs/rebake-overrides.mjs` → 立绘用官方图床 `web.sanguosha.com/220/h5_2/res/runtime/pc/general/big/static/{id}00.png` + `…/general/skinShop/{id}00.png`(先 curl 验 200)→ **`node prototype/sgs/build-pinyin.mjs`**(需 `cd prototype && npm i --no-save --no-package-lock pinyin-pro@3`)。
- **线下将立绘**:用户把图拖进 `assets/heroes/`,我 `sips` 转 JPEG 压缩后挂 Pages 直链(聊天附件无法直接存成文件)。
- **技能修正**:`SKILL_OVERRIDES[id]`(+ 可选 `cardWarn`)→ rebake。**房间专属衍生技/牌**:`derived-skills-room.json` / `derived-cards-room.json`(衍生条目名不能与本体技能同名,会被过滤)。
- **新工具**:room-logic(保密则加 `VISIBILITY` + initToolState + action 块)→ `generals.json` 该将 `tool` 直写 + `scrape-generals.mjs` TOOL_NAMES → room.html 三注册(GENERALS/hasTool/TOOLS)+ view/bind → room-sim 断言 → 浏览器验。大段含反引号的代码先写 scratchpad 文件再用 node 插入(`node -e '…'` 会被引号搞坏且静默失败)。
- **浏览器验证坑**:① generals.json 被缓存 → 页内 `fetch('/generals.json',{cache:'no-store'})` 重灌 HEROES/HERO_BY_ID;② 换将有 confirm → 先 `window.confirm=()=>true`;③ `preview_start` 报 reused 可能是假的,先 curl 确认;④ 截图需要浏览器面板在前台。

---

## 零、当前状态(2026-07-09 会话收尾)

### ⭐⭐⭐⭐⭐ 最新会话(2026-07-14):裴秀十六州地图数据全就绪 + olwiki 源 + 立绘/界关平 —— 最先读这段

- **🗺️ 裴秀「十六州地图」16 州数据全部数字化完毕** → `prototype/sgs/shared/peixiu-maps.json`。**从 peixiu.hmty.top 前端 DOM 几何自动读取**(`.cell/.isActive` 格子、sprite 背景偏移=图标类型、`.order/.num` 城市徽标、`.cityCallout` 技能文案),非肉眼抄。含 16 州 ×(5×5 网格+墙+固定起点+四城坐标+图标+城市技能+州技),64 城:draw43/heal11/move:down5/move:left5,几何全自洽。**机制已吃透**(见 `docs/peixiu-tool-design.md`):茂著=发图+结束阶段三选一(池=本回合各州 stateSkill+已经过城市 skill,随机3选1留到下回合);尽览=用花色沿方向推箱子滑到底、经城市即执行图标(draw/heal/move);采风=凑花色。坐标 [x,y] 左下原点。move 走位:移N格后停留、撞新城触发、无链式。**下一步=建"带网格棋盘"工具(独立大件,换新对话做,不含最优解 solver)——续接指引见 peixiu-tool-design.md 第六节。**
- **📚 olwiki.hmty.top 定为查将优先参考源**(浏览器可访问,curl/WebFetch 被 403;URL `/{id}/wiki.html`)。批量更新库仍用官网 sanguosha.com scrape。见 memory [[olwiki-source]]。
- **🖼️ 立绘修复 + 界关平入池(已 push 65de0c8)**:裴秀(9003)/谋贾诩(9002) avatar 重指官方图床头部特写(dianjiang/{id×100}),cover 指全身像(xingxiang);界关平(9009,蜀/4血,龙吟/竭勇)手录入池。库 690 将。
- **⚠️ 部署**:本会话 room 侧改了 generals.json(立绘/界关平)→ 需 `wrangler deploy`。peixiu-maps.json 是纯数据、暂未被任何代码引用(等建工具),push 即可。

### ⭐⭐⭐⭐ 会话(2026-07-13):断线重连 + 3 线下将/衍生牌 + 英文版机制

- **🌐 英文版机制已搭好(增量翻译,查将读技能面)**:目标=美国长大的新玩家读技能。**核心=`effect_en` 英文层 + 缺失回退中文**,任意覆盖度可用、不维护两套逻辑。实现:①`generals-overrides.mjs` 加 `SKILL_EN[id]={技能名:英文}`(同 SKILL_ORDER 套路,重爬不丢),`applyOverrides` 写 `s.effect_en`,bake 进 generals.json;②room.html 加全局 `LANG`(localStorage 持久)+ `T(zh,en)` 文案本地化 + 查将弹层(openSkillView/previewHero)右上「中/EN」切换钮 + `skillsHtml`/`derivedSkillsHtml`/`derivedCardsHtml` 按 LANG 取 `effect_en||effect`(彩色标签仍从中文剥离)。**首批翻了 4 将=张芝/族荀采/张华/谋庞统(11 技)**,含语言绑定技张芝洗墨(复刻式英文+朋友核对)。浏览器双验:中↔英切换、Seat/max HP/Traits/衍生技 header 全本地化、飞白等衍生技暂无 EN→回退中文正常。**衍生技/牌 EN 通道也建好了**:新增 `derived-en.json`={武将→{名称→英文}},worker 合并 DERIVED_MERGED/DCARDS_MERGED 后按名贴 `text_en`(独立文件,重抽 derived-* 不丢 EN;前端渲染已支持)。首批填了张芝飞白 + 谋庞统飞军/潜袭(张芝/谋庞统现整将全英)。**下一步=翻优先集(17 工具将+常用池);hero skills 走 `SKILL_EN`、衍生技/牌走 `derived-en.json`。术语表见对话(Slash/Dodge/Compulsory Skill/recast/chained…)。**
- **📌 张华技能顺序修正(改版削弱)**:新增 `SKILL_ORDER[id]=[技能名全序]` 覆盖机制,张华(544)强制 弼昏→剑合→穿屋(穿屋"失去前X技能"吃顺序)。

- **本会话做完:①融合版断线重连(room.html 客户端)②入池 司马炎(9007)/神黄月英(9008)+ 蒲元(510)神工锻造库衍生牌 ③新建 `derived-cards-room.json`(房间版衍生牌合并通道)。`room-sim 321 passed`、内联 JS 语法过、浏览器验断线横幅四态全绿。库 687→689 将。**
- **⚠️ room 侧一堆改动待部署:用户务必 `cd prototype/worker && npx wrangler deploy`**(改了 worker/src/index.js 的 DCARDS merge、room.html、generals.json、新增 derived-cards-room.json)。wiki 侧本轮没动 index.html(衍生牌走房间版,不进 wiki),但 generals-overrides.mjs/generals.json 改了——这些只经 worker 生效。
- **①断线重连(修周末实测 bug)**:根因=`send()` 掉线静默丢弃 + 无自动重连 + UI 跑 stale state(手机切窗口掉线回来点啥都像成功其实丢了;南华换天书失败=替换要校验服务端当前态而本地是旧的)。**融合版**:`connect()`(初次/换房清态)拆出 `openSocket()`(重连复用不清态);指数退避自动重连(0.8→5s);`send()` 未连接时阻断+提示+催重连(不再静默);`body.disconnected` 令 `#app` 置灰冻结(读台账仍可见)、露顶部 seal 红横幅 + 「立即重连」兜底按钮(`#connbar` 在 #app 之外始终可点);**`visibilitychange` 切回前台 + `online` 恢复网络即刻重连(手机掉线主因)**;`roomClosed` 置 `intentionalClose` 防重连死循环。**服务端零改动**——worker `hello` 落到 `broadcast()` 推 fresh roomState → stale 自愈。**真机断/重连仍需用户 deploy 后验**。
- **②三个线下将/衍生牌**:司马炎(9007,晋/4血,举棋转换技/封土/泰始主公技,插画 simayan.jpg)+ 神黄月英(9008,蜀/3血,藏巧/神机/化朽,繁→简已转,插画 shenhuangyueying.jpg)进 `OFFLINE_HEROES`,`applyOverrides` 就地 re-bake generals.json(无网络)。蒲元**本就在库(id510)**,只补衍生牌。族陆绩浑天仪也补。
- **③衍生牌房间版通道**:以前只有衍生技有 `-room.json` 合并,衍生牌没有。新建 `prototype/sgs/shared/derived-cards-room.json`(神黄月英三神装+赠予概念/族陆绩浑天仪/蒲元神工库18装备),worker `DCARDS_MERGED` 照 `DERIVED_MERGED` 模式合并进 `/derived-cards.json`。查将按 hero.name 精确匹配带出(红边卡)。
- **⚠️ 状态更新(2026-07-13 用户核对后)**:(a)司马炎 hp=**3**、神黄月英 hp=**3**,均已确认(2026-07-13)。(b)**蒲元神工库 18 装备文本用户已逐字核对**——改了 9 处(赤血青锋/镔铁双戟/护心镜/黑光铠/束发紫金冠/三略/天机图/太公阴符全文订正)+ **红锦→红棉百花袍**改名;花色点数仍抓自 biligame 供参考;banner 已改「效果文本已核对」。(c)**神黄月英=纯线下,OL 无此将(已确认),永久保留不 graduate**。(d)**⚠ 原画不显示的根因**:`simayan.jpg`/`shenhuangyueying.jpg` 实为 **WebP 存成 .jpg**(`<img>` 能识别不致命,同 sunhanhua.jpg 是 PNG-as-.jpg 照样显示),真正原因=**这俩图还是 git 未跟踪(??),没 push 到 GitHub Pages** → Pages 直链 404 → onerror 隐藏。**修法=commit+push 这两张图**(同其他线下将原画)。
- **上一轮待办①已闭环**:68 升级将先不动(见下方历史段)。

#### 续:2026-07-13 同会话后续(在 8b34da2 之上,**未 commit**,等用户攒够一起 push)

- **⑤ 新增第 17 个工具 = 标郭照(id 662)`guozhao`**(用户线下痛点:每人出牌后要查郭照声明色 + 内训牌混手牌)。**混合范式=公开信息面板 + 袁姬式私密标记**:①椒遇声明色(黑/红,`setColor`,**全场公开**)+ 效果提示(同色→郭照给牌+摸牌[摸的也是内训牌]、异色→郭照拿牌+其摸牌)+ 额外出牌阶段静态提醒;②内训牌标记(`addNeixun`/`editNeixun` 花色点数牌名点选[复用 cardsAt]/`dissipateNeixun` 离手消散/`endTurn` 回合末清空,**ownerSeatOnly:牌名仅郭照可见、张数公开**)。触碰文件全范式:`room-logic.mjs`(VISIBILITY.guozhao + initToolState + action 块)、`room.html`(GENERALS/hasTool/TOOLS 三注册 + viewGzTool/bindGz + gzCardEditor)、`tools/guozhao.html`(单人版,魏蓝主题)、`index.html`(魏区 4→5)、`generals.json`(662.tool=guozhao,直接写[re-bake 不动它])、`scrape-generals.mjs`(TOOL_NAMES 加郭照,防重爬丢)、`room-sim.mjs`(+16 断言)。**`room-sim 321→337 passed`**;浏览器双验:郭照本人视图(声明色+内训明细) + 旁人视图(仅声明色/效果/张数,牌名隐藏零操作按钮),单人版功能+视觉全绿。
- **衍生牌补充**:吕玲绮(id716)新增衍生牌 section(束发紫金冠/玲珑狮蛮带/红棉百花袍/无双方天戟,同蒲元源);蒲元神工库 **18 装备文本用户已核对**(改 9 处+红锦→**红棉**百花袍改名,banner 去「待核」)。⚠ **红棉 vs 红锦** 官方 wiki 写红锦、蒲元侧查到红棉,**暂统一红棉**,用户 double-check 后定。
- **⚠ 未提交清单(下次一起 push + deploy)**:derived-cards-room.json(吕玲绮+蒲元订正)、郭照工具全套(room-logic/room.html/tools/guozhao.html/index.html/generals.json/scrape-generals.mjs/room-sim.mjs)。room 侧仍需 `wrangler deploy`。

### ⭐⭐⭐ 本轮收尾一句话(HEAD `8e21cd0`,全部 push 到 main)—— 最先读这段

- **本会话(2026-07-11~12)做完:PWA app 化 + 房间实战修 4 项 + 衍生技/衍生牌接入房间查将 + 8 衍生将&魔张飞补录 + 杜预破竹 + 转换技标签 + 本体技能彩色标签。`room-sim 321 passed`,16 工具/687 将不变。**
- **⚠️ room 侧一堆改动待部署:用户下次务必 `cd prototype/worker && npx wrangler deploy` 一次性生效**(新增 `/derived-skills.json`+`/derived-cards.json` 路由、DO 持久化/TTL/disband、座位独占、魔孙权天恩、本体标签等全在 worker+room.html)。wiki 侧 `git push` 已自动上 Pages。
- **查将弹层现在带 3 类附加信息**:①**衍生技**(该武将 index 卡里引用的衍生技,`derived-skills.json` 按武将存)②**衍生牌**(`derived-cards.json`,如杜预出其不意)③**本体+衍生技都显示彩色标签**(`skillTags()` 从技能文本开头剥离锁定技/限定技/觉醒技/转换技/主公技/势力技等 → `.stag-*` 彩色标记,纯客户端零数据改动,单向安全只漏不错)。
- **补文本工作流(固化)**:衍生技→改 `index.html #derived-skills`(人工源,新增势力组要同步子导航 line~902 + fh-count)→重抽 `derived-skills.json`(脚本:解析 article/h4/skill-name/多个 tag-XXX/skill-text,按 norm(h4=去·空格)存,tags 是数组);衍生牌→改 `#derived-cards`→重抽 `derived-cards.json`(dsrc 候选=[全名归一,去首个 X· 前缀]匹配库名);**房间专属/修改**(如魔张飞入魔)→ `derived-skills-room.json`,worker merge。**同名不同版必须按武将存不能全局拍平(火计教训)**。
- **待办(下一轮)**:①~~用户 review 升级将~~ **已决:68 升级将先不动(2026-07-13)** —— 分析结论:现有查将已覆盖绝大多数,**无需新增"升级后版本"面板**:觉醒技文本自洽(触发+被授予技能名),被授予技能(急袭/破竹/背水…)靠**衍生技拉取**(即②);入魔将=库内独立卡(魔张飞改写已进 room 覆盖);卖血将无离散版本。唯一真缺口=~10 改写技能将(文鸯仇决改膂力/SP姜维逢亮改困奋/孙休/薛综/郭皇后/司马伷/孙寒华…)的"改写后基础技全文"未展示,用户暂不补。②仍缺文本的真·衍生子技用户按需继续截图给(库+wiki 都无的不可瞎编);③`skillTags` 已知标签集列了十几个,遇到冷门标签(使命技/碎梦技等)没显示→加词即可。跟不上节奏老将(界徐庶等)、国战将 不补。

### ⭐⭐ 线下实战修 4 项 + 衍生技扫描(2026-07-11 会话)

- **实战反馈修了 4 处(①②③④),⑤ 只出扫描清单。`room-sim 321 passed`、client UI 冒烟 16/16、真机浏览器 4 张截图确认。全部 push 到 main。⚠️ room 侧改了(worker+room.html)→ 用户必须 `cd prototype/worker && npx wrangler deploy` 才生效。**
- **① 房间不再"人走即灭"**:RoomDO 加 **DO storage 持久化**(`core.serialize()/RoomCore.hydrate()`,devices.holds Set↔数组)+ **闲置 TTL 闹钟**(`ROOM_TTL_MS=2h`,每次操作 `setAlarm(now+2h)`;`alarm()` 到点清盘=房间消失,无人连接也会被平台唤醒执行)。新增 **`disbandRoom`** 动作(任意玩家解散,清盘+撤闹钟+广播 `roomClosed`)。client:底部「房间设置」卡有🗑解散(二次确认)+ TTL 说明;onmessage 处理 `roomClosed` 回大厅。
- **② 入口页显眼自定义 ID**:`viewConnect` 改成醒目「你的名字/ID」输入 + 🎲随机 +「别和同房玩家重复」红字提示;服务端地址收进 `<details>`。留空则随机。
- **③ 座位独占 + 解锁替换**:`claimSeat` 座位被他人持有→ `SEAT_TAKEN`;新增 **`takeoverSeat`**(撤原持有者 holds、强制转移)。client 座位卡:他人持有显「替换」(确认「XX 持有,确定接管?」)、未占显「认领」、自己显「释放」;显示当前持有者 + "断线可替换不锁死"。仍保留一设备多座位。
- **④ 魔孙权两修**:(4a)**天恩·不同项拆两步** —— `teDiffInit{target}`(孙权只发起)→ `teDiffChoose{effect}`(**目标本人**在其 UI 选剑,校验 `bySeat===tePending.target`);新增全局横幅 `sqPendingForMe/viewTeBanner`「⚔孙权对你发动了天恩」弹在目标任意界面顶部。(4b)**吴六剑处处带注释** —— 天恩选项/权御历史图例/表头 title 全用 `SQ_EFFECTS.d`(白虹=伤害+1…)。`tePending` 入 initToolState + teReset/endRound/teCancel 清。
- **⑤ 衍生技**:先出清单 [docs/衍生技扫描清单.md](衍生技扫描清单.md)(77 将含衍生技/68 将含升级信号,口径见文档头)。**第一步已落地(2026-07-12)——index.html 现成衍生技搬进房间**:从 `index.html #derived-skills` 区抽 → `prototype/sgs/shared/derived-skills.json`,**按来源武将存**:`{武将名(去·空格)→[{name,tag,text}]}`(14 卡)。⚠️**火计有两版**(蜀界庞统"改判定"强版 / 群司马徽"限三次"弱版)——**必须按武将存,不能全局拍平**(否则司马徽会串成界火计,强度超标,用户 2026-07-12 勘误)。worker 加 `/derived-skills.json` 路由;room.html `loadHeroes` fetch 进 `DERIVED`,查将弹层(openSkillView+previewHero)末尾 `derivedSkillsHtml(hero)` = **按 hero.name 去·空格精确查该将自己那张卡**、排除其顶层技能名→带出(红边卡)。谋庞统见飞军/潜袭、界庞统见火计(强)/看破/八阵、**司马徽见火计(弱·限三次)**/连环/业炎、鲍三娘见征南、界孙策见英姿/英魂。孤儿键孙翊(库无)无害;起·刘宏勘误为闪·刘宏(OL名,`254781c`)→闪刘宏现对上库带出飞扬/跋扈。browser 真渲染确认司马徽火计=弱版+零 console 错;sim 仍 321。
- **衍生牌也进房间了(2026-07-12)**:同法从 `index.html #derived-cards` 抽 → `prototype/sgs/shared/derived-cards.json`(按来源武将存,`{武将→[{name,src,text}]}`;来源解析 dsrc"（晋·杜预）"→候选[全名归一,去首个"X·"前缀]匹配库名,装备如五行鹤翎扇不匹配即跳过;承·吕布库无→落基础吕布,靠保留 src 标注消歧)。worker 加 `/derived-cards.json` 路由;room.html fetch 进 `DCARDS`,查将弹层 `derivedCardsHtml(hero)` 按武将带出衍生牌(红边卡+来源标注)。杜预查将见「衍生牌·出其不意（晋·杜预）」。browser 确认。
- **⑤ 用户补的文本已落地(2026-07-12,截图提供)**:衍生技 8 将补进 `index.html #derived-skills`——蜀+花鬘(系力,6→7将)、魏+文鸯(背水觉醒/清剿,3→4将)、群+刘宏(执笏)/SP孟获(叛侵)/张芝(飞白转换技)/赵忠(隐天/蔽日)(5→9将)、**新增晋组**(羊祜卫戍)+**新增神组**(神孙权圣质/权道/持纲);子导航 `derived-skills` 加晋/神。重抽 `derived-skills.json`(22卡)。**修改 1 将=魔张飞仅房间**:入魔后"灼魂（入魔·修改一）"全文写进新文件 `prototype/sgs/shared/derived-skills-room.json`(房间专属,不进 wiki),worker 把它 merge 进 `/derived-skills.json` 响应(同名武将数组拼接)。转换技(飞白/持纲)用 tag-lock+文本"转换技。阳…阴…"表示。browser 双验(wiki 6组齐/room 神孙权带出圣质权道持纲、魔张飞带出修改灼魂)+零 console 错;sim 321。**剩余待补(下一轮)**:杜预破竹等仍缺的真·衍生子技(58 减已覆盖),用户按需继续给。跟不上节奏老将(界徐庶等)、国战将 不补。**index.html 是人工源,derived-skills.json 从它抽取(改了 index 衍生技区需重抽:解析 article/h4/skill-name/skill-text,脚本见对话)**。**用户接下来:review 升级将 + 圈定还要补哪些不在 index 的衍生技**(跟不上节奏的老将如界徐庶、国战将 不补);剩余真·衍生子技+升级将文本补录进 `generals-overrides.mjs` 是后续。

### ⭐ PWA(app 化)状态 —— 见下方历史;⭐ 最新一句话状态(截至 `ebd4eeb`)—— 下面是历史增量
- **库 687 将 / 16 工具 / 6 线下将;`room-sim 309 passed`;`tools/*.html` 16 个;全部已 push 到 main,与 origin 同步。**
- **16 工具**:lvbu/nanhua/xunyou/huangyueying/caocao/yuanji/zhongyan/simayi/dongzhao/shensunquan/diaochan/sunquan + `dianwei`(神典韦挈挟)+ `lijue`(李傕狼袭0~2)+ `xurong`(徐荣暴戾)+ `xushi`(SP徐氏龙鳞贝)。后四个 = **全公开生成器范式**(随机下沉 DO、rng 可 seed、无 VISIBILITY、worker 走通用 action 无需改)。每个工具 = room-logic(initToolState+action块)+ room.html(view/bind)+ `tools/{id}.html` 单人版 + index.html 卡。
- **本轮新增武将**(覆盖层 `OFFLINE_HEROES`,9000+ id):孙寒华9001 / 谋贾诩9002 / 裴秀9003 / SP徐氏9004(带工具xushi) / 留赞9005 / 移动版谋韩当9006。**技能勘误**(`SKILL_OVERRIDES`):曹纯缮甲 / 鲍三娘许身 / 神张角×3 / 界郭皇后矫诏(726)。
- **新交互**:选将列表每行「查看技能」= `previewHero` 叠加层,选定前预览/比较多版本技能(纯客户端,零协议改动)。神势力自选(chosenFaction)、点座位查技能也都在。
- **部署两处**:room=`cd prototype/worker && npx wrangler deploy`(room.html+room-logic+generals.json 打进 worker);wiki=`git push` 即 GitHub Pages 自动(index.html+tools/*.html+assets/)。用户已多次 deploy;**最后几个提交(留赞/谋韩当/查看技能/矫诏)可能需再 deploy 一次**。
- **PWA(app 化)已接**(2026-07-10):wiki 站现为可安装 PWA —— 手机浏览器打开 GitHub Pages 站→「添加到主屏幕」得到带图标全屏 app,wiki 查表可离线。新增 `manifest.json` + `sw.js`(根目录)+ `assets/icons/icon-{32,180,192,512}.png`(印章「杀」图标,Pillow+Songti Black 生成,脚本见对话)。index.html `<head>` 加 manifest/apple-touch/theme-color、`</body>` 前加 SW 注册。**SW 策略:HTML network-first(push 即更新,日常无需动 sw.js)+ 其余 stale-while-revalidate + Google 字体缓存**。用户决策:**只走 PWA 不上架**(避开 $99/年、审核、三国杀 IP 侵权风险)。**更新流程不变:`git push` 同时更新网站+app;room 仍 `wrangler deploy`**。验证:preview 真浏览器 SW 激活、cache 44 项含外壳+工具页+字体、零报错、`room-sim 309 passed`(未碰协议)。可选未做:①16 个 tools 页各自加 SW 注册(现只 index 注册,scope 覆盖全站,用户先落地 tools 页才不受控,价值低);②room(workers.dev,另一 origin)自身装 app 需 worker 内嵌 manifest。
- **待办**:①SP徐氏/留赞/移动版谋韩当 **原画待补**(图丢 `assets/heroes/` 引 Pages 直链;孙寒华/谋贾诩/裴秀 已有);②**裴秀工具**(地图机制复杂,暂缓);③谋贾诩/裴秀 **graduate**(官网上线重爬后从 OFFLINE_HEROES 删,重名告警会提醒);④神典韦 roll **概率权重**未实现(当前等概率无放回)。
- **关键机制/方法**:更新武将 json 决策树(A官网有对→重爬 / B官网有错→SKILL_OVERRIDES / C官网无→OFFLINE_HEROES)+ 命名(OL 有同名的加前缀如 SP徐氏/移动版谋韩当)见 `generals-overrides.mjs` 头部注释;数据源 curl 方法(OL sanguosha.com + 移动版 sanguosha.cn)见 memory `ol-hero-scrape`;git/部署见 memory `room-git-setup`。


- ✅ **SP徐氏(线下带工具将)+ 龙鳞贝工具 → 现 16 个工具**:线下/同人卡「徐氏」(江魂龙谶),OL 已有同名「徐氏」(id390,问卦/伏诛)故命名 **SP徐氏**(id9004,tool=`xushi`,重名告警据此才没报)。工具 `xushi`:投龙鳞贝=2枚阴/阳→圣贝(1阴1阳,执行两次)/阳贝(双阳,+1龙怒)/阴贝(双阴,+2龙怒),自动累计`longnu`、手动±(守心移1)、`天泣`觉醒开关(龙怒达3高亮可发动),`lastRoll`公开。DO 端 rng 可 seed。room.html 注册 + `viewXsTool/bindXs`;`tools/xushi.html` 单人版(吴绿主题);index.html 吴区 2→3;原画 `assets/heroes/xianxia-xushi.jpg`(Pages 直链,一图两用)。**room-sim 309 passed**、Preview 房间+单人版渲染确认。

- ✅ **新增两个简单工具 → 现 15 个工具**:`lijue`(李傕狼袭:掷 0~2 随机伤害,DO 端 rng 可 seed)+ `xurong`(徐荣暴戾:marks 0~3 计数、凶镬发放给座位、出牌阶段三选一结算 `XURONG_EFFECTS`、杀绝濒死+1;`lastResolve` 公开)。均全公开无保密,worker 无需改(走通用 action)。room.html 注册 + view/bind;`tools/lijue.html`+`tools/xurong.html` 单人版;index.html 群区 3→5;generals.json 李傕(418)/徐荣(417) tool 映射 + scraper TOOL_NAMES。**room-sim 298 passed**(+7李傕 +12徐荣)、Preview 房间双工具 + 单人版渲染确认。**待 deploy**(room 侧 `wrangler deploy`;wiki 侧 push 即 Pages 自动)。

- ✅ **新功能「点座位看技能」已做完(cut 1)**:room.html 座位卡加了「查看技能」按钮 + 「选武将」搜索弹层,可从 **OL 全量 681 将** 里选武将、点任意座位看该将技能(名/势力/体力勾玉/定位/技能全文/立绘)。**纯客户端只读、零 RoomCore/协议改动**,room-sim 仍 **258 passed**、UI vm+DOM 冒烟 14/14、Preview 真渲染截图确认(魔孙权/神典韦/神甘宁 6血起始3 全对)。**待用户 `wrangler deploy` 后真机测**。
- ✅ **武将库数据源打通**:`prototype/sgs/shared/generals.json` = 官网 OL **681 将**全量(id/name/genre/series/faction/factionSelectable/quality/hp/initialHp/tags/skills/characteristic/cover/avatar/tool/offline)。爬虫 `prototype/sgs/scrape-generals.mjs`(node shell 出 curl,~3.5min 可重抓)。**数据来源见 memory `ol-hero-scrape`**(列表 ld+json 花名册 + `/api/v1/hero/info` 拿 hp/势力/品质 + 详情页 HTML 拿技能;移动版 sanguosha.cn 相差太远弃用,必须 OL sanguosha.com)。12 工具已全部映射到 OL id(钟琰=7014)。
- ✅ **神将势力自选 cut 2 已做完**:RoomCore 加 `seat.chosenFaction`(公开)+ `setFaction{seatNo,faction}` 动作(校验持有者/势力∈魏蜀吴群/可清空,改武将自动重置);worker 加 `setFaction` case;room.html 对「我持有的神将」露出 魏蜀吴群 势力选择器,座位/技能弹层显示「神→蜀」。
- ✅ **神典韦工具 cut 3 已做完 —— 13 个工具**:`dianwei` 工具(全公开生成器)。`room-logic.mjs` 加 `DIANWEI_POOL`(28 张:16 特殊带杀+12 白板,数据从 generals.json 派生)+ `rollQiexie(rng,5)`(无放回、关羽/张飞互斥、rng 可 seed) + `initToolState("dianwei")` + action 块(`qiexie` 抽5 在 DO 跑、`equipToggle` 装/卸≤slots、`clearWeapons`、`newTurn` 清抽保武器、`resetGame`);worker 无需改(走通用 action);room.html 注册工具 + `viewDwTool/bindDw`(当前武器/摧决可及范围/抽5候选点选装备/白板标注/记录);generals.json 神典韦(229).tool=dianwei。**捐甲=武器栏2(slots)、摧决=展示最大范围**。
- **基线更新:room-sim 279 passed**(+7 神势力 +14 神典韦)、UI vm+DOM 冒烟全绿、Preview 真渲染确认全部三块。**cut1+头像修+cut2 已 push 到 main(1faed7c);cut3 待 commit+push+deploy**。
- ✅ **人工修正层已建**(`generals-overrides.mjs`,commit `7eb809f`):OL 过时技能/线下武将写这里,re-scrape 不丢。已修 曹纯缮甲/鲍三娘许身/神张角三技(线下版)+ 新增线下武将孙寒华(id9001,吴/3血)→ 库 682 将。顺带修了 scraper 写盘路径(→shared/)。后续过时武将同法进覆盖层。
- ✅ **线下将原画已接**(commit `abceaf7`):孙寒华/谋贾诩/裴秀 原画存 `assets/heroes/*.jpg`,GitHub Pages 托管,overrides 里 `avatar`/`cover` 指 Pages 直链(`https://initial-jie.github.io/sgs-wiki/assets/heroes/`)。⚠ 若 Pages 实际 base 不是这个域(自定义域名等),URL 要改。以后线下将原画同法:图片放 `assets/heroes/` → 引 Pages 直链。
- 🔜 **TODO(裴秀工具)**:裴秀(9002... 实为9003,魏/4/限定,地图机制)已入 room 库供查技能,但**地图机制复杂需完整了解后再开工具**,暂缓。
- 🔜 **TODO(新将 graduate)**:谋贾诩(9002)/裴秀(9003)是 OL 新将官网未收录时的临时录入,**官网上线后重爬要从 OFFLINE_HEROES 删掉**(重名告警会提醒)。更新武将 json 的完整决策树见 `generals-overrides.mjs` 头部注释。
- 🔜 **下一步**:①可选 wiki 单人版复用 generals.json + RoomCore「本地模式」(refactor 调研结论=逻辑只写一份,详见 memory `room-project`);②神典韦 roll 池后续可扩(用户说不止标将,已给 28 张;概率权重 标风>界>璀璨>族>谋 暂未实现,当前等概率无放回);③继续真机测其余工具问题清单。
- ⚠️ **worker 改了**(新增 `/generals.json` 路由 + `import generals.json`):**必须重 `cd prototype/worker && npx wrangler deploy`** 新前端才生效(否则 `/generals.json` 404、武将库加载失败,room.html 会 console.warn 但降级——12 工具仍可用)。留意 deploy 时 bundle 体积(+749KB JSON,gzip 后约 200KB,免费计划 3MB 限额内)。

**神典韦【挈挟】roll 池规格(用户 2026-07-09 提供,给 cut 3 用)**:共 **28 张武将牌**可抽,出框概率 标风包>界限突破包>璀璨包>族包>谋包。抽出的牌=武器,无花色点数,攻击距离=牌面武将体力上限。**17 个「带杀」技能**(关羽牌与张飞牌互斥):关羽武圣/张飞咆哮/赵云龙胆/马超铁骑/许褚裸衣/吕布无双/吕蒙克己/大乔流离/诸葛亮空城/界黄忠烈弓/夏侯渊神速/谋关羽威临/韩遂骁袭+逆乱/族荀粲熨身/雅丹倾轧/界姜维挑衅。**12 张「白板武器」**(仅名字不触发技能):刘备/孙权/曹操/甘宁/黄盖/张辽/夏侯惇/司马懿/陆逊/周瑜/黄月英/貂蝉。(16 特殊将含互斥 + 12 白板 = 28)

## 附:2026-07-08 状态(12 工具接房间收尾)

- ✅ **12/12 武将工具全部接房间**:吕布/南华/A档6(荀攸/黄月英/曹操/袁姬/钟琰/司马懿)/董昭/神孙权/貂蝉/魔孙权。room-sim **258 passed**、deck **26 passed**、前端 view/bind node+vm 冒烟全绿。
- ✅ **已合并并推送到 `main`**(用户已 push,merge commit `c6f02c8`);**worker 已由用户 `wrangler deploy` 重新部署**——线上 `https://sgs-room.dujie1995.workers.dev` 现含全部 12 工具。
- ✅ **前端首页已上线房间入口**:`index.html` 线下工具区上方的「线下多人房间」大 section(v1.2),直达 worker。GitHub Pages 会随 push 自动更新。
- ✅ git remote 已切 SSH(`git@github.com:initial-jie/sgs-wiki.git`);用户需把 `~/.ssh/id_ed25519.pub` 加到 GitHub `initial-jie` 账号后即可 `git push` 免密。
- 🔜 **下一步 = 真机多人测反馈**:用户 2026-07-09 拉朋友多手机实测。重点验:魔孙权权御暗选(各自手机秘密选、翻开前含孙权都偷看不到)、貂蝉幻惑位置报数向导、董昭先略暗置、各工具"操作权归本座位/他人只读"、聚焦↔大厅。**明天带着真机问题清单来,逐个调**。
- 可选后续(非阻塞):DO storage 持久化 + WebSocket hibernation 正式化;军争 `EXACT_CARDS` 已开 STRICT(#1 完成)。

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
- 决策已拍板:状态权威=**方案 a**(DO 存纯数据+过滤,reducer 在前端);房间码=**4 位**;接入顺序=**吕布 ✅ → 南华 ✅ → A档6工具 ✅ → 董昭 ✅ + 神孙权 ✅ + 貂蝉 ✅ → 魔孙权 ✅(收官)。全部 12 工具已接房间。**
- ⚠️ **分类修正**:早期把"董昭/神孙权/貂蝉"笼统归为"B档花名册3工具",实测**神孙权无花名册也无保密**——它是"驭衡帝力追踪器",纯公开生成器(同钟琰/司马懿,随机在客户端、解析结果进 DO)。真正需绑座位环的花名册工具只剩 **貂蝉 + 魔孙权**(见第八节)。
- ⚠️ **命名澄清**:**魔孙权 = `tools/sunquan.html`**("魔孙权面杀追踪器",Set+暗选+强座位,唯一硬骨头,排最后);`tools/shensunquan.html` 是"神孙权",属 B档普通直通。
- **真机已上线**:worker 内联 room.html,根路径 `/` 直出客户端页,服务端地址自动同源 wss(零配置)。用户 Cloudflare 账号已注册,子域名 `dujie1995.workers.dev`,地址 `https://sgs-room.dujie1995.workers.dev`。改代码后需用户重跑 `npx wrangler deploy`。

## 五、当前代码 `prototype/`

```
prototype/
├─ shared/room-logic.mjs   核心权威逻辑(RoomCore + 可见性 + 12 工具状态机),sim 与 worker 共用
├─ shared/deck.mjs         牌堆数据 + 登记牌合法性校验(花色级软规则;EXACT_CARDS 待补)
├─ room-sim.mjs            可执行规格:12 工具全流程 258 条 node 断言
├─ deck-test.mjs           牌堆校验 19 条断言
├─ worker/src/index.js     Cloudflare Worker + RoomDO(WebSocket/广播/路由),通用不含业务
├─ worker/wrangler.toml    DO 绑定(SQLite-backed,免费计划可用)
├─ client/room.html        ★ 正式房间前端(多工具聚焦框架 + 12 工具,宣纸风,内联 deck 校验)
├─ client/index.html       早期裸调试页(协议已升级,仅留参考)
└─ README.md               本地怎么跑(含 Windows、2.5 节 room.html 剧本)
```
基线:`node prototype/sgs/room-sim.mjs` → **258 passed**(吕布40 + 南华24 + 荀攸15 + 黄月英15 + 曹操8 + 袁姬16 + 钟琰10 + 司马懿19 + 董昭26 + 神孙权22 + 貂蝉31 + 孙权32);**12/12 工具全部接入完成**;`node prototype/sgs/deck-test.mjs` → **26 passed**(含 STRICT 精确校验);
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
- `public`(默认) / `secretHolding`(明细仅本人+代持可见、数量全场公开、系统内部全可读) / `ownerSeatOnly`(仅本座位可见明细,他人见数量) / `ownerOnly` ✅(**南华用**:每册自带 `owners`+`revealed` 数组,发动后全场公开,旁人只见占位) / `secretPick` ✅(**孙权权御暗选用**:键值对象 `{[座位]:{holder,effect,revealed}}`,翻开前仅本人可见内容、他人只见 `{holder,hidden}` 占位——连孙权也偷看不到;reveal 时 DO 原子翻开+算相同数+写 used,不弱于现状)。

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
- 自带花名册需绑定房间座位:貂蝉 ✅/董昭 ✅/孙权(魔孙权)✅/吕布 ✅。(神孙权**不在**此列——无花名册)
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
| — | **魔孙权** | ✅ 收官硬骨头接房间(**唯一真暗选**):新 `secretPick` 原语——权御暗选翻开前仅本人可见、孙权也偷看不到;`pick` 是**首个非工具主写自己那份**(任意存活座位含孙权,像 registerQi);`reveal` 在 DO 原子结算(翻开+算相同数+摸 min(相同+1,3)+写 used);天恩不同项/相同项、乾纲入魔失天恩、阵亡追踪、每轮反噬。Set→数组,花名册绑座位。room-sim 258 passed、view/bind 冒烟 13 分支通过。**待用户真机测**(需先 deploy)|
| — | **A档6工具** | ✅ 荀攸/黄月英/曹操/袁姬/钟琰/司马懿 全部接房间,client JS 语法通过。真机测已修:①荀攸4×3表格对齐(`.pick`的`flex:0 0 auto`盖过`.grow`→改内联`flex:1 1 0`);②袁姬记录牌改「花色+点数→点选牌名」(复用 cardsAt,同吕布);③切武将工具没变(worker 静默吞 setGeneral 错误→已回传 error;RoomCore 座位号统一 `Number()` 防 holds 不匹配)|

**已知原型限制**(正式化时处理):DO 纯内存态(未加 storage 持久化 + WebSocket hibernation);座位数固定 8。生成器类工具(曹操/钟琰/司马懿)的技能池/自定义配置是**客户端本机**态,刷新即回默认(游戏无关,可接受)。

## 十、下一步

1. **真机测 A档6工具 + 南华**(眼下):用户 `npx wrangler deploy` 后多手机测。重点验:①荀攸/黄月英/曹操/钟琰纯公开台账多设备同步;②袁姬镜花/水月旁人只见张数、牌名仅本人可见、节言状态公开;③司马懿诡伏满3入魔→骤袭三选一→持有技公开;④各工具"操作权归本座位、他人只读"、聚焦/返回大厅顺畅。
2. **牌表**(并行不阻塞):用户拿到完整牌表 → 填 `EXACT_CARDS` 开精确校验(#1)。
3. **12 工具全部接房间完成** ✅(吕布/南华/A档6/董昭/神孙权/貂蝉/魔孙权)。**下一步 = 前端 wiki 页的"房间"大 section**:在 sgs-wiki 主站(线下工具列表)上方加一个醒目区块,引导玩家进入 `https://sgs-room.dujie1995.workers.dev` 开/进房间。用户已授权:改好前端 repo 直接 push + merge main。之后可选:真机全量回归、DO storage 持久化/hibernation 正式化。

**董昭接入范式(半私密,已固化)**:先略记录的锦囊牌名 = **暗置**(`rec: ownerSeatOnly`,他人只见 `{count:0|1}`=有无记录、拿不到牌名;log 只记"记录了一张"不记牌名 —— 仿袁姬"不弱于现状")。顺机的自带座位限次(原 `seatN`+`seats{}`)**改绑房间座位号**(`shunji:[座位号]`,`sjToggle{seatNo}` 校验 `this.seats[sn]` 存在)—— 这就是"花名册绑座位"的最小范式,神孙权/貂蝉复用。顺机牌名账本/造王/移势全公开。`toolAction.type` 全集:`xlRecord{name}`/`xlTrigger`/`xlNewTurn`/`zwSet{on}`/`sjToggle{seatNo}`/`sjEndRound`/`nameAdd{name}`/`nameRm{index}`/`yishiSet{suit}`/`yishiClear`/`resetGame`。
