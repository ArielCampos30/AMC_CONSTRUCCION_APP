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
async function csrf(){const response=await fetch('/api/state',{credentials:'same-origin'});if(!response.ok)throw Error('No se pudo verificar la sesión.');const state=await response.json();if(!state.user)throw Error('Ingresá a tu cuenta para continuar.');return state.csrf||'';}
async function post(path,body={}){const token=await csrf(),response=await fetch(path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':token},body:JSON.stringify(body)}),value=await response.json().catch(()=>({}));if(!response.ok)throw Error(value.error||'No se pudo completar la operación.');return value;}
const confirmAction=(message,title,confirmLabel)=>window.AMCConfirm?window.AMCConfirm(message,{title,confirmLabel}):Promise.resolve(confirm(message));

// El diálogo flotante es modal: un toque real sobre el fondo debe cerrarlo, pero nunca
// un toque dentro del chat, en el teclado/compositor o en sus controles.
document.addEventListener('pointerdown',event=>{
 const dialog=document.querySelector('#amc-chat-dialog[open]');if(!dialog)return;
 const rect=dialog.getBoundingClientRect(),outside=event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom;
 if(outside){event.preventDefault();dialog.close();}
},true);

function refreshAppearanceLabels(){const cards=[...document.querySelectorAll('.appearance-photo-card')];cards.forEach((card,index)=>{const badge=card.querySelector('[data-photo-role]');if(badge)badge.textContent=index===0?'Foto principal':'Galería';});}

document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-maintenance-action]');if(!button)return;
 const action=button.dataset.maintenanceAction;
 if(action==='appearance-remove-photo'){button.closest('.appearance-photo-card')?.remove();refreshAppearanceLabels();return;}
 if(action==='appearance-main-photo'){const card=button.closest('.appearance-photo-card'),list=card?.parentElement;if(card&&list){list.prepend(card);refreshAppearanceLabels();}return;}
 if(action==='appearance-clear-photos'){if(await confirmAction('La portada volverá a mostrar sólo la marca AMC cuando guardes los cambios.','Quitar fotos de portada','Dejar sólo el logo')){document.querySelector('.appearance-photo-list')?.replaceChildren();refreshAppearanceLabels();}return;}
 if(!['delete-notice','delete-read-notices','delete-all-notices','restore-appearance','archive-quote','unarchive-quote','delete-quote'].includes(action))return;
 event.preventDefault();event.stopImmediatePropagation();if(button.disabled)return;button.disabled=true;
 try{
  if(action==='delete-notice'){if(!await confirmAction('¿Borrar este aviso de la bandeja?','Borrar aviso','Borrar'))return;await post('/api/notices/delete',{id:button.dataset.id});toast('Aviso borrado.');}
  if(action==='delete-read-notices'){if(!await confirmAction('¿Borrar todos los avisos que ya están leídos?','Limpiar avisos','Borrar leídos'))return;await post('/api/notices/delete',{scope:'read'});toast('Avisos leídos borrados.');}
  if(action==='delete-all-notices'){if(!await confirmAction('¿Borrar toda la bandeja de avisos? Esta acción no elimina presupuestos, obras ni mensajes.','Vaciar bandeja','Borrar todos'))return;await post('/api/notices/delete',{scope:'all'});toast('Bandeja de avisos vaciada.');}
  if(action==='restore-appearance'){if(!await confirmAction('¿Restaurar esta versión de la portada pública? La portada actual quedará guardada en el historial.','Restaurar portada','Restaurar'))return;await post('/api/appearance/restore',{versionAt:button.dataset.version});toast('Portada restaurada.');}
  if(action==='archive-quote'){if(!await confirmAction('El presupuesto saldrá de Pendientes y quedará disponible en Archivados.','Archivar presupuesto','Archivar'))return;await post('/api/quotes/'+encodeURIComponent(button.dataset.id)+'/archive');toast('Presupuesto archivado.');}
  if(action==='unarchive-quote'){await post('/api/quotes/'+encodeURIComponent(button.dataset.id)+'/unarchive');toast('Presupuesto recuperado.');}
  if(action==='delete-quote'){if(!await confirmAction('¿Eliminar definitivamente este presupuesto archivado? Sólo se permite si no creó una obra.','Eliminar presupuesto','Eliminar definitivamente'))return;await post('/api/quotes/'+encodeURIComponent(button.dataset.id)+'/delete');toast('Presupuesto eliminado.');}
  setTimeout(()=>location.reload(),180);
 }catch(error){toast(error.message);}finally{button.disabled=false;}
},true);

refreshAppearanceLabels();
new MutationObserver(()=>refreshAppearanceLabels()).observe(document.documentElement,{subtree:true,childList:true});
