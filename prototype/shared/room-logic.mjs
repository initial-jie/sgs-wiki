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

// 魔孙权权御六效果(下标固定;DO 用于校验与日志,client 同一份用于展示)
export const SQ_EFFECTS = [
  { n: "白虹", d: "伤害+1" }, { n: "青冥", d: "额外指定一个目标" }, { n: "辟邪", d: "无视防具" },
  { n: "紫电", d: "不可响应" }, { n: "百里", d: "额外结算一次" }, { n: "流星", d: "无次数限制" },
];

// ---------- 神典韦【挈挟】roll 池(28 张武将牌:范围=牌面体力上限,带杀技能或白板;关羽/张飞互斥)----------
// 数据从 generals.json 派生(见 scripts 生成)。挈挟随机在 DO 跑(公开、可 seed 复现,不弱于洗一副28牌)。
export const DIANWEI_POOL = [
  {"name":"关羽","range":4,"ex":"gy_zf","skills":[{"name":"武圣","effect":"你可以将一张红色牌当【杀】使用或打出。"}]},
  {"name":"张飞","range":4,"ex":"gy_zf","skills":[{"name":"咆哮","effect":"锁定技，你使用【杀】无次数限制。"}]},
  {"name":"赵云","range":4,"skills":[{"name":"龙胆","effect":"你可以将一张【杀】当【闪】、【闪】当【杀】使用或打出。"}]},
  {"name":"马超","range":4,"skills":[{"name":"铁骑","effect":"当你使用【杀】指定目标后，你可以判定，若为红色，其不能使用【闪】响应此【杀】。"}]},
  {"name":"许褚","range":4,"skills":[{"name":"裸衣","effect":"摸牌阶段，你可以少摸一张牌，然后你本回合使用【杀】或【决斗】造成的伤害+1。"}]},
  {"name":"吕布","range":4,"skills":[{"name":"无双","effect":"锁定技，你使用的【杀】需两张【闪】才能抵消；与你【决斗】的角色每次需打出两张【杀】。"}]},
  {"name":"吕蒙","range":4,"skills":[{"name":"克己","effect":"若你未于本回合出牌阶段使用或打出过【杀】，你可以跳过弃牌阶段。"}]},
  {"name":"大乔","range":3,"skills":[{"name":"流离","effect":"当你成为【杀】的目标时，你可以弃置一张牌并将此【杀】转移给你攻击范围内的一名其他角色。"}]},
  {"name":"诸葛亮","range":3,"skills":[{"name":"空城","effect":"锁定技，若你没有手牌，你不能成为【杀】或【决斗】的目标。"}]},
  {"name":"界黄忠","range":4,"skills":[{"name":"烈弓","effect":"你【杀】的攻击范围为此【杀】点数。当你使用【杀】指定目标后，你可以执行以下效果：1.若其手牌数不大于你，其不能抵消此【杀】；2.若其体力值不小于你，此【杀】伤害值+1。"}]},
  {"name":"夏侯渊","range":4,"skills":[{"name":"神速","effect":"你可以选择至多三项：1.跳过判定阶段和摸牌阶段；2.跳过出牌阶段并弃置一张装备牌；3.跳过弃牌阶段并翻面。你每选择一项，你视为使用一张无距离限制的【杀】。"}]},
  {"name":"谋关羽","range":4,"skills":[{"name":"威临","effect":"每回合限一次，你可以将一张牌当【酒】或任意【杀】使用，此牌目标角色与此牌颜色相同的手牌视为【杀】直到回合结束。"}]},
  {"name":"韩遂","range":4,"skills":[{"name":"骁袭","effect":"每轮首个回合开始时，你可以视为使用一张无距离限制的【杀】。"},{"name":"逆乱","effect":"体力值大于你的角色的结束阶段，若其此回合使用过【杀】，你可以将一张黑色牌当【杀】对其使用。"}]},
  {"name":"族荀粲","range":3,"skills":[{"name":"熨身","effect":"出牌阶段限一次，你可以令一名其他角色回复1点体力并视为你对其或其对你使用一张冰【杀】。"}]},
  {"name":"雅丹","range":4,"skills":[{"name":"倾轧","effect":"当你使用【杀】指定唯一目标后，你可以弃置你与其之间的角色各一张手牌，然后可以于本回合下个阶段结束时使用其中一张牌。"}]},
  {"name":"界姜维","range":4,"skills":[{"name":"挑衅","effect":"出牌阶段限一次，你可以选择一名攻击范围内包含你的角色，然后除非其对你使用一张【杀】且此【杀】对你造成伤害，否则你弃置其一张牌，然后本阶段本技能限两次。"}]},
  {"name":"刘备","range":4,"blank":true},
  {"name":"孙权","range":4,"blank":true},
  {"name":"曹操","range":4,"blank":true},
  {"name":"甘宁","range":4,"blank":true},
  {"name":"黄盖","range":4,"blank":true},
  {"name":"张辽","range":4,"blank":true},
  {"name":"夏侯惇","range":4,"blank":true},
  {"name":"司马懿","range":3,"blank":true},
  {"name":"陆逊","range":3,"blank":true},
  {"name":"周瑜","range":3,"blank":true},
  {"name":"黄月英","range":3,"blank":true},
  {"name":"貂蝉","range":3,"blank":true},
];
// 从池中抽 n 张(默认5):无放回;同一互斥组(ex)至多出一张。rng 注入以便 sim 复现。
export function rollQiexie(rng = Math.random, n = 5) {
  const cand = DIANWEI_POOL.map((_, i) => i);
  const out = [], usedEx = new Set();
  while (out.length < n && cand.length) {
    const idx = cand.splice(Math.floor(rng() * cand.length), 1)[0];
    const p = DIANWEI_POOL[idx];
    if (p.ex && usedEx.has(p.ex)) continue; // 互斥组已出过 → 跳过
    if (p.ex) usedEx.add(p.ex);
    out.push(p);
  }
  return out;
}

// 徐荣【凶镬】暴戾三选一效果(收到暴戾的角色其出牌阶段开始随机执行一项;全公开)
export const XURONG_EFFECTS = [
  { n: "灼伤", d: "受到1点火焰伤害，且本回合不能使用【杀】指定徐荣为目标。" },
  { n: "损元", d: "失去1点体力，且本回合手牌上限-1。" },
  { n: "劫掠", d: "徐荣随机获得其一张手牌和一张装备区里的牌。" },
];

