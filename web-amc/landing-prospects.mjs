export function landingProspectFeatures({db,all,put,transaction,notifyAdmins,send,fail,text,now,id,sha,services}){
 const normalizePhone=value=>{let phone=text(value,100).replace(/\D/g,'');if(phone.startsWith('54'))phone=phone.slice(2);if(phone.startsWith('9')&&phone.length>=11)phone=phone.slice(1);if(phone.startsWith('0'))phone=phone.slice(1);if(phone.startsWith('15'))phone=phone.slice(2);return phone;};
 const validPhone=value=>{const raw=text(value,100);return /^[0-9+()\s-]+$/.test(raw)&&normalizePhone(raw).length>=8;};
 const campaignValue=value=>text(value,200);
 const allowedServices=new Set([...(services||[]),'Otro']);
 const submissionDoc=submissionId=>'landing-submission-'+sha(submissionId);
 const previousSubmission=submissionId=>{const row=db.prepare("SELECT body FROM docs WHERE kind='landingSubmission' AND id=?").get(submissionDoc(submissionId));return row?JSON.parse(row.body):null;};
 const create=body=>{
  if(text(body.website,200)){send(body.res,202,{ok:true});return;}
  const submissionId=text(body.submissionId,100),name=text(body.name,120),phoneRaw=text(body.phone,100),phoneNormalized=normalizePhone(phoneRaw),town=text(body.town,120),service=text(body.service,120),description=text(body.description,3000);
  if(!/^[a-zA-Z0-9_-]{8,100}$/.test(submissionId))fail(400,'No pudimos validar el envío. Actualizá la página e intentá nuevamente.');
  const previous=previousSubmission(submissionId);if(previous){send(body.res,200,{ok:true});return;}
  if(name.length<2||town.length<2||description.length<8||!service)fail(400,'Completá nombre, localidad, tipo de trabajo y una breve descripción.');
  if(!validPhone(phoneRaw))fail(400,'Ingresá un teléfono o WhatsApp válido.');
  if(!allowedServices.has(service))fail(400,'Elegí un tipo de trabajo válido.');
  const admin=db.prepare("SELECT id FROM users WHERE role='admin' AND active=1 ORDER BY id LIMIT 1").get();if(!admin)fail(503,'AMC no puede recibir consultas en este momento. Intentá nuevamente más tarde.');
  const source={utmSource:campaignValue(body.utmSource),utmMedium:campaignValue(body.utmMedium),utmCampaign:campaignValue(body.utmCampaign),utmContent:campaignValue(body.utmContent),landingReferrer:text(body.referrer,500),landingPage:text(body.page,500)};
  const result=transaction(()=>{
   let lead=all('leadClient').find(item=>normalizePhone(item.phone)===phoneNormalized);
   if(!lead){lead=put('leadClient','',{id:id(),name,phone:phoneRaw,phoneNormalized,town,address:'',note:'Consulta recibida desde la landing de AMC.',date:now(),source:'landing',sourceLabel:'Landing web',...source});}
   else put('leadClient','',{...lead,lastLandingAt:now(),lastLandingCampaign:source.utmCampaign,lastLandingSource:source.utmSource});
   const requestId=id(),request=put('request',admin.id,{id:requestId,solicitudId:requestId,presupuestoIds:[],obraIds:[],schemaVersion:2,userId:admin.id,leadId:lead.id,type:'presupuesto',name,phone:phoneRaw,town,description,service,services:[service],rubrics:services.includes(service)?[service]:[],photos:[],status:'Nueva',date:now(),createdBy:'landing',source:'landing',sourceLabel:'Landing web',...source});
   put('landingSubmission','',{id:submissionDoc(submissionId),requestId:request.id,leadId:lead.id,date:now()});
   return request;
  });
  notifyAdmins('Nueva consulta desde la web',result.name+' · '+result.service,'/#solicitud/'+result.id,'important');
  send(body.res,201,{ok:true});
 };
 return {route:async({p,method,b,res})=>{if(p!=='/api/public/prospects')return false;if(method!=='POST')fail(405,'Método no permitido.');create({...b,res});return true;}};
}
