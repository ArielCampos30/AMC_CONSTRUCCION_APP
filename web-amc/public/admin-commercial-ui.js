const PERIODS=Object.freeze([
 ['7','7 días'],['30','30 días'],['90','90 días'],['todo','Todo']
]);
const SENT_STATUSES=new Set(['Enviado','Entregado','Aceptado','Rechazado','Vencido','Cambios solicitados']);
const CLOSED_REQUESTS=new Set(['Cerrada','Cancelada']);
const quoteWhen=quote=>quote?.repliedAt||quote?.deliveredAt||quote?.sentAt||quote?.updatedAt||quote?.date||'';
const requestWhen=request=>request?.updatedAt||request?.statusUpdatedAt||request?.date||'';
const normalizePage=page=>String(page||'').replace(/^#/,'').split('?')[0];
const requestIdFor=item=>item?.requestId||item?.solicitudId||'';
const workForRequest=(works,requestId)=>works.find(work=>requestIdFor(work)===requestId)||null;
const quotesForRequest=(quotes,requestId)=>quotes.filter(quote=>requestIdFor(quote)===requestId).sort((a,b)=>String(quoteWhen(a)).localeCompare(String(quoteWhen(b))));
const percent=(value,total)=>total?Math.round(value/total*100):0;
const periodDays=period=>period==='todo'?null:Number(period)||30;
const periodStart=(days,now)=>days===null?null:now-days*24*60*60*1000;
const validDate=value=>{const parsed=Date.parse(value||'');return Number.isFinite(parsed)?parsed:null;};
const inPeriod=(request,days,now)=>{const start=periodStart(days,now);if(start===null)return true;const stamp=validDate(request?.date);return stamp===null?true:stamp>=start;};
const sourceFor=request=>{
 if(request?.source==='landing'||request?.createdBy==='landing')return 'Landing web';
 if(request?.createdBy||request?.leadId)return 'Carga manual';
 return 'Cliente AMC';
};
const campaignFor=request=>{
 if(sourceFor(request)!=='Landing web')return '';
 const campaign=String(request?.utmCampaign||'').trim(),source=String(request?.utmSource||'').trim(),medium=String(request?.utmMedium||'').trim();
 if(!campaign&&!source&&!medium)return '';
 return [campaign||source||medium,source&&source!==campaign?source:'',medium&&medium!==campaign?medium:''].filter(Boolean).join(' · ');
};
const followupFor=(request,latestQuote,work)=>{
 if(work||latestQuote?.status==='Aceptado')return null;
 if(request?.status==='No tomada')return {label:'No tomada',tone:'lost'};
 if(latestQuote?.status==='Cambios solicitados')return {label:'Cambios solicitados',tone:'urgent'};
 if(latestQuote?.status==='Enviado'||latestQuote?.status==='Entregado')return {label:'Esperando respuesta',tone:'waiting'};
 if(latestQuote?.status==='Guardado')return {label:'Presupuesto sin entrega',tone:'urgent'};
 if(latestQuote?.status==='Vencido')return {label:'Presupuesto vencido',tone:'lost'};
 if(latestQuote?.status==='Rechazado')return {label:'Rechazado',tone:'lost'};
 if(!latestQuote&&!CLOSED_REQUESTS.has(request?.status))return {label:'Sin presupuesto',tone:'urgent'};
 return null;
};

export function commercialPeriodFromPage(page='comercial'){
 const normalized=normalizePage(page),raw=normalized.startsWith('comercial/')?normalized.slice('comercial/'.length):'30';
 return PERIODS.some(([value])=>value===raw)?raw:'30';
}

export function buildCommercialModel(state={},options={}){
 const period=options.period||commercialPeriodFromPage(options.page),days=periodDays(period),now=Number(options.now||Date.now()),quotes=Array.isArray(state.quotes)?state.quotes:[],works=Array.isArray(state.works)?state.works:[];
 const requests=(Array.isArray(state.requests)?state.requests:[]).filter(request=>inPeriod(request,days,now));
 const opportunities=requests.map(request=>{
  const related=quotesForRequest(quotes,request.id),latestQuote=related.at(-1)||null,work=workForRequest(works,request.id),source=sourceFor(request),campaign=campaignFor(request),quoted=related.length>0,sent=related.some(quote=>SENT_STATUSES.has(quote.status)),accepted=!!work||related.some(quote=>quote.status==='Aceptado'),won=!!work,followup=followupFor(request,latestQuote,work);
  return {request,quotes:related,latestQuote,work,source,campaign,quoted,sent,accepted,won,followup};
 });
 const total=opportunities.length,quoted=opportunities.filter(item=>item.quoted).length,sent=opportunities.filter(item=>item.sent).length,accepted=opportunities.filter(item=>item.accepted).length,won=opportunities.filter(item=>item.won).length;
 const funnel=[
  {key:'consultas',label:'Consultas',count:total,conversion:total?100:0},
  {key:'presupuestadas',label:'Presupuestadas',count:quoted,conversion:percent(quoted,total)},
  {key:'enviadas',label:'Presupuestos enviados',count:sent,conversion:percent(sent,total)},
  {key:'aceptadas',label:'Aceptados',count:accepted,conversion:percent(accepted,total)},
  {key:'ganadas',label:'Obras ganadas',count:won,conversion:percent(won,total)}
 ];
 const sourceMap=new Map();
 for(const item of opportunities){const current=sourceMap.get(item.source)||{label:item.source,count:0,quoted:0,won:0};current.count++;if(item.quoted)current.quoted++;if(item.won)current.won++;sourceMap.set(item.source,current);}
 const sources=[...sourceMap.values()].map(item=>({...item,conversion:percent(item.won,item.count)})).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label));
 const campaignMap=new Map();
 for(const item of opportunities.filter(item=>item.campaign)){const current=campaignMap.get(item.campaign)||{label:item.campaign,count:0,won:0};current.count++;if(item.won)current.won++;campaignMap.set(item.campaign,current);}
 const campaigns=[...campaignMap.values()].map(item=>({...item,conversion:percent(item.won,item.count)})).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label));
 const priority={urgent:0,waiting:1,lost:2};
 const followups=opportunities.filter(item=>item.followup).sort((a,b)=>(priority[a.followup.tone]??9)-(priority[b.followup.tone]??9)||String(requestWhen(b.request)).localeCompare(String(requestWhen(a.request))));
 return {period,funnel,sources,campaigns,followups,total};
}

