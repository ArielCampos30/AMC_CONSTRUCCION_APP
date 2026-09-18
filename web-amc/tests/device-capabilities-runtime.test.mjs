import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root=new URL('../../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const runtime=read('web-amc/public/device-capabilities-runtime.js');
const index=read('web-amc/public/index.html');

test('la cámara del chat usa captura web real sin reemplazar Android nativo',()=>{
 assert.match(index,/device-capabilities-runtime\.js/);
 assert.match(runtime,/mediaDevices/);
 assert.match(runtime,/getUserMedia/);
 assert.match(runtime,/enumerateDevices/);
 assert.match(runtime,/Cambiar cámara/);
 assert.match(runtime,/Capturar foto/);
 assert.match(runtime,/Usar foto/);
 assert.match(runtime,/window\.AMCNative/);
 assert.match(runtime,/if\(!button\|\|!String\(button\.textContent\|\|''\)\.includes\('Sacar foto'\)\|\|window\.AMCNative\)return/);
 assert.match(runtime,/new DataTransfer\(\)/);
 assert.match(runtime,/slice\(0,4\)/);
 assert.match(runtime,/hasta cuatro fotos/);
 assert.match(runtime,/getTracks\?\.\(\)\.forEach\(track=>track\.stop\(\)\)/);
});

test('el primer ingreso ofrece activar notificaciones por dispositivo y conserva el botón manual',()=>{
 assert.match(runtime,/shouldOfferNotificationOnboarding/);
 assert.match(runtime,/amc-device-id/);
 assert.match(runtime,/amc-push-enabled/);
 assert.match(runtime,/Notification\.permission/);
 assert.match(runtime,/PushManager/);
 assert.match(runtime,/Habilitar notificaciones/);
 assert.match(runtime,/Ahora no/);
 assert.match(runtime,/dataset\.action='enable-push'/);
 assert.match(runtime,/MutationObserver/);
 assert.match(runtime,/admin-v3/);
 assert.match(runtime,/employee-v4/);
 assert.match(runtime,/client-v5/);
});

test('la decisión de mostrar onboarding respeta soporte, permisos, registro y espera',async()=>{
 const source=runtime.replace(/document\.addEventListener\('click',[\s\S]*$/,'');
 const moduleUrl='data:text/javascript;base64,'+Buffer.from(source).toString('base64');
 const {shouldOfferNotificationOnboarding}=await import(moduleUrl);
 const base={role:'client',deviceId:'',nativeEnabled:false,permission:'default',snoozeUntil:0,now:100,supported:true};
 assert.equal(shouldOfferNotificationOnboarding(base),true);
 assert.equal(shouldOfferNotificationOnboarding({...base,deviceId:'device-1'}),false);
 assert.equal(shouldOfferNotificationOnboarding({...base,nativeEnabled:true}),false);
 assert.equal(shouldOfferNotificationOnboarding({...base,permission:'denied'}),false);
 assert.equal(shouldOfferNotificationOnboarding({...base,snoozeUntil:101}),false);
 assert.equal(shouldOfferNotificationOnboarding({...base,role:''}),false);
 assert.equal(shouldOfferNotificationOnboarding({...base,supported:false}),false);
});
