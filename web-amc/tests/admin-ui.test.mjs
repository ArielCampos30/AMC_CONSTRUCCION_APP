import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createApp} from '../server.mjs';

const origin='http://localhost:4180';

test('admin v3 exposes the five primary destinations and responsive views',async()=>{
  const [app,css,hub,worker]=await Promise.all([
    readFile(new URL('../public/app.js',import.meta.url),'utf8'),
    readFile(new URL('../public/admin-v3.css',import.meta.url),'utf8'),
    readFile(new URL('../public/project-hub.js',import.meta.url),'utf8'),
    readFile(new URL('../public/sw.js',import.meta.url),'utf8')
  ]);
  const nav="[['inicio','Inicio','⌂'],['solicitudes','Solicitudes','▤'],['obras','Obras','⌂'],['chat-admin','Chat','◌'],['mas-admin','Más','•••']]";
  assert.ok(app.includes(nav));
  assert.match(app,/\['Gestión'.*'Presupuestos'.*'Clientes'.*'Empleados'/s);
  assert.match(app,/\['Herramientas'.*'Tarifario'.*'Estadísticas'/s);
  assert.match(app,/\['Sistema'.*'Configuración'.*'Respaldos'/s);
  assert.match(app,/Solicitudes nuevas.*Presupuestos esperando respuesta.*Visitas programadas hoy.*Obras en curso.*Mensajes sin leer/s);
  assert.match(app,/Nuevas.*Revisando.*Visita pendiente.*Presupuestadas.*No tomadas.*Todas/s);
  assert.match(app,/En curso.*Programadas.*Pendientes.*Finalizadas.*Todas/s);
  assert.match(app,/data-admin-chat="Clientes".*data-admin-chat="Equipo"/s);
  assert.match(app,/\/api\/staff-chat\/messages/);
  assert.match(hub,/Coordinar visita/);
  assert.match(hub,/No tomar/);
  assert.match(css,/@media\(max-width:800px\)/);
  assert.match(css,/@media\(max-width:430px\)/);
  assert.doesNotMatch(css,/min-width:\s*(?:[4-9]\d\d|\d{4,})px/);
  assert.match(worker,/admin-v3\.css/);
  assert.match(worker,/AMC-offline-shell-v6/);
});

test('admin can classify a request as not taken without deleting it',async()=>{
  const service=createApp({dbPath:':memory:',origin});
  service.addUser('owner@amc.test','Strong-Owner-2026!','AMC','admin');
  await new Promise(resolve=>service.server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+service.server.address().port;
  const actor=()=>({cookie:'',csrf:'',async call(path,body,status=200){const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));if(response.headers.get('set-cookie'))this.cookie=response.headers.get('set-cookie').split(';')[0];if(data.csrf)this.csrf=data.csrf;return data;}});
  try{
    const admin=actor(),client=actor();
    await admin.call('/api/login',{email:'owner@amc.test',password:'Strong-Owner-2026!'});
    await client.call('/api/register',{email:'cliente@amc.test',password:'12345678',name:'Cliente'});
    const request=await client.call('/api/requests',{name:'Cliente',phone:'3548000000',town:'La Falda',description:'Trabajo de prueba',service:'Albañilería',type:'presupuesto'},201);
    await admin.call('/api/requests/'+request.id+'/status',{status:'No tomada'},400);
    await admin.call('/api/requests/'+request.id+'/status',{status:'No tomada',reason:'Fuera de zona',comment:'Fuera del radio actual.'});
    const stored=(await admin.call('/api/state')).requests.find(item=>item.id===request.id);
    assert.equal(stored.status,'No tomada');
    assert.equal(stored.statusReason,'Fuera de zona');
    assert.equal(stored.statusComment,'Fuera del radio actual.');
  }finally{
    await new Promise(resolve=>service.server.close(resolve));
  }
});

