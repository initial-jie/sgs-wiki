# 阿瓦隆 · 立绘来源清单(2026-11-06)

两条路线都给全了,文件统一放 `assets/avalon/`,Pages 直链 `ART_BASE` + 角色 `img` 字段,缺图退回表情(同 onuw)。

| 路线 | 来源 | 法律 | 获取 | 画风 |
|---|---|---|---|---|
| **A 公版画(默认推荐)** | Wikimedia Commons:Howard Pyle 1903~1910《亚瑟王与圆桌骑士》四部曲钢笔插画为主,补 H. J. Ford / Beardsley / Paton / Leighton | 全部 Public domain(作者卒于 1911 前后),可随便用、可公开 | **curl 直链,脚本一键** | 黑白钢笔画 + 少量油画,古典一致 |
| **B 官方卡面** | BGG 图库里玩家拍的平铺卡面照(2013 印刷 + 2022 Big Box) | 版权 Indie Boards & Cards,只建议朋友房间自用 | curl 直链可下,**需裁切**(一张照片里 10~15 张卡) | 2013 写实油画 / Big Box 扁平插画 |

## A. 公版画(Commons 直链,一键)

角色 → 画作对应(我按题材挑的,随时可换;`(cropped)` 是 Commons 已裁好的头像版):

| 文件名 | 角色 | 画作 | 尺寸 |
|---|---|---|---|
| `merlin.jpg` | 梅林 | Pyle《The Enchanter Merlin》1903 | 1307×1500 |
| `assassin.jpg` | 刺客 | Pyle《Vivien Bewitches Merlin》1903(薇薇安——传说里封印梅林的人) | 1257×1500 |
| `percival.png` | 派西维尔 | Pyle《Sir Percival overcometh ye Enchantress Vivien》(cropped) 1905 | 372×425 |
| `morgana.jpg` | 莫甘娜 | Pyle《Queen Morgana le Fay》1903 | 1334×1500 |
| `mordred.png` | 莫德雷德 | H. J. Ford《Sir Mordred》1902(Lang《King Arthur》插图) | 384×582 |
| `oberon.jpg` | 奥伯伦 | Paton《The Quarrel of Oberon and Titania》1849(油画,**要裁中间奥伯伦**;嫌麻烦换 `minion_sable.jpg`) | 4001×2600 |
| `servant1.jpg` | 忠臣 | Pyle《Sir Pellias, The Gentle Knight》 | 1328×1500 |
| `servant2.jpg` | 忠臣 | Pyle《Sir Gawaine the Son of Lot》 | 1311×1476 |
| `servant3.jpg` | 忠臣 | Pyle《Sir Tristram of Lyonesse》(cropped) | 779×851 |
| `servant4.png` | 忠臣 | Pyle《Sir Gareth of Orkney》(cropped) | 475×540 |
| `servant5.png` | 忠臣 | Pyle《Sir Bors de Ganis》(cropped) | 477×564 |
| `servant6.png` | 忠臣 | Pyle《Sir Lionel of Britain》 | 488×707 |
| `minion1.jpg` | 爪牙 | Pyle《The Battle with the Sable-Knight》(黑骑士) | 1162×1500 |
| `minion2.jpg` | 爪牙 | Pyle《King Mark of Cornwall》(传说里的反派国王) | 853×946 |
| `minion3.jpg` | 爪牙 | Pyle《Mounted Knight》 | 1500×1256 |
| `minion4.png` | 爪牙 | Pyle《Sir Gawaine Challenges Sir Launcelot》 | 303×427 |
| `lancelot_good.png` | 好兰斯洛特 | Pyle《Sir Launcelot greets Queen Guinevere》 | 499×717 |
| `lancelot_evil.png` | 坏兰斯洛特 | Pyle《Queen Morgana Appears unto Sir Launcelot》 | 900×1278 |
| `lady_of_lake.jpg` | 湖中仙女 | Pyle《The Lady of ye Lake》 | 1282×1475 |
| `excalibur.jpg` | 王者之剑 | Pyle《Excalibur the Sword》 | 1188×1500 |
| `cleric.gif` | 牧师 | Pyle《Sir Galahad》(cropped) 1910 | 335×417 |
| `troublemaker.jpg` | 捣蛋鬼 | Pyle《Sir Kay breaketh his sword at ye Tournament》 | 1327×1500 |
| `messenger1.jpg` / `messenger2.jpg` | 信使 | Pyle《Herald》01/02(横幅,裁左半) | 1500×684 / 1500×877 |
| `untrustworthy.png` | 不忠的仆人 | Pyle《Sir Ewaine》1907(小图) | 303×357 |
| `sorcerer_good.gif` | 好巫师 | Beardsley《Merlin and Nimue》1893 | 710×924 |
| `sorcerer_evil.jpg` | 坏巫师 | Pyle《The Enchantress Vivien》 | 1344×1500 |
| `trickster.jpg` | 骗子 | Lancelot Speed《Merlin and Vivien》(cropped) 1912 | 476×732 |
| `arthur.jpg` | (大厅/封面备用) | Pyle《King Arthur of Britain》 | 1325×1500 |
| `guinevere.jpg` | (备用) | Pyle《The Lady Guinevere》 | 1299×1480 |
| `cover_accolade.jpg` | **大厅卡片**候选 | E. B. Leighton《The Accolade》1901(彩色油画,授剑) | 1293×2129 |
| `cover_godspeed.jpg` | 大厅卡片候选 | E. B. Leighton《God Speed!》1900 | 2904×4000 |

