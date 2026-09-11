const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const when=value=>{try{return new Date(value).toLocaleString('es-AR')}catch{return ''}};
const media=urls=>(urls||[]).length?`<div class="mini-photos">${urls.map(url=>`<a href="${esc(url)}" target="_blank" rel="noopener"><img src="${esc(url)}" alt="Foto del empleado"></a>`).join('')}</div>`:'';

export function renderEmployeeStaffMessages(messages=[],readAt=''){
 const rows=[...(Array.isArray(messages)?messages:[])].sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||String(a.id||'').localeCompare(String(b.id||'')));
 return rows.map(message=>{const mine=message.senderRole==='employee',read=mine&&readAt&&message.date<=readAt;return `<article class="message ${mine?'mine':''}"><p>${esc(message.text)}</p>${media(message.photos)}<small class="message-meta"><span>${when(message.date)}</span>${mine?`<span class="message-check ${read?'read':''}" title="${read?'Leído':'Enviado'}">✓</span>`:''}</small></article>`;}).join('')||'<p>Sin mensajes todavía.</p>';
}

export async function hydrateEmployeeStaffChat(root,fetchImpl=fetch){
 if(!root)return false;
 const response=await fetchImpl('/api/staff-chat/messages',{credentials:'same-origin'});
 if(!response.ok)throw Error('No se pudo cargar el chat con Administración.');
 const data=await response.json(),log=root.querySelector?.('.employee-message-log');
 if(!log)return false;
 log.innerHTML=renderEmployeeStaffMessages(data.messages,data.readAt||'');
 log.scrollTop=log.scrollHeight;
 return true;
}

if(typeof document!=='undefined'&&typeof MutationObserver!=='undefined'){
 const style=document.createElement('style');
 style.textContent=`
 @keyframes amc-employee-spin{to{transform:rotate(360deg)}}
 .employee-staff-chat[data-staff-chat-loading="1"] .employee-message-log::before{content:"";width:22px;height:22px;align-self:center;flex:0 0 auto;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:amc-employee-spin .7s linear infinite;opacity:.65;margin:.4rem}
 .employee-staff-chat .staff-message button[data-amc-sending="1"]{display:inline-flex;align-items:center;justify-content:center;gap:.5rem}
 .employee-send-spinner{display:inline-block;width:18px;height:18px;flex:0 0 18px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:amc-employee-spin .7s linear infinite}
 @media(max-width:560px){.employee-staff-chat .staff-message textarea{font-size:16px!important;scroll-margin-bottom:140px}.employee-staff-chat .staff-message{scroll-margin-bottom:120px}}
 `;
 document.head.append(style);
 let activeRoot=null,draft='',focusWanted=false,selectionStart=0,selectionEnd=0,focusReleaseTimer=0;
 const textareaOf=root=>root?.querySelector('.staff-message textarea[name="text"]');
 const reveal=textarea=>requestAnimationFrame(()=>textarea?.scrollIntoView?.({block:'nearest',inline:'nearest',behavior:'auto'}));
 const rememberSelection=textarea=>{selectionStart=textarea?.selectionStart??0;selectionEnd=textarea?.selectionEnd??selectionStart;};
 const restoreComposer=root=>{
  const textarea=textareaOf(root);if(!textarea)return;
  if(draft&&!textarea.value)textarea.value=draft;
  if(!focusWanted)return;
  requestAnimationFrame(()=>{if(!textarea.isConnected)return;try{textarea.focus({preventScroll:true});textarea.setSelectionRange(Math.min(selectionStart,textarea.value.length),Math.min(selectionEnd,textarea.value.length));}catch{}reveal(textarea);});
 };
 const hydrateVisible=()=>{
  const root=document.querySelector('.employee-staff-chat');
  if(!root){activeRoot=null;return;}
  if(root===activeRoot)return;
  activeRoot=root;restoreComposer(root);root.dataset.staffChatLoading='1';
  hydrateEmployeeStaffChat(root).catch(()=>{}).finally(()=>{if(root===activeRoot)delete root.dataset.staffChatLoading;restoreComposer(root);});
 };
 const target=document.getElementById('app')||document.body;
 new MutationObserver(hydrateVisible).observe(target,{childList:true});
 document.addEventListener('input',event=>{const textarea=event.target.closest?.('.employee-staff-chat .staff-message textarea[name="text"]');if(!textarea)return;draft=textarea.value;rememberSelection(textarea);});
 document.addEventListener('focusin',event=>{const textarea=event.target.closest?.('.employee-staff-chat .staff-message textarea[name="text"]');if(!textarea)return;clearTimeout(focusReleaseTimer);focusWanted=true;draft=textarea.value;rememberSelection(textarea);reveal(textarea);});
 document.addEventListener('focusout',event=>{if(!event.target.closest?.('.employee-staff-chat .staff-message textarea[name="text"]'))return;clearTimeout(focusReleaseTimer);focusReleaseTimer=setTimeout(()=>{const active=document.activeElement;if(!active?.closest?.('.employee-staff-chat'))focusWanted=false;},180);});
 document.addEventListener('submit',event=>{
  const form=event.target.closest?.('.employee-staff-chat .staff-message');if(!form)return;
  const textarea=form.elements?.text,button=form.querySelector('button[type="submit"],button:not([type])');if(!button)return;
  draft=textarea?.value||draft;rememberSelection(textarea);focusWanted=false;button.dataset.amcSending='1';button.innerHTML='<span class="employee-send-spinner" aria-hidden="true"></span><span>Enviando…</span>';
  if(window.matchMedia?.('(max-width:560px)').matches&&document.activeElement===textarea)textarea.blur();
  let disabledSeen=false;
  const observer=new MutationObserver(()=>{if(button.disabled){disabledSeen=true;return;}if(!disabledSeen)return;observer.disconnect();if(textarea?.isConnected)draft=textarea.value||'';if(button.isConnected){delete button.dataset.amcSending;if(button.querySelector('.employee-send-spinner'))button.textContent='Enviar';}});
  observer.observe(button,{attributes:true,attributeFilter:['disabled']});setTimeout(()=>{observer.disconnect();if(button.isConnected){delete button.dataset.amcSending;if(button.querySelector('.employee-send-spinner'))button.textContent='Enviar';}},12000);
 },{capture:true});
 window.visualViewport?.addEventListener('resize',()=>{const textarea=document.activeElement?.closest?.('.employee-staff-chat .staff-message textarea[name="text"]');if(textarea)reveal(textarea);},{passive:true});
 queueMicrotask(hydrateVisible);
}
