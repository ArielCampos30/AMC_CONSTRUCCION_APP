import './active-chat-route-runtime.js';

let mobileViewportBaseline=Math.max(window.visualViewport?.height||0,window.innerHeight||0,document.documentElement.clientHeight||0);

function fitChatToViewport(){
 const dialog=document.getElementById('amc-chat-dialog'),vv=window.visualViewport;
 if(!dialog?.open||!vv)return;
 const focused=dialog.contains(document.activeElement)&&['INPUT','TEXTAREA'].includes(document.activeElement?.tagName),narrow=window.matchMedia('(max-width:560px)').matches,currentHeight=Math.max(0,vv.height||0),layoutHeight=Math.max(window.innerHeight||0,document.documentElement.clientHeight||0);
 if(!focused||!narrow)mobileViewportBaseline=Math.max(mobileViewportBaseline,currentHeight,layoutHeight);
 const keyboardOpen=focused&&narrow&&currentHeight>0&&mobileViewportBaseline-currentHeight>110;
 dialog.classList.toggle('amc-keyboard-open',keyboardOpen);
 if(!keyboardOpen){dialog.style.removeProperty('--amc-vv-top');dialog.style.removeProperty('--amc-vv-height');return;}
 dialog.style.setProperty('--amc-vv-top',Math.max(6,Math.round(vv.offsetTop+6))+'px');
 dialog.style.setProperty('--amc-vv-height',Math.max(220,Math.round(vv.height-12))+'px');
 requestAnimationFrame(()=>{const log=dialog.querySelector('.message-log');if(log)log.scrollTop=log.scrollHeight;});
}

function dismissComposerAfterSend(form){
 if(!window.matchMedia('(max-width:560px)').matches)return;
 const textarea=form?.elements?.text,send=form?.querySelector('button[type=submit]');
 if(!textarea||!send)return;
 const blur=()=>{if(document.activeElement===textarea)textarea.blur();requestAnimationFrame(fitChatToViewport);};
 queueMicrotask(blur);
 const observer=new MutationObserver(()=>{if(!send.disabled){observer.disconnect();queueMicrotask(blur);}});
 observer.observe(send,{attributes:true,attributeFilter:['disabled']});
 setTimeout(()=>observer.disconnect(),10000);
}

function refreshNativePushRegistration(){
 try{window.AMCNative?.refreshPushToken?.();}catch{}
}

document.addEventListener('submit',event=>{
 const form=event.target.closest?.('#amc-chat-dialog .compact-composer');
 if(form)dismissComposerAfterSend(form);
},{capture:true});
document.addEventListener('click',event=>{
 if(event.target.closest?.('#amc-chat-dialog .chat-contact[data-contact],#amc-chat-dialog .chat-icon-button,#amc-chat-dialog .chat-group'))queueMicrotask(fitChatToViewport);
});
document.addEventListener('close',event=>{if(event.target?.id==='amc-chat-dialog')fitChatToViewport();},{capture:true});
document.addEventListener('focusin',event=>{if(event.target.closest?.('#amc-chat-dialog'))requestAnimationFrame(fitChatToViewport);});
document.addEventListener('focusout',event=>{if(event.target.closest?.('#amc-chat-dialog'))setTimeout(fitChatToViewport,80);});
window.visualViewport?.addEventListener('resize',fitChatToViewport,{passive:true});
window.visualViewport?.addEventListener('scroll',fitChatToViewport,{passive:true});
window.addEventListener('orientationchange',()=>setTimeout(()=>{mobileViewportBaseline=Math.max(window.visualViewport?.height||0,window.innerHeight||0,document.documentElement.clientHeight||0);fitChatToViewport();},250));

window.addEventListener('hashchange',()=>setTimeout(refreshNativePushRegistration,120));
window.addEventListener('pageshow',()=>setTimeout(()=>{mobileViewportBaseline=Math.max(mobileViewportBaseline,window.visualViewport?.height||0,window.innerHeight||0);refreshNativePushRegistration();},250));
window.addEventListener('focus',()=>setTimeout(refreshNativePushRegistration,120));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(refreshNativePushRegistration,120);});

setTimeout(()=>{fitChatToViewport();refreshNativePushRegistration();},500);
