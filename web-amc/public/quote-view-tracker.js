export function createQuoteViewTracker({getState,isAdmin,api,onNoticesRead=()=>{}}){
 let observer;
 const state=()=>getState();
 function afterRender(page){
  observer?.disconnect();
  if(page!=='presupuestos'||isAdmin())return;
  observer=new IntersectionObserver(entries=>{
   for(const entry of entries){
    if(!entry.isIntersecting)continue;
    observer.unobserve(entry.target);
    const quote=state().quotes.find(item=>item.id===entry.target.dataset.quoteId);
    if(quote?.seenAt)continue;
    api('/api/quotes/'+entry.target.dataset.quoteId+'/view').then(result=>{
     onNoticesRead(result.noticeIds||[]);
     const current=state().quotes.find(item=>item.id===entry.target.dataset.quoteId);
     if(current)current.seenAt=new Date().toISOString();
    }).catch(()=>{});
   }
  },{threshold:.15});
  document.querySelectorAll('[data-quote-id]').forEach(element=>observer.observe(element));
 }
 return {afterRender};
}
