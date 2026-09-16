const toBuffer=value=>Buffer.isBuffer(value)?value:Buffer.from(value||[]);

const sameBytes=(left,right)=>{
 const a=toBuffer(left),b=toBuffer(right);
 return a.length===b.length&&a.equals(b);
};

export async function migrateHistoricalFiles({db,objectStore}={}){
 if(!db?.prepare)throw Error('La migración de archivos necesita una base de datos válida.');
 if(!objectStore?.writeEnabled)throw Error('Object Storage debe estar activo en mirror o prefer-storage para migrar archivos.');
 const rows=db.prepare('SELECT id,mime,length(body) AS bytes FROM files ORDER BY id').all();
 const started=Date.now();
 const summary={total:rows.length,bytes:rows.reduce((total,row)=>total+Number(row.bytes||0),0),alreadyPresent:0,migrated:0,repaired:0,verified:0,durationMs:0};
 for(const row of rows){
  const local=db.prepare('SELECT body FROM files WHERE id=?').get(row.id);
  if(!local?.body)throw Object.assign(Error('No se pudo leer el archivo local durante la migración.'),{code:'AMC_STORAGE_SOURCE_MISSING',fileId:row.id});
  const body=toBuffer(local.body);
  if(Number(row.bytes||0)!==body.length)throw Object.assign(Error('El tamaño del archivo local cambió durante la migración.'),{code:'AMC_STORAGE_SOURCE_CHANGED',fileId:row.id});
  let remote=null,found=false;
  try{
   remote=await objectStore.download(row.id);
   found=true;
  }catch(error){
   if(error?.status!==404&&error?.code!=='AMC_STORAGE_NOT_FOUND')throw error;
  }
  if(found&&sameBytes(remote,body)){
   summary.alreadyPresent++;
   summary.verified++;
   continue;
  }
  await objectStore.upload(row.id,row.mime,body);
  const verified=await objectStore.download(row.id);
  if(!sameBytes(verified,body))throw Object.assign(Error('Object Storage devolvió un archivo distinto después de migrarlo.'),{code:'AMC_STORAGE_VERIFY',fileId:row.id});
  if(found)summary.repaired++;
  else summary.migrated++;
  summary.verified++;
 }
 summary.durationMs=Date.now()-started;
 return summary;
}
