import test from 'node:test';
import assert from 'node:assert/strict';
import {copyFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createApp} from '../server.mjs';
import {exportBackup} from '../secure-backup.mjs';
import {backupTimestampFromKey,runDisasterRecoveryDrill} from '../disaster-recovery-drill.mjs';

const password='Recovery-Backup-Password-2026!';

test('9.6 interpreta la fecha del objeto de backup y rechaza nombres ajenos',()=>{
 assert.equal(backupTimestampFromKey('daily/amc-2026-09-16T06-00-18-658Z.amcbak'),Date.parse('2026-09-16T06:00:18.658Z'));
 assert.equal(backupTimestampFromKey('daily/readme.txt'),null);
});

test('9.6 restaura un backup aislado, levanta AMC y valida roles/permisos',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'amc-drill-test-')),sourceFile=path.join(dir,'backup.amcbak');
 const source=createApp({dbPath:':memory:',origin:'https://source.test',twoFactorKey:'source-two-factor-key-not-production'});
 try{
  source.addUser('existing-admin@amc.test','Existing-Admin-2026!','Existing Admin','admin');
  const existingClient=source.addUser('existing-client@amc.test','Existing-Client-2026!','Existing Client','client');
  source.db.prepare("INSERT INTO docs(id,kind,owner,body) VALUES(?,?,?,?)").run('drill-doc','recoveryFixture',existingClient.id,JSON.stringify({id:'drill-doc',title:'Dato real restaurable'}));
  source.db.prepare('INSERT INTO files(id,owner,mime,body) VALUES(?,?,?,?)').run('drill-file',existingClient.id,'image/jpeg',Buffer.from('recovery-file'));
  const exported=exportBackup(source.db,sourceFile,password);
  const latest='daily/amc-2026-09-16T06-00-18-658Z.amcbak';
  const store={
   async listKeys(){return ['daily/amc-2026-09-15T06-00-18-000Z.amcbak',latest,'daily/not-a-backup.txt'];},
   async downloadFile(key,target){assert.equal(key,latest);copyFileSync(sourceFile,target);return {bytes:1};}
  };
  let tick=1000;
  const result=await runDisasterRecoveryDrill({
   env:{AMC_BACKUP_PASSWORD:password},store,
   clock:()=>new Date('2026-09-16T12:00:18.658Z'),timer:()=>{tick+=250;return tick;}
  });
  assert.equal(result.status,'ok');
  assert.equal(result.source,'r2');
  assert.equal(result.object,latest);
  assert.equal(result.records,exported.records);
  assert.equal(result.observedRpoSeconds,21600);
  assert.ok(result.applicationRecoveryRtoSeconds>=0);
  assert.equal(result.stats.users,2);
  assert.equal(result.stats.files,1);
  assert.equal(result.stats.storageBytes,Buffer.byteLength('recovery-file'));
  assert.deepEqual(result.operationalReset,{sessions:0,devices:0,delivery:0,password_resets:0});
  for(const value of Object.values(result.checks))assert.equal(value,true);
 }finally{
  try{source.server.close();}catch{}
  rmSync(dir,{recursive:true,force:true});
 }
});

test('9.6 no inventa recuperación si R2 no tiene un backup diario válido',async()=>{
 await assert.rejects(()=>runDisasterRecoveryDrill({
  env:{AMC_BACKUP_PASSWORD:password},
  store:{async listKeys(){return ['daily/readme.txt'];}}
 }),/no contiene respaldos diarios válidos/i);
});
