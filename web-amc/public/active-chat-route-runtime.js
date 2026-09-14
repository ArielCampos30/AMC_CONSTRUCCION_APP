const root=document.documentElement;
let selectedFloatingContact=null,selectedFloatingGroup='';

export function pageChatRoute(){
 const hash=location.hash||'';
 if(/^#chat-user\/[A-Za-z0-9_-]+$/.test(hash)||/^#chat-admin\/[A-Za-z0-9_-]+$/.test(hash)||/^#chat-equipo(?:\/[A-Za-z0-9_-]+)?$/.test(hash)||/^#chat\/[A-Za-z0-9_-]+$/.test(hash))return '/'+hash;
 const form=document.querySelector('main .message-form[data-client]');
 if(form?.dataset.client)return '/#chat-user/'+encodeURIComponent(form.dataset.client);
 return '';
}

export function floatingChatRoute(){
 const dialog=document.getElementById('amc-chat-dialog');
 if(!dialog?.open)return '';
 const clientForm=dialog.querySelector('.message-form[data-client]');
 if(clientForm?.dataset.client)return '/#chat-user/'+encodeURIComponent(clientForm.dataset.client);
 const requestForm=dialog.querySelector('.message-form[data-request]');
 if(requestForm?.dataset.request)return (document.body.classList.contains('admin-v3')?'/#chat-admin/':'/#chat/')+encodeURIComponent(requestForm.dataset.request);
 if(dialog.querySelector('.floating-staff-message')&&selectedFloatingContact)return '/#chat-equipo/'+encodeURIComponent(selectedFloatingContact);
 return '';
}

export function publishActiveChatRoute(){
 const route=floatingChatRoute()||pageChatRoute();
 if(route)root.dataset.amcActiveChatRoute=route;else delete root.dataset.amcActiveChatRoute;
 try{window.AMCNative?.setActiveChatRoute?.(route);}catch{}
 window.dispatchEvent(new CustomEvent('amc-active-chat-change',{detail:{route}}));
 return route;
}

document.addEventListener('pointerdown',event=>{
 const row=event.target.closest?.('#amc-chat-dialog .chat-contact[data-contact]');
 if(!row)return;
 selectedFloatingContact=row.dataset.contact||'';
 selectedFloatingGroup=document.querySelector('#amc-chat-dialog .chat-heading strong')?.textContent?.trim()||'';
},{capture:true,passive:true});

document.addEventListener('click',event=>{
 if(event.target.closest?.('#amc-chat-dialog .chat-contact[data-contact],#amc-chat-dialog .chat-icon-button,#amc-chat-dialog .chat-group'))queueMicrotask(publishActiveChatRoute);
});
document.addEventListener('close',event=>{if(event.target?.id==='amc-chat-dialog'){selectedFloatingContact='';selectedFloatingGroup='';publishActiveChatRoute();}},{capture:true});
document.addEventListener('focusin',event=>{if(event.target.closest?.('#amc-chat-dialog'))requestAnimationFrame(publishActiveChatRoute);});

window.addEventListener('hashchange',()=>{selectedFloatingContact='';setTimeout(publishActiveChatRoute,120);});
window.addEventListener('pageshow',()=>setTimeout(publishActiveChatRoute,250));
window.addEventListener('focus',()=>setTimeout(publishActiveChatRoute,120));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(publishActiveChatRoute,120);});

const app=document.getElementById('app');
if(app)new MutationObserver(()=>queueMicrotask(publishActiveChatRoute)).observe(app,{childList:true,subtree:true});
setTimeout(publishActiveChatRoute,500);
