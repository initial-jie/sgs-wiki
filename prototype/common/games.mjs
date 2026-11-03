// 游戏注册表 —— 所有房间/站点的唯一清单。加第五个游戏只改这里:
//   大厅页 /hub 的卡片与搜索、各房间页脚的"其他游戏"链接(room-client.js gamesNav)、/common/games.json 都从这里生成。
//   wiki 首页(index.html,GitHub Pages 静态页)的房间块是手写的,加游戏时记得也补一行。
// 字段:key 唯一键;api = WebSocket 路径 /api/<api>/<码>/ws 的段(room-client 用它反推当前游戏来记"最近房间");
//       path 页面路径(external=true 时是完整外链);py 拼音(空格分音节,供 searchRank);aliases 别名/缩写(搜索精确命中);
//       players 人数文案;color 卡片点缀色;icon 表情(图没加载出来时的退路);img 大厅卡片头像(Pages 直链,仓库 assets/ 下),pos 取景位置(object-position)。
const A = "https://initial-jie.github.io/sgs-wiki/assets/";
const SKIN = "https://web.sanguosha.com/220/h5_2/res/runtime/pc/general/big/static/"; // OL 皮肤大图(1915×1080,约 3MB;与座位立绘同源),id 见 sgs/shared/hero-skins.json
export const GAMES = [
  { key: "sgs", api: "room", name: "三国杀", en: "Sanguosha", py: "san guo sha", aliases: ["sgs", "三国", "杀", "sanguosha", "三国杀线下"],
    path: "/", icon: "⚔️", img: SKIN + "56802.png", pos: "60% 28%", color: "#a32e22", tag: "线下化工具房间", players: "2~10 人",
    desc: "牌桌出现需要工具的武将时开一桌:发将、暗牌 / 暗选、身份发放、历史对局,服务端按座位身份过滤。" },
  { key: "fs", api: "fs", name: "风声", en: "Fengsheng", py: "feng sheng", aliases: ["fs", "谍战", "风声典藏版", "fengsheng"],
    path: "/fs", icon: "📜", img: A + "fengsheng/char/GuXiaoMeng.jpg", pos: "50% 25%", color: "#5d5242", tag: "谍战桌游典藏版", players: "3~9 人",
    desc: "身份保密 / 情报区台账 / 宣胜校验,以实体卡牌文本为准。" },
  { key: "qmxy", api: "qmxy", name: "枪鸣锈语", en: "Gunfire & Rust", py: "qiang ming xiu yu", aliases: ["qmxy", "枪鸣", "锈语", "赛博三国杀"],
    path: "/qmxy", icon: "🔫", img: A + "qmxy/art/6.jpg", pos: "62% 16%", color: "#2aa8d8", tag: "赛博枪战版三国杀", players: "3~8 人",
    desc: "座位身份弹层 / 立绘 / 角色池 / 深渊,血量弹匣台账与命中判定。" },
  { key: "onuw", api: "onuw", name: "一夜终极狼人", en: "One Night Ultimate Werewolf", py: "yi ye zhong ji lang ren", aliases: ["onuw", "狼人", "一夜狼", "狼人杀", "werewolf", "狼"],
    path: "/onuw", icon: "🐺", img: A + "onuw/werewolf.jpg", pos: "50% 42%", color: "#7c8cff", tag: "系统发牌 + 语音主持", players: "3~16 人",
    desc: "46 个角色含扩展包;夜晚语音播报各角色行动,白天发言轮次与投票计时,一键结算。" },
  { key: "noname", name: "线上牌桌(无名杀)", en: "Noname Online", py: "wu ming sha", aliases: ["noname", "无名杀", "线上", "远程", "online"],
    path: "https://private-sgs-initial-j.pages.dev", external: true, icon: "🌐", img: SKIN + "54801.png", pos: "50% 30%", tag: "人不在一起时", players: "联机",
    desc: "朋友圈内测:打开后先取名,选「联机」进大厅建房 / 加入;手机建议横屏。将池与线下房间同步。" },
  { key: "wiki", name: "三国杀线下 Wiki", en: "Wiki", py: "wiki", aliases: ["wiki", "手册", "衍生技", "衍生牌", "工具", "速查"],
    path: "https://initial-jie.github.io/sgs-wiki/", external: true, icon: "📖", img: A + "icons/icon-512.png", pos: "50% 50%", tag: "速查手册 + 单人版工具", players: "",
    desc: "衍生技 / 衍生牌 / 武将修订速查,以及二十多个单人版线下化工具。" },
];
export const GAMES_JSON = JSON.stringify(GAMES);
// 把 /*GAMES*/[]/*/GAMES*/ 占位(room-client.js / hub.html 里)换成清单;没占位则原样返回
export function injectGames(text) { return text.replace(/\/\*GAMES\*\/\[\]\/\*\/GAMES\*\//, () => GAMES_JSON); }
