#!/usr/bin/env bash
# 查无名杀上游有没有更新 / 有没有实现某些武将。用法:
#   prototype/noname/check-upstream.sh            # 只看上游最近提交 + 我们补丁基线
#   prototype/noname/check-upstream.sh 王皑 界钟会  # 再查这些名字在上游武将包里的实现(GitHub 代码搜索,需 gh 已登录)
# 查到了 → 重新 clone + 打补丁 + 打包发布(README 流程),将池按名字自动对上。
set -euo pipefail
export PATH="/opt/homebrew/bin:$PATH"
BASE=$(grep -oE '基于 `[0-9a-f]{7}`' "$(dirname "$0")/README.md" | head -1 | grep -oE '[0-9a-f]{7}' || echo "?")
echo "== 我们的补丁基线: $BASE"
echo "== 上游 libnoname/noname 最近提交:"
gh api 'repos/libnoname/noname/commits?per_page=5' --jq '.[] | "  \(.sha[0:7])  \(.commit.committer.date[0:10])  \(.commit.message | split("\n")[0])"'
if [ "$BASE" != "?" ]; then
  AHEAD=$(gh api "repos/libnoname/noname/compare/$BASE...main" --jq '.ahead_by' 2>/dev/null || echo "?")
  echo "== 基线之后上游新增提交数: $AHEAD"
fi
for name in "$@"; do
  echo "== 搜「$name」:"
  res=$(gh api -X GET search/code -f q="$name repo:libnoname/noname" --jq '.items[].path' 2>/dev/null | grep "apps/core/character/" || true)
  if [ -z "$res" ]; then echo "   ✗ 上游武将包里没有"; continue; fi
  for path in $res; do
    line=$(curl -sS -m 20 "https://raw.githubusercontent.com/libnoname/noname/main/$path" | grep -n "\"$name\"\|: \"$name\"" | head -2 || true)
    echo "   ✓ $path"; [ -n "$line" ] && echo "$line" | sed 's/^/       /'
  done
done
