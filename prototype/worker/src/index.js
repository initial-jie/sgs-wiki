// 桌游线下房间 worker 入口(一个 worker 托管多个游戏)—— 只做路由,各游戏逻辑在各自目录。
//   /hub                             游戏大厅(prototype/common/client/hub.html,清单 common/games.mjs;/common/games.json 同清单)
//   /common/room-client.js           公共房间客户端(prototype/common/client/,下发时注入游戏清单)
//   /api/room/<码>/ws、/、/sgs、/*.json   三国杀(prototype/sgs/worker.mjs,DO 类 RoomDO)
//   /pool、/api/pool                   三国杀将池(白名单)编辑页 + 读写(DO 类 SgsConfigDO,全局单例)
//   /fs、/fs/data.json、/api/fs/<码>/ws  风声(prototype/fengsheng/worker.mjs,DO 类 FsRoomDO)
//   /qmxy、/qmxy/data.json、/api/qmxy/<码>/ws  枪鸣锈语(prototype/qmxy/worker.mjs,DO 类 QmxyRoomDO)
//   /onuw、/onuw/data.json、/api/onuw/<码>/ws  一夜终极狼人(prototype/onuw/worker.mjs,DO 类 OnuwRoomDO)
//   /avalon、/avalon/data.json、/api/avalon/<码>/ws  阿瓦隆(prototype/avalon/worker.mjs,DO 类 AvalonRoomDO)
// 本地跑:cd prototype/worker && npx wrangler dev      部署:npx wrangler deploy

import { handleSgs, RoomDO, SgsConfigDO } from "../../sgs/worker.mjs";
import { handleFengsheng, FsRoomDO } from "../../fengsheng/worker.mjs";
import { handleQmxy, QmxyRoomDO } from "../../qmxy/worker.mjs";
import { handleOnuw, OnuwRoomDO } from "../../onuw/worker.mjs";
import { handleAvalon, AvalonRoomDO } from "../../avalon/worker.mjs";
import { jsResponse, htmlResponse, jsonResponse } from "../../common/room-do.mjs";
import { GAMES_JSON, injectGames } from "../../common/games.mjs";
import HUB_HTML_RAW from "../../common/client/hub.html";
import { NonameHallDO } from "../../noname/hall-do.mjs"; // 无名杀联机大厅中转(DO 单例,绑定 NONAME_HALL)
import ROOM_CLIENT_JS_RAW from "../../common/client/room-client.js"; // Text 模块(见 wrangler.toml [[rules]])
const ROOM_CLIENT_JS = injectGames(ROOM_CLIENT_JS_RAW), HUB_HTML = injectGames(HUB_HTML_RAW);

export { RoomDO, FsRoomDO, QmxyRoomDO, OnuwRoomDO, AvalonRoomDO, SgsConfigDO, NonameHallDO }; // 三国杀 DO(类名固定,绑定 ROOM)/ 风声 DO(绑定 FS_ROOM)/ 枪鸣锈语 DO(绑定 QMXY_ROOM)/ 一夜狼 DO(绑定 ONUW_ROOM)/ 阿瓦隆 DO(绑定 AVALON_ROOM)/ 三国杀全局配置 DO(绑定 SGS_CONFIG,存将池)

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/common/room-client.js") return jsResponse(ROOM_CLIENT_JS);
    if (request.method === "GET" && (url.pathname === "/hub" || url.pathname === "/hub/")) return htmlResponse(HUB_HTML);
    if (request.method === "GET" && url.pathname === "/common/games.json") return jsonResponse(GAMES_JSON, 60);
    // 无名杀联机大厅:客户端「联机大厅」填 wss://<worker>/noname/(末尾斜杠可有可无)
    if (url.pathname === "/noname" || url.pathname === "/noname/") return env.NONAME_HALL.get(env.NONAME_HALL.idFromName("hall")).fetch(request);

    const r = handleFengsheng(request, env, url) || handleQmxy(request, env, url) || handleOnuw(request, env, url) || handleAvalon(request, env, url) || handleSgs(request, env, url);
    if (r) return r;

    // 兜底:其余 GET 吐三国杀房间页(历史行为:任何路径都能打开房间)
    if (request.method === "GET") return handleSgs(new Request(new URL("/", url), request), env, new URL("/", url));
    return new Response("room worker up.", { status: 200 });
  },
};
