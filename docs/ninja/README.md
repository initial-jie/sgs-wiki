# 《忍者之夜》(Night of the Ninja)研究笔记 —— 2026-11-20

> 目的:把「忍者牌」接到 sgs-wiki 多游戏房间架构(`prototype/common/`)上做**第七个游戏**。
> 「忍者牌」没有同名桌游,搜索到的唯一对得上的是 Brotherwise Games 2020 年的 **Night of the Ninja**(繁中版《忍者之夜》,4~11 人隐藏流派 + 轮抽忍者牌),与风声/阿瓦隆/一夜狼同类。**本文默认就是它,开工前请确认。**
> 一手来源:**官方规则书 PDF**(fgbradleys.com 镜像,本机用 Swift PDFKit 渲染成图读的,四页存为 `rulebook-p1~4.jpg`)+ **官方 FAQ PDF**(文字抽取存 `faq-text.txt`)+ 卡面原文(规则书内嵌卡图,裁图 `cards-*.jpg`)。二手:繁中开箱(punchboard / gamesquare 痞客邦)、PTT 心得、GitHub 网页版 Byte-Git-hub/NinjaNight 的规则账本(用来对照译名与边界裁定)。

## 1. 产品事实

| 项 | 内容 |
|---|---|
| 名称 | Night of the Ninja(2020,Brotherwise Games;设计 Justin Gary,美术 Ben Charman 剪纸灯箱风) |
| 人数 / 时长 | **4~11 人**,15~30 分钟;另有官方 2 人变体(§7) |
| 配件 | 33 张忍者牌 Ninja、11 张流派牌 House(仙鹤 1~5、莲花 1~5、浪人 ×1)、11 个立牌、35 枚手里剑形荣誉标记 Honor(+5 备用),面值 2/3/4 |
| 繁中版 | 存在(台湾),译名:密探 / 隱士 / 騙徒 / 盲眼刺客 / 上忍 / 首腦;仙鶴派 / 蓮花派 / 浪人;榮譽標記。骗徒六张与两张反应牌的繁中名没搜到 |
| 简中版译名 | **说明书版**(hsuBnOediH/NightOfNinjaOnline 按实体说明书 + 33 张实卡照片核对):仙鹤 / 莲花 / 浪人;密探、隐士、盲眼刺客、上忍;骗徒 1 百变者 / 2 掘墓人 / 3 捣蛋鬼 / 4 灵魂商贩 / 5 窃贼 / 6 裁判;首脑 / 还施僧 / 殉道者。**另一印次**(Byte-Git-hub/NinjaNight、LHY-1/ninja-night 两个网页版都用):百变者 / 商人 / 盗贼 / 裁判 / 刺客 / 还施者 / 大将军。用户手里那套(2026-11-27 口述)= 后者 + 流派叫「伊贺 / 甲贺」(流派名无任何来源,按记忆)。房间里做成「牌名版本」房规四选一(`NAME_SETS`:iga / cn / manual / official),只影响显示与日志 |
| 类型 | 隐藏阵营(两派 + 中立浪人)、每轮重发身份、轮抽行动牌、夜晚按阶段结算、个人积分制 |

## 2. 准备(官方)

- 按人数取**等量**的仙鹤与莲花流派牌:4 人用 1、2 号,人数增加按序加 3、4、5;**奇数人数加入浪人**。
- 洗忍者牌;洗 35 枚荣誉标记**数字朝下**叠成一堆;每人一个立牌。

| 人数 | 仙鹤 | 莲花 | 浪人 |
|---|---|---|---|
| 4 | 1~2 | 1~2 | — |
| 5 | 1~2 | 1~2 | ✓ |
| 6 | 1~3 | 1~3 | — |
| 7 | 1~3 | 1~3 | ✓(规则书示例图就是 7 人) |
| 8 | 1~4 | 1~4 | — |
| 9 | 1~4 | 1~4 | ✓ |
| 10 | 1~5 | 1~5 | — |
| 11 | 1~5 | 1~5 | ✓ |

## 3. 一轮流程(官方)

每轮 = **开始 → 忍者轮抽 → 夜晚 → 流派揭示 → 轮末**。

