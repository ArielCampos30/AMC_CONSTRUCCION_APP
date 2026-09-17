import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequestDispatcher} from '../server-request-dispatcher.mjs';
import {fail} from '../server-primitives.mjs';

function response(){
 return {
  headersSent:false,
  headers:new Map(),
  ended:false,
  setHeader(name,value){this.headers.set(String(name).toLowerCase(),value);},
  end(){this.ended=true;}
 };
}

function request({url='/api/example',method='GET',origin='https://amc.test',csrf='csrf',contentType='application/json',forwardedFor}={}){
 const headers={origin,'x-csrf-token':csrf,'content-type':contentType};
 if(forwardedFor)headers['x-forwarded-for']=forwardedFor;
 return {url,method,headers,socket:{remoteAddress:'127.0.0.1'},amcRequestId:'test-request'};
}

function makeDeps(overrides={}){
 const events=[];
 const deps={
  origin:'https://amc.test',
  staticFiles:{
   serveEarly(){return false;},
   requirePageMethod(){events.push('page-method');},
   serveFallback(){events.push('fallback');}
  },
  authentication:{
   resolve(){events.push('resolve');return {session:{csrf:'csrf'},user:{id:'u1',role:'admin'}};},
   async handlePublic(){return false;},
   logout(){return false;}
  },
  fail,
  checkRate(key,limit){events.push(`rate:${key}:${limit}`);},
  async readBody(){events.push('read-body');return {day:'2026-09-15',time:'10:00'};},
  recovery:{async route(){return false;}},
  whatsappCloud:{async publicRoute(){return false;},adminRoute(){return false;}},
  handlePublicSystem(){return false;},
  handleState(){return false;},
  mediaAccess:{async serve(){return false;}},
  async readMultipart(){events.push('read-multipart');return {file:true};},
  twoFactor:{async route(){return false;}},
  chat:{routeBeforeBody(){events.push('chat-before');return false;},routeAfterBody(){events.push('chat-after');return false;}},
  planning:{validateTime(){events.push('validate-time');},async route(){return false;}},
  handleAdminUtility(){events.push('admin-utility');return false;},
  appearance:{async route(){events.push('appearance');return false;}},
  closure:{async route(){events.push('closure');return false;}},
  fieldwork:{async route(){events.push('fieldwork');return false;}},
  team:{async route(){events.push('team');return false;}},
  purchases:{async route(){events.push('purchases');return false;}},
  async handleFeature(){events.push('feature');return false;},
  clientRequests:{async route(){events.push('client-requests');return false;}},
  handleProfile(){events.push('profile');return false;},
  async handleMediaUpload(){events.push('media-upload');return false;},
  async handleQuoteWork(){events.push('quote-work');return false;},
  handleCommunity(){events.push('community');return false;},
  notificationRoutes(){events.push('notifications');return false;},
  handleDevices(){events.push('devices');return false;},
  handleEstimatorPage(){events.push('estimator');return false;},
  send(res,status,body){res.statusCode=status;res.body=body;res.headersSent=true;events.push(`send:${status}`);}
 };
 return {events,deps:{...deps,...overrides}};
}

test('dispatcher serves early static files before resolving authentication',async()=>{
 const {events,deps}=makeDeps();
 deps.staticFiles={...deps.staticFiles,serveEarly(){events.push('early-static');return true;}};
 deps.authentication={...deps.authentication,resolve(){events.push('resolve');assert.fail('authentication must not run for early static files');}};
 const res=response();
 await createRequestDispatcher(deps)(request({url:'/assets/app.js'}),res);
 assert.deepEqual(events,['early-static']);
 assert.equal(res.headers.get('x-content-type-options'),'nosniff');
});

test('dispatcher preserves recovery route and uses Render forwarded client IP',async()=>{
 const {events,deps}=makeDeps();
 deps.authentication={...deps.authentication,resolve(){events.push('resolve');return {session:null,user:null};}};
 deps.recovery={async route(){events.push('recovery');return true;}};
 deps.handlePublicSystem=()=>{events.push('public-system');return false;};
 const res=response();
 await createRequestDispatcher(deps)(request({url:'/api/forgot-password',method:'POST',csrf:'',forwardedFor:'203.0.113.9, 10.0.0.1'}),res);
 assert.deepEqual(events,['resolve','rate:ip:203.0.113.9:recovery:8','read-body','recovery']);
});

test('dispatcher keeps authenticated API order around body parsing and route chain',async()=>{
 const {events,deps}=makeDeps();
 deps.handleAdminUtility=()=>{events.push('admin-utility');return true;};
 const res=response();
 await createRequestDispatcher(deps)(request({url:'/api/example',method:'POST'}),res);
 assert.deepEqual(events,['resolve','rate:u1:api:400','chat-before','read-body','chat-after','admin-utility']);
});

test('dispatcher keeps employee chat restriction after chat parsing and before business routes',async()=>{
 const {events,deps}=makeDeps();
 deps.authentication={...deps.authentication,resolve(){events.push('resolve');return {session:{csrf:'csrf'},user:{id:'employee-1',role:'employee'}};}};
 const res=response();
 await createRequestDispatcher(deps)(request({url:'/api/requests/request-1/messages'}),res);
 assert.deepEqual(events,['resolve','rate:employee-1:api:400','chat-before','read-body','chat-after','send:404']);
 assert.deepEqual(res.body,{error:'Conversación no encontrada.'});
});

test('dispatcher keeps page fallback order outside API routes',async()=>{
 const {events,deps}=makeDeps();
 const res=response();
 await createRequestDispatcher(deps)(request({url:'/clientes'}),res);
 assert.deepEqual(events,['resolve','page-method','estimator','fallback']);
});

test('dispatcher preserves requiresTwoFactor error payload',async()=>{
 const {events,deps}=makeDeps();
 deps.twoFactor={async route(){throw Object.assign(new Error('Confirmá tu segundo factor.'),{status:403,requiresTwoFactor:true});}};
 const res=response();
 await createRequestDispatcher(deps)(request({url:'/api/admin/2fa/status'}),res);
 assert.deepEqual(res.body,{error:'Confirmá tu segundo factor.',requiresTwoFactor:true});
 assert.equal(res.statusCode,403);
 assert.ok(events.includes('send:403'));
});
