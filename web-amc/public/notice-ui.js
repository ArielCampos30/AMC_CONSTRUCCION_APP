export function createNoticeUI({getState,getPage,api,esc,date,heading,btn,empty,sound}){
 const shownLiveNotices=new Set();
 let lastNoticeRouteKey='';
 const notices=()=>getState().notices||[];
 function showInternal(notice){
  if(!notice||notice.priority==='normal'||shownLiveNotices.has(notice.id))return;
  shownLiveNotices.add(notice.id);
  const host=document.querySelector('#amc-live-alert');
  if(!host)return;
  host.innerHTML=`<article class="amc-alert-card" data-priority="${esc(notice.priority)}"><button type="button" class="amc-alert-close" aria-label="Cerrar aviso">×</button><h2>${esc(notice.title)}</h2><p>${esc(notice.body)}</p><a href="${esc(notice.url||'/#avisos')}">Ver detalle →</a></article>`;
  host.querySelector('.amc-alert-close').onclick=()=>host.replaceChildren();
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
  const state=getState(),page=getPage();
  if(!state.user||page==='avisos')return;
  const unread=notices().filter(n=>!n.read);
  if(!unread.length)return;
  const route='#'+page,key=state.user.id+'|'+route+'|'+unread.map(n=>n.id).join(',');
  if(key===lastNoticeRouteKey)return;
  lastNoticeRouteKey=key;
  try{const result=await api('/api/notices/read',{route});applyRead(result.noticeIds||[]);}catch{lastNoticeRouteKey='';}
 }
 function view(){
  const state=getState(),unread=notices().filter(n=>!n.read).length;
  return (state.user?.role==='employee'?'<a class="inline-action" href="/offline.html">Trabajo sin conexión →</a>':'')+
   heading('SIEMPRE AL TANTO','Avisos',unread?unread+' pendiente'+(unread===1?'':'s')+' de revisar.':'No tenés avisos pendientes.')+
   `<div class="pill-nav">${btn('Habilitar avisos en este dispositivo','enable-push')}${btn('Escuchar sonido','test-sound','','outline')}${unread?btn('Marcar todos como leídos','read','','outline'):''}</div><p class="muted">Cuando abrís el contenido relacionado —por ejemplo un chat, presupuesto, tarea o cierre— el aviso se marca leído automáticamente.</p>${notices().map(n=>`<article class="notification ${n.read?'':'unread'}" data-notice-card="${esc(n.id)}" data-priority="${esc(n.priority||'normal')}"><div><div class="title-row"><strong>${esc(n.title)}</strong><small data-notice-state>${n.read?'Leído':'Pendiente'}</small></div><p>${esc(n.body)}</p><small>${date(n.date)}</small><a data-notice="${n.id}" href="${esc(n.url)}">${n.read?'Ver de nuevo':'Ver'} →</a></div></article>`).join('')||empty('No tenés avisos','Las novedades de tus pedidos aparecerán acá.')}`;
 }
 function resetRoute(){lastNoticeRouteKey='';}
 return {showInternal,paintCount,applyRead,syncVisible,view,resetRoute};
}