1. **开始**:洗本局用的流派牌,每人暗发 1 张。可以看自己的,不能亮给别人。**每轮重发**。
2. **忍者轮抽**:每人发 3 张忍者牌 → 留 1 张,其余 2 张传给**左手**玩家 → 从收到的 2 张里再留 1 张,最后 1 张**弃到桌子中央**(弃牌堆,掘墓人会翻)。本轮没发出去的忍者牌**整批移出本轮**。结果每人手里 2 张。
3. **夜晚**:五个阶段依次:**① 密探 Spy → ② 隐士 Mystic → ③ 骗徒 Trickster → ④ 盲眼刺客 Blind Assassin → ⑤ 上忍 Shinobi**。
   - 每阶段你可以打出手里**任意张**对应阶段的牌:面朝上放桌上;同阶段多张按牌上数字 **1 → 6** 依次结算。
   - 没人出牌就进下一阶段。
   - **可以不出**(诈唬),但**跳过的牌本轮不能再打**。
   - 全程鼓励桌面交谈,死人也能说话、出主意、搅局。
4. **死亡**:被杀**不翻流派牌**,放倒立牌。死人仍可以说话。
5. **流派揭示**:夜晚结束,**存活者**翻开流派牌。**存活者中等级最高(数字最小,1 最高)的那一派赢本轮**;最高者同级则比各派**次高**存活者,逐级打破(示例:双方 1 平、2 平、3 胜 4)。
   - 赢的一派**每个成员(包括本轮已死的)各摸 1 枚**荣誉标记,数字朝下私藏。
   - **浪人**:只要自己活到揭示就摸 1 枚(不属于任何派)。
   - **完全平手**(存活序列完全一样):没有派赢,**每名存活者**各摸 1 枚。
   - 若有人亮出**首脑**(见 §4.3):他的派直接赢;他是浪人则本轮没有派赢(浪人自己仍因存活得 1 枚,FAQ)。
6. **轮末 / 胜利**:任一轮结束时,**荣誉标记总分 ≥ 10** 的玩家亮出标记宣告胜利;同轮多人达标**分高者胜**;同分**共享胜利**。FAQ:盗贼偷到使自己过 10 分**不立即赢**,等轮末揭示后再查。

## 4. 33 张忍者牌(卡面原文 + 拟中文名)

**张数**:规则书只说 33 张、同阶段按 1~6 结算;PTT 玩家原帖「每種忍者都有 1-6」。5 类 × 6 张(各编号 1~6)+ 3 张特殊 = 33 正好吻合,**采用此分布**(骗徒 6 张是 6 种不同牌,编号即种类)。规则书卡图里出现过的实例:密探 2/3/4/5、隐士 6、盲眼刺客 2、上忍 2/4,都在 1~6 内。

### 4.1 五个阶段的牌

| 阶段 | 牌 | 拟中文名 | 卡面原文 | 实现要点 |
|---|---|---|---|---|
| ① | Spy ×6 | 密探 | Look at another player's HOUSE card. | 看一人流派牌,**私密**;FAQ:看完可以随便说真话假话 |
| ② | Mystic ×6 | 隐士 | Look at the HOUSE card and one NINJA card of another player. | 看一人流派牌 + 他的**一张**忍者牌;FAQ:目标还剩两张时由**施术者随机**选一张看 |
| ③ | Trickster ×6 | 骗徒 | 六张各不同,见 4.2 | 按 1→6 结算 |
| ④ | Blind Assassin ×6 | 盲眼刺客 | Choose a player and KILL them. | 直接杀,不看牌 |
| ⑤ | Shinobi ×6 | 上忍 | Choose a player. Look at their HOUSE card. You may choose to KILL them. | 先看流派牌(私密)再**决定**杀不杀 |

### 4.2 六张骗徒(编号 = 结算顺序)

