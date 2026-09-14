const TRANSIENT_MS=3000;
let toastTimer=0;

function scheduleToastHide(){
 const toast=document.querySelector('#toast');if(!toast?.classList.contains('show'))return;
 const text=(toast.textContent||'').trim();
 if(/\b(borrad[oa]s?|eliminad[oa]s?|vaciad[oa]s?)\b/i.test(text)){toast.classList.remove('show');return;}
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),TRANSIENT_MS);
}

const toast=document.querySelector('#toast');
if(toast)new MutationObserver(scheduleToastHide).observe(toast,{attributes:true,attributeFilter:['class'],childList:true});
scheduleToastHide();
