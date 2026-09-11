const STEPS=['Cliente','Trabajos','Costos','Mano de obra','Rentabilidad','Precio final','Enviar'];

export function createQuoteWizard({getState,isAdmin,esc,navigate,toast}){
 let step=1,requestId='',quoteId='',mode='',clientRef='',origin='#presupuestos',works=null,lastWorkRequest='';
 const s=()=>getState();
 const requests=()=>s().requests||[];
 const clients=()=>s().agendaClients||s().clients||[];
 const quotes=()=>s().quotes||[];
 const uid=()=>crypto.randomUUID?.()||('qw-'+Date.now()+'-'+Math.random().toString(16).slice(2));
 const requestClient=r=>clients().find(c=>(r.userId&&c.id===r.userId)||(r.leadId&&c.id===r.leadId))||null;
 const requestName=r=>r?.name||requestClient(r)?.name||'Cliente';
 const clientMatches=r=>!clientRef||(clientRef.startsWith('lead:')?r.leadId===clientRef.slice(5):r.userId===clientRef.slice(5));
 const availableRequests=()=>requests().filter(clientMatches).sort((a,b)=>String(b.date||b.createdAt||'').localeCompare(String(a.date||a.createdAt||'')));
 function choosePrefilledRequest(){if(requestId||!clientRef)return;const list=availableRequests();if(list.length)requestId=list[0].id;}
 function selectedRequest(){choosePrefilledRequest();return requests().find(r=>r.id===requestId)||null;}
 function resetWorks(){works=null;lastWorkRequest='';}
 function initialiseWorks(){
  const r=selectedRequest();if(!r)return [];
  if(works&&lastWorkRequest===r.id)return works;
  lastWorkRequest=r.id;
  const q=quoteId?quotes().find(x=>x.id===quoteId):null;
  const fromQuote=(q?.items||[]).map(item=>String(item.description||item.title||item.name||item.tarea||'').trim()).filter(Boolean);
  const fromRequest=[...(r.services||[]),r.service].map(x=>String(x||'').trim()).filter(Boolean);
  const seed=fromQuote.length?fromQuote:[...new Set(fromRequest)];
  works=seed.map(description=>({id:uid(),description}));
  if(!works.length&&r.description)works=[{id:uid(),description:String(r.description).trim()}];
  return works;
 }
 function rememberOrigin(){const hash=location.hash||'#inicio';if(hash!=='#cotizador')origin=hash;}
 function open(nextRequest='',nextQuote='',nextMode=''){
  rememberOrigin();requestId=nextRequest||'';quoteId=nextQuote||'';mode=nextMode||'';step=1;resetWorks();
 }
 function prefillClient(id,lead=false){clientRef=(lead?'lead:':'user:')+id;if(!requestId)choosePrefilledRequest();}
 function stepper(){return `<ol class="quote-wizard-steps" aria-label="Pasos del presupuesto">${STEPS.map((name,index)=>{const n=index+1,cls=n===step?'current':n<step?'done':'future';return `<li class="${cls}"><span>${n<step?'✓':n}</span><b>${esc(name)}</b></li>`}).join('')}</ol>`;}
 function requestOptions(){const list=availableRequests();return `<option value="">Elegí una solicitud</option>${list.map(r=>`<option value="${esc(r.id)}" ${r.id===requestId?'selected':''}>${esc(requestName(r))} · ${esc(r.town||'Sin localidad')} · ${esc((r.services||[r.service]).filter(Boolean).join(', ')||'Trabajo')}</option>`).join('')}`;}
 function requestCard(r){if(!r)return '';return `<article class="quote-wizard-client-card"><div><span>Cliente</span><strong>${esc(requestName(r))}</strong></div><div><span>Localidad</span><strong>${esc(r.town||'Sin localidad')}</strong></div><div class="wide"><span>Solicitud</span><strong>${esc((r.services||[r.service]).filter(Boolean).join(' · ')||r.description||'Trabajo a presupuestar')}</strong></div></article>`;}
 function clientStep(){const r=selectedRequest(),list=availableRequests();return `<div class="quote-wizard-step"><div class="quote-wizard-step-copy"><span class="eyebrow">PASO 1 DE 7</span><h2>Cliente y solicitud</h2><p>Elegí para quién vas a preparar el presupuesto. Si llegaste desde una ficha, AMC lo carga automáticamente.</p></div>${r?requestCard(r):''}<label class="quote-wizard-field">Solicitud<select data-qw-request>${requestOptions()}</select></label>${!list.length?'<div class="quote-wizard-empty">Este cliente todavía no tiene una solicitud disponible. Podés salir y crearla desde Solicitudes.</div>':''}</div>`;}
 function suggestions(r){const values=[...(r?.services||[]),r?.service,...(s().services||[])].map(x=>String(x||'').trim()).filter(Boolean);return [...new Set(values)].slice(0,12);}
 function workRows(){const rows=initialiseWorks();return rows.length?rows.map((w,index)=>`<div class="quote-wizard-work" data-qw-work="${esc(w.id)}"><span>${index+1}</span><input value="${esc(w.description)}" aria-label="Trabajo ${index+1}" placeholder="Ej. Revoque grueso"><button type="button" data-qw-remove-work="${esc(w.id)}" aria-label="Quitar trabajo">×</button></div>`).join(''):'<div class="quote-wizard-empty">Todavía no agregaste trabajos.</div>';}
 function worksStep(){const r=selectedRequest();return `<div class="quote-wizard-step"><div class="quote-wizard-step-copy"><span class="eyebrow">PASO 2 DE 7</span><h2>Trabajos a presupuestar</h2><p>Armá la lista de trabajos. En el corte del Tarifario estos nombres tomarán automáticamente sus precios vigentes.</p></div>${requestCard(r)}${r?.description?`<div class="quote-wizard-request-note"><span>Detalle pedido por el cliente</span><p>${esc(r.description)}</p></div>`:''}<div class="quote-wizard-suggestions">${suggestions(r).map(value=>`<button type="button" data-qw-suggestion="${esc(value)}">+ ${esc(value)}</button>`).join('')}</div><div class="quote-wizard-work-list">${workRows()}</div><button type="button" class="quote-wizard-add" data-qw-add-work>＋ Agregar otro trabajo</button><p class="quote-wizard-next-note">El siguiente corte habilitará <strong>Costos</strong> y conectará estos trabajos con el Tarifario independiente.</p></div>`;}
 function body(){return step===2?worksStep():clientStep();}
 function controls(){const r=selectedRequest(),canNext=step===1&&!!r,canContinueCosts=step===2&&false;return `<div class="quote-wizard-controls"><button type="button" class="secondary" data-qw-back ${step===1?'disabled':''}>← Volver</button><span class="quote-wizard-mobile-progress">Paso ${step} de ${STEPS.length}</span>${step===1?`<button type="button" class="primary" data-qw-next ${canNext?'':'disabled'}>Continuar →</button>`:`<button type="button" class="primary" ${canContinueCosts?'data-qw-next':''} disabled>Continuar a Costos →</button>`}</div>`;}
 function markup(){return `<div class="quote-wizard-layer"><section class="quote-wizard-dialog" role="dialog" aria-modal="true" aria-labelledby="quote-wizard-title"><header class="quote-wizard-header"><div><span class="eyebrow">COTIZADOR AMC</span><h1 id="quote-wizard-title">Nuevo presupuesto</h1></div><button type="button" class="quote-wizard-close" data-qw-close aria-label="Cerrar cotizador">×</button></header>${stepper()}<div class="quote-wizard-content">${body()}</div>${controls()}</section></div>`;}
 function render(){if(!isAdmin())return '<section class="panel"><h2>Acceso exclusivo de AMC</h2><p>Esta herramienta está disponible sólo para Administración.</p></section>';choosePrefilledRequest();return `<div class="quote-wizard-host">${markup()}</div>`;}
 function paint(focusSelector=''){const host=document.querySelector('.quote-wizard-host');if(!host)return;host.innerHTML=markup();if(focusSelector)requestAnimationFrame(()=>host.querySelector(focusSelector)?.focus());}
 function addWork(description=''){initialiseWorks();const value=String(description||'').trim();if(value&&works.some(w=>w.description.toLowerCase()===value.toLowerCase()))return;works.push({id:uid(),description:value});paint('.quote-wizard-work:last-child input');}
 function close(){const target=(origin||'#presupuestos').replace(/^#/,'')||'presupuestos';navigate(target);}
 document.addEventListener('click',event=>{
  if(!document.querySelector('.quote-wizard-host'))return;
  const closeButton=event.target.closest('[data-qw-close]');if(closeButton){event.preventDefault();close();return;}
  const next=event.target.closest('[data-qw-next]');if(next&&step===1&&selectedRequest()){step=2;initialiseWorks();paint();return;}
  const back=event.target.closest('[data-qw-back]');if(back&&step>1){step--;paint();return;}
  const add=event.target.closest('[data-qw-add-work]');if(add){addWork();return;}
  const remove=event.target.closest('[data-qw-remove-work]');if(remove){initialiseWorks();works=works.filter(w=>w.id!==remove.dataset.qwRemoveWork);paint();return;}
  const suggestion=event.target.closest('[data-qw-suggestion]');if(suggestion){addWork(suggestion.dataset.qwSuggestion);return;}
 });
 document.addEventListener('change',event=>{
  if(!document.querySelector('.quote-wizard-host'))return;
  if(event.target.matches('[data-qw-request]')){requestId=event.target.value||'';quoteId='';resetWorks();paint();}
 });
 document.addEventListener('input',event=>{
  const row=event.target.closest?.('[data-qw-work]');if(!row||!document.querySelector('.quote-wizard-host'))return;initialiseWorks();const item=works.find(w=>w.id===row.dataset.qwWork);if(item)item.description=event.target.value;
 });
 function afterRender(page){if(page!=='cotizador')return;choosePrefilledRequest();requestAnimationFrame(()=>document.querySelector('.quote-wizard-dialog')?.focus?.({preventScroll:true}));}
 return {render,open,prefillClient,afterRender,getDraft:()=>({step,requestId,quoteId,mode,works:[...(works||[])]})};
}
