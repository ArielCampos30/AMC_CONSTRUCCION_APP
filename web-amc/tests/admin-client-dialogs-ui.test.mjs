import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('diálogos de clientes Admin quedan en un módulo sin mover sus handlers',async()=>{
 const [app,dialogs]=await Promise.all([
  readFile(new URL('../public/app.js',import.meta.url),'utf8'),
  readFile(new URL('../public/admin-client-dialogs-ui.js',import.meta.url),'utf8')
 ]);
 assert.match(dialogs,/new-client-form/);
 assert.match(dialogs,/edit-client-form/);
 assert.match(dialogs,/link-client-form/);
 assert.match(dialogs,/data-use-existing/);
 assert.match(dialogs,/autocomplete='off'/);
 assert.match(app,/from '.\/admin-client-dialogs-ui\.js'/);
 assert.match(app,/const openClientDialog=mode=>adminClientDialogs\.openClientDialog\(mode\)/);
 assert.match(app,/const openEditClientDialog=clientId=>adminClientDialogs\.openEditClientDialog\(clientId\)/);
 assert.match(app,/const openLinkClientDialog=leadId=>adminClientDialogs\.openLinkClientDialog\(leadId\)/);
 assert.match(app,/case'manual-admin':openClientDialog\('budget'\)/);
 assert.doesNotMatch(app,/function openClientDialog\(/);
 assert.doesNotMatch(app,/function openEditClientDialog\(/);
 assert.doesNotMatch(app,/function openLinkClientDialog\(/);
});
