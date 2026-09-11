export function notificationFeatures({db,all,put,origin,now,id,schedulePush,send,requireAdmin,text,fail}){
 const lifecycleTitles=new Set(['Tu presupuesto espera una respuesta','Último recordatorio de tu presupuesto','Venció el plazo del presupuesto']);
 const notify=(userId,title,body,url='/#avisos',priority='normal')=>{
  const notice=put('notice',userId,{id:id(),userId,title,body,url,priority,read:false,date:now()});
  const pushTitle=priority==='urgent'?'URGENTE · AMC':lifecycleTitles.has(title)?title:'AMC Construcciones y Arreglos';
  const pushBody=priority==='urgent'?'Tenés una asignación urgente. Confirmá la recepción en AMC.':lifecycleTitles.has(title)?'Abrí AMC para revisar el plazo y responder.':'Tenés una nueva novedad. Abrí AMC para verla.';
  for(const device of db.prepare('SELECT id FROM devices WHERE userId=?').all(userId)){
   db.prepare('INSERT INTO delivery(id,deviceId,noticeId,body) VALUES(?,?,?,?)').run(id(),device.id,notice.id,JSON.stringify({title:pushTitle,body:pushBody,priority,url,id:notice.id}));
  }
  if(priority==='urgent')schedulePush();
  return notice;
 };
 const notifyAdmins=(title,body,url='/#inicio',priority='normal')=>db.prepare("SELECT id FROM users WHERE role='admin'").all().forEach(user=>notify(user.id,title,body,url,priority));
 const noticeRouteInfo=value=>{
  let hash='';
  try{hash=new URL(String(value||''),origin).hash.replace(/^#/,'');}catch{}
  if(!hash)hash=String(value||'').replace(/^#|^\/#/g,'');
  const [head,...parts]=hash.split('/'),key=decodeURIComponent(parts.join('/')||''),specifics=[];
  const add=value=>{if(value&&!specifics.includes(value))specifics.push(value);};
  if(['chat','chat-admin'].includes(head)&&key){add('chat:'+key);return {specifics,section:'chat'};}
  if(head==='chat-equipo'){add(key?'staff-chat:'+key:'staff-chat');return {specifics,section:'staff-chat',broad:!key};}
  if(['solicitud','mi-trabajo'].includes(head)&&key){add('request:'+key);return {specifics,section:'requests'};}
  if(head==='solicitudes')return {specifics,section:'requests',broad:true};
  if(['presupuesto','presupuesto-admin'].includes(head)&&key){add('quote:'+key);return {specifics,section:'quotes'};}
  if(head==='presupuestos')return {specifics,section:'quotes',broad:true};
  if(['obra','obra-admin'].includes(head)&&key){add('work:'+key);const work=all('work').find(work=>work.id===key);if(work?.requestId)add('request:'+work.requestId);return {specifics,section:'works'};}
  if(head==='obras')return {specifics,section:'works',broad:true};
  if(head==='trabajo'&&key){add('task:'+key);return {specifics,section:'tasks'};}
  if(['tareas','mis-trabajos','inicio-empleado'].includes(head))return {specifics,section:'tasks',broad:true};
  if(['agenda','adicionales','comprobantes','cierre','compras','fichas','materiales','recuperar-cuentas','resenas'].includes(head)){add('section:'+head);return {specifics,section:head,broad:true};}
  return {specifics};
 };
 const markNoticeRead=(user,notice)=>{
  if(notice.read)return false;
  put('notice',user.id,{...notice,read:true,readAt:now()});
  db.prepare('DELETE FROM delivery WHERE noticeId=?').run(notice.id);
  return true;
 };
 const markNoticesForRoute=(user,route)=>{
  const target=noticeRouteInfo(route),ids=[];
  if(!target.specifics.length&&!target.section)return ids;
  for(const notice of all('notice',user.id).filter(notice=>!notice.read)){
   const source=noticeRouteInfo(notice.url),specificMatch=target.specifics.some(value=>source.specifics.includes(value)),match=target.broad?!!target.section&&source.section===target.section:specificMatch||!!source.broad&&!!target.section&&source.section===target.section;
   if(match&&markNoticeRead(user,notice))ids.push(notice.id);
  }
  return ids;
 };
 const deleteNotices=(user,{id:noticeId,scope}={})=>{
  let targets=all('notice',user.id);
  if(noticeId)targets=targets.filter(notice=>notice.id===noticeId);
  else if(scope==='read')targets=targets.filter(notice=>notice.read);
  else if(scope!=='all')fail(400,'Indicá qué avisos querés borrar.');
  for(const notice of targets){db.prepare('DELETE FROM delivery WHERE noticeId=?').run(notice.id);db.prepare("DELETE FROM docs WHERE id=? AND kind='notice' AND owner=?").run(notice.id,user.id);}
  return targets.map(notice=>notice.id);
 };
 function route({p,method,b,user,res}){
  if(method!=='POST')return false;
  if(p==='/api/notices/read'){
   let noticeIds=[];
   if(b.route)noticeIds=markNoticesForRoute(user,b.route);
   else for(const notice of all('notice',user.id).filter(notice=>!notice.read&&(!b.id||notice.id===b.id)))if(markNoticeRead(user,notice))noticeIds.push(notice.id);
   send(res,200,{ok:true,noticeIds});
   return true;
  }
  if(p==='/api/notices/delete'){
   const noticeIds=deleteNotices(user,b||{});send(res,200,{ok:true,noticeIds});return true;
  }
  if(p==='/api/notices/test'){
   notify(user.id,'Notificación de prueba','Si habilitaste los avisos, revisá tu dispositivo.');
   send(res,201,{ok:true});
   return true;
  }
  if(p==='/api/notices'){
   requireAdmin(user);
   const recipient=db.prepare("SELECT id FROM users WHERE id=? AND role='client'").get(b.userId);
   if(!recipient||!text(b.title)||!text(b.body))fail(400,'Elegí cliente, título y mensaje.');
   notify(recipient.id,text(b.title),text(b.body,2000));
   send(res,201,{ok:true});
   return true;
  }
  return false;
 }
 return {notify,notifyAdmins,markNoticeRead,markNoticesForRoute,route};
}
