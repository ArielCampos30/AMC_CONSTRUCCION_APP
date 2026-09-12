import {quotePersistentDocument,quoteContentVersion} from './quote-persistence.js';

const money=value=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(Number(value)||0);
const safeKey=value=>String(value||'').replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,80);
const quoteNumber=(externalId,date=new Date())=>`AMC-${date.toISOString().slice(0,10).replaceAll('-','')}-${safeKey(externalId).slice(-6).toUpperCase()}`;
export const parseQuoteClientRef=value=>{
 const ref=String(value||'');const separator=ref.indexOf(':');
 return separator>0?{kind:ref.slice(0,separator),id:ref.slice(separator+1)}:{kind:'',id:''};
};
export const resolveQuoteClientRef=(value,clients=[])=>{
 const ref=String(value||''),parsed=parseQuoteClientRef(ref),rows=Array.isArray(clients)?clients:[];
 const exact=rows.find(client=>`${Number(client?.hasAccount)?'user':'lead'}:${String(client?.id||'')}`===ref);
 if(exact)return {kind:Number(exact.hasAccount)?'user':'lead',id:String(exact.id),client:exact};
 const nestedId=String(parsed.id||'').replace(/^(?:(?:user|lead):)+/,'');
 const recovered=rows.find(client=>{
  const id=String(client?.id||'');
  return Boolean(id)&&(id===nestedId||ref.endsWith(':'+id));
 });
 if(recovered)return {kind:Number(recovered.hasAccount)?'user':'lead',id:String(recovered.id),client:recovered};
 const kind=['user','lead'].includes(parsed.kind)?parsed.kind:'';
 return {kind,id:nestedId,client:null};
};
export const validateQuoteDraft=draft=>{
 if(Number(draft?.stage)!==4)throw Error('Revisá el presupuesto antes de guardarlo.');
 if(!String(draft?.clientRef||'').trim())throw Error('Elegí un cliente.');
 if(!Array.isArray(draft?.works)||!draft.works.length)throw Error('Agregá al menos un trabajo al presupuesto.');
 if(draft.works.some(work=>!String(work?.description||'').trim()))throw Error('Todos los trabajos deben tener una descripción antes de guardar.');
 const price=Number(draft?.finalPrice);
 if(!Number.isFinite(price)||price<=0)throw Error('Definí un precio final mayor a cero.');
 return true;
};
export const buildDirectRequestPayload=({draft,clients=[],externalId})=>{
 validateQuoteDraft(draft);
 const {id:clientId}=resolveQuoteClientRef(draft?.clientRef,clients);
 if(!clientId)throw Error('AMC no pudo identificar la ficha del cliente seleccionado. Volvé a Cliente y seleccionalo nuevamente.');
 const first=draft.works.find(work=>String(work?.description||'').trim());
 const service=String(first?.tariffRubric||first?.description||'').trim().slice(0,500);
 if(!service)throw Error('AMC no pudo determinar el trabajo principal del presupuesto.');
 const description='Presupuesto iniciado por Administración.';
 const idempotencyKey=safeKey('quote-direct-'+externalId);
 if(idempotencyKey.length<8)throw Error('AMC no pudo generar la referencia segura del presupuesto.');
 // El endpoint histórico distingue userId/leadId. Para un presupuesto directo enviamos
 // el mismo ID canónico en ambos campos: el servidor valida contra ambas fuentes y usa
 // únicamente la ficha que realmente existe. Así el guardado no depende de una etiqueta
 // de tipo vieja o mal envuelta en el navegador.
 return {userId:clientId,leadId:clientId,service,description,idempotencyKey};
};

export function createQuoteSaveController({getState,api,refresh,navigate,toast,wizard}){
 let saving=false;
 const identities=new Map();
 let hostObserver=null,observedHost=null,decorateScheduled=false;
 const state=()=>getState();
 const currentQuote=draft=>draft.quoteId?(state().quotes||[]).find(quote=>quote.id===draft.quoteId)||null:null;
 const currentRequest=draft=>draft.requestId?(state().requests||[]).find(request=>request.id===draft.requestId)||null:null;
 const availableClients=()=>state().agendaClients||state().clients||[];
 const resolvedClient=draft=>resolveQuoteClientRef(draft?.clientRef,availableClients());
 const contextKey=draft=>draft.quoteId||`${draft.clientRef||'sin-cliente'}|${draft.requestId||'directo'}`;
 const registered=draft=>currentRequest(draft)?!currentRequest(draft).leadId:resolvedClient(draft).kind==='user';
 const clientName=draft=>{
  const request=currentRequest(draft);if(request?.name)return request.name;
  return resolvedClient(draft).client?.name||'cliente';
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
  const create=async()=>{
   const payload=buildDirectRequestPayload({draft,clients:availableClients(),externalId:id.externalId});
   const request=await api('/api/admin/requests',payload);
   if(!request?.id)throw Error('AMC no devolvió la solicitud interna necesaria para guardar el presupuesto.');
   return request;
  };
  try{return await create();}
  catch(error){
   const generic=/Elegí un cliente y describí el trabajo/i.test(String(error?.message||''));
   if(!generic)throw error;
   await refresh?.();
   try{return await create();}
   catch(retryError){
    if(/Elegí un cliente y describí el trabajo/i.test(String(retryError?.message||'')))throw Error('AMC no encontró la ficha del cliente seleccionado al crear el presupuesto. Volvé a la etapa Cliente, seleccionalo otra vez y reintentá.');
    throw retryError;
   }
  }
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
  validateQuoteDraft(draft);
  const id=identity(draft),willSend=registered(draft),action=willSend?'Enviar':'Guardar';
  if(window.AMCConfirm){const ok=await window.AMCConfirm(`¿${action} el presupuesto ${id.number} para ${clientName(draft)} por ${money(draft.finalPrice)}?`,{title:willSend?'Enviar presupuesto':'Guardar presupuesto',confirmLabel:action});if(!ok)return;}
  saving=true;decorate();
  try{
   const request=await ensureRequest(draft,id),stored=currentQuote(draft),snapshot={internalCost:Number(draft.internalCost)||0,gain:Number(draft.estimatedGain)||0};
   const document=quotePersistentDocument({requestId:request.id,externalId:id.externalId,number:id.number,works:draft.works,travel:draft.travel,employeeDay:draft.employeeDay,finalPrice:draft.finalPrice,finalPriceManual:draft.finalPriceManual,desiredMargin:draft.desiredMargin,payment:stored?.payment||state().settings?.payment||'',notes:stored?.notes||'',snapshot});
   if(!document.requestId)throw Error('El presupuesto quedó sin solicitud relacionada.');
   if(!Array.isArray(document.items)||!document.items.length)throw Error('El presupuesto quedó sin trabajos públicos para guardar.');
   if(!(Number(document.total)>0))throw Error('El presupuesto quedó sin un total válido para guardar.');
   document.version=await quoteContentVersion(document);
   if(!/^[a-f0-9]{64}$/.test(String(document.version||'')))throw Error('AMC no pudo generar una versión válida del presupuesto.');
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
