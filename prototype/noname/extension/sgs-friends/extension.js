import { lib, game, ui, get, ai, _status } from "noname";

/**
 * 朋友圈牌桌(sgs-friends)—— 把我们 sgs-wiki 房间那套规则接进无名杀:
 *   ① 将池:开局从我们 worker 读白/黑名单(按武将名),对到无名杀的武将 id,不在池里的一律设为禁将(本地 + 联机建房都生效)
 *   ② (后续)身份局变体:暴虐无道 / 大忠似奸 / 失心疯 / 无间道
 * 作为内置 play 包随本体发布,init/index.ts 里强制加载,玩家不用手动开。
 */
// 本地调试可用 localStorage.sgs_friends_pool_api 指到 wrangler dev(http://localhost:8787/api/noname-pool)
const POOL_API = (() => { try { return localStorage.getItem("sgs_friends_pool_api"); } catch (e) { return null; } })() || "https://sgs-room.dujie1995.workers.dev/api/noname-pool";
const CACHE_KEY = "sgs_friends_pool_cache";
// 无名杀的名字前缀是「平台 + 类别」的组合,如 "界" / "OL谋" / "新杀谋" / "手杀界" / "☆SP"。
// 平台记号换成我们将库的叫法(OL/新杀 → 无,手杀 → 移动版,标 → 标),类别记号保留(★SP/☆SP/J.SP 归一成 SP);
// 不认识的记号(武/乐/侠/星/威/用间/衰/徐兖/TW/PE…)都是无名杀独有变体,不参与匹配。
const PLATFORM = { "": "", "OL": "", "新杀": "", "手杀": "移动版", "标": "标" };
const KIND = { "": "", "界": "界", "谋": "谋", "神": "神", "族": "族", "SP": "SP", "★SP": "SP", "☆SP": "SP", "J.SP": "SP", "魔": "魔", "闪": "闪", "梦": "梦", "晋": "" };
// 我们叫法 ≠ 无名杀叫法的个别武将
const ALIAS = { "界伏皇后": "界伏寿" }; // 无名杀叫「界伏寿」,OL 版是 ol_fuhuanghou(惴恐 / 求援与 OL 原文一致);冯方女改走下面的 DIRECT
// 线下《蚀心入魔》魔将:无名杀放在 sxrm 包,显示名同为「魔X」,会和 OL 魔系列(onlyOL 包 dm_*)撞名 → 我们的名字按 id 直连;
// 反过来 sxrm_* 不参与按名匹配(否则白名单里的 OL「魔曹操」会把线下版也放进来)。无名杀还没实现的(魔吕布)先列着,上游有了自动生效。
const DIRECT = {
	"疑·魔曹操": ["sxrm_caocao"], "慢·魔关羽": ["sxrm_guanyu"], "嗔·魔周瑜": ["sxrm_zhouyu"], "贪·魔吕布": ["sxrm_lvbu"],
	// 2026-11-22 技能对齐审计:按名字会对到无名杀里的「另一个版本」,技能与 OL 原文不同 → 直连技能一致的那个 id
	"袁术": ["yuanshu"],        // 庸肆 / 伪帝(无名杀叫「SP袁术」;按名对到的 re_yuanshu 是 妄尊 / 同疾)
	"留赞": ["liuzan"],         // 奋音 = 与上一张颜色不同摸一张(「手杀留赞」;re_liuzan 是按花色 + 力激)
	"冯方女": ["fengfangnv"],   // 妆梳 / 垂涕(无名杀叫「OL冯妤」;原先 ALIAS 到的「冯方」是她父亲,技能完全不同)
	"界徐盛": ["re_xusheng"],   // 破军 = 移出游戏 + 手牌装备皆不大于你则伤害+1(「手杀界徐盛」;xin_xusheng 是十周年版)
};
function parsePrefix(p) {
	for (const plat of Object.keys(PLATFORM).sort((a, b) => b.length - a.length)) {
		if (!p.startsWith(plat)) continue;
		const kind = p.slice(plat.length);
		if (kind in KIND) return { plat, kind };
	}
	return null;
}

function nonameDisplay(id) {
	const raw = lib.translate[id];
	if (typeof raw !== "string") return null;
	const prefix = (lib.translate[`${id}_prefix`] || "").split("|")[0];
	const parsed = parsePrefix(prefix);
	if (!parsed) return null;
	const rest = prefix && raw.startsWith(prefix) ? raw.slice(prefix.length) : raw;
	return { plat: parsed.plat, kind: parsed.kind, name: rest, ours: PLATFORM[parsed.plat] + KIND[parsed.kind] + rest };
}

// 我们的名字(如 "界曹操" / "曹操" / "移动版谋韩当")→ 无名杀 id 列表(按优先级)
function buildIndex() {
	const byOurs = new Map();
	for (const id of Object.keys(lib.character)) {
		const ch = lib.character[id];
		if (!ch || ch.isUnseen || (lib.characterFilter[id] && !lib.characterFilter[id]("identity"))) continue;
		if (id.startsWith("sxrm_")) continue; // 蚀心入魔包只走 DIRECT
		const d = nonameDisplay(id);
		if (!d) continue;
		if (!byOurs.has(d.ours)) byOurs.set(d.ours, []);
		byOurs.get(d.ours).push({ id, plat: d.plat, kind: d.kind });
	}
	return byOurs;
}

