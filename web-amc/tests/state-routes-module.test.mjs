import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('estado de la aplicación queda fuera del router principal',async()=>{
 const [server,stateRoutes]=await Promise.all([
  readFile(new URL('../server.mjs',import.meta.url),'utf8'),
  readFile(new URL('../state-routes.mjs',import.meta.url),'utf8')
 ]);
 assert.match(server,/import \{stateRoutes\} from '\.\/state-routes\.mjs'/);
 assert.match(server,/const handleState=stateRoutes\(/);
 assert.match(server,/if\(handleState\(\{p,method,user,session,res\}\)\)return/);
 assert.doesNotMatch(server,/if\(p==='\/api\/state'&&method==='GET'\)/);
 assert.match(stateRoutes,/p!=='\/api\/state'\|\|method!=='GET'/);
 assert.match(stateRoutes,/beginStateSnapshot/);
 assert.match(stateRoutes,/endStateSnapshot/);
 assert.match(stateRoutes,/pendingReviews/);
 assert.match(stateRoutes,/staffReadByEmployee/);
 assert.match(stateRoutes,/systemStatus/);
});
