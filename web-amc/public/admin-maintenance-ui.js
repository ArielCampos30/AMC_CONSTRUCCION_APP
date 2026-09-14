const maintenanceStyle=document.createElement('style');
maintenanceStyle.textContent=`
#amc-chat-dialog .compact-composer{grid-template-columns:40px minmax(0,1fr) 44px!important;width:100%!important;box-sizing:border-box!important}
#amc-chat-dialog .compact-composer>textarea{grid-column:2!important;min-width:0!important;width:100%!important;max-width:none!important;display:block!important}
#amc-chat-dialog .compact-composer>.chat-icon-button:not(.chat-send-icon){grid-column:1!important}
#amc-chat-dialog .compact-composer>.chat-send-icon{grid-column:3!important}
#amc-chat-dialog .compact-composer input[type=file][hidden]{display:none!important}
.danger{border-color:#b94c4c!important;color:#8c2f2f!important}
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

function detachNodes(nodes){
 const snapshots=[...new Set(nodes.filter(Boolean))].map(node=>({node,parent:node.parentNode,next:node.nextSibling}));
 snapshots.forEach(({node})=>node.remove());
 return ()=>{for(const {node,parent,next} of snapshots){if(node.isConnected||!parent?.isConnected)continue;parent.insertBefore(node,next?.parentNode===parent?next:null);}};
}
function optimisticTargets(button){return [button.closest('.admin-v3-card')];}

document.addEventListener('pointerdown',event=>{
 const dialog=document.querySelector('#amc-chat-dialog[open]');if(!dialog)return;
 const rect=dialog.getBoundingClientRect(),outside=event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom;
 if(outside){event.preventDefault();dialog.close();}
},true);

document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-maintenance-action]');if(!button)return;
 const action=button.dataset.maintenanceAction;
 if(!['archive-quote','unarchive-quote','delete-quote'].includes(action))return;
 event.preventDefault();event.stopImmediatePropagation();if(button.disabled)return;button.disabled=true;
 let restoreOptimistic=()=>{};
 try{
  if(action==='archive-quote'){
   if(!await confirmAction('El presupuesto saldrá de Pendientes y quedará disponible en Archivados.','Archivar presupuesto','Archivar'))return;
   restoreOptimistic=detachNodes(optimisticTargets(button));
   await post('/api/quotes/'+encodeURIComponent(button.dataset.id)+'/archive');toast('Presupuesto archivado.');
  }
  if(action==='unarchive-quote'){
   restoreOptimistic=detachNodes(optimisticTargets(button));
   await post('/api/quotes/'+encodeURIComponent(button.dataset.id)+'/unarchive');toast('Presupuesto recuperado.');
  }
  if(action==='delete-quote'){
   if(!await confirmAction('¿Eliminar definitivamente este presupuesto archivado? Sólo se permite si no creó una obra.','Eliminar presupuesto','Eliminar definitivamente'))return;
   restoreOptimistic=detachNodes(optimisticTargets(button));
   await post('/api/quotes/'+encodeURIComponent(button.dataset.id)+'/delete');toast('Presupuesto eliminado.');
  }
 }catch(error){restoreOptimistic();toast(error.message);}finally{button.disabled=false;}
},true);
