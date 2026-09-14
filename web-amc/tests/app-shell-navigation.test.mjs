import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {getShellNavigation,getShellRoleClasses} from '../public/app-shell-navigation.js';

const values=links=>links.map(({route,label,icon})=>[route,label,icon]);
const ADMIN=[['inicio','Inicio','⌂'],['solicitudes','Solicitudes','▤'],['presupuestos','Presupuestos','▤'],['obras','Obras','⌂'],['mas-admin','Más','•••']];
const EMPLOYEE=[['inicio-empleado','Inicio','⌂'],['mis-trabajos','Mis trabajos','▦'],['perfil','Perfil','○']];
const CLIENT=[['inicio','Inicio','⌂'],['mis-trabajos-cliente','Mis trabajos','▦'],['chat-cliente','Chat','◌'],['perfil','Perfil','○']];
const PUBLIC_SIDEBAR=[['inicio','Inicio','⌂'],['servicios','Servicios','▦'],['ideas','Ideas para tu casa','✧'],['favoritos','Guardados','♡'],['presupuestos','Presupuestos','▤'],['obra','Mi obra','⌂'],['resenas','Reseñas','☆'],['perfil','Mi perfil','○'],['mensajes','Mensajes','◌'],['agenda','Agenda','▦'],['adicionales','Adicionales','＋'],['comprobantes','Comprobantes','▤'],['compras','Compras y facturas','▤']];
const PUBLIC_BOTTOM=[['inicio','Inicio','⌂'],['servicios','Servicios','▦'],['pedir','Pedir','＋'],['obra','Mi obra','▤'],['perfil','Perfil','○']];

test('Admin conserva exactamente rutas, orden, labels e iconos en ambas navegaciones',()=>{
 const navigation=getShellNavigation({role:'admin',page:'inicio'});
 assert.deepEqual(values(navigation.sidebar),ADMIN);
 assert.deepEqual(values(navigation.bottom),ADMIN);
});

test('Empleado usa sólo Inicio, Mis trabajos y Perfil; Administración queda en chat flotante',()=>{
 const navigation=getShellNavigation({role:'employee',page:'mis-trabajos'});
 assert.deepEqual(values(navigation.sidebar),EMPLOYEE);
 assert.deepEqual(values(navigation.bottom),EMPLOYEE);
 assert.equal(navigation.sidebar.some(link=>link.route==='chat-equipo'),false);
});

test('Cliente conserva exactamente rutas, orden, labels e iconos',()=>{
 const navigation=getShellNavigation({role:'client',page:'mis-trabajos-cliente'});
 assert.deepEqual(values(navigation.sidebar),CLIENT);
 assert.deepEqual(values(navigation.bottom),CLIENT);
});

test('público y rol ausente conservan sus navegaciones distintas',()=>{
 for(const role of [undefined,null,'']){
  const navigation=getShellNavigation({role,page:'servicios'});
  assert.deepEqual(values(navigation.sidebar),PUBLIC_SIDEBAR);
  assert.deepEqual(values(navigation.bottom),PUBLIC_BOTTOM);
 }
});

test('sólo la igualdad exacta marca el enlace activo y las rutas dinámicas no heredan sección',()=>{
 const main=getShellNavigation({role:'admin',page:'presupuestos'});
 assert.deepEqual(main.sidebar.filter(link=>link.active).map(link=>link.route),['presupuestos']);
 assert.deepEqual(main.bottom.filter(link=>link.active).map(link=>link.route),['presupuestos']);
 for(const [role,page] of [['admin','presupuesto-admin/quote-1'],['client','mi-trabajo/request-1'],['employee','trabajo/task-1'],[undefined,'solicitud/request-1']]){
  const navigation=getShellNavigation({role,page});
  assert.equal(navigation.sidebar.some(link=>link.active),false,page);
  assert.equal(navigation.bottom.some(link=>link.active),false,page);
 }
});

test('clases del shell son exclusivas por rol y el cambio de rol no deja residuos',()=>{
 assert.deepEqual(getShellRoleClasses('admin'),{'admin-v3':true,'employee-v4':false,'client-v5':false});
 assert.deepEqual(getShellRoleClasses('employee'),{'admin-v3':false,'employee-v4':true,'client-v5':false});
 assert.deepEqual(getShellRoleClasses('client'),{'admin-v3':false,'employee-v4':false,'client-v5':true});
 assert.deepEqual(getShellRoleClasses(),{'admin-v3':false,'employee-v4':false,'client-v5':false});
 const classes=new Set(),apply=role=>{for(const [name,enabled] of Object.entries(getShellRoleClasses(role))){if(enabled)classes.add(name);else classes.delete(name);}};
 apply('admin');assert.deepEqual([...classes],['admin-v3']);
 apply('client');assert.deepEqual([...classes],['client-v5']);
 apply();assert.deepEqual([...classes],[]);
});

test('app.js consume el modelo sin duplicar navegación ni decisiones de rol',async()=>{
 const [app,module]=await Promise.all([readFile(new URL('../public/app.js',import.meta.url),'utf8'),readFile(new URL('../public/app-shell-navigation.js',import.meta.url),'utf8')]);
 assert.match(app,/getShellNavigation\(\{role,page\}\)/);
 assert.match(app,/getShellRoleClasses\(role\)/);
 assert.doesNotMatch(app,/\[\['inicio','Inicio','⌂'\]/);
 assert.doesNotMatch(app,/state\.user\?\.role==='employee'\?\[\[/);
 assert.match(module,/PUBLIC_SIDEBAR_LINKS/);
 assert.match(module,/active:route===page/);
});
