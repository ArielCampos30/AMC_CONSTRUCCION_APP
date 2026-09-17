import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createAdminDashboardUI} from '../public/admin-dashboard-ui.js';

const state={
 agendaClients:[{id:'client-1',name:'Cliente <Prueba>',phone:'3548123456',email:'cliente@amc.test',town:'Valle Hermoso',address:'Ruta 38'}],
 requests:[{id:'request-1',userId:'client-1',name:'Cliente <Prueba>',phone:'3548123456',town:'Valle Hermoso',service:'Pintura',services:['Pintura'],description:'Frente completo',status:'Nueva',date:'2026-09-17T12:00:00.000Z'}],
 quotes:[{id:'quote-1',requestId:'request-1',number:'AMC-2026-001',status:'Enviado',date:'2026-09-17T13:00:00.000Z'}],
 works:[{id:'work-1',requestId:'request-1',title:'Pintura exterior',status:'En ejecución',date:'2026-09-17T14:00:00.000Z'}],
 appointments:[{id:'visit-1',requestId:'request-1',clientName:'Cliente Prueba',status:'Cambio solicitado',date:'2026-09-17T15:00:00.000Z',history:[]}],
 visitSheets:[{id:'sheet-1',clientName:'Cliente Prueba',status:'Pendiente',date:'2026-09-17T15:10:00.000Z'}],
 materialRequests:[{id:'material-1',clientName:'Cliente Prueba',status:'Pendiente',date:'2026-09-17T15:20:00.000Z',history:[]}],
 receipts:[],closures:[],accountDeletionRequests:[{id:'delete-1',name:'Cliente Prueba',status:'Pendiente',date:'2026-09-17T15:30:00.000Z'}],recoveryRequests:[],
 clientChatUnread:{'client-1':2},notices:[{read:false,url:'/#chat-equipo/employee-1'}]
};

const dashboard=createAdminDashboardUI({getState:()=>state,heading:(tag,title,body)=>`<header><span>${tag}</span><h1>${title}</h1><p>${body}</p></header>`,closureNeedsAction:()=>false});

test('Admin reúne pendientes operativos en Inicio',()=>{
 const html=dashboard();
 for(const label of ['Solicitudes nuevas','Cambios de visita','Relevamientos por revisar','Materiales por resolver','Mensajes de clientes','Mensajes del equipo','Solicitudes de eliminación'])assert.match(html,new RegExp(label));
 assert.match(html,/admin-global-search-input/);
 assert.match(html,/Actividad reciente/);
 assert.doesNotMatch(html,/<Prueba>/,'los nombres deben salir escapados');
 assert.match(html,/Cliente &lt;Prueba&gt;/);
});

test('Buscador global encuentra cliente, teléfono, presupuesto y obra',()=>{
 assert.equal(dashboard.searchRows('3548')[0].kind,'Cliente');
 assert.equal(dashboard.searchRows('AMC-2026-001')[0].kind,'Presupuesto');
 assert.equal(dashboard.searchRows('Pintura exterior')[0].kind,'Obra');
 assert.equal(dashboard.searchRows('x').length,0);
});

test('Actividad reciente ordena movimientos y conserva destinos administrativos',()=>{
 const activity=dashboard.activityRows();
 assert.ok(activity.length>=6);
 assert.equal(activity[0].kind,'Cuenta');
 assert.ok(activity.some(item=>item.href==='#materiales'));
 assert.ok(activity.some(item=>item.href==='#fichas'));
 assert.ok(activity.some(item=>item.href==='#agenda'));
});

test('assets y runtime del buscador quedan limitados al rol Admin',async()=>{
 const [assets,input,runtime]=await Promise.all([
  readFile(new URL('../public/app-role-assets.js',import.meta.url),'utf8'),
  readFile(new URL('../public/app-shell-input-controller.js',import.meta.url),'utf8'),
  readFile(new URL('../public/admin-dashboard-runtime.js',import.meta.url),'utf8')
 ]);
 assert.match(assets,/admin-dashboard\.css/);
 assert.match(assets,/admin-dashboard-runtime\.js/);
 assert.match(input,/admin-global-search-input/);
 assert.match(runtime,/data-admin-search-row/);
 assert.match(runtime,/shown<14/);
});
