export function mediaAccessFeatures({db,all,objectStore,planning,team,fieldwork,closure,staffMessages,canAccessRequest,canAccessWork,clientChatIds,fail}){
 const canAccessPrivateFile=(user,p,file)=>{
  if(!user)return false;
  if(user.role==='admin'||file.owner===user.id)return true;
  if(staffMessages(user).some(message=>message.photos?.includes(p)))return true;
  if(team.media(user,p)||fieldwork.media(user,p)||closure.media(user,p))return true;
  if(user.role==='employee'){
   return all('request').some(request=>canAccessRequest(user,request)&&request.photos?.includes(p))
    ||all('work').some(work=>canAccessWork(user,work)&&((work.photos||[]).includes(p)||(work.updates||[]).some(update=>update.image===p)));
  }
  if(user.role!=='client')return false;
  return all('request',user.id).some(request=>request.photos?.includes(p))
   ||all('quote',user.id).some(quote=>quote.pdf===p)
   ||all('work',user.id).some(work=>(work.photos||[]).includes(p)||(work.updates||[]).some(update=>update.image===p))
   ||all('message',user.id).some(message=>clientChatIds(user).has(message.requestId)&&message.photos?.includes(p))
   ||all('receipt',user.id).some(receipt=>receipt.file===p);
 };
 const serve=async({user,p,method,req,res})=>{
  if(!(p==='/media/'+p.split('/')[2]&&p.startsWith('/media/')&&method==='GET'))return false;
  const key=p.split('/')[2],file=db.prepare('SELECT id,owner,mime FROM files WHERE id=?').get(key);
  if(!file)fail(404,'Archivo no encontrado.');
  const publicFile=planning.publicMedia(p)||all('post').filter(post=>!post.demo).some(post=>post.image===p||post.before===p);
  const authorized=canAccessPrivateFile(user,p,file);
  if(!publicFile&&!authorized)fail(404,'Archivo no encontrado.');
  const wantsThumb=new URL(req.url,'http://localhost').searchParams.has('thumb')&&file.mime.startsWith('image/');
  let mediaBody=null,servedThumb=false;
  if(objectStore.preferStorage){
   try{
    mediaBody=await objectStore.download(wantsThumb?key+'-thumb':key);
    servedThumb=wantsThumb;
   }catch(error){
    if(error.status!==404&&process.env.NODE_ENV!=='test')console.error(JSON.stringify({level:'error',event:'file-storage-read-fallback',fileId:key,error:error.code||error.name||'Error'}));
   }
  }
  if(!mediaBody){
   const localThumb=wantsThumb?db.prepare('SELECT body FROM files WHERE id=?').get(key+'-thumb'):null;
   if(localThumb?.body){mediaBody=localThumb.body;servedThumb=true;}
   else{
    const local=db.prepare('SELECT body FROM files WHERE id=?').get(key);
    if(!local?.body)fail(404,'Archivo no encontrado.');
    mediaBody=local.body;
    servedThumb=false;
   }
  }
  const tag=key+(servedThumb?'-thumb':'');
  res.setHeader('Cache-Control','private, no-cache');
  res.setHeader('ETag','"'+tag+'"');
  if(req.headers['if-none-match']==='"'+tag+'"'){res.writeHead(304);res.end();return true;}
  res.setHeader('Content-Type',servedThumb?'image/jpeg':file.mime);
  if(file.mime==='application/pdf')res.setHeader('Content-Disposition','attachment; filename="Documento-AMC.pdf"');
  res.end(mediaBody);
  return true;
 };
 return {canAccessPrivateFile,serve};
}
