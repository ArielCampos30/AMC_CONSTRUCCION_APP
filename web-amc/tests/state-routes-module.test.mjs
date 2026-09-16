import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('estado de la aplicación queda fuera del router principal',async()=>{
 const [server,stateRoutes]=await Promise.all([
  readFile(new URL('../server.mjs',import.meta.url),'utf8'),
  readFile(new URL('../state-routes.mjs',import.meta.url),'utf8')
 ]);
 const dispatcher=await readFile(new URL('../server-request-dispatcher.mjs',import.meta.url),'utf8');
 const composition=await readFile(new URL('../app-composition.mjs',import.meta.url),'utf8');
 assert.match(composition,/import \{stateRoutes\} from '\.\/state-routes\.mjs'/);
 assert.match(composition,/const handleState=stateRoutes\(/);
 assert.match(dispatcher,/if\(await handleState\(\{p,method,user,session,res\}\)\)return/);
 assert.doesNotMatch(server,/if\(p==='\/api\/state'&&method==='GET'\)/);
 assert.match(stateRoutes,/p!=='\/api\/state'\|\|method!=='GET'/);
 assert.match(stateRoutes,/await beginStateSnapshot\(user\)/);
 assert.match(stateRoutes,/endStateSnapshot/);
 assert.match(stateRoutes,/pendingReviews/);
 assert.match(stateRoutes,/staffReadByEmployee/);
 assert.match(stateRoutes,/systemStatus/);
});
