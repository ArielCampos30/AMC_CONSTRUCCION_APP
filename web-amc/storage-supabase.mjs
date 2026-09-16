const MODES=new Set(['off','mirror','prefer-storage']);
const READ_TIMEOUT_MS=4000;
const THUMB_TIMEOUT_MS=2500;
const LIST_TIMEOUT_MS=6500;
const WRITE_ATTEMPT_TIMEOUT_MS=3500;
const WRITE_TOTAL_TIMEOUT_MS=7500;
const WRITE_RETRY_DELAY_MS=150;
const DELETE_TIMEOUT_MS=8000;
const READ_FAILURE_THRESHOLD=2;
const READ_COOLDOWN_MS=30000;
const cleanBase=value=>String(value||'').replace(/\/$/,'');
const safeSegment=value=>encodeURIComponent(String(value||'').replace(/^\/+|\/+$/g,''));
const safeId=value=>{const id=String(value||'');if(!/^[A-Za-z0-9_-]{1,180}$/.test(id))throw Error('Identificador de archivo inválido.');return id;};
const objectPath=id=>'files/'+safeId(id);
const storageError=(message,{status=503,code='AMC_STORAGE',operation='',reason='',httpStatus=null,durationMs=0,retryAt=null,attempts=0,retryable=false}={})=>Object.assign(Error(message),{
 status,code,storageOperation:operation,storageReason:reason,storageHttpStatus:httpStatus,storageDurationMs:durationMs,storageRetryAt:retryAt,storageAttempts:attempts,storageRetryable:retryable
});
const authHeaders=config=>({Authorization:'Bearer '+config.key,apikey:config.key});
const failureReason=error=>error?.storageHardTimeout||error?.name==='TimeoutError'||error?.name==='AbortError'?'timeout':'network';
const numericTimeout=(value,fallback)=>Number.isFinite(Number(value))&&Number(value)>0?Number(value):fallback;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const hardDeadline=(pending,timeoutMs,onTimeout)=>new Promise((resolve,reject)=>{
 let settled=false;
 const timer=setTimeout(()=>{
  if(settled)return;
  settled=true;
  try{onTimeout?.();}catch{}
  const error=Error('Object Storage excedió el tiempo máximo.');error.name='TimeoutError';error.storageHardTimeout=true;reject(error);
 },Math.max(1,timeoutMs));
 Promise.resolve(pending).then(value=>{
  if(settled)return;
  settled=true;clearTimeout(timer);resolve(value);
 },error=>{
  if(settled)return;
  settled=true;clearTimeout(timer);reject(error);
 });
});

export function fileStorageConfig(env=process.env){
 const mode=String(env.AMC_FILE_STORAGE_MODE||'off').trim().toLowerCase();
 if(!MODES.has(mode))throw Error('AMC_FILE_STORAGE_MODE debe ser off, mirror o prefer-storage.');
 const base=cleanBase(env.AMC_SUPABASE_URL),key=String(env.AMC_SUPABASE_FILES_KEY||''),bucket=String(env.AMC_FILES_BUCKET||'amc-files').trim();
 if(mode!=='off'&&(!base||!key||!bucket))throw Error('Faltan AMC_SUPABASE_URL, AMC_SUPABASE_FILES_KEY o AMC_FILES_BUCKET para Object Storage.');
 return {mode,base,key,bucket};
}

