import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createAdminClientDetailUI} from '../public/admin-client-detail-ui.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const heading=(tag,title,body='')=>`<header><b>${tag}</b><h1>${title}</h1><p>${body}</p></header>`;
const empty=(title,body)=>`<section class="empty">${title}|${body}</section>`;
const money=value=>'$'+Number(value).toFixed(2);

test('ficha Admin reúne cliente, solicitudes, presupuestos y obras sin mover acciones',async()=>{
 const state={
  agendaClients:[{id:'lead-1',name:'Ana',phone:'3548000000',town:'La Falda',address:'Av. 1',email:'',hasAccount:0}],
  clients:[],
  requests:[{id:'req-1',leadId:'lead-1',userId:'',services:['Pintura'],service:'Pintura',status:'Presupuestada'}],
  quotes:[{id:'quote-1',requestId:'req-1',number:'P-001',total:125000,status:'Guardado'}],
  works:[{id:'work-1',requestId:'req-1',userId:'lead-1',title:'Pintura interior',status:'Presupuesto aceptado'}]
 };
 let page='cliente/lead-1';
 const ui=createAdminClientDetailUI({getState:()=>state,getPage:()=>page,heading,esc,empty,money});
 const html=ui.render();
 assert.match(html,/Ana/);
 assert.match(html,/Av\. 1/);
 assert.match(html,/data-action="client-budget"/);
 assert.match(html,/data-action="edit-client"/);
 assert.match(html,/#solicitud\/req-1/);
 assert.match(html,/#presupuesto-admin\/quote-1/);
 assert.match(html,/#obra-admin\/work-1/);

 page='cliente/inexistente';
 assert.match(ui.render(),/Cliente no disponible/);

 const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 assert.match(app,/from '.\/admin-client-detail-ui\.js'/);
 assert.match(app,/const adminClientDetail=\(\)=>adminClientDetailUI\.render\(\)/);
 assert.doesNotMatch(app,/function adminClientDetail\(\)/);
 assert.match(app,/case'client-budget'/);
 assert.match(app,/case'edit-client'/);
});
