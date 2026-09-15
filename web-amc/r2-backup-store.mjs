import {createHash,createHmac} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';

const required=(name,value)=>{if(!value)throw Error('Falta '+name+'.');return String(value);};
const rfc3986=value=>encodeURIComponent(String(value)).replace(/[!'()*]/g,char=>'%'+char.charCodeAt(0).toString(16).toUpperCase());
const hash=value=>createHash('sha256').update(value).digest('hex');
const hmac=(key,value,encoding)=>createHmac('sha256',key).update(value).digest(encoding);
const xmlDecode=value=>String(value||'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');

function amzTimestamp(date){
 const iso=date.toISOString();
 return {dateStamp:iso.slice(0,10).replace(/-/g,''),amzDate:iso.replace(/[:-]|\.\d{3}/g,'')};
}

function canonicalQuery(entries={}){
 return Object.entries(entries).flatMap(([key,value])=>Array.isArray(value)?value.map(item=>[key,item]):[[key,value]])
  .filter(([,value])=>value!==undefined&&value!==null)
  .map(([key,value])=>[rfc3986(key),rfc3986(value)])
  .sort(([ak,av],[bk,bv])=>ak===bk?av.localeCompare(bv):ak.localeCompare(bk))
  .map(([key,value])=>key+'='+value).join('&');
}

function objectPath(bucket,key=''){
 const segments=[bucket,...String(key).split('/').filter(Boolean)];
 return '/'+segments.map(rfc3986).join('/');
}

function signingKey(secret,dateStamp,region){
 const dateKey=hmac('AWS4'+secret,dateStamp);
 const regionKey=hmac(dateKey,region);
 const serviceKey=hmac(regionKey,'s3');
 return hmac(serviceKey,'aws4_request');
}

export function r2StorageConfig(env=process.env){
 return {
  endpoint:required('AMC_R2_ENDPOINT',env.AMC_R2_ENDPOINT).replace(/\/$/,''),
  bucket:required('AMC_R2_BUCKET',env.AMC_R2_BUCKET),
  accessKeyId:required('AMC_R2_ACCESS_KEY_ID',env.AMC_R2_ACCESS_KEY_ID),
  secretAccessKey:required('AMC_R2_SECRET_ACCESS_KEY',env.AMC_R2_SECRET_ACCESS_KEY),
  region:String(env.AMC_R2_REGION||'auto'),
  retentionDays:Math.max(7,Math.min(365,Number(env.AMC_BACKUP_RETENTION_DAYS||30)||30))
 };
}

export function createR2BackupStore({config,env=process.env,request=fetch,clock=()=>new Date(),timeoutMs=120000}={}){
 const cfg=config||r2StorageConfig(env),base=new URL(cfg.endpoint);
 if(base.protocol!=='https:')throw Error('AMC_R2_ENDPOINT debe usar HTTPS.');

 async function signedRequest(method,key='',{query={},body=Buffer.alloc(0)}={}){
  const payload=Buffer.isBuffer(body)?body:Buffer.from(body||'');
  const payloadHash=hash(payload),{dateStamp,amzDate}=amzTimestamp(clock()),pathname=objectPath(cfg.bucket,key),queryString=canonicalQuery(query);
  const url=new URL(base.toString());url.pathname=pathname;url.search=queryString?'?'+queryString:'';
  const canonicalHeaders='host:'+url.host+'\n'+'x-amz-content-sha256:'+payloadHash+'\n'+'x-amz-date:'+amzDate+'\n';
  const signedHeaders='host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest=[method,pathname,queryString,canonicalHeaders,signedHeaders,payloadHash].join('\n');
  const scope=dateStamp+'/'+cfg.region+'/s3/aws4_request';
  const stringToSign=['AWS4-HMAC-SHA256',amzDate,scope,hash(canonicalRequest)].join('\n');
  const signature=hmac(signingKey(cfg.secretAccessKey,dateStamp,cfg.region),stringToSign,'hex');
  const headers={
   'x-amz-content-sha256':payloadHash,
   'x-amz-date':amzDate,
   Authorization:'AWS4-HMAC-SHA256 Credential='+cfg.accessKeyId+'/'+scope+', SignedHeaders='+signedHeaders+', Signature='+signature
  };
  return request(url,{method,headers,body:['GET','HEAD','DELETE'].includes(method)?undefined:payload,signal:AbortSignal.timeout(timeoutMs)});
 }

 async function ensureOk(response,label){
  if(response.ok)return response;
  let detail='';try{detail=(await response.text()).slice(0,300);}catch{}
  throw Error(label+' ('+response.status+').'+(detail?' '+detail:''));
 }

 return {
  config:cfg,
  async uploadFile(key,file){
   const body=readFileSync(file),response=await signedRequest('PUT',key,{body});
   await ensureOk(response,'R2 no pudo guardar el respaldo');
   return {bytes:body.length};
  },
  async downloadFile(key,file){
   const response=await signedRequest('GET',key);await ensureOk(response,'R2 no pudo descargar el respaldo recién subido');
   const body=Buffer.from(await response.arrayBuffer());if(!body.length)throw Error('R2 devolvió un respaldo vacío.');
   writeFileSync(file,body,{flag:'wx',mode:0o600});return {bytes:body.length};
  },
  async listKeys(prefix='daily/'){
   const response=await signedRequest('GET','',{query:{'list-type':'2','max-keys':'1000',prefix}});await ensureOk(response,'R2 no pudo listar respaldos');
   const xml=await response.text();
   if(/<IsTruncated>\s*true\s*<\/IsTruncated>/i.test(xml))throw Error('R2 devolvió más de 1000 objetos; la retención requiere paginación.');
   return [...xml.matchAll(/<Key>([\s\S]*?)<\/Key>/g)].map(match=>xmlDecode(match[1]));
  },
  async deleteKeys(keys=[]){
   let removed=0;
   for(const key of keys){const response=await signedRequest('DELETE',key);await ensureOk(response,'R2 no pudo eliminar un respaldo antiguo');removed+=1;}
   return removed;
  }
 };
}
