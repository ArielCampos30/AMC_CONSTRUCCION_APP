import {DEFAULT_QUOTE_SETTINGS,amount,normaliseWork,workDirectCost,directCostTotal,workLaborCost,laborCostTotal,internalCostTotal,jornalReference,commercialReferenceTotal,findTariffMatches} from './quote-wizard-model.js';

const PHASES=['Cliente','Presupuesto','Revisión','Guardar / enviar'];
const UNITS=['m²','ml','unidad','día','hora','servicio','obra','punto','salida'];
const money=value=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(amount(value));

export function createQuoteWizard({getState,isAdmin,esc,navigate,toast}){
 let stage=1,requestId='',quoteId='',mode='',clientRef='',origin='#presupuestos',works=null,lastContext='',activeWorkId='';
 let travel=DEFAULT_QUOTE_SETTINGS.travelDefault,employeeDay=DEFAULT_QUOTE_SETTINGS.employeeDay;
 let tariffs=[],tariffState='idle',tariffError='';
 let localClients=[],newClientOpen=false,newClientSaving=false,newClientError='';
 let newClientDraft={name:'',phone:'',town:''};
 const openCostWorkIds=new Set();
 const s=()=>getState();
 const requests=()=>s().requests||[];
 const baseClients=()=>s().agendaClients||s().clients||[];
 const quotes=()=>s().quotes||[];
 const uid=()=>crypto.randomUUID?.()||('qw-'+Date.now()+'-'+Math.random().toString(16).slice(2));
 const clientKey=client=>(Number(client?.hasAccount)?'user:':'lead:')+String(client?.id||'');
 function clients(){
  const map=new Map();
  [...baseClients(),...localClients].forEach(client=>{if(client?.id)map.set(clientKey(client),client);});
  return [...map.values()].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'es'));
 }
 const currentClient=()=>clients().find(client=>clientKey(client)===clientRef)||null;
 const requestClientRef=request=>request?.leadId?'lead:'+request.leadId:request?.userId?'user:'+request.userId:'';
 const requestClient=request=>clients().find(client=>clientKey(client)===requestClientRef(request))||null;
 const requestName=request=>request?.name||requestClient(request)?.name||'Cliente';
 function availableRequests(){
  if(!clientRef)return [];
  return requests().filter(request=>requestClientRef(request)===clientRef).sort((a,b)=>String(b.date||b.createdAt||'').localeCompare(String(a.date||a.createdAt||'')));
 }
 function selectedRequest(){return availableRequests().find(request=>request.id===requestId)||null;}
 function contextKey(){return [clientRef||'sin-cliente',requestId||'directo',quoteId||'nuevo'].join('|');}
 function resetWorks(){works=null;lastContext='';activeWorkId='';travel=DEFAULT_QUOTE_SETTINGS.travelDefault;employeeDay=DEFAULT_QUOTE_SETTINGS.employeeDay;openCostWorkIds.clear();}
 function createWork(source={}){
  const work=normaliseWork(source);work.id=work.id||uid();work.referenceSearch=String(source.referenceSearch||source.details?.referenceSearch||'');
  if(!work.tariffKind&&work.unitPrice>0)work.tariffKind='manual-reference';
  return work;
 }
 function initialiseWorks(){
  if(!clientRef)return [];
  const key=contextKey();if(works&&lastContext===key)return works;
  lastContext=key;
  const quote=quoteId?quotes().find(item=>item.id===quoteId):null;
  const quoteItems=quote?.items||[];
  if(quoteItems.length){
   works=quoteItems.map(item=>createWork(item));
   const legacyTravel=amount(quoteItems[0]?.details?.travel,-1);if(legacyTravel>=0)travel=legacyTravel;
  }else{
   const request=selectedRequest(),fromRequest=[...(request?.services||[]),request?.service].map(value=>String(value||'').trim()).filter(Boolean),seed=[...new Set(fromRequest)];
   works=seed.map(description=>createWork({description}));
   if(!works.length&&request?.description)works=[createWork({description:String(request.description).trim()})];
   if(!works.length)works=[createWork({description:''})];
  }
  activeWorkId=works[0]?.id||'';
  if(tariffState==='ready')works.forEach(resolveTariff);
  return works;
 }
 function activeWork(){const rows=initialiseWorks();return rows.find(work=>work.id===activeWorkId)||rows[0]||null;}
 function rememberOrigin(){const hash=location.hash||'#inicio';if(hash!=='#cotizador')origin=hash;}
 function open(nextRequest='',nextQuote='',nextMode=''){
  rememberOrigin();requestId=nextRequest||'';quoteId=nextQuote||'';mode=nextMode||'';stage=1;newClientOpen=false;newClientError='';resetWorks();
  const request=requestId?requests().find(item=>item.id===requestId):null;if(request)clientRef=requestClientRef(request);
  ensureTariffs();
 }
 function prefillClient(id,lead=false){clientRef=(lead?'lead:':'user:')+id;if(requestId&&requestClientRef(requests().find(item=>item.id===requestId))!==clientRef)requestId='';resetWorks();}
 function phaseNav(){return `<ol class="quote-wizard-steps" aria-label="Etapas del presupuesto">${PHASES.map((name,index)=>{const number=index+1,cls=number===stage?'current':number<stage?'done':'future';return `<li class="${cls}"><span>${number<stage?'✓':number}</span><b>${esc(name)}</b></li>`;}).join('')}</ol>`;}
 function clientOptions(){return `<option value="">Elegí un cliente</option>${clients().map(client=>`<option value="${esc(clientKey(client))}" ${clientKey(client)===clientRef?'selected':''}>${esc(client.name||'Cliente')} · ${esc(client.town||'Sin localidad')}</option>`).join('')}`;}
 function requestOptions(){return `<option value="">Sin solicitud · presupuesto directo</option>${availableRequests().map(request=>`<option value="${esc(request.id)}" ${request.id===requestId?'selected':''}>${esc((request.services||[request.service]).filter(Boolean).join(', ')||request.description||'Solicitud')} · ${esc(request.town||currentClient()?.town||'Sin localidad')}</option>`).join('')}`;}
 function clientCard(client){if(!client)return '';return `<article class="quote-wizard-client-card"><div><span>Cliente</span><strong>${esc(client.name||'Cliente')}</strong></div><div><span>Teléfono</span><strong>${esc(client.phone||'Sin teléfono')}</strong></div><div><span>Localidad</span><strong>${esc(client.town||'Sin localidad')}</strong></div></article>`;}
 function newClientForm(){if(!newClientOpen)return '';return `<form class="quote-new-client" data-qw-new-client-form><div class="quote-wizard-step-copy compact"><span class="eyebrow">CLIENTE NUEVO</span><h3>Guardarlo mientras presupuestás</h3><p>Con nombre, teléfono y localidad alcanza para crear la ficha. Después podés completar más datos desde Clientes.</p></div><div class="quote-wizard-fields quote-wizard-fields-3"><label>Nombre<input name="name" value="${esc(newClientDraft.name)}" autocomplete="name" required></label><label>Teléfono<input name="phone" value="${esc(newClientDraft.phone)}" inputmode="tel" autocomplete="tel" required></label><label>Localidad<input name="town" value="${esc(newClientDraft.town)}" autocomplete="address-level2" required></label></div>${newClientError?`<p class="quote-inline-error">${esc(newClientError)}</p>`:''}<div class="quote-new-client-actions"><button type="button" class="secondary" data-qw-cancel-new-client>Cancelar</button><button type="submit" class="primary" ${newClientSaving?'disabled':''}>${newClientSaving?'Guardando…':'Guardar y usar cliente'}</button></div></form>`;}
 function clientStage(){
  const client=currentClient(),list=availableRequests();
  return `<div class="quote-wizard-step quote-client-stage"><div class="quote-wizard-step-copy"><span class="eyebrow">ETAPA 1 DE 4</span><h2>¿Para quién es el presupuesto?</h2><p>Primero elegís el cliente. Recién después AMC muestra únicamente las solicitudes de esa persona. También podés presupuestar sin solicitud.</p></div><div class="quote-client-picker"><label class="quote-wizard-field">Cliente<select data-qw-client>${clientOptions()}</select></label><button type="button" class="quote-wizard-add" data-qw-new-client>＋ Cliente nuevo</button></div>${newClientForm()}${client?clientCard(client):''}${client?`<div class="quote-request-choice"><label class="quote-wizard-field">Solicitud relacionada <small>Opcional. Si el presupuesto nació en la calle o por teléfono, dejá “Sin solicitud”.</small><select data-qw-request>${requestOptions()}</select></label>${list.length?`<p>Mostrando sólo solicitudes de <strong>${esc(client.name||'este cliente')}</strong>.</p>`:'<p>Este cliente no tiene solicitudes previas. Podés continuar igual con un presupuesto directo.</p>'}</div>`:''}</div>`;
 }
 function selectedTariff(work){return tariffs.find(item=>item.key===work?.tariffKey)||null;}
 function applyTariff(work,tariff,kind='tariff'){
  if(!work||!tariff)return;work.tariffKey=tariff.key;work.tariffTask=tariff.tarea;work.tariffRubric=tariff.rubro;work.tariffUnit=tariff.unidad;work.tariffPrice=amount(tariff.precio);work.tariffKind=kind;work.referenceSearch='';work.unit=tariff.unidad||work.unit;work.unitPrice=0;
 }
 function clearTariffSelection(work){if(!work)return;work.tariffKey='';work.tariffTask='';work.tariffRubric='';work.tariffUnit='';work.tariffPrice=0;}
 function clearReference(work){if(!work)return;clearTariffSelection(work);work.tariffKind='';work.referenceSearch='';work.unitPrice=0;}
 function resolveTariff(work){
  if(!work||tariffState!=='ready'||!String(work.description||'').trim())return {status:'none',matches:[]};
  const chosen=selectedTariff(work);if(chosen)return {status:'matched',matches:[{tariff:chosen,score:999}],chosen};
  if(['manual-reference','jornal','visit-pending','search'].includes(work.tariffKind))return {status:work.tariffKind,matches:[]};
  const result=findTariffMatches(tariffs,work.description,3);
  if(result.status==='matched'&&result.matches[0]?.tariff){applyTariff(work,result.matches[0].tariff,'auto');return {...result,chosen:result.matches[0].tariff};}
  return result;
 }
 function referenceResolved(work){
  if(!String(work?.description||'').trim())return false;
  if(work.tariffKind==='visit-pending'||work.tariffKind==='jornal')return true;
  if(work.tariffKind==='manual-reference')return amount(work.unitPrice)>0;
  if(selectedTariff(work)||amount(work.tariffPrice)>0)return true;
  if(tariffState!=='ready')return true;
  return Boolean(resolveTariff(work).chosen||selectedTariff(work));
 }
 function referencesResolved(){return initialiseWorks().every(referenceResolved);}
 function pricingLabel(work){
  if(work.tariffKind==='visit-pending')return 'Relevamiento';
  if(work.tariffKind==='jornal')return 'Jornal';
  if(work.tariffKind==='manual-reference')return amount(work.unitPrice)>0?'Manual':'Manual · falta precio';
  const tariff=selectedTariff(work);if(tariff||amount(work.tariffPrice)>0)return 'Tarifario';
  return 'Definir precio';
 }
 function workSummary(work){const total=commercialReferenceTotal(work);return work.tariffKind==='visit-pending'?'Pendiente de relevamiento':total>0?`${money(total)} · ${pricingLabel(work)}`:pricingLabel(work);}
 function workList(rows){return `<div class="quote-builder-work-list-scroll" data-qw-scroll-key="works"><div class="quote-builder-work-list">${rows.map((work,index)=>`<button type="button" class="quote-builder-work-item ${work.id===activeWorkId?'active':''}" data-qw-select-work="${esc(work.id)}"><span class="quote-builder-work-number">${index+1}</span><span class="quote-builder-work-copy"><strong>${esc(work.description||'Trabajo sin nombre')}</strong><small data-qw-work-summary="${esc(work.id)}">${esc(workSummary(work))}</small></span></button>`).join('')}</div></div>`;}
 function mobileWorkSelector(rows){return `<div class="quote-builder-mobile-work"><label>Trabajo<select data-qw-work-selector>${rows.map((work,index)=>`<option value="${esc(work.id)}" ${work.id===activeWorkId?'selected':''}>${index+1}. ${esc(work.description||'Trabajo sin nombre')} · ${esc(workSummary(work))}</option>`).join('')}</select></label><button type="button" data-qw-add-work aria-label="Agregar trabajo">＋</button></div>`;}
 function unitOptions(current){return UNITS.map(unit=>`<option value="${esc(unit)}" ${unit===current?'selected':''}>${esc(unit)}</option>`).join('');}
 function tariffChoice(work,item){const tariff=item.tariff;return `<button type="button" data-qw-select-tariff="${esc(tariff.key)}" data-qw-tariff-work="${esc(work.id)}"><strong>${esc(tariff.tarea)}</strong><span>${money(tariff.precio)} / ${esc(tariff.unidad||'unidad')}</span></button>`;}
 function tariffPricing(work){
  if(tariffState==='loading'||tariffState==='idle')return `<div class="quote-price-state"><p>Consultando Tarifario…</p></div>`;
  if(tariffState==='error')return `<div class="quote-price-state warning"><p>No pude consultar el Tarifario. ${esc(tariffError)}</p><p>Podés usar Manual o Jornal sin perder el trabajo.</p></div>`;
  const chosen=selectedTariff(work);if(chosen)return `<div class="quote-selected-tariff"><div><span>Referencia del Tarifario</span><strong>${esc(chosen.tarea)}</strong><small>${esc(chosen.rubro||'Tarifario AMC')} · ${money(chosen.precio)} / ${esc(chosen.unidad||'unidad')}</small></div><button type="button" data-qw-change-tariff="${esc(work.id)}">Cambiar</button></div><div class="quote-wizard-fields"><label>Cantidad<input type="number" min="0" step="0.01" value="${work.quantity}" data-qw-work-input data-qw-key="quantity" data-qw-work-id="${esc(work.id)}"></label><label>Unidad<input value="${esc(chosen.unidad||'unidad')}" disabled></label></div><div class="quote-work-total">Referencia del trabajo <strong data-qw-active-total>${money(commercialReferenceTotal(work))}</strong></div>`;
  const query=String(work.referenceSearch||work.description||'').trim(),result=query?findTariffMatches(tariffs,query,3):{status:'none',matches:[]},matches=result.matches||[];
  if(result.status==='visit')return `<div class="quote-price-state warning"><strong>Esto parece un pedido para relevar.</strong><p>AMC no inventa un precio ni suma una visita automáticamente al presupuesto. Podés marcarlo como Relevamiento o elegir Manual/Jornal si ya tenés información suficiente.</p><button type="button" class="quote-inline-action" data-qw-pricing-mode="visit" data-qw-work-id="${esc(work.id)}">Marcar como relevamiento</button></div>`;
  return `<div class="quote-tariff-search"><label>Buscar referencia<input value="${esc(work.referenceSearch||work.description||'')}" data-qw-reference-search-input data-qw-work-id="${esc(work.id)}" placeholder="Ej. revoque fino"></label><button type="button" data-qw-run-tariff-search data-qw-reference-work="${esc(work.id)}">Buscar</button></div>${matches.length?`<div class="quote-tariff-results"><p>${result.status==='ambiguous'?'Elegí la referencia correcta:':'Referencia encontrada:'}</p>${matches.map(item=>tariffChoice(work,item)).join('')}</div>`:`<div class="quote-price-state"><p>Sin referencia automática. Probá otra búsqueda o elegí Manual, Jornal o Relevamiento.</p></div>`}`;
 }
 function manualPricing(work){return `<div class="quote-wizard-fields quote-wizard-fields-3"><label>Cantidad<input type="number" min="0" step="0.01" value="${work.quantity}" data-qw-work-input data-qw-key="quantity" data-qw-work-id="${esc(work.id)}"></label><label>Unidad<select data-qw-work-input data-qw-key="unit" data-qw-work-id="${esc(work.id)}">${unitOptions(work.unit)}</select></label><label>Precio por ${esc(work.unit||'unidad')}<input type="number" min="0" step="100" value="${amount(work.unitPrice)}" data-qw-work-input data-qw-key="unitPrice" data-qw-work-id="${esc(work.id)}"></label></div><p class="quote-price-help">Referencia manual · sólo este presupuesto. No modifica el Tarifario.</p><div class="quote-work-total">Referencia del trabajo <strong data-qw-active-total>${money(commercialReferenceTotal(work))}</strong></div>`;}
 function jornalPricing(work){return `<div class="quote-wizard-fields quote-wizard-fields-3"><label>Operarios<input type="number" min="1" step="1" value="${work.workers}" data-qw-work-input data-qw-key="workers" data-qw-work-id="${esc(work.id)}"></label><label>Horas estimadas<input type="number" min="0.25" step="0.25" value="${work.hours}" data-qw-work-input data-qw-key="hours" data-qw-work-id="${esc(work.id)}"></label><label>Días internos estimados<input value="${Math.max(1,Math.ceil(amount(work.hours,8)/8))}" disabled></label></div><p class="quote-price-help">Al elegir Jornal, AMC suma esta referencia al total del presupuesto inmediatamente.</p><div class="quote-work-total">Referencia por jornal <strong data-qw-active-total>${money(jornalReference(work))}</strong></div>`;}
 function visitPricing(work){return `<div class="quote-price-state warning"><strong>Relevamiento pendiente</strong><p>Este trabajo todavía no tiene información suficiente para cotizarlo. No se suma un precio de obra ni una visita automática al presupuesto.</p><p>Después del relevamiento podés reemplazarlo por los trabajos reales y sus valores.</p></div><div class="quote-work-total muted">Impacto actual en el presupuesto <strong data-qw-active-total>${money(0)}</strong></div>`;}
 function pricingPanel(work){
  const tariffActive=!['manual-reference','jornal','visit-pending'].includes(work.tariffKind),manual=work.tariffKind==='manual-reference',jornal=work.tariffKind==='jornal',visit=work.tariffKind==='visit-pending';
  return `<section class="quote-pricing"><div class="quote-pricing-tabs" role="group" aria-label="Forma de calcular el trabajo"><button type="button" class="${tariffActive?'active':''}" data-qw-pricing-mode="tariff" data-qw-work-id="${esc(work.id)}">Tarifario</button><button type="button" class="${manual?'active':''}" data-qw-pricing-mode="manual" data-qw-work-id="${esc(work.id)}">Manual</button><button type="button" class="${jornal?'active':''}" data-qw-pricing-mode="jornal" data-qw-work-id="${esc(work.id)}">Jornal</button><button type="button" class="${visit?'active':''}" data-qw-pricing-mode="visit" data-qw-work-id="${esc(work.id)}">Relevamiento</button></div>${manual?manualPricing(work):jornal?jornalPricing(work):visit?visitPricing(work):tariffPricing(work)}</section>`;
 }
 function internalCosts(work){const open=openCostWorkIds.has(work.id);return `<details class="quote-internal-costs" data-qw-cost-details="${esc(work.id)}" ${open?'open':''}><summary><span>Costos internos <small>Opcional · no se muestran al cliente</small></span><strong data-qw-work-direct="${esc(work.id)}">${money(workDirectCost(work))}</strong></summary><div class="quote-wizard-fields quote-wizard-fields-3"><label>Materiales<input type="number" min="0" step="100" value="${work.materials}" data-qw-work-input data-qw-key="materials" data-qw-work-id="${esc(work.id)}"></label><label>Herramientas / consumibles<input type="number" min="0" step="100" value="${work.tools}" data-qw-work-input data-qw-key="tools" data-qw-work-id="${esc(work.id)}"></label><label>Otros / contingencia<input type="number" min="0" step="100" value="${work.other}" data-qw-work-input data-qw-key="other" data-qw-work-id="${esc(work.id)}"></label></div>${work.tariffKind==='jornal'?`<div class="quote-inline-note">Costo interno estimado de mano de obra: <strong>${money(workLaborCost(work,employeeDay))}</strong></div>`:''}</details>`;}
 function workDetail(work){if(!work)return '<div class="quote-wizard-empty">Agregá un trabajo para empezar.</div>';return `<div class="quote-builder-detail-inner"><div class="quote-builder-detail-head"><div><span class="eyebrow">TRABAJO SELECCIONADO</span><h2>${esc(work.description||'Nuevo trabajo')}</h2></div><button type="button" class="quote-remove-work" data-qw-remove-work="${esc(work.id)}">Eliminar</button></div><label class="quote-wizard-field">Trabajo<input value="${esc(work.description)}" data-qw-work-input data-qw-key="description" data-qw-work-id="${esc(work.id)}" placeholder="Ej. Revoque fino"></label>${pricingPanel(work)}${internalCosts(work)}</div>`;}
 function summaryPanel(rows){
  const commercial=rows.reduce((sum,work)=>sum+commercialReferenceTotal(work),0),direct=directCostTotal(rows,travel),pending=rows.filter(work=>!referenceResolved(work)).length,relevamientos=rows.filter(work=>work.tariffKind==='visit-pending').length;
  return `<aside class="quote-builder-summary-panel"><div class="quote-summary-title"><span class="eyebrow">RESUMEN</span><strong>${rows.length} trabajo${rows.length===1?'':'s'}</strong></div><div class="quote-summary-main"><span>Referencia acumulada</span><strong data-qw-commercial-total>${money(commercial)}</strong></div>${pending?`<div class="quote-summary-alert">${pending} trabajo${pending===1?'':'s'} todavía sin precio definido.</div>`:''}${relevamientos?`<div class="quote-summary-alert neutral">${relevamientos} trabajo${relevamientos===1?'':'s'} pendiente${relevamientos===1?'':'s'} de relevamiento. No suma${relevamientos===1?'':'n'} al total.</div>`:''}<div class="quote-summary-rows">${rows.map(work=>`<button type="button" data-qw-select-work="${esc(work.id)}"><span>${esc(work.description||'Trabajo sin nombre')}</span><strong data-qw-work-total="${esc(work.id)}">${money(commercialReferenceTotal(work))}</strong></button>`).join('')}</div><details class="quote-summary-costs"><summary>Costos internos cargados</summary><label>Movilidad general<input type="number" min="0" step="100" value="${travel}" data-qw-travel></label><div><span>Costos directos</span><strong data-qw-direct-total>${money(direct)}</strong></div></details></aside>`;
 }
 function budgetStage(){
  const rows=initialiseWorks(),work=activeWork(),client=currentClient(),request=selectedRequest();
  return `<div class="quote-budget-stage"><div class="quote-budget-context"><div><span class="eyebrow">ETAPA 2 DE 4</span><strong>${esc(client?.name||'Cliente')}</strong><small>${request?esc((request.services||[request.service]).filter(Boolean).join(', ')||request.description||'Solicitud seleccionada'):'Presupuesto directo · sin solicitud'}</small></div><button type="button" data-qw-edit-client>Editar cliente</button></div>${mobileWorkSelector(rows)}<div class="quote-builder-workspace"><aside class="quote-builder-sidebar"><div class="quote-builder-sidebar-head"><div><span>Trabajos</span><strong>${rows.length}</strong></div><button type="button" data-qw-add-work>＋</button></div>${workList(rows)}</aside><main class="quote-builder-detail" data-qw-scroll-key="detail">${workDetail(work)}</main><div class="quote-builder-summary" data-qw-scroll-key="summary">${summaryPanel(rows)}</div></div><div class="quote-mobile-summary"><div><span>Referencia acumulada</span><strong data-qw-commercial-total>${money(rows.reduce((sum,item)=>sum+commercialReferenceTotal(item),0))}</strong></div><button type="button" data-qw-mobile-summary>Ver resumen</button></div></div>`;
 }
 function reviewPlaceholder(){return `<div class="quote-wizard-step"><div class="quote-wizard-step-copy"><span class="eyebrow">ETAPA 3 DE 4</span><h2>Revisión</h2><p>La estructura nueva ya deja el presupuesto listo para revisar sin volver a recorrer formularios largos. Rentabilidad, precio final y envío siguen fuera de este corte.</p></div></div>`;}
 function body(){if(stage===2)return budgetStage();if(stage===3)return reviewPlaceholder();return clientStage();}
 function canEnterBudget(){return Boolean(currentClient());}
 function validWorks(){const rows=initialiseWorks();return rows.length>0&&rows.every(work=>String(work.description||'').trim());}
 function controls(){
  if(stage===1)return `<div class="quote-wizard-controls"><button type="button" class="secondary" data-qw-close>Cancelar</button><span class="quote-wizard-mobile-progress">Cliente</span><button type="button" class="primary" data-qw-next ${canEnterBudget()?'':'disabled'}>Abrir presupuesto →</button></div>`;
  if(stage===2)return `<div class="quote-wizard-controls"><button type="button" class="secondary" data-qw-back>← Cliente</button><span class="quote-wizard-mobile-progress">Presupuesto</span><button type="button" class="primary" data-qw-next ${validWorks()&&referencesResolved()?'':'disabled'}>Revisión · próximo corte</button></div>`;
  return `<div class="quote-wizard-controls"><button type="button" class="secondary" data-qw-back>← Presupuesto</button><span></span><button type="button" class="primary" disabled>Guardar / enviar · próximo corte</button></div>`;
 }
 function markup(){return `<div class="quote-wizard-layer"><section class="quote-wizard-dialog" role="dialog" aria-modal="true" aria-labelledby="quote-wizard-title"><header class="quote-wizard-header"><div><span class="eyebrow">COTIZADOR AMC</span><h1 id="quote-wizard-title">${stage===1?'Nuevo presupuesto':stage===2?'Armar presupuesto':'Revisar presupuesto'}</h1></div><button type="button" class="quote-wizard-close" data-qw-close aria-label="Cerrar cotizador">×</button></header>${phaseNav()}<div class="quote-wizard-content" data-qw-scroll-key="content">${body()}</div>${controls()}</section></div>`;}
 function render(){if(!isAdmin())return '<section class="panel"><h2>Acceso exclusivo de AMC</h2><p>Esta herramienta está disponible sólo para Administración.</p></section>';ensureTariffs();return `<div class="quote-wizard-host">${markup()}</div>`;}
 function captureScroll(host){const values=new Map();host?.querySelectorAll('[data-qw-scroll-key]').forEach(node=>values.set(node.dataset.qwScrollKey,node.scrollTop));return values;}
 function restoreScroll(host,values){values.forEach((value,key)=>{const node=host.querySelector(`[data-qw-scroll-key="${CSS.escape(key)}"]`);if(node)node.scrollTop=value;});}
 function paint({focusSelector='',preserveScroll=true}={}){
  const host=document.querySelector('.quote-wizard-host');if(!host)return;const scroll=preserveScroll?captureScroll(host):new Map();host.innerHTML=markup();if(preserveScroll)restoreScroll(host,scroll);
  if(focusSelector)requestAnimationFrame(()=>host.querySelector(focusSelector)?.focus?.({preventScroll:true}));
 }
 function addWork(){const rows=initialiseWorks(),work=createWork({description:''});rows.push(work);activeWorkId=work.id;paint({focusSelector:`[data-qw-work-id="${CSS.escape(work.id)}"][data-qw-key="description"]`});}
 function close(){const target=(origin||'#presupuestos').replace(/^#/,'')||'presupuestos';navigate(target);}
 function chooseTariff(workId,key,kind='manual-tariff'){const work=initialiseWorks().find(item=>item.id===workId),tariff=tariffs.find(item=>item.key===key);if(!work||!tariff)return;applyTariff(work,tariff,kind);paint();}
 function setPricingMode(workId,pricingMode){
  const work=initialiseWorks().find(item=>item.id===workId);if(!work)return;
  if(pricingMode==='manual'){clearTariffSelection(work);work.tariffKind='manual-reference';work.referenceSearch='';}
  else if(pricingMode==='jornal'){clearTariffSelection(work);work.tariffKind='jornal';work.referenceSearch='';work.days=Math.max(1,Math.ceil(amount(work.hours,8)/8));}
  else if(pricingMode==='visit'){clearTariffSelection(work);work.tariffKind='visit-pending';work.referenceSearch='';work.unitPrice=0;}
  else {clearTariffSelection(work);work.tariffKind='search';work.referenceSearch=work.referenceSearch||work.description||'';work.unitPrice=0;const result=findTariffMatches(tariffs,work.description,3);if(result.status==='matched'&&result.matches[0]?.tariff)applyTariff(work,result.matches[0].tariff,'auto');}
  paint({focusSelector:pricingMode==='tariff'&&!selectedTariff(work)?'[data-qw-reference-search-input]':''});
 }
 function removeWork(workId){const rows=initialiseWorks(),index=rows.findIndex(work=>work.id===workId);if(index<0)return;rows.splice(index,1);if(!rows.length)rows.push(createWork({description:''}));activeWorkId=rows[Math.min(index,rows.length-1)]?.id||rows[0]?.id||'';paint();}
 function updateLivePreview(){
  const host=document.querySelector('.quote-wizard-host');if(!host)return;const rows=initialiseWorks(),commercial=rows.reduce((sum,work)=>sum+commercialReferenceTotal(work),0),direct=directCostTotal(rows,travel);
  host.querySelectorAll('[data-qw-commercial-total]').forEach(node=>node.textContent=money(commercial));
  const directTotal=host.querySelector('[data-qw-direct-total]');if(directTotal)directTotal.textContent=money(direct);
  rows.forEach(work=>{
   host.querySelectorAll(`[data-qw-work-total="${CSS.escape(work.id)}"]`).forEach(node=>node.textContent=money(commercialReferenceTotal(work)));
   const row=host.querySelector(`[data-qw-work-summary="${CSS.escape(work.id)}"]`);if(row)row.textContent=workSummary(work);
   const directNode=host.querySelector(`[data-qw-work-direct="${CSS.escape(work.id)}"]`);if(directNode)directNode.textContent=money(workDirectCost(work));
  });
  const active=activeWork();const activeTotal=host.querySelector('[data-qw-active-total]');if(active&&activeTotal)activeTotal.textContent=money(commercialReferenceTotal(active));
  const next=host.querySelector('[data-qw-next]');if(next&&stage===2)next.disabled=!(validWorks()&&referencesResolved());
 }
 async function ensureTariffs(){
  if(tariffState==='ready'||tariffState==='loading')return;tariffState='loading';tariffError='';
  try{const response=await fetch('/api/estimator-tariffs',{method:'GET',credentials:'same-origin',headers:{Accept:'application/json'}}),payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.error||'No se pudo consultar el Tarifario.');tariffs=Array.isArray(payload.items)?payload.items:[];tariffState='ready';if(works)works.forEach(resolveTariff);}catch(error){tariffs=[];tariffState='error';tariffError=String(error?.message||'No se pudo consultar el Tarifario.');}
  if(stage===2&&document.querySelector('.quote-wizard-host'))paint();
 }
 async function createClient(){
  if(newClientSaving)return;newClientSaving=true;newClientError='';paint();
  try{
   const response=await fetch('/api/admin/clients',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(newClientDraft)}),payload=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(payload.error||'No se pudo guardar el cliente.');
   const client=payload.duplicate?payload.duplicate:{...payload,hasAccount:0};if(!client?.id)throw new Error('AMC no devolvió la ficha del cliente.');
   localClients=[...localClients.filter(item=>clientKey(item)!==clientKey(client)),client];clientRef=clientKey(client);requestId='';resetWorks();newClientOpen=false;newClientDraft={name:'',phone:'',town:''};
   toast?.(payload.duplicate?'Ese teléfono ya existía. Seleccioné la ficha existente.':'Cliente guardado y seleccionado.');
  }catch(error){newClientError=String(error?.message||'No se pudo guardar el cliente.');}
  finally{newClientSaving=false;paint();}
 }
 function handleWorkInput(target){
  const item=initialiseWorks().find(work=>work.id===target.dataset.qwWorkId);if(!item)return;const key=target.dataset.qwKey;
  if(key==='description'){item.description=target.value;clearReference(item);}
  else if(key==='unit')item.unit=target.value;
  else if(key==='workers'){item.workers=Math.max(1,Math.ceil(amount(target.value,1)||1));}
  else if(key==='hours'){item.hours=Math.max(.25,amount(target.value,8)||8);if(item.tariffKind==='jornal')item.days=Math.max(1,Math.ceil(item.hours/8));}
  else item[key]=amount(target.value);
  updateLivePreview();
 }
 document.addEventListener('click',event=>{
  if(!document.querySelector('.quote-wizard-host'))return;
  const closeButton=event.target.closest('[data-qw-close]');if(closeButton){event.preventDefault();close();return;}
  const editClient=event.target.closest('[data-qw-edit-client]');if(editClient){stage=1;paint({preserveScroll:false});return;}
  const next=event.target.closest('[data-qw-next]');if(next&&!next.disabled){if(stage===1){stage=2;initialiseWorks();paint({preserveScroll:false});}return;}
  const back=event.target.closest('[data-qw-back]');if(back){stage=Math.max(1,stage-1);paint({preserveScroll:false});return;}
  const newClient=event.target.closest('[data-qw-new-client]');if(newClient){newClientOpen=true;newClientError='';paint({focusSelector:'[data-qw-new-client-form] input[name="name"]'});return;}
  const cancelNew=event.target.closest('[data-qw-cancel-new-client]');if(cancelNew){newClientOpen=false;newClientError='';paint();return;}
  const add=event.target.closest('[data-qw-add-work]');if(add){addWork();return;}
  const selectWork=event.target.closest('[data-qw-select-work]');if(selectWork){activeWorkId=selectWork.dataset.qwSelectWork;paint();return;}
  const remove=event.target.closest('[data-qw-remove-work]');if(remove){removeWork(remove.dataset.qwRemoveWork);return;}
  const pricing=event.target.closest('[data-qw-pricing-mode]');if(pricing){setPricingMode(pricing.dataset.qwWorkId,pricing.dataset.qwPricingMode);return;}
  const changeTariff=event.target.closest('[data-qw-change-tariff]');if(changeTariff){setPricingMode(changeTariff.dataset.qwChangeTariff,'tariff');return;}
  const tariffChoice=event.target.closest('[data-qw-select-tariff]');if(tariffChoice){chooseTariff(tariffChoice.dataset.qwTariffWork,tariffChoice.dataset.qwSelectTariff);return;}
  const searchButton=event.target.closest('[data-qw-run-tariff-search]');if(searchButton){paint();return;}
  const mobileSummary=event.target.closest('[data-qw-mobile-summary]');if(mobileSummary){const summary=document.querySelector('.quote-builder-summary');summary?.scrollIntoView?.({behavior:'smooth',block:'start'});return;}
 });
 document.addEventListener('submit',event=>{if(!document.querySelector('.quote-wizard-host')||!event.target.matches('[data-qw-new-client-form]'))return;event.preventDefault();const form=new FormData(event.target);newClientDraft={name:String(form.get('name')||'').trim(),phone:String(form.get('phone')||'').trim(),town:String(form.get('town')||'').trim()};createClient();});
 document.addEventListener('change',event=>{
  if(!document.querySelector('.quote-wizard-host'))return;
  if(event.target.matches('[data-qw-client]')){clientRef=event.target.value||'';requestId='';resetWorks();paint();return;}
  if(event.target.matches('[data-qw-request]')){requestId=event.target.value||'';quoteId='';resetWorks();paint();return;}
  if(event.target.matches('[data-qw-work-selector]')){activeWorkId=event.target.value||activeWorkId;paint();return;}
  if(event.target.matches('[data-qw-work-input]')){handleWorkInput(event.target);if(event.target.dataset.qwKey==='description'&&tariffState==='ready'){const item=activeWork();if(item&&!item.tariffKind)resolveTariff(item);paint();}return;}
 });
 document.addEventListener('input',event=>{
  if(!document.querySelector('.quote-wizard-host'))return;
  if(event.target.closest('[data-qw-new-client-form]')){const name=event.target.name;if(name&&Object.hasOwn(newClientDraft,name))newClientDraft[name]=event.target.value;return;}
  if(event.target.matches('[data-qw-reference-search-input]')){const item=initialiseWorks().find(work=>work.id===event.target.dataset.qwWorkId);if(item)item.referenceSearch=event.target.value;return;}
  if(event.target.matches('[data-qw-work-input]')){handleWorkInput(event.target);return;}
  if(event.target.matches('[data-qw-travel]')){travel=amount(event.target.value);updateLivePreview();}
 });
 document.addEventListener('toggle',event=>{if(!document.querySelector('.quote-wizard-host')||!event.target.matches('[data-qw-cost-details]'))return;const id=event.target.dataset.qwCostDetails;if(event.target.open)openCostWorkIds.add(id);else openCostWorkIds.delete(id);},true);
 function afterRender(page){if(page!=='cotizador')return;ensureTariffs();requestAnimationFrame(()=>document.querySelector('.quote-wizard-dialog')?.focus?.({preventScroll:true}));}
 return {render,open,prefillClient,afterRender,getDraft:()=>({stage,requestId,quoteId,mode,clientRef,travel,employeeDay,works:[...(works||[])],commercialReference:(works||[]).reduce((sum,work)=>sum+commercialReferenceTotal(work),0),directCost:directCostTotal(works||[],travel),laborCost:laborCostTotal(works||[],employeeDay),internalCost:internalCostTotal(works||[],travel,employeeDay)})};
}
