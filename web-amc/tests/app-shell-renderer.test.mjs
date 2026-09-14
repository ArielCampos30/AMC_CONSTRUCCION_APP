import test from 'node:test';
import assert from 'node:assert/strict';
import {renderAppShell} from '../public/app-shell-renderer.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const target=()=>{const classes=new Set();return {classes,classList:{toggle:(name,enabled)=>enabled?classes.add(name):classes.delete(name)}};};
const root=()=>({innerHTML:''});

test('Admin conserva estructura, orden, activo, usuario y contador de avisos',()=>{
 const host=root(),body=target();
 renderAppShell({root:host,body,config:{},state:{user:{role:'admin',name:'Ariel Campos'},notices:[{read:false},{read:true},{read:false}]},page:'presupuestos',content:'<section id="contenido">X</section>',sectionNavigation:'<nav id="volver">Volver</nav>',esc});
 assert.deepEqual([...body.classes],['admin-v3']);
 assert.match(host.innerHTML,/class="sidebar"/);
 assert.match(host.innerHTML,/data-nav="inicio"[^>]*><i>⌂<\/i>Inicio.*data-nav="solicitudes".*data-nav="presupuestos" class="active".*data-nav="obras".*data-nav="mas-admin"/s);
 assert.match(host.innerHTML,/<div class="side-bottom">Ariel Campos<\/div>/);
 assert.match(host.innerHTML,/<span id="notice-count" class="unread-dot" >2<\/span>/);
 assert.match(host.innerHTML,/<a href="#perfil">Ariel<\/a>/);
 assert.match(host.innerHTML,/<main><nav id="volver">Volver<\/nav><section id="contenido">X<\/section><p class="footer-note">AMC Construcciones y Arreglos<\/p><\/main>/);
 assert.match(host.innerHTML,/<nav class="bottom-nav">.*href="#presupuestos" class="active"/s);
});

test('Público conserva demo, acceso, contador oculto y navegación inferior específica',()=>{
 const host=root(),body=target();
 renderAppShell({root:host,body,config:{demo:true},state:{notices:[]},page:'servicios',content:'HOME',esc});
 assert.deepEqual([...body.classes],[]);
 assert.match(host.innerHTML,/^<div class="connection">Prueba conectada local · no es todavía la web pública<\/div>/);
 assert.match(host.innerHTML,/<div class="side-bottom"><a href="#ingresar">Ingresar a mi cuenta<\/a><\/div>/);
 assert.match(host.innerHTML,/<span id="notice-count" class="unread-dot" hidden>0<\/span>/);
 assert.match(host.innerHTML,/<a href="#ingresar">Ingresar<\/a>/);
 assert.match(host.innerHTML,/<nav class="bottom-nav"><a href="#inicio" class=""><strong>⌂<\/strong>Inicio<\/a><a href="#servicios" class="active"><strong>▦<\/strong>Servicios<\/a><a href="#pedir" class=""><strong>＋<\/strong>Pedir<\/a><a href="#obra" class=""><strong>▤<\/strong>Mi obra<\/a><a href="#perfil" class=""><strong>○<\/strong>Perfil<\/a><\/nav>$/);
});

test('cambio Admin → Cliente → público elimina clases residuales',()=>{
 const host=root(),body=target();
 renderAppShell({root:host,body,config:{},state:{user:{role:'admin',name:'Admin'}},page:'inicio',esc});
 assert.deepEqual([...body.classes],['admin-v3']);
 renderAppShell({root:host,body,config:{},state:{user:{role:'client',name:'Cliente'}},page:'inicio',esc});
 assert.deepEqual([...body.classes],['client-v5']);
 renderAppShell({root:host,body,config:{},state:{},page:'inicio',esc});
 assert.deepEqual([...body.classes],[]);
});

test('Empleado y Cliente conservan exactamente los contratos visibles del shell',()=>{
 for(const [role,page,expected] of [['employee','mis-trabajos','Mis trabajos'],['client','mis-trabajos-cliente','Mis trabajos']]){
  const host=root(),body=target();
  renderAppShell({root:host,body,config:{},state:{user:{role,name:'Persona'}},page,content:'CONTENIDO',esc});
  assert.match(host.innerHTML,new RegExp(`data-nav="${page}" class="active"><i>▦<\\/i>${expected}`));
  assert.match(host.innerHTML,new RegExp(`href="#${page}" class="active"><strong>▦<\\/strong>${expected}`));
 }
});

test('escapa nombre completo y nombre corto exactamente mediante el helper recibido',()=>{
 const host=root(),body=target();
 renderAppShell({root:host,body,config:{},state:{user:{role:'client',name:'Ana <AMC>'}},page:'inicio',esc});
 assert.match(host.innerHTML,/Ana &lt;AMC&gt;/);
 assert.match(host.innerHTML,/>Ana<\/a>/);
});
