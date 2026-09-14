import {hydrateEmployeeStaffChat} from './employee-staff-chat-view.js';

const STYLE_TEXT=`
 @keyframes amc-employee-spin{to{transform:rotate(360deg)}}
 .employee-staff-chat[data-staff-chat-loading="1"] .employee-message-log::before{content:"";width:22px;height:22px;align-self:center;flex:0 0 auto;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:amc-employee-spin .7s linear infinite;opacity:.65;margin:.4rem}
 .employee-staff-chat .staff-message button[data-amc-sending="1"]{display:inline-flex;align-items:center;justify-content:center;gap:.5rem}
 .employee-send-spinner{display:inline-block;width:18px;height:18px;flex:0 0 18px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:amc-employee-spin .7s linear infinite}
 @media(max-width:560px){.employee-staff-chat .staff-message textarea{font-size:16px!important;scroll-margin-bottom:140px}.employee-staff-chat .staff-message{scroll-margin-bottom:120px}}
`;

export function createEmployeeStaffChatRuntime({
 documentRef=globalThis.document,
 windowRef=globalThis.window,
 MutationObserverRef=globalThis.MutationObserver,
 requestAnimationFrameRef=globalThis.requestAnimationFrame,
 setTimeoutRef=globalThis.setTimeout,
 clearTimeoutRef=globalThis.clearTimeout,
 queueMicrotaskRef=globalThis.queueMicrotask,
 fetchImpl=globalThis.fetch,
}={}){
 let activeRoot=null,draft='',focusWanted=false,selectionStart=0,selectionEnd=0,focusReleaseTimer=0;
 const textareaOf=root=>root?.querySelector('.staff-message textarea[name="text"]');
 const reveal=textarea=>requestAnimationFrameRef(()=>textarea?.scrollIntoView?.({block:'nearest',inline:'nearest',behavior:'auto'}));
 const rememberSelection=textarea=>{selectionStart=textarea?.selectionStart??0;selectionEnd=textarea?.selectionEnd??selectionStart;};
 const restoreComposer=root=>{
  const textarea=textareaOf(root);if(!textarea)return;
  if(draft&&!textarea.value)textarea.value=draft;
  if(!focusWanted)return;
  requestAnimationFrameRef(()=>{if(!textarea.isConnected)return;try{textarea.focus({preventScroll:true});textarea.setSelectionRange(Math.min(selectionStart,textarea.value.length),Math.min(selectionEnd,textarea.value.length));}catch{}reveal(textarea);});
 };
 const hydrateVisible=()=>{
  const root=documentRef.querySelector('.employee-staff-chat');
  if(!root){activeRoot=null;return;}
  if(root===activeRoot)return;
  activeRoot=root;restoreComposer(root);root.dataset.staffChatLoading='1';
  hydrateEmployeeStaffChat(root,fetchImpl).catch(()=>{}).finally(()=>{if(root===activeRoot)delete root.dataset.staffChatLoading;restoreComposer(root);});
 };
 const onInput=event=>{const textarea=event.target.closest?.('.employee-staff-chat .staff-message textarea[name="text"]');if(!textarea)return;draft=textarea.value;rememberSelection(textarea);};
 const onFocusIn=event=>{const textarea=event.target.closest?.('.employee-staff-chat .staff-message textarea[name="text"]');if(!textarea)return;clearTimeoutRef(focusReleaseTimer);focusWanted=true;draft=textarea.value;rememberSelection(textarea);reveal(textarea);};
 const onFocusOut=event=>{if(!event.target.closest?.('.employee-staff-chat .staff-message textarea[name="text"]'))return;clearTimeoutRef(focusReleaseTimer);focusReleaseTimer=setTimeoutRef(()=>{const active=documentRef.activeElement;if(!active?.closest?.('.employee-staff-chat'))focusWanted=false;},180);};
 const onSubmit=event=>{
  const form=event.target.closest?.('.employee-staff-chat .staff-message');if(!form)return;
  const textarea=form.elements?.text,button=form.querySelector('button[type="submit"],button:not([type])');if(!button)return;
  draft=textarea?.value||draft;rememberSelection(textarea);focusWanted=false;button.dataset.amcSending='1';button.innerHTML='<span class="employee-send-spinner" aria-hidden="true"></span><span>Enviando…</span>';
  if(windowRef.matchMedia?.('(max-width:560px)').matches&&documentRef.activeElement===textarea)textarea.blur();
  let disabledSeen=false;
  const observer=new MutationObserverRef(()=>{if(button.disabled){disabledSeen=true;return;}if(!disabledSeen)return;observer.disconnect();if(textarea?.isConnected)draft=textarea.value||'';if(button.isConnected){delete button.dataset.amcSending;if(button.querySelector('.employee-send-spinner'))button.textContent='Enviar';}});
  observer.observe(button,{attributes:true,attributeFilter:['disabled']});setTimeoutRef(()=>{observer.disconnect();if(button.isConnected){delete button.dataset.amcSending;if(button.querySelector('.employee-send-spinner'))button.textContent='Enviar';}},12000);
 };
 const onViewportResize=()=>{const textarea=documentRef.activeElement?.closest?.('.employee-staff-chat .staff-message textarea[name="text"]');if(textarea)reveal(textarea);};
 function attach(){
  const style=documentRef.createElement('style');style.textContent=STYLE_TEXT;documentRef.head.append(style);
  const target=documentRef.getElementById('app')||documentRef.body;
  new MutationObserverRef(hydrateVisible).observe(target,{childList:true});
  documentRef.addEventListener('input',onInput);
  documentRef.addEventListener('focusin',onFocusIn);
  documentRef.addEventListener('focusout',onFocusOut);
  documentRef.addEventListener('submit',onSubmit,{capture:true});
  windowRef.visualViewport?.addEventListener('resize',onViewportResize,{passive:true});
  queueMicrotaskRef(hydrateVisible);
 }
 return {attach,hydrateVisible,restoreComposer,getDraft:()=>draft};
}

if(typeof document!=='undefined'&&typeof MutationObserver!=='undefined')createEmployeeStaffChatRuntime().attach();
