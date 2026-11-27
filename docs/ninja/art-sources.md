# 忍者之夜 · 卡面来源

- 官方卡面是 Ben Charman 的剪纸灯箱摄影(版权图),官网与规则书里只有低分辨率内嵌图(≈280 px 宽),BGG 图库有反爬,没拿到可用的高清官方卡图。
- v1 卡面(2026-11-28)用的是开源网页版 **Byte-Git-hub/NinjaNight**(AGPL-3.0)部署站点自带的一套 AI 生成「水墨浮世绘」风格卡图,16 张 + 2 张牌背,512×763 WebP,上下有深色留白条(前端用 `object-fit:cover` 裁掉):
  `https://byte-git-hub.github.io/NinjaNight/assets/visuals/<key>.webp`,key = spy / mystic / shapeshifter / grave_digger / troublemaker / spirit_merchant / thief / judge / blind_assassin / shinobi / mirror_monk / martyr / mastermind / crane / lotus / ronin / ninja-card-back / house-card-back。
- 入库 `assets/ninja/cards/<我们的 key>.webp`(gravedigger / merchant / blind / mirror / back-ninja / back-house 做了改名),Pages 直链 `ART_BASE`,加载失败退回阶段色块 + 表情。
- 官网产品图(通灵商人实卡特写、盒子)存在 `docs/ninja/` 不入库;想换官方卡面同名覆盖即可。
