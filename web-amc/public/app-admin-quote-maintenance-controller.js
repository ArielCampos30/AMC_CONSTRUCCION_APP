export function createAdminQuoteMaintenanceController({
  documentRef=globalThis.document,
  api=async()=>({}),
  onSuccess=text=>{const el=documentRef?.querySelector?.('#toast');if(!el)return;el.textContent=text;el.classList.add('show');},
  onError=()=>{},
  confirmAction=(message,title,confirmLabel)=>globalThis.window?.AMCConfirm?globalThis.window.AMCConfirm(message,{title,confirmLabel}):Promise.resolve(globalThis.window?.confirm?.(message)),
}={}){
  const actions=new Set(['archive-quote','unarchive-quote','delete-quote']);
  const detachCard=button=>{
    const card=button.closest?.('.admin-v3-card');
    if(!card)return ()=>{};
    const parent=card.parentNode,next=card.nextSibling;
    card.remove();
    return ()=>{if(card.isConnected||!parent?.isConnected)return;parent.insertBefore(card,next?.parentNode===parent?next:null);};
  };
  const handleClick=async event=>{
    const button=event.target.closest?.('[data-maintenance-action]');
    const action=button?.dataset?.maintenanceAction;
    if(!button||!actions.has(action))return false;
    event.preventDefault?.();
    event.stopImmediatePropagation?.();
    if(button.disabled)return true;
    button.disabled=true;
    let restoreOptimistic=()=>{};
    try{
      if(action==='archive-quote'){
        if(!await confirmAction('El presupuesto saldrá de Pendientes y quedará disponible en Archivados.','Archivar presupuesto','Archivar'))return true;
        restoreOptimistic=detachCard(button);
        await api('/api/quotes/'+encodeURIComponent(button.dataset.id)+'/archive',{});
        onSuccess('Presupuesto archivado.');
      }
      if(action==='unarchive-quote'){
        restoreOptimistic=detachCard(button);
        await api('/api/quotes/'+encodeURIComponent(button.dataset.id)+'/unarchive',{});
        onSuccess('Presupuesto recuperado.');
      }
      if(action==='delete-quote'){
        if(!await confirmAction('¿Eliminar definitivamente este presupuesto archivado? Sólo se permite si no creó una obra.','Eliminar presupuesto','Eliminar definitivamente'))return true;
        restoreOptimistic=detachCard(button);
        await api('/api/quotes/'+encodeURIComponent(button.dataset.id)+'/delete',{});
        onSuccess('Presupuesto eliminado.');
      }
    }catch(error){
      restoreOptimistic();
      onError(error);
    }finally{
      button.disabled=false;
    }
    return true;
  };
  const attach=()=>documentRef.addEventListener('click',handleClick,true);
  return {attach,handleClick};
}
