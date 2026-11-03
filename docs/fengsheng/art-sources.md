# 风声 · 角色立绘来源清单

角色图来自开源联机客户端 **Death-alter/TheMessage**(《风声典藏版》复刻,AGPL-3.0;风声的角色/技能文本本来就取自这个仓库)的
`assets/resources/images/characters/`,文件名 = 角色拼音驼峰(与 `shared/char-pinyin.json` 一一对应),多为 561×470 左右的角色牌画面裁切。
下载到 `assets/fengsheng/char/`(保留原文件名),push 后由 GitHub Pages 直链 `ART_BASE` 提供;映射表在 `shared/fs-data.mjs` 的 `CHAR_ART`,缺图时客户端退回首字头像。

> ⚠ 画作版权属于游卡桌游。只建议自用的朋友房间使用,别公开分发。

仓库里没有的:48 孙守謨、49 王响(典藏版后出的角色)。仓库另有 SP 皮肤(`*SP.*`)、成年韩梅/小九、CP 版,暂不用。
盒子封面没找到可用的图,大厅卡片用顾小梦(`char/GuXiaoMeng.jpg`)代替;想换封面改 `common/games.mjs` 里 fs 那条的 `img`。

一键下载(47 张,约 14MB):

```bash
mkdir -p assets/fengsheng/char && cd assets/fengsheng/char && B="https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/" && for f in AFuLuoLa.jpg BaiCangLang.jpg BaiFeiFei.jpg BaiKunShan.jpg BaiXiaoNian.jpg BianYunJiang.png ChenAnNa.png ChenDaEr.png ChengXiaoDie.jpg ChiJingHai.png DuanMuJing.jpg FeiYuanLongChuan.jpg GaoQiaoZhiZi.png GuXiaoMeng.jpg GuiJiao.jpg HanMei.jpg HuangJiRen.jpg JianXianSheng.png JinShengHuo.jpg JinZiLai.png LaoBie.jpg LaoHan.jpg LaoHu.png LiNingYu.jpg LiShuYun.png LiXing.jpg LianYuan.jpg LingSuQiu.png MaLiYa.png MaoBuBa.jpg PeiLing.jpg QianMin.png QinWuMing.png QinYuanYuan.png ShangYu.jpg ShaoXiu.jpg ShengLaoBan.png WangFuGui.jpg WangKui.jpg WangTianXiang.jpg WuZhiGuo.jpg XiaoJiu.jpg XiaoLingDang.png XuanQingZi.jpg YaPao.png ZhangYiTing.jpg ZhengWenXian.jpg; do curl -sSL -o "$f" "$B$f" || echo "FAIL $f"; done && ls | wc -l
```

| id | 角色 | 放到 assets/fengsheng/ 的文件 | 来源 |
|---|---|---|---|
| 1 | 吴志国 | `char/WuZhiGuo.jpg` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/WuZhiGuo.jpg |
| 2 | 程小蝶 | `char/ChengXiaoDie.jpg` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/ChengXiaoDie.jpg |
| 3 | 连鸢 | `char/LianYuan.jpg` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/LianYuan.jpg |
| 4 | 毛不拔 | `char/MaoBuBa.jpg` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/MaoBuBa.jpg |
| 5 | 张一挺 | `char/ZhangYiTing.jpg` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/ZhangYiTing.jpg |
| 6 | 白沧浪 | `char/BaiCangLang.jpg` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/BaiCangLang.jpg |
| 7 | 肥原龙川 | `char/FeiYuanLongChuan.jpg` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/FeiYuanLongChuan.jpg |
| 8 | 裴玲 | `char/PeiLing.jpg` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/PeiLing.jpg |
| 9 | 黄济仁 | `char/HuangJiRen.jpg` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/HuangJiRen.jpg |
| 10 | 王田香 | `char/WangTianXiang.jpg` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/WangTianXiang.jpg |
| 11 | 李醒 | `char/LiXing.jpg` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/LiXing.jpg |
| 12 | 王魁 | `char/WangKui.jpg` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/WangKui.jpg |
| 13 | 阿芙罗拉 | `char/AFuLuoLa.jpg` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/AFuLuoLa.jpg |
| 14 | 韩梅 | `char/HanMei.jpg` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/HanMei.jpg |
| 15 | 鄭文先 | `char/ZhengWenXian.jpg` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/ZhengWenXian.jpg |
| 16 | 玄青子 | `char/XuanQingZi.jpg` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/XuanQingZi.jpg |
| 17 | 鬼脚 | `char/GuiJiao.jpg` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/GuiJiao.jpg |
| 18 | 邵秀 | `char/ShaoXiu.jpg` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/ShaoXiu.jpg |
| 19 | 金生火 | `char/JinShengHuo.jpg` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/JinShengHuo.jpg |
| 20 | 顾小梦 | `char/GuXiaoMeng.jpg` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/GuXiaoMeng.jpg |
| 21 | 白菲菲 | `char/BaiFeiFei.jpg` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/BaiFeiFei.jpg |
| 22 | 端木静 | `char/DuanMuJing.jpg` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/DuanMuJing.jpg |
| 23 | 王富贵 | `char/WangFuGui.jpg` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/WangFuGui.jpg |
| 24 | 老汉 | `char/LaoHan.jpg` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/LaoHan.jpg |
| 25 | 白小年 | `char/BaiXiaoNian.jpg` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/BaiXiaoNian.jpg |
| 26 | 老鳖 | `char/LaoBie.jpg` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/LaoBie.jpg |
| 27 | 小九 | `char/XiaoJiu.jpg` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/XiaoJiu.jpg |
| 28 | 李宁玉 | `char/LiNingYu.jpg` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/LiNingYu.jpg |
| 29 | 白昆山 | `char/BaiKunShan.jpg` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/BaiKunShan.jpg |
| 30 | 商玉 | `char/ShangYu.jpg` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/ShangYu.jpg |
| 31 | 玛利亚 | `char/MaLiYa.png` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/MaLiYa.png |
| 32 | 钱敏 | `char/QianMin.png` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/QianMin.png |
| 33 | 池镜海 | `char/ChiJingHai.png` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/ChiJingHai.png |
| 34 | 秦圆圆 | `char/QinYuanYuan.png` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/QinYuanYuan.png |
| 35 | 盛老板 | `char/ShengLaoBan.png` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/ShengLaoBan.png |
| 36 | 高桥智子 | `char/GaoQiaoZhiZi.png` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/GaoQiaoZhiZi.png |
| 37 | 简先生 | `char/JianXianSheng.png` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/JianXianSheng.png |
| 38 | 老虎 | `char/LaoHu.png` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/LaoHu.png |
| 39 | 陈安娜 | `char/ChenAnNa.png` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/ChenAnNa.png |
| 40 | 哑炮 | `char/YaPao.png` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/YaPao.png |
| 41 | 金自来 | `char/JinZiLai.png` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/JinZiLai.png |
| 42 | 秦无命 | `char/QinWuMing.png` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/QinWuMing.png |
| 43 | 李书云 | `char/LiShuYun.png` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/LiShuYun.png |
| 44 | 凌素秋 | `char/LingSuQiu.png` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/LingSuQiu.png |
| 45 | 小铃铛 | `char/XiaoLingDang.png` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/XiaoLingDang.png |
| 46 | 陈大耳 | `char/ChenDaEr.png` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/ChenDaEr.png |
| 47 | 边云疆 | `char/BianYunJiang.png` | https://raw.githubusercontent.com/Death-alter/TheMessage/main/assets/resources/images/characters/BianYunJiang.png |
