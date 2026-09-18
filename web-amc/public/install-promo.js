const PLAY_STORE_URL='https://play.google.com/store/apps/details?id=com.amc.construcciones';
const isStandalone=()=>window.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone===true;
const isNativeAndroid=()=>Boolean(globalThis.AMCNative);
const isIOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent);

function mountInstallPromos(){
 document.querySelectorAll('[data-amc-install-card]').forEach(card=>{
  if(isNativeAndroid()||isStandalone()){card.hidden=true;return;}
  card.hidden=false;
  const play=card.querySelector('[data-amc-play-store]');
  const ios=card.querySelector('[data-amc-ios-install]');
  const note=card.querySelector('[data-amc-install-note]');
  if(play){play.href=PLAY_STORE_URL;play.hidden=isIOS();}
  if(ios)ios.hidden=!isIOS();
  if(note)note.textContent=isIOS()?'En iPhone podés instalar AMC desde Safari en tu pantalla de inicio.':'En Android, la versión oficial de AMC se distribuye mediante Google Play.';
 });
}

document.addEventListener('click',event=>{
 const trigger=event.target.closest('[data-amc-ios-install]');
 if(!trigger)return;
 event.preventDefault();
 alert('En Safari: tocá Compartir y elegí “Agregar a pantalla de inicio”.');
});

new MutationObserver(mountInstallPromos).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('hashchange',mountInstallPromos);
window.addEventListener('pageshow',mountInstallPromos);
mountInstallPromos();
