import './active-chat-route-runtime.js';
import './mobile-chat-viewport-runtime.js';

function refreshNativePushRegistration(){
 try{window.AMCNative?.refreshPushToken?.();}catch{}
}

window.addEventListener('hashchange',()=>setTimeout(refreshNativePushRegistration,120));
window.addEventListener('pageshow',()=>setTimeout(refreshNativePushRegistration,250));
window.addEventListener('focus',()=>setTimeout(refreshNativePushRegistration,120));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(refreshNativePushRegistration,120);});

setTimeout(refreshNativePushRegistration,500);
