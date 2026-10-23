#!/usr/bin/env bash
# 无名杀 dist 发 Cloudflare Pages 前的后处理(幂等):
#  1) wrangler pages deploy 忽略任意深度的 node_modules 目录 → 全部改名 nm,并改写代码里的路径引用
#  2) 加 404.html 关闭 Pages 的 SPA 回退(缺失路径必须真 404,只读 fs 适配器靠它探测文件)
#  3) 加 _headers 让 .ts 以 JS MIME 返回(service worker 的 TS 即时编译探测用)
set -euo pipefail
DIST="${1:?dist dir}"
find "$DIST" -depth -type d -name node_modules -not -path "*/audio/*" -not -path "*/image/*" | while read -r d; do
  mv "$d" "$(dirname "$d")/nm"
done
grep -rl --include=*.js --include=*.html --include=*.ts --include=*.css --include=*.json --include=*.mjs "node_modules/" "$DIST" \
  --exclude-dir=audio --exclude-dir=image --exclude-dir=extension --exclude=service-worker.js \
  | while read -r f; do sed -i '' 's#node_modules/#nm/#g' "$f"; done
# service-worker.js 里打包了 typescript,其内部字符串也含 node_modules/,只改路径形态的引用
sed -i '' -E 's#(["'"'"'`]|/)node_modules/\.pnpm/#\1nm/.pnpm/#g; s#(nm/\.pnpm/[^"'"'"'`]*)/node_modules/#\1/nm/#g' "$DIST/service-worker.js"
printf '<!doctype html><meta charset="utf-8"><title>404</title><p>404 Not Found</p>\n' > "$DIST/404.html"
printf '/*.ts\n  Content-Type: application/javascript; charset=utf-8\n' > "$DIST/_headers"
echo "postbuild ok: $(find "$DIST" -type d -name node_modules -not -path "*/audio/*" -not -path "*/image/*" | wc -l | tr -d ' ') node_modules dirs left; $(grep -rlE --include=*.js --include=*.html 'node_modules/' "$DIST" --exclude-dir=audio --exclude-dir=image --exclude-dir=extension --exclude=service-worker.js | wc -l | tr -d ' ') files still mention node_modules/"
