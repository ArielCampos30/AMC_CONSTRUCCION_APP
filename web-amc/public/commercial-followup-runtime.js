export function createCommercialFollowupRuntime({api}){
 return {
  async submit(form,data,submitter){
   if(!form?.classList?.contains('commercial-followup-form'))return false;
   const requestId=form.dataset.id||'';
   if(!requestId)throw Error('No encontramos la oportunidad comercial.');
   const action=submitter?.value==='contacted'?'contacted':'save';
   await api('/api/admin/commercial-followups/'+encodeURIComponent(requestId),{nextAction:data.nextAction||'',nextActionDay:data.nextActionDay||'',note:data.note||'',action});
   return true;
  }
 };
}
