import {createFloatingChat} from './floating-chat.js';
import {chatViewport,previewChatPhotos} from './chat-view.js';

export function createChatFeatures({getState,isAdmin,esc,heading,empty,thumb,api,upload,navigate,toast,onNoticesRead=()=>{}}){
 let threadId='';
 const uploadedPhotos=new WeakMap(),limits=new Map(),pending=new Map();
 const s=()=>getState(),requests=()=>s().chatRequests||s().requests||[],key=()=>crypto.randomUUID();
 const reqOptions=(selected='')=>requests().map(r=>`<option value="${r.id}" ${selected===r.id?'selected':''}>${s().chatUnread?.[r.id]?'🟢 '+s().chatUnread[r.id]+' sin leer · ':''}${esc(isAdmin()?r.name+' · ':'')}${esc((r.services||[r.service]).filter(Boolean).join(' · '))} · ${r.id.slice(-6)}</option>`).join('');
 const paintPending=x=>{const log=document.querySelector('.message-log'),follow=log?log.scrollHeight-log.clientHeight-log.scrollTop<90:false;let el=document.querySelector(`[data-pending-id="${x.id}"]`);if(!el){el=document.createElement('article');el.className='message mine optimistic';el.dataset.pendingId=x.id;log?.append(el);}el.classList.toggle('failed',x.state==='Error');const status=x.state==='Error'?`<small class="message-meta">Error</small><button type="button" class="retry-message" data-pending-id="${x.id}">Reintentar</button>`:`<small class="message-meta upload-state" aria-label="Enviando"><span class="message-upload-spinner" aria-hidden="true"></span>${x.progress>0?'<span>'+x.progress+'%</span>':''}</small>`;el.innerHTML=`<p>${esc(x.text).replace(/\n/g,'<br>')}</p><div class="mini-photos">${x.urls.map(url=>`<img src="${url}" alt="Foto pendiente">`).join('')}</div>${status}`;if(follow)log.scrollTop=log.scrollHeight;};
 const releasePending=x=>{x.urls.forEach(URL.revokeObjectURL);pending.delete(x.id);document.querySelector(`[data-pending-id="${x.id}"]`)?.remove();};

 function chat(){
  chatViewport.capture(threadId);const rs=requests();if(!rs.length)return heading('CONVERSACIONES','Mensajes')+empty('Todavía no tenés conversaciones','Cuando envíes una solicitud podrás hablar directamente con AMC Construcciones.');
  const r=rs.find(x=>x.id===threadId)||rs[0];threadId=r.id;const allMessages=s().messages.filter(m=>m.requestId===r.id).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id)),limit=limits.get(r.id)||60,messages=allMessages.slice(-limit),older=allMessages.length-messages.length;
  const readMarker=s().chatReadByOther?.[r.id],readThrough=readMarker?allMessages.findIndex(m=>m.id===readMarker):-1;
  const rows=messages.map(m=>{const mine=m.senderId===s().user.id,index=allMessages.findIndex(x=>x.id===m.id),read=mine&&readThrough>=0&&index>=0&&index<=readThrough,time=new Date(m.date).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}),check=mine?`<span class="message-check ${read?'read':''}" title="${read?'Leído':'Enviado'}" aria-label="${read?'Leído':'Enviado'}">✓</span>`:'';return `<article class="message ${mine?'mine':''}" data-message-id="${m.id}"><strong>${esc(m.senderName)}${m.senderRole==='admin'?' · AMC':''}</strong><p>${esc(m.text).replace(/\n/g,'<br>')}</p>${thumb(m.photos,{sender:m.senderName,date:m.date})}<small class="message-meta" title="${esc(new Date(m.date).toLocaleString('es-AR'))}"><span>${time}</span>${check}</small></article>`}).join('');
  const optimistic=[...pending.values()].filter(x=>x.requestId===r.id).map(x=>{const status=x.state==='Error'?`<small class="message-meta">Error</small><button type="button" class="retry-message" data-pending-id="${x.id}">Reintentar</button>`:`<small class="message-meta upload-state" aria-label="Enviando"><span class="message-upload-spinner" aria-hidden="true"></span>${x.progress>0?'<span>'+x.progress+'%</span>':''}</small>`;return `<article class="message mine optimistic ${x.state==='Error'?'failed':''}" data-pending-id="${x.id}"><p>${esc(x.text).replace(/\n/g,'<br>')}</p><div class="mini-photos">${x.urls.map(url=>`<img src="${url}" alt="Foto pendiente">`).join('')}</div>${status}</article>`}).join('');
  return heading('TODO EN UN SOLO LUGAR',isAdmin()?'Mensajes del proyecto':'AMC Construcciones')+(isAdmin()?`<label>Cliente y trabajo<select id="conversation-select">${reqOptions(r.id)}</select></label>`:'')+`<section class="conversation panel"><div class="conversation-title"><h2>${esc((r.services||[r.service]).filter(Boolean).join(' · '))}</h2><span>${isAdmin()?esc(r.name)+' · '+esc(r.town):'Conversación directa con Administración'}</span></div><div class="message-log" role="log" aria-label="Mensajes del pedido">${older?`<button type="button" class="load-older" data-request="${r.id}">Cargar ${Math.min(60,older)} mensajes anteriores</button>`:''}${rows}${optimistic||(!messages.length?'<div class="empty-conversation">Este es el espacio para hablar de tu proyecto. Podés enviar mensajes y fotos.</div>':'')}</div><form class="message-form" data-request="${r.id}" data-key="${key()}"><label>Tu mensaje<textarea name="text" rows="3" maxlength="4000" placeholder="Escribí sobre este proyecto…"></textarea></label><label>Agregar fotos (hasta 4)<input name="photos" type="file" multiple accept="image/jpeg,image/png,image/webp"></label><button type="submit" class="primary">Enviar mensaje</button></form></section>`;
 }

 async function submit(form,data){
  if(!form.classList.contains('message-form'))return false;
  if(form.dataset.sending==='1')return 'message-sent';
  const senderId=s().user?.id,sendButton=form.querySelector('button[type=submit]'),files=[...form.elements.photos.files];
  if(files.length>4)throw Error('Elegí hasta cuatro fotos.');
  if(!String(data.text).trim()&&!files.length)throw Error('Escribí un mensaje o adjuntá una foto.');
  form.dataset.sending='1';if(sendButton)sendButton.disabled=true;
  let item=[...pending.values()].find(x=>x.form===form);if(!item){item={id:key(),requestId:form.dataset.request,form,text:String(data.text||''),files,urls:files.map(URL.createObjectURL),state:'Enviando',progress:0};pending.set(item.id,item);}else{item.state='Enviando';item.progress=0;}
  const preview=form.querySelector('.chat-photo-preview');if(preview)preview.hidden=true;paintPending(item);
  let status=form.querySelector('.chat-send-status');if(!status){status=document.createElement('p');status.className='chat-send-status';status.setAttribute('role','status');status.hidden=true;form.append(status);}
  try{
   const photos=[];for(const file of item.files){let saved=uploadedPhotos.get(file);if(!saved||saved.userId!==senderId){const result=await upload(file,percent=>{item.progress=percent;paintPending(item);},false);saved={id:result.id,userId:senderId};uploadedPhotos.set(file,saved);}photos.push(saved.id);}
   if(s().user?.id!==senderId)throw Error('La sesión cambió. Volvé a ingresar antes de enviar.');
   item.state='Enviando';item.progress=100;paintPending(item);
   const message=await api('/api/requests/'+form.dataset.request+'/messages',{text:item.text,photos,idempotencyKey:form.dataset.key});
   if(s().user?.id!==senderId)return 'message-sent';
   if(!s().messages.some(m=>m.id===message.id))s().messages.push(message);
   item.state='Enviado';paintPending(item);form.reset();previewChatPhotos(form.elements.photos);if(form.classList.contains('compact-composer'))form.elements.text.style.height='40px';form.querySelector('.chat-photo-preview')?.remove();form.dataset.key=key();form.dataset.sending='0';if(sendButton)sendButton.disabled=false;status.textContent='';status.hidden=true;setTimeout(()=>releasePending(item),180);chatViewport.open();setTimeout(updateChat,360);return 'message-sent';
  }catch(error){form.dataset.sending='0';if(sendButton)sendButton.disabled=false;releasePending(item);if(preview)preview.hidden=false;const raw=String(error?.message||''),friendly=/source image could not be decoded|decode|encodingerror|invalidstateerror/i.test(raw)?'No pudimos preparar esta foto. Probá con otra imagen o sacala nuevamente.':(raw||'No se pudo enviar. La foto sigue adjunta para volver a intentar.');status.hidden=false;status.textContent=friendly;throw Error(friendly);}
 }

 function change(target){if(target.id==='conversation-select'){threadId=target.value;chatViewport.open();if(floating.isOpen()){floating.open(true);return false;}return true;}return false;}
 function selectChat(requestId){if(!requests().some(r=>r.id===requestId))return false;floating.close?.();threadId=requestId;chatViewport.open();return true;}
 function openChat(requestId){if(['admin','client'].includes(s().user?.role)){if(!selectChat(requestId))return toast('El chat está disponible para tus solicitudes y trabajos.');floating.open(true);return;}threadId=requestId;chatViewport.open();navigate('mensajes');}
 function afterRender(page){const fullPageChat=(s().user?.role==='client'&&(page==='chat-cliente'||page.startsWith('chat/')))||(s().user?.role==='admin'&&(page==='chat-admin'||page.startsWith('chat-admin/'))),quotePage=page==='cotizador';document.body.classList.toggle('full-chat-page',fullPageChat);document.body.classList.toggle('client-chat-page',s().user?.role==='client'&&fullPageChat);document.body.classList.toggle('quote-wizard-route',quotePage);if(fullPageChat||quotePage)floating.close?.();const chatPage=['chat-cliente','chat-admin'].includes(page)||page.startsWith('chat/')||page.startsWith('chat-admin/')?'mensajes':page;syncChatAccess();chatViewport.mount(chatPage,threadId);}
 function updateChat(){if(!document.querySelector('.message-log'))return;const box=document.createElement('div');box.innerHTML=chat();const next=box.querySelector('.message-log'),current=document.querySelector('.message-log'),select=document.querySelector('#conversation-select');if(select)select.innerHTML=reqOptions(threadId);if(next&&current.innerHTML!==next.innerHTML){current.replaceWith(next);chatViewport.mount('mensajes',threadId);}markRead();}

 document.addEventListener('click',e=>{const older=e.target.closest('.load-older');if(older){const log=older.closest('.message-log'),height=log.scrollHeight;limits.set(older.dataset.request,(limits.get(older.dataset.request)||60)+60);updateChat();const next=document.querySelector('.message-log');if(next)next.scrollTop=next.scrollHeight-height;return;}const retry=e.target.closest('.retry-message');if(retry){const item=pending.get(retry.dataset.pendingId),form=item?.form?.isConnected?item.form:document.querySelector(`.message-form[data-request="${item?.requestId||''}"]`);if(form){item.form=form;form.requestSubmit();}}});
 document.addEventListener('change',e=>{if(e.target.matches('.message-form input[type=file]'))previewChatPhotos(e.target);});

 function floatingClientContacts(){
  if(!isAdmin())return requests().map(r=>{const messages=s().messages.filter(m=>m.requestId===r.id).sort((a,b)=>b.date.localeCompare(a.date));return {id:r.id,kind:'client',name:'AMC',service:r.service,unread:s().chatUnread?.[r.id]||0,last:messages[0]?.text||(messages[0]?.photos?.length?'Foto':'Sin mensajes'),date:messages[0]?.date||''};});
  const grouped=new Map();
  for(const r of requests()){
   const clientKey=r.leadId||r.userId||((r.name||'')+'|'+(r.phone||'')),profile=(s().agendaClients||[]).find(x=>x.id===clientKey),messages=s().messages.filter(m=>m.requestId===r.id).sort((a,b)=>b.date.localeCompare(a.date)),latest=messages[0],current={id:r.id,kind:'client',clientKey,name:profile?.name||r.name||'Cliente',service:r.service||'Proyecto',unread:s().chatUnread?.[r.id]||0,last:latest?.text||(latest?.photos?.length?'Foto':'Sin mensajes'),date:latest?.date||r.date||'',conversations:1};
   const previous=grouped.get(clientKey);
   if(!previous){grouped.set(clientKey,current);continue;}
   previous.unread+=current.unread;previous.conversations++;
   if((current.date||'')>(previous.date||'')){previous.id=current.id;previous.service=current.service;previous.last=current.last;previous.date=current.date;}
  }
  return [...grouped.values()].map(c=>({...c,service:c.conversations>1?c.conversations+' conversaciones · '+c.service:c.service}));
 }
 function floatingEmployeeContacts(){return (s().employees||[]).filter(e=>e.role==='employee'&&e.active!==false).map(employee=>{const messages=(s().staffMessages||[]).filter(m=>m.employeeId===employee.id).sort((a,b)=>b.date.localeCompare(a.date)),last=messages[0];return {id:employee.id,kind:'employee',name:employee.name,service:employee.specialty||'Equipo AMC',unread:0,last:last?.text||(last?.photos?.length?'Foto':'Sin mensajes'),date:last?.date||''};});}
 function floatingStaffThread(contact){const messages=(s().staffMessages||[]).filter(m=>m.employeeId===contact.id).sort((a,b)=>a.date.localeCompare(b.date)),readAt=s().staffReadByEmployee?.[contact.id]||'';return '<section class="conversation"><div class="message-log" role="log" aria-label="Mensajes con '+esc(contact.name)+'">'+(messages.map(m=>{const mine=m.senderRole==='admin',read=mine&&readAt&&m.date<=readAt;return '<article class="message '+(mine?'mine':'')+'" data-message-id="'+esc(m.id)+'"><strong>'+esc(m.senderName||contact.name)+'</strong><p>'+esc(m.text||'').replace(/\n/g,'<br>')+'</p><small class="message-meta"><span>'+new Date(m.date).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})+'</span>'+(mine?'<span class="message-check '+(read?'read':'')+'" title="'+(read?'Leído':'Enviado')+'">✓</span>':'')+'</small></article>'}).join('')||'<div class="empty-conversation">Sin mensajes todavía.</div>')+'</div><form class="message-form floating-staff-message"><textarea name="text" rows="1" maxlength="4000" placeholder="Mensaje…"></textarea><button type="submit" class="primary">Enviar</button></form></section>';}

 const floating=createFloatingChat({
  allowed:()=>isAdmin()?((requests().length>0)||floatingEmployeeContacts().length>0):requests().length>0,
  label:()=>{const n=Object.values(s().chatUnread||{}).reduce((a,b)=>a+b,0);return (n?'🟢 '+n+' sin leer · ':'◌ ')+(isAdmin()?'Chats':'Conversar con AMC');},
  groups:()=>isAdmin()?[{id:'clients',label:'Clientes',subtitle:'Presupuestos, solicitudes y obras',searchPlaceholder:'Buscar cliente'},{id:'employees',label:'Empleados',subtitle:'Equipo AMC',searchPlaceholder:'Buscar empleado'}]:[],
  contacts:group=>isAdmin()&&group==='employees'?floatingEmployeeContacts():floatingClientContacts(),
  current:()=>threadId,
  select:(id,contact)=>{if(contact?.kind!=='employee'){threadId=id;chatViewport.open();}},
  renderChat:chat,
  customThread:contact=>contact?.kind==='employee'?floatingStaffThread(contact):'',
  submitCustom:async(contact,payload)=>{const message=await api('/api/staff-chat/messages',{employeeId:contact.id,text:payload.text,idempotencyKey:payload.idempotencyKey});if(!(s().staffMessages||[]).some(x=>x.id===message.id))s().staffMessages.push(message);return message;},
  mounted:contact=>{if(contact?.kind==='employee'){if(isAdmin())api('/api/staff-chat/read',{employeeId:contact.id}).then(result=>onNoticesRead(result.noticeIds||[])).catch(()=>{});return;}updateChat();chatViewport.mount('mensajes',threadId);markRead();}
 });
 function syncChatAccess(){floating.sync(s().user?.id);if(floating.isOpen()&&floating.kind()!=='employee')updateChat();}
 const reading=new Set();function markRead(){if(floating.kind()==='employee')return;const log=document.querySelector('.message-log'),last=s().chatLatest?.[threadId],id=threadId,uid=s().user?.id;if(document.hidden||!uid||!log?.getClientRects().length||!last||!s().messages.some(m=>m.id===last&&m.requestId===id)||log.scrollHeight-log.clientHeight-log.scrollTop>90||!s().chatUnread?.[id]||reading.has(last))return;reading.add(last);api('/api/requests/'+id+'/messages/read',{lastMessageId:last}).then(result=>{onNoticesRead(result.noticeIds||[]);if(s().user?.id===uid&&s().chatLatest?.[id]===last){s().chatUnread[id]=0;floating.sync(uid);const option=document.querySelector('#conversation-select option:checked');if(option)option.textContent=option.textContent.replace(/^🟢 \d+ sin leer · /,'');}}).catch(()=>{}).finally(()=>reading.delete(last));}
 document.addEventListener('scroll',e=>{if(e.target.matches?.('.message-log'))markRead();},{capture:true,passive:true});

 return {selectChat,syncChatAccess,updateChat,render:name=>name==='mensajes'?chat():undefined,submit,change,openChat,afterRender};
}
