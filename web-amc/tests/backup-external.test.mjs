import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {backupObjectPath} from '../backup-supabase.mjs';

test('external backup names are timestamped and both providers keep secrets in environment variables',async()=>{
 const name=backupObjectPath(new Date('2026-09-09T03:04:05.678Z'));
 assert.equal(name,'daily/amc-2026-09-09T03-04-05-678Z.amcbak');
 const source=await readFile(new URL('../backup-supabase.mjs',import.meta.url),'utf8');
 const r2Source=await readFile(new URL('../r2-backup-store.mjs',import.meta.url),'utf8');
 for(const key of ['AMC_SUPABASE_URL','AMC_SUPABASE_SERVICE_ROLE_KEY','AMC_BACKUP_PASSWORD','AMC_BACKUP_BUCKET','AMC_BACKUP_RETENTION_DAYS'])assert.match(source,new RegExp(key));
 for(const key of ['AMC_R2_ENDPOINT','AMC_R2_BUCKET','AMC_R2_ACCESS_KEY_ID','AMC_R2_SECRET_ACCESS_KEY','AMC_R2_REGION'])assert.match(r2Source,new RegExp(key));
 assert.match(source,/verifyBackup\(file,config\.password\)/);
 assert.match(source,/createReadStream\(file\)/);
 assert.match(source,/writeBackupMonitor\(app\.db,\{status:'running'/);
 assert.match(source,/status:'ok'/);
 assert.match(source,/status:'failed'/);
 assert.match(source,/secondaryStatus:'ok'/);
 assert.match(source,/secondaryStatus:'failed'/);
 assert.match(source,/writeBackupMonitor\(app\.db,patch\)/);
 assert.match(source,/lastSuccessAt:now/);
 assert.match(source,/secondaryLastSuccessAt:now/);
 assert.doesNotMatch(source,/console\.log\([^\n]*SERVICE_ROLE/i);
 assert.doesNotMatch(source,/console\.log\([^\n]*BACKUP_PASSWORD/i);
 assert.doesNotMatch(r2Source,/console\.log\([^\n]*SECRET_ACCESS/i);
});