没对应公版画的 Big Box 角色(疯子/蛮兵/揭示者/盗贼/猎手)建议走 B 路线裁切,或先用表情。

一键下载(在仓库根目录跑,32 张约 12MB,2 分钟;**已实跑验证 32/32**):

```bash
mkdir -p assets/avalon && cd assets/avalon && UA="sgs-wiki/1.0 (dujie1995@gmail.com)" && dl(){ sleep 2; curl -sSL -A "$UA" -o "$1" "$2" && file "$1" | grep -q image && echo "ok $1" || echo "FAIL $1"; } && \
dl merlin.jpg "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/79/Arthur-Pyle_The_Enchanter_Merlin.JPG/960px-Arthur-Pyle_The_Enchanter_Merlin.JPG" && \
dl assassin.jpg "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/24/Arthur-Pyle_Vivien_Bewitches_Merlin.jpg/960px-Arthur-Pyle_Vivien_Bewitches_Merlin.jpg" && \
dl percival.png "https://upload.wikimedia.org/wikipedia/commons/7/7c/Sir_Percival_overcometh_ye_Enchantress_Vivien_%28cropped%29.png" && \
dl morgana.jpg "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fd/Arthur-Pyle_Queen_Morgana_le_Fey.JPG/960px-Arthur-Pyle_Queen_Morgana_le_Fey.JPG" && \
dl mordred.png "https://upload.wikimedia.org/wikipedia/commons/c/ce/Sir_Mordred_by_H._J._Ford.png" && \
dl oberon.jpg "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f2/Sir_Joseph_Noel_Paton_-_The_Quarrel_of_Oberon_and_Titania_-_Google_Art_Project.jpg/960px-Sir_Joseph_Noel_Paton_-_The_Quarrel_of_Oberon_and_Titania_-_Google_Art_Project.jpg" && \
dl servant1.jpg "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a4/Arthur-Pyle_Sir_Pellias%2C_The_Gentle_Knight.JPG/960px-Arthur-Pyle_Sir_Pellias%2C_The_Gentle_Knight.JPG" && \
dl servant2.jpg "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/40/Arthur-Pyle_Sir_Gawaine_the_Son_of_Lot%2C_King_of_Orkney.JPG/960px-Arthur-Pyle_Sir_Gawaine_the_Son_of_Lot%2C_King_of_Orkney.JPG" && \
dl servant3.jpg "https://upload.wikimedia.org/wikipedia/commons/5/59/Sir_Tristram_of_Lyonesse_%28cropped%29.jpg" && \
dl servant4.png "https://upload.wikimedia.org/wikipedia/commons/3/3f/Sir_Gareth_of_Orkney_%28cropped%29.png" && \
dl servant5.png "https://upload.wikimedia.org/wikipedia/commons/1/1b/Sir_Bors_de_Ganis_%28cropped%29.png" && \
dl servant6.png "https://upload.wikimedia.org/wikipedia/commons/f/f4/Sir_Lionel_of_Britain.png" && \
dl minion1.jpg "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7b/Arthur-Pyle_The_Battle_with_the_Sable-Knight.JPG/960px-Arthur-Pyle_The_Battle_with_the_Sable-Knight.JPG" && \
dl minion2.jpg "https://upload.wikimedia.org/wikipedia/commons/c/c4/King_Mark_of_Cornwall_11400.jpg" && \
dl minion3.jpg "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8b/Arthur-Pyle_Mounted_Knight.JPG/960px-Arthur-Pyle_Mounted_Knight.JPG" && \
dl minion4.png "https://upload.wikimedia.org/wikipedia/commons/f/f6/Sir_Gawaine_Challenges_Sir_Launcelot.png" && \
dl lancelot_good.png "https://upload.wikimedia.org/wikipedia/commons/7/76/Sir_Launcelot_greets_Queen_Guinevere.png" && \
dl lancelot_evil.png "https://upload.wikimedia.org/wikipedia/commons/3/39/Queen_Morgana_Appears_unto_Sir_Launcelot.png" && \
dl lady_of_lake.jpg "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2d/Arthur-Pyle_The_Lady_of_ye_Lake.JPG/960px-Arthur-Pyle_The_Lady_of_ye_Lake.JPG" && \
dl excalibur.jpg "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0f/Arthur-Pyle_Excalibur_the_Sword.JPG/960px-Arthur-Pyle_Excalibur_the_Sword.JPG" && \
dl cleric.gif "https://upload.wikimedia.org/wikipedia/commons/8/87/Pyle_galahad_%28cropped%29.gif" && \
dl troublemaker.jpg "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ee/Arthur-Pyle_Sir_Kay_breaketh_his_sword_at_ye_Tournament.JPG/960px-Arthur-Pyle_Sir_Kay_breaketh_his_sword_at_ye_Tournament.JPG" && \
dl messenger1.jpg "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/96/Arthur-Pyle_Herald01.JPG/960px-Arthur-Pyle_Herald01.JPG" && \
dl messenger2.jpg "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/85/Arthur-Pyle_Herald02.JPG/960px-Arthur-Pyle_Herald02.JPG" && \
dl untrustworthy.png "https://upload.wikimedia.org/wikipedia/commons/8/81/Ewaine.png" && \
dl sorcerer_good.gif "https://upload.wikimedia.org/wikipedia/commons/7/7e/Merlin_and_Nimue.gif" && \
dl sorcerer_evil.jpg "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/10/Arthur-Pyle_The_Enchantress_Vivien.JPG/960px-Arthur-Pyle_The_Enchantress_Vivien.JPG" && \
dl trickster.jpg "https://upload.wikimedia.org/wikipedia/commons/6/64/Merlin_And_Vivien_by_Speed_Lancelot_%28cropped%29.jpg" && \
dl arthur.jpg "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7a/Arthur-Pyle_King_Arthur_of_Britain.JPG/960px-Arthur-Pyle_King_Arthur_of_Britain.JPG" && \
dl guinevere.jpg "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/94/Arthur-Pyle_The_Lady_Guinevere.JPG/960px-Arthur-Pyle_The_Lady_Guinevere.JPG" && \
dl cover_accolade.jpg "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a3/Accolade_by_Edmund_Blair_Leighton_-_complete.jpg/960px-Accolade_by_Edmund_Blair_Leighton_-_complete.jpg" && \
dl cover_godspeed.jpg "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d3/Leighton-God_Speed%21.jpg/960px-Leighton-God_Speed%21.jpg"  && ls -la
```

