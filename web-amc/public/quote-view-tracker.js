export function createQuoteViewTracker({getState,isAdmin,api,onNoticesRead=()=>{},schedule=(handler,delay)=>globalThis.setTimeout(handler,delay),retryDelayMs=1500,onError=(error,meta)=>globalThis.console?.warn?.('[AMC quote view]',String(error?.message||error||'Error'),meta||{})}){
 let observer;const pending=new Set();
 const state=()=>getState();
 function afterRender(page){
  observer?.disconnect();
  if(page!=='presupuestos'||isAdmin())return;
  observer=new IntersectionObserver(entries=>{
   for(const entry of entries){
    if(!entry.isIntersecting)continue;
    const quoteId=entry.target.dataset.quoteId,quote=state().quotes.find(item=>item.id===quoteId);
    if(quote?.seenAt||pending.has(quoteId)){observer.unobserve(entry.target);continue;}
    pending.add(quoteId);observer.unobserve(entry.target);
    api('/api/quotes/'+quoteId+'/view').then(result=>{
     onNoticesRead(result.noticeIds||[]);
     const current=state().quotes.find(item=>item.id===quoteId);
     if(current)current.seenAt=new Date().toISOString();
    }).catch(error=>{
     if(error?.name!=='AbortError')onError?.(error,{quoteId});
     schedule(()=>{if(entry.target?.isConnected!==false&&!state().quotes.find(item=>item.id===quoteId)?.seenAt)observer?.observe(entry.target);},retryDelayMs);
    }).finally(()=>pending.delete(quoteId));
   }
  },{threshold:.15});
  document.querySelectorAll('[data-quote-id]').forEach(element=>observer.observe(element));
 }
 return {afterRender};
}
