export function createAppShellNoticeClickController({
 documentRef=globalThis.document,
 locationRef=globalThis.location,
 api=async()=>({}),
 applyNoticeRead=()=>{},
 onError=()=>{},
 onSuccess=text=>{const el=documentRef?.querySelector?.('#toast');if(!el)return;el.textContent=text;el.classList.add('show');},
 confirmAction=(message,title,confirmLabel)=>globalThis.window?.AMCConfirm?globalThis.window.AMCConfirm(message,{title,confirmLabel}):Promise.resolve(globalThis.window?.confirm?.(message)),
 createUrl=(value,base)=>new URL(value,base),
 createMutationObserver=callback=>typeof globalThis.MutationObserver==='function'?new globalThis.MutationObserver(callback):null,
 setTimeoutRef=globalThis.setTimeout,
 cssEscape=value=>globalThis.CSS?.escape?.(String(value))??String(value).replace(/["\\]/g,'\\$&'),
}={}){
 const deletedNoticeIds=new Set();
 const currentRoute=()=>String(locationRef.hash||'').replace(/^#/,'')||'inicio';
 const syncNoticeCount=()=>{
  const cards=[...(documentRef.querySelectorAll?.('[data-notice-card]')||[])];
  if(!cards.length&&currentRoute()!=='avisos')return;
  const unread=cards.filter(card=>card.classList?.contains('unread')).length,count=documentRef.querySelector?.('#notice-count');
  if(count){count.textContent=String(unread);count.hidden=!unread;}
 };
 const pruneDeletedNotices=()=>{
  for(const id of deletedNoticeIds)documentRef.querySelector?.('[data-notice-card="'+cssEscape(id)+'"]')?.remove();
  syncNoticeCount();
 };
 const detachNodes=nodes=>{
  const snapshots=[...new Set(nodes.filter(Boolean))].map(node=>({node,parent:node.parentNode,next:node.nextSibling}));
  snapshots.forEach(({node})=>node.remove());
  return ()=>{for(const {node,parent,next} of snapshots){if(node.isConnected||!parent?.isConnected)continue;parent.insertBefore(node,next?.parentNode===parent?next:null);}};
 };
 const deleteNotice=async(button,event)=>{
  event.preventDefault();
  event.stopPropagation?.();
  event.stopImmediatePropagation?.();
  if(button.disabled)return;
  const id=button.dataset.id||'',card=button.closest('[data-notice-card]'),parent=card?.parentNode,next=card?.nextSibling;
  button.disabled=true;
  deletedNoticeIds.add(id);
  card?.remove();
  pruneDeletedNotices();
  documentRef.querySelector?.('#amc-live-alert[data-notice-id="'+cssEscape(id)+'"]')?.replaceChildren();
  try{
   await api('/api/notices/read',{deleteId:id});
   setTimeoutRef?.(()=>deletedNoticeIds.delete(id),15000);
  }catch(error){
   deletedNoticeIds.delete(id);
   if(card&&parent?.isConnected&&!card.isConnected)parent.insertBefore(card,next?.parentNode===parent?next:null);
   syncNoticeCount();
   onError(error);
  }finally{
   if(button.isConnected)button.disabled=false;
  }
 };
 const deleteScope=async(button,event,scope)=>{
  event.preventDefault();
  event.stopPropagation?.();
  event.stopImmediatePropagation?.();
  if(button.disabled)return;
  button.disabled=true;
  let restoreOptimistic=()=>{};
  try{
   const readOnly=scope==='read';
   const confirmed=await confirmAction(
    readOnly?'¿Borrar todos los avisos que ya están leídos?':'¿Borrar toda la bandeja de avisos? Esta acción no elimina presupuestos, obras ni mensajes.',
    readOnly?'Limpiar avisos':'Vaciar bandeja',
    readOnly?'Borrar leídos':'Borrar todos'
   );
   if(!confirmed)return;
   const selector=readOnly?'[data-notice-card]:not(.unread)':'[data-notice-card]';
   restoreOptimistic=detachNodes([...(documentRef.querySelectorAll?.(selector)||[])]);
   syncNoticeCount();
   await api('/api/notices/read',{deleteScope:scope});
   onSuccess(readOnly?'Avisos leídos borrados.':'Bandeja de avisos vaciada.');
  }catch(error){
   restoreOptimistic();
   syncNoticeCount();
   onError(error);
  }finally{
   if(button.isConnected)button.disabled=false;
  }
 };
 const handleClick=async event=>{
  const deleteButton=event.target.closest?.('[data-maintenance-action="delete-notice"]');
  if(deleteButton){await deleteNotice(deleteButton,event);return;}
  const deleteReadButton=event.target.closest?.('[data-maintenance-action="delete-read-notices"]');
  if(deleteReadButton){await deleteScope(deleteReadButton,event,'read');return;}
  const deleteAllButton=event.target.closest?.('[data-maintenance-action="delete-all-notices"]');
  if(deleteAllButton){await deleteScope(deleteAllButton,event,'all');return;}
  const link=event.target.closest?.('[data-notice]');
  if(!link)return;
  event.preventDefault();
  if(link.dataset.reading==='1')return;
  link.dataset.reading='1';
  try{
   const result=await api('/api/notices/read',{id:link.dataset.notice});
   applyNoticeRead(result.noticeIds||[link.dataset.notice]);
   const target=createUrl(link.href,locationRef.href);
   locationRef.hash=target.hash||'#avisos';
  }catch(error){
   onError(error);
  }finally{
   delete link.dataset.reading;
  }
 };
 const attach=()=>{
  documentRef.addEventListener('click',handleClick);
  const app=documentRef.querySelector?.('#app'),observer=app?createMutationObserver(pruneDeletedNotices):null;
  observer?.observe(app,{childList:true});
  pruneDeletedNotices();
 };
 return {attach,handleClick,pruneDeletedNotices,syncNoticeCount};
}
