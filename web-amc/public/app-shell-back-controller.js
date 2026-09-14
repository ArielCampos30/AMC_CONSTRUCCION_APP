export function createAppShellBackController({
 documentRef=globalThis.document,
 windowRef=globalThis.window,
 locationRef=globalThis.location,
 createMutationObserver=callback=>typeof globalThis.MutationObserver==='function'?new globalThis.MutationObserver(callback):null,
 queueMicrotaskRef=globalThis.queueMicrotask,
}={}){
 let backSyncPending=false,navigatingBack=false;
 const routeStack=[String(locationRef?.hash||'').slice(1)||'inicio'];
 const body=()=>documentRef?.body;
 const authenticatedShell=()=>body()?.classList?.contains('admin-v3')||body()?.classList?.contains('employee-v4')||body()?.classList?.contains('client-v5');
 const rootPage=()=>body()?.classList?.contains('employee-v4')?'inicio-empleado':'inicio';
 const currentRoute=()=>String(locationRef?.hash||'').slice(1)||rootPage();
 function fallbackBackRoute(route=currentRoute()){
  if(route.startsWith('presupuesto-admin/'))return 'presupuestos';
  if(route.startsWith('obra-admin/'))return 'obras';
  if(route.startsWith('cliente/'))return 'clientes';
  if(route.startsWith('chat-admin/'))return 'chat-admin';
  if(route.startsWith('chat-equipo/'))return body()?.classList?.contains('admin-v3')?'chat-admin':'chat-equipo';
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
   locationRef.hash=previous;
   return previous;
  }
  const target=fallbackBackRoute(route);
  if(target!==route)locationRef.hash=target;
  return target;
 }
 function hasOwnBack(main){
  if(main.querySelector('[data-action="back"]'))return true;
  return [...main.querySelectorAll('a')].some(link=>/^←\s*(Volver|Mis trabajos|Volver al trabajo)\b/i.test((link.textContent||'').trim()));
 }
 function syncBackButton(){
  backSyncPending=false;
  const main=documentRef?.querySelector?.('#app main');
  if(!main)return;
  const existing=main.querySelector('[data-global-back]')?.closest('.section-navigation');
  if(!authenticatedShell()){existing?.remove();return;}
  const route=currentRoute(),home=rootPage();
  if(route===home){existing?.remove();return;}
  if(hasOwnBack(main)){existing?.remove();return;}
  if(existing)return;
  const nav=documentRef.createElement('nav');
  nav.className='section-navigation contextual amc-global-back-nav';
  nav.setAttribute('aria-label','Volver');
  nav.innerHTML='<button type="button" data-global-back class="outline">← Volver</button>';
  main.prepend(nav);
 }
 function requestUiSync(){
  if(backSyncPending)return;
  backSyncPending=true;
  queueMicrotaskRef(syncBackButton);
 }
 function handleClick(event){
  const back=event.target.closest?.('[data-global-back]');
  if(!back)return;
  event.preventDefault();
  goBack();
 }
 function handleHashChange(){
  const route=currentRoute();
  if(navigatingBack){navigatingBack=false;requestUiSync();return;}
  if(routeStack.at(-1)!==route)routeStack.push(route);
  requestUiSync();
 }
 function attach(){
  const app=documentRef?.querySelector?.('#app');
  const observer=app?createMutationObserver(requestUiSync):null;
  observer?.observe(app,{childList:true});
  documentRef?.addEventListener?.('click',handleClick,true);
  windowRef?.addEventListener?.('hashchange',handleHashChange);
  requestUiSync();
  return observer;
 }
 return {attach,authenticatedShell,rootPage,currentRoute,fallbackBackRoute,goBack,hasOwnBack,syncBackButton,requestUiSync,handleClick,handleHashChange,routeStack};
}

if(typeof document!=='undefined'&&typeof window!=='undefined')createAppShellBackController().attach();
