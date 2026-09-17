import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdminTrashUI} from '../public/admin-trash-ui.js';
import {createAdminQuoteMaintenanceController} from '../public/app-admin-quote-maintenance-controller.js';
import {isProtectedPage,resolveAppPage} from '../public/app-page-router.js';

test('Papelera es una ruta protegida exclusiva del panel Admin',()=>{
 assert.equal(isProtectedPage('papelera'),true);
 assert.deepEqual(resolveAppPage('papelera',{}),{view:'auth',returnTo:'papelera'});
 assert.deepEqual(resolveAppPage('papelera',{user:{role:'admin'}}),{view:'admin-more'});
 assert.notDeepEqual(resolveAppPage('papelera',{user:{role:'client'},requests:[],quotes:[],works:[]}),{view:'admin-more'});
});

test('UI de Papelera diferencia historial de borrado y ofrece restaurar o eliminar',()=>{
 const ui=createAdminTrashUI({getState:()=>({trashEntries:[{id:'trash-1',rootType:'request',title:'Cliente Prueba',subtitle:'Pintura',trashedAt:'2026-09-17T20:00:00Z',count:4}]}),heading:(tag,title,body)=>`<h1>${tag} ${title}</h1><p>${body}</p>`,esc:value=>String(value),date:value=>value,empty:(title,body)=>`<p>${title} ${body}</p>`});
 const html=ui.render();assert.match(html,/Archivo y Papelera no son lo mismo/);assert.match(html,/data-maintenance-action="restore-trash"/);assert.match(html,/data-maintenance-action="delete-trash"/);assert.match(html,/Cliente Prueba/);assert.match(html,/4 registros relacionados/);
});

test('controlador mueve solicitud a Papelera, recarga estado y permite restaurar',async()=>{
 const calls=[],card={isConnected:true,parentNode:{isConnected:true,insertBefore(){}},nextSibling:null,remove(){this.isConnected=false;}},button={disabled:false,dataset:{id:'request 1',maintenanceAction:'trash-request'},closest:selector=>selector==='.admin-v3-card'?card:null},event={target:{closest:selector=>selector==='[data-maintenance-action]'?button:null},preventDefault(){},stopImmediatePropagation(){}};
 const controller=createAdminQuoteMaintenanceController({api:async(path,body)=>{calls.push(['api',path,body]);},reload:async()=>calls.push(['reload']),render:()=>calls.push(['render']),onSuccess:text=>calls.push(['success',text]),confirmAction:async()=>true});
 assert.equal(await controller.handleClick(event),true);assert.equal(card.isConnected,false);assert.deepEqual(calls,[['api','/api/admin/trash/requests/request%201',{}],['reload'],['render'],['success','Solicitud movida a Papelera.']]);
});
