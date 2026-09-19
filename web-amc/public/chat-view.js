let thread='',top=0,follow=true,force=true,resize;

const visibleLog=()=>document.querySelector('#amc-chat-dialog[open] .message-log')||[...document.querySelectorAll('.message-log')].find(log=>log.getClientRects().length)||document.querySelector('.message-log');
const scrollLatest=log=>{if(!log)return;log.scrollTop=log.scrollHeight;requestAnimationFrame(()=>{if(log.isConnected)log.scrollTop=log.scrollHeight;});};

export const chatViewport={
 open(){force=true;},
 capture(id){const log=visibleLog();if(log&&thread===id){top=log.scrollTop;follow=log.scrollHeight-log.clientHeight-top<90;}},
 mount(page,id){resize?.disconnect();if(page!=='mensajes'){force=true;return;}const log=visibleLog();if(!log)return;const opening=force||thread!==id;thread=id;force=false;if(opening)follow=true;
  const bottom=()=>{if(follow)log.scrollTop=log.scrollHeight;};
  const settled=()=>{bottom();log.dispatchEvent(new Event('scroll'));};
  log.scrollTop=follow?log.scrollHeight:top;
  log.addEventListener('scroll',()=>{top=log.scrollTop;follow=log.scrollHeight-log.clientHeight-top<90;},{passive:true});
  log.querySelectorAll('img').forEach(img=>img.addEventListener('load',settled,{once:true}));
  resize=new ResizeObserver(settled);resize.observe(log);requestAnimationFrame(()=>{settled();if(opening&&!log.closest('#amc-chat-dialog'))log.scrollIntoView({block:'center'});});
 }
};

let groupRefreshAt=0,groupRefreshPromise=null;
const unreadStaffNotices=notices=>{
 const byEmployee={};let total=0;
 for(const notice of Array.isArray(notices)?notices:[]){
  if(notice?.read)continue;
  const hash=String(notice?.url||'').split('#')[1]||'';
  if(!hash.startsWith('chat-equipo'))continue;
  const employeeId=decodeURIComponent(hash.split('/').slice(1).join('/')||'');
  total+=1;if(employeeId)byEmployee[employeeId]=(byEmployee[employeeId]||0)+1;
 }
 return {total,byEmployee};
};
const unreadClients=state=>Object.values(state?.clientChatUnread||{}).reduce((sum,value)=>sum+Number(value||0),0);
const ensureBadge=(host,className,count,label)=>{
 let badge=host?.querySelector?.(':scope > .'+className);
 if(!host||!count){badge?.remove();return;}
 if(!badge){badge=document.createElement('span');badge.className=className;host.append(badge);}
 badge.textContent=count>99?'99+':String(count);badge.setAttribute('aria-label',count+' '+label+' sin leer');
};
async function refreshUnreadIndicators(dialog){
 if(!dialog?.open||!document.body.classList.contains('admin-v3'))return;
 const hasGroups=dialog.querySelector('.chat-group-list'),hasContacts=dialog.querySelector('.chat-contact-list');
 if(!hasGroups&&!hasContacts)return;
 if(groupRefreshPromise)return groupRefreshPromise;
 if(Date.now()-groupRefreshAt<800&&dialog.dataset.amcUnreadDecorated==='1')return;
 groupRefreshAt=Date.now();
 groupRefreshPromise=(async()=>{
  try{
   const response=await fetch('/api/state',{credentials:'same-origin',headers:{Accept:'application/json'}});if(!response.ok)return;
   const state=await response.json(),clientTotal=unreadClients(state),staff=unreadStaffNotices(state.notices);
   for(const button of dialog.querySelectorAll('.chat-group')){
    const label=button.querySelector('strong')?.textContent?.trim()||'';
    ensureBadge(button,'chat-group-unread',label==='Clientes'?clientTotal:label==='Empleados'?staff.total:0,'mensajes');
   }
   const heading=dialog.querySelector('.chat-heading strong')?.textContent?.trim()||'';
   if(heading==='Empleados')for(const row of dialog.querySelectorAll('.chat-contact[data-contact]'))ensureBadge(row,'chat-contact-unread',staff.byEmployee[row.dataset.contact]||0,'mensajes');
   dialog.dataset.amcUnreadDecorated='1';
  }catch{}finally{groupRefreshPromise=null;}
 })();
 return groupRefreshPromise;
}
function decorateThreadKind(dialog){
 const heading=dialog?.querySelector('.chat-heading');if(!heading)return;
 const thread=dialog.querySelector('.compact-thread'),staff=thread?.querySelector('.floating-staff-message'),client=thread?.querySelector('.message-form[data-client]');
 let kind='';
 if(staff)kind=document.body.classList.contains('employee-v4')?'ADMINISTRACIÓN':'EMPLEADO';
 else if(client)kind=document.body.classList.contains('client-v5')?'AMC':'CLIENTE';
 let badge=heading.querySelector('.chat-kind-badge');
 if(!kind){badge?.remove();return;}
 if(!badge){badge=document.createElement('span');badge.className='chat-kind-badge';heading.append(badge);}
 badge.textContent=kind;badge.setAttribute('aria-label','Tipo de conversación: '+kind.toLocaleLowerCase('es-AR'));
}
function animateOutgoing(node){
 if(!(node instanceof Element))return;
 const bubbles=[];if(node.matches('.message.mine.optimistic'))bubbles.push(node);bubbles.push(...node.querySelectorAll?.('.message.mine.optimistic')||[]);
 for(const bubble of bubbles){if(bubble.dataset.amcSendAnimated==='1')continue;bubble.dataset.amcSendAnimated='1';bubble.classList.add('message-send-flight');bubble.addEventListener('animationend',()=>bubble.classList.remove('message-send-flight'),{once:true});scrollLatest(bubble.closest('.message-log'));}
}
function enhanceMutation(mutations){
 const dialog=document.getElementById('amc-chat-dialog');let threadInserted=false;
 for(const mutation of mutations)for(const node of mutation.addedNodes){if(!(node instanceof Element))continue;animateOutgoing(node);if(node.matches('.compact-thread')||node.querySelector?.('.compact-thread'))threadInserted=true;}
 if(dialog?.open){decorateThreadKind(dialog);refreshUnreadIndicators(dialog);if(threadInserted){const log=dialog.querySelector('.compact-thread .message-log');scrollLatest(log);}}
}
if(typeof MutationObserver!=='undefined'&&document.body){const observer=new MutationObserver(enhanceMutation);observer.observe(document.body,{childList:true,subtree:true});document.addEventListener('click',event=>{if(event.target.closest?.('.floating-chat-button,.chat-group,.chat-contact'))queueMicrotask(()=>{const dialog=document.getElementById('amc-chat-dialog');if(dialog?.open){decorateThreadKind(dialog);refreshUnreadIndicators(dialog);}});});}

