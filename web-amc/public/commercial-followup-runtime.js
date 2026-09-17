export function createCommercialFollowupRuntime({api,openExternal=url=>globalThis.open?.(url,'_blank','noopener,noreferrer')}){
 return {
  async submit(form,data,submitter){
   if(!form?.classList?.contains('commercial-followup-form'))return false;
   const requestId=form.dataset.id||'';
   if(!requestId)throw Error('No encontramos la oportunidad comercial.');
   const requestedAction=submitter?.value||'';
   const action=requestedAction==='contacted'?'contacted':requestedAction==='whatsapp'?'whatsapp_opened':'save';
   if(action==='whatsapp_opened'){
    const whatsappUrl=String(submitter?.dataset?.whatsappUrl||'');
    if(!/^https:\/\/wa\.me\/\d+\?text=/.test(whatsappUrl))throw Error('No encontramos un WhatsApp válido para esta oportunidad.');
    openExternal(whatsappUrl);
   }
   await api('/api/admin/commercial-followups/'+encodeURIComponent(requestId),{nextAction:data.nextAction||'',nextActionDay:data.nextActionDay||'',note:data.note||'',action});
   return true;
  }
 };
}