// 同名多版本时的取舍:我们是 OL 口径 → 先按平台记号取第一组有货的(OL > 无 > 新杀;"移动版"只认 手杀),组内再按势力过滤
// (如 贾充:群版 dc_jiachong vs 晋版 jin_jiachong)
const GROUP_MAP = { "魏": "wei", "蜀": "shu", "吴": "wu", "群": "qun", "晋": "jin", "神": "shen" };
function pickIds(cands, oursPlat, genre) {
	const order = oursPlat === "移动版" ? ["手杀"] : oursPlat === "标" ? ["标"] : ["OL", "", "新杀"];
	let group = [];
	for (const p of order) {
		group = cands.filter(c => c.plat === p);
		if (group.length) break;
	}
	if (!group.length) return [];
	// 组内先按势力过滤(贾充:群版 dc_jiachong vs 晋版 jin_jiachong,我们的 贾充 是晋),再优先正牌类别记号(SP > ★SP/☆SP/J.SP)
	if (group.length > 1 && genre && GROUP_MAP[genre]) {
		const byGroup = group.filter(c => lib.character[c.id]?.group === GROUP_MAP[genre]);
		if (byGroup.length) group = byGroup;
	}
	if (group.length > 1) {
		const canonical = group.filter(c => !["★SP", "☆SP", "J.SP"].includes(c.kind));
		if (canonical.length) group = canonical;
	}
	// 还有并列(如 赵忠 zhaozhong / ol_zhaozhong 同名同势力):取无名杀标成 OL 版的那个
	if (group.length > 1) {
		const ol = group.filter(c => c.id.startsWith("ol_"));
		if (ol.length) group = ol;
	}
	return group.map(c => c.id);
}

export function computeAllowed(pool, byOurs) {
	const white = new Set(pool.white || []);
	for (const b of pool.ban || []) white.delete(b);
	const allowed = new Set();
	const unmatched = [];
	const chosen = new Map(); // 我们的名字 → 选中的无名杀 id 列表(皮肤映射用)
	for (const name of white) {
		if (DIRECT[name]) {
			const direct = DIRECT[name].filter(id => lib.character[id]);
			if (!direct.length) { unmatched.push(name); continue; }
			for (const id of direct) allowed.add(id);
			chosen.set(name, direct);
			continue;
		}
		const key = ALIAS[name] || name;
		const cands = byOurs.get(key);
		const m = key.match(/^(移动版|线下|标)?/);
		const ids = cands ? pickIds(cands, (m && m[1]) || "", pool.genre && pool.genre[name]) : [];
		if (!ids.length) { unmatched.push(name); continue; }
		for (const id of ids) allowed.add(id);
		chosen.set(name, ids);
	}
	return { allowed, unmatched, chosen };
}

// 无名杀模式 → 我们的将池环境:身份局=军争场(可在设置里换)、斗地主=斗地主池;2v2 / 1v1 池为空时回退身份局环境
const MODE_ENV = { identity: "junzheng", doudizhu: "douzhu", versus: "2v2", single: "1v1" };
function applyPool(data, mainEnv) {
	const byOurs = buildIndex();
	const total = Object.keys(lib.character).length;
	const summary = {};
	const allChosen = new Map();
	for (const [mode, env0] of Object.entries(MODE_ENV)) {
		let env = mode === "identity" ? mainEnv : env0;
		let pool = data.pools[env];
		if (!pool || !(pool.white || []).length) {
			env = mainEnv;
			pool = data.pools[env];
		}
		if (!pool) continue;
		const { allowed, unmatched, chosen } = computeAllowed({ ...pool, genre: data.genre || {} }, byOurs);
		for (const [name, ids] of chosen) allChosen.set(name, ids);
		const banned = Object.keys(lib.character).filter(id => !allowed.has(id));
		// 本地 + 联机建房(startMenu 读 connect_<mode>_banned)两份都写进内存;不存盘,池子改了下次开局自动跟
		lib.config[`${mode}_banned`] = banned.slice();
		lib.config[`connect_${mode}_banned`] = banned.slice();
		if (lib.config.mode === mode) lib.config.banned = banned.slice();
		summary[mode] = { env, allowed: allowed.size, unmatched };
		console.log(`[sgs-friends] ${mode} ← 将池「${pool.label || env}」:可用 ${allowed.size} / 无名杀共 ${total};白名单未对上 ${unmatched.length}:`, unmatched.join(" "));
	}
	const main = summary.identity || Object.values(summary)[0] || { env: mainEnv, allowed: 0, unmatched: [] };
	_status.sgsFriendsPool = { env: main.env, allowed: main.allowed, total, unmatched: main.unmatched, updatedAt: data.updatedAt, modes: summary };
	applySkins(data.skins || {}, allChosen);
}

// ---------------------------------------------------------------------------------------------
// ③ OL 皮肤:worker 把各池武将的 OL 皮肤直链一并给过来;按设置给每个武将套一张(本局随机 / 固定第一张 / 关)。
//    写进 lib.config.skin[id] = [皮肤名, url](无名杀自己的皮肤机制,setBackground 会优先取它;polyfill 已补绝对 URL)。只在内存,不落盘。
// ---------------------------------------------------------------------------------------------
function applySkins(skins, chosen) {
	if (!lib.config.skin || typeof lib.config.skin !== "object") lib.config.skin = {};
	const mode = lib.config["sgs-friends_skin_playpackconfig"] || "random";
	const mine = _status.sgsFriendsSkinIds || new Set();
	for (const id of mine) delete lib.config.skin[id];
	mine.clear();
	_status.sgsFriendsSkinIds = mine;
	if (mode === "off") return;
	let n = 0;
	for (const [name, ids] of chosen) {
		const list = skins[name];
		if (!Array.isArray(list) || !list.length) continue;
		const pick = mode === "first" ? list[0] : list[Math.floor(Math.random() * list.length)];
		if (!pick || !pick.url) continue;
		for (const id of ids) {
			lib.config.skin[id] = [pick.name || "OL", pick.url];
			mine.add(id);
			n++;
		}
	}
	console.log(`[sgs-friends] OL 皮肤:套了 ${n} 个武将(${mode})`);
}

