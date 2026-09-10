import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {staticFileRoutes} from '../static-file-routes.mjs';

function setup(){
 const calls={static:[],send:[],read:[],ended:[]};
 const headers=new Map();
 const res={setHeader(name,value){headers.set(name.toLowerCase(),value);},end(value){calls.ended.push(value);}};
 const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
 const routes=staticFileRoutes({
  ROOT:'/srv/amc',path,
  readFileSync(file){calls.read.push(file);return Buffer.from('archivo');},
  staticResponse(req,response,file){calls.static.push({req,response,file});},
  send(response,status,data){calls.send.push({response,status,data});},
  fail
 });
 return {routes,calls,res,headers};
}

test('archivos públicos tempranos conservan filtro, ruta segura y 404 directo',()=>{
 const {routes,calls,res}=setup();
 const req={method:'GET',headers:{}};
 assert.equal(routes.serveEarly({req,res,p:'/app.js',method:'GET'}),true);
 assert.equal(calls.static[0].file,path.resolve('/srv/amc/public','./app.js'));
 assert.equal(routes.serveEarly({req,res,p:'/api/state',method:'GET'}),false);
 assert.equal(routes.serveEarly({req,res,p:'/media/x.jpg',method:'GET'}),false);
 assert.equal(routes.serveEarly({req,res,p:'/app.js',method:'POST'}),false);
 assert.equal(routes.serveEarly({req,res,p:'/../../secret.js',method:'GET'}),true);
 assert.equal(calls.send.at(-1).status,404);
 assert.deepEqual(calls.send.at(-1).data,{error:'No encontrado.'});
});

test('fallback conserva guardia de método, MIME y HEAD sin cuerpo',()=>{
 const {routes,calls,res,headers}=setup();
 assert.throws(()=>routes.requirePageMethod('POST'),error=>error.status===405&&error.message==='Método no permitido.');
 assert.doesNotThrow(()=>routes.requirePageMethod('GET'));
 assert.equal(routes.serveFallback({res,p:'/ruta.html',method:'GET'}),true);
 assert.equal(calls.read.at(-1),path.resolve('/srv/amc/public','./ruta.html'));
 assert.equal(headers.get('content-type'),'text/html; charset=utf-8');
 assert.equal(Buffer.isBuffer(calls.ended.at(-1)),true);
 routes.serveFallback({res,p:'/ruta',method:'HEAD'});
 assert.equal(calls.ended.at(-1),undefined);
 assert.throws(()=>routes.serveFallback({res,p:'/../../secret',method:'GET'}),error=>error.status===404);
});

test('server delega la entrega pública sin duplicar resolución ni MIME',async()=>{
 const [server,module]=await Promise.all([
  readFile(new URL('../server.mjs',import.meta.url),'utf8'),
  readFile(new URL('../static-file-routes.mjs',import.meta.url),'utf8')
 ]);
 assert.match(server,/from '.\/static-file-routes\.mjs'/);
 assert.match(server,/staticFiles\.serveEarly\(\{req,res,p,method\}\)/);
 assert.match(server,/staticFiles\.requirePageMethod\(method\)/);
 assert.match(server,/staticFiles\.serveFallback\(\{res,p,method\}\)/);
 assert.doesNotMatch(server,/path\.resolve\(ROOT,'public'/);
 assert.doesNotMatch(server,/file\.split\('\.'\)\.pop\(\)/);
 assert.match(module,/webmanifest/);
 assert.match(module,/Método no permitido/);
 assert.match(module,/Content-Type/);
});
