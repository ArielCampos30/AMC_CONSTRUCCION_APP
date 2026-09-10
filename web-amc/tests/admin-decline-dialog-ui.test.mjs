import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('No tomar solicitud usa un diálogo Admin modular y conserva el submit',async()=>{
 const [app,dialog]=await Promise.all([
  readFile(new URL('../public/app.js',import.meta.url),'utf8'),
  readFile(new URL('../public/admin-decline-dialog-ui.js',import.meta.url),'utf8')
 ]);
 assert.match(dialog,/decline-request-dialog/);
 assert.match(dialog,/decline-request-form/);
 assert.match(dialog,/Sin disponibilidad/);
 assert.match(dialog,/Fuera de zona/);
 assert.match(dialog,/Trabajo que AMC no realiza/);
 assert.match(dialog,/Condiciones no compatibles/);
 assert.match(app,/from '.\/admin-decline-dialog-ui\.js'/);
 assert.match(app,/case'decline-admin':openDeclineRequestDialog\(b\.dataset\.id\);break/);
 assert.match(app,/if\(f\.id==='decline-request-form'\)/);
 assert.match(app,/\/api\/requests\/'\+f\.dataset\.id\+'\/status/);
 assert.doesNotMatch(app,/case'decline-admin':\{let d=document\.getElementById\('decline-request-dialog'\)/);
});
