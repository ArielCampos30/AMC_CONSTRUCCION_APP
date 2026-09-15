import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createR2BackupStore,r2StorageConfig} from '../r2-backup-store.mjs';

test('9.5 firma S3 para R2, limita el bucket y permite subir, descargar, listar y depurar',async()=>{
 const calls=[],request=async(url,options)=>{
  calls.push({url:String(url),options});
  if(options.method==='GET'&&String(url).includes('list-type=2'))return new Response('<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>daily/amc-2026-08-01T06-00-00-000Z.amcbak</Key></Contents></ListBucketResult>',{status:200});
  if(options.method==='GET')return new Response(Buffer.from([65,77,67,66,65,75]),{status:200});
  return new Response('',{status:200});
 };
 const config={endpoint:'https://account.r2.cloudflarestorage.com',bucket:'amc-backups-secondary',accessKeyId:'AMC_TEST_ACCESS',secretAccessKey:'AMC_TEST_SECRET',region:'auto',retentionDays:30};
 const store=createR2BackupStore({config,request,clock:()=>new Date('2026-09-15T12:00:00.000Z')}),dir=mkdtempSync(path.join(tmpdir(),'amc-r2-test-')),source=path.join(dir,'source.amcbak'),target=path.join(dir,'target.amcbak');
 try{
  writeFileSync(source,Buffer.from([65,77,67,66,65,75]));
  assert.equal((await store.uploadFile('daily/current.amcbak',source)).bytes,6);
  assert.equal((await store.downloadFile('daily/current.amcbak',target)).bytes,6);
  assert.deepEqual(readFileSync(target),Buffer.from([65,77,67,66,65,75]));
  assert.deepEqual(await store.listKeys('daily/'),['daily/amc-2026-08-01T06-00-00-000Z.amcbak']);
  assert.equal(await store.deleteKeys(['daily/amc-2026-08-01T06-00-00-000Z.amcbak']),1);
  assert.equal(calls.length,4);
  for(const call of calls){
   assert.ok(call.url.startsWith('https://account.r2.cloudflarestorage.com/amc-backups-secondary'));
   assert.match(call.options.headers.Authorization,/^AWS4-HMAC-SHA256 Credential=AMC_TEST_ACCESS\/20260915\/auto\/s3\/aws4_request,/);
   assert.doesNotMatch(call.options.headers.Authorization,/AMC_TEST_SECRET/);
  }
  assert.match(calls[2].url,/prefix=daily%2F/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('9.5 exige las cuatro credenciales privadas de R2',()=>{
 assert.throws(()=>r2StorageConfig({AMC_R2_ENDPOINT:'https://account.r2.cloudflarestorage.com'}),/AMC_R2_BUCKET/);
 const config=r2StorageConfig({AMC_R2_ENDPOINT:'https://account.r2.cloudflarestorage.com/',AMC_R2_BUCKET:'amc-backups-secondary',AMC_R2_ACCESS_KEY_ID:'id',AMC_R2_SECRET_ACCESS_KEY:'secret',AMC_R2_REGION:'auto',AMC_BACKUP_RETENTION_DAYS:'30'});
 assert.equal(config.endpoint,'https://account.r2.cloudflarestorage.com');assert.equal(config.bucket,'amc-backups-secondary');assert.equal(config.region,'auto');assert.equal(config.retentionDays,30);
});