脚本里的坑(2026-11 实测):
- Commons **原图直链连发会 429**(限流按 IP,十几张后就挂),缩略图只允许固定档尺寸(`.../thumb/<hash>/<文件>/960px-<文件>`,960 可用,600 返回 400 "Use thumbnail sizes listed");所以脚本对 >960 宽的用 960px 缩略图、小图用原图,每张 `sleep 2`。失败的重跑同一行即可。
- UA 必须带(`-A`),Commons 对空 UA 直接拒。
- 整套 ~12MB;接入前建议 PIL 统一缩到长边 600 并转 WebP(座位头像用不到更大)。
- 总览缩略图见 `art-contact-sheet.jpg`(其中 untrustworthy 还是旧的高文,已换 Ewaine)。有几张是横幅/全景(oberon、minion1、minion3、messenger1/2),做头像要 `object-position` 取景或裁一下。

## B. 官方卡面照片(BGG 图库直链)

BGG 的图库接口 `https://api.geekdo.com/api/images?objectid=<id>&objecttype=thing&galleries[]=game&showcount=50&sort=hot` 可 curl(基础版 objectid **128882**,Big Box **367396**),返回 JSON 里 `imageurl_lg` 是 1024px 直链,**curl 带普通 UA 即可下载**(已验证)。