const previewUrls=new WeakMap();
export function previewChatPhotos(input){
 (previewUrls.get(input)||[]).forEach(URL.revokeObjectURL);const urls=[];previewUrls.set(input,urls);input.parentElement.querySelector('.chat-photo-preview')?.remove();
 const preview=document.createElement('div');preview.className='chat-photo-preview';preview.setAttribute('aria-live','polite');
 const files=[...input.files];if(files.length>4){preview.textContent='Elegí hasta cuatro fotos por mensaje.';input.value='';}else files.forEach((file,index)=>{const item=document.createElement('span'),link=document.createElement('a'),img=document.createElement('img'),remove=document.createElement('button');img.src=URL.createObjectURL(file);link.href=img.src;urls.push(img.src);img.alt='Foto adjunta '+(index+1);link.append(img);remove.type='button';remove.textContent='Quitar';remove.onclick=()=>{const transfer=new DataTransfer();files.filter((_,i)=>i!==index).forEach(f=>transfer.items.add(f));input.files=transfer.files;previewChatPhotos(input);};item.append(link,remove);preview.append(item);});
 input.parentElement.append(preview);
}
const style=document.createElement('style');style.textContent='.conversation{max-width:850px;margin-inline:auto}.message-log{height:48dvh;min-height:220px;max-height:550px;overflow-y:auto;overscroll-behavior:contain;overflow-anchor:none;padding:12px;display:flex;flex-direction:column;gap:12px}.message{max-width:88%;overflow-wrap:anywhere;border-radius:16px;padding:12px 16px;background:var(--mint);align-self:flex-start}.message.mine{align-self:flex-end;background:#d8eee9}.message p{white-space:normal;margin:8px 0}.message small{display:block;font-size:11px}.message-meta{display:flex!important;align-items:center;justify-content:flex-end;gap:4px}.message-check{font-size:14px;font-weight:900;line-height:1;color:#8d9997}.message-check.read{color:#159164}.message-upload-spinner{display:inline-block;width:11px;height:11px;border:2px solid #b6c9c4;border-top-color:#0d6661;border-radius:50%;animation:amc-msg-spin .8s linear infinite}.upload-state{min-height:14px}.message-form{padding-top:12px}.chat-photo-preview{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}.chat-photo-preview span{display:grid;gap:4px}.chat-photo-preview img{width:76px;height:76px;object-fit:cover;border-radius:8px}.chat-photo-preview button{font-size:12px;padding:6px}.message .mini-photos img{width:110px;height:95px;object-fit:cover}.message.optimistic{opacity:.88}.message.optimistic.failed{border:1px solid #b42318}.retry-message,.load-older{font-size:12px;padding:6px 10px;min-height:34px}.load-older{align-self:center;background:#eef4f2}.chat-kind-badge{display:inline-flex!important;align-items:center;width:max-content;margin-top:2px;padding:2px 7px;border-radius:999px;background:#d8eee9;color:#0d6661;font-size:9px!important;font-weight:900;letter-spacing:.07em}.chat-group{position:relative}.chat-group-unread{position:absolute;top:10px;right:10px;min-width:22px;height:22px;padding:0 6px;box-sizing:border-box;border-radius:999px;background:#19864c;color:#fff;display:grid;place-items:center;font-size:11px;font-weight:900}.message.mine.optimistic.message-send-flight{transform-origin:right bottom;animation:amc-message-send-flight .28s cubic-bezier(.22,.8,.3,1) both}@keyframes amc-message-send-flight{0%{opacity:.18;transform:translate3d(16px,28px,0) scale(.92)}72%{opacity:1;transform:translate3d(-2px,-2px,0) scale(1.01)}100%{opacity:.88;transform:none}}@media(prefers-reduced-motion:reduce){.message.mine.optimistic.message-send-flight{animation:none}}@keyframes amc-msg-spin{to{transform:rotate(360deg)}}';document.head.append(style);
