const MODES=new Set(['off','mirror','prefer-storage']);
const cleanBase=value=>String(value||'').replace(/\/$/,'');
const safeSegment=value=>encodeURIComponent(String(value||'').replace(/^\/+|\/+$/g,''));
const safeId=value=>{const id=String(value||'');if(!/^[A-Za-z0-9_-]{1,180}$/.test(id))throw Error('Identificador de archivo inválido.');return id;};
const objectPath=id=>'files/'+safeId(id);
const storageError=(message,status)=>Object.assign(Error(message),{status:status||503,code:'AMC_STORAGE'});
const authHeaders=config=>({Authorization:'Bearer '+config.key,apikey:config.key});

export function fileStorageConfig(env=process.env){
 const mode=String(env.AMC_FILE_STORAGE_MODE||'off').trim().toLowerCase();
 if(!MODES.has(mode))throw Error('AMC_FILE_STORAGE_MODE debe ser off, mirror o prefer-storage.');
 const base=cleanBase(env.AMC_SUPABASE_URL),key=String(env.AMC_SUPABASE_FILES_KEY||''),bucket=String(env.AMC_FILES_BUCKET||'amc-files').trim();
 if(mode!=='off'&&(!base||!key||!bucket))throw Error('Faltan AMC_SUPABASE_URL, AMC_SUPABASE_FILES_KEY o AMC_FILES_BUCKET para Object Storage.');
 return {mode,base,key,bucket};
}

export function createSupabaseFileStore({env=process.env,fetchImpl=globalThis.fetch}={}){
 const config=fileStorageConfig(env),writeEnabled=config.mode!=='off',preferStorage=config.mode==='prefer-storage';
 if(!writeEnabled)return {
  mode:config.mode,writeEnabled:false,preferStorage:false,
  upload:async()=>false,download:async()=>{throw Object.assign(Error('Object Storage desactivado.'),{status:404,code:'AMC_STORAGE_DISABLED'});},remove:async()=>0
 };
 if(typeof fetchImpl!=='function')throw Error('No hay cliente HTTP disponible para Object Storage.');
 const objectUrl=(id,authenticated=false)=>config.base+'/storage/v1/object/'+(authenticated?'authenticated/':'')+safeSegment(config.bucket)+'/'+objectPath(id).split('/').map(safeSegment).join('/');
 const request=async(url,options,userMessage)=>{
  let response;
  try{response=await fetchImpl(url,{...options,signal:AbortSignal.timeout(10000)});}
  catch{throw storageError(userMessage);}
  if(response.ok)return response;
  if(response.status===404)throw Object.assign(Error('Archivo no encontrado en Object Storage.'),{status:404,code:'AMC_STORAGE_NOT_FOUND'});
  throw storageError(userMessage);
 };
 return {
  mode:config.mode,writeEnabled,preferStorage,
  async upload(id,mime,bytes){
   const body=Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes);
   await request(objectUrl(id),{
    method:'POST',
    headers:{...authHeaders(config),'Content-Type':mime,'Content-Length':String(body.length),'cache-control':'no-cache','x-upsert':'true'},
    body
   },'No pudimos guardar el archivo en el almacenamiento externo.');
   return true;
  },
  async download(id){
   const response=await request(objectUrl(id,true),{
    method:'GET',
    headers:{...authHeaders(config),'cache-control':'no-cache'}
   },'No pudimos leer el archivo del almacenamiento externo.');
   return Buffer.from(await response.arrayBuffer());
  },
  async remove(ids){
   const prefixes=[...new Set((ids||[]).filter(Boolean).map(objectPath))];
   if(!prefixes.length)return 0;
   await request(config.base+'/storage/v1/object/'+safeSegment(config.bucket),{
    method:'DELETE',
    headers:{...authHeaders(config),'Content-Type':'application/json'},
    body:JSON.stringify({prefixes})
   },'No pudimos eliminar archivos del almacenamiento externo.');
   return prefixes.length;
  }
 };
}