async function loadPool() {
	const env = lib.config["sgs-friends_pool_playpackconfig"] || "junzheng";
	let data = null;
	try {
		const res = await fetch(POOL_API, { cache: "no-cache" });
		if (res.ok) {
			data = await res.json();
			try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (e) { /* 空间不足等,忽略 */ }
		}
	} catch (e) {
		console.warn("[sgs-friends] 将池接口不可达,用本地缓存:", e?.message || e);
	}
	if (!data) {
		try { data = JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); } catch (e) { data = null; }
	}
	if (!data || !data.pools || !data.pools[env]) {
		console.warn("[sgs-friends] 没有可用的将池数据,保持无名杀默认");
		return;
	}
	applyPool(data, env);
}

// 联机模式下无名杀不跑 play 包的 init/arenaReady(init/index.ts 里 connect 分支跳过 loadPlay),
// 所以把拉将池放在模块顶层:等武将表装好就跑,与模式无关;房主点「创建房间」时 connect_identity_banned 已就位。
// 注意:开局 splash(选模式)期间武将包还没装,所以不设超时,一直等到武将表出现。
// sgsFriendsTimeout:武将表出现后再起算的 6 秒兜底(splash 可能停很久,不能从模块加载就开始计时)
let armTimeout = () => {};
_status.sgsFriendsTimeout = new Promise(resolve => { armTimeout = () => setTimeout(resolve, 6000); });
_status.sgsFriendsReady = new Promise(resolve => {
	(function kickoff() {
		if (Object.keys(lib.character).length > 0) {
			armTimeout();
			loadPool().then(resolve, resolve);
		} else {
			setTimeout(kickoff, 300);
		}
	})();
});
// 本体在扩展导入完之后把 lib.onprepare 里的函数都调一遍,拿到的 promise 存成 _status.onprepare,并在 game.loop() 之前 await 它们
// (init/index.ts)。借它让开局选将等我们把禁将写好,否则首局选将框会抢在池子到达前生成。最多等 6 秒,接口挂了也不卡住游戏。
if (!Array.isArray(lib.onprepare)) lib.onprepare = [];
lib.onprepare.push(() => Promise.race([_status.sgsFriendsReady, _status.sgsFriendsTimeout]));

