import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createApp} from '../server.mjs';

const parseDocs=(db,kind)=>db.prepare('SELECT owner,body FROM docs WHERE kind=?').all(kind).map(row=>({owner:row.owner,value:JSON.parse(row.body)}));

test('Android apunta a API 36 y la documentación coincide con la release actual',async()=>{
 const [gradle,workflow,readiness]=await Promise.all([
  readFile(new URL('../../app/build.gradle',import.meta.url),'utf8'),
  readFile(new URL('../../.github/workflows/build-apk.yml',import.meta.url),'utf8'),
  readFile(new URL('../../PLAY_STORE_READINESS.md',import.meta.url),'utf8')
 ]);
 assert.match(gradle,/minSdk 29/);
 assert.match(gradle,/compileSdk 36/);
 assert.match(gradle,/targetSdk 36/);
 assert.match(gradle,/versionCode 9/);
 assert.match(gradle,/versionName '1\.0\.2'/);
 assert.match(workflow,/platforms;android-36/);
 assert.match(workflow,/build-tools;36\.0\.0/);
 assert.match(readiness,/Versión Android: `1\.0\.2`/);
 assert.match(readiness,/`versionCode`: `9`/);
 assert.match(readiness,/Android mínimo: API 29/);
 assert.doesNotMatch(readiness,/versionCode 7/);
});

test('recurso web de eliminación publica una solicitud sin exponer si la cuenta existe',async()=>{
 const previousOrigin=process.env.AMC_LANDING_ORIGIN,landingOrigin='https://landing.amc.test';
 process.env.AMC_LANDING_ORIGIN=landingOrigin;
 const app=createApp({dbPath:':memory:',origin:'http://localhost:4180'});
 app.addUser('owner@amc.test','Strong-Owner-2026!','AMC','admin');
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+app.server.address().port;
 const call=async({origin=landingOrigin,method='POST',body}={})=>fetch(base+'/api/public/account-deletion',{method,headers:{Origin:origin,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const payload={submissionId:'play-delete-001',email:'cliente@amc.test',reason:'Quiero cerrar mi cuenta.',website:''};
 try{
  const preflight=await call({method:'OPTIONS'});
  assert.equal(preflight.status,204);
  assert.equal(preflight.headers.get('access-control-allow-origin'),landingOrigin);
  const blocked=await call({origin:'https://otra-web.test',body:payload});
  assert.equal(blocked.status,403);
  const created=await call({body:payload});
  assert.equal(created.status,201);
  const response=await created.json();
  assert.equal(response.ok,true);
  assert.doesNotMatch(JSON.stringify(response),/cliente@amc\.test/);
  const requests=parseDocs(app.db,'accountDeletionRequest');
  assert.equal(requests.length,1);
  assert.equal(requests[0].value.source,'web');
  assert.equal(requests[0].value.verification,'Pendiente');
  const repeated=await call({body:{...payload,submissionId:'play-delete-002'}});
  assert.equal(repeated.status,200);
  assert.equal(parseDocs(app.db,'accountDeletionRequest').length,1);
  const spam=await call({body:{...payload,submissionId:'play-delete-spam',website:'https://spam.test'}});
  assert.equal(spam.status,202);
  assert.equal(parseDocs(app.db,'accountDeletionRequest').length,1);
 }finally{
  await new Promise(resolve=>app.server.close(resolve));
  if(previousOrigin===undefined)delete process.env.AMC_LANDING_ORIGIN;else process.env.AMC_LANDING_ORIGIN=previousOrigin;
 }
});

test('landing informa privacidad, publica enlaces legales y la app usa la política canónica',async()=>{
 const [landing,privacy,deletion,script,accountUi,formCss]=await Promise.all([
  readFile(new URL('../../docs/index.html',import.meta.url),'utf8'),
  readFile(new URL('../../docs/privacidad.html',import.meta.url),'utf8'),
  readFile(new URL('../../docs/eliminar-cuenta.html',import.meta.url),'utf8'),
  readFile(new URL('../../docs/assets/js/account-deletion.js',import.meta.url),'utf8'),
  readFile(new URL('../public/account-ui.js',import.meta.url),'utf8'),
  readFile(new URL('../../docs/assets/css/landing-form.css',import.meta.url),'utf8')
 ]);
 assert.match(privacy,/Política de privacidad/);
 assert.match(privacy,/Ariel Maximiliano Campos/);
 assert.match(privacy,/Ataliva Herrera 468, La Falda, Córdoba, Argentina/);
 assert.match(privacy,/camposariel313@gmail\.com/);
 assert.match(privacy,/18 de septiembre de 2026/);
 assert.match(privacy,/eliminar-cuenta\.html/);
 assert.match(deletion,/accountDeletionForm/);
 assert.match(script,/api\/public\/account-deletion/);
 assert.match(accountUi,/https:\/\/amcconstrucciones\.com\.ar\/privacidad\.html/);
 assert.doesNotMatch(accountUi,/amc-construcciones\.onrender\.com\/privacidad\.html/);
 assert.match(landing,/Al enviar esta consulta, AMC Construcciones utilizará los datos ingresados/);
 assert.match(landing,/class="contact-privacy"/);
 assert.match(landing,/href="privacidad\.html"/);
 assert.match(landing,/href="eliminar-cuenta\.html"/);
 assert.match(formCss,/\.contact-privacy/);
});
