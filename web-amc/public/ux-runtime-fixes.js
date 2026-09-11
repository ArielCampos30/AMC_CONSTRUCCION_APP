const TRANSIENT_MS=3000;
let toastTimer=0,backSyncPending=false,navigatingBack=false,noticeCsrf='';
const routeStack=[location.hash.slice(1)||'inicio'];
const deletedNoticeIds=new Set();

function authenticatedShell(){return document.body.classList.contains('admin-v3')||document.body.classList.contains('employee-v4')||document.body.classList.contains('client-v5');}
function rootPage(){return document.body.classList.contains('employee-v4')?'inicio-empleado':'inicio';}
function currentRoute(){return location.hash.slice(1)||rootPage();}
function fallbackBackRoute(route=currentRoute()){
 if(route.startsWith('presupuesto-admin/'))return 'presupuestos';
 if(route.startsWith('obra-admin/'))return 'obras';
 if(route.startsWith('cliente/'))return 'clientes';
 if(route.startsWith('chat-admin/'))return 'chat-admin';
 if(route.startsWith('chat-equipo/'))return document.body.classList.contains('admin-v3')?'chat-admin':'chat-equipo';
 if(route.startsWith('trabajo/'))return 'mis-trabajos';
 if(route.startsWith('mi-trabajo/')||route.startsWith('solicitud/')||route.startsWith('presupuesto/')||route.startsWith('obra/'))return 'mis-trabajos-cliente';
 return rootPage();
}
function goBack(){
 const route=currentRoute();
 if(routeStack.length>1){routeStack.pop();const previous=routeStack.at(-1)||fallbackBackRoute(route);navigatingBack=true;location.hash=previous;return;}
 const target=fallbackBackRoute(route);if(target!==route)location.hash=target;
}
function hasOwnBack(main){
 if(main.querySelector('[data-action="back"],[data-global-back]'))return true;
 return [...main.querySelectorAll('a')].some(link=>/^←\s*(Volver|Mis trabajos|Volver al trabajo)\b/i.test(link.textContent.trim()));
}
function pruneDeletedNotices(){
 for(const id of deletedNoticeIds)document.querySelector('[data-notice-card="'+CSS.escape(id)+'"]')?.remove();
 const cards=[...document.querySelectorAll('[data-notice-card]')],unread=cards.filter(card=>card.classList.contains('unread')).length,count=document.querySelector('#notice-count');
 if(count){count.textContent=String(unread);count.hidden=!unread;}
}
function syncBackButton(){
 backSyncPending=false;pruneDeletedNotices();
 const main=document.querySelector('#app main');if(!main)return;
 const existing=main.querySelector('[data-global-back]')?.closest('.section-navigation');
 if(!authenticatedShell()){existing?.remove();return;}
 const route=currentRoute(),home=rootPage();
 if(route===home){existing?.remove();return;}
 if(hasOwnBack(main))return;
 const nav=document.createElement('nav');nav.className='section-navigation contextual amc-global-back-nav';nav.setAttribute('aria-label','Volver');nav.innerHTML='<button type="button" data-global-back class="outline">← Volver</button>';main.prepend(nav);
}
function requestUiSync(){if(backSyncPending)return;backSyncPending=true;queueMicrotask(syncBackButton);}

function scheduleToastHide(){
 const toast=document.querySelector('#toast');if(!toast?.classList.contains('show'))return;
 const text=(toast.textContent||'').trim();
 if(/\b(borrad[oa]s?|eliminad[oa]s?|vaciad[oa]s?)\b/i.test(text)){toast.classList.remove('show');return;}
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),TRANSIENT_MS);
}
function errorToast(message){const toast=document.querySelector('#toast');if(!toast)return;toast.textContent=message||'No se pudo completar la operación.';toast.classList.add('show');scheduleToastHide();}

async function getNoticeCsrf(force=false){
 if(noticeCsrf&&!force)return noticeCsrf;
 const response=await fetch('/api/state',{credentials:'same-origin'});if(!response.ok)throw Error('No se pudo verificar la sesión.');
 const state=await response.json();if(!state.user)throw Error('Ingresá a tu cuenta para continuar.');noticeCsrf=state.csrf||'';return noticeCsrf;
}
async function deleteNotice(id){
 for(let attempt=0;attempt<2;attempt++){
  const token=await getNoticeCsrf(attempt>0),response=await fetch('/api/notices/read',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':token},body:JSON.stringify({deleteId:id})}),value=await response.json().catch(()=>({}));
  if(response.status===403&&attempt===0){noticeCsrf='';continue;}
  if(!response.ok)throw Error(value.error||'No se pudo borrar el aviso.');return value;
 }
 throw Error('No se pudo borrar el aviso.');
}

const toast=document.querySelector('#toast');
if(toast)new MutationObserver(scheduleToastHide).observe(toast,{attributes:true,attributeFilter:['class'],childList:true});
const app=document.querySelector('#app');
if(app)new MutationObserver(requestUiSync).observe(app,{childList:true});

document.addEventListener('click',event=>{
 const back=event.target.closest?.('[data-global-back]');if(!back)return;event.preventDefault();goBack();
},true);

window.addEventListener('click',async event=>{
 const button=event.target.closest?.('[data-maintenance-action="delete-notice"]');if(!button)return;
 event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();if(button.disabled)return;
 const id=button.dataset.id||'',card=button.closest('[data-notice-card]'),parent=card?.parentNode,next=card?.nextSibling;
 button.disabled=true;deletedNoticeIds.add(id);card?.remove();pruneDeletedNotices();document.querySelector('#amc-live-alert[data-notice-id="'+CSS.escape(id)+'"]')?.replaceChildren();
 try{await deleteNotice(id);setTimeout(()=>deletedNoticeIds.delete(id),15000);}
 catch(error){deletedNoticeIds.delete(id);if(card&&parent?.isConnected&&!card.isConnected)parent.insertBefore(card,next?.parentNode===parent?next:null);pruneDeletedNotices();errorToast(error.message);}
 finally{if(button.isConnected)button.disabled=false;}
},true);

window.addEventListener('hashchange',()=>{const route=currentRoute();if(navigatingBack){navigatingBack=false;requestUiSync();return;}if(routeStack.at(-1)!==route)routeStack.push(route);requestUiSync();});
scheduleToastHide();requestUiSync();