// ---------------------------------------------------------------------------------------------
// ② 玩家资料(无密码的「名字即账号」):同名即同一人——昵称哈希成联机 key(大厅据此认人、跨设备一致),
//    头像等资料存在我们 worker(/api/noname-profile),改昵称时拉取该名字的资料,改头像时回写。
// ---------------------------------------------------------------------------------------------
const PROFILE_API = POOL_API.replace(/\/api\/noname-pool$/, "/api/noname-profile");
const DEFAULT_NICK = "无名玩家";
function nameKey(name) {
	let h = 5381;
	for (let i = 0; i < name.length; i++) h = ((h << 5) + h + name.charCodeAt(i)) >>> 0;
	let h2 = 2166136261;
	for (let i = 0; i < name.length; i++) h2 = Math.imul(h2 ^ name.charCodeAt(i), 16777619) >>> 0;
	return `nm${h.toString(16)}${h2.toString(16)}`;
}
function currentNick() {
	const n = lib.config.connect_nickname;
	return typeof n === "string" && n.trim() && n !== DEFAULT_NICK ? n.trim() : null;
}
function applyNameKey(name) {
	const key = nameKey(name);
	try { localStorage.setItem(`${lib.configprefix}key`, key); } catch (e) { /* ignore */ }
	game.onlineKey = key;
}
let profileSyncing = false;
let pushTimer = null;
async function pullProfile(name) {
	try {
		const res = await fetch(`${PROFILE_API}?name=${encodeURIComponent(name)}`, { cache: "no-store" });
		if (!res.ok) return null;
		const data = await res.json();
		const profile = data && data.profile;
		profileSyncing = true;
		try {
			// 不用 lib.character 校验:splash 阶段武将表还没装;服务端已限制为 [\w-]+
			if (profile && typeof profile.avatar === "string" && /^[\w-]{1,40}$/.test(profile.avatar)) {
				game.saveConfig("connect_avatar", profile.avatar);
				game.saveConfig("connect_avatar", profile.avatar, "connect");
			} else {
				pushProfile(); // 新名字:把当前头像登记上去
			}
		} finally {
			profileSyncing = false;
		}
		return profile;
	} catch (e) {
		console.warn("[sgs-friends] 拉取玩家资料失败:", e?.message || e);
		return null;
	}
}
function pushProfile() {
	const name = currentNick();
	if (!name) return;
	clearTimeout(pushTimer);
	pushTimer = setTimeout(() => {
		fetch(PROFILE_API, {
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ name, avatar: lib.config.connect_avatar || "caocao" }),
		}).catch(e => console.warn("[sgs-friends] 保存玩家资料失败:", e?.message || e));
	}, 400);
}
// 挂钩 game.saveConfig:昵称变了 → 换 key 并拉资料;头像变了 → 回写
{
	const origSaveConfig = game.saveConfig;
	game.saveConfig = function (key, value, local, ...rest) {
		const prevNick = key === "connect_nickname" ? currentNick() : null;
		const r = origSaveConfig.call(this, key, value, local, ...rest);
		if (profileSyncing) return r;
		if (key === "connect_nickname") {
			const nick = currentNick();
			if (nick && nick !== prevNick) {
				applyNameKey(nick);
				_status.sgsFriendsProfileReady = pullProfile(nick);
			}
		} else if (key === "connect_avatar" && currentNick()) {
			pushProfile();
		}
		return r;
	};
}
/** 大厅里改完昵称/头像要告诉大厅(在线列表、房间卡片用的是大厅缓存的那份) */
function profileNotifyHall() {
	try {
		if (game.ws && game.ws.readyState === 1 && !game.online) {
			game.send("server", "changeAvatar", get.connectNickname(), lib.config.connect_avatar);
		}
	} catch (e) { /* 不在大厅 */ }
}
function openAvatarPicker() {
	if (!Object.keys(lib.character).length) {
		game.alert("武将表还没加载,先进入联机大厅或任一模式再换头像");
		return;
	}
	const banned = new Set(lib.config.identity_banned || []);
	let list = Object.keys(lib.character).filter(id => !banned.has(id) && !lib.character[id].isUnseen);
	if (list.length < 20) {
		list = Object.keys(lib.character).filter(id => !lib.character[id].isUnseen).slice(0, 400);
	}
	const dialog = ui.create.dialog("选择头像(点一下即换)", [list, "character"], "hidden");
	dialog.classList.add("fixed");
	for (const button of dialog.buttons) {
		button.classList.add("pointerdiv");
		button.listen(() => {
			const id = button.link;
			game.saveConfig("connect_avatar", id);
			game.saveConfig("connect_avatar", id, "connect");
			profileNotifyHall();
			dialog.close();
			game.alert(`头像已换成「${lib.translate[id] || id}」,其他设备用同名进来也会是这个头像`);
		});
	}
	dialog.open();
}
async function openProfile() {
	const name = currentNick() || DEFAULT_NICK;
	// 对话框依赖牌桌(ui.dialogs/ui.arena),开局 splash 阶段还没有 → 退化成提示
	if (!ui.dialogs || !ui.arena) {
		game.alert(`昵称「${name}」,头像 ${lib.translate[lib.config.connect_avatar] || lib.config.connect_avatar || "曹操"}。进入联机大厅或任一模式后,在大厅点自己的名字 / 扩展页「我的资料」可改名换头像。`);
		return;
	}
	let profile = null;
	try {
		const res = await fetch(`${PROFILE_API}?name=${encodeURIComponent(name)}`, { cache: "no-store" });
		if (res.ok) profile = (await res.json()).profile;
	} catch (e) { /* 离线 */ }
	const avatar = lib.config.connect_avatar || "caocao";
	const dialog = ui.create.dialog("hidden");
	dialog.classList.add("fixed");
	dialog.add('<div class="text center" style="font-size:20px">我的资料</div>');
	// 不用武将按钮(splash 阶段武将表还没装会崩),直接贴头像图
	const pic = ui.create.div(".text.center");
	const img = ui.create.div("", pic);
	Object.assign(img.style, { width: "96px", height: "96px", margin: "6px auto", borderRadius: "10px", backgroundSize: "cover", backgroundPosition: "center" });
	img.setBackground(avatar, "character");
	dialog.add(pic);
	const stat = profile ? `服务器记录:登记 ${profile.seen} 次,最近 ${new Date(profile.updatedAt).toLocaleString("zh-CN", { hour12: false })}` : "服务器暂无这个名字的记录(改名或换头像后会登记)";
	dialog.add(`<div class="text center">昵称:<b>${name}</b><br>头像:${lib.translate[avatar] || avatar}<br><span style="opacity:.75">${stat}</span><br><span style="opacity:.75">同一个昵称在任何设备进来都是同一个账号,头像跟着昵称走。</span></div>`);
	const bar = ui.create.div(".text.center");
	bar.style.padding = "6px 0";
	const mk = (label, fn) => {
		const b = ui.create.div(".menubutton.large.pointerdiv", label, bar, fn);
		b.style.margin = "4px 6px";
		b.style.display = "inline-block";
		return b;
	};
	mk("改名", async () => {
		dialog.close();
		const n = await game.promises.prompt("新的昵称(同名即同一账号,最多 12 字)", true);
		const nick = typeof n === "string" ? n.trim().slice(0, 12) : "";
		if (!nick) return;
		game.saveConfig("connect_nickname", nick);
		game.saveConfig("connect_nickname", nick, "connect");
		if (_status.sgsFriendsProfileReady) await Promise.race([_status.sgsFriendsProfileReady, new Promise(r => setTimeout(r, 1500))]);
		profileNotifyHall();
		game.alert(`已改名为「${nick}」${lib.config.connect_avatar !== avatar ? ",并换成了这个名字之前用的头像" : ""}`);
	});
	mk("换头像", () => {
		dialog.close();
		openAvatarPicker();
	});
	mk("关闭", () => dialog.close());
	dialog.add(bar);
	dialog.open();
}
lib.sgsFriends = Object.assign(lib.sgsFriends || {}, { openProfile, openAvatarPicker });

