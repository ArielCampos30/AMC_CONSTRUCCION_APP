import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createApp} from '../server.mjs';

test('one final customer price is sent, documented and carried into the work',async()=>{
 const bridge=readFileSync(new URL('../public/presupuestos-bridge.js',import.meta.url),'utf8');
 assert.match(bridge,/const clientTotal=q=>quoteTotals\(q\)\.sale/);
 assert.match(bridge,/const workSubtotal=q=>/);
 assert.match(bridge,/const commercialPrice=q=>/);
 assert.match(bridge,/amcPriceManual=true/);
 assert.match(bridge,/reset-client-price/);
 assert.match(bridge,/const quoteForDocument=q=>\(\{\.\.\.q,total:clientTotal\(q\)\}\)/);
 assert.match(bridge,/total:clientTotal\(draft\)/);
 assert.match(bridge,/makePdf\(quoteForDocument\(draft\)\)/);
 const origin='http://localhost:4180',app=createApp({dbPath:':memory:',origin});
 app.addUser('admin@total.test','Strong-Admin-2026!','AMC','admin');
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+app.server.address().port;
 const actor=()=>({cookie:'',csrf:'',async call(path,body,status=200){const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});const value=await response.json();assert.equal(response.status,status,JSON.stringify(value));if(response.headers.get('set-cookie'))this.cookie=response.headers.get('set-cookie').split(';')[0];if(value.csrf)this.csrf=value.csrf;return value;}});
 try{const admin=actor(),client=actor();await admin.call('/api/login',{email:'admin@total.test',password:'Strong-Admin-2026!'});await client.call('/api/register',{email:'final@total.test',password:'Client-Test-2026!',name:'Precio final'});const request=await client.call('/api/requests',{name:'Precio final',phone:'3548400000',town:'La Falda',description:'Pintura',service:'Pintura',type:'presupuesto'},201);const total=324480,quote=await admin.call('/api/quotes',{requestId:request.id,externalId:'final-total-001',version:'f'.repeat(64),number:'AMC-TOTAL',items:[{description:'Pintura'}],total,internalCost:180000},201);assert.equal(quote.total,total);assert.equal((await client.call('/api/state')).quotes.find(q=>q.id===quote.id).total,total);await client.call('/api/quotes/'+quote.id+'/reply',{status:'Aceptado'});assert.equal((await admin.call('/api/state')).works.find(w=>w.quoteId===quote.id).budget,total);}finally{await new Promise(resolve=>app.server.close(resolve));}
});
