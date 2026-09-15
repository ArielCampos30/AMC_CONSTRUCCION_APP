export function createSystemHealth({db,version,remoteUrl,objectStore,recentErrorCount,startedAt,clock=Date.now}){
 const emptyBackup=()=>({status:'unknown',lastSuccessAt:null,lastAttemptAt:null,restoreStatus:'unknown',lastRestoreVerifiedAt:null,lastRestoreAttemptAt:null,secondaryStatus:'unknown',secondaryLastSuccessAt:null,secondaryLastAttemptAt:null,secondaryRestoreStatus:'unknown',secondaryLastRestoreVerifiedAt:null,secondaryLastRestoreAttemptAt:null});
 const backupMonitor=()=>{
  const row=db.prepare("SELECT body FROM docs WHERE kind='monitor' AND id='backup-status'").get();
  if(!row)return emptyBackup();
  try{
   const value=JSON.parse(row.body);
   return {
    status:['ok','failed','running'].includes(value.status)?value.status:'unknown',
    lastSuccessAt:value.lastSuccessAt||null,
    lastAttemptAt:value.lastAttemptAt||null,
    restoreStatus:['ok','failed','running'].includes(value.restoreStatus)?value.restoreStatus:'unknown',
    lastRestoreVerifiedAt:value.lastRestoreVerifiedAt||null,
    lastRestoreAttemptAt:value.lastRestoreAttemptAt||null,
    secondaryStatus:['ok','failed','running'].includes(value.secondaryStatus)?value.secondaryStatus:'unknown',
    secondaryLastSuccessAt:value.secondaryLastSuccessAt||null,
    secondaryLastAttemptAt:value.secondaryLastAttemptAt||null,
    secondaryRestoreStatus:['ok','failed','running'].includes(value.secondaryRestoreStatus)?value.secondaryRestoreStatus:'unknown',
    secondaryLastRestoreVerifiedAt:value.secondaryLastRestoreVerifiedAt||null,
    secondaryLastRestoreAttemptAt:value.secondaryLastRestoreAttemptAt||null
   };
  }catch{
   return emptyBackup();
  }
 };
 const backupHealth=()=>{
  const backup=backupMonitor(),stamp=Date.parse(backup.lastSuccessAt||''),restoreStamp=Date.parse(backup.lastRestoreVerifiedAt||''),secondaryStamp=Date.parse(backup.secondaryLastSuccessAt||''),secondaryRestoreStamp=Date.parse(backup.secondaryLastRestoreVerifiedAt||'');
  return {
   backupStatus:backup.status,
   backupAgeHours:Number.isFinite(stamp)?Math.round((clock()-stamp)/36000)/100:null,
   backupLastSuccessAt:backup.lastSuccessAt,
   backupRestoreStatus:backup.restoreStatus,
   backupRestoreAgeHours:Number.isFinite(restoreStamp)?Math.round((clock()-restoreStamp)/36000)/100:null,
   backupRestoreLastVerifiedAt:backup.lastRestoreVerifiedAt,
   backupSecondaryStatus:backup.secondaryStatus,
   backupSecondaryAgeHours:Number.isFinite(secondaryStamp)?Math.round((clock()-secondaryStamp)/36000)/100:null,
   backupSecondaryLastSuccessAt:backup.secondaryLastSuccessAt,
   backupSecondaryRestoreStatus:backup.secondaryRestoreStatus,
   backupSecondaryRestoreAgeHours:Number.isFinite(secondaryRestoreStamp)?Math.round((clock()-secondaryRestoreStamp)/36000)/100:null,
   backupSecondaryRestoreLastVerifiedAt:backup.secondaryLastRestoreVerifiedAt
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