// ---------- 裴秀【十六州地图】(全公开生成器)----------
// ⚠ 数据源 = prototype/shared/peixiu-maps.json(canonical);此处内联供 sim+worker 用(无法跨包 import)。
//   同一份数据另内联于 tools/peixiu.html(单人版)与 client/room.html(画棋盘)。三处若改务必同步 peixiu-maps.json。
// 坐标 [x,y],[0,0]=左下角,x→右 / y→上。图标:draw:N 摸牌 · heal:N 回体力 · move:<dir>:N 到达即自动移N格停留(dir=down/left)。
export const PEIXIU_MAPS = {
  "并州":{pinyin:"Bing",grid:{w:5,h:5},start:[3,0],walls:[[0,4],[1,4],[2,4],[4,4],[0,3],[1,3],[0,2],[4,2],[0,1],[0,0],[1,0],[2,0],[4,0]],cities:[{no:1,name:"雁门",pos:[3,4],icon:"move:down:2",skill:"你从牌堆中获得一张武器牌和一张进攻坐骑牌。"},{no:2,name:"九原",pos:[2,2],icon:"draw:1",skill:"你使用【杀】可以额外指定任意名目标。"},{no:3,name:"祁县",pos:[1,1],icon:"draw:1",skill:"你可以重铸一张装备牌，视为使用一张【杀】或【过河拆桥】（每回合限一次）。"},{no:4,name:"武乡",pos:[4,1],icon:"draw:1",skill:"你从牌堆中获得一张【火攻】。"}],stateSkill:"你可以视为使用一张【决斗】。"},
  "冀州":{pinyin:"Ji",grid:{w:5,h:5},start:[2,2],walls:[[0,4],[1,4],[2,4],[3,4],[4,4],[0,3],[4,3],[4,2],[0,1],[0,0],[1,0],[3,0],[4,0]],cities:[{no:1,name:"常山",pos:[0,2],icon:"draw:1",skill:"你从牌堆中获得两张【闪】。"},{no:2,name:"渤海",pos:[3,3],icon:"draw:2",skill:"你可以弃置一张武器牌，然后摸两张牌。"},{no:3,name:"平原",pos:[3,1],icon:"heal:1",skill:"你失去最后的手牌后，你摸一张牌（每回合限一次）。"},{no:4,name:"巨鹿",pos:[1,1],icon:"move:up:1",skill:"你失去黑桃2~9的牌后，你摸一张牌（每回合限一次）。"}],stateSkill:"你从牌堆获得一张【万箭齐发】。"},
  "荆州":{pinyin:"Jing",grid:{w:5,h:5},start:[2,2],walls:[[0,4],[1,4],[2,4],[3,4],[4,4],[4,3],[4,2],[0,1],[0,0],[1,0],[2,0],[3,0],[4,0]],cities:[{no:1,name:"江夏",pos:[4,1],icon:"draw:1",skill:"你可以令一名其他角色摸两张牌，然后交给你一张牌。"},{no:2,name:"襄阳",pos:[1,1],icon:"move:up:1",skill:"你可以移动场上一张牌。"},{no:3,name:"上庸",pos:[0,2],icon:"draw:2",skill:"你可以与一名其他角色各摸一张牌。"},{no:4,name:"南阳",pos:[3,3],icon:"heal:1",skill:"你可以重铸一张锦囊牌，与一名角色各回复1点体力。"}],stateSkill:"你可以交给一名角色任意张手牌。"},
  "凉州":{pinyin:"Liang",grid:{w:5,h:5},start:[4,0],walls:[[3,4],[4,4],[2,3],[3,3],[4,3],[0,2],[4,2],[0,1],[2,1],[0,0],[2,0],[3,0]],cities:[{no:1,name:"武威",pos:[3,2],icon:"draw:2",skill:"你使用伤害牌可以额外指定一个目标（每回合限一次）。"},{no:2,name:"玉门",pos:[1,2],icon:"move:up:2",skill:"已连环的角色不能响应你的牌。"},{no:3,name:"居延",pos:[2,4],icon:"move:left:1",skill:"你从牌堆中获得三张攻击范围各不相同的武器牌。"},{no:4,name:"敦煌",pos:[0,3],icon:"draw:3",skill:"你的【杀】被抵消后，你摸一张牌。"}],stateSkill:"你可以将一张黑色牌当【杀】使用。"},
  "梁州":{pinyin:"Liang",grid:{w:5,h:5},start:[2,2],walls:[[0,4],[1,4],[4,4],[0,3],[4,3],[0,2],[4,2],[0,1],[1,1],[0,0],[1,0],[2,0],[4,0]],cities:[{no:1,name:"绵竹",pos:[1,2],icon:"heal:1",skill:"结束阶段，你观看牌堆顶三张牌，然后可以获得其中类型不同的牌各一张。"},{no:2,name:"巴西",pos:[2,3],icon:"draw:1",skill:"你可以指定一名其他角色，其当前手牌无次数限制。"},{no:3,name:"汉中",pos:[3,4],icon:"move:down:3",skill:"你可以与一名其他角色交换手牌。"},{no:4,name:"涪陵",pos:[4,1],icon:"draw:2",skill:"你的装备牌不能被其他角色弃置。"}],stateSkill:"你成为【杀】的目标后，使用者弃置一张牌。"},
  "宁州":{pinyin:"Ning",grid:{w:5,h:5},start:[0,3],walls:[[0,4],[1,4],[2,4],[3,4],[4,4],[1,3],[2,3],[3,3],[4,3],[3,2],[4,2],[0,0],[4,0]],cities:[{no:1,name:"哀牢",pos:[0,1],icon:"draw:3",skill:"你可以令一名角色选择：其弃置两张牌，或其失去1点体力。"},{no:2,name:"句町",pos:[3,1],icon:"move:left:2",skill:"你可以失去1点体力，然后摸三张牌。"},{no:3,name:"滇池",pos:[2,2],icon:"heal:1",skill:"一名角色受到火焰伤害后，你可以令其失去1点体力（每回合限一次）。"},{no:4,name:"南涪",pos:[1,0],icon:"heal:1",skill:"你可以失去1点体力，视为使用一张【杀】。"}],stateSkill:"你使用的【杀】不能被抵消，且造成的伤害均视为体力流失。"},
  "秦州":{pinyin:"Qin",grid:{w:5,h:5},start:[2,2],walls:[[0,4],[2,4],[3,4],[4,4],[0,3],[3,3],[4,3],[0,2],[0,1],[1,1],[0,0],[3,0],[4,0]],cities:[{no:1,name:"陇西",pos:[1,2],icon:"move:right:1",skill:"你从牌堆中获得一张防御坐骑牌。"},{no:2,name:"天水",pos:[3,2],icon:"draw:1",skill:"你可以弃置一名角色一张手牌，若不为【杀】，你摸两张牌。"},{no:3,name:"武都",pos:[4,1],icon:"heal:1",skill:"你使用牌无次数限制。"},{no:4,name:"阴平",pos:[1,0],icon:"draw:2",skill:"其他角色计算与你的距离+1。"}],stateSkill:"你可选择一名其他角色，其使用的下一张牌对你无效。"},
  "青州":{pinyin:"Qing",grid:{w:5,h:5},start:[1,1],walls:[[0,4],[1,4],[2,4],[4,4],[2,3],[4,2],[0,1],[3,1],[4,1],[0,0],[2,0],[3,0],[4,0]],cities:[{no:1,name:"北海",pos:[2,1],icon:"move:up:1",skill:"你将手牌摸至体力上限。"},{no:2,name:"临淄",pos:[1,2],icon:"draw:1",skill:"你获得弃牌堆中三张随机的梅花牌。"},{no:3,name:"乐安",pos:[0,3],icon:"draw:2",skill:"你从牌堆获得一张属性【杀】和一张【铁索连环】。"},{no:4,name:"东莱",pos:[3,3],icon:"draw:2",skill:"你可令一名角色使用的下一张牌无次数和距离限制。"}],stateSkill:"你可以弃置所有手牌，然后摸等量的牌。"},
  "司州":{pinyin:"Si",grid:{w:5,h:5},start:[2,2],walls:[[0,4],[1,4],[2,4],[3,4],[4,4],[0,3],[2,3],[0,2],[4,2],[3,1],[4,1],[3,0],[4,0]],cities:[{no:1,name:"温县",pos:[2,0],icon:"move:left:1",skill:"你加1点体力上限并回复1点体力，然后获得一张【虚妄之冕】。"},{no:2,name:"弘农",pos:[1,1],icon:"draw:1",skill:"你可以重铸任意张装备牌并回复1点体力。"},{no:3,name:"闻喜",pos:[1,3],icon:"move:down:1",skill:"你每回合首次使用一个花色的牌后，你摸一张牌。"},{no:4,name:"邯郸",pos:[4,3],icon:"draw:2",skill:"你使用一张非伤害普通锦囊牌后，你令一名角色获得此牌（每回合限一次）。"}],stateSkill:"你可以获得一名角色一张手牌。"},
  "徐州":{pinyin:"Xu",grid:{w:5,h:5},start:[2,2],walls:[[0,4],[1,4],[3,4],[4,4],[0,3],[1,3],[3,3],[4,3],[3,2],[4,2],[0,1],[4,1],[0,0]],cities:[{no:1,name:"彭城",pos:[0,2],icon:"draw:2",skill:"你可以令一名其他角色交给你一张牌，然后其回复1点体力。"},{no:2,name:"琅琊",pos:[2,3],icon:"draw:1",skill:"你观看牌堆顶的五张牌，然后以任意顺序置于牌堆顶或牌堆底。"},{no:3,name:"广陵",pos:[2,0],icon:"move:right:1",skill:"你可以将两张牌当一张【五谷丰登】使用。"},{no:4,name:"东海",pos:[3,1],icon:"heal:1",skill:"你令一名角色下个摸牌阶段多摸一张牌。"}],stateSkill:"你可以指定一名其他角色，其于其的回合外使用牌后摸一张牌。"},
  "兖州":{pinyin:"Yan",grid:{w:5,h:5},start:[2,1],walls:[[0,4],[1,4],[2,4],[3,4],[4,4],[0,3],[1,3],[2,3],[4,3],[0,2],[4,2],[4,1],[4,0]],cities:[{no:1,name:"泰山",pos:[3,3],icon:"move:down:3",skill:"将一张【螭纹玉佩】置入手牌。"},{no:2,name:"任城",pos:[2,0],icon:"heal:1",skill:"你每有一张【杀】，手牌上限便+1。"},{no:3,name:"陈留",pos:[0,0],icon:"move:right:1",skill:"你跳过弃牌阶段。"},{no:4,name:"鄄城",pos:[1,2],icon:"draw:2",skill:"你判定，若为黑色，你获得判定牌并重复此流程。"}],stateSkill:"你回复体力后，你摸一张牌（每回合限一次）。"},
  "扬州":{pinyin:"Yang",grid:{w:5,h:5},start:[3,2],walls:[[0,4],[1,4],[2,4],[3,4],[4,4],[0,3],[1,3],[4,3],[0,2],[0,1],[0,0],[3,0],[4,0]],cities:[{no:1,name:"庐江",pos:[1,0],icon:"move:up:1",skill:"你可以拼点，赢的角色摸两张牌。"},{no:2,name:"合肥",pos:[2,1],icon:"draw:4",skill:"你可以弃置至多两张牌，然后摸等量的牌。"},{no:3,name:"居巢",pos:[4,1],icon:"move:left:1",skill:"你可以弃置你与一名角色各一张牌。"},{no:4,name:"寿春",pos:[2,3],icon:"heal:1",skill:"你可令一名角色加1点体力上限。"}],stateSkill:"你可以令一名其他角色回复1点体力。"},
  "益州":{pinyin:"Yi",grid:{w:5,h:5},start:[3,2],walls:[[0,4],[1,4],[3,4],[4,4],[0,3],[1,3],[3,3],[4,3],[0,2],[4,2],[0,1],[0,0],[1,0]],cities:[{no:1,name:"临邛",pos:[1,1],icon:"heal:2",skill:"你可以令任意名角色同时弃置一张牌。"},{no:2,name:"牂牁",pos:[4,1],icon:"draw:1",skill:"你受到伤害后，你可以弃置你与伤害来源各一张牌。"},{no:3,name:"朱提",pos:[2,0],icon:"draw:1",skill:"你受到属性伤害改为回复等量体力（每回合限一次）。"},{no:4,name:"成都",pos:[2,3],icon:"move:down:2",skill:"你对自己使用牌后，你摸一张牌（每回合限一次）。"}],stateSkill:"你不能成为延时锦囊牌的目标。"},
  "雍州":{pinyin:"Yong",grid:{w:5,h:5},start:[2,1],walls:[[1,4],[2,4],[3,4],[4,4],[2,3],[3,3],[4,3],[0,2],[2,2],[0,1],[4,1],[0,0],[4,0]],cities:[{no:1,name:"冯翊",pos:[4,2],icon:"draw:2",skill:"你可以回复1点体力。"},{no:2,name:"京兆",pos:[3,0],icon:"move:left:2",skill:"若有角色本回合对你使用过：【杀】/伤害锦囊牌，伤害锦囊牌/【杀】对你无效。"},{no:3,name:"扶风",pos:[1,1],icon:"draw:1",skill:"你从牌堆获得一张你手牌中未拥有类型的牌。"},{no:4,name:"安定",pos:[1,3],icon:"heal:1",skill:"防止你因传导受到的属性伤害。"}],stateSkill:"你可以摸两张牌，然后将手牌弃至手牌上限。"},
  "幽州":{pinyin:"You",grid:{w:5,h:5},start:[0,0],walls:[[0,4],[1,4],[2,4],[4,4],[0,3],[1,3],[2,3],[4,3],[0,2],[4,2],[2,1],[2,0],[3,0]],cities:[{no:1,name:"范阳",pos:[1,0],icon:"draw:1",skill:"你可以对攻击范围内的一名角色造成1点伤害。"},{no:2,name:"北平",pos:[1,2],icon:"draw:1",skill:"你从牌堆中获得两张【杀】。"},{no:3,name:"玄菟",pos:[3,4],icon:"draw:1",skill:"有角色进入濒死状态时，你获得使其进入此濒死状态的牌（每回合限一次）。"},{no:4,name:"带方",pos:[4,0],icon:"draw:2",skill:"你的属性【杀】不能被响应。"}],stateSkill:"你加1点体力上限。"},
  "豫州":{pinyin:"Yu",grid:{w:5,h:5},start:[2,2],walls:[[0,4],[1,4],[2,4],[3,4],[4,4],[4,3],[0,1],[3,1],[4,1],[0,0],[2,0],[3,0],[4,0]],cities:[{no:1,name:"汝南",pos:[1,1],icon:"move:up:3",skill:"你可以令一名角色摸等同于你手牌上限的牌。"},{no:2,name:"许昌",pos:[0,3],icon:"move:right:1",skill:"你可令一名其他角色攻击范围增加至与你相同。"},{no:3,name:"沛县",pos:[2,3],icon:"draw:1",skill:"你的普通锦囊牌不能被响应。"},{no:4,name:"谯县",pos:[3,2],icon:"draw:2",skill:"你受到伤害后，可以摸一张牌。"}],stateSkill:"你可以进入连环状态，令一名体力值小于你的角色回复1点体力。"}
};
export const PEIXIU_NAMES = Object.keys(PEIXIU_MAPS);
const PX_DIRV = { N:[0,1], S:[0,-1], E:[1,0], W:[-1,0] };       // 花色方向:♦北 ♣南 ♠东 ♥西
const PX_MVDIR = { up:[0,1], down:[0,-1], left:[-1,0], right:[1,0] };
export const PX_DIRNAME = { N:"♦北", S:"♣南", E:"♠东", W:"♥西" };
function pxEq(a,b){ return !!a&&!!b&&a[0]===b[0]&&a[1]===b[1]; }
function pxInB(m,p){ return p[0]>=0&&p[0]<m.grid.w&&p[1]>=0&&p[1]<m.grid.h; }
function pxIsWall(m,p){ return m.walls.some(w=>w[0]===p[0]&&w[1]===p[1]); }
function pxCityAt(m,p){ return m.cities.find(c=>c.pos[0]===p[0]&&c.pos[1]===p[1]); }
export function pxParseIcon(icon){ const a=String(icon).split(":"); if(a[0]==="move") return {t:"move",dir:a[1],n:+a[2]}; return {t:a[0],n:+a[1]}; }
// 尽览推箱子:从 start 沿 dir【先一路滑到墙/边界】,经"未画过"的城即触发(draw/heal 即时);
// ⚠ move 图标不在城市当场触发位移——推到墙后,再从墙位置按该 move 城的箭头走 N 格停留(撞新城触发一次)。
//   (用户2026-07-16勘误:如益州成都从[2,2]向北→先到墙[2,4]再向南2→[2,2],而非到成都立即向南。
//    16图已校验:一次滑动至多经过1个 move 城、移动后不落墙、无链式。)
// ⚠ 已画过(visited[no])的城市变为惰性地形:再经过不触发、也不计入 move——完成该图前不重复触发。
// 返回 { path:[[x,y]...], events:[{pos,city}], moved }。纯函数,sim+worker+client 三处等价。
export function pxComputeSlide(m, start, dir, visited){
  visited = visited || {};
  const dv=PX_DIRV[dir]; if(!dv) return { path:[start.slice()], events:[], moved:false };
  const path=[start.slice()], events=[]; let pos=start.slice(); let moveCity=null;
  // 阶段一:沿花色方向推到墙/边界,经未画城即触发(draw/heal 即时);记下经过的 move 城(至多1个)
  while(true){
    const nx=[pos[0]+dv[0], pos[1]+dv[1]];
    if(!pxInB(m,nx) || pxIsWall(m,nx)) break;
    pos=nx; path.push(pos.slice());
    const c=pxCityAt(m,pos);
    if(c && !visited[c.no]){
      events.push({pos:pos.slice(), city:c});
      if(pxParseIcon(c.icon).t==="move") moveCity=c; // 位移推迟到墙后
    }
  }
  // 阶段二:到墙后,从墙位置按 move 城箭头走 N 格停留
  if(moveCity){
    const ic=pxParseIcon(moveCity.icon), mv=PX_MVDIR[ic.dir]||[0,0]; let jp=pos.slice();
    for(let i=0;i<ic.n;i++){ const np=[jp[0]+mv[0],jp[1]+mv[1]]; if(!pxInB(m,np)||pxIsWall(m,np)) break; jp=np; path.push(jp.slice()); }
    pos=jp;
    const lc=pxCityAt(m,jp);
    if(lc && lc.no!==moveCity.no && !visited[lc.no]) events.push({pos:jp.slice(), city:lc}); // 撞新城(未画过)触发一次,无链式
  }
  return { path, events, moved: path.length>1 };
}

