export function createAppShellClickController({
  documentRef=globalThis.document,
  render,
  navigate,
  api,
  applyNoticeRead,
  teamClick,
  planningClick,
  reload,
  onAdminFilter,
  onAdminChatTab,
  onAdminEmployee,
  setDirty,
  onAction,
  onError,
  createDataTransfer=()=>new globalThis.DataTransfer(),
  createEvent=(type,options)=>new globalThis.Event(type,options),
}={}){
  async function handleClick(e){
    const removePhoto=e.target.closest('[data-remove-request-photo]');
    if(removePhoto){
      const [name,index]=removePhoto.dataset.removeRequestPhoto.split(':'),input=removePhoto.closest('form')?.elements[name],transfer=createDataTransfer();
      [...(input?.files||[])].forEach((file,i)=>{if(i!==Number(index))transfer.items.add(file);});
      input.files=transfer.files;
      input.dispatchEvent(createEvent('change',{bubbles:true}));
      return;
    }

    const filter=e.target.closest('[data-admin-filter]');
    if(filter){
      onAdminFilter?.(filter.dataset.adminFilter,filter.dataset.value);
      render?.();
      return;
    }

    const tab=e.target.closest('[data-admin-chat]');
    if(tab){
      onAdminChatTab?.(tab.dataset.adminChat);
      render?.();
      return;
    }

    const employee=e.target.closest('[data-admin-employee]');
    if(employee){
      const employeeId=employee.dataset.adminEmployee;
      onAdminEmployee?.(employeeId);
      render?.();
      api('/api/staff-chat/read',{employeeId}).then(result=>applyNoticeRead?.(result.noticeIds||[])).catch(()=>{});
      return;
    }

    const actionMenu=e.target.closest('.admin-v3-actions details');
    if(!actionMenu)documentRef.querySelectorAll('.admin-v3-actions details[open]').forEach(detail=>detail.removeAttribute('open'));
    const summary=e.target.closest('.admin-v3-actions details>summary');
    if(summary){
      const current=summary.parentElement;
      documentRef.querySelectorAll('.admin-v3-actions details[open]').forEach(detail=>{if(detail!==current)detail.removeAttribute('open');});
      setDirty?.(true);
    }

    const nav=e.target.closest('[data-nav]');
    if(nav){
      navigate?.(nav.dataset.nav);
      return;
    }

    const button=e.target.closest('[data-action]');
    if(!button)return;
    try{
      if(teamClick?.(button.dataset.action,button.dataset.value)){
        render?.();
        return;
      }
      if(await planningClick?.(button.dataset.action,button.dataset.id)){
        if(button.dataset.action==='calendar-cancel')await reload?.();
        setDirty?.(false);
        render?.();
        return;
      }
      await onAction?.(button);
    }catch(err){
      if(err?.name!=='AbortError')onError?.(err);
    }
  }

  function attach(){documentRef.addEventListener('click',handleClick);}
  return {handleClick,attach};
}
