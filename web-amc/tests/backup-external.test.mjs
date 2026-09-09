import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {backupObjectPath} from '../backup-supabase.mjs';

test('external backup names are timestamped and the script keeps secrets in environment variables',async()=>{
 const name=backupObjectPath(new Date('2026-09-09T03:04:05.678Z'));
 assert.equal(name,'daily/amc-2026-09-09T03-04-05-678Z.amcbak');
 const source=await readFile(new URL('../backup-supabase.mjs',import.meta.url),'utf8');
 for(const key of ['AMC_SUPABASE_URL','AMC_SUPABASE_SERVICE_ROLE_KEY','AMC_BACKUP_PASSWORD','AMC_BACKUP_BUCKET','AMC_BACKUP_RETENTION_DAYS'])assert.match(source,new RegExp(key));
 assert.match(source,/verifyBackup\(file,config\.password\)/);
 assert.match(source,/createReadStream\(file\)/);
 assert.doesNotMatch(source,/console\.log\([^\n]*SERVICE_ROLE/i);
 assert.doesNotMatch(source,/console\.log\([^\n]*BACKUP_PASSWORD/i);
});
