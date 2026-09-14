export const TRANSIENT_MS=3000;

export function createAppToastRuntime({
 documentRef=globalThis.document,
 createMutationObserver=callback=>typeof globalThis.MutationObserver==='function'?new globalThis.MutationObserver(callback):null,
 setTimeoutRef=globalThis.setTimeout,
 clearTimeoutRef=globalThis.clearTimeout,
}={}){
 let toastTimer=0;
 function scheduleToastHide(){
  const toast=documentRef?.querySelector?.('#toast');
  if(!toast?.classList?.contains('show'))return;
  const text=(toast.textContent||'').trim();
  if(/\b(borrad[oa]s?|eliminad[oa]s?|vaciad[oa]s?)\b/i.test(text)){
   clearTimeoutRef(toastTimer);
   toastTimer=0;
   toast.classList.remove('show');
   return;
  }
  clearTimeoutRef(toastTimer);
  toastTimer=setTimeoutRef(()=>toast.classList.remove('show'),TRANSIENT_MS);
 }
 function attach(){
  const toast=documentRef?.querySelector?.('#toast');
  const observer=toast?createMutationObserver(scheduleToastHide):null;
  observer?.observe(toast,{attributes:true,attributeFilter:['class'],childList:true});
  scheduleToastHide();
  return observer;
 }
 return {attach,scheduleToastHide,getTimer:()=>toastTimer};
}

if(typeof document!=='undefined')createAppToastRuntime().attach();
