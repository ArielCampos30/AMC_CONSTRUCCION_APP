export function createAdminQuoteMaintenanceController({
  documentRef=globalThis.document,
  api=async()=>({}),
  reload=async()=>{},
  render=()=>{},
  navigate=()=>{},
  onSuccess=text=>{const el=documentRef?.querySelector?.('#toast');if(!el)return;el.textContent=text;el.classList.add('show');},
  onError=()=>{},
  confirmAction=(message,title,confirmLabel)=>globalThis.window?.AMCConfirm?globalThis.window.AMCConfirm(message,{title,confirmLabel}):Promise.resolve(globalThis.window?.confirm?.(message)),
}={}){
  const actions=new Set(['archive-quote','unarchive-quote','delete-quote','trash-request','trash-quote','restore-trash','delete-trash']);
  const detachCard=button=>{
    const card=button.closest?.('.admin-v3-card');
    if(!card)return {restore:()=>{},detached:false};
    const parent=card.parentNode,next=card.nextSibling;
    card.remove();
    return {detached:true,restore:()=>{if(card.isConnected||!parent?.isConnected)return;parent.insertBefore(card,next?.parentNode===parent?next:null);}};
  };
  const refresh=async()=>{await reload?.();render?.();};
  const handleClick=async event=>{
    const button=event.target.closest?.('[data-maintenance-action]');
    const action=button?.dataset?.maintenanceAction;
    if(!button||!actions.has(action))return false;
    event.preventDefault?.();
    event.stopImmediatePropagation?.();
    if(button.disabled)return true;
    button.disabled=true;
    let optimistic={restore:()=>{},detached:false};
    try{
      if(action==='archive-quote'){
        if(!await confirmAction('El presupuesto saldrá de Pendientes y quedará disponible en Archivados.','Archivar presupuesto','Archivar'))return true;
        optimistic=detachCard(button);
        await api('/api/quotes/'+encodeURIComponent(button.dataset.id)+'/archive',{});
        onSuccess('Presupuesto archivado.');
      }
      if(action==='unarchive-quote'){
        optimistic=detachCard(button);
        await api('/api/quotes/'+encodeURIComponent(button.dataset.id)+'/unarchive',{});
        onSuccess('Presupuesto recuperado.');
      }
      if(action==='delete-quote'){
        if(!await confirmAction('¿Eliminar definitivamente este presupuesto archivado? Sólo se permite si no creó una obra.','Eliminar presupuesto','Eliminar definitivamente'))return true;
        optimistic=detachCard(button);
        await api('/api/quotes/'+encodeURIComponent(button.dataset.id)+'/delete',{});
        onSuccess('Presupuesto eliminado.');
      }
      if(action==='trash-request'){
        if(!await confirmAction('La solicitud y sus presupuestos, visitas y seguimientos relacionados saldrán de los circuitos activos. Podrás restaurarlos desde Papelera. Si existe una obra, AMC bloqueará la acción.','Mover solicitud a Papelera','Mover a Papelera'))return true;
        optimistic=detachCard(button);
        await api('/api/admin/trash/requests/'+encodeURIComponent(button.dataset.id),{});
        await refresh();onSuccess('Solicitud movida a Papelera.');
        if(!optimistic.detached)navigate?.('papelera');
      }
      if(action==='trash-quote'){
        if(!await confirmAction('El presupuesto saldrá de los circuitos activos y quedará disponible en Papelera. La solicitud se conservará.','Mover presupuesto a Papelera','Mover a Papelera'))return true;
        optimistic=detachCard(button);
        await api('/api/admin/trash/quotes/'+encodeURIComponent(button.dataset.id),{});
        await refresh();onSuccess('Presupuesto movido a Papelera.');
        if(!optimistic.detached)navigate?.('papelera');
      }
      if(action==='restore-trash'){
        optimistic=detachCard(button);
        await api('/api/admin/trash/'+encodeURIComponent(button.dataset.id)+'/restore',{});
        await refresh();onSuccess('Elemento restaurado.');
      }
      if(action==='delete-trash'){
        if(!await confirmAction('Esta acción borra definitivamente los registros de esta entrada. No se puede deshacer.','Eliminar definitivamente','Eliminar definitivamente'))return true;
        optimistic=detachCard(button);
        await api('/api/admin/trash/'+encodeURIComponent(button.dataset.id)+'/delete',{});
        await refresh();onSuccess('Elemento eliminado definitivamente.');
      }
    }catch(error){
      optimistic.restore();
      onError(error);
    }finally{
      button.disabled=false;
    }
    return true;
  };
  const attach=()=>documentRef.addEventListener('click',handleClick,true);
  return {attach,handleClick};
}