// ---------------------------------------------------------------------------------------------
// ④ 房规默认值一次性迁移:无名杀会把菜单默认值存进 IndexedDB,改 config.json/菜单 init 对老玩家无效,
//    所以按版本号迁移一次(之后玩家自己改的仍然保留)。身份局 非内奸 6 / 内奸 7;斗地主 地主 5 / 农民 3;联机同。
//    v3 起分档:候选数是 v2,显示类默认值(历史记录栏)是 v3,各跑各的。
// ---------------------------------------------------------------------------------------------
{
	const HOUSE_RULE_VERSION = 2;
	if ((lib.config["sgs-friends_houserule_playpackconfig"] || 0) < HOUSE_RULE_VERSION) {
		// 本地与联机(connect_*)的候选数都是按模式存的(startMenu:get.config("connect_choice_x", mode))
		const set = (key, value, mode) => game.saveConfig(key, value, mode);
		for (const id of ["zhu", "zhong", "fan", "commoner"]) {
			set(`choice_${id}`, 6, "identity");
			set(`connect_choice_${id}`, 6, "identity");
		}
		set("choice_nei", 7, "identity");
		set("connect_choice_nei", 7, "identity");
		set("choice_zhu", 5, "doudizhu");
		set("choice_fan", 3, "doudizhu");
		set("connect_choice_zhu", 5, "doudizhu");
		set("connect_choice_fan", 3, "doudizhu");
		set("sgs-friends_houserule_playpackconfig", HOUSE_RULE_VERSION);
		console.log("[sgs-friends] 已套用房规默认值 v" + HOUSE_RULE_VERSION);
	}
	// v3(2026-11-21,用户反馈「看不清别人在做什么」):默认打开屏幕中部的「历史记录栏」(滚动显示 谁对谁用了什么 / 发动了什么技能)。
	// 单独一档,不重跑上面的候选数(玩家自己改过的要保留);不想要的人在 选项→显示→历史记录栏 里关。
	const DISPLAY_VERSION = 3;
	if ((lib.config["sgs-friends_houserule_playpackconfig"] || 0) < DISPLAY_VERSION) {
		if (!lib.config.show_log || lib.config.show_log === "off") game.saveConfig("show_log", "center");
		game.saveConfig("sgs-friends_houserule_playpackconfig", DISPLAY_VERSION);
		console.log("[sgs-friends] 已打开历史记录栏(居中) v" + DISPLAY_VERSION);
	}
}

// 启动:已有昵称的老玩家也按名字对齐 key、拉一次资料(别的设备上改过头像会同步过来)
{
	const nick = currentNick();
	if (nick) {
		applyNameKey(nick);
		_status.sgsFriendsProfileReady = pullProfile(nick);
	}
}

// ---------------------------------------------------------------------------------------------
// ⑤ 技能常驻栏:每个武将头像下方常驻显示技能名;轮到自己可发动的技能变绿;被封锁的(非锁定技)画锁。
//    纯显示层:挂在 player 元素上,靠包一层 player.update / addSkill / removeSkill / disableSkill / enableSkill / init
//    和 game.check / game.uncheck 来刷新。
// ---------------------------------------------------------------------------------------------
(() => {
	// 不用 lib.init.sheet:扩展导入时 ui.css 还没建,会抛错把整个扩展打断
	const style = document.createElement("style");
	style.textContent = `
.player .sgs-skillbar{position:absolute;left:3px;right:3px;bottom:12px;display:flex;flex-wrap:wrap;gap:2px;justify-content:center;pointer-events:none;z-index:6}
.player .sgs-skillbar span{font-size:10px;line-height:14px;padding:0 4px;border-radius:4px;background:rgba(0,0,0,.62);color:#efe6d2;white-space:nowrap;font-family:xinwei,"PingFang SC",sans-serif;letter-spacing:.5px}
.player .sgs-skillbar span.usable{background:#2f9e5a;color:#fff;box-shadow:0 0 6px #2f9e5a}
.player .sgs-skillbar span.locked{opacity:.55;text-decoration:line-through}
.player .sgs-skillbar span.locked::before{content:"🔒";font-size:9px;margin-right:1px}
#arena.chess .player .sgs-skillbar,#arena.stone .player .sgs-skillbar{display:none}`;
	document.head.appendChild(style);
})();
function skillbarUsableSet() {
	const set = new Set();
	for (const bar of [ui.skills, ui.skills2, ui.skills3]) {
		if (bar && bar.skills && bar.style.display !== "none") for (const s of bar.skills) set.add(s);
	}
	return set;
}
function refreshSkillBar(player) {
	try {
		if (!player || !player.node || !player.classList || player.classList.contains("unseen2")) return;
		if (lib.config["sgs-friends_skillbar_playpackconfig"] === "off") {
			if (player.sgsSkillbar) player.sgsSkillbar.remove(), delete player.sgsSkillbar;
			return;
		}
		if (!player.name) {
			if (player.sgsSkillbar) player.sgsSkillbar.innerHTML = "", (player.sgsSkillbar._sgsHtml = "");
			return;
		}
		let bar = player.sgsSkillbar;
		if (!bar || bar.parentNode !== player) {
			bar = ui.create.div(".sgs-skillbar", player);
			player.sgsSkillbar = bar;
		}
		const usable = player === game.me ? skillbarUsableSet() : new Set();
		const disabled = player.disabledSkills || {};
		const skills = player.getSkills(null, false, false);
		let html = "";
		for (const skill of skills) {
			const info = lib.skill[skill];
			const name = lib.translate[skill];
			if (!info || !name || skill.startsWith("_") || info.charlotte || info.ruleSkill || info.sub || info.nopop || info.equipSkill) continue;
			const isLocked = get.is.locked ? get.is.locked(skill, player) : !!(info.forced || info.locked); // 锁定技
			const blocked = !isLocked && (!!disabled[skill] || (get.is.blocked ? get.is.blocked(skill, player) : false));
			const cls = usable.has(skill) ? "usable" : blocked ? "locked" : "";
			html += `<span class="${cls}" data-skill="${skill}">${name}</span>`;
		}
		if (bar._sgsHtml !== html) {
			bar._sgsHtml = html;
			bar.innerHTML = html;
		}
	} catch (e) { /* 显示层,出错不影响对局 */ }
}
function refreshAllSkillBars() {
	for (const p of game.players || []) refreshSkillBar(p);
}
try {
	const proto = lib.element.player;
	const wrap = (method, after) => {
		const orig = proto[method];
		if (typeof orig !== "function") return;
		proto[method] = function (...args) {
			const r = orig.apply(this, args);
			try { after(this, r); } catch (e) { /* ignore */ }
			return r;
		};
	};
	for (const m of ["update", "addSkill", "removeSkill", "disableSkill", "enableSkill", "init", "addSkills", "removeSkills"]) {
		wrap(m, player => refreshSkillBar(player));
	}
	const origCheck = game.check;
	game.check = function (...args) {
		const r = origCheck.apply(this, args);
		try { if (game.me) refreshSkillBar(game.me); } catch (e) { /* ignore */ }
		return r;
	};
	const origUncheck = game.uncheck;
	game.uncheck = function (...args) {
		const r = origUncheck.apply(this, args);
		try { if (game.me) refreshSkillBar(game.me); } catch (e) { /* ignore */ }
		return r;
	};
} catch (e) {
	console.error("[sgs-friends] 技能常驻栏初始化失败:", e);
}
lib.sgsFriends = Object.assign(lib.sgsFriends || {}, { refreshAllSkillBars });

