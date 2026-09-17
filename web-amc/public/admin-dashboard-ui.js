export function createAdminDashboardUI({getState,heading,closureNeedsAction,esc=String,date=value=>value||''}){
 const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const latestDate=(...values)=>values.filter(Boolean).sort().at(-1)||'';
 const requestLabel=request=>(request.services||[request.service]).filter(Boolean).join(' · ')||'Trabajo';
 const clientForRequest=(state,request)=>{const id=request?.leadId||request?.userId;return (state.agendaClients||state.clients||[]).find(client=>client.id===id)||null;};
 const clientForRequestId=(state,requestId)=>clientForRequest(state,(state.requests||[]).find(request=>request.id===requestId));
 function allSearchRows(state){
  const rows=[],add=(kind,title,meta,href,search)=>rows.push({kind,title,meta,href,search:normalize(search)});
  for(const client of state.agendaClients||state.clients||[])add('Cliente',client.name||'Cliente',[client.phone,client.email,client.town].filter(Boolean).join(' · '),'#cliente/'+encodeURIComponent(client.id),[client.id,client.name,client.phone,client.email,client.town,client.address].join(' '));
  for(const request of state.requests||[])add('Solicitud',request.name||'Solicitud',requestLabel(request)+' · '+(request.status||'Sin estado'),'#solicitud/'+encodeURIComponent(request.id),[request.id,request.name,request.phone,request.town,request.address,request.service,...(request.services||[]),request.description,request.status].join(' '));
  for(const quote of state.quotes||[]){const client=clientForRequestId(state,quote.requestId);add('Presupuesto',quote.number||'Presupuesto',[(client?.name||''),quote.status].filter(Boolean).join(' · '),'#presupuesto-admin/'+encodeURIComponent(quote.id),[quote.id,quote.number,quote.status,quote.requestId,client?.name,client?.phone].join(' '));}
  for(const work of state.works||[]){const client=clientForRequestId(state,work.requestId);add('Obra',work.title||client?.name||'Obra',[(client?.name||''),work.status].filter(Boolean).join(' · '),'#obra-admin/'+encodeURIComponent(work.id),[work.id,work.title,work.status,work.requestId,client?.name,client?.phone].join(' '));}
  return rows;
 }
 function searchRows(state,query){const term=normalize(query);return term.length<2?[]:allSearchRows(state).filter(row=>row.search.includes(term)).slice(0,14);}
 const resultMarkup=row=>`<a class="admin-global-search-row" href="${row.href}" data-admin-search-row data-search="${esc(row.search)}" hidden><span class="admin-search-type">${esc(row.kind)}</span><strong>${esc(row.title)}</strong><small>${esc(row.meta||'')}</small><b>→</b></a>`;
 function searchIndexMarkup(state){return `<p class="muted admin-global-search-hint" data-admin-search-hint>Escribí al menos 2 caracteres para buscar.</p>${allSearchRows(state).map(resultMarkup).join('')}`;}
 function activityRows(state){
  const rows=[],push=(when,title,meta,href,kind)=>{if(when)rows.push({when,title,meta,href,kind});};
  for(const request of state.requests||[])push(latestDate(request.cancelledAt,request.updatedAt,request.date),'Solicitud · '+(request.name||'Cliente'),requestLabel(request)+' · '+(request.status||'Sin estado'),'#solicitud/'+encodeURIComponent(request.id),'Solicitud');
  for(const quote of state.quotes||[]){const client=clientForRequestId(state,quote.requestId);push(latestDate(quote.repliedAt,quote.sentAt,quote.seenAt,quote.updatedAt,quote.date),(quote.number||'Presupuesto')+' · '+(client?.name||'Cliente'),quote.status||'Sin estado','#presupuesto-admin/'+encodeURIComponent(quote.id),'Presupuesto');}
  for(const work of state.works||[]){const client=clientForRequestId(state,work.requestId);push(latestDate(work.assignedTeamUpdatedAt,work.updatedAt,work.date),work.title||client?.name||'Obra',work.status||'Sin estado','#obra-admin/'+encodeURIComponent(work.id),'Obra');}
  for(const appointment of state.appointments||[]){const event=(appointment.history||[]).at(-1)||{};const request=(state.requests||[]).find(item=>item.id===appointment.requestId);push(latestDate(event.date,appointment.updatedAt,appointment.date),'Visita · '+(appointment.clientName||request?.name||'Cliente'),appointment.status||event.status||'Sin estado','#agenda','Visita');}
  for(const sheet of state.visitSheets||[])push(latestDate(sheet.reviewedAt,sheet.updatedAt,sheet.date),'Relevamiento · '+(sheet.clientName||'Cliente'),sheet.status||'Sin estado','#fichas','Relevamiento');
  for(const material of state.materialRequests||[]){const event=(material.history||[]).at(-1)||{};push(latestDate(event.date,material.updatedAt,material.date),'Materiales · '+(material.clientName||'Cliente'),material.status||'Sin estado','#materiales','Materiales');}
  for(const receipt of state.receipts||[])push(latestDate(receipt.reviewedAt,receipt.updatedAt,receipt.date),'Comprobante · '+(receipt.reference||'Pago'),receipt.status||'Sin estado','#comprobantes','Pago');
  for(const closure of state.closures||[])push(latestDate(closure.repliedAt,closure.updatedAt,closure.date),'Cierre de obra',closure.status||'Sin estado','#cierre','Cierre');
  for(const deletion of state.accountDeletionRequests||[])push(latestDate(deletion.cancelledAt,deletion.updatedAt,deletion.date),'Privacidad · '+(deletion.name||deletion.email||'Cliente'),deletion.status||'Sin estado','#clientes','Cuenta');
  for(const recovery of state.recoveryRequests||[])push(latestDate(recovery.updatedAt,recovery.date),'Acceso · '+(recovery.name||recovery.email||'Usuario'),recovery.status||'Sin estado','#recuperar-cuentas','Acceso');
  return rows.sort((a,b)=>String(b.when).localeCompare(String(a.when))).slice(0,10);
 }
 function dashboard(){
  const state=getState(),
   waiting=(state.quotes||[]).filter(quote=>quote.status==='Enviado').length,
   unscheduled=(state.works||[]).filter(work=>work.status==='Presupuesto aceptado').length,
   inProgress=(state.works||[]).filter(work=>work.status==='En ejecución').length,
   toClose=(state.works||[]).filter(closureNeedsAction).length,
   waitingClient=(state.closures||[]).filter(closure=>closure.status==='Pendiente de conformidad').length,
   clientUnread=Object.values(state.clientChatUnread||state.chatUnread||{}).reduce((total,count)=>total+Number(count||0),0),
   teamUnread=(state.notices||[]).filter(notice=>!notice.read&&String(notice.url||'').includes('#chat-equipo/')).length,
   visitChanges=(state.appointments||[]).filter(appointment=>appointment.status==='Cambio solicitado').length,
   visitSheets=(state.visitSheets||[]).filter(sheet=>sheet.status==='Pendiente').length,
   materials=(state.materialRequests||[]).filter(request=>['Pendiente','Aprobado','Comprado'].includes(request.status)).length,
   deletionRequests=(state.accountDeletionRequests||[]).filter(request=>request.status==='Pendiente').length,
   attention=[
    ['Solicitudes nuevas',(state.requests||[]).filter(request=>request.status==='Nueva').length,'solicitudes'],
    ['Cambios de visita',visitChanges,'agenda'],
    ['Relevamientos por revisar',visitSheets,'fichas'],
    ['Materiales por resolver',materials,'materiales'],
    ['Presupuestos esperando respuesta',waiting,'presupuestos'],
    ['Presupuestos aceptados sin programar',unscheduled,'obras'],
    ['Obras en curso',inProgress,'obras'],
    ['Cierres pendientes de AMC',toClose,'obras'],
    ['Cierres esperando cliente',waitingClient,'cierre'],
    ['Mensajes de clientes',clientUnread,'chat-admin'],
    ['Mensajes del equipo',teamUnread,'chat-admin'],
    ['Solicitudes de eliminación',deletionRequests,'clientes']
   ],activities=activityRows(state);
  return heading('ADMINISTRACIÓN AMC','Qué atender ahora','Pendientes, búsqueda y actividad reciente desde un solo lugar.')+
   `<section class="admin-v3-attention">${attention.map(([title,count,page])=>`<a href="#${page}" class="${count?'has-pending':''}"><strong>${count}</strong><span>${title}</span><small>${count?'Revisar →':'Sin pendientes'}</small></a>`).join('')}</section>`+
   `<section class="admin-global-search panel"><div><h2>Buscar en AMC</h2><p class="muted">Cliente, teléfono, solicitud, número de presupuesto u obra.</p></div><label class="admin-global-search-field"><span>Buscar</span><input id="admin-global-search-input" type="search" autocomplete="off" placeholder="Ej.: Gómez, 3548, AMC-2026…"></label><div id="admin-global-search-results" class="admin-global-search-results" aria-live="polite">${searchIndexMarkup(state)}</div></section>`+
   `<h2 class="admin-v3-title">Acciones rápidas</h2><nav class="admin-v3-quick"><button data-action="manual-admin">＋ Nuevo presupuesto</button><button data-action="register-request-admin">＋ Registrar solicitud</button></nav>`+
   `<section class="admin-recent-activity"><div class="title-row"><h2 class="admin-v3-title">Actividad reciente</h2><small>Últimos movimientos operativos</small></div>${activities.length?`<div class="admin-activity-list">${activities.map(item=>`<a href="${item.href}"><span class="admin-activity-kind">${esc(item.kind)}</span><div><strong>${esc(item.title)}</strong><small>${esc(item.meta||'')}</small></div><time>${esc(date(item.when))}</time></a>`).join('')}</div>`:'<p class="muted">Todavía no hay movimientos recientes para mostrar.</p>'}</section>`;
 }
 dashboard.searchRows=query=>searchRows(getState(),query);
 dashboard.activityRows=()=>activityRows(getState());
 return dashboard;
}
