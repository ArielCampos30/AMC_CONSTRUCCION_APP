import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createApp} from '../server.mjs';
import {validWhatsAppSignature} from '../whatsapp-cloud.mjs';

const origin='http://localhost:4180';
const sign=(body,secret)=>'sha256='+createHmac('sha256',secret).update(body).digest('hex');
function actor(base){return {cookie:'',csrf:'',async call(path,body,expected=200,method=body===undefined?'GET':'POST'){const response=await fetch(base+path,{method,headers:{Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});assert.equal(response.status,expected,`${method} ${path}`);const setCookie=response.headers.get('set-cookie');if(setCookie)this.cookie=setCookie.split(';')[0];const data=await response.json();if(data.csrf)this.csrf=data.csrf;return data;}};}

test('firma de Meta se valida sobre el body crudo y rechaza alteraciones',()=>{
 const secret='meta-test-secret',raw=Buffer.from('{"object":"whatsapp_business_account"}'),signature=sign(raw,secret);
 assert.equal(validWhatsAppSignature(raw,signature,secret),true);
 assert.equal(validWhatsAppSignature(Buffer.from('{"object":"altered"}'),signature,secret),false);
 assert.equal(validWhatsAppSignature(raw,'',secret),false);
});

test('webhook WhatsApp verifica Meta, guarda mensajes una vez y expone inbox sólo a Admin',async()=>{
 const previous={verify:process.env.AMC_WHATSAPP_VERIFY_TOKEN,secret:process.env.AMC_WHATSAPP_APP_SECRET,phone:process.env.AMC_WHATSAPP_PHONE_NUMBER_ID,business:process.env.AMC_WHATSAPP_BUSINESS_ACCOUNT_ID};
 process.env.AMC_WHATSAPP_VERIFY_TOKEN='verify-d5a-test';process.env.AMC_WHATSAPP_APP_SECRET='secret-d5a-test';process.env.AMC_WHATSAPP_PHONE_NUMBER_ID='phone-123';process.env.AMC_WHATSAPP_BUSINESS_ACCOUNT_ID='waba-123';
 const app=createApp({dbPath:':memory:',origin});
 app.addUser('owner-wa-cloud@amc.test','Strong-Owner-2026!','AMC','admin');
 app.addUser('client-wa-cloud@amc.test','Strong-Client-2026!','Cliente','client');
 const request={id:'request-wa-cloud',solicitudId:'request-wa-cloud',userId:'admin',name:'Cliente WhatsApp',phone:'3548123456',town:'Valle Hermoso',service:'Pintura',status:'Nueva',date:'2026-09-17T12:00:00.000Z'};
 app.db.prepare('INSERT INTO docs(id,kind,owner,body) VALUES(?,?,?,?)').run(request.id,'request','',JSON.stringify(request));
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+app.server.address().port;
 try{
  const verify=await fetch(base+'/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verify-d5a-test&hub.challenge=challenge-ok');
  assert.equal(verify.status,200);assert.equal(await verify.text(),'challenge-ok');
  const payload={object:'whatsapp_business_account',entry:[{id:'waba-123',changes:[{field:'messages',value:{messaging_product:'whatsapp',metadata:{display_phone_number:'5493548633464',phone_number_id:'phone-123'},contacts:[{profile:{name:'Cliente WhatsApp'},wa_id:'5493548123456'}],messages:[{from:'5493548123456',id:'wamid.test-d5a',timestamp:'1789675200',text:{body:'Hola, quiero consultar por pintura'},type:'text'}]}}]}]};
  const raw=JSON.stringify(payload);
  const unsigned=await fetch(base+'/api/webhooks/whatsapp',{method:'POST',headers:{'Content-Type':'application/json'},body:raw});assert.equal(unsigned.status,403);
  for(let i=0;i<2;i++){const response=await fetch(base+'/api/webhooks/whatsapp',{method:'POST',headers:{'Content-Type':'application/json','X-Hub-Signature-256':sign(raw,'secret-d5a-test')},body:raw});assert.equal(response.status,200);}
  assert.equal(Number(app.db.prepare("SELECT COUNT(*) AS count FROM docs WHERE kind='whatsappMessage'").get().count),1);
  const admin=actor(base);await admin.call('/api/login',{email:'owner-wa-cloud@amc.test',password:'Strong-Owner-2026!'});
  const inbox=await admin.call('/api/admin/whatsapp/inbox');
  assert.equal(inbox.whatsapp.configured,true);assert.ok(inbox.whatsapp.verifiedAt);assert.ok(inbox.whatsapp.lastEventAt);assert.equal(inbox.whatsapp.autoReplies,false);
  assert.equal(inbox.whatsapp.conversations.length,1);assert.equal(inbox.whatsapp.conversations[0].messages.length,1);assert.equal(inbox.whatsapp.conversations[0].requestId,'request-wa-cloud');assert.match(inbox.whatsapp.conversations[0].lastText,/pintura/);
  const state=await admin.call('/api/state');assert.doesNotMatch(JSON.stringify(state),/wamid\.test-d5a/);assert.doesNotMatch(JSON.stringify(state),/whatsappMetaState/);
  const client=actor(base);await client.call('/api/login',{email:'client-wa-cloud@amc.test',password:'Strong-Client-2026!'});assert.equal((await client.call('/api/admin/whatsapp/inbox',undefined,403)).error,'Acceso restringido.');
 }finally{
  await new Promise(resolve=>app.server.close(resolve));
  for(const [key,value] of Object.entries(previous)){const envKey={verify:'AMC_WHATSAPP_VERIFY_TOKEN',secret:'AMC_WHATSAPP_APP_SECRET',phone:'AMC_WHATSAPP_PHONE_NUMBER_ID',business:'AMC_WHATSAPP_BUSINESS_ACCOUNT_ID'}[key];if(value===undefined)delete process.env[envKey];else process.env[envKey]=value;}
 }
});

test('bandeja WhatsApp se carga de forma dedicada dentro de Comercial',async()=>{
 const [index,runtime,css]=await Promise.all([readFile(new URL('../public/index.html',import.meta.url),'utf8'),readFile(new URL('../public/whatsapp-inbox-runtime.js',import.meta.url),'utf8'),readFile(new URL('../public/whatsapp-inbox.css',import.meta.url),'utf8')]);
 assert.match(index,/whatsapp-inbox\.css/);assert.match(index,/whatsapp-inbox-runtime\.js/);
 assert.match(runtime,/\/api\/admin\/whatsapp\/inbox/);assert.match(runtime,/commercial-whatsapp-inbox/);assert.match(runtime,/respuestas automáticas desactivadas/i);assert.match(runtime,/Sin consulta AMC vinculada/);assert.match(css,/wa-inbox-conversation/);
});
