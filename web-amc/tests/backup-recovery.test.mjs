import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createApp} from '../server.mjs';
import {exportBackup} from '../secure-backup.mjs';
import {verifyRestoredCopy} from '../backup-supabase.mjs';

const envNames=['AMC_DATABASE_URL','AMC_TEST_DATABASE_URL','AMC_ADMIN_EMAIL','AMC_ADMIN_PASSWORD'];
const saveEnv=()=>Object.fromEntries(envNames.map(name=>[name,process.env[name]]));
const restoreEnv=saved=>{for(const name of envNames){if(saved[name]===undefined)delete process.env[name];else process.env[name]=saved[name];}};

test('9.4 restaura una copia cifrada en una base aislada y compara datos y archivos',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'amc-recovery-test-')),backup=path.join(dir,'backup.amcbak'),target=path.join(dir,'restore.sqlite'),password='Recovery-Test-Only-2026!',saved=saveEnv();
 let source;
 try{
  for(const name of envNames)delete process.env[name];
  source=createApp({dbPath:path.join(dir,'source.sqlite')});
  const user=source.addUser('recovery@test.test','Client-Test-2026!','Recovery User');
  source.db.prepare('INSERT INTO docs(id,kind,owner,body) VALUES(?,?,?,?)').run('recovery-request','request',user.id,JSON.stringify({id:'recovery-request',description:'dato de recuperación'}));
  source.db.prepare('INSERT INTO files(id,owner,mime,body) VALUES(?,?,?,?)').run('recovery-photo',user.id,'image/jpeg',Buffer.from([255,216,255,7,8,9,255,217]));
  const exported=exportBackup(source.db,backup,password);

  process.env.AMC_DATABASE_URL='postgres://must-not-be-used';
  process.env.AMC_TEST_DATABASE_URL='postgres://must-not-be-used';
  process.env.AMC_ADMIN_EMAIL='must-not-bootstrap@test.test';
  process.env.AMC_ADMIN_PASSWORD='Must-Not-Bootstrap-2026!';
  const recovery=verifyRestoredCopy({sourceDb:source.db,file:backup,password,target});

  assert.equal(recovery.records,exported.records);
  assert.equal(recovery.users,1);
  assert.equal(recovery.docs,1);
  assert.equal(recovery.files,1);
  assert.ok(recovery.config>=1);
  assert.equal(recovery.storageBytes,8);
  assert.equal(process.env.AMC_DATABASE_URL,'postgres://must-not-be-used');
  assert.equal(process.env.AMC_ADMIN_EMAIL,'must-not-bootstrap@test.test');
 }finally{
  try{source?.server.close();}catch{}
  restoreEnv(saved);
  rmSync(dir,{recursive:true,force:true});
 }
});
