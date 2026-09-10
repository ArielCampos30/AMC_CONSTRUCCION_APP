import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('actualización de perfil queda fuera del router principal',async()=>{
 const [server,profile]=await Promise.all([
  readFile(new URL('../server.mjs',import.meta.url),'utf8'),
  readFile(new URL('../profile-routes.mjs',import.meta.url),'utf8')
 ]);
 assert.match(server,/import \{profileRoutes\} from '\.\/profile-routes\.mjs'/);
 assert.match(server,/const handleProfile=profileRoutes\(/);
 assert.match(server,/if\(handleProfile\(\{p,method,b,user,res\}\)\)return/);
 assert.doesNotMatch(server,/p==='\/api\/profile'/);
 assert.match(profile,/p!=='\/api\/profile'/);
 assert.match(profile,/UPDATE users SET name=\?,phone=\?,town=\?,sound=\?/);
 assert.match(profile,/clientProfile/);
});
