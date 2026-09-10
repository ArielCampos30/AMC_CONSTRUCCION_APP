import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('diálogo de equipo Admin queda aislado sin mover el submit',async()=>{
 const [app,dialog]=await Promise.all([
  readFile(new URL('../public/app.js',import.meta.url),'utf8'),
  readFile(new URL('../public/admin-team-dialog-ui.js',import.meta.url),'utf8')
 ]);
 assert.match(dialog,/export function createAdminTeamDialog/);
 assert.match(dialog,/assign-team-form/);
 assert.match(dialog,/actualMap=new Map\(actual\.map/);
 assert.match(dialog,/Inicio programado:/);
 assert.match(dialog,/Si necesitás cambiar la fecha, usá Reprogramar/);
 assert.doesNotMatch(dialog,/field\('Fecha/);
 assert.match(app,/if\(f\.id==='assign-team-form'\)/);
 assert.match(app,/\/api\/works\/'\+f\.dataset\.id\+'\/assign-team/);
 assert.match(app,/const openAssignTeamDialog=workId=>adminTeamDialog\.open\(workId\)/);
});
