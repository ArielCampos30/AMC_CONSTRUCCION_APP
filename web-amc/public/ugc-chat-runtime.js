export function createUgcChatRuntime({getState,api,refresh=async()=>{},toast=()=>{}}){
 let observer=null,attached=false,queued=false;
 const state=()=>getState()||{};
 const activeBlocks=(scope,participantId)=>(state().ugc?.blocks||[]).filter(item=>item.active&&item.scope===scope&&item.participantId===participantId);
 const contextForForm=form=>{
  if(form.classList.contains('floating-staff-message'))return {scope:'staff',participantId:form.dataset.employee||state().user?.id||''};
  return {scope:'client',participantId:form.dataset.client||state().user?.id||''};
 };
 const messageKind=(id,form)=>{
  if(form.classList.contains('floating-staff-message'))return 'staffMessage';
  const message=(state().messages||[]).find(item=>item.id===id);
  return message?.ugcKind||(String(id).startsWith('client-msg-')?'clientMessage':'message');
 };
 const setComposerGate=(form,message='')=>{
  let gate=form.querySelector('.ugc-chat-gate');
  const controls=[...form.querySelectorAll('textarea,input[type=file],button[type=submit]')];
  if(message){
   if(!gate){gate=document.createElement('p');gate.className='ugc-chat-gate';gate.setAttribute('role','status');form.prepend(gate);}
   if(gate.innerHTML!==message)gate.innerHTML=message;
   for(const control of controls)if(!control.disabled){control.dataset.ugcDisabled='1';control.disabled=true;}
  }else{
   gate?.remove();
   for(const control of controls.filter(item=>item.dataset.ugcDisabled==='1')){delete control.dataset.ugcDisabled;control.disabled=false;}
  }
 };
 const ownsBlockSide=item=>state().user?.role==='admin'?item.blockedByRole==='admin':item.blockedByUserId===state().user?.id;
 const decorateForm=form=>{
  const {scope,participantId}=contextForForm(form);if(!participantId)return;
  const log=form.closest('.conversation,.compact-thread')?.querySelector('.message-log')||form.parentElement?.querySelector('.message-log');if(!log)return;
  let controls=log.querySelector(':scope > .ugc-chat-controls');if(!controls){controls=document.createElement('div');controls.className='ugc-chat-controls';log.prepend(controls);}
  const blocks=activeBlocks(scope,participantId),self=blocks.find(ownsBlockSide),other=blocks.find(item=>!ownsBlockSide(item)),mode=self?'self':other?'other':'open';
  if(controls.dataset.mode!==mode||controls.dataset.participantId!==participantId){
   controls.dataset.mode=mode;controls.dataset.participantId=participantId;controls.replaceChildren();
   const label=document.createElement('small');label.textContent='Seguridad de la conversación';controls.append(label);
   if(self){const button=document.createElement('button');button.type='button';button.className='outline ugc-chat-block';button.dataset.ugcBlock='1';button.dataset.scope=scope;button.dataset.participantId=participantId;button.dataset.blocked='false';button.textContent='Desbloquear chat';controls.append(button);}
   else if(!other){const button=document.createElement('button');button.type='button';button.className='outline ugc-chat-block';button.dataset.ugcBlock='1';button.dataset.scope=scope;button.dataset.participantId=participantId;button.dataset.blocked='true';button.textContent='Bloquear chat';controls.append(button);}
   else{const blocked=document.createElement('span');blocked.className='ugc-chat-blocked';blocked.textContent='Chat bloqueado por la otra parte.';controls.append(blocked);}
  }
  if(state().ugc?.termsRequired)setComposerGate(form,'Antes de enviar contenido, aceptá los <a href="#perfil">Términos de uso desde Mi perfil</a>.');
  else if(blocks.length)setComposerGate(form,'Este chat está bloqueado. Los avisos operativos, presupuestos y novedades de obra siguen funcionando normalmente.');
  else setComposerGate(form,'');
  for(const article of log.querySelectorAll('.message:not(.mine)[data-message-id]')){
   if(article.querySelector('[data-ugc-report]'))continue;
   const id=article.dataset.messageId;if(!id)continue;
   const button=document.createElement('button');button.type='button';button.className='ugc-report-action';button.dataset.ugcReport='1';button.dataset.contentId=id;button.dataset.contentKind=messageKind(id,form);button.textContent='Reportar';button.setAttribute('aria-label','Reportar este mensaje');
   (article.querySelector('.message-meta')||article).append(button);
  }
 };
 const observe=()=>{if(observer&&typeof document!=='undefined'&&document.body)observer.observe(document.body,{childList:true,subtree:true});};
 const decorate=root=>{
  if(!root?.querySelectorAll)return;
  observer?.disconnect();
  try{for(const form of root.querySelectorAll('.message-form'))decorateForm(form);}finally{observe();}
 };
 const schedule=()=>{if(queued||typeof document==='undefined')return;queued=true;queueMicrotask(()=>{queued=false;decorate(document);});};
 const confirmAction=async(message,options)=>typeof globalThis.window?.AMCConfirm==='function'?globalThis.window.AMCConfirm(message,options):globalThis.confirm?.(message)!==false;
 const click=async event=>{
  const report=event.target.closest?.('[data-ugc-report]');
  if(report){
   event.preventDefault();if(report.disabled)return;
   if(!await confirmAction('¿Querés reportar este contenido a Administración para que sea revisado?',{title:'Reportar contenido',confirmLabel:'Reportar'}))return;
   report.disabled=true;
   try{await api('/api/ugc/reports',{contentKind:report.dataset.contentKind,contentId:report.dataset.contentId,reason:'Contenido reportado desde la conversación.'});report.textContent='Reportado';toast('Reporte enviado a Administración.');}catch(error){report.disabled=false;toast(error?.message||'No se pudo enviar el reporte.');}
   return;
  }
  const block=event.target.closest?.('[data-ugc-block]');
  if(!block)return;
  event.preventDefault();if(block.disabled)return;
  const next=block.dataset.blocked==='true';
  const question=next?'¿Bloquear este chat? No podrán enviarse nuevos mensajes hasta que se desbloquee. Los avisos operativos de AMC seguirán funcionando.':'¿Desbloquear este chat para permitir nuevos mensajes?';
  if(!await confirmAction(question,{title:next?'Bloquear chat':'Desbloquear chat',confirmLabel:next?'Bloquear':'Desbloquear'}))return;
  block.disabled=true;
  try{await api('/api/ugc/blocks',{scope:block.dataset.scope,participantId:block.dataset.participantId,blocked:next});await refresh();if(typeof document!=='undefined')decorate(document);toast(next?'Chat bloqueado.':'Chat desbloqueado.');}catch(error){block.disabled=false;toast(error?.message||'No se pudo cambiar el bloqueo.');}
 };
 const attach=()=>{
  if(attached||typeof document==='undefined')return;attached=true;
  document.addEventListener('click',click);
  if(typeof MutationObserver!=='undefined'&&document.body){observer=new MutationObserver(schedule);observe();}
  decorate(document);
 };
 return {afterRender(){if(typeof document==='undefined')return;attach();decorate(document);},decorate};
}

if(typeof document!=='undefined'&&!document.getElementById('ugc-chat-runtime-style')){
 const style=document.createElement('style');style.id='ugc-chat-runtime-style';style.textContent=`
 .ugc-chat-controls{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:6px 8px;margin:0 0 6px;border:1px solid #d8e4e0;border-radius:10px;background:#f7fbfa;color:#47645e}
 .ugc-chat-controls small{margin-right:auto}.ugc-chat-block{min-height:30px!important;padding:4px 9px!important;font-size:12px!important}.ugc-chat-blocked{font-size:12px;font-weight:700;color:#8a3f32}
 .ugc-chat-gate{grid-column:1/-1;margin:0;padding:8px 10px;border-radius:9px;background:#fff4d8;color:#5f4916;font-size:12px}.ugc-chat-gate a{font-weight:800;color:inherit;text-decoration:underline}
 .ugc-report-action{border:0;background:transparent;color:#667c77;padding:0 0 0 8px;min-height:auto;font-size:10px;text-decoration:underline}.ugc-report-action:disabled{opacity:.65}
 `;document.head?.append(style);
}
