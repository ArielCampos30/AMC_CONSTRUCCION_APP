const html=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function createQuotePdfBackground({getState,toast,timeoutMs=60000}){
 const jobs=new Map();
 const state=()=>getState?.()||{};
 const quoteById=id=>(state().quotes||[]).find(quote=>quote.id===id)||null;
 const upsertQuote=quote=>{
  if(!quote?.id)return quote;
  const current=state();
  if(!Array.isArray(current.quotes))current.quotes=[];
  const index=current.quotes.findIndex(item=>item.id===quote.id);
  if(index>=0)current.quotes[index]=quote;else current.quotes.unshift(quote);
  return quote;
 };
 const actionsMarkup=(quote,requestId='')=>{
  const id=html(quote?.id||''),request=html(requestId||quote?.requestId||'');
  if(quote?.pdf)return `<button data-action="download-pdf-admin" data-id="${id}">Descargar PDF</button><button data-action="share-pdf-admin" data-id="${id}">Compartir PDF</button>`;
  if(quote?.pdfPending)return '<button type="button" disabled data-quote-pdf-state="pending">Preparando PDF…</button>';
  return `<button data-action="generate-pdf-admin" data-id="${request}" data-quote="${id}">Generar PDF</button>`;
 };
 const patchActions=(quote,requestId='')=>{
  if(!quote?.id||typeof document==='undefined')return;
  const selector=`[data-quote-pdf-actions="${CSS.escape(String(quote.id))}"]`;
  document.querySelectorAll(selector).forEach(node=>{node.innerHTML=actionsMarkup(quote,requestId||node.dataset.requestId||'');});
 };
 const setLocalState=(quoteId,patch,requestId='')=>{
  const current=quoteById(quoteId);if(!current)return null;
  const next=upsertQuote({...current,...patch});patchActions(next,requestId);return next;
 };
 const postFailureState=quoteId=>{
  const csrf=state().csrf||'';
  if(typeof fetch!=='function')return;
  fetch(`/api/quotes/${encodeURIComponent(quoteId)}/pdf-failed`,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:'{}'})
   .then(async response=>{if(!response.ok)return;const updated=await response.json();upsertQuote(updated);patchActions(updated);})
   .catch(()=>{});
 };
 const cleanup=job=>{
  if(!job)return;
  clearTimeout(job.timer);
  jobs.delete(job.quoteId);
  job.frame?.remove?.();
 };
 const failJob=(job,message)=>{
  if(!job)return;
  cleanup(job);
  setLocalState(job.quoteId,{pdfPending:false},job.requestId);
  postFailureState(job.quoteId);
  toast?.(message||'No se pudo generar el PDF. El presupuesto sigue guardado.');
 };
 const generatePdf=(requestId='',quoteId='')=>{
  const id=String(quoteId||'');
  if(!id||jobs.has(id))return false;
  const quote=quoteById(id);
  if(quote?.pdf)return false;
  if(typeof document==='undefined')return false;
  if(quote)setLocalState(id,{pdfPending:true},requestId);
  const frame=document.createElement('iframe');
  frame.hidden=true;frame.tabIndex=-1;frame.setAttribute('aria-hidden','true');frame.dataset.amcPdfBackground='1';
  frame.src='/presupuestos?embed=1&quote='+encodeURIComponent(id)+'&solicitud='+encodeURIComponent(requestId||quote?.requestId||'')+'&generatePdf=1';
  const job={quoteId:id,requestId:requestId||quote?.requestId||'',frame,timer:0};
  job.timer=setTimeout(()=>failJob(job,'El PDF está tardando demasiado. El presupuesto quedó guardado y podés reintentar la generación.'),timeoutMs);
  jobs.set(id,job);
  document.body.append(frame);
  return true;
 };
 const onMessage=event=>{
  if(event.origin!==location.origin)return;
  const job=[...jobs.values()].find(item=>item.frame?.contentWindow===event.source);if(!job)return;
  const data=event.data||{};
  if(data.type==='amc:pdf-ready'){
   cleanup(job);
   setLocalState(job.quoteId,{pdf:data.pdf||quoteById(job.quoteId)?.pdf||'',pdfPending:false},job.requestId);
   toast?.('PDF generado y listo para descargar o compartir.');
   return;
  }
  if(data.type==='amc:pdf-error')failJob(job,data.message||'No se pudo generar el PDF. El presupuesto sigue guardado.');
 };
 if(typeof window!=='undefined')window.addEventListener('message',onMessage);
 return {generatePdf,patchActions,isPending:quoteId=>jobs.has(String(quoteId||'')),dispose(){if(typeof window!=='undefined')window.removeEventListener('message',onMessage);for(const job of jobs.values())cleanup(job);}};
}
