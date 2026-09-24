/* 房间客户端公共库(游戏无关,浏览器经典脚本,挂全局 RoomClient)。worker 在 /common/room-client.js 下发。
 *
 *   const rc = RoomClient.create({
 *     wsPath: code => "/api/room/"+code+"/ws",     // 该游戏的 WebSocket 路径
 *     onState(m)      收到 roomState(已按本设备过滤)
 *     onMessage(m)    其它消息(actionResult 等);error/renamed/roomClosed 已内置处理,也会转发到这里
 *     onClosed(reason) 房间被解散/超时(已清 intentionalClose)
 *     onRenamed(newId)
 *     errorText: {CODE:"中文提示"}                 // error 码 → toast 文案(未列出则"操作被拒:CODE")
 *     beforeConnect()  换房/初次连接前清游戏侧客户端态
 *   });
 *   rc.connect(base, code) / rc.send(obj) / rc.deviceId / rc.connected / rc.code / rc.reconnectNow()
 *
 * 连接生命周期(融合版断线重连,自三国杀房间沉淀):
 *   connect() = 初次加入/换房(调 beforeConnect 清客户端态);openSocket() = 建/重建 socket(不清态,供重连复用)。
 *   掉线→指数退避重连;重连成功 hello 后服务端广播 roomState → stale 态自愈。
 *   未连接时 send() 阻断写操作并催重连;body.disconnected 供页面置灰冻结、露出顶部横幅(#connbar,可选)。
 *   手机切回前台(visibilitychange)/ 恢复网络(online)即刻重连。
 */
