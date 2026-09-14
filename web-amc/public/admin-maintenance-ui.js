const maintenanceStyle=document.createElement('style');
maintenanceStyle.textContent=`
#amc-chat-dialog .compact-composer{grid-template-columns:40px minmax(0,1fr) 44px!important;width:100%!important;box-sizing:border-box!important}
#amc-chat-dialog .compact-composer>textarea{grid-column:2!important;min-width:0!important;width:100%!important;max-width:none!important;display:block!important}
#amc-chat-dialog .compact-composer>.chat-icon-button:not(.chat-send-icon){grid-column:1!important}
#amc-chat-dialog .compact-composer>.chat-send-icon{grid-column:3!important}
#amc-chat-dialog .compact-composer input[type=file][hidden]{display:none!important}
.notice-card-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:8px}.notice-card-actions button{min-height:34px;padding:5px 10px}
.appearance-photo-list{display:grid;gap:12px}.appearance-photo-card{display:grid;grid-template-columns:minmax(120px,220px) minmax(0,1fr);gap:14px;align-items:start}.appearance-photo-card img{width:100%;height:140px;object-fit:cover;border-radius:12px}.appearance-photo-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.appearance-preview{overflow:hidden}.appearance-preview img{width:100%;max-height:320px;object-fit:cover;border-radius:14px}.appearance-history{display:grid;gap:8px}.appearance-history article{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px;border:1px solid #dbe7e3;border-radius:12px}.danger{border-color:#b94c4c!important;color:#8c2f2f!important}
@media(max-width:650px){.appearance-photo-card{grid-template-columns:1fr}.appearance-photo-card img{height:190px}}
`;
document.head.append(maintenanceStyle);

