# 情书 · 卡面来源(2026-11-20)

> 官方卡面(AEG 2012 / Kanai Factory / Z-Man 2019)都是版权图,BGG 页面 403、图库 API 这边不能抓;所以 v1 走 **公版古典肖像**(Wikimedia Commons,全部 Public domain,作者卒于 1700 年前),按角色气质配画,风格统一(文艺复兴~巴洛克肖像)。已入库 `assets/loveletter/*.jpg`(sips 缩到长边 640,共约 1MB),Pages 直链 `ART_BASE` + `<key>.jpg`,加载失败前端退回表情 + 点数。
> 想换官方卡面:把 10 张裁好的图按同名覆盖进 `assets/loveletter/` 即可,代码不用动。

| 文件 | 牌 | 画作 | Commons 文件 |
|---|---|---|---|
| `princess.jpg` | 公主 | Pisanello《埃斯特家族的公主》c.1435~49(卢浮宫) | File:Pisanello - Portrait of a Princess of the House of Este - WGA17872.jpg |
| `countess.jpg` | 伯爵夫人 | Ghirlandaio《Giovanna Tornabuoni 肖像》1488 | File:Ghirlandaio-Giovanna Tornabuoni.jpg |
| `king.jpg` | 国王 | Holbein《亨利八世》1537(Thyssen) | File:Portrait of King Henry VIII of England (1491–1547), by Hans Holbein the Younger (Thyssen-Bornemisza Museum, Madrid).jpg |
| `prince.jpg` | 王子 | Botticelli《朱利亚诺·德·美第奇》c.1478(柏林) | File:Botticelli - Giuliano de' Medici - Gemäldegalerie Berlin.jpg |
| `handmaid.jpg` | 侍女 | Vermeer《女主人与持信的女仆》局部 c.1667(Frick) | File:Johannes Vermeer - Lady with Her Maidservant Holding a Letter (detail) - WGA24682.jpg |
| `baron.jpg` | 男爵 | Titian《戴手套的男子》c.1520(卢浮宫) | File:Titian - Man with a Glove - WGA22939.jpg |
| `priest.jpg` | 神父 | Raphael《红衣主教肖像》c.1510(普拉多) | File:Rafael - Retrato de um Cardeal.jpg |
| `guard.jpg` | 侍卫 | Rembrandt《穿盔甲的男子》1655(格拉斯哥) | File:Rembrandt Man in Armour.jpg |
| `spy.jpg` | 间谍(2019) | Caravaggio《纸牌作弊者》局部 c.1595(Kimbell) | File:Caravaggio Cardsharps Kimbell detail.jpg |
| `chancellor.jpg` | 大臣(2019) | Holbein《托马斯·莫尔爵士》1527(Frick;莫尔正是大法官 Lord Chancellor) | File:Sir Thomas More, by Hans Holbein the Younger.jpg |
| `cover.jpg` | 大厅卡片 | Vermeer《情书》c.1669(荷兰国立博物馆) | File:Johannes Vermeer - The Love Letter - WGA24693.jpg |

重下方法(仓库根目录):`thumb.wikimedia.org/wikipedia/commons/thumb/<hash>/<file>/960px-<file>` 直链 curl 可下(480px 变体返回 400,用 960 再 `sips -Z 640` 缩),见本会话 scratchpad `dl_art.sh` 的 URL 列表;Commons API 搜索限速较严(连续 5 次后 429),查询之间 sleep 3s。

备用候选(同为公版):Velázquez《穿蓝裙的玛格丽特公主》(公主)、Bronzino《托莱多的埃莱奥诺拉》(伯爵夫人)、Jean Clouet《弗朗索瓦一世》(国王)、Bronzino《持书青年》(王子)、Vermeer《倒牛奶的女仆》(侍女)、van Eyck《阿尔贝加蒂红衣主教》(神父)、Giorgione《武士与侍从》(侍卫)、Holbein《托马斯·克伦威尔》(大臣)。
