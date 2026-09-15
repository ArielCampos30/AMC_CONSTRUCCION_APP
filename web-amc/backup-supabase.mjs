import {mkdtempSync,rmSync,statSync,createReadStream,createWriteStream,existsSync} from 'node:fs';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import https from 'node:https';
import {createApp} from './server.mjs';
import {exportBackup,verifyBackup,restoreBackup} from './secure-backup.mjs';

const required=(name,value)=>{if(!value)throw Error('Falta '+name+'.');return value;};
const cleanBase=value=>String(value||'').replace(/\/$/,'');
const safeSegment=value=>encodeURIComponent(String(value||'').replace(/^\/+|\/+$/g,''));
export const backupObjectPath=(date=new Date())=>'daily/amc-'+date.toISOString().replace(/[:.]/g,'-')+'.amcbak';

function writeBackupMonitor(db,patch){
 let previous={id:'backup-status',status:'unknown',lastSuccessAt:null,lastAttemptAt:null,restoreStatus:'unknown',lastRestoreVerifiedAt:null,lastRestoreAttemptAt:null};
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

async function downloadFile(url,headers,file){
 const response=await fetch(url,{method:'GET',headers:{...headers,'cache-control':'no-cache'}});
 if(!response.ok)throw Error('No se pudo descargar el respaldo recién subido ('+response.status+').');
 if(!response.body)throw Error('El respaldo externo no devolvió contenido.');
 await pipeline(Readable.fromWeb(response.body),createWriteStream(file,{flags:'wx',mode:0o600}));
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

function databaseSnapshot(db){
 const count=table=>Number(db.prepare('SELECT count(*) AS n FROM '+table).get().n||0);
 return {
  users:count('users'),docs:count('docs'),files:count('files'),config:count('config'),
  storageBytes:Number(db.prepare('SELECT coalesce(sum(length(body)),0) AS total FROM files').get().total||0)
 };
}

function withLocalRecoveryApp(dbPath,run){
 const names=['AMC_DATABASE_URL','AMC_TEST_DATABASE_URL','AMC_ADMIN_EMAIL','AMC_ADMIN_PASSWORD'],saved={};
 for(const name of names){saved[name]=process.env[name];delete process.env[name];}
 let recoveryApp;
 try{recoveryApp=createApp({dbPath});return run(recoveryApp);}
 finally{
  try{recoveryApp?.server.close();}catch{}
  for(const name of names){if(saved[name]===undefined)delete process.env[name];else process.env[name]=saved[name];}
 }
}

export function verifyRestoredCopy({sourceDb,file,password,target}){
 const source=databaseSnapshot(sourceDb),expectedRecords=source.users+source.docs+source.files+source.config;
 return withLocalRecoveryApp(target,recoveryApp=>{
  const restored=restoreBackup(recoveryApp.db,file,password),recovered=databaseSnapshot(recoveryApp.db);
  if(Number(restored.records)!==expectedRecords)throw Error('La restauración de prueba no recuperó la cantidad esperada de registros.');
  for(const key of ['users','docs','files','config','storageBytes'])if(recovered[key]!==source[key])throw Error('La restauración de prueba no coincide con el origen en '+key+'.');
  return {records:Number(restored.records),...recovered};
 });
}

export async function runExternalBackup({env=process.env,date=new Date()}={}){
 const dir=mkdtempSync(path.join(tmpdir(),'amc-external-backup-')),file=path.join(dir,'backup.amcbak'),downloaded=path.join(dir,'downloaded.amcbak'),restoreTarget=path.join(dir,'restore-check.sqlite'),object=backupObjectPath(date),attemptAt=date.toISOString();
 let app;
 try{
  const localSource=env.AMC_DB_PATH||fileURLToPath(new URL('./data/amc.sqlite',import.meta.url));if(!env.AMC_DATABASE_URL&&!existsSync(localSource))throw Error('No se encontró la base de origen. No se creó ningún respaldo externo.');
  app=createApp({dbPath:localSource});
  writeBackupMonitor(app.db,{status:'running',lastAttemptAt:attemptAt,restoreStatus:'running',lastRestoreAttemptAt:attemptAt});
  const config=storageConfig(env),result=exportBackup(app.db,file,config.password);verifyBackup(file,config.password);
  const encodedObject=object.split('/').map(safeSegment).join('/'),headers={Authorization:'Bearer '+config.key,apikey:config.key},target=config.base+'/storage/v1/object/'+safeSegment(config.bucket)+'/'+encodedObject;
  await uploadFile(target,headers,file);
  await downloadFile(config.base+'/storage/v1/object/authenticated/'+safeSegment(config.bucket)+'/'+encodedObject,headers,downloaded);
  const recovery=verifyRestoredCopy({sourceDb:app.db,file:downloaded,password:config.password,target:restoreTarget}),restoreVerifiedAt=new Date().toISOString();
  const cutoff=date.getTime()-config.retentionDays*86400000,old=(await listObjects(config,'daily')).filter(x=>backupDate(x.name)<cutoff).map(x=>'daily/'+x.name);
  const removed=await deleteObjects(config,old),bytes=statSync(file).size;
  writeBackupMonitor(app.db,{status:'ok',lastAttemptAt:attemptAt,lastSuccessAt:new Date().toISOString(),records:result.records,bytes,removed,error:'',restoreStatus:'ok',lastRestoreAttemptAt:attemptAt,lastRestoreVerifiedAt:restoreVerifiedAt,restoreRecords:recovery.records,restoreStorageBytes:recovery.storageBytes});
  return {records:result.records,object,bytes,removed,restoreVerifiedAt,restoreRecords:recovery.records,restoreStorageBytes:recovery.storageBytes};
 }catch(error){
  try{if(app)writeBackupMonitor(app.db,{status:'failed',lastAttemptAt:attemptAt,lastFailureAt:new Date().toISOString(),restoreStatus:'failed',lastRestoreAttemptAt:attemptAt,error:String(error?.message||'Error').slice(0,180)});}catch{}
  throw error;
 }finally{
  try{app?.server.close();}catch{}
  rmSync(dir,{recursive:true,force:true});
 }
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 runExternalBackup().then(result=>console.log('Respaldo externo y restauración verificados:',result.records,'registros ·',result.bytes,'bytes ·',result.object,'· restaurados:',result.restoreRecords,'· antiguos eliminados:',result.removed)).catch(error=>{console.error(error.message);process.exitCode=1;});
}
