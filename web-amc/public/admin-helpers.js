export function createAdminHelpers({getState,esc}){
 const chip=(label,group,current)=>`<button data-admin-filter="${group}" data-value="${esc(label)}" aria-pressed="${label===current}">${esc(label)}</button>`;
 const badge=value=>`<span class="admin-v3-badge" data-status="${esc(value)}">${esc(value)}</span>`;
 const request=id=>getState().requests.find(r=>r.id===id)||{};
 const clientSource=()=>{const state=getState();return state.agendaClients||state.clients||[];};
 const client=id=>clientSource().find(c=>c.id===id&&c.hasAccount!==0)||{};
 const agendaClient=id=>clientSource().find(c=>c.id===id)||null;
 const requestContact=r=>agendaClient(r?.leadId||r?.userId)||r||{};
 const latestClosureFor=workId=>(getState().closures||[]).filter(c=>c.workId===workId).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')))[0];
 const closureNeedsAction=w=>w?.status==='Finalizado'&&(!latestClosureFor(w.id)||latestClosureFor(w.id).status==='Observaciones');
 const quoteCanEdit=q=>['Guardado','Entregado','Enviado','Cambios solicitados'].includes(q?.status);
 const quoteCanRevise=q=>['Rechazado','Vencido'].includes(q?.status);
 return {chip,badge,request,client,agendaClient,requestContact,latestClosureFor,closureNeedsAction,quoteCanEdit,quoteCanRevise};
}
