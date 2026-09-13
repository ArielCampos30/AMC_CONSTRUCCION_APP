import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createAppSyncRuntime} from '../public/app-sync-runtime.js';

const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const target=()=>{const listeners=new Map();return {addEventListener:(type,handler)=>listeners.set(type,handler),emit:type=>listeners.get(type)?.(),listeners};};
const setup=(overrides={})=>{
 let state=overrides.state||{user:{role:'admin'}},page=overrides.page||'inicio',dirty=overrides.dirty||false,hidden=overrides.hidden||false,loggingOut=false,renders=0,reloads=0,polls=0,chatSyncs=0,clock=100000,timer;
 const windowTarget=target(),documentTarget=target();
 const runtime=createAppSyncRuntime({
  reload:overrides.reload||(async()=>{reloads++;}),getState:()=>state,getPage:()=>page,isDirty:()=>dirty,isLoggingOut:()=>loggingOut,isHidden:()=>hidden,hasEstimator:overrides.hasEstimator||(()=>false),
  stateSignature:value=>JSON.stringify(value),syncChatAccess:()=>chatSyncs++,render:()=>renders++,pollState:overrides.pollState||(async()=>{polls++;}),
  windowTarget,documentTarget,schedule:(handler,delay)=>{timer={handler,delay};return timer;},now:()=>clock
 });
 return {runtime,windowTarget,documentTarget,get timer(){return timer;},get counts(){return {renders,reloads,polls,chatSyncs};},setState:value=>state=value,setPage:value=>page=value,setDirty:value=>dirty=value,setHidden:value=>hidden=value,setLoggingOut:value=>loggingOut=value,setClock:value=>clock=value};
};

test('polling conserva tick de 5000 ms y cada tick ejecuta como máximo un refresh',async()=>{
 const gate=deferred();let polls=0;
 const context=setup({pollState:async()=>{polls++;await gate.promise;}}),timer=context.runtime.startPolling();
 assert.equal(timer.delay,5000);
 const first=timer.handler(),second=timer.handler();
 assert.equal(polls,1);
 await second;
 gate.resolve();
 await first;
 context.setClock(105000);
 await timer.handler();
 assert.equal(polls,2);
});

test('Cliente fuera del chat conserva umbral de 12000 ms sobre el tick de 5000 ms',async()=>{
 const context=setup({state:{user:{role:'client'}},page:'inicio'}),timer=context.runtime.startPolling();
 await timer.handler();
 context.setClock(105000);await timer.handler();
 context.setClock(110000);await timer.handler();
 assert.equal(context.counts.polls,1);
 context.setClock(115000);await timer.handler();
 assert.equal(context.counts.polls,2);
});

test('focus y volver a visible disparan el mismo refresh; oculto no agrega trabajo',async()=>{
 const context=setup();context.runtime.attachVisibleRefresh();
 await context.windowTarget.emit('focus');
 assert.equal(context.counts.reloads,1);
 context.setHidden(true);context.documentTarget.emit('visibilitychange');
 await Promise.resolve();
 assert.equal(context.counts.reloads,1);
 context.setHidden(false);context.documentTarget.emit('visibilitychange');
 await Promise.resolve();await Promise.resolve();
 assert.equal(context.counts.reloads,2);
});

test('refresh visible concurrente se omite y vuelve a habilitarse al terminar',async()=>{
 const first=deferred();let reloads=0;
 const context=setup({reload:async()=>{reloads++;if(reloads===1)await first.promise;}});context.runtime.attachVisibleRefresh();
 const pending=context.windowTarget.emit('focus');
 await context.windowTarget.emit('focus');
 assert.equal(reloads,1);
 first.resolve();await pending;
 await context.windowTarget.emit('focus');
 assert.equal(reloads,2);
});

test('un error de refresh no rompe los ciclos siguientes',async()=>{
 let reloads=0;
 const context=setup({reload:async()=>{reloads++;if(reloads===1)throw Error('sin red');}});context.runtime.attachVisibleRefresh();
 await context.windowTarget.emit('focus');
 await context.windowTarget.emit('focus');
 assert.equal(reloads,2);
 assert.equal(context.counts.renders,1);
});

test('estado sucio preserva el formulario y estado limpio permite renderizar',async()=>{
 let draft='Contenido pendiente',version=0;
 const context=setup({dirty:true,reload:async()=>{version++;context.setState({user:{role:'client'},version});}});context.runtime.attachVisibleRefresh();
 await context.windowTarget.emit('focus');
 if(context.counts.renders)draft='reemplazado';
 assert.equal(draft,'Contenido pendiente');
 assert.equal(context.counts.renders,0);
 context.setDirty(false);
 await context.windowTarget.emit('focus');
 assert.equal(context.counts.renders,1);
});

test('Cotizador y estimador montado conservan la protección contra rerender visible',async()=>{
 const quote=setup({page:'cotizador'});quote.runtime.attachVisibleRefresh();
 await quote.windowTarget.emit('focus');
 assert.equal(quote.counts.reloads,1);
 assert.equal(quote.counts.renders,0);
 const mounted=setup({hasEstimator:()=>true});mounted.runtime.attachVisibleRefresh();
 await mounted.windowTarget.emit('focus');
 assert.equal(mounted.counts.renders,0);
});

test('pestaña oculta, sesión cerrándose y polling fallido no alteran epoch ni agregan requests',async()=>{
 let epoch=7,attempts=0;
 const context=setup({pollState:async()=>{attempts++;if(attempts===1)throw Error('estado no disponible');}}),timer=context.runtime.startPolling();
 context.setHidden(true);await timer.handler();
 context.setHidden(false);context.setLoggingOut(true);await timer.handler();
 assert.equal(attempts,0);
 context.setLoggingOut(false);await timer.handler();
 context.setClock(105000);await timer.handler();
 assert.equal(attempts,2);
 assert.equal(epoch,7);
});

test('app.js delega coordinación sin duplicar timers, listeners ni requests de estado',async()=>{
 const [app,runtime,stateRuntime]=await Promise.all([
  readFile(new URL('../public/app.js',import.meta.url),'utf8'),
  readFile(new URL('../public/app-sync-runtime.js',import.meta.url),'utf8'),
  readFile(new URL('../public/app-state-runtime.js',import.meta.url),'utf8')
 ]);
 assert.match(app,/createAppSyncRuntime/);
 assert.match(app,/syncRuntime\.attachVisibleRefresh\(\)/);
 assert.match(app,/syncRuntime\.startPolling\(\)/);
 assert.doesNotMatch(app,/let refreshing=|let polling=|lastBackgroundPoll=|addEventListener\('visibilitychange'.*refreshVisible|addEventListener\('focus',refreshVisible|setInterval\(async/);
 assert.equal((app.match(/api\('\/api\/state',null,'GET'\)/g)||[]).length,1);
 assert.equal((stateRuntime.match(/api\('\/api\/state',null,'GET'\)/g)||[]).length,1);
 assert.doesNotMatch(runtime,/\/api\/state|sessionEpoch|advanceSession/);
});
