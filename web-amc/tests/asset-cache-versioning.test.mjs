import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {staticFileRoutes} from '../static-file-routes.mjs';
import {staticResponse} from '../static-response.mjs';
import {assetUrl,canonicalAssetPath,assetBase} from '../public/asset-url.js';
import {readFile} from 'node:fs/promises';

const source=name=>readFile(new URL('../public/'+name,import.meta.url),'utf8');

function fakeResponse(){
 const headers=new Map(),body=[];
 return {headers,body,status:0,res:{setHeader(name,value){headers.set(name.toLowerCase(),value);},writeHead(status){this.statusCode=status;},end(value){body.push(value);}}};
}

test('rutas versionadas usan SHA, caché immutable y rechazan versiones viejas',()=>{
 const calls={static:[],send:[]},headers=new Map(),res={setHeader(name,value){headers.set(name.toLowerCase(),value);}};
 const routes=staticFileRoutes({
  ROOT:'/srv/amc',path,version:'abc1234',readFileSync(){return Buffer.from('x');},
  staticResponse(req,response,file,options){calls.static.push({req,response,file,options});},
  send(response,status,data){calls.send.push({response,status,data});},
  fail(status,message){throw Object.assign(Error(message),{status});}
 });
 const req={method:'GET',headers:{}};
 assert.equal(routes.assetBase,'/_amc/abc1234');
 assert.equal(routes.serveEarly({req,res,p:'/_amc/abc1234/app.js',method:'GET'}),true);
 assert.equal(calls.static.at(-1).file,path.resolve('/srv/amc/public','./app.js'));
 assert.equal(calls.static.at(-1).options.cacheControl,'public, max-age=31536000, immutable');
 assert.equal(routes.serveEarly({req,res,p:'/app.js',method:'GET'}),true);
 assert.equal(calls.static.at(-1).options.cacheControl,'public, max-age=0, must-revalidate');
 assert.equal(routes.serveEarly({req,res,p:'/_amc/old0000/app.js',method:'GET'}),true);
 assert.equal(calls.send.at(-1).status,410);
 assert.equal(headers.get('cache-control'),'no-store');
});

test('HTML y Service Worker reciben el prefijo de la versión actual al servirse',()=>{
 const calls=[],routes=staticFileRoutes({
  ROOT:'/srv/amc',path,version:'abc1234',readFileSync(){return Buffer.from('x');},
  staticResponse(req,res,file,options){calls.push({file,options});},send(){},fail(){}
 });
 const req={method:'GET',headers:{}},res={setHeader(){}};
 routes.serveEarly({req,res,p:'/',method:'GET'});
 const index=calls.at(-1).options.transform(Buffer.from('<script src="__AMC_ASSET_BASE__/app.js"></script>'));
 assert.equal(index,'<script src="/_amc/abc1234/app.js"></script>');
 routes.serveEarly({req,res,p:'/sw.js',method:'GET'});
 const sw=calls.at(-1).options.transform(Buffer.from('const v="__AMC_ASSET_VERSION__",b="__AMC_ASSET_BASE__";'));
 assert.equal(sw,'const v="abc1234",b="/_amc/abc1234";');
 assert.equal(calls.at(-1).options.cacheControl,'public, max-age=0, must-revalidate');
});

test('staticResponse aplica la política indicada sin perder ETag ni HEAD',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'amc-static-')),file=path.join(dir,'asset.js');writeFileSync(file,'export const ok=true;');
 try{
  const first=fakeResponse(),req={method:'GET',headers:{}};
  staticResponse(req,first.res,file,{cacheControl:'public, max-age=31536000, immutable',variant:'abc1234'});
  assert.equal(first.headers.get('cache-control'),'public, max-age=31536000, immutable');
  assert.match(first.headers.get('etag'),/^"[a-f0-9]{64}"$/);
  const second=fakeResponse();
  staticResponse({method:'HEAD',headers:{'if-none-match':first.headers.get('etag')}},second.res,file,{cacheControl:'public, max-age=31536000, immutable',variant:'abc1234'});
  assert.equal(second.res.statusCode,304);assert.equal(second.body.at(-1),undefined);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('helpers conservan el prefijo en CSS dinámico y canonizan su ruta lógica',()=>{
 const moduleUrl='https://amc.test/_amc/abc1234/app-role-assets.js';
 assert.equal(assetBase(moduleUrl),'/_amc/abc1234');
 assert.equal(assetUrl('/admin-v3.css',moduleUrl),'/_amc/abc1234/admin-v3.css');
 assert.equal(assetUrl('./employee-v4.css',moduleUrl),'/_amc/abc1234/employee-v4.css');
 assert.equal(canonicalAssetPath('https://amc.test/_amc/abc1234/admin-v3.css'),'/admin-v3.css');
 assert.equal(assetUrl('/admin-v3.css','https://amc.test/app-role-assets.js'),'/admin-v3.css');
});

test('templates de arranque y offline no dejan JS/CSS críticos sin versionar',async()=>{
 const [html,offline,sw]=await Promise.all([source('index.html'),source('offline.html'),source('sw.js')]);
 assert.match(html,/__AMC_ASSET_BASE__\/app-bootstrap\.js/);
 assert.match(html,/__AMC_ASSET_BASE__\/styles\.css/);
 assert.doesNotMatch(html,/(?:src|href)="\/(?:app-bootstrap|styles|connected|unified|welcome|team|planning|aqua|amc-theme|notice-ui|mobile-chat|media-viewer)\.(?:js|css)"/);
 assert.match(offline,/__AMC_ASSET_BASE__\/offline\.js/);
 assert.match(offline,/__AMC_ASSET_BASE__\/offline\.css/);
 assert.match(sw,/AMC-offline-shell-v12/);
 assert.match(sw,/__AMC_ASSET_VERSION__/);
 assert.match(sw,/__AMC_ASSET_BASE__/);
});
