import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('favoritos publicaciones reseñas y referidos quedan fuera del router principal',async()=>{
 const [server,community]=await Promise.all([
  readFile(new URL('../server.mjs',import.meta.url),'utf8'),
  readFile(new URL('../community-routes.mjs',import.meta.url),'utf8')
 ]);
 assert.match(server,/import \{communityRoutes\} from '\.\/community-routes\.mjs'/);
 assert.match(server,/const handleCommunity=communityRoutes\(/);
 assert.match(server,/if\(handleCommunity\(\{p,method,b,user,res\}\)\)return/);
 assert.doesNotMatch(server,/p==='\/api\/favorites'/);
 assert.doesNotMatch(server,/p==='\/api\/posts'/);
 assert.doesNotMatch(server,/p==='\/api\/reviews'/);
 assert.doesNotMatch(server,/p==='\/api\/referrals'/);
 assert.match(community,/p==='\/api\/favorites'/);
 assert.match(community,/p==='\/api\/posts'/);
 assert.match(community,/p==='\/api\/reviews'/);
 assert.match(community,/p==='\/api\/referrals'/);
});
