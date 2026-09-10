import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('notas offline y estado del cotizador quedan fuera del router principal',async()=>{
 const [server,utility]=await Promise.all([
  readFile(new URL('../server.mjs',import.meta.url),'utf8'),
  readFile(new URL('../admin-utility-routes.mjs',import.meta.url),'utf8')
 ]);
 assert.match(server,/import \{adminUtilityRoutes\} from '\.\/admin-utility-routes\.mjs'/);
 assert.match(server,/const handleAdminUtility=adminUtilityRoutes\(/);
 assert.match(server,/if\(handleAdminUtility\(\{p,method,b,user,res\}\)\)return/);
 assert.doesNotMatch(server,/p==='\/api\/offline-notes'/);
 assert.doesNotMatch(server,/p==='\/api\/estimator-state'/);
 assert.match(utility,/p==='\/api\/offline-notes'/);
 assert.match(utility,/p==='\/api\/estimator-state'/);
 assert.match(utility,/revision/);
 assert.match(utility,/safeFile/);
});
