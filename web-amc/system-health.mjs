export function createSystemHealth({db,version,remoteUrl,objectStore,recentErrorCount,startedAt,clock=Date.now}){
 const backupMonitor=()=>{
  const row=db.prepare("SELECT body FROM docs WHERE kind='monitor' AND id='backup-status'").get();
  if(!row)return {status:'unknown',lastSuccessAt:null,lastAttemptAt:null};
  try{
   const value=JSON.parse(row.body);
   return {
    status:['ok','failed','running'].includes(value.status)?value.status:'unknown',
    lastSuccessAt:value.lastSuccessAt||null,
    lastAttemptAt:value.lastAttemptAt||null
   };
  }catch{
   return {status:'unknown',lastSuccessAt:null,lastAttemptAt:null};
  }
 };
 const backupHealth=()=>{
  const backup=backupMonitor(),stamp=Date.parse(backup.lastSuccessAt||'');
  return {
   backupStatus:backup.status,
   backupAgeHours:Number.isFinite(stamp)?Math.round((clock()-stamp)/36000)/100:null,
   backupLastSuccessAt:backup.lastSuccessAt
  };
 };
 const systemStatus=()=>{
  const deliveryRows=db.prepare("SELECT status,count(*) AS n FROM delivery GROUP BY status").all();
  const delivery=Object.fromEntries(deliveryRows.map(r=>[r.status,Number(r.n||0)]));
  return {
   version,
   database:remoteUrl?'PostgreSQL':'SQLite',
   users:Number(db.prepare('SELECT count(*) AS n FROM users WHERE active=1').get().n||0),
   documents:Number(db.prepare('SELECT count(*) AS n FROM docs').get().n||0),
   files:Number(db.prepare('SELECT count(*) AS n FROM files').get().n||0),
   storageBytes:Number(db.prepare('SELECT coalesce(sum(length(body)),0) AS total FROM files').get().total||0),
   fileStorageMode:objectStore.mode,
   devices:Number(db.prepare('SELECT count(*) AS n FROM devices').get().n||0),
   delivery,
   errors5xx15m:recentErrorCount(),
   ...backupHealth(),
   uptimeSeconds:Math.floor((clock()-startedAt)/1000)
  };
 };
 return {backupHealth,systemStatus};
}
