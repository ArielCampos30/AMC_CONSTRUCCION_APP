import {mkdtempSync,rmSync,statSync,createReadStream,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import https from 'node:https';
import {createApp} from './server.mjs';
import {exportBackup,verifyBackup} from './secure-backup.mjs';

const required=(name,value)=>{if(!value)throw Error('Falta '+name+'.');return value;};
const cleanBase=value=>String(value||'').replace(/\/$/,'');
const safeSegment=value=>encodeURIComponent(String(value||'').replace(/^\/+|\/+$/g,''));
export const backupObjectPath=(date=new Date())=>'daily/amc-'+date.toISOString().replace(/[:.]/g,'-')+'.amcbak';

function writeBackupMonitor(db,patch){
 let previous={id:'backup-status',status:'unknown',lastSuccessAt:null,lastAttemptAt:null};
 try{const row=db.prepare("SELECT body FROM docs WHERE kind='monitor' AND id='backup-status'").get();if(row)previous={...previous,...JSON.parse(row.body)};}catch{}
 const body={...previous,...patch,id:'backup-status'};
 db.prepare("INSERT INTO docs(id,kind,owner,body) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body,owner=excluded.owner").run(body.id,'monitor','',JSON.stringify(body));
 return body;
}

function storageConfig(env=process.env){
 return {
  base:cleanBase(required('AMC_SUPABASE_URL',env.AMC_SUPABASE_URL)),
  key:required('AMC_SUPABASE_SERVICE_ROLE_KEY',env.AMC_SUPABASE_SERVICE_ROLE_KEY),
  bucket:env.AMC_BACKUP_BUCKET||'amc-backups',
  password:required('AMC_BACKUP_PASSWORD',env.AMC_BACKUP_PASSWORD),
  retentionDays:Math.max(7,Math.min(365,Number(env.AMC_BACKUP_RETENTION_DAYS||30)||30))
 };
}

function uploadFile(url,headers,file){
 return new Promise((resolve,reject)=>{
  const size=statSync(file).size,request=https.request(url,{method:'POST',headers:{...headers,'Content-Type':'application/octet-stream','Content-Length':size,'x-upsert':'true'}},response=>{
   let body='';response.setEncoding('utf8');response.on('data',chunk=>body+=chunk);response.on('end',()=>{
    if(response.statusCode>=200&&response.statusCode<300)return resolve();
    reject(Error('Supabase Storage respondió '+response.statusCode+'. '+body.slice(0,300)));
   });
  });
  request.on('error',reject);createReadStream(file).on('error',reject).pipe(request);
 });
}

async function listObjects(config,prefix='daily'){
 const response=await fetch(config.base+'/storage/v1/object/list/'+safeSegment(config.bucket),{
  method:'POST',
  headers:{Authorization:'Bearer '+config.key,apikey:config.key,'Content-Type':'application/json'},
  body:JSON.stringify({prefix,limit:1000,offset:0,sortBy:{column:'name',order:'asc'}})
 });
 if(!response.ok)throw Error('No se pudo listar respaldos externos ('+response.status+').');
 const rows=await response.json();return Array.isArray(rows)?rows:[];
}

async function deleteObjects(config,prefixes){
 if(!prefixes.length)return 0;
 const response=await fetch(config.base+'/storage/v1/object/'+safeSegment(config.bucket),{
  method:'DELETE',
  headers:{Authorization:'Bearer '+config.key,apikey:config.key,'Content-Type':'application/json'},
  body:JSON.stringify({prefixes})
 });
 if(!response.ok)throw Error('No se pudieron depurar respaldos antiguos ('+response.status+').');
 return prefixes.length;
}

function backupDate(name){
 const match=/amc-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-/.exec(name||'');
 if(!match)return NaN;return Date.parse(match[1]+'T'+match[2]+':'+match[3]+':'+match[4]+'Z');
}

export async function runExternalBackup({env=process.env,date=new Date()}={}){
 const dir=mkdtempSync(path.join(tmpdir(),'amc-external-backup-')),file=path.join(dir,'backup.amcbak'),object=backupObjectPath(date),attemptAt=date.toISOString();
 let app;
 try{
  const localSource=env.AMC_DB_PATH||fileURLToPath(new URL('./data/amc.sqlite',import.meta.url));if(!env.AMC_DATABASE_URL&&!existsSync(localSource))throw Error('No se encontró la base de origen. No se creó ningún respaldo externo.');
  app=createApp({dbPath:localSource});
  writeBackupMonitor(app.db,{status:'running',lastAttemptAt:attemptAt});
  const config=storageConfig(env),result=exportBackup(app.db,file,config.password);verifyBackup(file,config.password);
  const target=config.base+'/storage/v1/object/'+safeSegment(config.bucket)+'/'+object.split('/').map(safeSegment).join('/');
  await uploadFile(target,{Authorization:'Bearer '+config.key,apikey:config.key},file);
  const cutoff=date.getTime()-config.retentionDays*86400000,old=(await listObjects(config,'daily')).filter(x=>backupDate(x.name)<cutoff).map(x=>'daily/'+x.name);
  const removed=await deleteObjects(config,old),bytes=statSync(file).size;
  writeBackupMonitor(app.db,{status:'ok',lastAttemptAt:attemptAt,lastSuccessAt:new Date().toISOString(),records:result.records,bytes,removed,error:''});
  return {records:result.records,object,bytes,removed};
 }catch(error){
  try{if(app)writeBackupMonitor(app.db,{status:'failed',lastAttemptAt:attemptAt,lastFailureAt:new Date().toISOString(),error:String(error?.message||'Error').slice(0,180)});}catch{}
  throw error;
 }finally{
  try{app?.server.close();}catch{}
  rmSync(dir,{recursive:true,force:true});
 }
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 runExternalBackup().then(result=>console.log('Respaldo externo verificado:',result.records,'registros ·',result.bytes,'bytes ·',result.object,'· antiguos eliminados:',result.removed)).catch(error=>{console.error(error.message);process.exitCode=1;});
}
