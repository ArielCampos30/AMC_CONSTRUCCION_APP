import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=name=>readFile(new URL('../public/'+name,import.meta.url),'utf8');

test('Comercial vive dentro de Más sin alterar la navegación principal Admin',async()=>{
 const [navigation,system,router,assets,css]=await Promise.all([source('app-shell-navigation.js'),source('admin-system-ui.js'),source('app-page-router.js'),source('app-role-assets.js'),source('admin-commercial.css')]);
 assert.match(navigation,/\['mas-admin','Más','•••'\]/);
 assert.doesNotMatch(navigation,/\['comercial','Comercial'/);
 assert.match(system,/\['comercial','Comercial'\]/);
 assert.match(system,/createAdminCommercialUI/);
 assert.match(router,/page==='comercial'\|\|page\.startsWith\('comercial\/'\)/);
 assert.match(assets,/admin-commercial\.css/);
 assert.match(css,/@media\(max-width:640px\)/);
});
