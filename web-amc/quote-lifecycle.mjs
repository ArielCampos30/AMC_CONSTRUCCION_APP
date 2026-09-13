const DAY=86400000,MINUTE=60000;
export function quoteLifecycle({all,put,transaction,notify,notifyAdmins,clock=Date.now}){
 const terms=()=>({date:new Date(clock()).toISOString(),expiresAt:new Date(clock()+10*DAY).toISOString(),responseDays:10,reminderStage:0});
 // Store the deadline for older quotes without modifying their original PDF.
 for(const q of all('quote'))if(!q.archivedAt&&!q.expiresAt&&q.date)put('quote',q.userId,{...q,expiresAt:new Date(Date.parse(q.date)+10*DAY).toISOString(),responseDays:10,reminderStage:0});
 let checkedAt=-Infinity;
 function run({throttle=false}={}){const timestamp=clock();if(throttle&&timestamp>=checkedAt&&timestamp-checkedAt<MINUTE)return;checkedAt=timestamp;for(const q of all('quote')){
  if(q.archivedAt||q.status!=='Enviado')continue;
  const deadline=Date.parse(q.expiresAt);if(!Number.isFinite(deadline))continue;
  if(timestamp>=deadline){transaction(()=>{put('quote',q.userId,{...q,status:'Vencido',expiredAt:new Date(timestamp).toISOString()});const r=all('request').find(r=>r.id===q.requestId);if(r&&!all('work').some(w=>w.requestId===r.id))put('request',r.userId,{...r,status:'En contacto',statusUpdatedAt:new Date(timestamp).toISOString()});notify(q.userId,'Venció el plazo del presupuesto',q.number+' quedó sin respuesta dentro de los 10 días. Escribile a AMC para revisarlo.','/#presupuesto/'+q.id);notifyAdmins('Presupuesto sin respuesta',q.number+' venció después de 10 días.','/#presupuesto-admin/'+q.id);});continue;}
  const elapsed=Math.floor((timestamp-(deadline-10*DAY))/DAY),stage=[9,7,3].find(day=>elapsed>=day)||0;
  if(stage<=(q.reminderStage||0))continue;
  const until=new Date(deadline).toLocaleString('es-AR',{timeZone:'America/Buenos_Aires',dateStyle:'short',timeStyle:'short'});
  transaction(()=>{put('quote',q.userId,{...q,reminderStage:stage,lastReminderAt:new Date(timestamp).toISOString()});notify(q.userId,stage===9?'Último recordatorio de tu presupuesto':'Tu presupuesto espera una respuesta',q.number+': podés aceptar, pedir cambios o rechazar hasta el '+until+' (hora de Argentina).','/#presupuesto/'+q.id);});
 }}
 return {terms,run};
}