export function createAdminCommercialUI({getState,heading,esc,date}){
 const periodLinks=period=>`<nav class="commercial-periods" aria-label="Período">${PERIODS.map(([value,label])=>`<a href="#comercial/${value}" class="${value===period?'active':''}" ${value===period?'aria-current="page"':''}>${label}</a>`).join('')}</nav>`;
 const clientName=item=>esc(item.request?.name||'Cliente');
 const serviceName=item=>esc((item.request?.services||[item.request?.service]).filter(Boolean).join(' · ')||'Trabajo');
 const followupLink=item=>item.latestQuote?`#presupuesto-admin/${encodeURIComponent(item.latestQuote.id)}`:`#solicitud/${encodeURIComponent(item.request.id)}`;
 const followupMeta=item=>[item.source,item.campaign,item.request?.town].filter(Boolean).map(esc).join(' · ');
 function render(page='comercial'){
  const model=buildCommercialModel(getState(),{page}),periodLabel=PERIODS.find(([value])=>value===model.period)?.[1]||'30 días';
  return heading('COMERCIAL AMC','Embudo comercial','Consultas, presupuestos y obras ganadas a partir de oportunidades reales.')+
   `<section class="commercial-toolbar"><div><strong>Período analizado</strong><span>${esc(periodLabel)}</span></div>${periodLinks(model.period)}</section>`+
   `<section class="commercial-funnel">${model.funnel.map(stage=>`<article><span>${esc(stage.label)}</span><strong>${stage.count}</strong><small>${stage.conversion}% de las consultas</small></article>`).join('')}</section>`+
   `<section class="commercial-grid"><article class="panel"><div class="title-row"><h2>Origen de las consultas</h2><small>${model.total} oportunidades</small></div>${model.sources.length?`<div class="commercial-source-list">${model.sources.map(source=>`<div><span><strong>${esc(source.label)}</strong><small>${source.quoted} presupuestadas · ${source.won} ganadas</small></span><b>${source.count}</b><em>${source.conversion}% conversión</em></div>`).join('')}</div>`:'<p class="muted">Todavía no hay consultas en este período.</p>'}</article>`+
   `<article class="panel"><div class="title-row"><h2>Campañas de landing</h2><small>UTM registradas</small></div>${model.campaigns.length?`<div class="commercial-source-list">${model.campaigns.map(campaign=>`<div><span><strong>${esc(campaign.label)}</strong><small>${campaign.won} obras ganadas</small></span><b>${campaign.count}</b><em>${campaign.conversion}% conversión</em></div>`).join('')}</div>`:'<p class="muted">Las consultas de landing sin parámetros UTM siguen contabilizadas en “Landing web”.</p>'}</article></section>`+
   `<section class="commercial-followup"><div class="title-row"><div><h2>Seguimiento comercial</h2><p class="muted">Oportunidades que todavía merecen revisión.</p></div><strong>${model.followups.length}</strong></div>${model.followups.length?`<div class="commercial-followup-list">${model.followups.map(item=>`<a href="${followupLink(item)}" data-tone="${esc(item.followup.tone)}"><span class="commercial-status">${esc(item.followup.label)}</span><div><strong>${clientName(item)}</strong><small>${serviceName(item)}${followupMeta(item)?' · '+followupMeta(item):''}</small></div><time>${esc(date(requestWhen(item.request)))}</time><b>›</b></a>`).join('')}</div>`:'<p class="muted">No hay oportunidades pendientes de seguimiento en este período.</p>'}</section>`+
   `<a class="inline-action" href="#mas-admin">← Volver a Más</a>`;
 }
 return {render};
}