// ---------------------------------------------------------------------------------------------
// ⑥ 技能详情浮框(用户 2026-11-21:不想双击看技能):鼠标移到 / 点到头像下方的技能名上,立刻弹出该技能的描述;
//    鼠标移出技能名和浮框后消失。触屏:点技能名弹出,点别处收起。点击照常冒泡给武将牌(选目标不受影响)。
// ---------------------------------------------------------------------------------------------
(() => {
	const style = document.createElement("style");
	style.textContent = `
.player .sgs-skillbar span{pointer-events:auto;cursor:help}
#sgs-skilltip{position:absolute;z-index:1000;box-sizing:border-box;width:300px;max-width:calc(100% - 16px);padding:9px 12px 10px;border-radius:8px;background:rgba(26,21,16,.95);border:1px solid rgba(214,182,120,.5);box-shadow:0 6px 22px rgba(0,0,0,.55);color:#efe6d2;font-size:14px;line-height:1.6;text-align:left;white-space:normal;font-family:"PingFang SC","Microsoft YaHei",sans-serif;pointer-events:auto;transition:none;height:auto}
#sgs-skilltip div{position:relative;display:block;transition:none}
#sgs-skilltip .t{font-family:xinwei,"PingFang SC",sans-serif;font-size:17px;color:#f3c96b;margin-bottom:3px}
#sgs-skilltip .t small{font-family:"PingFang SC","Microsoft YaHei",sans-serif;font-size:12px;color:#b9ad95;margin-left:8px}`;
	document.head.appendChild(style);

	let tip = null, anchorSpan = null, hideTimer = null, guard = null, lastXY = null;
	const spanOf = target => (target && target.closest ? target.closest(".sgs-skillbar span[data-skill]") : null);
	const inTip = target => !!(tip && target && tip.contains(target));
	const hide = () => {
		clearTimeout(hideTimer);
		clearInterval(guard);
		hideTimer = guard = null;
		anchorSpan = null;
		if (tip) tip.remove(), (tip = null);
	};
	const hideSoon = () => {
		clearTimeout(hideTimer);
		hideTimer = setTimeout(hide, 180); // 留一点时间把鼠标挪进浮框
	};
	const show = (span, e) => {
		try {
			if (!ui.window) return;
			clearTimeout(hideTimer);
			if (anchorSpan === span && tip) return;
			const skill = span.dataset.skill;
			const player = span.closest(".player");
			let info = "";
			try { info = get.skillInfoTranslation(skill, player, false); } catch (err) { /* 个别技能的动态描述会抛错 */ }
			if (!info) info = lib.translate[skill + "_info"] || "";
			if (!info) return;
			hide();
			anchorSpan = span;
			tip = document.createElement("div");
			tip.id = "sgs-skilltip";
			const owner = player && player.name ? get.translation(player.name) : "";
			tip.innerHTML = `<div class="t">${lib.translate[skill] || skill}${owner ? `<small>${owner}</small>` : ""}</div><div>${info}</div>`;
			ui.window.appendChild(tip);
			tip.addEventListener("mouseenter", () => clearTimeout(hideTimer));
			tip.addEventListener("mouseleave", hide);
			// 位置按指针算(无名杀的界面缩放下,指针坐标 / documentZoom 才是 #window 里的坐标)
			const zoom = game.documentZoom || 1;
			const point = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0] : e;
			const x = point.clientX / zoom, y = point.clientY / zoom;
			const W = ui.window.offsetWidth, H = ui.window.offsetHeight, w = tip.offsetWidth, h = tip.offsetHeight;
			const left = Math.max(8, Math.min(W - w - 8, x - w / 2));
			const top = y + 14 + h <= H - 8 ? y + 14 : Math.max(8, y - 14 - h); // 下面放得下就放下面,否则放上面
			tip.style.left = left + "px";
			tip.style.top = top + "px";
			// 悬停期间压住无名杀自带的「悬停 1 秒弹武将资料」,免得两个框叠在一起;
			// 顺带兜底:指针已经不在技能名 / 浮框上(元素被重绘、窗口切走)就收起
			guard = setInterval(() => {
				try { ui.click.mouseentercancel && ui.click.mouseentercancel(); } catch (err) { /* ignore */ }
				if (!anchorSpan || !anchorSpan.isConnected) return hide();
				if (lastXY && !("ontouchstart" in window && lastXY.touch)) {
					const el = document.elementFromPoint(lastXY.x, lastXY.y);
					if (!inTip(el) && spanOf(el) !== anchorSpan) hideSoon();
				}
			}, 250);
		} catch (err) { /* 显示层,出错不影响对局 */ }
	};
	document.addEventListener("mousemove", e => { lastXY = { x: e.clientX, y: e.clientY }; }, true);
	document.addEventListener("mouseover", e => {
		const span = spanOf(e.target);
		if (span) show(span, e);
	}, true);
	document.addEventListener("mouseout", e => {
		if (spanOf(e.target) && !inTip(e.relatedTarget) && spanOf(e.relatedTarget) !== anchorSpan) hideSoon();
	}, true);
	// 点击 / 触屏:点技能名弹出(已弹出的再点一次收起),点别处收起
	const tap = e => {
		const span = spanOf(e.target);
		if (span) {
			if (e.type === "touchend") lastXY = { touch: true };
			if (anchorSpan === span && tip && e.type === "touchend") hide();
			else show(span, e);
		} else if (!inTip(e.target)) hide();
	};
	document.addEventListener("click", tap, true);
	document.addEventListener("touchend", tap, true);
	window.addEventListener("resize", hide);
})();

