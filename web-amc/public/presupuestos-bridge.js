/* Extension of AMC Construcciones. Its calculation and PDF code is preserved. */
(async function(){
 const toast=message=>{let node=document.getElementById('amc-estimator-feedback');if(!node){node=document.createElement('div');node.id='amc-estimator-feedback';node.setAttribute('role','status');node.style.cssText='position:fixed;z-index:100;left:50%;bottom:24px;transform:translateX(-50%);max-width:min(420px,calc(100vw - 32px));padding:12px 16px;border-radius:12px;background:#173d39;color:#fff;box-shadow:0 10px 30px #0003';document.body.append(node);}node.textContent=String(message);node.hidden=false;clearTimeout(node._timer);node._timer=setTimeout(()=>node.hidden=true,4000);};
 const embedded=window.parent!==window&&new URLSearchParams(location.search).has('embed');
 if(embedded)window.alert=toast;
 if(embedded){const style=document.createElement('style');style.textContent='body{background:#fff!important}.app{max-width:none!important;margin:0!important;padding:12px!important}.app>.header{display:none!important}.tabs,.app>.header,#app-version,#view-home{display:none!important}.view{display:block!important}.view:not(#view-quote):not(#view-add){display:none!important}#view-quote>.grid{grid-template-columns:1fr!important}#save-quote{display:none!important}#amc-client-step,#amc-labor-step,#amc-profit-step,#amc-final-price-step{max-width:none!important}.app>#view-add{margin-top:0!important}';document.head.append(style);}
 let session,requests=[];
 const appRoot=document.querySelector('.app');
 const banner=document.createElement('section');
 banner.id='amc-client-step';
 banner.className='panel';
 banner.style.cssText='margin:16px 12px;padding:14px 16px';
 banner.innerHTML='<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><div class="small muted">1. Cliente</div><strong id="connected-client-summary">Elegí el cliente del presupuesto</strong><p id="connection-status" class="small muted" style="margin:4px 0 0">Conectando con tus solicitudes…</p></div><a href="/#inicio">← Volver a Inicio</a></div><div class="form-grid" style="margin-top:10px"><label>Cliente / solicitud<select id="connected-request"></select></label><div style="align-self:end"><button type="button" id="import-request" class="btn">Usar / cambiar cliente</button></div></div><div id="suggested-rubrics"></div><button type="button" id="send-connected" class="btn primary">Enviar este presupuesto al cliente</button><div id="external-delivery" hidden style="margin-top:12px"><label>Canal de entrega<select id="delivery-channel"><option>WhatsApp</option><option>PDF</option><option>Personalmente</option><option>Otro</option></select></label> <button type="button" id="share-whatsapp" class="btn">Compartir por WhatsApp</button> <button type="button" id="mark-delivered" class="btn">Marcar como entregado</button> <button type="button" id="accept-manual" class="btn primary" hidden>Marcar como aceptado</button></div><p id="delivery-help" class="small muted">El cliente tiene 10 días corridos desde el envío para responder.</p>';

 const validityField=document.getElementById('q-validity');
 if(validityField){
   validityField.value=10;
   validityField.readOnly=true;
   validityField.title='Los presupuestos enviados por AMC tienen 10 días corridos para responder.';
 }
 draft.validity=10;

 const teamBox=document.createElement('section');
 teamBox.id='amc-labor-step';
 teamBox.className='panel';
 teamBox.style.cssText='margin:16px 12px;padding:16px';
 teamBox.innerHTML='<h2>4. Mano de obra estimada</h2><p>Sólo calcula tu costo interno. No asigna trabajos ni avisa al empleado.</p><div id="estimated-team-list"></div><div class="form-grid"><label>Empleado<select id="estimated-employee"><option value="">Elegí un empleado</option></select></label><button type="button" id="add-estimated-employee" class="btn">+ Agregar empleado</button><button type="button" id="add-manual-labor" class="btn">+ Mano de obra manual</button></div><strong id="estimated-team-total"></strong>';

 const profitBox=document.createElement('section');
 profitBox.id='amc-profit-step';
 profitBox.className='panel';
 profitBox.style.cssText='margin:16px 12px;padding:16px';
 profitBox.innerHTML='<h2>5. Rentabilidad interna</h2><p class="small muted">Primero revisá los trabajos y tus costos. AMC calcula la rentabilidad con el precio actual.</p><div id="price-margin-summary"></div><div class="form-grid"><label>Margen objetivo (%)<input id="desired-margin" type="number" min="0" max="95" step="1" value="30"></label><div><span class="small muted" id="suggested-label">Precio mínimo sugerido</span><strong id="suggested-price" style="display:block"></strong></div><button type="button" id="use-suggested-price" class="btn"></button></div>';

 const finalPriceBox=document.createElement('section');
 finalPriceBox.id='amc-final-price-step';
 finalPriceBox.className='panel';
 finalPriceBox.style.cssText='margin:16px 12px;padding:16px';
 finalPriceBox.innerHTML='<h2>6. Precio final al cliente</h2><p>Se completa automáticamente con la suma de los trabajos agregados. Podés editarlo si querés redondear, hacer un descuento o cobrar un adicional.</p><div class="form-grid"><div><span class="small muted">Total calculado por trabajos</span><strong id="automatic-client-price" style="display:block;font-size:22px"></strong></div><label>Precio final editable<input id="final-client-price" type="text" inputmode="numeric" autocomplete="off" placeholder="$ 517.000"></label><div style="align-self:end"><button type="button" id="reset-client-price" class="btn">Usar total calculado</button></div></div><p id="final-price-mode" class="small muted"></p>';

 const quoteView=document.getElementById('view-quote');
 const addView=document.getElementById('view-add');
 const worksCard=document.getElementById('quote-items')?.closest('.card');

 if(embedded&&appRoot&&quoteView&&addView&&worksCard){
   appRoot.insertBefore(banner,quoteView);
   appRoot.insertBefore(addView,quoteView);
   appRoot.insertBefore(worksCard,quoteView);
   appRoot.insertBefore(teamBox,quoteView);
   appRoot.insertBefore(profitBox,quoteView);
   appRoot.insertBefore(finalPriceBox,quoteView);
   const quoteLeft=quoteView.querySelector('.grid > div:first-child');
   if(quoteLeft)quoteLeft.hidden=true;
 }else{
   document.body.prepend(banner);
   banner.after(teamBox);
   teamBox.after(profitBox);
   profitBox.after(finalPriceBox);
 }

 const teamCost=()=>((draft.amcEstimatedTeam||[]).reduce((sum,x)=>sum+(Number(x.days||0)*Number(x.dailyCost||0)),0));
 const workSubtotal=q=>(q.items||[]).reduce((sum,item)=>sum+Number(item.clientCharge||0),0);
 const usesManualPrice=q=>q.amcPriceManual===true||(q.amcPriceManual==null&&Number(q.amcClientPrice)>0);
 const commercialPrice=q=>{
   const override=Number(q.amcClientPrice);
   return usesManualPrice(q)&&Number.isFinite(override)&&override>0?override:workSubtotal(q);
 };

 const originalQuoteTotals=quoteTotals;
 quoteTotals=function(q=draft){
   const total=originalQuoteTotals(q),team=q.amcEstimatedTeam||[],sale=commercialPrice(q);
   if(!team.length)return {sale,cost:total.cost};
   const legacy=(q.items||[]).reduce((sum,it)=>{
     const d=it.details||{},workers=Math.max(1,Number(d.workers||1));
     return sum+(it.method==='m2'
       ?Math.max(1,Number(d.m2Days||1))*workers*Number(db.settings.employeeDay||0)
       :jornalTier(Number(d.hours||0)).days*workers*Number(db.settings.employeeDay||0));
   },0);
   const personnel=team.reduce((sum,x)=>sum+(Number(x.days||0)*Number(x.dailyCost||0)),0);
   return {sale,cost:Math.max(0,total.cost-legacy)+personnel};
 };

 const clientTotal=q=>quoteTotals(q).sale;
 const quoteForDocument=q=>({...q,total:clientTotal(q)});
 function suggestedPrice(cost,margin){
   const ratio=Number(margin)/100;
   return ratio>=0&&ratio<1?Number(cost)/(1-ratio):0;
 }

 function renderSuggestedPrice(){
   const input=document.getElementById('final-client-price');
   const subtotal=workSubtotal(draft);
   const totals=quoteTotals(draft);
   const hasFinal=Number(totals.sale)>0;
   const manual=usesManualPrice(draft);
   const goal=Number(document.getElementById('desired-margin').value||0);
   const suggested=suggestedPrice(totals.cost,goal);
   const gain=totals.sale-totals.cost;
   const margin=hasFinal&&totals.sale?gain/totals.sale*100:0;
   const button=document.getElementById('use-suggested-price');
   const summary=document.getElementById('price-margin-summary');
   const autoNode=document.getElementById('automatic-client-price');
   const modeNode=document.getElementById('final-price-mode');

   if(autoNode)autoNode.textContent=money(subtotal);
   if(input&&document.activeElement!==input)input.value=hasFinal?AMCArs.format(totals.sale):'';
   if(modeNode)modeNode.textContent=manual
     ?'Precio final editado manualmente. El subtotal calculado por trabajos queda como referencia.'
     :'Precio final automático: coincide con la suma de los trabajos agregados.';

   document.getElementById('suggested-label').textContent='Precio mínimo sugerido para lograr '+goal+'% de margen';
   document.getElementById('suggested-price').textContent=money(suggested);

   summary.innerHTML=
     '<p><strong>Subtotal de trabajos</strong><br>'+money(subtotal)+'</p>'+
     '<p><strong>Costos estimados</strong><br>Mano de obra: '+money(teamCost())+
     '<br>Otros costos internos: '+money(Math.max(0,totals.cost-teamCost()))+'</p>'+
     '<p><strong>Costo total estimado</strong><br>'+money(totals.cost)+'</p>'+
     (hasFinal
       ?'<p><strong>Precio actual para calcular rentabilidad</strong><br>'+money(totals.sale)+'</p>'+
        '<p><strong>Ganancia estimada</strong><br>'+money(gain)+'</p>'+
        '<p><strong>Margen estimado</strong><br>'+margin.toFixed(2)+'%</p>'
       :'<p><strong>Precio actual</strong><br>Agregá al menos un trabajo con importe.</p>')+
     '<p><strong>Margen objetivo</strong><br>'+goal+'%</p>';

   const reached=hasFinal&&totals.sale>=suggested&&suggested>0;
   button.hidden=reached;
   button.disabled=!suggested||reached||!draft.items.length;
   button.textContent='Usar '+money(suggested)+' como precio final';

   if(hasFinal&&gain<0)summary.insertAdjacentHTML('beforeend','<p><strong>🔴 Este presupuesto deja una pérdida estimada de '+money(Math.abs(gain))+'.</strong></p>');
   else if(reached)summary.insertAdjacentHTML('beforeend','<p><strong>✓ El precio actual alcanza el margen objetivo del '+goal+' %.</strong></p>');
   else if(hasFinal)summary.insertAdjacentHTML('beforeend','<p><strong>⚠ El precio actual está por debajo del margen objetivo.</strong></p>');
 }

 document.addEventListener('amc:draft-updated',event=>{
   renderSuggestedPrice();
   const item=event.detail?.item;
   if(item)toast('✓ '+item+' agregado. El precio final se actualizó automáticamente.');
 }); function renderEstimatedTeam(){const rows=draft.amcEstimatedTeam||[];document.getElementById('estimated-team-list').innerHTML=rows.map((x,i)=>'<div class="form-grid" data-team-row="'+i+'">'+(x.manual?'<label>Función<input data-team-field="name" value="'+esc(x.name)+'"></label>':'<strong>'+esc(x.name)+'</strong>')+'<label>Jornal diario<input type="number" min="0" data-team-field="dailyCost" value="'+Number(x.dailyCost||0)+'"></label><label>Días<input type="number" min="0" step=".5" data-team-field="days" value="'+Number(x.days||0)+'"></label><strong data-team-subtotal>'+money(Number(x.dailyCost||0)*Number(x.days||0))+'</strong><button type="button" data-remove-team="'+i+'">Quitar</button></div>').join('')||'<p>Sin mano de obra estimada.</p>';document.getElementById('estimated-team-total').textContent='Mano de obra: '+money(teamCost());saveDraft();}
 teamBox.addEventListener('input',e=>{const row=e.target.closest('[data-team-row]'),field=e.target.dataset.teamField;if(!row||!field)return;const item=draft.amcEstimatedTeam[Number(row.dataset.teamRow)];item[field]=field==='name'?e.target.value:Number(e.target.value||0);row.querySelector('[data-team-subtotal]').textContent=money(Number(item.dailyCost||0)*Number(item.days||0));document.getElementById('estimated-team-total').textContent='Mano de obra: '+money(teamCost());renderQuote();saveDraft();renderSuggestedPrice();document.dispatchEvent(new Event('click'));});teamBox.addEventListener('click',e=>{if(e.target.dataset.removeTeam!==undefined){draft.amcEstimatedTeam.splice(Number(e.target.dataset.removeTeam),1);renderEstimatedTeam();renderQuote();renderSuggestedPrice();document.dispatchEvent(new Event('click'));}});
 document.getElementById('add-estimated-employee').onclick=()=>{const id=document.getElementById('estimated-employee').value,employee=session?.employees?.find(x=>x.id===id);if(!employee)return;if((draft.amcEstimatedTeam||[]).some(x=>x.employeeId===id)){status().textContent='Ese empleado ya está en el equipo estimado.';return;}draft.amcEstimatedTeam=[...(draft.amcEstimatedTeam||[]),{employeeId:id,name:employee.name,dailyCost:Number(employee.dailyCost||0),days:1}];renderEstimatedTeam();renderQuote();renderSuggestedPrice();};
 document.getElementById('add-manual-labor').onclick=()=>{draft.amcEstimatedTeam=[...(draft.amcEstimatedTeam||[]),{manual:true,name:'Ayudante',dailyCost:0,days:1}];renderEstimatedTeam();renderQuote();renderSuggestedPrice();document.querySelector('#estimated-team-list [data-team-row]:last-child input')?.focus();};
 document.getElementById('desired-margin').addEventListener('input',renderSuggestedPrice);
 document.getElementById('final-client-price').addEventListener('input',e=>{
   const value=AMCArs.parse(e.target.value);
   if(value>0){
     draft.amcClientPrice=value;
     draft.amcPriceManual=true;
   }else{
     delete draft.amcClientPrice;
     draft.amcPriceManual=false;
   }
   saveDraft();
   renderQuote();
   renderSuggestedPrice();
 });
 document.getElementById('final-client-price').addEventListener('blur',e=>{
   const value=clientTotal(draft);
   e.target.value=value>0?AMCArs.format(value):'';
   renderSuggestedPrice();
 });
 document.getElementById('reset-client-price').onclick=()=>{
   delete draft.amcClientPrice;
   draft.amcPriceManual=false;
   saveDraft();
   renderQuote();
   renderSuggestedPrice();
   toast('Precio final restablecido al total calculado por trabajos.');
 };
 document.getElementById('use-suggested-price').onclick=()=>{
   if(!draft.items.length)return;
   const target=suggestedPrice(quoteTotals(draft).cost,document.getElementById('desired-margin').value);
   if(!target)return;
   draft.amcClientPrice=Math.round(target);
   draft.amcPriceManual=true;
   saveDraft();
   renderQuote();
   renderSuggestedPrice();
   status().textContent='Precio sugerido aplicado al total del cliente. Ganancia y margen recalculados.';
   toast('Precio sugerido aplicado al total del cliente.');
 };
if(embedded){banner.style.margin='0 12px 16px';banner.querySelector('a').onclick=e=>{e.preventDefault();window.parent.postMessage({type:'amc:navigate'},location.origin);};}if(window.AMCOnline){banner.querySelector('a').onclick=e=>{e.preventDefault();window.AMCOnline.open();};}
 const callbacks=new Map();window.amcOnlineResponse=(key,ok,value)=>{const pending=callbacks.get(key);if(!pending)return;callbacks.delete(key);clearTimeout(pending.timer);if(ok){try{pending.resolve(JSON.parse(value));}catch{pending.reject(Error('Respuesta inválida.'));}}else pending.reject(Error(value));};
 window.amcSelectRequest=value=>{if(!value)return;const select=document.getElementById('connected-request');if(select)select.value=value;};
 const status=()=>document.getElementById('connection-status'),select=document.getElementById('connected-request');
 const deliveryBox=document.getElementById('external-delivery'),deliveryHelp=document.getElementById('delivery-help');
 const selectedRequest=()=>requests.find(x=>x.id===select.value);
 const currentClient=r=>(session.agendaClients||[]).find(x=>x.id===(r?.leadId||r?.userId));
 const hasAccount=r=>!!r&&!r.leadId;
 function syncClientSummary(){
   const r=selectedRequest(),node=document.getElementById('connected-client-summary');
   if(!node)return;
   node.textContent=r
     ?[r.name,r.town,r.service].filter(Boolean).join(' · ')
     :(draft.client||'Elegí el cliente del presupuesto');
 }
 function syncDeliveryUi(){
   const r=selectedRequest(),registered=hasAccount(r),saved=!!draft.amcQuoteId;
   document.getElementById('send-connected').textContent=registered?'Enviar presupuesto al cliente':'Guardar presupuesto';
   deliveryBox.hidden=registered||!saved;
   document.getElementById('accept-manual').hidden=registered||!saved;
   if(r){
     deliveryHelp.textContent=registered
       ?'El cliente lo recibirá dentro de AMC. Los costos internos no se comparten.'
       :'Cliente sin cuenta AMC. Después de guardar podés compartirlo y registrar la entrega.';
   }
   syncClientSummary();
 }
 async function request(url,body,method='POST'){const visible=method!=='GET';if(visible)window.AMCBusy?.start();try{if(window.AMCOnline)return await new Promise((resolve,reject)=>{const key='c'+Date.now()+Math.random();const timer=setTimeout(()=>{callbacks.delete(key);reject(Error('La conexión tardó demasiado. Volvé a intentar.'));},50000);callbacks.set(key,{resolve,reject,timer});window.AMCOnline.request(method,url,JSON.stringify(body||{}),session?.csrf||'',key);});const r=await fetch(url,{method,credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':session?.csrf||''},...(method==='GET'?{}:{body:JSON.stringify(body||{})})});const j=await r.json();if(!r.ok)throw Error(j.error||'No se pudo completar el envío.');return j;}finally{if(visible)window.AMCBusy?.stop();}}
 async function contentVersion(value){const bytes=new TextEncoder().encode(JSON.stringify(value));return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');}
 try{session=await request('/api/state',null,'GET');if(session.user?.role!=='admin')throw Error('Ingresá con tu cuenta de AMC.');requests=session.requests;document.getElementById('estimated-employee').innerHTML='<option value="">Elegí un empleado</option>'+session.employees.filter(x=>x.active).map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join('');renderEstimatedTeam();renderQuote();renderSuggestedPrice();select.innerHTML='<option value="">Elegí un pedido</option>'+requests.map(r=>`<option value="${esc(r.id)}">${esc(r.name)} · ${esc(r.service)} · ${esc(r.status)}</option>`).join('');const q=window.AMCOnline?window.AMCOnline.selectedRequest():new URLSearchParams(location.search).get('solicitud');if(q)select.value=q;else if(draft.amcRequestId)select.value=draft.amcRequestId;status().textContent='Conectado como '+session.user.name+'.';syncDeliveryUi();}catch(e){status().textContent=e.message;document.getElementById('send-connected').disabled=true;return;}
 const visitInfo=document.createElement('div');banner.append(visitInfo);function showRubrics(){const r=requests.find(x=>x.id===select.value),rubrics=r?.rubrics||[];document.getElementById('suggested-rubrics').innerHTML=rubrics.length?'<p><strong>Rubros sugeridos:</strong> '+rubrics.map(x=>'<button type="button" data-rubric="'+esc(x)+'">'+esc(x)+'</button>').join(' ')+' <button type="button" data-rubric="">Ver todo el tarifario</button></p>':'';}document.getElementById('suggested-rubrics').onclick=e=>{if(e.target.dataset.rubric===undefined)return;const category=document.getElementById('tariff-cat');if(category){category.value=e.target.dataset.rubric;category.dispatchEvent(new Event('change'));nav('add');document.getElementById('tariff-search')?.focus();}}; function showVisitInfo(){const sheets=(session.visitSheets||[]).filter(x=>x.requestId===select.value);visitInfo.innerHTML=sheets.length?'<details><summary>Fichas de visita del equipo · sólo AMC</summary>'+sheets.map(x=>'<h3>'+esc(x.employeeName)+' · '+esc(x.day)+'</h3><p><strong>Trabajo:</strong> '+esc(x.scope)+'</p><p><strong>Medidas:</strong> '+esc(x.measurements)+'</p><p><strong>Materiales:</strong> '+esc(x.materials)+'</p><p><strong>Acceso:</strong> '+esc(x.access)+'</p><p><strong>Observaciones:</strong> '+esc(x.observations)+'</p>').join('')+'</details>':'';}select.addEventListener('change',()=>{showVisitInfo();showRubrics();});showVisitInfo();showRubrics();
 async function importRequest(confirmExisting=true){const r=requests.find(x=>x.id===select.value);if(!r){status().textContent='Elegí una solicitud.';return;}if(confirmExisting&&draft.items?.length&&!await window.AMCConfirm('Se va a crear un nuevo borrador. Guardá el actual si querés conservarlo. ¿Continuar?',{title:'Cambiar presupuesto',confirmLabel:'Crear nuevo borrador'}))return;draft=newDraft();draft.validity=10;draft.amcRequestId=r.id;const contact=currentClient(r);draft.client=contact?.name||r.name;draft.phone=contact?.phone||r.phone;draft.location=contact?.town||r.town;draft.address=r.address||contact?.address||'';const requestDescription=String(r.description||'').trim(),internalAdminNote=/^Presupuesto iniciado por Administración\.?$/i.test(requestDescription);draft.notes=internalAdminNote?'':'El cliente solicitó: '+(r.services||[r.service]).join(', ')+(requestDescription?'. '+requestDescription:'');draft.amcSuggestedRubrics=r.rubrics||[];draft.amcEstimatedTeam=[];delete draft.amcClientPrice;draft.amcPriceManual=false;delete draft.amcQuoteId;saveDraft();loadDraftToForm();renderEstimatedTeam();renderQuote();renderSuggestedPrice();syncDeliveryUi();notifyDraftUpdated();nav('add');document.getElementById('tariff-search')?.focus();status().textContent='Cliente cargado. Agregá los trabajos y continuá con los costos.';}
 function loadQuoteForEdit(quoteId){
   const storedQuote=(session.quotes||[]).find(q=>q.id===quoteId);
   if(!storedQuote){status().textContent='No encontramos ese presupuesto guardado.';return false;}
   const r=requests.find(x=>x.id===storedQuote.requestId);
   if(!r){status().textContent='No encontramos la solicitud de este presupuesto.';return false;}
   let saved=(db.quotes||[]).find(q=>q.id===storedQuote.externalId);
   if(saved){
     draft=structuredClone(saved);
   }else{
     draft=newDraft();
     draft.id=storedQuote.externalId||draft.id;
     draft.number=storedQuote.number||draft.number;
     draft.items=(storedQuote.items||[]).map((it,index)=>({
       id:'recovered_'+index,
       taskName:it.description||'Trabajo',
       clientDescription:it.description||'Trabajo',
       method:'recovered',
       clientCharge:index===0?Number(storedQuote.total||0):0,
       internalCost:index===0?Number(storedQuote.internalCost||0):0,
       details:{}
     }));
     draft.amcClientPrice=Number(storedQuote.total||0);
     draft.amcPriceManual=true;
     draft.amcEstimatedTeam=storedQuote.estimatedTeam||[];
   }
   draft.amcRequestId=r.id;
   draft.amcQuoteId=storedQuote.id;
   const contact=currentClient(r);
   draft.client=contact?.name||r.name||draft.client;
   draft.phone=contact?.phone||r.phone||draft.phone;
   draft.location=contact?.town||r.town||draft.location;
   draft.address=r.address||contact?.address||draft.address||'';
   draft.validity=10;
   if(!(Number(clientTotal(draft))>0)&&Number(storedQuote.total)>0){
     draft.amcClientPrice=Number(storedQuote.total);
     draft.amcPriceManual=true;
   }
   saveDraft();
   loadDraftToForm();
   select.value=r.id;
   renderEstimatedTeam();
   renderQuote();
   renderSuggestedPrice();
   syncDeliveryUi();
   notifyDraftUpdated();
   status().textContent=saved?'Presupuesto '+(draft.number||'')+' cargado para editar.':'Presupuesto recuperado para editar. Revisá el detalle antes de volver a guardarlo.';
   return true;
 }
 async function generatePendingPdf(quoteId){
   const storedQuote=(session.quotes||[]).find(q=>q.id===quoteId);
   if(!storedQuote)throw Error('No encontramos el presupuesto para generar el PDF.');
   if(storedQuote.pdf){
     if(embedded)window.parent.postMessage({type:'amc:pdf-ready',quoteId},location.origin);
     return;
   }
   window.AMCBusy?.start();
   try{
     status().textContent='Generando PDF…';
     const blob=await makePdf(quoteForDocument(draft)),
           uploaded=await request('/api/upload',{mime:'application/pdf',base64:await blobToBase64(blob)}),
           attached=await request('/api/quotes/'+quoteId+'/pdf',{pdfId:uploaded.id});
     storedQuote.pdf=attached.pdf;
     storedQuote.pdfPending=false;
     status().textContent='PDF generado y vinculado al presupuesto.';
     if(embedded)window.parent.postMessage({type:'amc:pdf-ready',quoteId,pdf:attached.pdf},location.origin);
   }catch(error){
     console.error('No se pudo generar el PDF pendiente.',error);
     status().textContent='El presupuesto sigue guardado. El PDF no se pudo generar.';
     await window.AMCConfirm(error.message||'No se pudo generar el PDF. El presupuesto sigue guardado.',{title:'No pudimos generar el PDF',confirmLabel:'Entendido',singleAction:true});
   }finally{
     window.AMCBusy?.stop();
   }
 }
 document.getElementById('import-request').onclick=()=>importRequest(true);select.addEventListener('change',syncDeliveryUi);
 const editParams=new URLSearchParams(location.search),editQuoteId=editParams.get('quote');
 const editLoaded=editQuoteId?loadQuoteForEdit(editQuoteId):false;
 if(!editQuoteId&&editParams.get('solicitud'))importRequest(false);
 if(editLoaded&&editParams.get('generatePdf')==='1')setTimeout(()=>generatePendingPdf(editQuoteId),0);
 document.getElementById('send-connected').onclick=async function(){this.disabled=true;let processing=false;try{const r=selectedRequest();if(!r)throw Error('Elegí el pedido que corresponde a este presupuesto.');if(draft.amcRequestId!==r.id)throw Error('Usá primero “Usar datos del pedido” para vincular correctamente el presupuesto.');const registered=hasAccount(r),action=registered?'enviar':'guardar';draft.validity=10;if(validityField)validityField.value=10;if(!persistCurrentSilently())throw Error('Agregá al menos un trabajo al presupuesto.');if(!(clientTotal(draft)>0))throw Error('Agregá trabajos con un importe válido antes de '+action+' el presupuesto.');if(!await window.AMCConfirm('¿'+(registered?'Enviar':'Guardar')+' el presupuesto '+draft.number+' para '+r.name+' por '+money(clientTotal(draft))+'?',{title:registered?'Enviar presupuesto':'Guardar presupuesto',confirmLabel:registered?'Enviar':'Guardar'}))return;window.AMCBusy?.start();processing=true;
 const totals=quoteTotals(draft),publicQuote={requestId:r.id,externalId:draft.id,number:draft.number,items:draft.items.map(it=>({description:it.clientDescription})),total:clientTotal(draft),validity:'10',payment:draft.payment||db.settings.payment,notes:draft.notes||'',estimatedTeam:draft.amcEstimatedTeam||[],personnelCost:teamCost(),internalCost:totals.cost,grossMargin:clientTotal(draft)-totals.cost};
 publicQuote.version=await contentVersion(publicQuote);const sent=await request('/api/quotes',publicQuote);if(!['Enviado','Guardado'].includes(sent.status))throw Error('No se pudo '+action+' este presupuesto.');draft.amcQuoteId=sent.id;persistCurrentSilently();let pdfPending=true;try{const blob=await makePdf(quoteForDocument(draft)),uploaded=await request('/api/upload',{mime:'application/pdf',base64:await blobToBase64(blob)});await request('/api/quotes/'+sent.id+'/pdf',{pdfId:uploaded.id});pdfPending=false;}catch(pdfError){console.error('El presupuesto quedó guardado, pero el PDF quedó pendiente.',pdfError);}syncDeliveryUi();status().textContent=registered?(pdfPending?'Presupuesto enviado. PDF pendiente de generar.':'Presupuesto enviado. El cliente ya puede verlo y responder desde su cuenta.'):(pdfPending?'Presupuesto guardado. PDF pendiente de generar.':'Presupuesto guardado. Compartilo o registrá su entrega.');if(embedded)window.parent.postMessage({type:registered?'amc:sent':'amc:saved',quoteId:sent.id,clientName:r.name,pdfPending},location.origin);
 }catch(e){status().textContent=e.message;}finally{if(processing)window.AMCBusy?.stop();this.disabled=false;}};
 document.getElementById('share-whatsapp').onclick=()=>{const r=selectedRequest(),contact=currentClient(r),rawPhone=contact?.phone||r?.phone;if(!rawPhone)throw Error('Este cliente no tiene teléfono para compartir por WhatsApp.');const raw=String(rawPhone).replace(/\D/g,'').replace(/^0+/,'');const phone=raw.startsWith('549')?raw:raw.startsWith('54')?'549'+raw.slice(2):'549'+raw,message='Hola '+(contact?.name||r.name)+', te compartimos el presupuesto '+draft.number+' de AMC Construcciones y Arreglos. Total: '+money(clientTotal(draft))+'. Quedamos atentos a cualquier consulta.';window.open('https://wa.me/'+phone+'?text='+encodeURIComponent(message),'_blank','noopener');};
 document.getElementById('mark-delivered').onclick=async function(){if(!draft.amcQuoteId)return;this.disabled=true;try{const channel=document.getElementById('delivery-channel').value;await request('/api/quotes/'+draft.amcQuoteId+'/deliver',{channel});status().textContent='Entrega registrada por '+channel+'.';document.getElementById('accept-manual').hidden=false;}catch(e){status().textContent=e.message;}finally{this.disabled=false;}};
 document.getElementById('accept-manual').onclick=async function(){if(!draft.amcQuoteId)return;if(!await window.AMCConfirm('¿Confirmás que el cliente aceptó este presupuesto? Se creará la obra una sola vez.',{title:'Confirmar aceptación',confirmLabel:'Aceptar presupuesto'}))return;this.disabled=true;try{const accepted=await request('/api/quotes/'+draft.amcQuoteId+'/accept-manual',{});status().textContent='Se creó la obra.';if(embedded)window.parent.postMessage({type:'amc:accepted',quoteId:draft.amcQuoteId,workId:accepted.workId},location.origin);}catch(e){status().textContent=e.message;}finally{this.disabled=false;}};
})();
