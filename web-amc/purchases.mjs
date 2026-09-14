export function purchaseFeatures({all,get,put,transaction,requireAdmin,safeFile,notify,send,fail,text,amount,validDate,now,sha}){
 const operation=(user,value,prefix)=>{if(!/^[\w-]{8,100}$/.test(value||''))fail(400,'Referencia de operación inválida.');return prefix+sha(user.id+':'+value);};
 const previous=(kind,k)=>all(kind).find(x=>x.id===k);
 const purchaseView=user=>user.role==='admin'?all('purchase'):user.role==='client'?all('purchase',user.id).filter(x=>x.sentAt):[];
 const media=(user,p)=>purchaseView(user).some(x=>x.file===p);
 async function route({p,method,b,user,res}){let m;
  if(method==='POST'&&p==='/api/purchases'){requireAdmin(user);const k=operation(user,b.idempotencyKey,'purchase-'),old=previous('purchase',k);if(old){send(res,200,old);return true;}const r=get('request',b.requestId);if(!validDate(b.day)||b.day>now().slice(0,10)||!text(b.vendor)||!text(b.detail,4000)||!text(b.reference))fail(400,'Completá fecha, comercio, comprobante y detalle de la compra.');const purchase=put('purchase',r.userId,{id:k,userId:r.userId,requestId:r.id,clientName:r.name,service:r.service,day:b.day,vendor:text(b.vendor),reference:text(b.reference),detail:text(b.detail,4000),amount:amount(b.amount),file:safeFile(user,b.fileId),createdBy:user.id,date:now(),sentAt:null});send(res,201,purchase);return true;}
  if(method==='POST'&&(m=p.match(/^\/api\/purchases\/([^/]+)\/send$/))){requireAdmin(user);const purchase=get('purchase',m[1]);if(!purchase.sentAt)transaction(()=>{put('purchase',purchase.userId,{...purchase,sentAt:now()});notify(purchase.userId,'AMC compartió una compra','Podés ver el detalle y la factura o recibo de tu proyecto.','/#compras');});send(res,200,{ok:true});return true;}
  return false;
 }
 return {route,media,state:user=>({purchases:purchaseView(user)})};
}
