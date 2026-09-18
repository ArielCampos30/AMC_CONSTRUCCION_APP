export const UGC_TERMS_VERSION='2026-09-18-v1';
export const UGC_TERMS_URL='https://amcconstrucciones.com.ar/terminos.html';
export const UGC_PRIVACY_URL='https://amcconstrucciones.com.ar/privacidad.html';

const acceptedFlag=value=>value===true||['true','1','on','yes'].includes(String(value||'').toLowerCase());

export function ugcComplianceFeatures({db,all,get,put,notifyAdmins,send,fail,text,now,sha,origin}){
 const enforced=String(origin||'').startsWith('https://');
 const userEligible=user=>!!user&&['client','employee'].includes(user.role);
 const acceptance=user=>userEligible(user)?all('ugcTermsAcceptance',user.id).find(item=>item.version===UGC_TERMS_VERSION):null;
 const hasAccepted=user=>!userEligible(user)||!!acceptance(user);
 const accept=user=>{
  if(!userEligible(user))return null;
  const record={id:'ugc-terms-'+sha(user.id+':'+UGC_TERMS_VERSION),userId:user.id,version:UGC_TERMS_VERSION,acceptedAt:now()};
  return put('ugcTermsAcceptance',user.id,record);
 };
 const requireRegistrationAcceptance=body=>{if(enforced&&!acceptedFlag(body?.acceptTerms))fail(400,'Para crear tu cuenta tenés que aceptar los Términos de uso y la Política de privacidad.');};
 const requireAccepted=user=>{if(enforced&&userEligible(user)&&!hasAccepted(user))fail(428,'Antes de enviar contenido, aceptá los Términos de uso desde Mi perfil.');};
 const needsAcceptanceForPath=({p,method,user})=>{
  if(!enforced||!userEligible(user)||!['POST','PUT','PATCH'].includes(method))return false;
  return p==='/api/upload'||p==='/api/client-chat/messages'||p==='/api/staff-chat/messages'||p==='/api/reviews'||p==='/api/referrals'||p==='/api/requests'||/^\/api\/requests\/[^/]+\/(edit|messages)$/.test(p)||/^\/api\/assignments\/[^/]+\/(report|visit-sheet|materials)$/.test(p)||/^\/api\/works\/[^/]+\/receipts$/.test(p);
 };
 const conversationAccess=(user,scope,participantId)=>{
  participantId=text(participantId,120);
  if(!participantId||!['client','staff'].includes(scope))fail(400,'Conversación inválida.');
  if(scope==='client'){
   const client=db.prepare("SELECT id,name,role,active FROM users WHERE id=? AND role='client'").get(participantId);
   if(!client||!client.active)fail(404,'Cliente no encontrado.');
   if(user.role==='client'&&user.id!==participantId)fail(404,'Conversación no encontrada.');
   if(!['admin','client'].includes(user.role))fail(404,'Conversación no encontrada.');
   return {scope,participantId,targetLabel:user.role==='admin'?client.name:'AMC / Administración'};
  }
  const employee=db.prepare("SELECT id,name,role,active FROM users WHERE id=? AND role='employee'").get(participantId);
  if(!employee||!employee.active)fail(404,'Empleado no encontrado.');
  if(user.role==='employee'&&user.id!==participantId)fail(404,'Conversación no encontrada.');
  if(!['admin','employee'].includes(user.role))fail(404,'Conversación no encontrada.');
  return {scope,participantId,targetLabel:user.role==='admin'?employee.name:'AMC / Administración'};
 };
 const activeBlocks=(scope,participantId)=>all('ugcBlock').filter(item=>item.active&&item.scope===scope&&item.participantId===participantId);
 const blockState=(user,scope,participantId)=>{
  const rows=activeBlocks(scope,participantId);
  return {blocked:rows.length>0,blockedBySelf:rows.some(item=>item.blockedByUserId===user.id),blockedByOther:rows.some(item=>item.blockedByUserId!==user.id),rows};
 };
 const setBlock=(user,body)=>{
  const access=conversationAccess(user,text(body.scope,20),body.participantId),id='ugc-block-'+sha(user.id+':'+access.scope+':'+access.participantId),previous=all('ugcBlock',user.id).find(item=>item.id===id),active=body.blocked!==false;
  const record={id,scope:access.scope,participantId:access.participantId,blockedByUserId:user.id,blockedByName:user.name,blockedByRole:user.role,targetLabel:access.targetLabel,active,createdAt:previous?.createdAt||now(),updatedAt:now()};
  put('ugcBlock',user.id,record);
  return record;
 };
 const requireConversationOpen=(user,scope,participantId)=>{
  conversationAccess(user,scope,participantId);
  if(activeBlocks(scope,participantId).length)fail(409,'Este chat está bloqueado. Si lo bloqueaste vos, podés desbloquearlo desde la conversación.');
 };
 const guardMessage=({p,method,b,user})=>{
  if(method!=='POST')return;
  if(p==='/api/client-chat/messages'){
   const participantId=user.role==='client'?user.id:text(b.clientId,120);
   requireConversationOpen(user,'client',participantId);return;
  }
  if(p==='/api/staff-chat/messages'){
   const participantId=user.role==='employee'?user.id:text(b.employeeId,120);
   requireConversationOpen(user,'staff',participantId);return;
  }
  const requestMatch=p.match(/^\/api\/requests\/([^/]+)\/messages$/);
  if(requestMatch){const request=get('request',requestMatch[1]);requireConversationOpen(user,'client',request.userId);}
 };
 const resolveReportContent=(user,kind,contentId)=>{
  let content,targetUserId,targetName,scope='',participantId='',preview='';
  if(kind==='clientMessage'){
   content=get('clientMessage',contentId);participantId=content.clientId;conversationAccess(user,'client',participantId);targetUserId=content.senderId;targetName=content.senderName;scope='client';preview=text(content.text,220)||(content.photos?.length?'Imagen adjunta':'Mensaje');
  }else if(kind==='staffMessage'){
   content=get('staffMessage',contentId);participantId=content.employeeId;conversationAccess(user,'staff',participantId);targetUserId=content.senderId;targetName=content.senderName;scope='staff';preview=text(content.text,220)||(content.photos?.length?'Imagen adjunta':'Mensaje');
  }else if(kind==='message'){
   content=get('message',contentId);const request=get('request',content.requestId);participantId=request.userId;conversationAccess(user,'client',participantId);targetUserId=content.senderId;targetName=content.senderName;scope='client';preview=text(content.text,220)||(content.photos?.length?'Imagen adjunta':'Mensaje');
  }else if(kind==='review'){
   content=get('review',contentId);if(!content.approved&&user.role!=='admin')fail(404,'Contenido no encontrado.');targetUserId=content.userId;targetName=content.name;preview=text(content.text,220);scope='';participantId='';
  }else fail(400,'Tipo de contenido inválido.');
  if(!targetUserId)fail(400,'No se pudo identificar al autor del contenido.');
  if(targetUserId===user.id)fail(400,'No podés reportar tu propio contenido.');
  return {kind,contentId,targetUserId,targetName:targetName||'Usuario AMC',scope,participantId,preview};
 };
 const report=(user,body)=>{
  const item=resolveReportContent(user,text(body.contentKind,40),text(body.contentId,160)),id='ugc-report-'+sha(user.id+':'+item.kind+':'+item.contentId),existing=all('ugcReport',user.id).find(row=>row.id===id);
  if(existing)return existing;
  const record={id,reporterId:user.id,reporterName:user.name,reporterRole:user.role,contentKind:item.kind,contentId:item.contentId,targetUserId:item.targetUserId,targetName:item.targetName,scope:item.scope,participantId:item.participantId,preview:item.preview,reason:text(body.reason,500)||'Contenido reportado desde AMC.',status:'Pendiente',createdAt:now(),resolvedAt:'',resolvedBy:''};
  put('ugcReport',user.id,record);
  notifyAdmins('Contenido reportado',user.name+' reportó contenido de '+record.targetName+'.','/#resenas','important');
  return record;
 };
 const resolveReport=(user,id)=>{
  if(user.role!=='admin')fail(403,'Este acceso es exclusivo de AMC.');
  const current=get('ugcReport',id);if(current.status==='Revisado')return current;
  const updated={...current,status:'Revisado',resolvedAt:now(),resolvedBy:user.id};put('ugcReport',current.reporterId,updated);return updated;
 };
 const relevantBlocks=user=>{
  const rows=all('ugcBlock').filter(item=>item.active);
  if(user.role==='admin')return rows;
  if(user.role==='client')return rows.filter(item=>item.scope==='client'&&item.participantId===user.id);
  if(user.role==='employee')return rows.filter(item=>item.scope==='staff'&&item.participantId===user.id);
  return [];
 };
 const state=user=>({
  enforced,
  termsVersion:UGC_TERMS_VERSION,
  termsUrl:UGC_TERMS_URL,
  privacyUrl:UGC_PRIVACY_URL,
  termsAccepted:hasAccepted(user),
  termsRequired:enforced&&userEligible(user)&&!hasAccepted(user),
  acceptedAt:acceptance(user)?.acceptedAt||'',
  blocks:relevantBlocks(user),
  reports:user.role==='admin'?all('ugcReport').sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).slice(0,100):[]
 });
 const route=({p,method,b,user,res})=>{
  if(method==='POST'&&p==='/api/ugc/terms/accept'){
   if(!acceptedFlag(b.accepted))fail(400,'Confirmá la aceptación de los Términos de uso.');const record=accept(user);send(res,200,{ok:true,record});return true;
  }
  if(method==='POST'&&p==='/api/ugc/reports'){
   const record=report(user,b);send(res,201,{ok:true,report:record});return true;
  }
  if(method==='POST'&&p==='/api/ugc/blocks'){
   const block=setBlock(user,b);send(res,200,{ok:true,block,state:blockState(user,block.scope,block.participantId)});return true;
  }
  const match=p.match(/^\/api\/ugc\/reports\/([^/]+)\/resolve$/);
  if(method==='POST'&&match){const record=resolveReport(user,match[1]);send(res,200,{ok:true,report:record});return true;}
  return false;
 };
 return {enforced,accept,hasAccepted,requireRegistrationAcceptance,requireAccepted,needsAcceptanceForPath,guardMessage,blockState,state,route};
}
