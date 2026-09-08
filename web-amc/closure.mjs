export function closureFeatures({db,all,get,put,transaction,requireAdmin,safeFile,notify,notifyAdmins,send,fail,text,now,sha}){
 const visible=u=>u.role==='admin'?all('closure'):u.role==='client'?all('closure',u.id):[];
 const hasClientAccount=w=>!!db.prepare("SELECT id FROM users WHERE id=? AND role='client' AND active=1").get(w.userId);
 async function route({p,method,b,user,res}){let m;
  if(method==='POST'&&(m=p.match(/^\/api\/works\/([^/]+)\/closure$/))){
   requireAdmin(user);const w=get('work',m[1]);if(w.status!=='Finalizado')fail(409,'El cierre se registra después de que el equipo termina la obra.');
   if(!/^[\w-]{8,100}$/.test(b.idempotencyKey||''))fail(400,'Referencia inválida.');
   const k='closure-'+sha(user.id+':'+b.idempotencyKey),old=all('closure').find(x=>x.id===k);if(old){send(res,200,old);return true;}
   if(all('closure').some(x=>x.workId===w.id&&['Pendiente de conformidad','Conforme','Cerrado sin respuesta','Cerrado internamente'].includes(x.status)))fail(409,'Esta obra ya tiene un cierre vigente o archivado.');
   const photos=Array.isArray(b.photos)?b.photos:[];if(!text(b.summary,4000)||photos.length>4)fail(400,'Detallá lo realizado. Podés adjuntar hasta cuatro fotos opcionales.');
   const images=photos.map(p=>safeFile(user,p,'image/')),requiresConformity=hasClientAccount(w),status=requiresConformity?'Pendiente de conformidad':'Cerrado internamente';
   const x=transaction(()=>{const c=put('closure',w.userId,{id:k,userId:w.userId,workId:w.id,title:w.title,summary:text(b.summary,4000),pending:text(b.pending,4000),photos:images,status,requiresConformity,date:now(),closedAt:requiresConformity?null:now()});put('work',w.userId,{...w,status:'Finalizado',closureId:c.id,closureStatus:c.status});if(requiresConformity)notify(w.userId,'Revisá el cierre de tu obra','La obra ya está finalizada. Podés dar conformidad o informar observaciones sobre el cierre.','/#cierre');return c;});
   send(res,201,x);return true;
  }
  if(method==='POST'&&(m=p.match(/^\/api\/closures\/([^/]+)\/reply$/))){
   const c=get('closure',m[1]);if(user.role!=='client'||c.userId!==user.id||c.requiresConformity===false)fail(404,'Cierre no encontrado.');
   if(!['Conforme','Observaciones'].includes(b.status))fail(400,'Respuesta inválida.');if(c.status===b.status){send(res,200,{ok:true});return true;}if(c.status!=='Pendiente de conformidad')fail(409,'Este cierre ya fue respondido.');
   if(b.status==='Observaciones'&&!text(b.message,4000))fail(400,'Detallá qué querés que AMC revise.');
   transaction(()=>{put('closure',c.userId,{...c,status:b.status,message:text(b.message,4000),repliedAt:now()});const w=get('work',c.workId);put('work',w.userId,{...w,status:'Finalizado',closureId:c.id,closureStatus:b.status});if(b.status==='Conforme')notify(c.userId,'Gracias por revisar el cierre','La obra ya estaba finalizada; tu conformidad quedó registrada. Podés dejar una reseña.','/#resenas');notifyAdmins('Respuesta al cierre de obra',user.name+' · '+b.status);});
   send(res,200,{ok:true});return true;
  }
  if(method==='POST'&&(m=p.match(/^\/api\/closures\/([^/]+)\/close-without-reply$/))){
   requireAdmin(user);const c=get('closure',m[1]);if(c.status==='Cerrado sin respuesta'){send(res,200,{ok:true});return true;}if(c.status!=='Pendiente de conformidad')fail(409,'Sólo se puede archivar un cierre que todavía espera respuesta.');
   transaction(()=>{put('closure',c.userId,{...c,status:'Cerrado sin respuesta',closedAt:now(),closedBy:user.id});const w=get('work',c.workId);put('work',w.userId,{...w,status:'Finalizado',closureId:c.id,closureStatus:'Cerrado sin respuesta'});if(hasClientAccount(w))notify(c.userId,'Cierre registrado por AMC','La obra sigue finalizada. Si necesitás informar algo, podés escribirnos desde tu cuenta.','/#cierre');});
   send(res,200,{ok:true});return true;
  }
  return false;
 }
 return {route,state:u=>({closures:visible(u)}),media:(u,p)=>visible(u).some(c=>(c.photos||[]).includes(p))};
}
