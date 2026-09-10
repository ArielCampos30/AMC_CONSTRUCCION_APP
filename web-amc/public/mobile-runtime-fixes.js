const root=document.documentElement;
let selectedFloatingContact=null,selectedFloatingGroup='';

const style=document.createElement('style');
style.id='amc-mobile-runtime-fixes';
style.textContent=`
#amc-chat-dialog .compact-composer{box-sizing:border-box;width:100%!important;min-width:0!important}
#amc-chat-dialog .compact-composer.no-attach{display:grid!important;grid-template-columns:minmax(0,1fr) 44px!important;align-items:end!important;gap:6px!important}
#amc-chat-dialog .compact-composer.no-attach textarea{grid-column:1!important;min-width:0!important;width:100%!important;max-width:none!important}
#amc-chat-dialog .compact-composer.no-attach .chat-send-icon{grid-column:2!important;width:44px!important;min-width:44px!important;height:44px!important;margin:0!important;padding:0!important}
#amc-chat-dialog.amc-keyboard-open{position:fixed!important;inset:auto!important;top:var(--amc-vv-top,6px)!important;left:12px!important;right:12px!important;bottom:auto!important;width:auto!important;height:var(--amc-vv-height,60dvh)!important;max-height:var(--amc-vv-height,60dvh)!important;margin:0!important}
#amc-chat-dialog.amc-keyboard-open .message-log{min-height:0!important;flex:1 1 auto!important}
#amc-chat-dialog.amc-keyboard-open .compact-composer{flex:0 0 auto!important;padding-bottom:max(7px,env(safe-area-inset-bottom))!important}
`;
document.head.append(style);

function pageChatRoute(){
 const hash=location.hash||'';
 if(/^#chat-admin\/[A-Za-z0-9_-]+$/.test(hash)||/^#chat-equipo(?:\/[A-Za-z0-9_-]+)?$/.test(hash)||/^#chat\/[A-Za-z0-9_-]+$/.test(hash))return '/'+hash;
 const form=document.querySelector('main .message-form[data-request]');
 if(hash==='#chat-cliente'&&form?.dataset.request)return '/#chat/'+encodeURIComponent(form.dataset.request);
 return '';
}

function floatingChatRoute(){
 const dialog=document.getElementById('amc-chat-dialog');
 if(!dialog?.open)return '';
 const requestForm=dialog.querySelector('.message-form[data-request]');
 if(requestForm?.dataset.request)return (document.body.classList.contains('admin-v3')?'/#chat-admin/':'/#chat/')+encodeURIComponent(requestForm.dataset.request);
 if(dialog.querySelector('.floating-staff-message')&&selectedFloatingContact)return '/#chat-equipo/'+encodeURIComponent(selectedFloatingContact);
 return '';
}

function publishActiveChatRoute(){
 const route=floatingChatRoute()||pageChatRoute();
 if(route)root.dataset.amcActiveChatRoute=route;else delete root.dataset.amcActiveChatRoute;
 try{window.AMCNative?.setActiveChatRoute?.(route);}catch{}
 window.dispatchEvent(new CustomEvent('amc-active-chat-change',{detail:{route}}));
 return route;
}

function fitChatToViewport(){
 const dialog=document.getElementById('amc-chat-dialog'),vv=window.visualViewport;
 if(!dialog?.open||!vv)return;
 const focused=dialog.contains(document.activeElement)&&['INPUT','TEXTAREA'].includes(document.activeElement?.tagName);
 dialog.classList.toggle('amc-keyboard-open',focused);
 if(!focused){dialog.style.removeProperty('--amc-vv-top');dialog.style.removeProperty('--amc-vv-height');return;}
 dialog.style.setProperty('--amc-vv-top',Math.max(6,Math.round(vv.offsetTop+6))+'px');
 dialog.style.setProperty('--amc-vv-height',Math.max(220,Math.round(vv.height-12))+'px');
 requestAnimationFrame(()=>{const log=dialog.querySelector('.message-log');if(log)log.scrollTop=log.scrollHeight;});
}

function refreshNativePushRegistration(){
 try{window.AMCNative?.refreshPushToken?.();}catch{}
}

document.addEventListener('pointerdown',event=>{
 const row=event.target.closest?.('#amc-chat-dialog .chat-contact[data-contact]');
 if(!row)return;
 selectedFloatingContact=row.dataset.contact||'';
 selectedFloatingGroup=document.querySelector('#amc-chat-dialog .chat-heading strong')?.textContent?.trim()||'';
},{capture:true,passive:true});

document.addEventListener('click',event=>{
 if(event.target.closest?.('#amc-chat-dialog .chat-contact[data-contact],#amc-chat-dialog .chat-icon-button,#amc-chat-dialog .chat-group'))queueMicrotask(()=>{publishActiveChatRoute();fitChatToViewport();});
});
document.addEventListener('close',event=>{if(event.target?.id==='amc-chat-dialog'){selectedFloatingContact='';selectedFloatingGroup='';publishActiveChatRoute();fitChatToViewport();}},{capture:true});
document.addEventListener('focusin',event=>{if(event.target.closest?.('#amc-chat-dialog'))requestAnimationFrame(()=>{fitChatToViewport();publishActiveChatRoute();});});
document.addEventListener('focusout',event=>{if(event.target.closest?.('#amc-chat-dialog'))setTimeout(fitChatToViewport,80);});
window.visualViewport?.addEventListener('resize',fitChatToViewport,{passive:true});
window.visualViewport?.addEventListener('scroll',fitChatToViewport,{passive:true});

window.addEventListener('hashchange',()=>{selectedFloatingContact='';setTimeout(()=>{publishActiveChatRoute();refreshNativePushRegistration();},120);});
window.addEventListener('pageshow',()=>setTimeout(()=>{publishActiveChatRoute();refreshNativePushRegistration();},250));
window.addEventListener('focus',()=>setTimeout(()=>{publishActiveChatRoute();refreshNativePushRegistration();},120));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(()=>{publishActiveChatRoute();refreshNativePushRegistration();},120);});

const app=document.getElementById('app');
if(app)new MutationObserver(()=>queueMicrotask(publishActiveChatRoute)).observe(app,{childList:true,subtree:true});
setTimeout(()=>{publishActiveChatRoute();fitChatToViewport();refreshNativePushRegistration();},500);