// ---------------------------------------------------------------------------------------------
// ⑦ 牌桌上的武将牌放大(用户 2026-11-21:武将在牌桌上可以更大一点):按窗口大小自动算一个倍率(1~1.35),
//    以不挤到邻座、不顶出屏幕为限;用独立的 CSS scale / translate 属性(上沿不动往下长),不和无名杀自己的 transform(横置、受伤抖动等)打架。
//    自己那张(左下角,紧挨手牌)不放大。布局是固定像素写的,所以只能整体缩放,不能单独改宽高。
// ---------------------------------------------------------------------------------------------
const PLAYER_SCALE_MAX = 1.35;
function refreshPlayerScale() {
	try {
		const arena = ui.arena;
		if (!arena) return;
		let scale = 1;
		if (lib.config["sgs-friends_bigplayer_playpackconfig"] !== "off" && !game.chess) {
			const nodes = [...arena.children].filter(node => node.classList.contains("player") && node.dataset.position !== "0" && !node.classList.contains("minskin") && node.offsetWidth);
			if (nodes.length) {
				scale = PLAYER_SCALE_MAX;
				const w = nodes[0].offsetWidth, h = nodes[0].offsetHeight, gap = 6;
				for (let i = 0; i < nodes.length; i++) {
					const a = nodes[i];
					// 左右居中放大、上沿不动往下长(见下面 css 的 translate)。边界:左右不出屏幕,下面不压到自己的武将牌 / 手牌区
					scale = Math.min(scale, 1 + (2 * (a.offsetLeft + arena.offsetLeft - 2)) / w, 1 + (2 * (arena.offsetWidth + arena.offsetLeft - a.offsetLeft - w - 2)) / w, (arena.offsetHeight - 250 - a.offsetTop) / h);
					for (let j = i + 1; j < nodes.length; j++) {
						const b = nodes[j];
						const dx = Math.abs(a.offsetLeft - b.offsetLeft), dy = Math.abs(a.offsetTop - b.offsetTop);
						// 两张牌放大后各自宽 w*s / 高 h*s,横向或纵向有一边分得开即可
						scale = Math.min(scale, Math.max((dx - gap) / w, (dy - gap) / h));
					}
				}
				scale = Math.max(1, Math.round(scale * 100) / 100);
			}
		}
		const first = arena.querySelector(':scope > .player:not(.minskin):not([data-position="0"])');
		const shift = Math.round(((scale - 1) * (first ? first.offsetHeight : 200)) / 2); // 往下挪半个增量 = 上沿不动
		if (arena._sgsScale !== scale || arena._sgsShift !== shift) {
			arena._sgsScale = scale;
			arena._sgsShift = shift;
			arena.style.setProperty("--sgs-pscale", String(scale));
			arena.style.setProperty("--sgs-pshift", shift + "px");
		}
	} catch (e) { /* 显示层,出错不影响对局 */ }
}
(() => {
	const style = document.createElement("style");
	style.textContent = `
#arena > .player:not(.minskin):not([data-position="0"]){scale:var(--sgs-pscale,1);translate:0 var(--sgs-pshift,0px)}
#arena:not(.oldlayout) > #arenalog[data-position="center"]{top:calc(240px + var(--sgs-pshift,0px) * 2);height:calc(100% - 430px - var(--sgs-pshift,0px) * 2)}`;
	document.head.appendChild(style);
	window.addEventListener("resize", () => setTimeout(refreshPlayerScale, 300));
	setInterval(refreshPlayerScale, 1500); // 人数变化 / 布局切换没有统一的钩子,低频轮询即可
})();
lib.sgsFriends = Object.assign(lib.sgsFriends || {}, { refreshPlayerScale });

