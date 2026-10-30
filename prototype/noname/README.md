# 无名杀(noname)私用部署资料

- `hall-do.mjs` —— 联机大厅中转的 Durable Object 移植(worker 路由 `/noname/`,协议同官方 `packages/server`)。
- `patches/static-hosting.patch` —— 对 noname 仓库(基于 `b481b17`,老基线 1a548c9 也能套)的改动:`init/browser.js` 无文件后端时退化为只读静态适配器;`library/index.js` 默认 hallURL 指向我们的 DO + 菜单默认值;`mode/connect.js` 首次取昵称并直连大厅;`game/config.json` 默认值(关自动确认/问无懈自己/显示不无懈按钮/跳过新手向导);`init/index.ts` 手机免触屏确认;`mode/identity.js` + `layout.css` 身份局变体「暴虐无道」。
- `patches/jit-service-worker.patch` —— jit service worker 同源也拦截(线上 .ts 扩展即时编译)。
- `extension/sgs-friends/` —— 我们的无名杀扩展(内置 play 包):① 将池——开局从 worker `/api/noname-pool` 读白/黑名单(按武将名+势力),对到无名杀 id,池外武将全部禁用(本地+联机建房);② 身份局变体(进行中)。**装法**:`cp -R prototype/noname/extension/sgs-friends <noname>/apps/core/extension/`,补丁里已把它登记进 `game/package.js` 的 play 表、`config.json` 的 `stockextension`,并在 `init/index.ts` 强制加载。
- `postbuild.sh` —— `pnpm build` 之后、`wrangler pages deploy` 之前跑:`node_modules`→`nm` 改名+改写引用、加 `404.html`、加 `_headers`。

完整流程与验证法见 `docs/HANDOFF.md`「🧪 线上牌桌方向」。
