import test from 'node:test';
import assert from 'node:assert/strict';
import {createAppHttpRuntime} from '../public/app-http-runtime.js';

const response=(data,ok=true)=>({ok,json:async()=>data});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};

test('GET conserva método, headers, CSRF, credentials y omite body',async()=>{
 const calls=[];
 const {api}=createAppHttpRuntime({getCsrf:()=> 'csrf-get',fetchImpl:async(...args)=>{calls.push(args);return response({state:true});}});
 assert.deepEqual(await api('/api/state',null,'GET'),{state:true});
 assert.equal(calls.length,1);
 const [url,options]=calls[0];
 assert.equal(url,'/api/state');
 assert.equal(options.method,'GET');
 assert.equal(options.credentials,'same-origin');
 assert.deepEqual(options.headers,{'Content-Type':'application/json','X-CSRF-Token':'csrf-get'});
 assert.equal(Object.hasOwn(options,'body'),false);
});

test('POST conserva JSON, CSRF y credentials',async()=>{
 const calls=[],payload={name:'Cliente',active:true};
 const {api}=createAppHttpRuntime({getCsrf:()=> 'csrf-post',fetchImpl:async(...args)=>{calls.push(args);return response({saved:true});}});
 assert.deepEqual(await api('/api/clients',payload),{saved:true});
 const [url,options]=calls[0];
 assert.equal(url,'/api/clients');
 assert.equal(options.method,'POST');
 assert.equal(options.credentials,'same-origin');
 assert.equal(options.headers['X-CSRF-Token'],'csrf-post');
 assert.equal(options.body,JSON.stringify(payload));
});

test('requests idénticas comparten ejecución y se liberan después del éxito',async()=>{
 const gate=deferred(),saved={id:'same-response'};let fetches=0;
 const {api}=createAppHttpRuntime({fetchImpl:async()=>{fetches++;await gate.promise;return response(saved);}});
 const first=api('/api/save',{value:1}),second=api('/api/save',{value:1});
 assert.equal(first,second);
 assert.equal(fetches,1);
 gate.resolve();
 const [one,two]=await Promise.all([first,second]);
 assert.equal(one,saved);assert.equal(two,saved);assert.equal(fetches,1);
 await api('/api/save',{value:1});
 assert.equal(fetches,2);
});

test('respuesta no-OK conserva mensaje y propiedades y libera deduplicación',async()=>{
 let fetches=0;
 const backendError={error:'Código adicional requerido.',requiresTwoFactor:true,retryAfter:7};
 const {api}=createAppHttpRuntime({fetchImpl:async()=>{fetches++;return response(backendError,false);}});
 await assert.rejects(api('/api/login',{email:'cliente@amc.test'}),error=>{
  assert.equal(error.message,backendError.error);
  assert.equal(error.requiresTwoFactor,true);
  assert.equal(error.retryAfter,7);
  assert.equal(error.error,backendError.error);
  return true;
 });
 await assert.rejects(api('/api/login',{email:'cliente@amc.test'}));
 assert.equal(fetches,2);
});

test('loader normal siempre se detiene, incluso cuando fetch falla',async()=>{
 const events=[];let fail=true;
 const busy={start:()=>events.push('start'),stop:()=>events.push('stop')};
 const {api}=createAppHttpRuntime({getBusy:()=>busy,fetchImpl:async()=>{if(fail){fail=false;throw Error('sin red');}return response({ok:true});}});
 await assert.rejects(api('/api/quotes',{requestId:'r1'}),/sin red/);
 assert.deepEqual(events,['start','stop']);
 assert.deepEqual(await api('/api/quotes',{requestId:'r1'}),{ok:true});
 assert.deepEqual(events,['start','stop','start','stop']);
});

test('GET, operaciones instantáneas y todos los chats quedan sin loader global',async()=>{
 const events=[],calls=[];
 const busy={start:()=>events.push('start'),stop:()=>events.push('stop')};
 const {api}=createAppHttpRuntime({getBusy:()=>busy,fetchImpl:async(url,options)=>{calls.push([url,options]);return response({ok:true});}});
 await api('/api/state',null,'GET');
 await api('/api/notices/read',{route:'#avisos'});
 await api('/api/staff-chat/read',{});
 await api('/api/client-chat/messages',{text:'Cliente'});
 await api('/api/staff-chat/messages',{text:'Equipo'});
 await api('/api/requests/request-1/messages',{text:'Histórico'});
 assert.equal(calls.length,6);
 assert.deepEqual(events,[]);
 await api('/api/profile',{name:'Cliente'});
 assert.deepEqual(events,['start','stop']);
});
