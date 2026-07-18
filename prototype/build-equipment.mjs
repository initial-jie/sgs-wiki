// 生成「装备牌库」数据集 prototype/shared/equipment.json —— #2 距离层(③坐骑/④装备槽)地基。
// 源生装备:从 deck.mjs 的 CARD_INDEX(军争161张权威)抽花色点数 + 本文件类型/范围映射。
// 衍生装备:从 derived-cards*.json 解析 src(容错:type/花色点数/范围 顺序无关)。
// 用法:node prototype/build-equipment.mjs  (改 deck/derived 源后重跑)
import { CARD_INDEX } from "./shared/deck.mjs";
import { readFileSync, writeFileSync } from "node:fs";

// ---- 源生装备:名 → 类型 ----
const EQUIP_TYPE = {
  "诸葛连弩":"武器","青龙偃月刀":"武器","雌雄双股剑":"武器","青釭剑":"武器","丈八蛇矛":"武器",
  "贯石斧":"武器","方天画戟":"武器","麒麟弓":"武器","朱雀羽扇":"武器","寒冰剑":"武器","古锭刀":"武器",
  "八卦阵":"防具","仁王盾":"防具","藤甲":"防具","白银狮子":"防具",
  // ⚠ 坐骑 +1/-1 按用户 2026-07-17 确认(与标准军争相反!用户称 deck 原标注是旧 agent 抓取的勘误)。勿"修正"回标准。
  "绝影":"+1马","的卢":"+1马","爪黄飞电":"+1马","骅骝":"+1马",
  "赤兔":"-1马","大宛":"-1马","紫骍":"-1马",
  "木牛流马":"宝物",
};
// 武器攻击范围(标准军争值;⚠ 待用户过目确认)
const WEAPON_RANGE = {
  "诸葛连弩":1,"雌雄双股剑":2,"青釭剑":2,"寒冰剑":2,"古锭刀":2,
  "青龙偃月刀":3,"丈八蛇矛":3,"贯石斧":3,"方天画戟":4,"朱雀羽扇":4,"麒麟弓":5,
};

const list = [];
// 源生:遍历 CARD_INDEX,收每个装备名的所有 (花色,点数) 实体
for (const [suit, ranks] of Object.entries(CARD_INDEX))
  for (const [rank, names] of Object.entries(ranks))
    for (const n of names) if (EQUIP_TYPE[n]) {
      const e = { name:n, type:EQUIP_TYPE[n], suit, rank, origin:"源生" };
      if (EQUIP_TYPE[n]==="武器") e.range = WEAPON_RANGE[n] ?? null;
      list.push(e);
    }

// ---- 衍生装备:解析 derived-cards*.json 的 src ----
const SUITMAP = { "黑桃":"S","红桃":"H","梅花":"C","方块":"D","方片":"D" };
const EQTYPES = new Set(["武器","防具","坐骑","+1马","-1马","-2马","宝物"]);
function parseSrc(src){
  if(!src) return null;
  const parts = src.split(/[·，,]/).map(s=>s.trim()).filter(Boolean);
  let type=null, suit=null, ranks=[], range=null, note=null;
  for(const p of parts){
    if(EQTYPES.has(p)){ type=p; continue; }
    let m;
    if((m=p.match(/^范围(\d+)$/))){ range=+m[1]; continue; }
    if((m=p.match(/^(黑桃|红桃|梅花|方块|方片)([0-9AJQK/]+)$/))){ suit=SUITMAP[m[1]]; ranks=m[2].split("/"); continue; }
    if(/无花色点数/.test(p)){ note=(note?note+"·":"")+"无花色点数"; continue; }
    note=(note?note+"·":"")+p; // 覆盖【…】/共四张 等
  }
  return { type, suit, ranks, range, note };
}
function rangeFromText(text){ const m=(text||"").match(/攻击范围\s*(\d+)/); return m?+m[1]:null; }
function typeFromText(text){ // 魂装备类型从 text 判(它们无 src 花色点数,只写"武器/防具/坐骑…")
  if(/坐骑/.test(text)) return "坐骑";
  if(/防具/.test(text)) return "防具";
  if(/武器/.test(text)) return "武器";
  if(/宝物/.test(text)) return "宝物";
  return null;
}

