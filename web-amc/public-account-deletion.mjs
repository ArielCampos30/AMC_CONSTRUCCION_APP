export function publicAccountDeletionFeatures({all,put,notifyAdmins,send,fail,text,now,sha}){
 const generic={ok:true,message:'Recibimos la solicitud. AMC va a verificar la identidad de la cuenta antes de procesarla.'};
 const emailValue=value=>text(value,254).trim().toLowerCase();
 async function route({p,method,b,res}){
  if(p!=='/api/public/account-deletion'||method!=='POST')return false;
  const submissionId=text(b.submissionId,120),website=text(b.website,300),email=emailValue(b.email),reason=text(b.reason,1000);
  if(website){send(res,202,generic);return true;}
  if(!/^[\w-]{8,120}$/.test(submissionId||''))fail(400,'Referencia inválida.');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail(400,'Ingresá el correo de tu cuenta AMC.');
  const existing=all('accountDeletionRequest').find(item=>String(item.email||'').toLowerCase()===email&&item.status==='Pendiente');
  if(existing){send(res,200,generic);return true;}
  const id='account-deletion-web-'+sha(submissionId),record={id,userId:null,email,name:'Solicitud web',status:'Pendiente',source:'web',verification:'Pendiente',reason,date:now()};
  put('accountDeletionRequest','',record);
  notifyAdmins('Solicitud web de eliminación de cuenta',email+' pidió eliminar una cuenta de AMC. Verificá la identidad antes de procesarla.','/#clientes');
  send(res,201,generic);return true;
 }
 return {route};
}
