import {DEFAULT_QUOTE_SETTINGS,amount,normaliseWork,workDirectCost,directCostTotal,measuredReference,workLaborCost,laborCostTotal,internalCostTotal,jornalReference} from './quote-wizard-model.js';

const STEPS=['Cliente','Trabajos','Costos','Mano de obra','Rentabilidad','Precio final','Enviar'];
const UNITS=['m²','ml','unidad','día','hora','servicio','obra','punto','salida'];
const money=value=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(amount(value));

export function createQuoteWizard({getState,isAdmin,esc,navigate,toast}){
 let step=1,requestId='',quoteId='',mode='',clientRef='',origin='#presupuestos',works=null,lastWorkRequest='';
 let travel=DEFAULT_QUOTE_SETTINGS.travelDefault,employeeDay=DEFAULT_QUOTE_SETTINGS.employeeDay;
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
 function resetWorks(){works=null;lastWorkRequest='';travel=DEFAULT_QUOTE_SETTINGS.travelDefault;employeeDay=DEFAULT_QUOTE_SETTINGS.employeeDay;}
 function createWork(source={}){const work=normaliseWork(source);work.id=work.id||uid();return work;}
 function initialiseWorks(){
  const r=selectedRequest();if(!r)return [];
  if(works&&lastWorkRequest===r.id)return works;
  lastWorkRequest=r.id;
  const q=quoteId?quotes().find(x=>x.id===quoteId):null;
  const quoteItems=q?.items||[];
  if(quoteItems.length){
   works=quoteItems.map(item=>createWork(item));
   const legacyTravel=amount(quoteItems[0]?.details?.travel,-1);
   if(legacyTravel>=0)travel=legacyTravel;
  }else{
   const fromRequest=[...(r.services||[]),r.service].map(x=>String(x||'').trim()).filter(Boolean);
   const seed=[...new Set(fromRequest)];
   works=seed.map(description=>createWork({description}));
   if(!works.length&&r.description)works=[createWork({description:String(r.description).trim()})];
  }
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
 function workRows(){const rows=initialiseWorks();return rows.length?rows.map((w,index)=>`<div class="quote-wizard-work" data-qw-work="${esc(w.id)}"><span>${index+1}</span><input value="${esc(w.description)}" data-qw-work-input data-qw-key="description" aria-label="Trabajo ${index+1}" placeholder="Ej. Revoque grueso"><button type="button" data-qw-remove-work="${esc(w.id)}" aria-label="Quitar trabajo">×</button></div>`).join(''):'<div class="quote-wizard-empty">Todavía no agregaste trabajos.</div>';}
 function worksStep(){const r=selectedRequest();return `<div class="quote-wizard-step"><div class="quote-wizard-step-copy"><span class="eyebrow">PASO 2 DE 7</span><h2>Trabajos a presupuestar</h2><p>Armá la lista de trabajos que realmente forman parte de esta obra. Después vas a cargar costos y mano de obra sin mezclar esos datos con lo que verá el cliente.</p></div>${requestCard(r)}${r?.description?`<div class="quote-wizard-request-note"><span>Detalle pedido por el cliente</span><p>${esc(r.description)}</p></div>`:''}<div class="quote-wizard-suggestions">${suggestions(r).map(value=>`<button type="button" data-qw-suggestion="${esc(value)}">+ ${esc(value)}</button>`).join('')}</div><div class="quote-wizard-work-list">${workRows()}</div><button type="button" class="quote-wizard-add" data-qw-add-work>＋ Agregar otro trabajo</button></div>`;}
 function unitOptions(current){return UNITS.map(unit=>`<option value="${esc(unit)}" ${unit===current?'selected':''}>${esc(unit)}</option>`).join('');}
 function costCard(work,index){return `<article class="quote-wizard-detail-card" data-qw-cost-card="${esc(work.id)}"><header><span>${index+1}</span><div><strong>${esc(work.description||'Trabajo sin nombre')}</strong><small>Datos internos del trabajo</small></div></header><div class="quote-wizard-fields quote-wizard-fields-3"><label>Cantidad<input type="number" min="0" step="0.01" value="${work.quantity}" data-qw-work-input data-qw-key="quantity" data-qw-work-id="${esc(work.id)}"></label><label>Unidad<select data-qw-work-input data-qw-key="unit" data-qw-work-id="${esc(work.id)}">${unitOptions(work.unit)}</select></label><label>Precio base AMC / unidad<input type="number" min="0" step="100" value="${work.unitPrice}" data-qw-work-input data-qw-key="unitPrice" data-qw-work-id="${esc(work.id)}"></label><label>Materiales<input type="number" min="0" step="100" value="${work.materials}" data-qw-work-input data-qw-key="materials" data-qw-work-id="${esc(work.id)}"></label><label>Herramientas / consumibles<input type="number" min="0" step="100" value="${work.tools}" data-qw-work-input data-qw-key="tools" data-qw-work-id="${esc(work.id)}"></label><label>Otros / contingencia<input type="number" min="0" step="100" value="${work.other}" data-qw-work-input data-qw-key="other" data-qw-work-id="${esc(work.id)}"></label></div><div class="quote-wizard-inline-summary"><span>Referencia base <strong data-qw-base="${esc(work.id)}">${money(measuredReference(work))}</strong></span><span>Costos directos <strong data-qw-direct="${esc(work.id)}">${money(workDirectCost(work))}</strong></span></div></article>`;}
 function costsStep(){const rows=initialiseWorks(),base=rows.reduce((sum,work)=>sum+measuredReference(work),0),direct=directCostTotal(rows,travel);return `<div class="quote-wizard-step"><div class="quote-wizard-step-copy"><span class="eyebrow">PASO 3 DE 7</span><h2>Costos directos</h2><p>Cargá lo que la obra consume además de la mano de obra. El precio base AMC queda como referencia; todavía no es el precio final del cliente.</p></div><div class="quote-wizard-kpis"><div><span>Referencia base de trabajos</span><strong data-qw-base-total>${money(base)}</strong></div><div><span>Costos directos</span><strong data-qw-direct-total>${money(direct)}</strong></div></div><label class="quote-wizard-field quote-wizard-single-cost">Movilidad total del presupuesto<input type="number" min="0" step="100" value="${travel}" data-qw-travel><small>Se cobra una sola vez para todo este presupuesto y evita duplicarla por cada trabajo.</small></label><div class="quote-wizard-detail-list">${rows.map(costCard).join('')}</div><div class="quote-wizard-next-note">Estos importes son internos. En el siguiente paso AMC calcula la <strong>mano de obra real</strong> según días y cantidad de operarios.</div></div>`;}
 function laborCard(work,index){return `<article class="quote-wizard-detail-card" data-qw-labor-card="${esc(work.id)}"><header><span>${index+1}</span><div><strong>${esc(work.description||'Trabajo sin nombre')}</strong><small>Estimación de ejecución</small></div></header><div class="quote-wizard-fields quote-wizard-fields-3"><label>Operarios<input type="number" min="1" step="1" value="${work.workers}" data-qw-work-input data-qw-key="workers" data-qw-work-id="${esc(work.id)}"></label><label>Días estimados<input type="number" min="1" step="1" value="${work.days}" data-qw-work-input data-qw-key="days" data-qw-work-id="${esc(work.id)}"></label><label>Horas estimadas si fuera jornal<input type="number" min="0.25" step="0.25" value="${work.hours}" data-qw-work-input data-qw-key="hours" data-qw-work-id="${esc(work.id)}"></label></div><div class="quote-wizard-inline-summary"><span>Costo interno de mano de obra <strong data-qw-labor="${esc(work.id)}">${money(workLaborCost(work,employeeDay))}</strong></span><span>Referencia comercial por jornal <strong data-qw-jornal="${esc(work.id)}">${money(jornalReference(work))}</strong></span></div></article>`;}
 function laborStep(){const rows=initialiseWorks(),labor=laborCostTotal(rows,employeeDay),direct=directCostTotal(rows,travel),internal=internalCostTotal(rows,travel,employeeDay);return `<div class="quote-wizard-step"><div class="quote-wizard-step-copy"><span class="eyebrow">PASO 4 DE 7</span><h2>Mano de obra</h2><p>Estimá cuántas personas y cuántos días requiere cada trabajo. AMC separa el costo interno del jornal comercial para que después puedas decidir la rentabilidad con claridad.</p></div><div class="quote-wizard-kpis quote-wizard-kpis-3"><div><span>Mano de obra interna</span><strong data-qw-labor-total>${money(labor)}</strong></div><div><span>Costos directos</span><strong data-qw-direct-total>${money(direct)}</strong></div><div><span>Costo interno acumulado</span><strong data-qw-internal-total>${money(internal)}</strong></div></div><label class="quote-wizard-field quote-wizard-single-cost">Jornal interno por operario<input type="number" min="0" step="100" value="${employeeDay}" data-qw-employee-day><small>Valor que realmente te cuesta cada operario por día. No se muestra al cliente.</small></label><div class="quote-wizard-detail-list">${rows.map(laborCard).join('')}</div><div class="quote-wizard-next-note"><strong>Regla de referencia por jornal:</strong> hasta 2 h salida mínima, hasta 4 h media jornada, hasta 8 h jornada completa y luego se suman jornadas. El próximo corte habilitará <strong>Rentabilidad</strong>.</div></div>`;}
 function body(){if(step===2)return worksStep();if(step===3)return costsStep();if(step===4)return laborStep();return clientStep();}
 function validWorks(){const rows=initialiseWorks();return rows.length>0&&rows.every(work=>String(work.description||'').trim());}
 function canAdvance(){if(step===1)return !!selectedRequest();if(step===2)return validWorks();if(step===3)return validWorks();return false;}
 function nextLabel(){if(step===1)return 'Continuar →';if(step===2)return 'Continuar a Costos →';if(step===3)return 'Continuar a Mano de obra →';return 'Continuar a Rentabilidad →';}
 function controls(){const allowed=canAdvance();return `<div class="quote-wizard-controls"><button type="button" class="secondary" data-qw-back ${step===1?'disabled':''}>← Volver</button><span class="quote-wizard-mobile-progress">Paso ${step} de ${STEPS.length}</span><button type="button" class="primary" data-qw-next ${allowed?'':'disabled'}>${nextLabel()}</button></div>`;}
 function markup(){return `<div class="quote-wizard-layer"><section class="quote-wizard-dialog" role="dialog" aria-modal="true" aria-labelledby="quote-wizard-title"><header class="quote-wizard-header"><div><span class="eyebrow">COTIZADOR AMC</span><h1 id="quote-wizard-title">Nuevo presupuesto</h1></div><button type="button" class="quote-wizard-close" data-qw-close aria-label="Cerrar cotizador">×</button></header>${stepper()}<div class="quote-wizard-content">${body()}</div>${controls()}</section></div>`;}
 function render(){if(!isAdmin())return '<section class="panel"><h2>Acceso exclusivo de AMC</h2><p>Esta herramienta está disponible sólo para Administración.</p></section>';choosePrefilledRequest();return `<div class="quote-wizard-host">${markup()}</div>`;}
 function paint(focusSelector=''){const host=document.querySelector('.quote-wizard-host');if(!host)return;host.innerHTML=markup();if(focusSelector)requestAnimationFrame(()=>host.querySelector(focusSelector)?.focus());}
 function addWork(description=''){initialiseWorks();const value=String(description||'').trim();if(value&&works.some(w=>w.description.toLowerCase()===value.toLowerCase()))return;works.push(createWork({description:value}));paint('.quote-wizard-work:last-child input');}
 function close(){const target=(origin||'#presupuestos').replace(/^#/,'')||'presupuestos';navigate(target);}
 function updateAdvanceButton(){const button=document.querySelector('.quote-wizard-host [data-qw-next]');if(button)button.disabled=!canAdvance();}
 function updateCostPreview(){if(step!==3)return;const rows=initialiseWorks();const base=rows.reduce((sum,work)=>sum+measuredReference(work),0),direct=directCostTotal(rows,travel);const host=document.querySelector('.quote-wizard-host');if(!host)return;const baseTotal=host.querySelector('[data-qw-base-total]'),directTotal=host.querySelector('[data-qw-direct-total]');if(baseTotal)baseTotal.textContent=money(base);if(directTotal)directTotal.textContent=money(direct);rows.forEach(work=>{const baseNode=host.querySelector(`[data-qw-base="${CSS.escape(work.id)}"]`),directNode=host.querySelector(`[data-qw-direct="${CSS.escape(work.id)}"]`);if(baseNode)baseNode.textContent=money(measuredReference(work));if(directNode)directNode.textContent=money(workDirectCost(work));});}
 function updateLaborPreview(){if(step!==4)return;const rows=initialiseWorks(),host=document.querySelector('.quote-wizard-host');if(!host)return;const labor=laborCostTotal(rows,employeeDay),direct=directCostTotal(rows,travel),internal=internalCostTotal(rows,travel,employeeDay);const laborTotal=host.querySelector('[data-qw-labor-total]'),directTotal=host.querySelector('[data-qw-direct-total]'),internalTotal=host.querySelector('[data-qw-internal-total]');if(laborTotal)laborTotal.textContent=money(labor);if(directTotal)directTotal.textContent=money(direct);if(internalTotal)internalTotal.textContent=money(internal);rows.forEach(work=>{const laborNode=host.querySelector(`[data-qw-labor="${CSS.escape(work.id)}"]`),jornalNode=host.querySelector(`[data-qw-jornal="${CSS.escape(work.id)}"]`);if(laborNode)laborNode.textContent=money(workLaborCost(work,employeeDay));if(jornalNode)jornalNode.textContent=money(jornalReference(work));});}
 document.addEventListener('click',event=>{
  if(!document.querySelector('.quote-wizard-host'))return;
  const closeButton=event.target.closest('[data-qw-close]');if(closeButton){event.preventDefault();close();return;}
  const next=event.target.closest('[data-qw-next]');if(next&&!next.disabled&&canAdvance()){if(step<4){step++;if(step>=2)initialiseWorks();paint();}return;}
  const back=event.target.closest('[data-qw-back]');if(back&&step>1){step--;paint();return;}
  const add=event.target.closest('[data-qw-add-work]');if(add){addWork();return;}
  const remove=event.target.closest('[data-qw-remove-work]');if(remove){initialiseWorks();works=works.filter(w=>w.id!==remove.dataset.qwRemoveWork);paint();return;}
  const suggestion=event.target.closest('[data-qw-suggestion]');if(suggestion){addWork(suggestion.dataset.qwSuggestion);return;}
 });
 document.addEventListener('change',event=>{
  if(!document.querySelector('.quote-wizard-host'))return;
  if(event.target.matches('[data-qw-request]')){requestId=event.target.value||'';quoteId='';resetWorks();paint();return;}
  if(event.target.matches('[data-qw-work-input]'))handleWorkInput(event.target);
 });
 function handleWorkInput(target){
  initialiseWorks();const rowId=target.dataset.qwWorkId||target.closest?.('[data-qw-work]')?.dataset.qwWork;const item=works.find(work=>work.id===rowId);if(!item)return;const key=target.dataset.qwKey;if(key==='description'||key==='unit')item[key]=target.value;else if(['workers','days'].includes(key))item[key]=Math.max(1,Math.ceil(amount(target.value,1)||1));else if(key==='hours')item[key]=Math.max(.25,amount(target.value,8)||8);else item[key]=amount(target.value);updateAdvanceButton();updateCostPreview();updateLaborPreview();
 }
 document.addEventListener('input',event=>{
  if(!document.querySelector('.quote-wizard-host'))return;
  if(event.target.matches('[data-qw-work-input]')){handleWorkInput(event.target);return;}
  if(event.target.matches('[data-qw-travel]')){travel=amount(event.target.value);updateCostPreview();return;}
  if(event.target.matches('[data-qw-employee-day]')){employeeDay=amount(event.target.value);updateLaborPreview();}
 });
 function afterRender(page){if(page!=='cotizador')return;choosePrefilledRequest();requestAnimationFrame(()=>document.querySelector('.quote-wizard-dialog')?.focus?.({preventScroll:true}));}
 return {render,open,prefillClient,afterRender,getDraft:()=>({step,requestId,quoteId,mode,travel,employeeDay,works:[...(works||[])],directCost:directCostTotal(works||[],travel),laborCost:laborCostTotal(works||[],employeeDay),internalCost:internalCostTotal(works||[],travel,employeeDay)})};
}
