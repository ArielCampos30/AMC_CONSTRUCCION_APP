const TRANSIENT_MS=3000;
let toastTimer=0,backSyncPending=false,navigatingBack=false;
const routeStack=[location.hash.slice(1)||'inicio'];

function rootPage(){
 if(document.body.classList.contains('employee-v4'))return 'inicio-empleado';
 return 'inicio';
}

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
 if(routeStack.length>1){
  routeStack.pop();
  const previous=routeStack.at(-1)||fallbackBackRoute(route);
  navigatingBack=true;
  location.hash=previous;
  return;
 }
 const target=fallbackBackRoute(route);
 if(target!==route)location.hash=target;
}

function hasOwnBack(main){
 if(main.querySelector('[data-action="back"],[data-global-back]'))return true;
 return [...main.querySelectorAll('a')].some(link=>/^←\s*Volver\b/i.test(link.textContent.trim()));
}

function syncBackButton(){
 backSyncPending=false;
 const main=document.querySelector('#app main');
 if(!main)return;
 const route=currentRoute(),home=rootPage(),existing=main.querySelector('[data-global-back]')?.closest('.section-navigation');
 if(route===home){existing?.remove();return;}
 if(hasOwnBack(main))return;
 const nav=document.createElement('nav');
 nav.className='section-navigation contextual amc-global-back-nav';
 nav.setAttribute('aria-label','Volver');
 nav.innerHTML='<button type="button" data-global-back class="outline">← Volver</button>';
 main.prepend(nav);
}

function requestBackSync(){
 if(backSyncPending)return;
 backSyncPending=true;
 queueMicrotask(syncBackButton);
}

function scheduleToastHide(){
 const toast=document.querySelector('#toast');
 if(!toast?.classList.contains('show'))return;
 clearTimeout(toastTimer);
 toastTimer=setTimeout(()=>toast.classList.remove('show'),TRANSIENT_MS);
}

const toast=document.querySelector('#toast');
if(toast)new MutationObserver(scheduleToastHide).observe(toast,{attributes:true,attributeFilter:['class'],childList:true,subtree:true});
const app=document.querySelector('#app');
if(app)new MutationObserver(requestBackSync).observe(app,{childList:true,subtree:true});

document.addEventListener('click',event=>{
 const back=event.target.closest?.('[data-global-back],[data-action="back"]');
 if(!back)return;
 event.preventDefault();
 event.stopImmediatePropagation();
 goBack();
},true);

window.addEventListener('hashchange',()=>{
 const route=currentRoute();
 if(navigatingBack){navigatingBack=false;requestBackSync();return;}
 if(routeStack.at(-1)!==route)routeStack.push(route);
 requestBackSync();
});

scheduleToastHide();
requestBackSync();
