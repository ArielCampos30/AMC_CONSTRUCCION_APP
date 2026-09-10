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
 let activeRoot=null;
 const hydrateVisible=()=>{
  const root=document.querySelector('.employee-staff-chat');
  if(!root){activeRoot=null;return;}
  if(root===activeRoot)return;
  activeRoot=root;
  root.dataset.staffChatLoading='1';
  hydrateEmployeeStaffChat(root).catch(()=>{}).finally(()=>{if(root===activeRoot)delete root.dataset.staffChatLoading;});
 };
 const target=document.getElementById('app')||document.body;
 new MutationObserver(hydrateVisible).observe(target,{childList:true,subtree:true});
 queueMicrotask(hydrateVisible);
}