const derived = { ...JSON.parse(readFileSync(new URL("./shared/derived-cards.json",import.meta.url))),
  // room 专属覆盖合并(同 worker)
};
const derivedRoom = JSON.parse(readFileSync(new URL("./shared/derived-cards-room.json",import.meta.url)));
const merged = {};
for(const k of Object.keys(derived)) merged[k]=derived[k].slice();
for(const k of Object.keys(derivedRoom)) merged[k]=(merged[k]||[]).concat(derivedRoom[k]);

const findCard = (hero, name) => (merged[hero]||[]).find(c=>c.name===name);
const skipped = [];
for(const [hero, cards] of Object.entries(merged)){
  for(const c of cards){
    let type, suit, ranks, range, note;
    const cover = (c.src||"").match(/覆盖【(.+?)】/);
    if(cover){ // 魂装备:花色点数=被覆盖装备的;类型/范围=自身 text(用户定:魂装备与替换掉的装备同花色点数)
      const base = findCard(hero, cover[1]), bp = base && parseSrc(base.src);
      type = typeFromText(c.text);
      if(!type){ skipped.push(hero+"/"+c.name+" (魂装备类型无法判定)"); continue; }
      suit = bp ? bp.suit : null;
      ranks = (bp && bp.ranks.length) ? bp.ranks : [null];
      range = rangeFromText(c.text);
      note = "魂·覆盖【"+cover[1]+"】";
    } else {
      const p = parseSrc(c.src);
      if(!p || !p.type || !EQTYPES.has(p.type)){ if(c.src && /武器|防具|坐骑|宝物/.test(c.src)) skipped.push(hero+"/"+c.name+" ("+c.src+")"); continue; }
      type=p.type; suit=p.suit; ranks=p.ranks.length?p.ranks:[null]; range=p.range??rangeFromText(c.text); note=p.note;
    }
    for(const rank of ranks){
      const e = { name:c.name, type, suit, rank, origin:"衍生", srcHero:hero };
      if(type.includes("武器")) e.range = range ?? null;
      if(note) e.note = note;
      list.push(e);
    }
  }
}
// 去重:效果一致的跨武将重复卡(同名+同花色点数)只留一套(用户定:蒲元/吕玲绮 装备一致)。源生 2 copies 花色不同→不受影响
const seen = new Set(), deduped = [];
for(const e of list){ const k=e.name+"|"+e.suit+"|"+e.rank; if(seen.has(k)) continue; seen.add(k); deduped.push(e); }
list.length=0; list.push(...deduped);

// 排序:类型 → 源生优先 → 名
const TYPE_ORDER = { "武器":0,"防具":1,"+1马":2,"-1马":3,"-2马":4,"坐骑":5,"宝物":6 };
list.sort((a,b)=> (TYPE_ORDER[a.type]-TYPE_ORDER[b.type]) || (a.origin==="源生"?-1:1)-(b.origin==="源生"?-1:1) || a.name.localeCompare(b.name,"zh"));

writeFileSync(new URL("./shared/equipment.json",import.meta.url), JSON.stringify(list,null,1)+"\n");
console.log(`写入 ${list.length} 张(源生 ${list.filter(e=>e.origin==="源生").length} / 衍生 ${list.filter(e=>e.origin==="衍生").length})`);
console.log("按类型:", Object.fromEntries(["武器","防具","+1马","-1马","-2马","坐骑","宝物"].map(t=>[t,list.filter(e=>e.type===t).length])));
if(skipped.length) console.log("⚠ 疑似装备但 src 未能解析(跳过,需人工):\n  "+skipped.join("\n  "));
