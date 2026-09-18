import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHandler} from '../../cloudflare/amc-entry-worker/src/index.mjs';

const root=new URL('../../',import.meta.url);
const htmlRequest=(url='https://app.amcconstrucciones.com.ar/')=>new Request(url,{headers:{accept:'text/html,application/xhtml+xml','sec-fetch-mode':'navigate','sec-fetch-dest':'document'}});
const env={ORIGIN_URL:'https://amc-o0xb.onrender.com',PROBE_TIMEOUT_MS:'500',WAKE_MAX_WAIT_MS:'60000'};

test('muestra loader AMC con el logo verde actual si healthz todavía no está listo',async()=>{
  const calls=[];
  const handle=createHandler({fetchImpl:async req=>{calls.push(req);return new Response('sleeping',{status:503});}});
  const response=await handle(htmlRequest(),env);
  const body=await response.text();
  assert.equal(response.status,200);
  assert.match(response.headers.get('cache-control'),/no-store/);
  assert.match(body,/Preparando tu espacio AMC/);
  assert.match(body,/\/amc-logo-brand\.webp/);
  assert.doesNotMatch(body,/#D7BA63/i);
  assert.doesNotMatch(body,/onrender\.com/);
  assert.equal(new URL(calls[0].url).pathname,'/healthz');

  const config=JSON.parse(readFileSync(new URL('../../cloudflare/amc-entry-worker/wrangler.jsonc',import.meta.url),'utf8'));
  assert.equal(config.assets.directory,'./public');
  assert.ok(existsSync(new URL('../../cloudflare/amc-entry-worker/public/amc-logo-brand.webp',import.meta.url)));
});

test('wakeup-status informa ready sin reenviar cookies del usuario',async()=>{
  let seen;
  const handle=createHandler({fetchImpl:async req=>{seen=req;return new Response('{"ok":true}',{status:200});}});
  const response=await handle(new Request('https://app.amcconstrucciones.com.ar/_amc/wakeup-status',{headers:{cookie:'session=privada'}}),env);
  const data=await response.json();
  assert.equal(data.ready,true);
  assert.equal(seen.headers.get('cookie'),null);
  assert.equal(new URL(seen.url).origin,'https://amc-o0xb.onrender.com');
});

test('con Render despierto entrega la app real',async()=>{
  const calls=[];
  const handle=createHandler({fetchImpl:async req=>{calls.push(req);if(new URL(req.url).pathname==='/healthz')return new Response('ok',{status:200});return new Response('APP',{status:200,headers:{'content-type':'text/html'}});}});
  const response=await handle(htmlRequest(),env);
  assert.equal(await response.text(),'APP');
  assert.equal(calls.length,2);
  assert.equal(new URL(calls[1].url).origin,'https://amc-o0xb.onrender.com');
});

test('API POST se proxya transparente y nunca recibe loader HTML',async()=>{
  let seen;
  const handle=createHandler({fetchImpl:async req=>{seen=req;return new Response('{"saved":true}',{status:201,headers:{'content-type':'application/json','set-cookie':'sid=abc; Path=/; Secure; HttpOnly'}});}});
  const request=new Request('https://app.amcconstrucciones.com.ar/api/example?x=1',{method:'POST',headers:{'content-type':'application/json',origin:'https://app.amcconstrucciones.com.ar',cookie:'sid=abc'},body:'{"a":1}'});
  const response=await handle(request,env);
  assert.equal(response.status,201);
  assert.equal(new URL(seen.url).toString(),'https://amc-o0xb.onrender.com/api/example?x=1');
  assert.equal(seen.method,'POST');
  assert.equal(seen.headers.get('origin'),'https://app.amcconstrucciones.com.ar');
  assert.equal(seen.headers.get('cookie'),'sid=abc');
  assert.equal(await seen.text(),'{"a":1}');
  assert.match(response.headers.get('set-cookie'),/sid=abc/);
});

test('assets pasan directo al origen sin chequeo previo',async()=>{
  const calls=[];
  const handle=createHandler({fetchImpl:async req=>{calls.push(req);return new Response('asset',{status:200});}});
  const response=await handle(new Request('https://app.amcconstrucciones.com.ar/assets/amc-logo.webp',{headers:{accept:'image/webp'}}),env);
  assert.equal(await response.text(),'asset');
  assert.equal(calls.length,1);
  assert.equal(new URL(calls[0].url).pathname,'/assets/amc-logo.webp');
});

test('un 5xx del documento inicial se reemplaza por loader AMC',async()=>{
  let call=0;
  const handle=createHandler({fetchImpl:async()=>{call+=1;return call===1?new Response('ok',{status:200}):new Response('render error',{status:503});}});
  const response=await handle(htmlRequest(),env);
  const body=await response.text();
  assert.equal(response.status,200);
  assert.match(body,/Preparando tu espacio AMC/);
});
