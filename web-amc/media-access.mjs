export function mediaAccessFeatures({db,all,objectStore,appearance,team,purchases,fieldwork,closure,staffMessages,canAccessRequest,canAccessWork,clientChatIds,fail}){
 const canAccessPrivateFile=(user,p,file)=>{
  if(!user)return false;
  if(user.role==='admin'||file.owner===user.id)return true;
  if(staffMessages(user).some(message=>message.photos?.includes(p)))return true;
  if(team.media(user,p)||purchases.media(user,p)||fieldwork.media(user,p)||closure.media(user,p))return true;
  if(user.role==='employee'){
   return all('request').some(request=>canAccessRequest(user,request)&&request.photos?.includes(p))
    ||all('work').some(work=>canAccessWork(user,work)&&((work.photos||[]).includes(p)||(work.updates||[]).some(update=>update.image===p)));
  }
  if(user.role!=='client')return false;
  return all('request',user.id).some(request=>request.photos?.includes(p))
   ||all('quote',user.id).some(quote=>quote.pdf===p)
   ||all('work',user.id).some(work=>(work.photos||[]).includes(p)||(work.updates||[]).some(update=>update.image===p))
   ||all('message',user.id).some(message=>clientChatIds(user).has(message.requestId)&&message.photos?.includes(p))
   ||all('clientMessage',user.id).some(message=>message.photos?.includes(p))
   ||all('receipt',user.id).some(receipt=>receipt.file===p);
 };
 const logStorageFallback=(key,error)=>{
  if(process.env.NODE_ENV==='test'||error?.storageReason==='circuit-open')return;
  const diagnostics=typeof objectStore.diagnostics==='function'?objectStore.diagnostics():null;
  console.error(JSON.stringify({
   level:'error',event:'file-storage-read-fallback',fileId:key,error:error?.code||error?.name||'Error',
   operation:error?.storageOperation||'download',reason:error?.storageReason||'unknown',storageStatus:error?.storageHttpStatus??null,
   storageDurationMs:Number.isFinite(error?.storageDurationMs)?error.storageDurationMs:null,circuitOpen:!!diagnostics?.readCircuitOpen
  }));
 };
 const logReadPerformance=metrics=>{
  if(process.env.NODE_ENV==='test')return;
  console.info(JSON.stringify({level:'info',event:'media-read-performance',...metrics}));
 };
 const writeMediaHeaders=(res,file,tag,variant)=>{
  res.setHeader('Cache-Control','private, no-cache');
  res.setHeader('ETag','"'+tag+'"');
  res.setHeader('Content-Type',variant?'image/jpeg':file.mime);
  if(file.mime==='application/pdf'&&!variant)res.setHeader('Content-Disposition','attachment; filename="Documento-AMC.pdf"');
 };
 const serve=async({user,p,method,req,res})=>{
  if(!(p==='/media/'+p.split('/')[2]&&p.startsWith('/media/')&&method==='GET'))return false;
  const started=Date.now(),key=p.split('/')[2],params=new URL(req.url,'http://localhost').searchParams,
   candidateVariant=params.has('thumb')?'thumb':params.has('view')?'view':null,
   candidateKey=candidateVariant?key+'-'+candidateVariant:key,
   metadataStarted=Date.now(),file=db.prepare('SELECT id,owner,mime,EXISTS(SELECT 1 FROM files variant WHERE variant.id=?) AS "variantExists" FROM files WHERE id=?').get(candidateKey,key),metadataMs=Date.now()-metadataStarted;
  if(!file)fail(404,'Archivo no encontrado.');
  const authStarted=Date.now(),authorized=canAccessPrivateFile(user,p,file),authMs=Date.now()-authStarted;
  if(!authorized){
   const publicFile=appearance.publicMedia(p)||all('post').filter(post=>!post.demo).some(post=>post.image===p||post.before===p);
   if(!publicFile)fail(404,'Archivo no encontrado.');
  }
  const requestedVariant=file.mime.startsWith('image/')?candidateVariant:null,
   servedVariant=requestedVariant&&file.variantExists?requestedVariant:null,
   storageKey=servedVariant?candidateKey:key,
   knownTag=storageKey;
  writeMediaHeaders(res,file,knownTag,servedVariant);
  if(req.headers['if-none-match']==='"'+knownTag+'"'){
   logReadPerformance({variant:servedVariant||'original',metadataMs,authMs,storageMs:0,fallbackDbMs:0,totalMs:Date.now()-started,source:'cache-validation',status:304});
   res.writeHead(304);res.end();return true;
  }
  let mediaBody=null,storageMs=0,fallbackDbMs=0,source='database';
  if(objectStore.preferStorage){
   const storageStarted=Date.now();
   try{mediaBody=await objectStore.download(storageKey);if(mediaBody)source='storage';}
   catch(error){if(error.status!==404)logStorageFallback(key,error);}
   storageMs=Date.now()-storageStarted;
  }
  if(!mediaBody){
   const fallbackDbStarted=Date.now(),local=db.prepare('SELECT body FROM files WHERE id=?').get(storageKey);fallbackDbMs=Date.now()-fallbackDbStarted;
   if(!local?.body)fail(404,'Archivo no encontrado.');
   mediaBody=local.body;source='database';
  }
  logReadPerformance({variant:servedVariant||'original',metadataMs,authMs,storageMs,fallbackDbMs,totalMs:Date.now()-started,source,status:200});
  res.end(mediaBody);
  return true;
 };
 return {canAccessPrivateFile,serve};
}