// ---------------------------------------------------------------------------------------------
// ⑧ OL 的固定牌堆:界左慈〖化身〗的武将牌堆 = 界限突破 + 界一将成名(89 将,不含左慈;名单 = 房间工具 room-logic.mjs HUASHEN_PACKS 的产出,
//    武将库里这两个包有增减时要同步这里)。mode 补丁里的 rehuashen.getOLPool() 来取;按我们的名字对到无名杀 id,口径同将池(DIRECT / pickIds)。
// ---------------------------------------------------------------------------------------------
const HUASHEN_NAMES = [
	"界黄忠", "界刘备", "界关羽", "界张飞", "界赵云", "界马超", "界徐庶", "界甘宁", "界吕蒙", "界黄盖", "界周瑜", "界大乔", "界陆逊", "界曹操", "界司马懿", "界夏侯惇", "界张辽", "界许褚", "界郭嘉", "界李典", "界华佗",
	"界吕布", "界公孙瓒", "界诸葛亮", "界黄月英", "界孙权", "界孙尚香", "界甄姬", "界貂蝉", "界华雄", "界张角", "界于吉", "界袁绍", "界刘禅", "界孙策", "界夏侯渊", "界卧龙诸葛亮", "界庞统", "界魏延", "界小乔", "界孙坚",
	"界庞德", "界太史慈", "界董卓", "界邓艾", "界祝融", "界姜维", "界贾诩", "界鲁肃", "界张郃", "界孟获", "界徐晃", "界蔡文姬", "界荀彧", "界典韦", "界颜良文丑", "界张昭张纮", "界徐盛", "界凌统", "界陈宫", "界曹彰",
	"界简雍", "界虞翻", "界高顺", "界法正", "界程普", "界王异", "界张春华", "界刘表", "界蔡夫人", "界曹冲", "界曹植", "界吴国太", "界廖化", "界李儒", "界郭淮", "界伏皇后", "界韩当", "界关兴张苞", "界马岱", "界郭皇后",
	"界沮授", "界夏侯氏", "界张松", "界于禁", "界步练师", "界钟会", "界刘封", "界关平",
];
// 我们的叫法 ≠ 无名杀叫法(这三个目前不在线上将池里,先只给化身牌堆用;进池时挪到上面的 ALIAS)
const HUASHEN_ALIAS = { "界甄姬": "界甄宓", "界卧龙诸葛亮": "界卧龙", "界蔡文姬": "界蔡琰" };
function huashenIds() {
	if (Array.isArray(_status.sgsHuashenIds)) return _status.sgsHuashenIds;
	if (!Object.keys(lib.character).length) return [];
	const byOurs = buildIndex();
	const ids = [];
	for (const name of HUASHEN_NAMES) {
		let list = DIRECT[name] ? DIRECT[name].filter(id => lib.character[id]) : [];
		if (!list.length) {
			const cands = byOurs.get(HUASHEN_ALIAS[name] || ALIAS[name] || name);
			list = cands ? pickIds(cands, "", null) : [];
		}
		if (list.length) ids.push(list[0]);
	}
	_status.sgsHuashenIds = ids;
	console.log(`[sgs-friends] 化身牌堆:${ids.length} / ${HUASHEN_NAMES.length} 将对上`);
	return ids;
}
lib.sgsFriends = Object.assign(lib.sgsFriends || {}, { huashenIds });

game.import("play", function () {
	return {
		name: "sgs-friends",
		init() {},
		arenaReady() {
			setTimeout(refreshAllSkillBars, 500);
			// 进入牌局时若池子已到,保证 lib.config.banned 是最新的(loading.ts 在模式加载时会用 identity_banned 覆盖一次)
			if (_status.sgsFriendsPool && lib.config[`${lib.config.mode}_banned`]) lib.config.banned = lib.config[`${lib.config.mode}_banned`].slice();
		},
		config: {
			pool: {
				name: "将池环境",
				init: "junzheng",
				item: { junzheng: "军争场(5人及以上)", "2v2": "2v2(4人)", douzhu: "斗地主(3人)", "1v1": "1v1(2人)" },
				intro: "身份局用这里选的环境;斗地主固定用「斗地主池」,2v2 / 1v1 各用自己的池(空则回退本环境)。不在池里的武将自动禁用;改完要重开一局",
				onclick(item) {
					game.saveConfig("sgs-friends_pool_playpackconfig", item);
					loadPool();
				},
			},
			profile: {
				name: "我的资料(改名 / 换头像)",
				clear: true,
				onclick() {
					game.closeMenu?.();
					openProfile();
				},
			},
			skillbar: {
				name: "技能常驻栏",
				init: "on",
				item: { on: "开启", off: "关闭" },
				intro: "每个武将头像下方常驻显示技能名:可发动的变绿,被封锁的画锁;鼠标移到(或点一下)技能名上弹出技能描述",
				onclick(item) {
					game.saveConfig("sgs-friends_skillbar_playpackconfig", item);
					refreshAllSkillBars();
				},
			},
			bigplayer: {
				name: "牌桌武将放大",
				init: "on",
				item: { on: "自动(按窗口大小,最多 1.35 倍)", off: "关闭" },
				intro: "牌桌上其他角色的武将牌按窗口大小自动放大,以不挤到邻座为限;自己那张紧挨手牌,不放大",
				onclick(item) {
					game.saveConfig("sgs-friends_bigplayer_playpackconfig", item);
					refreshPlayerScale();
				},
			},
			skin: {
				name: "OL 皮肤",
				init: "random",
				item: { random: "每次开局随机一张", first: "固定第一张", off: "关闭(用无名杀原画)" },
				intro: "把 OL 的皮肤立绘套到池内武将上(头像、选将框都生效);图片来自 OL 官网直链",
				onclick(item) {
					game.saveConfig("sgs-friends_skin_playpackconfig", item);
					loadPool();
				},
			},
			refresh: {
				name: "重新拉取将池",
				clear: true,
				onclick() {
					loadPool().then(() => {
						const p = _status.sgsFriendsPool;
						game.alert(p ? `将池「${p.env}」已更新:可用 ${p.allowed} 将,白名单未对上 ${p.unmatched.length} 个(见控制台)` : "将池拉取失败");
					});
				},
			},
		},
		help: {
			"朋友圈牌桌": "<ul><li>将池:每局开始前从 sgs-wiki 房间的将池读白/黑名单,不在池里的武将自动禁用(联机房也一样,以房主为准)。</li><li>身份局变体:暴虐无道 / 大忠似奸 / 失心疯 / 无间道(选项→身份→游戏模式)。</li><li>名字即账号:同一个昵称在任何设备进来都是同一人,头像等资料跟着名字走(存在 sgs-wiki 房间服务器,无需密码)。</li></ul>",
		},
	};
});
