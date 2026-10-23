# 无名杀(noname)私用部署资料

- `hall-do.mjs` —— 联机大厅中转的 Durable Object 移植(worker 路由 `/noname/`,协议同官方 `packages/server`)。
- `patches/static-hosting.patch` —— 对 noname 仓库(基于 `1a548c9`)的改动:`init/browser.js` 无文件后端时退化为只读静态适配器;`library/index.js` 默认 hallURL 指向我们的 DO。
- `patches/jit-service-worker.patch` —— jit service worker 同源也拦截(线上 .ts 扩展即时编译)。
- `postbuild.sh` —— `pnpm build` 之后、`wrangler pages deploy` 之前跑:`node_modules`→`nm` 改名+改写引用、加 `404.html`、加 `_headers`。

完整流程与验证法见 `docs/HANDOFF.md`「🧪 线上牌桌方向」。
