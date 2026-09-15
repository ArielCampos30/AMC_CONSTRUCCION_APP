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
 const writeMediaHeaders=(res,file,tag,servedThumb)=>{
  res.setHeader('Cache-Control','private, no-cache');
  res.setHeader('ETag','"'+tag+'"');
  res.setHeader('Content-Type',servedThumb?'image/jpeg':file.mime);
  if(file.mime==='application/pdf'&&!servedThumb)res.setHeader('Content-Disposition','attachment; filename="Documento-AMC.pdf"');
 };
 const serve=async({user,p,method,req,res})=>{
  if(!(p==='/media/'+p.split('/')[2]&&p.startsWith('/media/')&&method==='GET'))return false;
  const key=p.split('/')[2],file=db.prepare('SELECT id,owner,mime FROM files WHERE id=?').get(key);
  if(!file)fail(404,'Archivo no encontrado.');
  const publicFile=appearance.publicMedia(p)||all('post').filter(post=>!post.demo).some(post=>post.image===p||post.before===p);
  const authorized=canAccessPrivateFile(user,p,file);
  if(!publicFile&&!authorized)fail(404,'Archivo no encontrado.');
  const wantsThumb=new URL(req.url,'http://localhost').searchParams.has('thumb')&&file.mime.startsWith('image/');
  const localThumb=wantsThumb?db.prepare('SELECT body FROM files WHERE id=?').get(key+'-thumb'):null;
  if(!wantsThumb||localThumb?.body){
   const knownThumb=!!localThumb?.body,knownTag=key+(knownThumb?'-thumb':'');
   writeMediaHeaders(res,file,knownTag,knownThumb);
   if(req.headers['if-none-match']==='"'+knownTag+'"'){res.writeHead(304);res.end();return true;}
  }
  let mediaBody=null,servedThumb=false;
  if(objectStore.preferStorage){
   try{
    mediaBody=await objectStore.download(wantsThumb?key+'-thumb':key);
    servedThumb=wantsThumb;
   }catch(error){
    if(error.status!==404)logStorageFallback(key,error);
   }
  }
  if(!mediaBody){
   if(localThumb?.body){mediaBody=localThumb.body;servedThumb=true;}
   else{
    const local=db.prepare('SELECT body FROM files WHERE id=?').get(key);
    if(!local?.body)fail(404,'Archivo no encontrado.');
    mediaBody=local.body;
    servedThumb=false;
   }
  }
  const tag=key+(servedThumb?'-thumb':'');
  writeMediaHeaders(res,file,tag,servedThumb);
  if(req.headers['if-none-match']==='"'+tag+'"'){res.writeHead(304);res.end();return true;}
  res.end(mediaBody);
  return true;
 };
 return {canAccessPrivateFile,serve};
}
