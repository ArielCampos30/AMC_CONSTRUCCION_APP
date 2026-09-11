export function createNoticeUI({getState,getPage,api,esc,date,heading,btn,empty,sound}){
 const shownLiveNotices=new Set();
 let lastNoticeRouteKey='',liveAlertTimer=0;
 const LIVE_NOTICE_MS=3000;
 const notices=()=>getState().notices||[];
 const routeKey=value=>{try{return new URL(String(value||''),location.href).hash.replace(/^#/,'');}catch{return String(value||'').replace(/^\/?#/,'');}};
 const pageChatRoute=()=>{const hash=location.hash.replace(/^#/,'');return /^(chat-admin|chat|chat-equipo)\/[A-Za-z0-9_-]+$/.test(hash)?'/#'+hash:'';};
 const activeChatRoute=()=>pageChatRoute()||document.documentElement?.dataset.amcActiveChatRoute||'';
 function clearLiveAlert(id=''){
  const host=document.querySelector('#amc-live-alert');
  if(!host||id&&host.dataset.noticeId!==String(id))return;
  if(liveAlertTimer){clearTimeout(liveAlertTimer);liveAlertTimer=0;}
  host.replaceChildren();delete host.dataset.noticeId;
 }
 function suppressActiveChat(notice){
  const active=activeChatRoute();
  if(!notice||!active||routeKey(notice.url)!==routeKey(active))return false;
  shownLiveNotices.add(notice.id);
  clearLiveAlert();
  queueMicrotask(async()=>{try{const result=await api('/api/notices/read',{route:active});applyRead(result.noticeIds||[notice.id]);}catch{}});
  return true;
 }
 function showInternal(notice){
  const alreadyKnown=!!notice&&notices().some(n=>n.id===notice.id);
  if(!notice||notice.read||alreadyKnown||notice.priority==='normal'||shownLiveNotices.has(notice.id)||suppressActiveChat(notice))return;
  shownLiveNotices.add(notice.id);
  const host=document.querySelector('#amc-live-alert');
  if(!host)return;
  clearLiveAlert();
  host.dataset.noticeId=String(notice.id||'');
  host.innerHTML=`<article class="amc-alert-card" data-priority="${esc(notice.priority)}"><button type="button" class="amc-alert-close" aria-label="Cerrar aviso">×</button><h2>${esc(notice.title)}</h2><p>${esc(notice.body)}</p><a href="${esc(notice.url||'/#avisos')}">Ver detalle →</a></article>`;
  const close=()=>clearLiveAlert(notice.id);
  host.querySelector('.amc-alert-close').onclick=close;
  liveAlertTimer=setTimeout(close,LIVE_NOTICE_MS);
  if(notice.priority==='urgent')sound();
 }
 function paintCount(){
  const el=document.querySelector('#notice-count'),count=notices().filter(n=>!n.read).length;
  if(el){el.textContent=count;el.hidden=!count;}
  return count;
 }
 function applyRead(ids=[]){
  if(!ids?.length)return;
  const read=new Set(ids);
  for(const n of notices())if(read.has(n.id)){n.read=true;n.readAt=n.readAt||new Date().toISOString();}
  paintCount();
  for(const id of read){
   const card=document.querySelector('[data-notice-card="'+CSS.escape(id)+'"]');
   if(card){card.classList.remove('unread');card.querySelector('[data-notice-state]')?.replaceChildren(document.createTextNode('Leído'));}
   try{window.AMCNative?.clearNotification?.(id);}catch{}
  }
  try{navigator.serviceWorker?.controller?.postMessage({type:'AMC_NOTICE_READ',ids:[...read]});}catch{}
 }
 async function syncVisible(){
  const state=getState(),page=getPage(),active=activeChatRoute();
  if(!state.user||(!active&&page==='avisos'))return;
  const unread=notices().filter(n=>!n.read);
  if(!unread.length)return;
  const route=active||'#'+page,key=state.user.id+'|'+route+'|'+unread.map(n=>n.id).join(',');
  if(key===lastNoticeRouteKey)return;
  lastNoticeRouteKey=key;
  try{const result=await api('/api/notices/read',{route});applyRead(result.noticeIds||[]);}catch{lastNoticeRouteKey='';}
 }
 function view(){
  const state=getState(),items=notices(),unread=items.filter(n=>!n.read).length,read=items.length-unread;
  return (state.user?.role==='employee'?'<a class="inline-action" href="/offline.html">Trabajo sin conexión →</a>':'')+
   heading('SIEMPRE AL TANTO','Avisos',unread?unread+' pendiente'+(unread===1?'':'s')+' de revisar.':'No tenés avisos pendientes.')+
   `<div class="pill-nav">${btn('Habilitar avisos en este dispositivo','enable-push')}${btn('Escuchar sonido','test-sound','','outline')}${unread?btn('Marcar todos como leídos','read','','outline'):''}${read?'<button type="button" class="outline" data-maintenance-action="delete-read-notices">Borrar leídos</button>':''}${items.length?'<button type="button" class="outline danger" data-maintenance-action="delete-all-notices">Borrar todos</button>':''}</div><p class="muted">Cuando abrís el contenido relacionado —por ejemplo un chat, presupuesto, tarea o cierre— el aviso se marca leído automáticamente. También podés limpiar esta bandeja cuando ya no necesites conservar un aviso.</p>${items.map(n=>`<article class="notification ${n.read?'':'unread'}" data-notice-card="${esc(n.id)}" data-priority="${esc(n.priority||'normal')}"><div><div class="title-row"><strong>${esc(n.title)}</strong><small data-notice-state>${n.read?'Leído':'Pendiente'}</small></div><p>${esc(n.body)}</p><small>${date(n.date)}</small><div class="notice-card-actions"><a data-notice="${n.id}" href="${esc(n.url)}">${n.read?'Ver de nuevo':'Ver'} →</a><button type="button" class="outline" data-maintenance-action="delete-notice" data-id="${esc(n.id)}">Borrar</button></div></div></article>`).join('')||empty('No tenés avisos','Las novedades de tus pedidos aparecerán acá.')}`;
 }
 function resetRoute(){lastNoticeRouteKey='';clearLiveAlert();}
 return {showInternal,paintCount,applyRead,syncVisible,view,resetRoute};
}
