import {hydrateEmployeeStaffChat} from './employee-staff-chat-view.js';

export function createEmployeeStaffChatRuntime({
 documentRef=globalThis.document,
 windowRef=globalThis.window,
 MutationObserverRef=globalThis.MutationObserver,
 requestAnimationFrameRef=globalThis.requestAnimationFrame,
 setTimeoutRef=globalThis.setTimeout,
 clearTimeoutRef=globalThis.clearTimeout,
 queueMicrotaskRef=globalThis.queueMicrotask,
 fetchImpl=globalThis.fetch,
 onHydrationError=error=>globalThis.console?.warn?.('[AMC staff chat]',String(error?.message||error||'Error')),
 retryDelayMs=1500,
}={}){
 let activeRoot=null,draft='',focusWanted=false,selectionStart=0,selectionEnd=0,focusReleaseTimer=0,hydrateRetryTimer=0,hydrateAttempts=0;
 const textareaOf=root=>root?.querySelector('.staff-message textarea[name="text"]');
 const reveal=textarea=>requestAnimationFrameRef(()=>textarea?.scrollIntoView?.({block:'nearest',inline:'nearest',behavior:'auto'}));
 const rememberSelection=textarea=>{selectionStart=textarea?.selectionStart??0;selectionEnd=textarea?.selectionEnd??selectionStart;};
 const restoreComposer=root=>{
  const textarea=textareaOf(root);if(!textarea)return;
  if(draft&&!textarea.value)textarea.value=draft;
  if(!focusWanted)return;
  requestAnimationFrameRef(()=>{if(!textarea.isConnected)return;try{textarea.focus({preventScroll:true});textarea.setSelectionRange(Math.min(selectionStart,textarea.value.length),Math.min(selectionEnd,textarea.value.length));}catch{}reveal(textarea);});
 };
 const clearHydrationError=root=>{
  delete root?.dataset?.staffChatError;
  const notice=root?.querySelector?.('[data-staff-chat-load-error]');notice?.remove?.();
 };
 const showHydrationError=root=>{
  if(!root)return;
  root.dataset.staffChatError='1';
  const log=root.querySelector?.('.employee-message-log');
  if(!log||log.querySelector?.('[data-staff-chat-load-error]'))return;
  log.insertAdjacentHTML?.('afterbegin','<p class="muted" role="status" data-staff-chat-load-error>AMC no pudo actualizar el chat. Reintentando…</p>');
 };
 const hydrateRoot=root=>{
  if(!root)return;
  root.dataset.staffChatLoading='1';hydrateAttempts++;
  hydrateEmployeeStaffChat(root,fetchImpl).then(()=>{hydrateAttempts=0;clearHydrationError(root);}).catch(error=>{
   if(error?.name==='AbortError')return;
   showHydrationError(root);onHydrationError?.(error,{attempt:hydrateAttempts});
   if(root===activeRoot&&hydrateAttempts<2){clearTimeoutRef(hydrateRetryTimer);hydrateRetryTimer=setTimeoutRef(()=>hydrateRoot(root),retryDelayMs);}
  }).finally(()=>{if(root===activeRoot)delete root.dataset.staffChatLoading;restoreComposer(root);});
 };
 const hydrateVisible=()=>{
  const root=documentRef.querySelector('.employee-staff-chat');
  if(!root){activeRoot=null;hydrateAttempts=0;clearTimeoutRef(hydrateRetryTimer);return;}
  if(root===activeRoot)return;
  activeRoot=root;hydrateAttempts=0;clearTimeoutRef(hydrateRetryTimer);restoreComposer(root);hydrateRoot(root);
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
