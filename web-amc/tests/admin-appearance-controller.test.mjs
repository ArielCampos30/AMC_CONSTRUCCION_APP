import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createAdminAppearanceController} from '../public/app-admin-appearance-controller.js';

const source=name=>readFile(new URL('../'+name,import.meta.url),'utf8');

test('restaurar portada usa la API central y conserva confirmación, toast y refresh por focus',async()=>{
 const calls=[];
 const button={dataset:{maintenanceAction:'restore-appearance',version:'2030-01-02T03:04:05.000Z'},disabled:false};
 const documentRef={querySelector:()=>null};
 const windowRef={dispatchEvent:event=>calls.push(['focus',event.type])};
 const controller=createAdminAppearanceController({
  documentRef,windowRef,
  api:async(path,body)=>calls.push(['api',path,body]),
  toast:text=>calls.push(['toast',text]),
  confirmAction:async(...args)=>{calls.push(['confirm',...args]);return true;},
  setTimeoutRef:callback=>{callback();return 1;},
 });
 const event={target:{closest:()=>button},preventDefault:()=>calls.push('prevent'),stopImmediatePropagation:()=>calls.push('stop')};
 assert.equal(await controller.handleClick(event),true);
 assert.equal(button.disabled,false);
 assert.deepEqual(calls,[
  'prevent','stop',
  ['confirm','¿Restaurar esta versión de la portada pública? La portada actual quedará guardada en el historial.','Restaurar portada','Restaurar'],
  ['api','/api/appearance/restore',{versionAt:'2030-01-02T03:04:05.000Z'}],
  ['toast','Portada restaurada.'],
  ['focus','focus'],
 ]);
});

test('acciones locales reordenan, quitan y limpian fotos sin llamar API',async()=>{
 let apiCalls=0,removed=false,prepended=false,cleared=false;
 const firstBadge={textContent:'Galería'},secondBadge={textContent:'Foto principal'};
 const cards=[{querySelector:()=>firstBadge},{querySelector:()=>secondBadge}];
 const list={querySelectorAll:()=>cards,prepend:()=>{prepended=true;},replaceChildren:()=>{cleared=true;}};
 const card={parentElement:list,remove:()=>{removed=true;},querySelector:()=>firstBadge};
 const documentRef={querySelector:selector=>selector==='#appearance-form .appearance-photo-list'?list:null};
 const controller=createAdminAppearanceController({documentRef,api:async()=>{apiCalls++;},confirmAction:async()=>true});
 const target=action=>({closest:selector=>selector==='[data-maintenance-action]'?{dataset:{maintenanceAction:action},closest:()=>card}:null});
 await controller.handleClick({target:target('appearance-main-photo')});
 await controller.handleClick({target:target('appearance-remove-photo')});
 await controller.handleClick({target:target('appearance-clear-photos')});
 assert.equal(prepended,true);
 assert.equal(removed,true);
 assert.equal(cleared,true);
 assert.equal(apiCalls,0);
 assert.equal(firstBadge.textContent,'Foto principal');
 assert.equal(secondBadge.textContent,'Galería');
});

test('Apariencia tiene ownership dedicado y mantenimiento deja de conocerla',async()=>{
 const [controller,maintenance,planning,index,styles]=await Promise.all([
  source('public/app-admin-appearance-controller.js'),
  source('public/admin-maintenance-ui.js'),
  source('public/planning-ui.js'),
  source('public/index.html'),
  source('public/admin-appearance.css'),
 ]);
 assert.match(planning,/createAdminAppearanceController/);
 assert.match(planning,/createAdminAppearanceController\(\{api\}\)/);
 assert.match(planning,/appearanceController\.attach\(\)/);
 assert.match(controller,/appearance-remove-photo/);
 assert.match(controller,/appearance-main-photo/);
 assert.match(controller,/appearance-clear-photos/);
 assert.match(controller,/\/api\/appearance\/restore/);
 assert.match(controller,/observe\(appRoot,\{childList:true\}\)/);
 assert.doesNotMatch(controller,/subtree:true/);
 assert.doesNotMatch(controller,/X-CSRF-Token/);
 assert.doesNotMatch(controller,/setTimeout\(\(\)=>el\.classList\.remove/);
 assert.doesNotMatch(maintenance,/appearance-remove-photo|appearance-main-photo|appearance-clear-photos|restore-appearance|refreshAppearanceLabels|appearanceSyncPending/);
 assert.doesNotMatch(maintenance,/\.appearance-photo-list|\.appearance-preview|\.appearance-history/);
 assert.match(index,/admin-appearance\.css/);
 assert.match(styles,/\.appearance-photo-list/);
 assert.match(styles,/\.appearance-preview/);
 assert.match(styles,/\.appearance-history/);
});
