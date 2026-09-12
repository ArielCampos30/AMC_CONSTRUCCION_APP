import {quotePersistentDocument,quoteContentVersion} from './quote-persistence.js';

const money=value=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(Number(value)||0);
const safeKey=value=>String(value||'').replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,80);
const quoteNumber=(externalId,date=new Date())=>`AMC-${date.toISOString().slice(0,10).replaceAll('-','')}-${safeKey(externalId).slice(-6).toUpperCase()}`;

export function createQuoteSaveController({getState,api,refresh,navigate,toast,wizard}){
 let saving=false;
 const identities=new Map();
 let hostObserver=null,observedHost=null,decorateScheduled=false;
 const state=()=>getState();
 const currentQuote=draft=>draft.quoteId?(state().quotes||[]).find(quote=>quote.id===draft.quoteId)||null:null;
 const currentRequest=draft=>draft.requestId?(state().requests||[]).find(request=>request.id===draft.requestId)||null:null;
 const contextKey=draft=>draft.quoteId||`${draft.clientRef||'sin-cliente'}|${draft.requestId||'directo'}`;
 const registered=draft=>currentRequest(draft)?!currentRequest(draft).leadId:String(draft.clientRef||'').startsWith('user:');
 const clientName=draft=>{
  const request=currentRequest(draft);if(request?.name)return request.name;
  const [kind,id]=String(draft.clientRef||'').split(':');
  const clients=state().agendaClients||state().clients||[];
  return clients.find(client=>String(client.id)===id&&(kind==='user'?Number(client.hasAccount):!Number(client.hasAccount)))?.name||'cliente';
 };
 function identity(draft){
  const stored=currentQuote(draft);
  if(stored?.externalId)return {externalId:String(stored.externalId),number:String(stored.number||quoteNumber(stored.externalId))};
  const key=contextKey(draft);if(identities.has(key))return identities.get(key);
  const externalId='qw-'+(crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`),value={externalId,number:quoteNumber(externalId)};
  identities.set(key,value);return value;
 }
 async function ensureRequest(draft,id){
  const existing=currentRequest(draft);if(existing)return existing;
  const [kind,clientId]=String(draft.clientRef||'').split(':');
  if(!clientId||!['user','lead'].includes(kind))throw Error('Elegí un cliente antes de guardar el presupuesto.');
  const first=draft.works?.find(work=>String(work.description||'').trim());
  const service=String(first?.tariffRubric||first?.description||'Presupuesto').trim().slice(0,500)||'Presupuesto';
  const payload={service,description:'Presupuesto iniciado por Administración.',idempotencyKey:safeKey('quote-direct-'+id.externalId)};
  if(kind==='user')payload.userId=clientId;else payload.leadId=clientId;
  return api('/api/admin/requests',payload);
 }
 function decorate(){
  const host=document.querySelector('.quote-wizard-host');if(!host)return;
  const draft=wizard.getDraft();if(draft.stage!==4)return;
  const button=host.querySelector('.quote-wizard-controls .primary');if(!button)return;
  const disabled=saving||!draft.clientRef||!draft.works?.length||!(Number(draft.finalPrice)>0);
  const label=saving?'Procesando…':registered(draft)?'Enviar presupuesto':'Guardar presupuesto';
  if(button.dataset.qwSaveQuote!=='1')button.dataset.qwSaveQuote='1';
  if(button.disabled!==disabled)button.disabled=disabled;
  if(button.textContent!==label)button.textContent=label;
  const context=host.querySelector('.quote-review-context');
  if(context&&!context.querySelector('[data-qw-save-summary]')){
   const node=document.createElement('div');node.className='quote-review-reference';node.dataset.qwSaveSummary='1';
   node.innerHTML=`<span>${registered(draft)?'Se enviará dentro de AMC':'Se guardará para entrega externa'}</span><strong>${money(draft.finalPrice)}</strong>`;
   context.append(node);
  }
 }
 function scheduleDecorate(){
  if(decorateScheduled)return;decorateScheduled=true;
  requestAnimationFrame(()=>{decorateScheduled=false;decorate();});
 }
 function stopWatching(){
  hostObserver?.disconnect?.();hostObserver=null;observedHost=null;decorateScheduled=false;
 }
 function watchHost(){
  const host=document.querySelector('.quote-wizard-host');
  if(!host){stopWatching();return;}
  if(observedHost!==host){
   hostObserver?.disconnect?.();observedHost=host;
   hostObserver=new MutationObserver(()=>scheduleDecorate());
   hostObserver.observe(host,{childList:true,subtree:true});
  }
  scheduleDecorate();
 }
 async function save(){
  if(saving)return;
  const draft=wizard.getDraft();
  if(draft.stage!==4)throw Error('Revisá el presupuesto antes de guardarlo.');
  if(!draft.clientRef)throw Error('Elegí un cliente.');
  if(!draft.works?.length||draft.works.some(work=>!String(work.description||'').trim()))throw Error('Revisá los trabajos del presupuesto.');
  if(!(Number(draft.finalPrice)>0))throw Error('Definí un precio final mayor a cero.');
  const id=identity(draft),willSend=registered(draft),action=willSend?'Enviar':'Guardar';
  if(window.AMCConfirm){const ok=await window.AMCConfirm(`¿${action} el presupuesto ${id.number} para ${clientName(draft)} por ${money(draft.finalPrice)}?`,{title:willSend?'Enviar presupuesto':'Guardar presupuesto',confirmLabel:action});if(!ok)return;}
  saving=true;decorate();
  try{
   const request=await ensureRequest(draft,id),stored=currentQuote(draft),snapshot={internalCost:Number(draft.internalCost)||0,gain:Number(draft.estimatedGain)||0};
   const document=quotePersistentDocument({requestId:request.id,externalId:id.externalId,number:id.number,works:draft.works,travel:draft.travel,employeeDay:draft.employeeDay,finalPrice:draft.finalPrice,finalPriceManual:draft.finalPriceManual,desiredMargin:draft.desiredMargin,payment:stored?.payment||state().settings?.payment||'',notes:stored?.notes||'',snapshot});
   document.version=await quoteContentVersion(document);
   const saved=await api('/api/quotes',document);
   if(!saved?.id)throw Error('AMC no devolvió el presupuesto guardado.');
   await refresh?.();
   toast?.(saved.status==='Enviado'?'Presupuesto enviado. El cliente ya puede verlo en AMC.':saved.status==='Guardado'?'Presupuesto guardado. Podés registrar su entrega externa.':'Presupuesto actualizado.');
   navigate(`presupuesto-admin/${saved.id}`);
  }catch(error){
   toast?.(String(error?.message||'No se pudo guardar el presupuesto.'));
   throw error;
  }finally{
   saving=false;
   scheduleDecorate();
  }
 }
 document.addEventListener('click',event=>{
  const saveButton=event.target.closest?.('[data-qw-save-quote]');
  if(saveButton){event.preventDefault();if(saveButton.disabled||saving)return;save().catch(()=>{});return;}
  if(event.target.closest?.('.quote-wizard-host [data-qw-next],.quote-wizard-host [data-qw-back],.quote-wizard-host [data-qw-review-work]'))scheduleDecorate();
 });
 return {afterRender(page){if(page==='cotizador')watchHost();else stopWatching();}};
}
