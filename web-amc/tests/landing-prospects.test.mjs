import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';

const parseDocs=(db,kind)=>db.prepare('SELECT owner,body FROM docs WHERE kind=?').all(kind).map(row=>({owner:row.owner,value:JSON.parse(row.body)}));

test('landing publica crea prospecto y solicitud sin abrir la API privada',async()=>{
 const previousOrigin=process.env.AMC_LANDING_ORIGIN;
 const landingOrigin='https://landing.amc.test';
 process.env.AMC_LANDING_ORIGIN=landingOrigin;
 const app=createApp({dbPath:':memory:',origin:'http://localhost:4180'});
 app.addUser('owner@amc.test','Strong-Owner-2026!','AMC','admin');
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+app.server.address().port;
 const call=async({origin=landingOrigin,method='POST',body}={})=>fetch(base+'/api/public/prospects',{method,headers:{Origin:origin,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const payload={submissionId:'landing-test-001',name:'María Pérez',phone:'03548 15 555555',town:'Valle Hermoso',service:'Albañilería',description:'Necesito reparar una pared con humedad.',utmSource:'instagram',utmMedium:'paid_social',utmCampaign:'punilla-septiembre',utmContent:'reparaciones',referrer:'https://instagram.com/',page:'https://landing.amc.test/?utm_source=instagram'};
 try{
  const preflight=await call({method:'OPTIONS'});
  assert.equal(preflight.status,204);
  assert.equal(preflight.headers.get('access-control-allow-origin'),landingOrigin);
  assert.match(preflight.headers.get('access-control-allow-methods')||'',/POST/);

  const blocked=await call({origin:'https://otra-web.test',body:payload});
  assert.equal(blocked.status,403);

  const created=await call({body:payload});
  assert.equal(created.status,201);
  assert.deepEqual(await created.json(),{ok:true});
  assert.equal(created.headers.get('access-control-allow-origin'),landingOrigin);

  const leads=parseDocs(app.db,'leadClient');
  const requests=parseDocs(app.db,'request');
  const submissions=parseDocs(app.db,'landingSubmission');
  assert.equal(leads.length,1);
  assert.equal(requests.length,1);
  assert.equal(submissions.length,1);
  assert.equal(leads[0].value.name,'María Pérez');
  assert.equal(leads[0].value.source,'landing');
  assert.equal(requests[0].value.leadId,leads[0].value.id);
  assert.equal(requests[0].value.status,'Nueva');
  assert.equal(requests[0].value.source,'landing');
  assert.equal(requests[0].value.utmSource,'instagram');
  assert.equal(requests[0].value.utmCampaign,'punilla-septiembre');
  assert.equal(requests[0].value.photos.length,0);

  const repeated=await call({body:payload});
  assert.equal(repeated.status,200);
  assert.equal(parseDocs(app.db,'request').length,1);

  const spam=await call({body:{...payload,submissionId:'landing-test-spam',website:'https://spam.test'}});
  assert.equal(spam.status,202);
  assert.equal(parseDocs(app.db,'request').length,1);

  const second=await call({body:{...payload,submissionId:'landing-test-002',description:'También necesito revisar otro muro.'}});
  assert.equal(second.status,201);
  assert.equal(parseDocs(app.db,'leadClient').length,1);
  assert.equal(parseDocs(app.db,'request').length,2);
 }finally{
  await new Promise(resolve=>app.server.close(resolve));
  if(previousOrigin===undefined)delete process.env.AMC_LANDING_ORIGIN;else process.env.AMC_LANDING_ORIGIN=previousOrigin;
 }
});
