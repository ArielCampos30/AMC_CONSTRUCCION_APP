export function createAdminAppearanceController({
 documentRef=globalThis.document,
 windowRef=globalThis.window,
 api,
 toast=text=>{const el=documentRef?.querySelector?.('#toast');if(!el)return;el.textContent=text;el.classList.add('show');},
 confirmAction=(message,title,confirmLabel)=>windowRef?.AMCConfirm?windowRef.AMCConfirm(message,{title,confirmLabel}):Promise.resolve(windowRef?.confirm?.(message)),
 MutationObserverRef=globalThis.MutationObserver,
 queueMicrotaskRef=globalThis.queueMicrotask,
 setTimeoutRef=globalThis.setTimeout,
}={}){
 let appearanceSyncPending=false;

 function refreshAppearanceLabels(){
  const list=documentRef?.querySelector?.('#appearance-form .appearance-photo-list');
  if(!list)return;
  [...list.querySelectorAll('.appearance-photo-card')].forEach((card,index)=>{
   const badge=card.querySelector('[data-photo-role]'),next=index===0?'Foto principal':'Galería';
   if(badge&&badge.textContent!==next)badge.textContent=next;
  });
 }

 function scheduleAppearanceLabels(){
  if(appearanceSyncPending)return;
  appearanceSyncPending=true;
  queueMicrotaskRef(()=>{appearanceSyncPending=false;refreshAppearanceLabels();});
 }

 function refreshWithoutReload(){
  setTimeoutRef(()=>windowRef?.dispatchEvent?.(new Event('focus')),60);
 }

 async function handleClick(event){
  const button=event.target?.closest?.('[data-maintenance-action]');
  if(!button)return false;
  const action=button.dataset.maintenanceAction;

  if(action==='appearance-remove-photo'){
   button.closest('.appearance-photo-card')?.remove();
   refreshAppearanceLabels();
   return true;
  }
  if(action==='appearance-main-photo'){
   const card=button.closest('.appearance-photo-card'),list=card?.parentElement;
   if(card&&list){list.prepend(card);refreshAppearanceLabels();}
   return true;
  }
  if(action==='appearance-clear-photos'){
   if(await confirmAction('La portada volverá a mostrar sólo la marca AMC cuando guardes los cambios.','Quitar fotos de portada','Dejar sólo el logo')){
    documentRef.querySelector('#appearance-form .appearance-photo-list')?.replaceChildren();
    refreshAppearanceLabels();
   }
   return true;
  }
  if(action!=='restore-appearance')return false;

  event.preventDefault?.();
  event.stopImmediatePropagation?.();
  if(button.disabled)return true;
  button.disabled=true;
  try{
   if(!await confirmAction('¿Restaurar esta versión de la portada pública? La portada actual quedará guardada en el historial.','Restaurar portada','Restaurar'))return true;
   await api('/api/appearance/restore',{versionAt:button.dataset.version});
   toast('Portada restaurada.');
   refreshWithoutReload();
  }catch(error){
   toast(error.message);
  }finally{
   button.disabled=false;
  }
  return true;
 }

 function attach(){
  documentRef?.addEventListener?.('click',handleClick,true);
  const appRoot=documentRef?.getElementById?.('app');
  if(appRoot&&MutationObserverRef)new MutationObserverRef(scheduleAppearanceLabels).observe(appRoot,{childList:true});
  windowRef?.addEventListener?.('hashchange',()=>{if(windowRef.location?.hash==='#portada')scheduleAppearanceLabels();});
  refreshAppearanceLabels();
 }

 return {attach,handleClick,refreshAppearanceLabels,scheduleAppearanceLabels};
}
