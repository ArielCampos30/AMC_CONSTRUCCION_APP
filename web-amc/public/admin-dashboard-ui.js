export function createAdminDashboardUI({getState,heading,closureNeedsAction}){
 return function dashboard(){
  const state=getState(),
   waiting=(state.quotes||[]).filter(quote=>quote.status==='Enviado').length,
   unscheduled=(state.works||[]).filter(work=>work.status==='Presupuesto aceptado').length,
   inProgress=(state.works||[]).filter(work=>work.status==='En ejecución').length,
   toClose=(state.works||[]).filter(closureNeedsAction).length,
   waitingClient=(state.closures||[]).filter(closure=>closure.status==='Pendiente de conformidad').length,
   unread=Object.values(state.clientChatUnread||state.chatUnread||{}).reduce((total,count)=>total+count,0),
   attention=[
    ['Solicitudes nuevas',(state.requests||[]).filter(request=>request.status==='Nueva').length,'solicitudes'],
    ['Presupuestos esperando respuesta',waiting,'presupuestos'],
    ['Presupuestos aceptados sin programar',unscheduled,'obras'],
    ['Obras en curso',inProgress,'obras'],
    ['Cierres pendientes de AMC',toClose,'obras'],
    ['Cierres esperando cliente',waitingClient,'cierre'],
    ['Mensajes sin leer',unread,'chat-admin']
   ];
  return heading('ADMINISTRACIÓN AMC','Qué atender ahora','Abrí un pendiente y entrá directo al trabajo.')+`<section class="admin-v3-attention">${attention.map(([title,count,page])=>`<a href="#${page}"><strong>${count}</strong><span>${title}</span><small>Revisar →</small></a>`).join('')}</section><h2 class="admin-v3-title">Acciones rápidas</h2><nav class="admin-v3-quick"><button data-action="manual-admin">＋ Nuevo presupuesto</button><button data-action="register-request-admin">＋ Registrar solicitud</button></nav>`;
 };
}