export function createSupabaseFileStore({env=process.env,fetchImpl=globalThis.fetch,clock=Date.now,timeouts={}}={}){
 const config=fileStorageConfig(env),writeEnabled=config.mode!=='off',preferStorage=config.mode==='prefer-storage';
 const readTimeoutMs=numericTimeout(timeouts.readMs,READ_TIMEOUT_MS),thumbTimeoutMs=numericTimeout(timeouts.thumbMs,THUMB_TIMEOUT_MS),listTimeoutMs=numericTimeout(timeouts.listMs,LIST_TIMEOUT_MS),writeAttemptMs=numericTimeout(timeouts.writeAttemptMs,WRITE_ATTEMPT_TIMEOUT_MS),writeTotalMs=numericTimeout(timeouts.writeTotalMs,WRITE_TOTAL_TIMEOUT_MS),writeRetryDelayMs=numericTimeout(timeouts.writeRetryDelayMs,WRITE_RETRY_DELAY_MS),deleteTimeoutMs=numericTimeout(timeouts.deleteMs,DELETE_TIMEOUT_MS);
 let readFailures=0,readCircuitUntil=0;
 const diagnostics=()=>({
  readFailures,
  readCircuitOpen:readCircuitUntil>clock(),
  readCircuitUntil:readCircuitUntil||null
 });
 if(!writeEnabled)return {
  mode:config.mode,writeEnabled:false,preferStorage:false,diagnostics,
  upload:async()=>false,download:async()=>{throw Object.assign(Error('Object Storage desactivado.'),{status:404,code:'AMC_STORAGE_DISABLED'});},list:async()=>[],remove:async()=>0
 };
 if(typeof fetchImpl!=='function')throw Error('No hay cliente HTTP disponible para Object Storage.');
 const objectUrl=(id,authenticated=false)=>config.base+'/storage/v1/object/'+(authenticated?'authenticated/':'')+safeSegment(config.bucket)+'/'+objectPath(id).split('/').map(safeSegment).join('/');
 const request=async(url,options,userMessage,{operation,timeoutMs,timeoutMessage=userMessage}={})=>{
  const started=clock(),controller=new AbortController();let response,pending;
  try{pending=fetchImpl(url,{...options,signal:controller.signal});}
  catch(error){
   const reason=failureReason(error);
   throw storageError(reason==='timeout'?timeoutMessage:userMessage,{operation,reason,durationMs:Math.max(0,clock()-started),retryable:true});
  }
  try{response=await hardDeadline(pending,timeoutMs,()=>controller.abort());}
  catch(error){
   const reason=failureReason(error);
   throw storageError(reason==='timeout'?timeoutMessage:userMessage,{operation,reason,durationMs:Math.max(0,clock()-started),retryable:true});
  }
  const durationMs=Math.max(0,clock()-started);
  if(response.ok)return response;
  if(response.status===404)throw storageError('Archivo no encontrado en Object Storage.',{status:404,code:'AMC_STORAGE_NOT_FOUND',operation,reason:'not-found',httpStatus:404,durationMs});
  const retryable=response.status===408||response.status===425||response.status===429||response.status>=500;
  throw storageError(userMessage,{operation,reason:'http',httpStatus:response.status,durationMs,retryable});
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
   const body=Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes),started=Date.now();let lastError;
   for(let attempt=1;attempt<=2;attempt++){
    const elapsed=Date.now()-started,remaining=writeTotalMs-elapsed;
    if(remaining<=0)break;
    try{
     await request(objectUrl(id),{
      method:'POST',
      headers:{...authHeaders(config),'Content-Type':mime,'Content-Length':String(body.length),'cache-control':'no-cache','x-upsert':'true'},
      body
     },'No pudimos guardar el archivo en el almacenamiento externo.',{
      operation:'upload',timeoutMs:Math.max(1,Math.min(writeAttemptMs,remaining)),
      timeoutMessage:'El almacenamiento de archivos está demorando demasiado. El archivo no se guardó; volvé a intentar en unos segundos.'
     });
     return true;
    }catch(error){
     error.storageAttempts=attempt;lastError=error;
     if(!error?.storageRetryable||attempt>=2)throw error;
     const after=writeTotalMs-(Date.now()-started);
     if(after<=writeRetryDelayMs+1)throw error;
     await sleep(Math.min(writeRetryDelayMs,after-1));
    }
   }
   if(lastError)throw lastError;
   throw storageError('El almacenamiento de archivos está demorando demasiado. El archivo no se guardó; volvé a intentar en unos segundos.',{operation:'upload',reason:'timeout',durationMs:Math.max(0,clock()-started),attempts:2,retryable:true});
  },
  async download(id){
   if(readCircuitUntil>clock())throw storageError('Object Storage temporalmente en pausa para lecturas.',{operation:'download',reason:'circuit-open',retryAt:readCircuitUntil});
   try{
    const response=await request(objectUrl(id,true),{
     method:'GET',
     headers:{...authHeaders(config),'cache-control':'no-cache'}
    },'No pudimos leer el archivo del almacenamiento externo.',{operation:'download',timeoutMs:id.endsWith('-thumb')?thumbTimeoutMs:readTimeoutMs});
    let bytes;
    try{bytes=Buffer.from(await response.arrayBuffer());}
    catch(error){throw storageError('No pudimos leer el archivo del almacenamiento externo.',{operation:'download',reason:failureReason(error)});}
    recordReadSuccess();return bytes;
   }catch(error){recordReadFailure(error);throw error;}
  },
  async list(prefix='files',{pageSize=100}={}){
   const normalizedPrefix=String(prefix||'').replace(/^\/+|\/+$/g,''),limit=Math.max(1,Math.min(1000,Number(pageSize)||100));
   const items=[];let offset=0;
   while(true){
    const response=await request(config.base+'/storage/v1/object/list/'+safeSegment(config.bucket),{
     method:'POST',
     headers:{...authHeaders(config),'Content-Type':'application/json'},
     body:JSON.stringify({prefix:normalizedPrefix,limit,offset,sortBy:{column:'name',order:'asc'}})
    },'No pudimos listar los archivos del almacenamiento externo.',{operation:'list',timeoutMs:listTimeoutMs});
    let page;
    try{page=await response.json();}
    catch{throw storageError('Object Storage devolvió un inventario inválido.',{operation:'list',reason:'invalid-response'});}
    if(!Array.isArray(page))throw storageError('Object Storage devolvió un inventario inválido.',{operation:'list',reason:'invalid-response'});
    items.push(...page);
    if(page.length<limit)break;
    offset+=page.length;
    if(offset>100000)throw storageError('El inventario de Object Storage superó el límite operativo.',{operation:'list',reason:'limit'});
   }
   return items;
  },
  async remove(ids,{timeoutMs=deleteTimeoutMs}={}){
   const prefixes=[...new Set((ids||[]).filter(Boolean).map(objectPath))];
   if(!prefixes.length)return 0;
   await request(config.base+'/storage/v1/object/'+safeSegment(config.bucket),{
    method:'DELETE',
    headers:{...authHeaders(config),'Content-Type':'application/json'},
    body:JSON.stringify({prefixes})
   },'No pudimos eliminar archivos del almacenamiento externo.',{operation:'delete',timeoutMs:numericTimeout(timeoutMs,deleteTimeoutMs)});
   return prefixes.length;
  }
 };
}