// ---------- 蒲元【神工锻造库】(全公开生成器)----------
// ⚠ 数据源 = prototype/shared/derived-cards-room.json 蒲元条目(18装备,武器6/防具6/宝物6);此处内联供 sim+worker,
//   同一份另内联于 tools/puyuan.html(单人版)。改动务必同步两处。
export const PUYUAN_FORGE = {
"武器":[
  {name:"无双方天戟",suit:"方块",point:"Q",range:4,text:"当你使用【杀】造成伤害后，你可以摸一张牌或弃置目标一张牌。"},
  {name:"鬼龙斩月刀",suit:"黑桃",point:"5",range:3,text:"锁定技，你使用红色【杀】不能被【闪】响应。"},
  {name:"赤血青锋",suit:"黑桃",point:"6",range:2,text:"锁定技，当你使用【杀】指定一名角色为目标后，令其不能使用或打出手牌且防具无效直到此【杀】结算结束。"},
  {name:"镔铁双戟",suit:"方块",point:"K",range:3,text:"当你使用的【杀】被目标角色使用的【闪】抵消后，你可以失去1点体力，获得此【杀】并摸一张牌，然后你本回合使用【杀】的次数上限+1。"},
  {name:"乌铁锁链",suit:"黑桃",point:"K",range:3,text:"你使用【杀】指定目标后，若目标未横置，你可以令其横置。"},
  {name:"五行鹤翎扇",suit:"方块",point:"A",range:4,text:"你可以将一张属性【杀】当其他属性【杀】使用。"}
],
"防具":[
  {name:"玲珑狮蛮带",suit:"黑桃",point:"2",text:"当你成为单一目标牌的目标后，你可以判定，若结果为红桃，取消之。"},
  {name:"红锦百花袍",suit:"梅花",point:"A",text:"锁定技，防止你受到的属性伤害。"},
  {name:"国风玉袍",suit:"黑桃",point:"9",text:"锁定技，你不能成为普通锦囊牌的目标。"},
  {name:"奇门八卦",suit:"黑桃",point:"2",text:"锁定技，【杀】对你无效。"},
  {name:"护心镜",suit:"梅花",point:"A",text:"当你受到伤害时，若此伤害会令你进入濒死状态，或伤害值大于1，你可以将此牌置入弃牌堆并防止此伤害。"},
  {name:"黑光铠",suit:"梅花",point:"2",text:"锁定技，当你成为【杀】或普通锦囊牌的目标后，若你不是此牌的唯一目标，此牌对你无效。"}
],
"宝物":[
  {name:"束发紫金冠",suit:"方块",point:"A",text:"准备阶段，你可以对一名其他角色造成1点伤害。"},
  {name:"虚妄之冕",suit:"梅花",point:"4",text:"锁定技，摸牌阶段你多摸两张牌，你的手牌上限-1。"},
  {name:"三略",suit:"黑桃",point:"5",text:"锁定技，①你的攻击范围+1；②你的手牌上限+1；③你于出牌阶段使用【杀】的次数上限+1。"},
  {name:"照骨镜",suit:"方块",point:"A",text:"出牌阶段结束时，你可以展示一张基本牌或普通锦囊牌并视为使用之。"},
  {name:"天机图",suit:"梅花",point:"Q",text:"锁定技，①当此牌进入你的装备区时，你弃置一张不为【天机图】的牌；②当你失去装备区里的【天机图】时，你将手牌摸至五张。"},
  {name:"太公阴符",suit:"黑桃",point:"2",text:"①出牌阶段开始时，你可以选择一项：1.横置一名角色；2.重置一名角色；②出牌阶段结束时，你可以重铸一张手牌。"}
]
};
export const PUYUAN_CATS = ["武器", "防具", "宝物"];

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
  dongzhao: {
    // 先略记录的锦囊牌名仅董昭本人可见(暗置,不弱于单机现状);他人只见 {count:0|1}=有无记录
    rec: { kind: "ownerSeatOnly" },
    // turnUsed / zw / round / shunji / names / yishi / log 默认 public(顺机账本、造王、移势皆公开信息)
  },
  guozhao: {
    // 内训牌 = 郭照手牌里的标记牌:花色/点数/牌名仅郭照本人/代持可见,他人只见张数(桌上可数)
    neixun: { kind: "ownerSeatOnly" },
    // color / seq / log 默认 public(椒遇声明色是全场信息;log 只记张数不记牌名)
  },
  sunquan: {
    // 权御暗选:每份 pick 自带 revealed;翻开前仅本人可见内容,他人只见"该座位已选"占位(含孙权的也藏)
    picks: { kind: "secretPick" },
    // round / dead / used / phase / lastReveal / te / gg / dmgThisRound / log 默认 public
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
    // secretPick:键值对象 { [座位]: {holder,effect,revealed} }。翻开前仅本人(或代持)可见内容,
    // 他人只见 {holder,hidden} —— 能知道"该座位已选",数得出进度,但看不到选了什么(孙权的也一样藏)。
    if (rule.kind === "secretPick") {
      const out2 = {};
      for (const [s, pk] of Object.entries(val || {}))
        out2[s] = (pk.revealed || holds.has(Number(s))) ? clone(pk) : { holder: pk.holder, hidden: true };
      out[field] = out2;
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
  if (generalId === "guozhao")
    return {
      color: null,     // 椒遇本轮声明色 'black'|'red'|null(公开)
      neixun: [],      // 内训标记牌 [{id,s,r,n}]花色/点数/牌名(ownerSeatOnly:他人只见张数;离手/回合末消散)
      seq: 0,          // 内训牌 id 自增(不依赖时间戳,worker/sim 一致)
      log: [],         // 公开事件(只记张数,不记牌名)
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
  if (generalId === "dongzhao")
    return {
      rec: [],          // 先略:0或1个牌名(ownerSeatOnly→他人只见 count;暗置)
      turnUsed: false,  // 先略本回合已触发(每回合限一次,公开)
      zw: false,        // 造王已发动(限定技,公开)
      round: 1,         // 顺机轮次(公开)
      shunji: [],       // 顺机:本轮已发动过的【房间座位号】(公开;自带花名册绑房间座位环)
      names: [],        // 顺机:已触发伤害的牌名(每名限一次,公开)
      yishi: null,      // 移势花色提醒 'S'|'H'|'C'|'D'|null(公开)
      log: [],          // 公开事件(先略只记"记录了一张",不含牌名)
    };
  if (generalId === "shensunquan")
    return {
      maxHp: 4,          // 体力上限(公开)
      temp: [],          // [{id,name,text}] 驭衡当回合临时技能(客户端 roll 后送解析结果;公开)
      perm: [],          // [{id,name,text}] 驭衡失去后固化的本局永久技能(公开)
      custom: [],        // [{id,name,note}] 外来获得的技能(公开)
      hasYuheng: true,   // 是否仍有驭衡(觉醒可失去;公开)
      awakened: false,   // 帝力是否已觉醒(公开)
      gained: [],        // ['shengzhi'|'quandao'|'chigang'] 觉醒获得前 N 个(公开;客户端有全文)
      chigangYang: true, // 持纲阴阳(转换技翻面;公开)
      preAwaken: null,   // 觉醒前快照(误触回滚用;公开无妨)
      seq: 0,            // 外来技能 id 自增(worker/sim 一致,不用时间戳)
      log: [],           // 公开事件
    };
  if (generalId === "diaochan")
    return {
      entered: false,       // 倾世入魔(公开)
      round: 1,             // 轮次(公开)
      dmgThisRound: false,  // 本轮貂蝉是否已造成伤害(公开)
      dead: [],             // 已阵亡的房间座位号(工具内追踪,room 不建模死亡;公开)
      hh: { targets: [], wiz: {} }, // 幻惑:本轮目标座位号 + 各目标向导 {uses,stage,n,roll}(公开)
      qs: { batch: 0, cards: [] },  // 倾世牌台账 cards=[{owner:座位,typ,custom,s,r,status}](公开)
      log: [],              // 公开事件
    };
  if (generalId === "sunquan")
    return {
      round: 1,
      dead: [],            // 已阵亡座位号(工具内追踪;公开)
      used: {},            // { [座位]: [ei...] } 每座位已用权御效果下标(替代 Set;公开)
      phase: "idle",       // idle | picking | revealed(公开)
      picks: {},           // { [座位]: {holder,effect,revealed} } 权御暗选(secretPick:翻开前仅本人可见内容)
      lastReveal: null,    // {round,entries:[[座位,ei]],sqPick,match,draw}(reveal 后填,公开)
      te: { diff: false, same: false }, // 天恩本回合两项(公开)
      teNote: "",          // 天恩·不同项备注(公开)
      tePending: null,     // 天恩·不同项待选:{target}(孙权发起后,由目标本人在其UI选剑;公开)
      gg: false,           // 乾纲入魔(公开)
      dmgThisRound: false, // 入魔本轮是否已造成伤害(公开)
      log: [],
    };
  if (generalId === "dianwei")
    return {
      slots: 2,      // 武器栏数(捐甲:废防具栏 + 1 额外武器栏 = 2)
      round: 1,
      rolled: null,  // 本次挈挟抽出的 5 张(公开),或 null=未抽
      weapons: [],   // 已装备的武器(从 rolled 里选,≤slots;公开)
      log: [],
    };
  if (generalId === "lijue")
    return { round: 1, lastRoll: null, log: [] }; // 狼袭:lastRoll = 最近一次 0~2 掷出的伤害
  if (generalId === "xurong")
    return { marks: 3, pending: {}, lastResolve: null, log: [] }; // marks=徐荣暴戾(0~3);pending={座位:枚数}待结算;lastResolve=最近一次三选一
  if (generalId === "xushi")
    return { longnu: 0, awakened: false, lastRoll: null, log: [] }; // longnu=龙怒(达3可觉醒);awakened=天泣已觉醒;lastRoll=最近龙鳞贝
  if (generalId === "peixiu")
    return {
      cycle: PEIXIU_NAMES.slice(), // 本轮尚未展开的州(无重复循环,16张跑完才 refill)
      active: null,     // 当前棋盘上的州名(null=未展开,点展开开始)
      token: null,      // 裴秀 token 当前格 [x,y]
      visited: {},      // 当前 active 州已走城市 {no:true}
      turnStates: [],   // 本回合展开过的州(池·州技来源)
      turnCities: [],   // 本回合走过的城市(池·城技来源)[{map,no,name,skill}]
      retained: null,   // 上回合结束保留的技能 {pt,skill}(持续到本回合结束)
      endChoices: null, // 结束阶段随机三选一候选 [{pt,skill}]
      log: [],          // 公开事件
    };
  if (generalId === "puyuan")
    return {
      cat: null,       // 当前选的副类别 武器/防具/宝物
      result: null,    // {label,n,short} 本次锻造结果
      rolled: [],      // 本次 roll 出的候选装备
      rollId: 0,       // roll 计数(换选/销毁定位)
      picked: null,    // 本次 roll 已选定的下标
      active: [],       // 锻造中(未销毁)的装备 [{id,cat,result,card,roll}],占用库存,roll 时排除
      fid: 0,          // active id 自增
      vote: null,      // 助力/妨害征集(房间投票):{cat,entries:{座位:{choice,point}},settled,helpSum,hinderSum};null=手动模式
      log: [],
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
      this.seats[i] = { seatNo: i, general: null, chosenFaction: null, holderDevices: [], toolState: {},
        // 全场状态面板(全公开,任意设备可改任意座位):血量/翻面/横置/连环/阵亡。hp/hpMax=null 表示未播种(登记武将后由客户端按体力上限播种)
        hp: null, hpMax: null, flipped: false, tapped: false, chained: false, dead: false };
    this.devices = {};
  }

  connect(id) { if (!this.devices[id]) this.devices[id] = { holds: new Set() }; }
  claimSeat(id, n) {
    n = Number(n); // 座位号统一转数字,holds 与 setGeneral 比对不会因字符串/数字不一致而 NOT_HOLDER
    const s = this.seats[n];
    // 座位独占:已被别的设备持有则拒绝(需显式 takeoverSeat 替换),避免两台设备同坐一座位
    if (s && s.holderDevices.length && !s.holderDevices.includes(id))
      return { error: "SEAT_TAKEN", by: s.holderDevices[0] };
    this.connect(id); this.devices[id].holds.add(n);
    if (s) s.holderDevices = [id]; // 单一持有者
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
  setGeneral(id, n, g) {
    n = Number(n);
    if (!this.devices[id]?.holds.has(n)) return { error: "NOT_HOLDER" };
    this.seats[n].general = g; this.seats[n].toolState = initToolState(g);
    this.seats[n].chosenFaction = null; // 改武将→清掉旧的自选势力(神将换将或换成非神将都该重置)
    // 换武将→重置全场面板状态。血量置 null,由客户端按新武将体力上限重新播种(panelSetHpMax)
    const ps = this.seats[n];
    ps.hp = null; ps.hpMax = null; ps.flipped = false; ps.tapped = false; ps.chained = false; ps.dead = false;
    return { ok: true };
  }
  // 神将自选势力(公开;RoomCore 不判是否神将,客户端只对 factionSelectable 的武将露出选择器)
  setFaction(id, n, faction) {
    n = Number(n);
    if (!this.devices[id]?.holds.has(n)) return { error: "NOT_HOLDER" };
    const ok = faction == null || ["魏", "蜀", "吴", "群"].includes(faction);
    if (!ok) return { error: "BAD_FACTION" };
    this.seats[n].chosenFaction = faction ?? null;
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

    // ───────── 全场状态面板(全公开,任意设备可改任意座位,无 holder 守卫)。与武将无关,置于工具分发之前 ─────────
    if (t === "panelSetHpMax" || t === "panelSetHp" || t === "panelToggle" || t === "panelSetDead") {
      const clampInt = (v, lo, hi) => { v = Math.round(Number(v)); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : lo; };
      if (t === "panelSetHpMax") { // 播种/调体力上限:hp 首次播种=上限;调低上限时夹住当前血
        const m = clampInt(toolAction.hp, 1, 20);
        target.hpMax = m;
        target.hp = (target.hp == null) ? m : Math.min(target.hp, m);
        return { ok: true };
      }
      if (t === "panelSetHp") { // 绝对置数当前血(0..上限;未播种上限时按请求值 0..20)
        const hi = target.hpMax ?? 20;
        target.hp = clampInt(toolAction.hp, 0, hi);
        return { ok: true };
      }
      if (t === "panelToggle") { // 翻面/横置/连环 布尔切换
        const f = toolAction.flag;
        if (f !== "flipped" && f !== "tapped" && f !== "chained") return { error: "BAD_FLAG" };
        target[f] = !target[f];
        return { ok: true };
      }
      if (t === "panelSetDead") { target.dead = !!toolAction.dead; return { ok: true }; } // 阵亡/复生(手动确认)
    }

    // ───────── 神典韦:挈挟 roll 池(全公开生成器)。抽 5 在 DO 跑(可 seed 复现),神典韦选任意张当武器 ─────────
    if (target.general === "dianwei") {
      const dSeat = targetSeat;
      const isDw = bySeat === dSeat && iHold(dSeat); // 神典韦本人(或代持)
      if (t === "qiexie") { // 挈挟:抽 5 张
        if (!isDw) return { error: "NOT_DW_ACTION" };
        ts.rolled = rollQiexie(this.rng);
        this._log(ts, `挈挟抽出:${ts.rolled.map((p) => p.name).join("、")}`);
        return { ok: true };
      }
      if (t === "equipToggle") { // 装备/卸下一张武器。卸下随时可(即便已不在本轮抽牌里);装备须来自本轮抽出的 5 张且未满栏
        if (!isDw) return { error: "NOT_DW_ACTION" };
        const at = ts.weapons.findIndex((w) => w.name === toolAction.name);
        if (at >= 0) { const c = ts.weapons[at]; ts.weapons.splice(at, 1); this._log(ts, `卸下武器【${c.name}】`); return { ok: true }; }
        const card = (ts.rolled || []).find((p) => p.name === toolAction.name);
        if (!card) return { error: "NOT_ROLLED" };
        if (ts.weapons.length >= ts.slots) return { error: "SLOTS_FULL" };
        ts.weapons.push(card); this._log(ts, `装备武器【${card.name}】(范围${card.range})`);
        return { ok: true };
      }
      if (t === "clearWeapons") { if (!isDw) return { error: "NOT_DW_ACTION" }; ts.weapons = []; return { ok: true }; }
      if (t === "newTurn") { // 下一轮准备阶段:清掉本次抽的 5 张(武器保留),轮次+1
        if (!isDw) return { error: "NOT_DW_ACTION" };
        ts.round++; ts.rolled = null; this._log(ts, `进入第${ts.round}轮准备阶段`);
        return { ok: true };
      }
      if (t === "resetGame") { if (!isDw) return { error: "NOT_DW_ACTION" }; target.toolState = initToolState(target.general); return { ok: true, reset: true }; }
      return { error: "UNKNOWN_ACTION" };
    }

    // ───────── 李傕:狼袭(全公开生成器)。掷 0~2 随机伤害,在 DO 跑(可 seed 复现) ─────────
    if (target.general === "lijue") {
      const lSeat = targetSeat;
      const isLi = bySeat === lSeat && iHold(lSeat); // 李傕本人(或代持)
      if (t === "langxi") {
        if (!isLi) return { error: "NOT_LIJUE_ACTION" };
        const dmg = Math.floor(this.rng() * 3); // 0/1/2 等概率
        ts.lastRoll = dmg;
        this._log(ts, `狼袭掷出 ${dmg} 点伤害`);
        return { ok: true, dmg };
      }
      if (t === "newTurn") { if (!isLi) return { error: "NOT_LIJUE_ACTION" }; ts.round++; ts.lastRoll = null; this._log(ts, `进入第${ts.round}轮`); return { ok: true }; }
      if (t === "resetGame") { if (!isLi) return { error: "NOT_LIJUE_ACTION" }; target.toolState = initToolState(target.general); return { ok: true, reset: true }; }
      return { error: "UNKNOWN_ACTION" };
    }

    // ───────── 徐荣:凶镬/杀绝(全公开计数器+生成器)。发暴戾/濒死+1/结算三选一,随机在 DO 跑 ─────────
    if (target.general === "xurong") {
      const xSeat = targetSeat;
      const isXu = bySeat === xSeat && iHold(xSeat); // 徐荣本人(或代持)
      if (t === "gainMark") { // 杀绝:他人濒死,徐荣 +1(上限3)
        if (!isXu) return { error: "NOT_XURONG_ACTION" };
        if (ts.marks >= 3) return { error: "MARK_FULL" };
        ts.marks++; this._log(ts, `杀绝:有角色濒死,徐荣获得1枚暴戾(共${ts.marks})`);
        return { ok: true };
      }
      if (t === "giveMark") { // 凶镬:给一名其他座位 1 枚暴戾
        if (!isXu) return { error: "NOT_XURONG_ACTION" };
        const to = Number(toolAction.toSeat);
        if (to === xSeat || !this.seats[to]) return { error: "BAD_TARGET" };
        if (ts.marks <= 0) return { error: "NO_MARK" };
        ts.marks--; ts.pending[to] = (ts.pending[to] || 0) + 1;
        this._log(ts, `凶镬:给座位${to}一枚暴戾(徐荣对其伤害+1;剩${ts.marks})`);
        return { ok: true };
      }
      if (t === "resolveMark") { // 收到暴戾者其出牌阶段开始:结算三选一(徐荣本人或该座位本人可点)
        const seat = Number(toolAction.seat);
        if (!(ts.pending[seat] > 0)) return { error: "NO_PENDING" };
        if (!isXu && !iHold(seat)) return { error: "NOT_ALLOWED" };
        const ei = Math.floor(this.rng() * XURONG_EFFECTS.length);
        ts.pending[seat]--; if (ts.pending[seat] <= 0) delete ts.pending[seat];
        const eff = XURONG_EFFECTS[ei];
        ts.lastResolve = { seat, i: ei, n: eff.n, d: eff.d }; // 公开:全场显示最近一次结算
        this._log(ts, `座位${seat}结算暴戾 → 【${eff.n}】${eff.d}`);
        return { ok: true, effect: ts.lastResolve };
      }
      if (t === "resetGame") { if (!isXu) return { error: "NOT_XURONG_ACTION" }; target.toolState = initToolState(target.general); return { ok: true, reset: true }; }
      return { error: "UNKNOWN_ACTION" };
    }

    // ───────── 徐氏:龙鳞贝(全公开生成器)。投 2 枚阴/阳定贝、自动加龙怒、天泣觉醒开关 ─────────
    if (target.general === "xushi") {
      const sSeat = targetSeat;
      const isXs = bySeat === sSeat && iHold(sSeat); // 徐氏本人(或代持)
      if (t === "rollBei") { // 投龙鳞贝:2 枚各随机阴/阳
        if (!isXs) return { error: "NOT_XUSHI_ACTION" };
        const a = this.rng() < 0.5 ? "阳" : "阴";
        const b = this.rng() < 0.5 ? "阳" : "阴";
        const yang = (a === "阳" ? 1 : 0) + (b === "阳" ? 1 : 0);
        let bei, gain, effect;
        if (yang === 1) { bei = "圣贝"; gain = 0; effect = "一阴一阳:执行两次所选效果"; }
        else if (yang === 2) { bei = "阳贝"; gain = 1; effect = "双阳:执行所选效果,获得1枚龙怒"; }
        else { bei = "阴贝"; gain = 2; effect = "双阴:不执行所选效果,获得2枚龙怒"; }
        ts.longnu += gain;
        ts.lastRoll = { coins: [a, b], bei, gain, effect };
        this._log(ts, `龙鳞贝【${bei}】(${a}${b})→ ${effect};龙怒${ts.longnu}`);
        return { ok: true, roll: ts.lastRoll };
      }
      if (t === "adjustNu") { // 手动增减龙怒(守心移去1、修正等)
        if (!isXs) return { error: "NOT_XUSHI_ACTION" };
        const d = Number(toolAction.delta) || 0;
        ts.longnu = Math.max(0, ts.longnu + d);
        this._log(ts, `龙怒 ${d > 0 ? "+" : ""}${d} → ${ts.longnu}`);
        return { ok: true };
      }
      if (t === "toggleAwaken") { // 天泣觉醒开关
        if (!isXs) return { error: "NOT_XUSHI_ACTION" };
        ts.awakened = !ts.awakened;
        this._log(ts, ts.awakened ? "天泣觉醒:减1体力上限回满、获得守心、对所有男性1雷伤" : "撤销天泣觉醒");
        return { ok: true, awakened: ts.awakened };
      }
      if (t === "resetGame") { if (!isXs) return { error: "NOT_XUSHI_ACTION" }; target.toolState = initToolState(target.general); return { ok: true, reset: true }; }
      return { error: "UNKNOWN_ACTION" };
    }

    // ───────── 裴秀:十六州地图(全公开生成器)。展开=随机在 DO 跑(可 seed);尽览走位=纯逻辑;结束阶段三选一随机在 DO ─────────
    if (target.general === "peixiu") {
      const pSeat = targetSeat;
      const isPx = bySeat === pSeat && iHold(pSeat); // 裴秀本人(或代持)
      const expand = (name) => { // 展开一幅地图:入池州技 + 重置走位 + 从无重复循环移除
        const m = PEIXIU_MAPS[name];
        ts.active = name; ts.token = m.start.slice(); ts.visited = {};
        if (!ts.turnStates.includes(name)) ts.turnStates.push(name);
        ts.cycle = ts.cycle.filter((x) => x !== name); if (!ts.cycle.length) ts.cycle = PEIXIU_NAMES.slice();
        this._log(ts, `展开【${name}】(州技入池)`);
      };
      if (t === "pxExpand") { // 展开地图:指定 map=手动,否则随机(DO 从 cycle 抽,可 seed 复现)
        if (!isPx) return { error: "NOT_PX_ACTION" };
        let name = toolAction.map;
        if (!name || !PEIXIU_MAPS[name]) { const pool = ts.cycle.length ? ts.cycle : PEIXIU_NAMES; name = pool[Math.floor(this.rng() * pool.length)]; }
        expand(name);
        return { ok: true, map: name };
      }
      if (t === "pxGo") { // 尽览:沿花色方向推箱子走位,经城即结算(摸/回/移)
        if (!isPx) return { error: "NOT_PX_ACTION" };
        if (!ts.active) return { error: "NO_MAP" };
        const m = PEIXIU_MAPS[ts.active];
        const res = pxComputeSlide(m, ts.token, toolAction.dir, ts.visited); // 已画过的城市滑过不触发
        if (!res.moved) return { error: "BLOCKED" }; // 贴墙/边界
        const effs = [];
        for (const ev of res.events) {
          const c = ev.city, ic = pxParseIcon(c.icon);
          if (!ts.visited[c.no]) {
            ts.visited[c.no] = true;
            if (!ts.turnCities.some((x) => x.map === ts.active && x.no === c.no))
              ts.turnCities.push({ map: ts.active, no: c.no, name: c.name, skill: c.skill });
          }
          effs.push(c.name + "(" + (ic.t === "draw" ? "摸" + ic.n : ic.t === "heal" ? "回" + ic.n : "移动" + ic.n) + ")");
        }
        ts.token = res.path[res.path.length - 1].slice();
        this._log(ts, `${PX_DIRNAME[toolAction.dir]}尽览:${effs.length ? effs.join(" / ") : "空过"},停 [${ts.token}]`);
        return { ok: true, token: ts.token, effs };
      }
      if (t === "pxResetToken") { // 回起点(不清已走/池)
        if (!isPx) return { error: "NOT_PX_ACTION" };
        if (!ts.active) return { error: "NO_MAP" };
        ts.token = PEIXIU_MAPS[ts.active].start.slice();
        return { ok: true };
      }
      if (t === "pxEndPhase") { // 结束阶段:从池随机 min(3,池) 个候选(DO rng)
        if (!isPx) return { error: "NOT_PX_ACTION" };
        const pool = [];
        ts.turnStates.forEach((n) => pool.push({ pt: "州技·" + n, skill: PEIXIU_MAPS[n].stateSkill }));
        ts.turnCities.forEach((c) => pool.push({ pt: "城技·" + c.map + c.name, skill: c.skill }));
        if (!pool.length) return { error: "EMPTY_POOL" };
        const idx = pool.map((_, i) => i);
        for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1));[idx[i], idx[j]] = [idx[j], idx[i]]; }
        ts.endChoices = idx.slice(0, Math.min(3, pool.length)).map((i) => pool[i]);
        this._log(ts, `结束阶段:随机 ${ts.endChoices.length} 选 1`);
        return { ok: true, choices: ts.endChoices };
      }
      if (t === "pxChoose") { // 三选一:选定第 k 个 → 记为保留技能
        if (!isPx) return { error: "NOT_PX_ACTION" };
        const k = Number(toolAction.k);
        if (!ts.endChoices || !ts.endChoices[k]) return { error: "BAD_CHOICE" };
        ts.retained = { pt: ts.endChoices[k].pt, skill: ts.endChoices[k].skill };
        ts.endChoices = null;
        this._log(ts, `茂著选定:${ts.retained.pt}`);
        return { ok: true, retained: ts.retained };
      }
      if (t === "pxNewTurn") { // 新回合:清池,茂著随机展开一幅新地图
        if (!isPx) return { error: "NOT_PX_ACTION" };
        ts.turnStates = []; ts.turnCities = []; ts.endChoices = null; ts.visited = {};
        this._log(ts, "—— 新回合 ——");
        const pool = ts.cycle.length ? ts.cycle : PEIXIU_NAMES;
        expand(pool[Math.floor(this.rng() * pool.length)]);
        return { ok: true };
      }
      if (t === "resetGame") { if (!isPx) return { error: "NOT_PX_ACTION" }; target.toolState = initToolState(target.general); return { ok: true, reset: true }; }
      return { error: "UNKNOWN_ACTION" };
    }

    // ───────── 蒲元:神工锻造库(全公开生成器)。roll 在 DO 跑(可 seed);锻造中的装备占库存,销毁回池 ─────────
    if (target.general === "puyuan") {
      const puSeat = targetSeat;
      const isPy = bySeat === puSeat && iHold(puSeat); // 蒲元本人(或代持)
      if (t === "pySelCat") { // 选副类别(=一次新的发动神工:清投票、回手动模式)
        if (!isPy) return { error: "NOT_PY_ACTION" };
        if (!PUYUAN_FORGE[toolAction.cat]) return { error: "BAD_CAT" };
        ts.cat = toolAction.cat; ts.rolled = []; ts.result = null; ts.picked = null; ts.vote = null;
        return { ok: true };
      }
      if (t === "pyStartVote") { // 发起助力/妨害征集(进入投票模式,手动禁用直到重新选类别)
        if (!isPy) return { error: "NOT_PY_ACTION" };
        if (!ts.cat) return { error: "NO_CAT" };
        ts.vote = { cat: ts.cat, entries: {}, settled: false };
        ts.rolled = []; ts.result = null; ts.picked = null;
        this._log(ts, `发起【${ts.cat}】锻造·征集助力/妨害`);
        return { ok: true };
      }
      if (t === "pyVote") { // 全场(含蒲元本人)各自表态助力/妨害/弃权(实时公开)。助力/妨害各 roll 1~13 点入池。
        if (!ts.vote || ts.vote.settled) return { error: "NO_VOTE" };
        const seat = Number(bySeat);
        if (!iHold(seat)) return { error: "NOT_YOUR_SEAT" };
        if (!this.seats[seat]?.general) return { error: "EMPTY_SEAT" };
        const choice = toolAction.choice;
        if (choice !== "help" && choice !== "hinder" && choice !== "abstain") return { error: "BAD_CHOICE" };
        if (ts.vote.entries[seat]) return { error: "ALREADY_VOTED" }; // OL 口径:选了就定,不可更改/反悔
        if (choice === "abstain") { ts.vote.entries[seat] = { choice: "abstain" }; this._log(ts, `座位${seat} 弃权`); }
        else { const point = 1 + Math.floor(this.rng() * 13); ts.vote.entries[seat] = { choice, point }; this._log(ts, `座位${seat} ${choice === "help" ? "助力" : "妨害"} 点数${point}`); }
        return { ok: true };
      }
      if (t === "pySettle") { // 蒲元手动揭示结算:比点数和定结果,按去重原则 roll 装备
        if (!isPy) return { error: "NOT_PY_ACTION" };
        if (!ts.vote || ts.vote.settled) return { error: "NO_VOTE" };
        const es = Object.values(ts.vote.entries);
        const hinder = es.filter((e) => e.choice === "hinder");
        const helpSum = es.filter((e) => e.choice === "help").reduce((s, e) => s + e.point, 0);
        const hinderSum = hinder.reduce((s, e) => s + e.point, 0);
        let label, n;
        if (hinder.length === 0) { label = "完美锻造"; n = 3; }      // 无人妨害
        else if (helpSum >= hinderSum) { label = "成功"; n = 2; }
        else { label = "失败"; n = 1; }
        const activeNames = new Set(ts.active.map((a) => a.card.name));
        const pool = PUYUAN_FORGE[ts.cat].filter((c) => !activeNames.has(c.name));
        for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1));[pool[i], pool[j]] = [pool[j], pool[i]]; }
        const take = Math.min(n, pool.length);
        ts.rolled = pool.slice(0, take);
        ts.result = { label, n, short: take < n, viaVote: true, helpSum, hinderSum };
        ts.rollId = (ts.rollId || 0) + 1; ts.picked = null;
        ts.vote.settled = true; ts.vote.helpSum = helpSum; ts.vote.hinderSum = hinderSum;
        this._log(ts, `结算:助力${helpSum} vs 妨害${hinderSum} → ${label}(${n}张${take < n ? `，仅剩${take}张` : ""})：${ts.rolled.map((c) => c.name).join("、") || "无可锻造"}`);
        return { ok: true };
      }
      if (t === "pyForge") { // 手动锻造:抽 n 张(排除锻造中的同名装备),DO rng 可 seed
        if (!isPy) return { error: "NOT_PY_ACTION" };
        if (!ts.cat) return { error: "NO_CAT" };
        if (ts.vote) return { error: "VOTE_MODE" }; // 已进投票模式,手动禁用,直到重新选类别
        const n = Number(toolAction.n), label = String(toolAction.label || "");
        const activeNames = new Set(ts.active.map((a) => a.card.name));
        const pool = PUYUAN_FORGE[ts.cat].filter((c) => !activeNames.has(c.name));
        for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1));[pool[i], pool[j]] = [pool[j], pool[i]]; }
        const take = Math.min(n, pool.length);
        ts.rolled = pool.slice(0, take);
        ts.result = { label, n, short: take < n };
        ts.rollId = (ts.rollId || 0) + 1; ts.picked = null;
        this._log(ts, `锻造·${ts.cat}·${label}(${n}张${take < n ? `，库内仅剩${take}张` : ""})：${ts.rolled.map((c) => c.name).join("、") || "无可锻造"}`);
        return { ok: true, rolled: ts.rolled };
      }
      if (t === "pyPick") { // 选定一张 → 锻造中(占库存)
        if (!isPy) return { error: "NOT_PY_ACTION" };
        const i = Number(toolAction.i);
        if (!ts.rolled[i]) return { error: "BAD_PICK" };
        if (ts.picked != null) ts.active = ts.active.filter((a) => a.roll !== ts.rollId); // 同 roll 换选
        ts.picked = i; const c = ts.rolled[i];
        ts.fid = (ts.fid || 0) + 1;
        ts.active.unshift({ id: "f" + ts.fid, cat: ts.cat, result: ts.result ? ts.result.label : "", card: c, roll: ts.rollId });
        this._log(ts, `锻造置入装备区：【${c.name}】`);
        return { ok: true };
      }
      if (t === "pyDestroy") { // 销毁一件锻造中的装备 → 回可锻造池
        if (!isPy) return { error: "NOT_PY_ACTION" };
        const a = ts.active.find((x) => x.id === toolAction.id);
        if (!a) return { error: "NO_ACTIVE" };
        ts.active = ts.active.filter((x) => x.id !== toolAction.id);
        if (a.roll === ts.rollId) ts.picked = null;
        this._log(ts, `销毁锻造装备：【${a.card.name}】→ 重回可锻造池`);
        return { ok: true };
      }
      if (t === "pyResetForge") { if (!isPy) return { error: "NOT_PY_ACTION" }; ts.cat = null; ts.rolled = []; ts.result = null; ts.picked = null; ts.vote = null; return { ok: true }; }
      if (t === "resetGame") { if (!isPy) return { error: "NOT_PY_ACTION" }; target.toolState = initToolState(target.general); return { ok: true, reset: true }; }
      return { error: "UNKNOWN_ACTION" };
    }

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

    // ───────── 标郭照:椒遇声明色(公开)+ 内训牌标记(牌名 ownerSeatOnly,张数公开;离手/回合末消散)─────────
    if (target.general === "guozhao") {
      const gSeat = targetSeat;
      const isGz = bySeat === gSeat && iHold(gSeat); // 郭照本人(或代持其座位)
      if (t === "setColor") {
        if (!isGz) return { error: "NOT_GZ_ACTION" };
        const c = toolAction.color;
        if (c !== "black" && c !== "red" && c !== null) return { error: "BAD_COLOR" };
        ts.color = c;
        this._log(ts, c ? `椒遇声明本轮颜色:${c === "black" ? "黑" : "红"}` : "清除本轮声明颜色");
        return { ok: true };
      }
      if (t === "addNeixun") { // 内训获得一张牌 → 加一个待填标记
        if (!isGz) return { error: "NOT_GZ_ACTION" };
        ts.seq++; ts.neixun.push({ id: "nx" + ts.seq, s: null, r: null, n: "" });
        this._log(ts, `内训牌 +1(现持有${ts.neixun.length})`);
        return { ok: true };
      }
      if (t === "editNeixun") { // 记录牌身份(花色/点数/牌名),均仅郭照可见;像吕布/袁姬一样选花色+点数再点牌名
        if (!isGz) return { error: "NOT_GZ_ACTION" };
        const c = ts.neixun.find((x) => x.id === toolAction.id);
        if (!c) return { error: "NO_CARD" };
        if ("s" in toolAction) c.s = toolAction.s || null;
        if ("r" in toolAction) c.r = toolAction.r || null;
        if ("n" in toolAction) c.n = String(toolAction.n || "").slice(0, 20);
        return { ok: true };
      }
      if (t === "dissipateNeixun") { // 该内训牌离开手牌(使用/弃置/被拿走)→ 标记消散
        if (!isGz) return { error: "NOT_GZ_ACTION" };
        const before = ts.neixun.length;
        ts.neixun = ts.neixun.filter((x) => x.id !== toolAction.id);
        if (ts.neixun.length === before) return { error: "NO_CARD" };
        this._log(ts, `内训牌消散(现持有${ts.neixun.length})`);
        return { ok: true };
      }
      if (t === "endTurn") { // 郭照回合结束 → 所有内训标记消散(内训牌不计手牌上限"直到你回合结束")
        if (!isGz) return { error: "NOT_GZ_ACTION" };
        const n = ts.neixun.length; ts.neixun = [];
        this._log(ts, n ? `回合结束:${n} 张内训标记消散` : "回合结束:当前无内训标记");
        return { ok: true };
      }
      if (t === "resetGame") {
        if (!isGz) return { error: "NOT_GZ_ACTION" };
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

    // ───────── 谋董昭:先略(牌名 ownerSeatOnly 暗置)+ 顺机账本/座位限次 + 造王/移势(公开)─────────
    if (target.general === "dongzhao") {
      const dSeat = targetSeat;
      const isDong = bySeat === dSeat && iHold(dSeat); // 董昭本人(或代持其座位)
      if (t === "xlRecord") {
        if (!isDong) return { error: "NOT_DONG_ACTION" };
        const name = String(toolAction.name || "").trim().slice(0, 20);
        if (!name) return { error: "BAD_NAME" };
        const had = ts.rec.length > 0;
        ts.rec = [name]; // 先略始终0或1张;重记录直接覆盖(连续两次可选同一张)
        this._log(ts, had ? "先略:重新记录了一张锦囊牌" : "先略:记录了一张锦囊牌"); // 不记牌名(暗置)
        return { ok: true };
      }
      if (t === "xlTrigger") {
        if (!isDong) return { error: "NOT_DONG_ACTION" };
        if (!ts.rec.length) return { error: "NO_RECORD" };
        if (ts.turnUsed) return { error: "ALREADY_TRIGGERED" }; // 每回合限一次
        ts.turnUsed = true;
        this._log(ts, "先略触发:摸两张分配给任意角色,请重新记录");
        return { ok: true };
      }
      if (t === "xlNewTurn") {
        if (!isDong) return { error: "NOT_DONG_ACTION" };
        ts.turnUsed = false;
        return { ok: true };
      }
      if (t === "zwSet") {
        if (!isDong) return { error: "NOT_DONG_ACTION" };
        ts.zw = !!toolAction.on;
        this._log(ts, ts.zw ? "造王发动(限定技)" : "撤销造王发动标记(纠错)");
        return { ok: true, zw: ts.zw };
      }
      if (t === "sjToggle") {
        if (!isDong) return { error: "NOT_DONG_ACTION" };
        const sn = Number(toolAction.seatNo);
        if (!this.seats[sn]) return { error: "BAD_SEAT" };
        const i = ts.shunji.indexOf(sn);
        if (i >= 0) ts.shunji.splice(i, 1);
        else { ts.shunji.push(sn); this._log(ts, `顺机:本轮已对座位${sn}发动`); }
        return { ok: true };
      }
      if (t === "sjEndRound") {
        if (!isDong) return { error: "NOT_DONG_ACTION" };
        this._log(ts, `顺机:第${ts.round}轮结束,限次重置`);
        ts.round++; ts.shunji = [];
        return { ok: true, round: ts.round };
      }
      if (t === "nameAdd") {
        if (!isDong) return { error: "NOT_DONG_ACTION" };
        const name = String(toolAction.name || "").trim().slice(0, 20);
        if (!name) return { error: "BAD_NAME" };
        if (ts.names.includes(name)) return { error: "NAME_DUP" }; // 每个牌名限一次
        ts.names.push(name);
        this._log(ts, `顺机:牌名【${name}】触发伤害,登记`);
        return { ok: true };
      }
      if (t === "nameRm") {
        if (!isDong) return { error: "NOT_DONG_ACTION" };
        if (ts.names[toolAction.index] == null) return { error: "NO_NAME" };
        this._log(ts, `删除顺机牌名【${ts.names[toolAction.index]}】`);
        ts.names.splice(toolAction.index, 1);
        return { ok: true };
      }
      if (t === "yishiSet") {
        if (!isDong) return { error: "NOT_DONG_ACTION" };
        const su = toolAction.suit;
        if (!GLYPH[su]) return { error: "BAD_SUIT" };
        ts.yishi = su;
        this._log(ts, `移势:移动了${GLYPH[su]}牌,挂起"失去${GLYPH[su]}牌摸一张"提醒`);
        return { ok: true };
      }
      if (t === "yishiClear") {
        if (!isDong) return { error: "NOT_DONG_ACTION" };
        ts.yishi = null;
        this._log(ts, "移势提醒结束(回合开始)");
        return { ok: true };
      }
      if (t === "resetGame") {
        if (!isDong) return { error: "NOT_DONG_ACTION" };
        target.toolState = initToolState(target.general);
        return { ok: true, reset: true };
      }
      return { error: "UNKNOWN_ACTION" };
    }

    // ───────── 神孙权:驭衡帝力(全公开生成器直通;随机在客户端跑,只把解析好的技能进 DO)─────────
    if (target.general === "shensunquan") {
      const sSeat = targetSeat;
      const isShen = bySeat === sSeat && iHold(sSeat); // 神孙权本人(或代持其座位)
      const GAIN_ORDER = ["shengzhi", "quandao", "chigang"];      // 圣质/权道/持纲(固定顺序;客户端有全文)
      const GAIN_NAME = { shengzhi: "圣质", quandao: "权道", chigang: "持纲" };
      if (t === "setMaxHp") {
        if (!isShen) return { error: "NOT_SHEN_ACTION" };
        ts.maxHp = Math.max(1, Math.min(12, Math.floor(toolAction.hp) || 1));
        return { ok: true, maxHp: ts.maxHp };
      }
      if (t === "rollYuheng") {
        if (!isShen) return { error: "NOT_SHEN_ACTION" };
        if (!ts.hasYuheng) return { error: "NO_YUHENG" };
        if (ts.temp.length) return { error: "TEMP_ACTIVE" };        // 先结算回合结束再下次驭衡
        const skills = Array.isArray(toolAction.skills) ? toolAction.skills : [];
        if (!skills.length) return { error: "NO_SKILLS" };
        ts.temp = skills.map((s) => ({ id: String(s.id || "").slice(0, 40), name: String(s.name || "").slice(0, 20), text: String(s.text || "").slice(0, 300) }));
        const suitTxt = (Array.isArray(toolAction.suits) ? toolAction.suits : []).map((k) => GLYPH[String(k).toUpperCase()] || "").join("");
        this._log(ts, `驭衡:弃置${ts.temp.length}张(${suitTxt})→获得${ts.temp.map((s) => "〖" + s.name + "〗").join("")}`);
        return { ok: true };
      }
      if (t === "turnEnd") {
        if (!isShen) return { error: "NOT_SHEN_ACTION" };
        const n = ts.temp.length;
        if (n) this._log(ts, `回合结束:失去${n}个临时技能,摸${n}张牌`);
        ts.temp = [];
        return { ok: true, drew: n };
      }
      if (t === "addExt") {
        if (!isShen) return { error: "NOT_SHEN_ACTION" };
        const name = String(toolAction.name || "").trim().slice(0, 20);
        if (!name) return { error: "BAD_NAME" };
        const note = String(toolAction.note || "").trim().slice(0, 40);
        ts.seq++;
        ts.custom.push({ id: "e" + ts.seq, name, note });
        this._log(ts, `外来技能 +〖${name}〗${note ? "(" + note + ")" : ""}`);
        return { ok: true };
      }
      if (t === "rmExt") {
        if (!isShen) return { error: "NOT_SHEN_ACTION" };
        const c = ts.custom.find((x) => x.id === toolAction.id);
        if (!c) return { error: "NO_EXT" };
        ts.custom = ts.custom.filter((x) => x.id !== toolAction.id);
        this._log(ts, `外来技能 −〖${c.name}〗`);
        return { ok: true };
      }
      if (t === "awaken") {
        if (!isShen) return { error: "NOT_SHEN_ACTION" };
        if (ts.awakened) return { error: "ALREADY_AWAKENED" };
        const lose = Array.isArray(toolAction.lose) ? toolAction.lose : [];
        ts.preAwaken = clone({ maxHp: ts.maxHp, temp: ts.temp, perm: ts.perm, custom: ts.custom, hasYuheng: ts.hasYuheng, gained: ts.gained, awakened: ts.awakened, chigangYang: ts.chigangYang });
        ts.maxHp = Math.max(1, ts.maxHp - 1);
        const lostNames = [];
        lose.forEach((key) => {
          if (key === "yuheng") { ts.hasYuheng = false; lostNames.push("驭衡"); }
          else if (key.slice(0, 2) === "t:") { const id = key.slice(2); const sk = ts.temp.find((x) => x.id === id); if (sk) { ts.temp = ts.temp.filter((x) => x.id !== id); lostNames.push(sk.name); } }
          else if (key.slice(0, 2) === "c:") { const id = key.slice(2); const c = ts.custom.find((x) => x.id === id); if (c) { ts.custom = ts.custom.filter((x) => x.id !== id); lostNames.push(c.name); } }
        });
        const n = Math.min(lose.length, 3);
        ts.gained = GAIN_ORDER.slice(0, n);
        ts.awakened = true; ts.chigangYang = true;
        this._log(ts, `帝力觉醒:体力上限-1(现${ts.maxHp}),失去${lose.length}个技能${lostNames.length ? "(" + lostNames.join("/") + ")" : ""},获得${ts.gained.map((id) => "〖" + GAIN_NAME[id] + "〗").join("")}`);
        if (!ts.hasYuheng && ts.temp.length) { ts.perm = ts.perm.concat(ts.temp); this._log(ts, `驭衡已失去:${ts.temp.length}个临时技能固化为本局永久技能`); ts.temp = []; }
        return { ok: true, awakened: true };
      }
      if (t === "rollbackAwaken") {
        if (!isShen) return { error: "NOT_SHEN_ACTION" };
        if (!ts.preAwaken) return { error: "NO_SNAPSHOT" };
        const p = ts.preAwaken;
        ts.maxHp = p.maxHp; ts.temp = p.temp; ts.perm = p.perm || []; ts.custom = p.custom;
        ts.hasYuheng = p.hasYuheng; ts.gained = p.gained; ts.awakened = p.awakened; ts.chigangYang = p.chigangYang;
        ts.preAwaken = null;
        this._log(ts, "已回滚帝力觉醒(误触撤销)");
        return { ok: true };
      }
      if (t === "flipChigang") {
        if (!isShen) return { error: "NOT_SHEN_ACTION" };
        ts.chigangYang = !ts.chigangYang;
        this._log(ts, `持纲翻面:现为${ts.chigangYang ? "阳(判定→摸牌)" : "阴(判定→出牌)"}`);
        return { ok: true, yang: ts.chigangYang };
      }
      if (t === "resetGame") {
        if (!isShen) return { error: "NOT_SHEN_ACTION" };
        target.toolState = initToolState(target.general);
        return { ok: true, reset: true };
      }
      return { error: "UNKNOWN_ACTION" };
    }

    // ───────── 魔貂蝉:幻惑倾世(全公开台账 + 花名册绑房间座位;幻惑随机在 DO,报数公开)─────────
    if (target.general === "diaochan") {
      const dSeat = targetSeat;
      const isDiao = bySeat === dSeat && iHold(dSeat); // 貂蝉本人(或代持其座位)
      const nm = (sn) => "座位" + sn;                   // 日志用座位号(名字由前端按 general 渲染)
      const wiz = (pl) => ts.hh.wiz[pl];
      const afterDiscard = (pl) => {                    // 弃置后:满2次→done,否则回下一轮"数可用牌"
        const w = wiz(pl);
        if (w.uses >= 2) { w.stage = "done"; this._log(ts, `幻惑·${nm(pl)}:结算完毕`); }
        else { w.stage = "count-usable"; w.n = 0; }
      };
      // —— 幻惑 ——
      if (t === "hhToggle") {
        if (!isDiao) return { error: "NOT_DIAO_ACTION" };
        const pl = Number(toolAction.pl);
        if (pl === dSeat || !this.seats[pl]) return { error: "BAD_TARGET" };
        const i = ts.hh.targets.indexOf(pl);
        if (i >= 0) { ts.hh.targets.splice(i, 1); delete ts.hh.wiz[pl]; this._log(ts, `取消幻惑目标:${nm(pl)}`); }
        else {
          if (ts.hh.targets.length >= 2) return { error: "HH_MAX_2" }; // 幻惑至多2名目标
          ts.hh.targets.push(pl); ts.hh.wiz[pl] = { uses: 0, stage: "idle", n: 0, roll: null };
          this._log(ts, `指定幻惑目标:${nm(pl)}`);
        }
        return { ok: true };
      }
      if (t === "hhStart") {
        if (!isDiao) return { error: "NOT_DIAO_ACTION" };
        const w = wiz(toolAction.pl); if (!w) return { error: "NO_WIZ" };
        w.stage = "count-usable"; w.n = 0; w.roll = null;
        return { ok: true };
      }
      if (t === "hhRollUse") {   // 报"可用牌"数 → DO 随机抽位置强制使用
        if (!isDiao) return { error: "NOT_DIAO_ACTION" };
        const w = wiz(toolAction.pl); if (!w) return { error: "NO_WIZ" };
        const n = Math.floor(toolAction.n);
        if (!(n >= 1)) return { error: "BAD_N" };
        w.n = n; w.roll = 1 + Math.floor(this.rng() * n); w.stage = "show-use";
        this._log(ts, `幻惑·${nm(toolAction.pl)}:${n}张可用牌中抽中第${w.roll}张,强制使用`);
        return { ok: true, roll: w.roll };
      }
      if (t === "hhNoUsable") {
        if (!isDiao) return { error: "NOT_DIAO_ACTION" };
        const w = wiz(toolAction.pl); if (!w) return { error: "NO_WIZ" };
        w.stage = "ended"; this._log(ts, `幻惑·${nm(toolAction.pl)}:无可用手牌,幻惑终止`);
        return { ok: true };
      }
      if (t === "hhUsed") {
        if (!isDiao) return { error: "NOT_DIAO_ACTION" };
        const w = wiz(toolAction.pl); if (!w) return { error: "NO_WIZ" };
        w.uses++; w.stage = "count-hand"; w.n = 0;
        return { ok: true, uses: w.uses };
      }
      if (t === "hhRollDiscard") { // 报"全部手牌"数 → DO 随机抽位置弃置(n=0 跳过)
        if (!isDiao) return { error: "NOT_DIAO_ACTION" };
        const w = wiz(toolAction.pl); if (!w) return { error: "NO_WIZ" };
        const n = Math.floor(toolAction.n);
        if (isNaN(n) || n < 0) return { error: "BAD_N" };
        if (n === 0) { this._log(ts, `幻惑·${nm(toolAction.pl)}:使用后已无手牌,跳过随机弃置`); afterDiscard(toolAction.pl); return { ok: true, skipped: true }; }
        w.n = n; w.roll = 1 + Math.floor(this.rng() * n); w.stage = "show-discard";
        this._log(ts, `幻惑·${nm(toolAction.pl)}:${n}张手牌中随机弃置第${w.roll}张`);
        return { ok: true, roll: w.roll };
      }
      if (t === "hhDiscarded") {
        if (!isDiao) return { error: "NOT_DIAO_ACTION" };
        const w = wiz(toolAction.pl); if (!w) return { error: "NO_WIZ" };
        afterDiscard(toolAction.pl);
        return { ok: true, stage: w.stage };
      }
      if (t === "hhReroll") {
        if (!isDiao) return { error: "NOT_DIAO_ACTION" };
        const w = wiz(toolAction.pl); if (!w) return { error: "NO_WIZ" };
        w.stage = toolAction.back === "count-hand" ? "count-hand" : "count-usable"; w.roll = null;
        this._log(ts, `幻惑·${nm(toolAction.pl)}:报数有误,重新报数`);
        return { ok: true };
      }
      // —— 倾世 ——
      if (t === "enterQingshi") {
        if (!isDiao) return { error: "NOT_DIAO_ACTION" };
        if (ts.entered) return { error: "ALREADY_ENTERED" };
        ts.entered = true; this._log(ts, "貂蝉入魔(倾世)");
        return { ok: true };
      }
      if (t === "qsDistribute") { // 客户端填好整批(每座位一张)一次性进 DO
        if (!isDiao) return { error: "NOT_DIAO_ACTION" };
        if (!ts.entered) return { error: "NOT_ENTERED" };
        const cards = Array.isArray(toolAction.cards) ? toolAction.cards : [];
        if (!cards.length) return { error: "NO_CARDS" };
        ts.qs.batch++;
        ts.qs.cards = cards.map((c) => ({ owner: Number(c.owner), typ: String(c.typ || "").slice(0, 10), custom: String(c.custom || "").slice(0, 20), s: c.s || null, r: c.r || null, status: "hand" }));
        this._log(ts, `倾世第${ts.qs.batch}批分发完毕(${ts.qs.cards.length}张)`);
        return { ok: true, batch: ts.qs.batch };
      }
      if (t === "qsUse") {
        if (!isDiao) return { error: "NOT_DIAO_ACTION" };
        const c = ts.qs.cards[toolAction.index]; if (!c) return { error: "NO_CARD" };
        c.status = "used";
        if (toolAction.dmg && c.owner === dSeat) ts.dmgThisRound = true; // 貂蝉自己用倾世牌造成伤害计入本轮
        this._log(ts, `倾世牌(${nm(c.owner)})已使用${toolAction.dmg ? ",造成伤害→貂蝉摸一张" : ",未造成伤害"}`);
        return { ok: true };
      }
      if (t === "qsGot") {
        if (!isDiao) return { error: "NOT_DIAO_ACTION" };
        const c = ts.qs.cards[toolAction.index]; if (!c) return { error: "NO_CARD" };
        c.status = "got"; this._log(ts, `倾世牌(${nm(c.owner)})非使用进弃牌堆→貂蝉获得之`);
        return { ok: true };
      }
      if (t === "qsLeft") {
        if (!isDiao) return { error: "NOT_DIAO_ACTION" };
        const c = ts.qs.cards[toolAction.index]; if (!c) return { error: "NO_CARD" };
        c.status = "left"; this._log(ts, `倾世牌(${nm(c.owner)})以其他方式离手,标记消散`);
        return { ok: true };
      }
      if (t === "qsUndo") {
        if (!isDiao) return { error: "NOT_DIAO_ACTION" };
        const c = ts.qs.cards[toolAction.index]; if (!c) return { error: "NO_CARD" };
        c.status = "hand"; this._log(ts, `撤回:倾世牌(${nm(c.owner)})恢复为"在手"`);
        return { ok: true };
      }
      // —— 轮次 / 阵亡 ——
      if (t === "toggleDmg") {
        if (!isDiao) return { error: "NOT_DIAO_ACTION" };
        ts.dmgThisRound = !ts.dmgThisRound; return { ok: true, dmg: ts.dmgThisRound };
      }
      if (t === "endRound") {
        if (!isDiao) return { error: "NOT_DIAO_ACTION" };
        const lost = ts.entered && !ts.dmgThisRound;
        this._log(ts, `第${ts.round}轮结束` + (lost ? ":本轮未造成伤害,貂蝉失去1点体力" : ""));
        ts.round++; ts.dmgThisRound = false; ts.hh = { targets: [], wiz: {} };
        return { ok: true, lostHp: lost };
      }
      if (t === "toggleDead") {
        if (!isDiao) return { error: "NOT_DIAO_ACTION" };
        const pl = Number(toolAction.pl);
        const i = ts.dead.indexOf(pl);
        if (i >= 0) { ts.dead.splice(i, 1); this._log(ts, `${nm(pl)}取消阵亡标记`); }
        else {
          ts.dead.push(pl); this._log(ts, `${nm(pl)}阵亡`);
          const ti = ts.hh.targets.indexOf(pl); // 阵亡即移出幻惑目标
          if (ti >= 0) { ts.hh.targets.splice(ti, 1); delete ts.hh.wiz[pl]; }
        }
        return { ok: true };
      }
      if (t === "resetGame") {
        if (!isDiao) return { error: "NOT_DIAO_ACTION" };
        target.toolState = initToolState(target.general);
        return { ok: true, reset: true };
      }
      return { error: "UNKNOWN_ACTION" };
    }

    // ───────── 魔孙权:权御暗选(secretPick 密封同时揭示)+ 天恩/乾纲(公开)+ 花名册绑座位 ─────────
    if (target.general === "sunquan") {
      const sq = targetSeat;
      const isSun = bySeat === sq && iHold(sq);        // 孙权本人(或代持其座位)
      const aliveOf = (s) => !ts.dead.includes(s);
      const usedOf = (s) => (ts.used[s] || (ts.used[s] = []));
      const EFFN = SQ_EFFECTS.length;                  // 6
      const en = (ei) => SQ_EFFECTS[ei] ? SQ_EFFECTS[ei].n : "?";

      if (t === "startPick") {                         // 孙权开启本轮暗选
        if (!isSun) return { error: "NOT_SUN_ACTION" };
        ts.phase = "picking"; ts.picks = {};
        this._log(ts, `第${ts.round}轮权御暗选开始`);
        return { ok: true };
      }
      // 任意存活座位为【自己】暗选(含孙权);内容保密到 reveal —— 跨座位写自己那份,像 registerQi
      if (t === "pick") {
        if (!iHold(bySeat)) return { error: "BYSEAT_NOT_HELD" };
        if (ts.phase !== "picking") return { error: "NOT_PICKING" };
        if (!aliveOf(bySeat)) return { error: "DEAD" };
        const ei = toolAction.effect;
        if (ei !== null) {
          if (!(ei >= 0 && ei < EFFN)) return { error: "BAD_EFFECT" };
          if (usedOf(bySeat).includes(ei)) return { error: "EFFECT_USED" }; // 每人每项限一次
        }
        ts.picks[bySeat] = { holder: bySeat, effect: ei ?? null, revealed: false };
        return { ok: true }; // 不记日志(暗选,连"谁选了"都靠占位体现,不泄露内容)
      }
      // 孙权:同时翻开 → DO 原子结算(翻开 + 写 used + 算相同数与摸牌)。孙权无法提前偷看=不弱于现状
      if (t === "reveal") {
        if (!isSun) return { error: "NOT_SUN_ACTION" };
        if (ts.phase !== "picking") return { error: "NOT_PICKING" };
        const entries = Object.values(ts.picks).map((p) => [p.holder, p.effect]);
        for (const p of Object.values(ts.picks)) {
          p.revealed = true;
          if (p.effect !== null && !usedOf(p.holder).includes(p.effect)) usedOf(p.holder).push(p.effect);
        }
        const sqPick = (ts.picks[sq] && aliveOf(sq)) ? ts.picks[sq].effect : null;
        let match = 0;
        if (sqPick !== null && sqPick !== undefined) for (const [i, ei] of entries) if (i !== sq && ei === sqPick) match++;
        const draw = (sqPick !== null && sqPick !== undefined) ? Math.min(match + 1, 3) : 0;
        ts.lastReveal = { round: ts.round, entries, sqPick, match, draw };
        ts.phase = "revealed";
        this._log(ts, `第${ts.round}轮翻开:与孙权相同${match}人${sqPick != null ? `,孙权【杀】执行${en(sqPick)},摸${draw}张` : "(孙权未选/已阵亡)"}`);
        return { ok: true, match, draw };
      }
      // 天恩·不同项:孙权只发起(选目标)→ 选剑权归【目标本人】,在其自己 UI 里选(弹窗在目标那)。
      if (t === "teDiffInit") {
        if (!isSun) return { error: "NOT_SUN_ACTION" };
        if (ts.gg) return { error: "GG_NO_TE" };       // 乾纲入魔后永久失去天恩
        if (ts.te.diff) return { error: "TE_DIFF_USED" };
        if (ts.tePending) return { error: "TE_PENDING" };
        const tgt = Number(toolAction.target);
        if (tgt === sq || !this.seats[tgt] || !aliveOf(tgt)) return { error: "BAD_TARGET" };
        ts.tePending = { target: tgt };
        this._log(ts, `孙权对座位${tgt}发动天恩·不同项,待其选择追加的权御`);
        return { ok: true };
      }
      // 目标本人选剑(bySeat 必须是待选目标本人;或六项已满 effect=null 仅记录)
      if (t === "teDiffChoose") {
        if (!ts.tePending) return { error: "NO_TE_PENDING" };
        const tgt = ts.tePending.target;
        if (bySeat !== tgt || !iHold(bySeat)) return { error: "NOT_TE_TARGET" };
        const ei = toolAction.effect;
        if (ei !== null && ei !== undefined) {
          if (!(ei >= 0 && ei < EFFN)) return { error: "BAD_EFFECT" };
          if (usedOf(tgt).includes(ei)) return { error: "EFFECT_USED" };
          usedOf(tgt).push(ei);
          ts.teNote = `座位${tgt}:随机弃一张牌,追加权御【${en(ei)}】`;
        } else ts.teNote = `座位${tgt}:随机弃一张牌,六项已满无可追加`;
        ts.te.diff = true; ts.tePending = null; this._log(ts, ts.teNote);
        return { ok: true };
      }
      if (t === "teCancel") {                           // 孙权撤销待选(误触/改主意)
        if (!isSun) return { error: "NOT_SUN_ACTION" };
        ts.tePending = null; return { ok: true };
      }
      if (t === "teSame") {
        if (!isSun) return { error: "NOT_SUN_ACTION" };
        if (ts.gg) return { error: "GG_NO_TE" };
        ts.te.same = !!toolAction.on; return { ok: true, same: ts.te.same };
      }
      if (t === "teReset") {
        if (!isSun) return { error: "NOT_SUN_ACTION" };
        ts.te = { diff: false, same: false }; ts.teNote = ""; ts.tePending = null; return { ok: true };
      }
      if (t === "gg") {
        if (!isSun) return { error: "NOT_SUN_ACTION" };
        ts.gg = !!toolAction.on;
        this._log(ts, ts.gg ? "发动乾纲:永久失去天恩并入魔" : "撤销乾纲入魔(误触回滚)");
        return { ok: true, gg: ts.gg };
      }
      if (t === "toggleDmg") {
        if (!isSun) return { error: "NOT_SUN_ACTION" };
        ts.dmgThisRound = !ts.dmgThisRound; return { ok: true, dmg: ts.dmgThisRound };
      }
      if (t === "toggleAlive") {
        if (!isSun) return { error: "NOT_SUN_ACTION" };
        const s = Number(toolAction.seat);
        const i = ts.dead.indexOf(s);
        if (i >= 0) { ts.dead.splice(i, 1); this._log(ts, `座位${s}取消阵亡`); }
        else { ts.dead.push(s); this._log(ts, `座位${s}阵亡`); }
        return { ok: true };
      }
      if (t === "endRound") {
        if (!isSun) return { error: "NOT_SUN_ACTION" };
        const lost = ts.gg && aliveOf(sq) && !ts.dmgThisRound;
        this._log(ts, `第${ts.round}轮结束` + (lost ? ":入魔本轮未造成伤害,孙权失去1点体力" : ""));
        ts.round++; ts.dmgThisRound = false; ts.te = { diff: false, same: false }; ts.teNote = ""; ts.tePending = null; ts.phase = "idle"; ts.picks = {};
        return { ok: true, lostHp: lost };
      }
      if (t === "resetGame") {
        if (!isSun) return { error: "NOT_SUN_ACTION" };
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
      seats[n] = { seatNo: s.seatNo, general: s.general, chosenFaction: s.chosenFaction ?? null, holderDevices: s.holderDevices.slice(), toolState: filterState(s, holds),
        // 全场状态面板字段(全公开;老房间 hydrate 无这些字段→?? 兜底为 null/false)
        hp: s.hp ?? null, hpMax: s.hpMax ?? null, flipped: !!s.flipped, tapped: !!s.tapped, chained: !!s.chained, dead: !!s.dead };
    return { roomCode: this.roomCode, youHold: [...holds], seats };
  }

  // ---- 持久化(worker 落 DO storage 用;devices.holds 是 Set,序列化成数组)----
  serialize() {
    const devices = {};
    for (const id of Object.keys(this.devices)) devices[id] = { holds: [...this.devices[id].holds] };
    return { roomCode: this.roomCode, seatCount: Object.keys(this.seats).length, seats: this.seats, devices };
  }
  static hydrate(data, rng = Math.random) {
    const core = new RoomCore(data?.roomCode ?? "room", data?.seatCount ?? 8, rng);
    if (data?.seats) core.seats = data.seats;
    core.devices = {};
    for (const id of Object.keys(data?.devices || {})) core.devices[id] = { holds: new Set(data.devices[id].holds || []) };
    return core;
  }
}
