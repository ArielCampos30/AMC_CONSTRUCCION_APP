import {copyFileSync,mkdtempSync,rmSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {randomBytes} from 'node:crypto';
import {createApp} from './server.mjs';
import {verifyBackup,restoreBackup} from './secure-backup.mjs';
import {createR2BackupStore,r2StorageConfig} from './r2-backup-store.mjs';

const REQUIRED_STATS=['users','docs','files','config','storageBytes'];
const ISOLATED_ENV=[
 'AMC_DATABASE_URL','AMC_TEST_DATABASE_URL','AMC_RESTORE_DATABASE_URL','AMC_DB_PATH',
 'AMC_ADMIN_EMAIL','AMC_ADMIN_PASSWORD','AMC_FILE_STORAGE_MODE','AMC_SUPABASE_URL',
 'AMC_SUPABASE_SERVICE_ROLE_KEY','AMC_FIREBASE_CREDENTIALS_JSON'
];
const ensure=(condition,message)=>{if(!condition)throw Error(message);};

export function backupTimestampFromKey(key){
 const match=/amc-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z\.amcbak$/.exec(String(key||''));
 if(!match)return null;
 const value=Date.parse(`${match[1]}T${match[2]}:${match[3]}:${match[4]}.${match[5]}Z`);
 return Number.isFinite(value)?value:null;
}

function snapshot(db){
 const count=table=>Number(db.prepare('SELECT count(*) AS n FROM '+table).get().n||0);
 return {
  users:count('users'),docs:count('docs'),files:count('files'),config:count('config'),
  storageBytes:Number(db.prepare('SELECT coalesce(sum(length(body)),0) AS total FROM files').get().total||0)
 };
}

function operationalState(db){
 const count=table=>Number(db.prepare('SELECT count(*) AS n FROM '+table).get().n||0);
 return Object.fromEntries(['sessions','devices','delivery','password_resets'].map(table=>[table,count(table)]));
}

function compareStats(actual,expected){
 for(const key of REQUIRED_STATS)ensure(Number(actual[key])===Number(expected[key]),`La restauración no coincide en ${key}.`);
}

async function withIsolatedEnvironment(run){
 const saved=new Map();
 for(const name of ISOLATED_ENV){saved.set(name,process.env[name]);delete process.env[name];}
 try{return await run();}
 finally{for(const [name,value] of saved){if(value===undefined)delete process.env[name];else process.env[name]=value;}}
}

async function closeApp(app){
 if(!app?.server)return;
 try{if(app.server.listening)await new Promise(resolve=>app.server.close(resolve));else app.server.close();}catch{}
}

async function jsonRequest(base,pathName,{body,expected=200,method=body===undefined?'GET':'POST',actor}={}){
 const headers={Origin:'https://recovery-drill.invalid','Content-Type':'application/json'};
 if(actor?.cookie)headers.Cookie=actor.cookie;
 if(actor?.csrf)headers['X-CSRF-Token']=actor.csrf;
 const response=await fetch(base+pathName,{method,headers,...(body===undefined?{}:{body:JSON.stringify(body)})});
 ensure(response.status===expected,`${method} ${pathName} devolvió ${response.status}, se esperaba ${expected}.`);
 const setCookie=response.headers.get('set-cookie');if(actor&&setCookie)actor.cookie=setCookie.split(';')[0];
 const type=response.headers.get('content-type')||'';
 const data=type.includes('application/json')?await response.json():await response.text();
 if(actor&&data&&typeof data==='object'&&data.csrf)actor.csrf=data.csrf;
 return data;
}

async function validateRunningApp(app){
 const suffix=randomBytes(6).toString('hex');
 const accounts={
  admin:{email:`recovery-admin-${suffix}@amc.test`,password:'Recovery-Admin-2026!',name:'Recovery Admin',role:'admin'},
  employee:{email:`recovery-employee-${suffix}@amc.test`,password:'Recovery-Employee-2026!',name:'Recovery Employee',role:'employee'},
  client:{email:`recovery-client-${suffix}@amc.test`,password:'Recovery-Client-2026!',name:'Recovery Client',role:'client'}
 };
 for(const account of Object.values(accounts))app.addUser(account.email,account.password,account.name,account.role);
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+app.server.address().port;
 const health=await jsonRequest(base,'/healthz');
 ensure(health&&health.ok===true,'La aplicación restaurada no quedó saludable.');
 const root=await fetch(base+'/');ensure(root.status===200,'La portada restaurada no respondió 200.');await root.arrayBuffer();
 await jsonRequest(base,'/api/config');
 const actors={admin:{},employee:{},client:{},guest:{}};
 for(const role of ['admin','employee','client']){
  const account=accounts[role],actor=actors[role];
  await jsonRequest(base,'/api/login',{body:{email:account.email,password:account.password},actor});
  const state=await jsonRequest(base,'/api/state',{actor});
  ensure(state?.user?.role===role,`El estado restaurado no respetó el rol ${role}.`);
 }
 const system=await jsonRequest(base,'/api/state/system',{actor:actors.admin});
 ensure(system?.system?.database==='SQLite','El simulacro aislado no está usando la base temporal esperada.');
 await jsonRequest(base,'/api/state/system',{actor:actors.employee,expected:403});
 await jsonRequest(base,'/api/state/system',{actor:actors.client,expected:403});
 await jsonRequest(base,'/api/state/system',{actor:actors.guest,expected:401});
 return {health:true,root:true,config:true,login:true,roles:true,adminSystem:true,roleIsolation:true};
}

export async function runDisasterRecoveryDrill({env=process.env,store,clock=()=>new Date(),timer=()=>performance.now()}={}){
 const password=String(env.AMC_BACKUP_PASSWORD||'');
 ensure(password.length>=16,'Falta AMC_BACKUP_PASSWORD para validar el respaldo.');
 const r2=store||createR2BackupStore({config:r2StorageConfig(env),env});
 const keys=await r2.listKeys('daily/');
 const backups=keys.map(key=>({key,time:backupTimestampFromKey(key)})).filter(item=>item.time!==null).sort((a,b)=>b.time-a.time);
 ensure(backups.length>0,'R2 no contiene respaldos diarios válidos para el simulacro.');
 const selected=backups[0],startedAt=clock(),startedTick=timer();
 const rpoSeconds=Math.max(0,(startedAt.getTime()-selected.time)/1000);
 const dir=mkdtempSync(path.join(tmpdir(),'amc-disaster-drill-'));
 const backupFile=path.join(dir,'source.amcbak'),dbPath=path.join(dir,'restored.sqlite');
 let restoreApp,runningApp;
 try{
  await r2.downloadFile(selected.key,backupFile);
  const downloadedBytes=statSync(backupFile).size;
  ensure(downloadedBytes>0,'El respaldo descargado desde R2 está vacío.');
  const expected=verifyBackup(backupFile,password);
  let restoredStats,operational;
  await withIsolatedEnvironment(async()=>{
   restoreApp=createApp({dbPath,origin:'https://recovery-drill.invalid',twoFactorKey:'recovery-drill-two-factor-key-not-production'});
   const restored=restoreBackup(restoreApp.db,backupFile,password);
   ensure(Number(restored.records)===Number(expected.records),'La restauración recuperó una cantidad inesperada de registros.');
   restoredStats=snapshot(restoreApp.db);compareStats(restoredStats,expected.stats);
   operational=operationalState(restoreApp.db);
   for(const [name,value] of Object.entries(operational))ensure(value===0,`La restauración recreó ${name}; esos datos operativos deben reiniciarse.`);
   await closeApp(restoreApp);restoreApp=null;
   runningApp=createApp({dbPath,origin:'https://recovery-drill.invalid',twoFactorKey:'recovery-drill-two-factor-key-not-production'});
  });
  const appChecks=await validateRunningApp(runningApp);
  const readyAt=clock(),rtoSeconds=Math.max(0,(timer()-startedTick)/1000);
  return {
   status:'ok',source:'r2',object:selected.key,backupCreatedAt:new Date(selected.time).toISOString(),startedAt:startedAt.toISOString(),readyAt:readyAt.toISOString(),
   observedRpoSeconds:rpoSeconds,applicationRecoveryRtoSeconds:rtoSeconds,records:Number(expected.records),bytes:downloadedBytes,stats:restoredStats,
   operationalReset:operational,checks:{download:true,decryptAndVerify:true,restore:true,dataParity:true,...appChecks},
   note:'RTO de aplicación: descarga, descifrado, restauración y arranque local aislado. No incluye aprovisionar proveedores, DNS ni rotar secretos.'
  };
 }finally{
  await closeApp(restoreApp);await closeApp(runningApp);rmSync(dir,{recursive:true,force:true});
 }
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 runDisasterRecoveryDrill().then(result=>{
  console.log('Simulacro de recuperación completado:',JSON.stringify(result));
 }).catch(error=>{console.error('Simulacro de recuperación falló:',error.message);process.exitCode=1;});
}