| pic id | 内容 | 直链(1024px) |
|---|---|---|
| 1817540 | 2013 印刷基础 10 张平铺:忠臣 ×5、梅林、爪牙 ×3、刺客(每张约 160×230px) | https://cf.geekdo-images.com/sk-72tkUnWb6xKN_ajQ6Tg__large/img/VdLJ93kU6PMVkNioF6xSDW2YpKY=/fit-in/1024x1024/filters:no_upscale():strip_icc()/pic1817540.jpg |
| 1861182 | 2013 可选 4 张:派西维尔、莫德雷德、奥伯伦、莫甘娜(每张约 300×430px,最清晰) | https://cf.geekdo-images.com/fxosw6Y4OG3Tmv1nQ3tF_Q__large/img/wiH42sR8GxWBSbYPZpkesosVjuc=/fit-in/1024x1024/filters:no_upscale():strip_icc()/pic1861182.jpg |
| 1672563 | 梅林 + 刺客特写 | https://cf.geekdo-images.com/CpaoD03SmQR283ngrOt8OQ__large/img/YBkltK8OrtptNDiT6GC7-D5LPIk=/fit-in/1024x1024/filters:no_upscale():strip_icc()/pic1672563.jpg |
| 1654047 | 旧版(2012 首印)角色卡合照 | https://cf.geekdo-images.com/L2Dgr6rrtmGTeoZiHPNKwQ__large/img/iLsDCl0ZPdUSOPZXz4TxB89wbZU=/fit-in/1024x1024/filters:no_upscale():strip_icc()/pic1654047.jpg |
| 1818869 | 湖中仙女标记 + 忠诚卡 | https://cf.geekdo-images.com/apBN01kQS5b3mJSCxIAs6Q__large/img/gJB0fpVCrXKRqi0BQiFf15dzLw4=/fit-in/1024x1024/filters:no_upscale():strip_icc()/pic1818869.jpg |
| 1446733~1446738 | 5/6/7/8/9/10 人版图(任务人数表就是对着这几张核的) | 同接口,objectid 128882 |
| **7166335** | **Big Box 全部 15 张好人卡**平铺(忠臣 ×5、初级/资深信使、捣蛋鬼、牧师、盗贼、巫师、派西维尔、兰斯洛特、不忠的仆人、梅林;每张约 190×280px) | https://cf.geekdo-images.com/q2RS1vpKjdDUHcALyhS9tA__large/img/4fIPFo4XSjdO9CscwX_nSlMxIZw=/fit-in/1024x1024/filters:no_upscale():strip_icc()/pic7166335.jpg |
| **7166338** | **Big Box 全部 15 张坏人卡**平铺(信使、疯子、莫德雷德、揭示者、盗贼、巫师、骗子、蛮兵、奥伯伦、兰斯洛特、爪牙 ×3、莫甘娜、刺客) | https://cf.geekdo-images.com/T_oLFxf8S8GkxESrHIJFsA__large/img/KrOR_bss2IPJU7LnIMYA49DRfh4=/fit-in/1024x1024/filters:no_upscale():strip_icc()/pic7166338.jpg |
| 7229354 / 7229355 | Big Box 可选角色两组 10 张(白底,比上面两张干净) | 同接口,objectid 367396 |
| 7228835 | Big Box 基础角色卡 | 同上 |

Big Box 两张合照 3×5 平铺、白/木纹底、正拍,**用 PIL 按网格裁 30 张**就是一套完整卡面(各约 190×280);2013 版四张可选角色那张最清晰。裁切脚本思路同枪鸣锈语(`docs/qmxy/` 的网格拼图法反过来用)。

> ⚠ B 路线版权属于 Indie Boards & Cards,只建议自用的朋友房间,别公开分发。Big Box 卡面上的英文一句话规则(如 "Must Fail every Quest")顺便可作为图鉴 desc 的英文原文。

## C. 没走通的
- fandom 上**没有**阿瓦隆卡图维基(the-resistance.fandom.com 是另一个游戏;avalon.fandom.com 空站)。
- 出版商官网 indieboardsandcards.com 页面为空壳;ProAvalon / avalon.ist / indie-avalon-react 三个开源项目都只有抵抗组织阵营图标,没有角色立绘。
- 中文「阿瓦隆 卡面 高清」搜索没有可用来源;新天鹅堡繁中版无在线素材。
