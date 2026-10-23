// 桌游线下房间 worker 入口(一个 worker 托管多个游戏)—— 只做路由,各游戏逻辑在各自目录。
//   /common/room-client.js           公共房间客户端(prototype/common/client/)
//   /api/room/<码>/ws、/、/sgs、/*.json   三国杀(prototype/sgs/worker.mjs,DO 类 RoomDO)
//   /pool、/api/pool                   三国杀将池(白名单)编辑页 + 读写(DO 类 SgsConfigDO,全局单例)
//   /fs、/fs/data.json、/api/fs/<码>/ws  风声(prototype/fengsheng/worker.mjs,DO 类 FsRoomDO)
// 本地跑:cd prototype/worker && npx wrangler dev      部署:npx wrangler deploy

import { handleSgs, RoomDO, SgsConfigDO } from "../../sgs/worker.mjs";
import { handleFengsheng, FsRoomDO } from "../../fengsheng/worker.mjs";
import { jsResponse } from "../../common/room-do.mjs";
import { NonameHallDO } from "../../noname/hall-do.mjs"; // 无名杀联机大厅中转(DO 单例,绑定 NONAME_HALL)
import ROOM_CLIENT_JS from "../../common/client/room-client.js"; // Text 模块(见 wrangler.toml [[rules]])

export { RoomDO, FsRoomDO, SgsConfigDO, NonameHallDO }; // 三国杀 DO(类名固定,绑定 ROOM)/ 风声 DO(绑定 FS_ROOM)/ 三国杀全局配置 DO(绑定 SGS_CONFIG,存将池)

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/common/room-client.js") return jsResponse(ROOM_CLIENT_JS);
    // 无名杀联机大厅:客户端「联机大厅」填 wss://<worker>/noname/(末尾斜杠可有可无)
    if (url.pathname === "/noname" || url.pathname === "/noname/") return env.NONAME_HALL.get(env.NONAME_HALL.idFromName("hall")).fetch(request);

    const r = handleFengsheng(request, env, url) || handleSgs(request, env, url);
    if (r) return r;

    // 兜底:其余 GET 吐三国杀房间页(历史行为:任何路径都能打开房间)
    if (request.method === "GET") return handleSgs(new Request(new URL("/", url), request), env, new URL("/", url));
    return new Response("room worker up.", { status: 200 });
  },
};
