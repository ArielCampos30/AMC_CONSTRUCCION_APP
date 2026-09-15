import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('favoritos publicaciones reseñas y referidos quedan fuera del router principal',async()=>{
 const [server,community]=await Promise.all([
  readFile(new URL('../server.mjs',import.meta.url),'utf8'),
  readFile(new URL('../community-routes.mjs',import.meta.url),'utf8')
 ]);
 const dispatcher=await readFile(new URL('../server-request-dispatcher.mjs',import.meta.url),'utf8');
 const composition=await readFile(new URL('../app-composition.mjs',import.meta.url),'utf8');
 assert.match(composition,/import \{communityRoutes\} from '\.\/community-routes\.mjs'/);
 assert.match(composition,/const handleCommunity=communityRoutes\(/);
 assert.match(dispatcher,/if\(handleCommunity\(\{p,method,b,user,res\}\)\)return/);
 assert.doesNotMatch(server,/p==='\/api\/favorites'/);
 assert.doesNotMatch(server,/p==='\/api\/posts'/);
 assert.doesNotMatch(server,/p==='\/api\/reviews'/);
 assert.doesNotMatch(server,/p==='\/api\/referrals'/);
 assert.match(community,/p==='\/api\/favorites'/);
 assert.match(community,/p==='\/api\/posts'/);
 assert.match(community,/p==='\/api\/reviews'/);
 assert.match(community,/p==='\/api\/referrals'/);
});
