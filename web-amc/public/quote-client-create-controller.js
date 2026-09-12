export function createQuoteClientCreateController({getState,api,navigate,toast,wizard}){
 let saving=false;
 const clientRows=()=>getState().agendaClients||getState().clients||[];
 const cleanPhone=value=>String(value||'').replace(/\D/g,'').slice(0,15);
 const upsertClient=client=>{
  const current=getState(),normalized={...client,hasAccount:Number(client?.hasAccount)||0};
  for(const name of ['agendaClients','clients']){
   if(!Array.isArray(current[name]))continue;
   const index=current[name].findIndex(item=>String(item?.id||'')===String(normalized.id));
   if(index>=0)current[name][index]={...current[name][index],...normalized};else current[name].unshift(normalized);
  }
  return normalized;
 };
 const setBusy=(form,busy)=>{
  const button=form?.querySelector('button[type="submit"]');
  if(button){button.disabled=busy;button.textContent=busy?'Guardando…':'Guardar y usar cliente';}
 };
 const showError=(form,message)=>{
  let node=form?.querySelector('[data-qw-client-create-error]');
  if(!node&&form){node=document.createElement('p');node.className='quote-inline-error';node.dataset.qwClientCreateError='1';form.querySelector('.quote-new-client-actions')?.before(node);}
  if(node){node.textContent=String(message||'');node.hidden=!message;}
 };
 function sanitizePhone(event){
  const input=event.target?.closest?.('[data-qw-new-client-form] input[name="phone"]');
  if(!input||!document.querySelector('.quote-wizard-host'))return;
  const clean=cleanPhone(input.value);
  if(input.value!==clean)input.value=clean;
  input.setCustomValidity(clean.length&&clean.length<8?'Ingresá al menos 8 números.':'');
 }
 async function submit(event){
  const form=event.target?.closest?.('[data-qw-new-client-form]');
  if(!form||!document.querySelector('.quote-wizard-host'))return;
  event.preventDefault();event.stopImmediatePropagation();
  if(saving)return;
  const data=new FormData(form),draft={name:String(data.get('name')||'').trim(),phone:cleanPhone(data.get('phone')),town:String(data.get('town')||'').trim()};
  if(!draft.name||!draft.town){showError(form,'Completá nombre y localidad.');return;}
  if(draft.phone.length<8){showError(form,'El teléfono debe tener al menos 8 números.');form.querySelector('input[name="phone"]')?.focus();return;}
  saving=true;setBusy(form,true);showError(form,'');
  try{
   const payload=await api('/api/admin/clients',draft),client=payload?.duplicate||payload;
   if(!client?.id)throw Error('AMC no devolvió la ficha del cliente.');
   const persisted=upsertClient(payload?.duplicate?client:{...client,hasAccount:0});
   const lead=!Number(persisted?.hasAccount);
   wizard.prefillClient(String(client.id),lead);
   wizard.open();
   navigate('cotizador');
   toast?.(payload?.duplicate?'Ese teléfono ya existía. Seleccioné la ficha existente.':'Cliente guardado y seleccionado.');
  }catch(error){showError(form,error?.message||'No se pudo guardar el cliente.');}
  finally{saving=false;if(form.isConnected)setBusy(form,false);}
 }
 window.addEventListener('submit',submit,true);
 window.addEventListener('input',sanitizePhone,true);
 return {destroy(){window.removeEventListener('submit',submit,true);window.removeEventListener('input',sanitizePhone,true);}};
}
