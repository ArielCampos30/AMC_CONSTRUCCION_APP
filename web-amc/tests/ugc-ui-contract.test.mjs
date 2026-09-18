import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createAccountUI} from '../public/account-ui.js';
import {createUgcChatRuntime} from '../public/ugc-chat-runtime.js';

const heading=(tag,title)=>`<h1>${tag} ${title}</h1>`;
const field=(label,name,type='text',value='')=>`<label>${label}<input name="${name}" type="${type}" value="${value}"></label>`;
const btn=label=>`<button>${label}</button>`;
const esc=value=>String(value??'');
const team={render:()=>''};

function account({demo=false,state={}}={}){
 return createAccountUI({getState:()=>state,getConfig:()=>({demo}),getTwoFactorSetup:()=>null,isAdmin:()=>state.user?.role==='admin',team,heading,field,btn,esc,fetchTwoFactorStatus:async()=>({available:false,enabled:false})});
}

test('registro productivo exige aceptación explícita y demo sólo la preselecciona para CI',()=>{
 const production=account({demo:false}).auth(true),demo=account({demo:true}).auth(true);
 assert.match(production,/name="acceptTerms" value="true" required/);
 assert.doesNotMatch(production,/name="acceptTerms"[^>]*checked/);
 assert.match(production,/terminos\.html/);
 assert.match(production,/privacidad\.html/);
 assert.match(demo,/name="acceptTerms"[^>]*checked/);
});

test('perfil existente muestra aceptación pendiente antes de nuevo UGC',()=>{
 const state={user:{id:'client-1',role:'client',name:'Cliente',email:'cliente@amc.test',phone:'',town:'',address:'',sound:true},works:[],ugc:{termsRequired:true}};
 const html=account({state}).profile();
 assert.match(html,/Actualización de condiciones/);
 assert.match(html,/name="acceptTerms" value="true" required/);
 assert.match(html,/Términos de uso/);
});

test('runtime UGC no exige DOM durante pruebas de servidor',()=>{
 const runtime=createUgcChatRuntime({getState:()=>({}),api:async()=>({})});
 assert.doesNotThrow(()=>runtime.afterRender());
});

test('contrato UGC permanece conectado a chat, reseñas, dispatcher y documentos públicos',async()=>{
 const [features,community,dispatcher,terms,privacy]=await Promise.all([
  readFile(new URL('../public/features-ui.js',import.meta.url),'utf8'),
  readFile(new URL('../public/community-ui.js',import.meta.url),'utf8'),
  readFile(new URL('../server-request-dispatcher.mjs',import.meta.url),'utf8'),
  readFile(new URL('../../docs/terminos.html',import.meta.url),'utf8'),
  readFile(new URL('../../docs/privacidad.html',import.meta.url),'utf8')
 ]);
 assert.match(features,/createUgcChatRuntime/);
 assert.match(features,/ugcChat\.afterRender/);
 assert.match(community,/data-ugc-review-report/);
 assert.match(community,/Reportes de contenido/);
 assert.match(community,/data-ugc-admin-block/);
 assert.match(dispatcher,/ugc\.needsAcceptanceForPath/);
 assert.match(dispatcher,/ugc\.guardMessage/);
 assert.match(dispatcher,/ugc\.route/);
 assert.match(terms,/Reportes, bloqueo y moderación/);
 assert.match(terms,/amenazas, acoso/);
 assert.match(terms,/spam, engaño, malware/);
 assert.match(privacy,/Registros de aceptación de condiciones, reportes de contenido y bloqueos de chat/);
 assert.match(privacy,/terminos\.html/);
});
