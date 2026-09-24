// 桌游线下房间 worker 入口(一个 worker 托管多个游戏)—— 只做路由,各游戏逻辑在各自目录。
//   /common/room-client.js           公共房间客户端(prototype/common/client/)
//   /api/room/<码>/ws、/、/sgs、/*.json   三国杀(prototype/sgs/worker.mjs,DO 类 RoomDO)
//   /fs、/fs/data.json、/api/fs/<码>/ws  风声(prototype/fengsheng/worker.mjs,DO 类 FsRoomDO)
// 本地跑:cd prototype/worker && npx wrangler dev      部署:npx wrangler deploy

import { handleSgs, RoomDO } from "../../sgs/worker.mjs";
import { handleFengsheng, FsRoomDO } from "../../fengsheng/worker.mjs";
import { jsResponse } from "../../common/room-do.mjs";
import ROOM_CLIENT_JS from "../../common/client/room-client.js"; // Text 模块(见 wrangler.toml [[rules]])

export { RoomDO, FsRoomDO }; // 三国杀 DO(类名固定,绑定 ROOM)/ 风声 DO(绑定 FS_ROOM)

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/common/room-client.js") return jsResponse(ROOM_CLIENT_JS);

    const r = handleFengsheng(request, env, url) || handleSgs(request, env, url);
    if (r) return r;

    // 兜底:其余 GET 吐三国杀房间页(历史行为:任何路径都能打开房间)
    if (request.method === "GET") return handleSgs(new Request(new URL("/", url), request), env, new URL("/", url));
    return new Response("room worker up.", { status: 200 });
  },
};
