import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('registro de dispositivos queda fuera del router principal',async()=>{
 const [server,devices]=await Promise.all([
  readFile(new URL('../server.mjs',import.meta.url),'utf8'),
  readFile(new URL('../device-routes.mjs',import.meta.url),'utf8')
 ]);
 assert.match(server,/import \{deviceRoutes\} from '\.\/device-routes\.mjs'/);
 assert.match(server,/const handleDevices=deviceRoutes\(/);
 assert.match(server,/if\(handleDevices\(\{p,method,b,user,res\}\)\)return/);
 assert.doesNotMatch(server,/method==='POST'&&p==='\/api\/devices'/);
 assert.match(devices,/p!=='\/api\/devices'/);
 assert.match(devices,/validSubscription/);
 assert.match(devices,/Límite de dispositivos alcanzado/);
 assert.match(devices,/INSERT INTO devices/);
 assert.match(devices,/DELETE FROM delivery WHERE deviceId=\?/);
});