| # | 牌 | 拟中文名 | 卡面原文(规则书裁图,方括号为被遮住、按 FAQ 补全的字) | 实现要点 |
|---|---|---|---|---|
| 1 | Shapeshifter | 变形者 | Look at the HOUSE cards of two players. You may secretly swap them around. They may not look at their new HOUSE. | 看两人流派牌,可**秘密对调**;对调后两人**不能再看自己的新牌**(FAQ:只能靠别的牌去看/亮)。可否选自己:官方没说,网页版裁定允许 |
| 2 | Grave Digger | 掘墓人 | Look at two discarded [NINJA cards] and pick one. You m[ay play it] immediately or kee[p it in front of] you for use later. | 从**中央弃牌堆**看 2 张选 1;FAQ:可**立刻打出**(不按阶段)或留到对应阶段打 |
| 3 | Troublemaker | 捣乱者 | Look at another player's HOUSE [card]. You may reveal it. | 看一人流派牌,**可选公开**给全桌 |
| 4 | Spirit Merchant | 通灵商人 | Look at another play[er's HONOR] token or HOUSE ca[rd. You may swap] one HONOR token [with them]. | 看目标**一枚荣誉标记**或**流派牌**(二选一),然后可与之**交换一枚**标记;FAQ:给对方自己任一枚、拿对方任一枚(看过没看过都行) |
| 5 | Thief | 盗贼 | Reveal your HOUSE card. You may take one HONOR token from a player who has more than you. | **亮自己流派牌**(代价),从标记**比你多**的人那拿 1 枚(面值仍暗) |
| 6 | Judge | 判官 | Reveal your HOUSE card. Choose a player and KILL them. Mirror Monks and Martyrs do not work on the Judge. | 亮自己流派牌,杀一人;**镜僧/殉道者对判官无效** |

### 4.3 三张特殊牌(不按阶段)

| 牌 | 拟中文名 | 卡面原文 | 实现要点 |
|---|---|---|---|
| Mirror Monk(react) | 镜僧 | Reveal this if a Shinobi or Blind Assassin chooses to KILL you. KILL them instead. | 被上忍/盲眼刺客选杀时翻开:**反杀**凶手,自己不死。对判官无效 |
| Martyr(react) | 殉道者 | Reveal this if a Shinobi or Blind Assassin chooses to KILL you. Gain an HONOR token. | 被上忍/盲眼刺客选杀时翻开:照样死,但**得 1 枚**标记。对判官无效 |
| Mastermind(reveal) | 首脑 | If you are still alive during the Reveal Phase, your HOUSE wins the round. (If you are the Ronin, no HOUSES win this round.) | 揭示阶段还活着就亮:**己方直接赢本轮**;浪人亮则**没有派赢**(他自己仍因存活得 1 枚) |

### 4.4 FAQ 其它裁定(官方)
- 乱序打出牌:收回手里,**但大家都知道你有这张了**。
- 掘墓人挖到的牌可以乱序立刻打,也可留到其阶段。
- 盗贼偷过 10 分不立即赢。

## 5. 待核对 / 官方没说的(实现时做成可配或按下列默认)

| 项 | 状态 | 默认 |
|---|---|---|
| 荣誉标记 2/3/4 分各几枚 | 官方英文来源没有;**简中说明书版**(hsuBnOediH 按实卡核对)写 **2 分 ×14、3 分 ×14、4 分 ×7** = 35 | 采用 14/14/7 作默认;仍做成配置 |
| 标记堆抽完 | 未说 | 本轮不再发 |
| 密探/隐士/上忍能否选自己或死人 | 未说 | 不能选自己;**可以看死人**(死人不翻牌,情报仍有价值),盲眼刺客/上忍/判官不能杀死人 |
| 变形者能否把自己算进「两人」 | 未说 | 允许(含自己) |
| 一人同阶段多张牌 | 官方允许(any Ninja cards) | 允许;同号按座位序 |
| 镜僧 + 殉道者同持 | 未说 | 二选一翻一张(镜僧优先提示) |
| 被镜僧反杀的凶手能否再翻镜僧 | 未说 | 不能(反应只一层) |
| 已打出但轮到结算前死亡的牌 | 2P 规则:揭示前被杀的牌不结算 | 已翻面的牌仍结算,未翻面的作废 |
| 两派全灭 | 未说 | 没有派赢;浪人存活得 1 枚;全死无人得分 |
| 首脑 + 盗贼/通灵商人改分后何时查胜利 | FAQ:轮末 | 轮末统一查 |

## 6. 房间设计草案(待确认)

形态与**情书 / 阿瓦隆**同款:**线上牌桌 + 系统主持**,线上线下都能玩,全部事件驱动、没有 tick。

- **保密模型**(`_seatView`):流派牌、手里的忍者牌、荣誉标记面值、私密笔记(密探/隐士/上忍/变形者/通灵商人看到的)只本人可见;打出的牌、死亡、标记**枚数**、被判官/盗贼/捣乱者亮出的流派牌公开;轮末只公开存活者流派牌,终局全公开。
- **阶段**:setup → draft(sub pick1 / pick2,每人独立操作,传牌同步后进下一步)→ night(sub spy/mystic/trickster/blind/shinobi;每阶段收齐所有人「出哪几张 / 跳过」后统一翻开,再按 1→6 逐张结算;结算到某张时由持有者选目标/做选择;杀人时目标若持镜僧/殉道者弹反应窗)→ reveal(首脑可亮)→ roundEnd(发标记、查 10 分)→ 下一轮 / over。
- **前端**:座位圆桌(立牌倒下 = 死亡;公开的流派牌贴在座位上)、我的两张忍者牌(大卡,按当前阶段高亮可出)、阶段条(五阶段)、私密情报卡、荣誉标记条(自己看面值,别人只看枚数)、轮末结算表、📖 图鉴、📋 每轮记录;一机多座 `autoSeat`。
- **配置**:人数 4~11;荣誉标记面值分布;胜利分数(默认 10);是否允许多座代持。
- **卡面**:官方剪纸灯箱图是版权图且拿不到高清(规则书内嵌 ≈280 px,BGG 反爬);现用开源网页版 NinjaNight 的 AI 水墨浮世绘卡图(见 `art-sources.md`),缺图退回阶段色块 + 图标(金 密探 / 橙 隐士 / 红 骗徒 / 紫 盲眼刺客 / 蓝 上忍 / 灰蓝 特殊),流派牌 红 / 蓝 / 紫。
- **沿用的底座**:`prototype/common/` 的 RoomClient / DO 模板 / 游戏注册表 games.mjs(加一条 `ninja`)+ wiki 首页手补一行;wrangler 迁移 v9 加 `NINJA_ROOM`。

## 7. 2 人变体(官方网页,参考,v1 不做)
每人当一派的 Leader 控制 1/2/3 三张流派牌;发 5 张忍者牌,留 1 传 4 → 收 4 留 1 弃 1 → 传回 2 留 1 弃 1,每人 3 张分给三个「成员」;夜晚按普通规则把三个成员当独立玩家;揭示时存活最高者所属 Leader 得 1 枚;10 分胜。

## 8. 来源
- 官方规则书 PDF(镜像):https://fgbradleys.com/wp-content/uploads/Night-of-the-Ninja-Rulebook.pdf (原链 brotherwisegames.com/s/NightoftheNinjaCoreRulebook.pdf,11MB)
- 官方 FAQ PDF:https://www.brotherwisegames.com/s/NightOftheNinjaFAQ.pdf
- 官方产品页 / 2P 规则:https://www.brotherwisegames.com/night-of-the-ninja 、https://www.brotherwisegames.com/night-of-the-ninja-2p
- 繁中开箱:https://punchboardgame.pixnet.net/blog/posts/9566351556 、https://gamesquare.pixnet.net/blog/posts/14222992236
- PTT 心得(每種忍者都有 1-6):https://www.pttweb.cc/bbs/BoardGame/M.1672681963.A.5A9
- 网页版实现(AGPL,规则账本 docs/01_GAME_RULES.md 可对照边界裁定;`src/ui/assets.ts` CARD_CN 是「商人 / 刺客 / 大将军」那套译名):https://github.com/Byte-Git-hub/NinjaNight
- 网页版实现(按简中实体说明书与实卡照片核对的规则审计 `docs/RULES_AUDIT.zh-CN.md`:译名、张数、标记 14/14/7):https://github.com/hsuBnOediH/NightOfNinjaOnline
- 网页版实现(engine.js 里也用 刺客 / 大将军):https://github.com/LHY-1/ninja-night
