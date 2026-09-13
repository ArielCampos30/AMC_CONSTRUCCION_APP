import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createAppStateRuntime} from '../public/app-state-runtime.js';

const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};

test('reload obtiene /api/state por GET, aplica y devuelve el estado sin transformarlo',async()=>{
 const calls=[],next={user:{role:'client'},requests:[{id:'r1'}]};let state={before:true};
 const runtime=createAppStateRuntime({
  api:async(...args)=>{calls.push(args);return next;},
  applyState:value=>state=value,
  cacheEmployeeSnapshot:async()=>{}
 });
 assert.equal(runtime.captureSession(),0);
 assert.equal(runtime.isSessionCurrent(0),true);
 const result=await runtime.reload();
 assert.equal(result,next);
 assert.equal(state,next);
 assert.deepEqual(calls,[['/api/state',null,'GET']]);
});

test('una respuesta vieja no sobrescribe el estado de la sesión nueva',async()=>{
 const oldGate=deferred(),newGate=deferred(),gates=[oldGate,newGate];let state={session:'initial'};
 const runtime=createAppStateRuntime({
  api:()=>gates.shift().promise,
  applyState:value=>state=value,
  cacheEmployeeSnapshot:async()=>{}
 });
 const oldReload=runtime.reload();
 const oldEpoch=runtime.captureSession();
 runtime.advanceSession();
 assert.equal(runtime.isSessionCurrent(oldEpoch),false);
 const newReload=runtime.reload(),newState={session:'new'};
 newGate.resolve(newState);
 assert.equal(await newReload,newState);
 assert.equal(state,newState);
 const oldState={session:'old'};
 oldGate.resolve(oldState);
 assert.equal(await oldReload,oldState);
 assert.equal(state,newState);
});

test('Empleado persiste una vez el mismo snapshot y vuelve a persistir cuando cambia',async()=>{
 const base={user:{role:'employee'},assignments:[{id:'a1',status:'Pendiente',day:'2026-09-14',time:'09:00',address:'Valle Hermoso',instructions:'Llevar escalera'}]};
 const states=[base,{...base,user:{...base.user,name:'Empleado'}},{...base,assignments:[{...base.assignments[0],instructions:'Llevar escalera y pintura'}]}],cached=[];
 const runtime=createAppStateRuntime({api:async()=>states.shift(),applyState:()=>{},cacheEmployeeSnapshot:async value=>cached.push(value)});
 await runtime.reload();
 await runtime.reload();
 await runtime.reload();
 assert.equal(cached.length,2);
 assert.equal(cached[0],base);
 assert.equal(cached[1].assignments[0].instructions,'Llevar escalera y pintura');
});

test('otros roles no escriben el snapshot offline',async()=>{
 let cached=0;
 const runtime=createAppStateRuntime({api:async()=>({user:{role:'admin'},assignments:[{id:'a1'}]}),applyState:()=>{},cacheEmployeeSnapshot:async()=>cached++});
 await runtime.reload();
 assert.equal(cached,0);
});

test('un fallo al guardar el snapshot offline no rompe reload ni la aplicación del estado',async()=>{
 const next={user:{role:'employee'},assignments:[{id:'a1',status:'Pendiente'}]};let state;
 const runtime=createAppStateRuntime({api:async()=>next,applyState:value=>state=value,cacheEmployeeSnapshot:async()=>{throw Error('sin almacenamiento');}});
 assert.equal(await runtime.reload(),next);
 assert.equal(state,next);
});

test('un error de /api/state se propaga sin reemplazar estado ni escribir caché',async()=>{
 const failure=Error('estado no disponible');let state={kept:true},cached=0;
 const runtime=createAppStateRuntime({api:async()=>{throw failure;},applyState:value=>state=value,cacheEmployeeSnapshot:async()=>cached++});
 await assert.rejects(runtime.reload(),error=>error===failure);
 assert.deepEqual(state,{kept:true});
 assert.equal(cached,0);
});

test('app.js consume el runtime sin duplicar epoch, reload ni firma offline',async()=>{
 const [app,runtime]=await Promise.all([
  readFile(new URL('../public/app.js',import.meta.url),'utf8'),
  readFile(new URL('../public/app-state-runtime.js',import.meta.url),'utf8')
 ]);
 assert.match(app,/createAppStateRuntime/);
 assert.match(app,/stateRuntime\.advanceSession\(\)/);
 assert.match(app,/stateRuntime\.captureSession\(\)/);
 assert.match(app,/stateRuntime\.isSessionCurrent\(epoch\)/);
 assert.doesNotMatch(app,/offlineSnapshotSignature|async function syncEmployeeOffline|async function reload|sessionEpoch=/);
 assert.match(runtime,/offlineSnapshotSignature/);
 assert.match(runtime,/async function reload/);
 assert.match(runtime,/api\('\/api\/state',null,'GET'\)/);
});
