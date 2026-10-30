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
const ALIAS = { "冯方女": "冯方" };
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
	for (const name of white) {
		const key = ALIAS[name] || name;
		const cands = byOurs.get(key);
		const m = key.match(/^(移动版|线下|标)?/);
		const ids = cands ? pickIds(cands, (m && m[1]) || "", pool.genre && pool.genre[name]) : [];
		if (!ids.length) { unmatched.push(name); continue; }
		for (const id of ids) allowed.add(id);
	}
	return { allowed, unmatched };
}

function applyPool(pool, env) {
	const byOurs = buildIndex();
	const { allowed, unmatched } = computeAllowed(pool, byOurs);
	const banned = Object.keys(lib.character).filter(id => !allowed.has(id));
	// 本地身份局 + 联机建房(startMenu 读 connect_identity_banned)两份都写进内存;不存盘,池子改了下次开局自动跟
	lib.config.identity_banned = banned.slice();
	lib.config.connect_identity_banned = banned.slice();
	if (lib.config.mode === "identity") lib.config.banned = banned.slice();
	const total = Object.keys(lib.character).length;
	console.log(`[sgs-friends] 将池「${pool.label || env}」:可用 ${allowed.size} / 无名杀共 ${total};白名单未对上 ${unmatched.length}:`, unmatched.join(" "));
	_status.sgsFriendsPool = { env, allowed: allowed.size, total, unmatched, updatedAt: pool.updatedAt };
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
	applyPool({ ...data.pools[env], genre: data.genre || {}, updatedAt: data.updatedAt }, env);
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

game.import("play", function () {
	return {
		name: "sgs-friends",
		init() {},
		arenaReady() {
			// 进入牌局时若池子已到,保证 lib.config.banned 是最新的(loading.ts 在模式加载时会用 identity_banned 覆盖一次)
			if (_status.sgsFriendsPool && lib.config.mode === "identity") lib.config.banned = lib.config.identity_banned.slice();
		},
		config: {
			pool: {
				name: "将池环境",
				init: "junzheng",
				item: { junzheng: "军争场(5人及以上)", "2v2": "2v2(4人)", douzhu: "斗地主(3人)", "1v1": "1v1(2人)" },
				intro: "开局从 sgs-wiki 房间的将池读白/黑名单,不在池里的武将自动禁用;改完要重开一局",
				onclick(item) {
					game.saveConfig("sgs-friends_pool_playpackconfig", item);
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
			"朋友圈牌桌": "<ul><li>将池:每局开始前从 sgs-wiki 房间的将池读白/黑名单,不在池里的武将自动禁用(联机房也一样,以房主为准)。</li><li>后续:暴虐无道 / 大忠似奸 / 失心疯 / 无间道 等身份局变体。</li></ul>",
		},
	};
});
