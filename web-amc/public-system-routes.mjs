export function publicSystemRoutes({db,remoteUrl,version,recentErrorCount,backupHealth,startedAt,demo,keys,services,send}){
 return function route({p,method,res}){
  if((p==='/health'||p==='/healthz')&&method==='GET'){
   const before=Date.now();
   db.prepare('SELECT 1 AS ok').get();
   send(res,200,{ok:true,database:'available',driver:remoteUrl?'postgresql':'sqlite',databaseMs:Date.now()-before,version,errors5xx15m:recentErrorCount(),...backupHealth(),uptimeSeconds:Math.floor((Date.now()-startedAt)/1000)});
   return true;
  }
  if(p==='/api/config'){
   send(res,200,{demo,webPushKey:keys.publicKey,services,version});
   return true;
  }
  return false;
 };
}
