import {estimatorTariffs} from './tariff-catalog.mjs';

export function adminUtilityRoutes({all,get,put,requireAdmin,safeFile,send,fail,text,sha,now}){
 return function route({p,method,b,user,res}){
  if(p==='/api/offline-notes'&&method==='POST'){
   requireAdmin(user);if(!/^[\w-]{8,100}$/.test(b.idempotencyKey||'')||!text(b.text,4000)||!Array.isArray(b.photos)||b.photos.length>4)fail(400,'Informe inválido.');
   const key='offline-note-'+sha(user.id+':'+b.idempotencyKey),old=all('offlineNote',user.id).find(x=>x.id===key);if(old){send(res,200,old);return true;}
   const task=get('assignment',b.assignmentId);if(['Cancelada','Finalizada'].includes(task.status))fail(409,'La asignación ya terminó o fue cancelada.');const photos=b.photos.map(x=>safeFile(user,x,'image/'));
   send(res,201,put('offlineNote',user.id,{id:key,assignmentId:task.id,title:task.clientName+' · '+task.day,text:text(b.text,4000),photos,date:now()}));return true;
  }
  if(p==='/api/estimator-tariffs'&&method==='GET'){
   requireAdmin(user);const saved=all('estimator',user.id)[0];send(res,200,{items:estimatorTariffs(saved?.db||{}),updatedAt:saved?.updatedAt||null});return true;
  }
  return false;
 };
}
