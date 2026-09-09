export function mediaStorageFeatures({db,all,put,transaction,objectStore,text,fail,id,now}){
 const safeFile=(user,key,mime)=>{
  const file=db.prepare('SELECT owner,mime FROM files WHERE id=?').get(key);
  if(!file||file.owner!==user.id||(mime&&!file.mime.startsWith(mime)))fail(400,'Archivo inválido o sin acceso.');
  return '/media/'+key;
 };
 const cleanupOrphanFiles=async()=>{
  const cutoff=Date.now()-7*86400000;
  let removed=0;
  for(const meta of all('fileUpload').filter(item=>Date.parse(item.date||'')<cutoff)){
   const key=meta.fileId;
   if(!key)continue;
   const used=Number(db.prepare("SELECT count(*) AS n FROM docs WHERE kind!='fileUpload' AND body LIKE ?").get('%/media/'+key+'%').n||0);
   if(used)continue;
   if(objectStore.writeEnabled){
    try{await objectStore.remove([key,key+'-thumb']);}
    catch(error){
     if(process.env.NODE_ENV!=='test')console.error(JSON.stringify({level:'error',event:'file-storage-cleanup',fileId:key,error:error.code||error.name||'Error'}));
     continue;
    }
   }
   transaction(()=>{
    db.prepare('DELETE FROM files WHERE id=? OR id=?').run(key,key+'-thumb');
    db.prepare("DELETE FROM docs WHERE kind='fileUpload' AND id=?").run(meta.id);
   });
   removed++;
  }
  return removed;
 };
 const upload=async(user,b)=>{
  const mime=text(b.mime),bytes=b.bytes||Buffer.from(text(b.base64,9e6),'base64');
  const valid=(mime==='image/jpeg'&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)
   ||(mime==='image/png'&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))
   ||(mime==='image/webp'&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')
   ||(mime==='application/pdf'&&bytes.toString('ascii',0,5)==='%PDF-');
  if(!valid||bytes.length>5*1024*1024)fail(400,'Usá una foto o un PDF válido de hasta 5 MB.');
  const miniature=Buffer.isBuffer(b.thumbnail)?b.thumbnail:b.thumbnail?Buffer.from(text(b.thumbnail,180000),'base64'):null;
  if(miniature&&(!mime.startsWith('image/')||miniature.length>128000||miniature[0]!==255||miniature[1]!==216||miniature[2]!==255))fail(400,'Miniatura inválida.');
  const storedSize=bytes.length+(miniature?.length||0);
  const totalStored=db.prepare('SELECT coalesce(sum(length(body)),0) AS total FROM files').get().total;
  if(totalStored+storedSize>150*1024*1024)fail(413,'El almacenamiento de archivos de la prueba está completo. AMC debe ampliar o revisar el espacio.');
  const used=db.prepare('SELECT coalesce(sum(length(body)),0) AS total FROM files WHERE owner=?').get(user.id).total;
  if(used+storedSize>100*1024*1024)fail(413,'Alcanzaste el límite de archivos de esta versión.');
  const key=id(),mirrored=[];
  try{
   if(objectStore.writeEnabled){
    await objectStore.upload(key,mime,bytes);
    mirrored.push(key);
    if(miniature){
     await objectStore.upload(key+'-thumb','image/jpeg',miniature);
     mirrored.push(key+'-thumb');
    }
   }
   transaction(()=>{
    db.prepare('INSERT INTO files VALUES(?,?,?,?)').run(key,user.id,mime,bytes);
    if(miniature)db.prepare('INSERT INTO files VALUES(?,?,?,?)').run(key+'-thumb',user.id,'image/jpeg',miniature);
    put('fileUpload',user.id,{id:'upload-'+key,fileId:key,date:now()});
   });
  }catch(error){
   if(mirrored.length)try{await objectStore.remove(mirrored);}
   catch(cleanupError){
    if(process.env.NODE_ENV!=='test')console.error(JSON.stringify({level:'error',event:'file-storage-rollback',fileId:key,error:cleanupError.code||cleanupError.name||'Error'}));
   }
   throw error;
  }
  return {id:key,url:'/media/'+key,mime,size:bytes.length};
 };
 return {safeFile,cleanupOrphanFiles,upload};
}
