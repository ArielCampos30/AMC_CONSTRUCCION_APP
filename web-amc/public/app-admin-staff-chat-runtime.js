export function adminStaffMessageRows(messages=[],readAt=''){
 return [...(Array.isArray(messages)?messages:[])].sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||String(a.id||'').localeCompare(String(b.id||''))).map(message=>({
  id:String(message.id||''),
  mine:message.senderRole==='admin',
  senderName:message.senderName||(message.senderRole==='admin'?'AMC':'Equipo AMC'),
  text:message.text||'',
  date:message.date||'',
  time:message.date?new Date(message.date).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}):'',
  read:message.senderRole==='admin'&&!!readAt&&message.date<=readAt,
 }));
}

export function renderAdminStaffMessages(log,messages,readAt,{documentRef=globalThis.document}={}){
 if(!log)return false;
 const rows=adminStaffMessageRows(messages,readAt),serverIds=new Set(rows.map(message=>message.id)),local=[...log.querySelectorAll('.message.optimistic,.message[data-message-id]')].filter(node=>!serverIds.has(node.dataset.messageId||''));
 log.replaceChildren();
 for(const message of rows){
  const article=documentRef.createElement('article');article.className='message'+(message.mine?' mine':'');article.dataset.messageId=message.id;
  const strong=documentRef.createElement('strong');strong.textContent=message.senderName;
  const text=documentRef.createElement('p');text.textContent=message.text;text.style.whiteSpace='pre-wrap';
  const meta=documentRef.createElement('small');meta.className='message-meta';
  const time=documentRef.createElement('span');time.textContent=message.time;meta.append(time);
  if(message.mine){const check=documentRef.createElement('span');check.className='message-check'+(message.read?' read':'');check.title=message.read?'Leído':'Enviado';check.textContent='✓';meta.append(check);}
  article.append(strong,text,meta);log.append(article);
 }
 for(const node of local)log.append(node);
 if(!rows.length&&!local.length){const empty=documentRef.createElement('div');empty.className='empty-conversation';empty.textContent='Sin mensajes todavía.';log.append(empty);}
 return true;
}

export function createAdminStaffChatRuntime({documentRef=globalThis.document,fetchImpl=globalThis.fetch,requestAnimationFrameRef=globalThis.requestAnimationFrame,setTimeoutRef=globalThis.setTimeout}={}){
 let floatingEmployeeId='',staffHydration=0;
 const scrollFloatingStaffEnd=()=>requestAnimationFrameRef(()=>{const log=documentRef.querySelector('#amc-chat-dialog[open] .floating-staff-message')?.closest('.compact-thread')?.querySelector('.message-log');if(log)log.scrollTop=log.scrollHeight;});
 const hydrateFloatingStaffChat=async()=>{
  const dialog=documentRef.querySelector('#amc-chat-dialog[open]'),form=dialog?.querySelector('.floating-staff-message'),log=form?.closest('.compact-thread')?.querySelector('.message-log'),employeeId=floatingEmployeeId;if(!dialog||!form||!log||!employeeId)return false;
  const run=++staffHydration;scrollFloatingStaffEnd();
  try{const response=await fetchImpl('/api/staff-chat/messages?employeeId='+encodeURIComponent(employeeId),{credentials:'same-origin'});if(!response.ok)throw Error();const data=await response.json();if(run!==staffHydration||!dialog.open||!dialog.contains(form))return false;renderAdminStaffMessages(log,data.messages,data.readAt||'',{documentRef});scrollFloatingStaffEnd();return true;}catch{scrollFloatingStaffEnd();return false;}
 };
 const onPointerDown=event=>{const row=event.target.closest?.('#amc-chat-dialog .chat-contact[data-contact]');if(row)floatingEmployeeId=row.dataset.contact||'';};
 const onClick=event=>{if(event.target.closest?.('.chat-contact[data-contact],.floating-chat-button'))setTimeoutRef(hydrateFloatingStaffChat,0);};
 const onSubmit=event=>{if(event.target.matches?.('#amc-chat-dialog .floating-staff-message')){event.target.closest('.compact-thread')?.querySelector('.empty-conversation')?.remove();setTimeoutRef(scrollFloatingStaffEnd,0);}};
 function attach(){documentRef.addEventListener('pointerdown',onPointerDown,true);documentRef.addEventListener('click',onClick);documentRef.addEventListener('submit',onSubmit,{capture:true});}
 return {attach,hydrateFloatingStaffChat,scrollFloatingStaffEnd,getEmployeeId:()=>floatingEmployeeId};
}

if(typeof document!=='undefined')createAdminStaffChatRuntime().attach();