(function(){
  const DEVICE_KEY="sgs_device", BASE_KEY="sgs_base"; // 与三国杀房间共用:同一台手机在各游戏里是同一个名字
  const RC_MIN=800, RC_MAX=5000;

  const $=(s,el=document)=>el.querySelector(s);
  function esc(t){return (t==null?"":String(t)).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
  function lsGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
  function lsSet(k,v){try{localStorage.setItem(k,v);}catch(e){}}
  function randomId(){return "dev-"+Math.random().toString(36).slice(2,7);}
  function randomCode(){return String(Math.floor(1000+Math.random()*9000));}
  // toast:页面需有 <div class="toast" id="toast"></div>(样式由页面自带)
  function toast(m){const t=$("#toast");if(!t)return;t.textContent=m;t.classList.add("show");clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove("show"),2400);}
  // 服务端默认地址:页面若从 worker(http/https)载入,直接指向同源(https→wss),真机零配置;file:// 本地调试才回退 localhost。
  function defaultBase(){
    if(location.protocol==="https:"||location.protocol==="http:")
      return (location.protocol==="https:"?"wss://":"ws://")+location.host;
    return "ws://localhost:8787";
  }
  const COMMON_ERR={NAME_TAKEN:"该名字已被同房玩家占用,换一个",EMPTY_NAME:"名字不能为空",SEAT_TAKEN:"座位已被占用",NOT_HOLDER:"你没有持有该座位",MAX_SEATS:"座位已达上限",MIN_SEATS:"座位已达下限"};

  function create(opts){
    const o=Object.assign({wsPath:c=>"/api/room/"+c+"/ws",errorText:{}},opts||{});
    let ws=null, reconnectTimer=null, reconnectDelay=0;
    const rc={
      deviceId: lsGet(DEVICE_KEY)||null,
      base:null, code:null, connected:false, intentionalClose:false,
      get ws(){return ws;},
    };
    if(!rc.deviceId){rc.deviceId=randomId();lsSet(DEVICE_KEY,rc.deviceId);}

    function updateConnBar(){document.body.classList.toggle("disconnected",!rc.connected&&!!rc.code&&!rc.intentionalClose);}
    function scheduleReconnect(){
      if(rc.intentionalClose||rc.connected||reconnectTimer)return;
      reconnectDelay=Math.min(reconnectDelay?Math.round(reconnectDelay*1.7):RC_MIN,RC_MAX);
      reconnectTimer=setTimeout(()=>{reconnectTimer=null;if(!rc.intentionalClose&&!rc.connected)openSocket();},reconnectDelay);
    }
    function reconnectNow(){
      if(ws&&ws.readyState===0)return;                 // 正在连,别打断(避免 socket 抖动)
      clearTimeout(reconnectTimer);reconnectTimer=null;reconnectDelay=0;
      if(!rc.intentionalClose&&!rc.connected)openSocket();
    }
    // 写操作:仅在 socket OPEN 时下发;否则阻断(不再静默丢弃),给反馈并催重连。
    function send(obj){
      if(ws&&ws.readyState===1){ws.send(JSON.stringify(obj));return true;}
      toast("未连接,正在重连…操作已暂停,请稍候");reconnectNow();return false;
    }
    function openSocket(){
      if(!rc.base||!rc.code)return;
      if(ws){try{ws.onopen=ws.onclose=ws.onerror=ws.onmessage=null;ws.close();}catch(e){}} // 拆旧 handler:旧 socket 的 close 不再触发重连
      ws=new WebSocket(rc.base.replace(/\/+$/,"")+o.wsPath(rc.code));
      ws.onopen=()=>{rc.connected=true;reconnectDelay=0;clearTimeout(reconnectTimer);reconnectTimer=null;send({type:"hello",deviceId:rc.deviceId});updateConnBar();toast("已连接房间 "+rc.code);};
      ws.onclose=()=>{rc.connected=false;updateConnBar();if(!rc.intentionalClose){toast("连接已断开,正在重连…");scheduleReconnect();}};
      ws.onerror=()=>{};                               // close 会随后触发,重连统一由 onclose 调度
      ws.onmessage=e=>{
        let m; try{m=JSON.parse(e.data);}catch(err){return;}
        if(m.type==="roomState"){o.onState&&o.onState(m);return;}
        if(m.type==="roomClosed"){rc.intentionalClose=true;rc.connected=false;updateConnBar();toast(m.reason==="ttl"?"房间闲置超时,已自动解散":"房间已被解散");try{ws.close();}catch(err){}o.onClosed&&o.onClosed(m.reason);return;}
        if(m.type==="renamed"){rc.deviceId=m.newId;lsSet(DEVICE_KEY,m.newId);toast("已改名为「"+m.newId+"」");o.onRenamed&&o.onRenamed(m.newId);return;}
        if(m.type==="error"){const t=o.errorText[m.code]||COMMON_ERR[m.code];toast(t||("操作被拒:"+m.code));o.onMessage&&o.onMessage(m);return;}
        o.onMessage&&o.onMessage(m);
      };
    }
    function connect(base,code){
      rc.intentionalClose=false;rc.base=base;rc.code=code;
      clearTimeout(reconnectTimer);reconnectTimer=null;reconnectDelay=0;rc.connected=false;
      o.beforeConnect&&o.beforeConnect();               // 换房=干净重来:清掉上一局的客户端残留
      lsSet(BASE_KEY,base);
      updateConnBar();openSocket();
    }
    function setDeviceId(nm){rc.deviceId=nm;lsSet(DEVICE_KEY,nm);}
    // 改名:prompt → 服务端原子改键;回执 renamed 后更新本地
    function promptRename(){const nn=(prompt("改名(房内显示,不影响座位归属)",rc.deviceId)||"").trim();if(!nn||nn===rc.deviceId)return;send({type:"rename",newId:nn});}

    // 手机切回前台 / 网络恢复 → 立刻重连(掉线主因是切窗口,onclose 有时要切回前台才触发)
    document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")reconnectNow();});
    window.addEventListener("online",reconnectNow);

    Object.assign(rc,{connect,send,reconnectNow,setDeviceId,promptRename,updateConnBar});
    return rc;
  }

  // 加入房间表单(名字/ID + 4 位房间码 + 高级:服务端地址)。样式类沿用 card/row/hint/primary/ghost,页面自带 CSS。
  function connectFormHtml(rc,opts){
    opts=opts||{};
    const base=lsGet(BASE_KEY)||defaultBase();
    return `<div class="card"><h2>${esc(opts.title||"加入房间")}</h2>
    <div class="row" style="margin-top:2px"><label class="grow">你的名字 / ID
      <input id="i-name" value="${esc(rc.deviceId)}" maxlength="12" placeholder="如:小明。留空则随机"></label>
      <button class="ghost" id="b-nrand" title="随机一个 ID" style="align-self:flex-end">🎲</button></div>
    <div class="hint">用来区分不同手机 —— <b>别和同房玩家重复</b>。可自定义,也可留空/点🎲随机。</div>
    <div class="row" style="margin-top:12px"><label>房间码<input id="i-code" value="${esc(opts.defaultCode||"1234")}" maxlength="4" inputmode="numeric" style="width:90px"></label>
      <button class="ghost" id="b-rand">随机</button><button class="primary grow" id="b-conn">连接</button></div>
    <div class="hint">${opts.hint||"同一房间码即进同一桌。"}</div>
    <details style="margin-top:10px"><summary style="cursor:pointer;font-size:12px;opacity:.7">高级:服务端地址</summary>
      <div class="row" style="margin-top:6px"><label class="grow" style="font-size:12px">服务端<input id="i-base" value="${esc(base)}"></label></div></details></div>`;
  }
  function bindConnectForm(rc){
    $("#b-nrand")&&($("#b-nrand").onclick=()=>{$("#i-name").value=randomId();});
    $("#b-rand")&&($("#b-rand").onclick=()=>$("#i-code").value=randomCode());
    $("#b-conn")&&($("#b-conn").onclick=()=>{
      const base=($("#i-base")&&$("#i-base").value)||defaultBase(),code=$("#i-code").value.trim();
      if(!/^\d{4}$/.test(code))return toast("房间码要 4 位数字");
      let nm=(($("#i-name")&&$("#i-name").value)||"").trim();
      if(!nm) nm=randomId();
      rc.setDeviceId(nm);
      rc.connect(base,code);
    });
  }

  window.RoomClient={create,esc,toast,defaultBase,randomId,randomCode,connectFormHtml,bindConnectForm,lsGet,lsSet,$};
})();