function toast(text){const el=document.querySelector('#toast');if(!el)return;el.textContent=text;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),4500);}
let csrfValue='',csrfPending=null;
async function csrf(force=false){
 if(!force&&csrfValue)return csrfValue;
 if(!force&&csrfPending)return csrfPending;
 csrfPending=(async()=>{const response=await fetch('/api/state',{credentials:'same-origin'});if(!response.ok)throw Error('No se pudo verificar la sesión.');const state=await response.json();if(!state.user)throw Error('Ingresá a tu cuenta para continuar.');csrfValue=state.csrf||'';return csrfValue;})();
 try{return await csrfPending;}finally{csrfPending=null;}
}
async function post(path,body={}){
 for(let attempt=0;attempt<2;attempt++){
  const token=await csrf(attempt>0),response=await fetch(path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':token},body:JSON.stringify(body)}),value=await response.json().catch(()=>({}));
  if(response.status===403&&attempt===0){csrfValue='';continue;}
  if(!response.ok)throw Error(value.error||'No se pudo completar la operación.');
  return value;
 }
 throw Error('No se pudo completar la operación.');
}
queueMicrotask(()=>csrf().catch(()=>{}));
const confirmAction=(message,title,confirmLabel)=>window.AMCConfirm?window.AMCConfirm(message,{title,confirmLabel}):Promise.resolve(confirm(message));
const refreshWithoutReload=()=>setTimeout(()=>window.dispatchEvent(new Event('focus')),60);

function detachNodes(nodes){
 const snapshots=[...new Set(nodes.filter(Boolean))].map(node=>({node,parent:node.parentNode,next:node.nextSibling}));
 snapshots.forEach(({node})=>node.remove());
 return ()=>{for(const {node,parent,next} of snapshots){if(node.isConnected||!parent?.isConnected)continue;parent.insertBefore(node,next?.parentNode===parent?next:null);}};
}
function syncNoticeChrome(){
 const cards=[...document.querySelectorAll('[data-notice-card]')],unread=cards.filter(card=>card.classList.contains('unread')).length,count=document.querySelector('#notice-count');
 if(count){count.textContent=String(unread);count.hidden=!unread;}
}
function optimisticTargets(action,button){
 if(action==='delete-read-notices')return [...document.querySelectorAll('[data-notice-card]:not(.unread)')];
 if(action==='delete-all-notices')return [...document.querySelectorAll('[data-notice-card]')];
 if(['archive-quote','unarchive-quote','delete-quote'].includes(action))return [button.closest('.admin-v3-card')];
 return [];
}

document.addEventListener('pointerdown',event=>{
 const dialog=document.querySelector('#amc-chat-dialog[open]');if(!dialog)return;
 const rect=dialog.getBoundingClientRect(),outside=event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom;
 if(outside){event.preventDefault();dialog.close();}
},true);

function refreshAppearanceLabels(){const list=document.querySelector('#appearance-form .appearance-photo-list');if(!list)return;[...list.querySelectorAll('.appearance-photo-card')].forEach((card,index)=>{const badge=card.querySelector('[data-photo-role]'),next=index===0?'Foto principal':'Galería';if(badge&&badge.textContent!==next)badge.textContent=next;});}

document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-maintenance-action]');if(!button)return;
 const action=button.dataset.maintenanceAction;
 if(action==='appearance-remove-photo'){button.closest('.appearance-photo-card')?.remove();refreshAppearanceLabels();return;}
 if(action==='appearance-main-photo'){const card=button.closest('.appearance-photo-card'),list=card?.parentElement;if(card&&list){list.prepend(card);refreshAppearanceLabels();}return;}
 if(action==='appearance-clear-photos'){if(await confirmAction('La portada volverá a mostrar sólo la marca AMC cuando guardes los cambios.','Quitar fotos de portada','Dejar sólo el logo')){document.querySelector('#appearance-form .appearance-photo-list')?.replaceChildren();refreshAppearanceLabels();}return;}
 if(!['delete-read-notices','delete-all-notices','restore-appearance','archive-quote','unarchive-quote','delete-quote'].includes(action))return;
 event.preventDefault();event.stopImmediatePropagation();if(button.disabled)return;button.disabled=true;
 let restoreOptimistic=()=>{};
 try{
  if(action==='delete-read-notices'){
   if(!await confirmAction('¿Borrar todos los avisos que ya están leídos?','Limpiar avisos','Borrar leídos'))return;
   restoreOptimistic=detachNodes(optimisticTargets(action,button));syncNoticeChrome();
   await post('/api/notices/read',{deleteScope:'read'});toast('Avisos leídos borrados.');
  }
  if(action==='delete-all-notices'){
   if(!await confirmAction('¿Borrar toda la bandeja de avisos? Esta acción no elimina presupuestos, obras ni mensajes.','Vaciar bandeja','Borrar todos'))return;
   restoreOptimistic=detachNodes(optimisticTargets(action,button));syncNoticeChrome();
   await post('/api/notices/read',{deleteScope:'all'});toast('Bandeja de avisos vaciada.');
  }
  if(action==='restore-appearance'){
   if(!await confirmAction('¿Restaurar esta versión de la portada pública? La portada actual quedará guardada en el historial.','Restaurar portada','Restaurar'))return;
   await post('/api/appearance/restore',{versionAt:button.dataset.version});toast('Portada restaurada.');refreshWithoutReload();
  }
  if(action==='archive-quote'){
   if(!await confirmAction('El presupuesto saldrá de Pendientes y quedará disponible en Archivados.','Archivar presupuesto','Archivar'))return;
   restoreOptimistic=detachNodes(optimisticTargets(action,button));
   await post('/api/quotes/'+encodeURIComponent(button.dataset.id)+'/archive');toast('Presupuesto archivado.');
  }
  if(action==='unarchive-quote'){
   restoreOptimistic=detachNodes(optimisticTargets(action,button));
   await post('/api/quotes/'+encodeURIComponent(button.dataset.id)+'/unarchive');toast('Presupuesto recuperado.');
  }
  if(action==='delete-quote'){
   if(!await confirmAction('¿Eliminar definitivamente este presupuesto archivado? Sólo se permite si no creó una obra.','Eliminar presupuesto','Eliminar definitivamente'))return;
   restoreOptimistic=detachNodes(optimisticTargets(action,button));
   await post('/api/quotes/'+encodeURIComponent(button.dataset.id)+'/delete');toast('Presupuesto eliminado.');
  }
 }catch(error){restoreOptimistic();syncNoticeChrome();toast(error.message);}finally{button.disabled=false;}
},true);

let appearanceSyncPending=false;
function scheduleAppearanceLabels(){if(appearanceSyncPending)return;appearanceSyncPending=true;queueMicrotask(()=>{appearanceSyncPending=false;refreshAppearanceLabels();});}
const appRoot=document.getElementById('app');
if(appRoot)new MutationObserver(scheduleAppearanceLabels).observe(appRoot,{childList:true});
window.addEventListener('hashchange',()=>{if(location.hash==='#portada')scheduleAppearanceLabels();});
refreshAppearanceLabels();
