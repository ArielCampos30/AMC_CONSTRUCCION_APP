import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdminHelpers} from '../public/admin-helpers.js';
import {readFile} from 'node:fs/promises';

const esc=value=>String(value??'');

test('helpers Admin conservan filtros, contactos, cierres y estados de presupuesto',async()=>{
 const state={
  requests:[{id:'r1',userId:'u1',leadId:'lead1'}],
  clients:[],
  agendaClients:[{id:'u1',name:'Cuenta',hasAccount:1},{id:'lead1',name:'Contacto actual',hasAccount:0}],
  closures:[
   {id:'c1',workId:'w1',date:'2026-09-08',status:'Pendiente de conformidad'},
   {id:'c2',workId:'w1',date:'2026-09-09',status:'Observaciones'}
  ]
 };
 const h=createAdminHelpers({getState:()=>state,esc});
 assert.match(h.chip('Nuevas','request','Nuevas'),/aria-pressed="true"/);
 assert.match(h.badge('En curso'),/data-status="En curso"/);
 assert.equal(h.request('r1').id,'r1');
 assert.equal(h.client('u1').name,'Cuenta');
 assert.equal(h.client('lead1').id,undefined);
 assert.equal(h.requestContact(state.requests[0]).name,'Contacto actual');
 assert.equal(h.latestClosureFor('w1').id,'c2');
 assert.equal(h.closureNeedsAction({id:'w1',status:'Finalizado'}),true);
 assert.equal(h.quoteCanEdit({status:'Enviado'}),true);
 assert.equal(h.quoteCanRevise({status:'Rechazado'}),true);
 assert.equal(h.quoteCanRevise({status:'Aceptado'}),false);
 const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 assert.match(app,/from '.\/admin-helpers\.js'/);
 assert.match(app,/createAdminHelpers\(\{getState:\(\)=>state,esc\}\)/);
 assert.doesNotMatch(app,/const adminChip=\(label,group,current\)=>/);
});
