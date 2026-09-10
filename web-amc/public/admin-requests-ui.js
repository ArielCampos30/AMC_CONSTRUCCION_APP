export function createAdminRequestsUI({getState,getFilter,adminChip,adminBadge,quoteCanEdit,quoteCanRevise,heading,esc,date,empty}){
 const render=()=>{
  const state=getState(),filter=getFilter(),
   match=request=>filter==='Todas'||filter==='Nuevas'&&request.status==='Nueva'||filter==='Revisando'&&request.status==='En contacto'||filter==='Visita pendiente'&&['Visita pendiente','Visita confirmada'].includes(request.status)||filter==='Presupuestadas'&&['Presupuestada','Presupuesto aceptado'].includes(request.status)||filter==='No tomadas'&&request.status==='No tomada',
   rows=(state.requests||[]).filter(match);
  return heading('ENTRADAS','Solicitudes','Las que necesitan una decisión aparecen primero.')+`<nav class="admin-v3-chips">${['Nuevas','Revisando','Visita pendiente','Presupuestadas','No tomadas','Todas'].map(value=>adminChip(value,'request',filter)).join('')}</nav><section class="admin-v3-list">${rows.map(request=>{
   const quotes=(state.quotes||[]).filter(quote=>quote.requestId===request.id),latest=quotes.at(-1),work=(state.works||[]).find(item=>item.requestId===request.id),
    openActions=work?`<a href="#obra-admin/${encodeURIComponent(work.id)}">Ver obra</a>`:request.status==='No tomada'?'':[
     `<button data-action="visit-admin" data-id="${request.id}">Coordinar visita</button>`,
     !latest?`<button data-action="editor" data-id="${request.id}">Crear presupuesto</button>`:quoteCanEdit(latest)?`<button data-action="editor" data-id="${request.id}" data-quote="${latest.id}">Editar presupuesto</button>`:quoteCanRevise(latest)?`<button data-action="editor" data-id="${request.id}">Nuevo presupuesto</button>`:'',
     !quotes.length?`<button data-action="decline-admin" data-id="${request.id}">No tomar trabajo</button>`:''
    ].filter(Boolean).join('');
   return `<article class="admin-v3-card"><div class="title-row"><div><h2>${esc(request.name)}</h2><p>${esc(request.description.slice(0,130))}</p></div>${adminBadge(request.status)}</div><div class="admin-v3-meta"><span>${esc((request.services||[request.service]).filter(Boolean).join(' · '))}</span><span>${esc(request.town)}</span><span>${date(request.date)}</span><span>${(request.photos||[]).length} fotos</span></div>${request.statusReason?`<p class="admin-v3-reason"><strong>${esc(request.statusReason)}</strong>${request.statusComment?' · '+esc(request.statusComment):''}</p>`:''}<div class="admin-v3-actions"><a class="primary" href="#solicitud/${encodeURIComponent(request.id)}">Ver solicitud</a>${openActions?`<details><summary>⋮</summary><div>${openActions}</div></details>`:''}</div></article>`;
  }).join('')||empty('No hay solicitudes en esta lista','Cuando llegue una solicitud con este estado aparecerá aquí.')}</section>`;
 };
 return {render};
}
