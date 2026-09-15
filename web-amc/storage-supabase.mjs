const MODES=new Set(['off','mirror','prefer-storage']);
const READ_TIMEOUT_MS=4000;
const THUMB_TIMEOUT_MS=2500;
const WRITE_TIMEOUT_MS=6500;
const DELETE_TIMEOUT_MS=8000;
const READ_FAILURE_THRESHOLD=2;
const READ_COOLDOWN_MS=30000;
const cleanBase=value=>String(value||'').replace(/\/$/,'');
const safeSegment=value=>encodeURIComponent(String(value||'').replace(/^\/+|\/+$/g,''));
const safeId=value=>{const id=String(value||'');if(!/^[A-Za-z0-9_-]{1,180}$/.test(id))throw Error('Identificador de archivo inválido.');return id;};
const objectPath=id=>'files/'+safeId(id);
const storageError=(message,{status=503,code='AMC_STORAGE',operation='',reason='',httpStatus=null,durationMs=0,retryAt=null}={})=>Object.assign(Error(message),{
 status,code,storageOperation:operation,storageReason:reason,storageHttpStatus:httpStatus,storageDurationMs:durationMs,storageRetryAt:retryAt
});
const authHeaders=config=>({Authorization:'Bearer '+config.key,apikey:config.key});
const failureReason=error=>error?.name==='TimeoutError'||error?.name==='AbortError'?'timeout':'network';

export function fileStorageConfig(env=process.env){
 const mode=String(env.AMC_FILE_STORAGE_MODE||'off').trim().toLowerCase();
 if(!MODES.has(mode))throw Error('AMC_FILE_STORAGE_MODE debe ser off, mirror o prefer-storage.');
 const base=cleanBase(env.AMC_SUPABASE_URL),key=String(env.AMC_SUPABASE_FILES_KEY||''),bucket=String(env.AMC_FILES_BUCKET||'amc-files').trim();
 if(mode!=='off'&&(!base||!key||!bucket))throw Error('Faltan AMC_SUPABASE_URL, AMC_SUPABASE_FILES_KEY o AMC_FILES_BUCKET para Object Storage.');
 return {mode,base,key,bucket};
}

export function createSupabaseFileStore({env=process.env,fetchImpl=globalThis.fetch,clock=Date.now}={}){
 const config=fileStorageConfig(env),writeEnabled=config.mode!=='off',preferStorage=config.mode==='prefer-storage';
 let readFailures=0,readCircuitUntil=0;
 const diagnostics=()=>({
  readFailures,
  readCircuitOpen:readCircuitUntil>clock(),
  readCircuitUntil:readCircuitUntil||null
 });
 if(!writeEnabled)return {
  mode:config.mode,writeEnabled:false,preferStorage:false,diagnostics,
  upload:async()=>false,download:async()=>{throw Object.assign(Error('Object Storage desactivado.'),{status:404,code:'AMC_STORAGE_DISABLED'});},remove:async()=>0
 };
 if(typeof fetchImpl!=='function')throw Error('No hay cliente HTTP disponible para Object Storage.');
 const objectUrl=(id,authenticated=false)=>config.base+'/storage/v1/object/'+(authenticated?'authenticated/':'')+safeSegment(config.bucket)+'/'+objectPath(id).split('/').map(safeSegment).join('/');
 const request=async(url,options,userMessage,{operation,timeoutMs}={})=>{
  const started=clock();let response;
  try{response=await fetchImpl(url,{...options,signal:AbortSignal.timeout(timeoutMs)});}
  catch(error){throw storageError(userMessage,{operation,reason:failureReason(error),durationMs:Math.max(0,clock()-started)});}
  const durationMs=Math.max(0,clock()-started);
  if(response.ok)return response;
  if(response.status===404)throw storageError('Archivo no encontrado en Object Storage.',{status:404,code:'AMC_STORAGE_NOT_FOUND',operation,reason:'not-found',httpStatus:404,durationMs});
  throw storageError(userMessage,{operation,reason:'http',httpStatus:response.status,durationMs});
 };
 const recordReadFailure=error=>{
  if(error?.status===404||error?.storageReason==='circuit-open')return;
  readFailures++;
  if(readFailures>=READ_FAILURE_THRESHOLD)readCircuitUntil=clock()+READ_COOLDOWN_MS;
 };
 const recordReadSuccess=()=>{readFailures=0;readCircuitUntil=0;};
 return {
  mode:config.mode,writeEnabled,preferStorage,diagnostics,
  async upload(id,mime,bytes){
   const body=Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes);
   await request(objectUrl(id),{
    method:'POST',
    headers:{...authHeaders(config),'Content-Type':mime,'Content-Length':String(body.length),'cache-control':'no-cache','x-upsert':'false'},
    body
   },'No pudimos guardar el archivo en el almacenamiento externo.',{operation:'upload',timeoutMs:WRITE_TIMEOUT_MS});
   return true;
  },
  async download(id){
   if(readCircuitUntil>clock())throw storageError('Object Storage temporalmente en pausa para lecturas.',{operation:'download',reason:'circuit-open',retryAt:readCircuitUntil});
   try{
    const response=await request(objectUrl(id,true),{
     method:'GET',
     headers:{...authHeaders(config),'cache-control':'no-cache'}
    },'No pudimos leer el archivo del almacenamiento externo.',{operation:'download',timeoutMs:id.endsWith('-thumb')?THUMB_TIMEOUT_MS:READ_TIMEOUT_MS});
    let bytes;
    try{bytes=Buffer.from(await response.arrayBuffer());}
    catch(error){throw storageError('No pudimos leer el archivo del almacenamiento externo.',{operation:'download',reason:failureReason(error)});}
    recordReadSuccess();return bytes;
   }catch(error){recordReadFailure(error);throw error;}
  },
  async remove(ids){
   const prefixes=[...new Set((ids||[]).filter(Boolean).map(objectPath))];
   if(!prefixes.length)return 0;
   await request(config.base+'/storage/v1/object/'+safeSegment(config.bucket),{
    method:'DELETE',
    headers:{...authHeaders(config),'Content-Type':'application/json'},
    body:JSON.stringify({prefixes})
   },'No pudimos eliminar archivos del almacenamiento externo.',{operation:'delete',timeoutMs:DELETE_TIMEOUT_MS});
   return prefixes.length;
  }
 };
}
