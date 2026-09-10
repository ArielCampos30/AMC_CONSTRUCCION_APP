import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('presupuestos y obras quedan fuera del router principal',async()=>{
 const [server,module]=await Promise.all([
  readFile(new URL('../server.mjs',import.meta.url),'utf8'),
  readFile(new URL('../quote-work-routes.mjs',import.meta.url),'utf8')
 ]);
 assert.match(server,/import \{quoteWorkRoutes\} from '\.\/quote-work-routes\.mjs'/);
 assert.match(server,/const handleQuoteWork=quoteWorkRoutes\(/);
 assert.match(server,/if\(await handleQuoteWork\(\{p,method,b,user,res\}\)\)return/);
 assert.doesNotMatch(server,/if\(method==='POST'&&p==='\/api\/quotes'\)/);
 assert.match(module,/p==='\/api\/quotes'/);
 assert.match(module,/\/accept-manual\$/);
 assert.match(module,/\/reject-manual\$/);
 assert.match(module,/\/reply\$/);
 assert.match(module,/\/payments\$/);
 assert.match(module,/\/updates\$/);
});
