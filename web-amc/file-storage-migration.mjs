import {createHash} from 'node:crypto';

const toBuffer=value=>Buffer.isBuffer(value)?value:Buffer.from(value||[]);
const md5=value=>createHash('md5').update(toBuffer(value)).digest('hex');
const normalizeEtag=value=>String(value||'').replace(/^W\//i,'').replace(/^"+|"+$/g,'').trim().toLowerCase();
const remoteId=(item,prefix='files')=>String(item?.name||'').replace(new RegExp('^'+prefix.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'/'),'');

const sameBytes=(left,right)=>{
 const a=toBuffer(left),b=toBuffer(right);
 return a.length===b.length&&a.equals(b);
};

export async function migrateHistoricalFiles({db,objectStore}={}){
 if(!db?.prepare)throw Error('La migración de archivos necesita una base de datos válida.');
 if(!objectStore?.writeEnabled)throw Error('Object Storage debe estar activo en mirror o prefer-storage para migrar archivos.');
 if(typeof objectStore.list!=='function')throw Error('Object Storage debe permitir inventariar metadatos antes de migrar.');
 const rows=db.prepare('SELECT id,mime,length(body) AS bytes FROM files ORDER BY id').all();
 const remoteRows=await objectStore.list('files');
 const remoteById=new Map(remoteRows.filter(item=>item?.name).map(item=>[remoteId(item),item]));
 const started=Date.now();
 const summary={total:rows.length,bytes:rows.reduce((total,row)=>total+Number(row.bytes||0),0),remoteListed:remoteById.size,alreadyPresent:0,migrated:0,repaired:0,verified:0,durationMs:0};
 for(const row of rows){
  const local=db.prepare('SELECT body FROM files WHERE id=?').get(row.id);
  if(!local?.body)throw Object.assign(Error('No se pudo leer el archivo local durante la migración.'),{code:'AMC_STORAGE_SOURCE_MISSING',fileId:row.id});
  const body=toBuffer(local.body);
  if(Number(row.bytes||0)!==body.length)throw Object.assign(Error('El tamaño del archivo local cambió durante la migración.'),{code:'AMC_STORAGE_SOURCE_CHANGED',fileId:row.id});
  const localHash=md5(body),remote=remoteById.get(row.id)||null;
  const remoteBytes=Number(remote?.metadata?.size??remote?.metadata?.contentLength??NaN);
  const remoteHash=normalizeEtag(remote?.metadata?.eTag??remote?.metadata?.etag);
  if(remote&&remoteBytes===body.length&&remoteHash&&remoteHash===localHash){
   summary.alreadyPresent++;
   summary.verified++;
   continue;
  }
  await objectStore.upload(row.id,row.mime,body);
  const verified=await objectStore.download(row.id);
  if(!sameBytes(verified,body))throw Object.assign(Error('Object Storage devolvió un archivo distinto después de migrarlo.'),{code:'AMC_STORAGE_VERIFY',fileId:row.id});
  if(remote)summary.repaired++;
  else summary.migrated++;
  summary.verified++;
 }
 summary.durationMs=Date.now()-started;
 return summary;
}
