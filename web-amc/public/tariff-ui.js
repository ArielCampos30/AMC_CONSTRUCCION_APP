export function createTariffUI({isAdmin,heading,esc,money,api,toast}){
 let items=[],rubrics=[],meta={},query='',rubricFilter='',loaded=false,loading=false,saving=false,error='',updatedAt='',modal=null;
 const selected=new Set();
 const clean=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const notify=message=>{if(typeof toast==='function')toast(message);};
 const rubricMap=()=>new Map(rubrics.map(item=>[item.id,item]));
 const itemById=id=>items.find(item=>item.id===id)||null;
 const rubricById=id=>rubrics.find(item=>item.id===id)||null;
 const filtered=()=>{const term=clean(query);return items.filter(item=>(!rubricFilter||item.rubricId===rubricFilter)&&(!term||clean([item.rubro,item.tarea,item.unidad,item.obs].join(' ')).includes(term)));};
 const countByRubric=id=>items.filter(item=>item.rubricId===id).length;
 const optionMarkup=(current='')=>rubrics.map(item=>`<option value="${esc(item.id)}"${item.id===current?' selected':''}>${esc(item.name)}</option>`).join('');
 const ensureStyle=()=>{if(document.querySelector('link[data-tariff-ui]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href='/tariff-ui.css';link.dataset.tariffUi='1';document.head.append(link);};
 const sourceText=()=>Array.isArray(meta.sources)&&meta.sources.length?meta.sources.join(' · '):'';

 function applyData(data={}){
  items=Array.isArray(data.items)?data.items:[];rubrics=Array.isArray(data.rubrics)?data.rubrics:[];meta=data.meta&&typeof data.meta==='object'?data.meta:{};updatedAt=data.updatedAt||'';loaded=true;
  const valid=new Set(items.map(item=>item.id));for(const id of [...selected])if(!valid.has(id))selected.delete(id);
  if(rubricFilter&&!rubrics.some(item=>item.id===rubricFilter))rubricFilter='';
 }

 const infoMarkup=()=>`<section class="panel tariff-context"><div><span class="tariff-kicker">BASE COMERCIAL AMC</span><h2>${esc(meta.region||'La Falda / Valle de Punilla, Córdoba')}</h2><p>${esc(meta.basis||'Referencias de mano de obra editables por AMC.')}</p></div><div class="tariff-context-note"><strong>Importante</strong><span>${esc(meta.note||'Los importes son referencias y se ajustan a cada obra.')}</span></div>${sourceText()?`<details><summary>Referencias usadas para la base inicial</summary><p>${esc(sourceText())}</p></details>`:''}</section>`;

 const resultsMarkup=()=>{
  if(loading&&!loaded)return '<section class="panel tariff-state"><p>Cargando Tarifario AMC…</p></section>';
  if(error)return `<section class="panel tariff-state error-box"><h2>No pudimos cargar el Tarifario</h2><p>${esc(error)}</p><button type="button" class="outline" data-tariff-retry>Reintentar</button></section>`;
  const rows=filtered();
  if(!rows.length)return '<section class="panel tariff-state"><h2>Sin coincidencias</h2><p>Probá con otro rubro o búsqueda, o agregá un trabajo nuevo.</p></section>';
  return `<div class="tariff-results">${rows.map(item=>`<article class="panel tariff-row" data-tariff-row="${esc(item.id)}"><label class="tariff-check" title="Seleccionar para actualización masiva"><input type="checkbox" data-tariff-select="${esc(item.id)}"${selected.has(item.id)?' checked':''}><span></span></label><div class="tariff-main"><span class="tariff-rubro">${esc(item.rubro||rubricById(item.rubricId)?.name||'Otros')}</span><h2>${esc(item.tarea)}</h2>${item.obs?`<p>${esc(item.obs)}</p>`:''}</div><div class="tariff-unit"><span>Unidad</span><strong>${esc(item.unidad||'unidad')}</strong></div><div class="tariff-price"><span>Referencia</span><strong>${money(Number(item.precio||0))}</strong>${item.fecha?`<small>Actualizado ${esc(item.fecha)}</small>`:''}</div><div class="tariff-row-actions"><button type="button" class="outline" data-tariff-edit-item="${esc(item.id)}">Editar</button><button type="button" class="outline tariff-danger" data-tariff-delete-item="${esc(item.id)}">Borrar</button></div></article>`).join('')}</div>`;
 };

 function bulkTargets(){
  if(modal?.scope==='selected'&&selected.size)return items.filter(item=>selected.has(item.id));
  const rubricId=modal?.rubricId||rubricFilter||rubrics[0]?.id||'';return items.filter(item=>item.rubricId===rubricId);
 }
 function bulkPreviewMarkup(){
  const percent=Number(modal?.percent||0),targets=bulkTargets();
  if(!Number.isFinite(percent)||percent<=0)return '<p class="tariff-preview-empty">Ingresá un porcentaje para ver los nuevos precios antes de guardar.</p>';
  if(!targets.length)return '<p class="tariff-preview-empty">No hay trabajos en el alcance elegido.</p>';
  return `<div class="tariff-preview-list">${targets.slice(0,12).map(item=>`<div><span>${esc(item.tarea)}</span><strong>${money(item.precio)} → ${money(Math.max(1,Math.round(item.precio*(1+percent/100))))}</strong></div>`).join('')}${targets.length>12?`<small>+ ${targets.length-12} trabajos más</small>`:''}</div>`;
 }

 const itemModalMarkup=()=>{
  const item=modal?.itemId?itemById(modal.itemId):null,currentRubric=item?.rubricId||modal?.rubricId||rubricFilter||rubrics[0]?.id||'';
  return `<div class="tariff-modal-card"><div class="tariff-modal-head"><div><span class="tariff-kicker">${item?'EDITAR':'NUEVO'} TRABAJO</span><h2>${item?'Actualizar referencia':'Agregar trabajo al Tarifario'}</h2></div><button type="button" class="tariff-modal-x" data-tariff-modal-close aria-label="Cerrar">×</button></div><form data-tariff-item-form><input type="hidden" name="itemId" value="${esc(item?.id||'')}"><label>Rubro<select name="rubricId" required>${optionMarkup(currentRubric)}</select></label><label>Trabajo<input name="tarea" maxlength="160" required value="${esc(item?.tarea||'')}" placeholder="Ej.: Revoque grueso"></label><div class="tariff-form-grid"><label>Unidad<input name="unidad" maxlength="30" required value="${esc(item?.unidad||'unidad')}" placeholder="m², unidad, hora…"></label><label>Precio de referencia<input name="precio" type="number" min="1" step="1" required value="${item?.precio||''}" inputmode="numeric"></label></div><label>Observación<textarea name="obs" maxlength="500" rows="3" placeholder="Qué incluye, qué no incluye o condición especial">${esc(item?.obs||'')}</textarea></label><p class="tariff-form-help">El precio queda como referencia del Tarifario. Los presupuestos ya guardados conservan el importe histórico que tenían al crearse.</p><div class="tariff-modal-actions"><button type="button" class="outline" data-tariff-modal-close>Cancelar</button><button type="submit"${saving?' disabled':''}>${saving?'Guardando…':'Guardar trabajo'}</button></div></form></div>`;
 };

 const rubricsModalMarkup=()=>`<div class="tariff-modal-card tariff-rubrics-card"><div class="tariff-modal-head"><div><span class="tariff-kicker">ORGANIZACIÓN</span><h2>Administrar rubros</h2></div><button type="button" class="tariff-modal-x" data-tariff-modal-close aria-label="Cerrar">×</button></div><form class="tariff-rubric-create" data-tariff-rubric-create><label>Nuevo rubro<input name="name" maxlength="80" required placeholder="Nombre del rubro"></label><button type="submit"${saving?' disabled':''}>Agregar</button></form><div class="tariff-rubric-list">${rubrics.map(rubric=>modal?.editRubricId===rubric.id?`<form data-tariff-rubric-rename="${esc(rubric.id)}"><input name="name" maxlength="80" required value="${esc(rubric.name)}"><button type="submit"${saving?' disabled':''}>Guardar</button><button type="button" class="outline" data-tariff-cancel-rubric-edit>Cancelar</button></form>`:`<div><span><strong>${esc(rubric.name)}</strong><small>${countByRubric(rubric.id)} trabajo${countByRubric(rubric.id)===1?'':'s'}</small></span><span class="tariff-rubric-actions"><button type="button" class="outline" data-tariff-edit-rubric="${esc(rubric.id)}">Renombrar</button><button type="button" class="outline tariff-danger" data-tariff-delete-rubric="${esc(rubric.id)}"${countByRubric(rubric.id)?' disabled title="Primero eliminá o mové los trabajos de este rubro"':''}>Borrar</button></span></div>`).join('')}</div><div class="tariff-modal-actions"><button type="button" class="outline" data-tariff-modal-close>Cerrar</button></div></div>`;

 const bulkModalMarkup=()=>{
  const canSelected=selected.size>0,scope=modal?.scope||(canSelected?'selected':'rubric'),targets=bulkTargets(),percent=Number(modal?.percent||0);
  return `<div class="tariff-modal-card"><div class="tariff-modal-head"><div><span class="tariff-kicker">ACTUALIZACIÓN MASIVA</span><h2>Aumentar precios</h2></div><button type="button" class="tariff-modal-x" data-tariff-modal-close aria-label="Cerrar">×</button></div><form data-tariff-bulk-form><label>Aplicar a<select name="scope" data-tariff-bulk-scope>${canSelected?`<option value="selected"${scope==='selected'?' selected':''}>${selected.size} trabajo${selected.size===1?' seleccionado':'s seleccionados'}</option>`:''}<option value="rubric"${scope==='rubric'?' selected':''}>Todo un rubro</option></select></label><label class="${scope==='rubric'?'':'tariff-hidden'}" data-tariff-bulk-rubric-wrap>Rubro<select name="rubricId" data-tariff-bulk-rubric>${optionMarkup(modal?.rubricId||rubricFilter||rubrics[0]?.id||'')}</select></label><label>Porcentaje de aumento<input name="percent" data-tariff-bulk-percent type="number" min="0.01" max="1000" step="0.01" value="${esc(modal?.percent||'')}" placeholder="Ej.: 12"></label><div class="tariff-preview"><div class="tariff-preview-head"><strong>Vista previa</strong><span data-tariff-target-count>${targets.length} trabajo${targets.length===1?'':'s'}</span></div><div data-tariff-preview>${bulkPreviewMarkup()}</div></div><p class="tariff-form-help">Nada se modifica hasta tocar “Aplicar aumento”.</p><div class="tariff-modal-actions"><button type="button" class="outline" data-tariff-modal-close>Cancelar</button><button type="submit" data-tariff-apply-bulk${!Number.isFinite(percent)||percent<=0||!targets.length||saving?' disabled':''}>${saving?'Actualizando…':'Aplicar aumento'}</button></div></form></div>`;
 };

 const modalMarkup=()=>{if(!modal)return '';const inner=modal.type==='item'?itemModalMarkup():modal.type==='rubrics'?rubricsModalMarkup():modal.type==='bulk'?bulkModalMarkup():'';return inner?`<div class="tariff-modal" data-tariff-modal><div class="tariff-modal-backdrop" data-tariff-modal-close></div>${inner}</div>`:'';};

 const render=()=>heading('HERRAMIENTA INDEPENDIENTE','Tarifario AMC','Administrá las referencias de precio que usa AMC. El Cotizador puede tomar estos valores, pero sigue siendo una herramienta separada.')+infoMarkup()+`<section class="panel tariff-toolbar"><div class="tariff-toolbar-grid"><label for="amc-tariff-search">Buscar<input id="amc-tariff-search" type="search" value="${esc(query)}" placeholder="Ej.: revoque, pérdida, luminaria…" autocomplete="off"></label><label>Rubro<select id="amc-tariff-rubric-filter"><option value="">Todos los rubros</option>${optionMarkup(rubricFilter)}</select></label></div><div class="tariff-toolbar-actions"><div><strong id="amc-tariff-count">${loaded?filtered().length+' de '+items.length+' referencias':'Cargando referencias…'}</strong><small id="amc-tariff-selected">${selected.size?selected.size+' seleccionado'+(selected.size===1?'':'s'):'Seleccioná trabajos para aplicar aumentos en grupo'}</small></div><div class="tariff-action-buttons"><button type="button" class="outline" data-tariff-rubrics>Rubros</button><button type="button" class="outline" data-tariff-bulk>Aumentar precios</button><button type="button" data-tariff-new-item>+ Nuevo trabajo</button></div></div>${updatedAt?`<small class="tariff-updated">Última actualización: ${esc(new Date(updatedAt).toLocaleString('es-AR'))}</small>`:''}</section><div id="amc-tariff-results" data-tariff-results>${resultsMarkup()}</div><div class="tariff-footer-actions"><a class="inline-action tariff-back" href="#mas-admin">← Volver a Más</a><a class="inline-action" href="#cotizador">Abrir Cotizador →</a></div>${modalMarkup()}`;

 function renderPage(){const main=document.querySelector('.workspace>main');if(!main)return;main.innerHTML=render()+'<p class="footer-note">AMC Construcciones y Arreglos</p>';}
 function paintResults(){const results=document.querySelector('[data-tariff-results]');if(results)results.innerHTML=resultsMarkup();const count=document.getElementById('amc-tariff-count');if(count)count.textContent=loaded?filtered().length+' de '+items.length+' referencias':'Cargando referencias…';const selectedNode=document.getElementById('amc-tariff-selected');if(selectedNode)selectedNode.textContent=selected.size?selected.size+' seleccionado'+(selected.size===1?'':'s'):'Seleccioná trabajos para aplicar aumentos en grupo';}
 function paintModal(){document.querySelector('[data-tariff-modal]')?.remove();if(!modal)return;document.querySelector('.workspace>main')?.insertAdjacentHTML('beforeend',modalMarkup());}
 function refreshBulkPreview(){if(modal?.type!=='bulk')return;const preview=document.querySelector('[data-tariff-preview]'),count=document.querySelector('[data-tariff-target-count]'),button=document.querySelector('[data-tariff-apply-bulk]'),targets=bulkTargets(),percent=Number(modal.percent||0);if(preview)preview.innerHTML=bulkPreviewMarkup();if(count)count.textContent=targets.length+' trabajo'+(targets.length===1?'':'s');if(button)button.disabled=saving||!targets.length||!Number.isFinite(percent)||percent<=0;}

 async function load(force=false){
  if(!isAdmin()||loading||(!force&&loaded))return;loading=true;error='';paintResults();
  try{applyData(await api('/api/estimator-tariffs',null,'GET'));}
  catch(err){error=err?.message||'No se pudieron obtener las referencias.';}
  finally{loading=false;renderPage();}
 }
 async function mutate(payload,success){
  if(saving)return false;saving=true;paintModal();
  try{applyData(await api('/api/estimator-tariffs',payload,'POST'));modal=null;renderPage();notify(success);return true;}
  catch(err){notify(err?.message||'No se pudo actualizar el Tarifario.');saving=false;paintModal();return false;}
  finally{saving=false;}
 }

 document.addEventListener('input',event=>{
  if(event.target?.id==='amc-tariff-search'){query=event.target.value;paintResults();event.stopImmediatePropagation();return;}
  if(event.target?.matches?.('[data-tariff-bulk-percent]')){modal.percent=event.target.value;refreshBulkPreview();}
 },true);
 document.addEventListener('change',event=>{
  if(event.target?.id==='amc-tariff-rubric-filter'){rubricFilter=event.target.value;paintResults();return;}
  const select=event.target?.closest?.('[data-tariff-select]');if(select){select.checked?selected.add(select.dataset.tariffSelect):selected.delete(select.dataset.tariffSelect);paintResults();return;}
  if(event.target?.matches?.('[data-tariff-bulk-scope]')){modal.scope=event.target.value;const wrap=document.querySelector('[data-tariff-bulk-rubric-wrap]');wrap?.classList.toggle('tariff-hidden',modal.scope!=='rubric');refreshBulkPreview();return;}
  if(event.target?.matches?.('[data-tariff-bulk-rubric]')){modal.rubricId=event.target.value;refreshBulkPreview();}
 },true);
 document.addEventListener('click',async event=>{
  if(!document.querySelector('[data-tariff-results]')&&!document.querySelector('[data-tariff-modal]'))return;
  const close=event.target.closest?.('[data-tariff-modal-close]');if(close){event.preventDefault();modal=null;paintModal();return;}
  const retry=event.target.closest?.('[data-tariff-retry]');if(retry){event.preventDefault();load(true);return;}
  if(event.target.closest?.('[data-tariff-new-item]')){modal={type:'item',rubricId:rubricFilter||rubrics[0]?.id||''};paintModal();return;}
  const edit=event.target.closest?.('[data-tariff-edit-item]');if(edit){modal={type:'item',itemId:edit.dataset.tariffEditItem};paintModal();return;}
  const remove=event.target.closest?.('[data-tariff-delete-item]');if(remove){const item=itemById(remove.dataset.tariffDeleteItem);if(item&&confirm(`¿Borrar “${item.tarea}” del Tarifario?\n\nLos presupuestos ya guardados no se modifican.`))await mutate({action:'delete-item',itemId:item.id},'Trabajo eliminado del Tarifario.');return;}
  if(event.target.closest?.('[data-tariff-rubrics]')){modal={type:'rubrics',editRubricId:''};paintModal();return;}
  const editRubric=event.target.closest?.('[data-tariff-edit-rubric]');if(editRubric){modal.editRubricId=editRubric.dataset.tariffEditRubric;paintModal();return;}
  if(event.target.closest?.('[data-tariff-cancel-rubric-edit]')){modal.editRubricId='';paintModal();return;}
  const deleteRubric=event.target.closest?.('[data-tariff-delete-rubric]');if(deleteRubric){const rubric=rubricById(deleteRubric.dataset.tariffDeleteRubric);if(rubric&&confirm(`¿Borrar el rubro “${rubric.name}”?`))await mutate({action:'delete-rubric',rubricId:rubric.id},'Rubro eliminado.');return;}
  if(event.target.closest?.('[data-tariff-bulk]')){modal={type:'bulk',scope:selected.size?'selected':'rubric',rubricId:rubricFilter||rubrics[0]?.id||'',percent:''};paintModal();return;}
 },true);
 document.addEventListener('submit',async event=>{
  const itemForm=event.target.closest?.('[data-tariff-item-form]');if(itemForm){event.preventDefault();event.stopImmediatePropagation();const data=new FormData(itemForm),itemId=String(data.get('itemId')||''),payload={action:itemId?'update-item':'create-item',itemId,rubricId:String(data.get('rubricId')||''),tarea:String(data.get('tarea')||''),unidad:String(data.get('unidad')||''),precio:Number(data.get('precio')),obs:String(data.get('obs')||'')};await mutate(payload,itemId?'Trabajo actualizado.':'Trabajo agregado al Tarifario.');return;}
  const createRubric=event.target.closest?.('[data-tariff-rubric-create]');if(createRubric){event.preventDefault();event.stopImmediatePropagation();const name=String(new FormData(createRubric).get('name')||'');if(await mutate({action:'create-rubric',name},'Rubro agregado.'))modal={type:'rubrics',editRubricId:''};return;}
  const renameRubric=event.target.closest?.('[data-tariff-rubric-rename]');if(renameRubric){event.preventDefault();event.stopImmediatePropagation();const name=String(new FormData(renameRubric).get('name')||''),rubricId=renameRubric.dataset.tariffRubricRename;if(await mutate({action:'rename-rubric',rubricId,name},'Rubro actualizado.'))modal={type:'rubrics',editRubricId:''};return;}
  const bulkForm=event.target.closest?.('[data-tariff-bulk-form]');if(bulkForm){event.preventDefault();event.stopImmediatePropagation();const targets=bulkTargets(),percent=Number(modal?.percent||0);if(!targets.length||!Number.isFinite(percent)||percent<=0)return;const scope=modal.scope;if(confirm(`Vas a aumentar ${targets.length} trabajo${targets.length===1?'':'s'} un ${percent}%.\n\n¿Aplicar estos nuevos precios?`))await mutate({action:'bulk-increase',percent,itemIds:scope==='selected'?targets.map(item=>item.id):[],rubricId:scope==='rubric'?(modal.rubricId||''):''},'Precios actualizados.');}
 },true);

 function afterRender(page){
  if(page!=='tarifario'||!isAdmin())return false;ensureStyle();renderPage();document.querySelector('[data-nav="mas-admin"]')?.classList.add('active');document.querySelector('.bottom-nav a[href="#mas-admin"]')?.classList.add('active');load();return true;
 }
 return {afterRender};
}
