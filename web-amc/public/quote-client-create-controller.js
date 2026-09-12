export function createQuoteClientCreateController({getState,api,refresh,navigate,toast,wizard}){
 let saving=false;
 const clientRows=()=>getState().agendaClients||getState().clients||[];
 const setBusy=(form,busy)=>{
  const button=form?.querySelector('button[type="submit"]');
  if(button){button.disabled=busy;button.textContent=busy?'Guardando…':'Guardar y usar cliente';}
 };
 const showError=(form,message)=>{
  let node=form?.querySelector('[data-qw-client-create-error]');
  if(!node&&form){node=document.createElement('p');node.className='quote-inline-error';node.dataset.qwClientCreateError='1';form.querySelector('.quote-new-client-actions')?.before(node);}
  if(node)node.textContent=String(message||'No se pudo guardar el cliente.');
 };
 async function submit(event){
  const form=event.target?.closest?.('[data-qw-new-client-form]');
  if(!form||!document.querySelector('.quote-wizard-host'))return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if(saving)return;
  const data=new FormData(form),draft={name:String(data.get('name')||'').trim(),phone:String(data.get('phone')||'').trim(),town:String(data.get('town')||'').trim()};
  if(!draft.name||!draft.phone||!draft.town){showError(form,'Completá nombre, teléfono y localidad.');return;}
  saving=true;setBusy(form,true);showError(form,'');
  try{
   const payload=await api('/api/admin/clients',draft),client=payload?.duplicate||payload;
   if(!client?.id)throw Error('AMC no devolvió la ficha del cliente.');
   await refresh?.();
   const persisted=clientRows().find(item=>String(item?.id||'')===String(client.id))||client;
   const lead=!Number(persisted?.hasAccount);
   wizard.prefillClient(String(client.id),lead);
   wizard.open();
   navigate('cotizador');
   toast?.(payload?.duplicate?'Ese teléfono ya existía. Seleccioné la ficha existente.':'Cliente guardado y seleccionado.');
  }catch(error){showError(form,error?.message||'No se pudo guardar el cliente.');}
  finally{saving=false;if(form.isConnected)setBusy(form,false);}
 }
 document.addEventListener('submit',submit,true);
 return {destroy(){document.removeEventListener('submit',submit,true);}};
}
