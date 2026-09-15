export function mediaStorageFeatures({db,all,put,transaction,objectStore,text,fail,id,now}){
 const remoteDatabase=!!(process.env.NODE_ENV==='test'?process.env.AMC_TEST_DATABASE_URL:process.env.AMC_DATABASE_URL),GLOBAL_LIMIT=150*1024*1024,USER_LIMIT=100*1024*1024;
 const logStorageError=(event,key,error)=>{
  if(process.env.NODE_ENV==='test')return;
  console.error(JSON.stringify({
   level:'error',event,fileId:key,error:error?.code||error?.name||'Error',operation:error?.storageOperation||'',
   reason:error?.storageReason||'',storageStatus:error?.storageHttpStatus??null,
   storageDurationMs:Number.isFinite(error?.storageDurationMs)?error.storageDurationMs:null
  }));
 };
 const logUploadPerformance=metrics=>{
  if(process.env.NODE_ENV==='test')return;
  console.info(JSON.stringify({level:'info',event:'media-upload-performance',...metrics}));
 };
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
    try{await objectStore.remove([key,key+'-thumb',key+'-view']);}
    catch(error){logStorageError('file-storage-cleanup',key,error);continue;}
   }
   transaction(()=>{
    db.prepare('DELETE FROM files WHERE id=? OR id=? OR id=?').run(key,key+'-thumb',key+'-view');
    db.prepare("DELETE FROM docs WHERE kind='fileUpload' AND id=?").run(meta.id);
   });
   removed++;
  }
  return removed;
 };
 const writeUploadBundle=({key,user,mime,bytes,miniature,viewer,meta,storedSize})=>{
  if(remoteDatabase){
   const rows=[
    [key,user.id,mime,bytes],
    ...(miniature?[[key+'-thumb',user.id,'image/jpeg',miniature]]:[]),
    ...(viewer?[[key+'-view',user.id,'image/jpeg',viewer]]:[])
   ],values=rows.map(()=>'(?,?,?,?)').join(','),params=[user.id,storedSize,storedSize,...rows.flat(),meta.id,user.id,JSON.stringify(meta)];
   const result=db.prepare(`WITH usage AS (SELECT coalesce(sum(length(body)),0) AS total, coalesce(sum(CASE WHEN owner=? THEN length(body) ELSE 0 END),0) AS used FROM files), quota_state AS (SELECT CASE WHEN total+?>${GLOBAL_LIMIT} THEN 'global' WHEN used+?>${USER_LIMIT} THEN 'user' ELSE 'ok' END AS state FROM usage), incoming(id,owner,mime,body) AS (VALUES ${values}), inserted AS (INSERT INTO files(id,owner,mime,body) SELECT incoming.id,incoming.owner,incoming.mime,incoming.body FROM incoming WHERE (SELECT state FROM quota_state)='ok' RETURNING id), stored_meta AS (INSERT INTO docs(id,kind,owner,body) SELECT ?,'fileUpload',?,? WHERE (SELECT state FROM quota_state)='ok' AND EXISTS (SELECT 1 FROM inserted) ON CONFLICT(id) DO UPDATE SET body=excluded.body,owner=excluded.owner RETURNING id) SELECT state,(SELECT count(*) FROM inserted) AS inserted,(SELECT count(*) FROM stored_meta) AS metadata FROM quota_state`).get(...params);
   if(result?.state==='global')fail(413,'El almacenamiento de archivos de la prueba está completo. AMC debe ampliar o revisar el espacio.');
   if(result?.state==='user')fail(413,'Alcanzaste el límite de archivos de esta versión.');
   if(result?.state!=='ok'||Number(result.inserted)!==rows.length||Number(result.metadata)!==1)fail(503,'No pudimos confirmar el guardado del archivo.');
   return;
  }
  transaction(()=>{
   db.prepare('INSERT INTO files VALUES(?,?,?,?)').run(key,user.id,mime,bytes);
   if(miniature)db.prepare('INSERT INTO files VALUES(?,?,?,?)').run(key+'-thumb',user.id,'image/jpeg',miniature);
   if(viewer)db.prepare('INSERT INTO files VALUES(?,?,?,?)').run(key+'-view',user.id,'image/jpeg',viewer);
   put('fileUpload',user.id,meta);
  });
 };
 const upload=async(user,b)=>{
  const uploadStarted=Date.now(),mime=text(b.mime),bytes=b.bytes||Buffer.from(text(b.base64,9e6),'base64');
  const valid=(mime==='image/jpeg'&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)
   ||(mime==='image/png'&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))
   ||(mime==='image/webp'&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')
   ||(mime==='application/pdf'&&bytes.toString('ascii',0,5)==='%PDF-');
  if(!valid||bytes.length>5*1024*1024)fail(400,'Usá una foto o un PDF válido de hasta 5 MB.');
  const miniature=Buffer.isBuffer(b.thumbnail)?b.thumbnail:b.thumbnail?Buffer.from(text(b.thumbnail,180000),'base64'):null;
  if(miniature&&(!mime.startsWith('image/')||miniature.length>128000||miniature[0]!==255||miniature[1]!==216||miniature[2]!==255))fail(400,'Miniatura inválida.');
  const viewer=Buffer.isBuffer(b.viewer)?b.viewer:b.viewer?Buffer.from(text(b.viewer,2100000),'base64'):null;
  if(viewer&&(!mime.startsWith('image/')||viewer.length>1536*1024||viewer[0]!==255||viewer[1]!==216||viewer[2]!==255))fail(400,'Vista de imagen inválida.');
  const storedSize=bytes.length+(miniature?.length||0)+(viewer?.length||0);
  let quotaMs=0;
  if(!remoteDatabase){
   const quotaStarted=Date.now(),quota=db.prepare('SELECT coalesce(sum(length(body)),0) AS total, coalesce(sum(CASE WHEN owner=? THEN length(body) ELSE 0 END),0) AS used FROM files').get(user.id);
   quotaMs=Date.now()-quotaStarted;
   if(Number(quota.total||0)+storedSize>GLOBAL_LIMIT)fail(413,'El almacenamiento de archivos de la prueba está completo. AMC debe ampliar o revisar el espacio.');
   if(Number(quota.used||0)+storedSize>USER_LIMIT)fail(413,'Alcanzaste el límite de archivos de esta versión.');
  }
  const key=id(),mirrored=[],meta={id:'upload-'+key,fileId:key,date:now()};
  let storageMs=0,dbMs=0;
  try{
   if(objectStore.writeEnabled){
    const storageStarted=Date.now(),jobs=[
     {key,mime,body:bytes},
     ...(miniature?[{key:key+'-thumb',mime:'image/jpeg',body:miniature}]:[]),
     ...(viewer?[{key:key+'-view',mime:'image/jpeg',body:viewer}]:[])
    ];
    const results=await Promise.allSettled(jobs.map(job=>objectStore.upload(job.key,job.mime,job.body)));
    storageMs=Date.now()-storageStarted;
    results.forEach((result,i)=>{if(result.status==='fulfilled')mirrored.push(jobs[i].key);});
    const failed=results.find(result=>result.status==='rejected');if(failed)throw failed.reason;
   }
   const dbStarted=Date.now();
   writeUploadBundle({key,user,mime,bytes,miniature,viewer,meta,storedSize});
   dbMs=Date.now()-dbStarted;
  }catch(error){
   if(error?.code==='AMC_STORAGE')logStorageError('file-storage-upload',key,error);
   if(mirrored.length)try{await objectStore.remove(mirrored);}
   catch(cleanupError){logStorageError('file-storage-rollback',key,cleanupError);}
   throw error;
  }
  logUploadPerformance({bytes:storedSize,variants:1+(miniature?1:0)+(viewer?1:0),quotaMs,storageMs,dbMs,totalMs:Date.now()-uploadStarted,remoteDatabase});
  return {id:key,url:'/media/'+key,mime,size:bytes.length};
 };
 return {safeFile,cleanupOrphanFiles,upload};
}
