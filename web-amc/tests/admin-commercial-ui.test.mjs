import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCommercialModel,commercialPeriodFromPage,createAdminCommercialUI} from '../public/admin-commercial-ui.js';

const now=Date.parse('2026-09-17T20:00:00Z');
const state={
 requests:[
  {id:'r-landing',name:'Landing',service:'Pintura',town:'La Falda',date:'2026-09-16T12:00:00Z',source:'landing',createdBy:'landing',utmSource:'meta',utmCampaign:'punilla-septiembre'},
  {id:'r-client',name:'Cliente AMC',service:'Plomería',town:'Valle Hermoso',date:'2026-09-15T12:00:00Z',status:'Presupuestada'},
  {id:'r-manual',name:'Carga manual',service:'Albañilería',town:'Huerta Grande',date:'2026-09-14T12:00:00Z',createdBy:'admin-1',leadId:'lead-1',status:'En contacto'},
  {id:'r-lead-quote',name:'Lead cotizado',service:'Electricidad',town:'Villa Giardino',date:'2026-09-10T12:00:00Z',createdBy:'admin-1',leadId:'lead-2',status:'En contacto'},
  {id:'r-no-tomada',name:'No tomada',service:'Otro',town:'Cosquín',date:'2026-09-09T12:00:00Z',createdBy:'admin-1',leadId:'lead-3',status:'No tomada'}
 ],
 quotes:[
  {id:'q-landing',requestId:'r-landing',status:'Aceptado',date:'2026-09-16T15:00:00Z'},
  {id:'q-client',requestId:'r-client',status:'Enviado',date:'2026-09-15T15:00:00Z'},
  {id:'q-lead',requestId:'r-lead-quote',status:'Guardado',date:'2026-09-10T15:00:00Z'}
 ],
 works:[{id:'w-landing',requestId:'r-landing',status:'Presupuesto aceptado'}]
};

test('períodos comerciales usan rutas estables',()=>{
 assert.equal(commercialPeriodFromPage('comercial'),'30');
 assert.equal(commercialPeriodFromPage('comercial/7'),'7');
 assert.equal(commercialPeriodFromPage('#comercial/90'),'90');
 assert.equal(commercialPeriodFromPage('comercial/todo'),'todo');
 assert.equal(commercialPeriodFromPage('comercial/desconocido'),'30');
});

test('embudo cuenta oportunidades únicas sin inflar versiones de presupuesto',()=>{
 const model=buildCommercialModel(state,{period:'30',now});
 assert.deepEqual(model.funnel.map(stage=>[stage.key,stage.count,stage.conversion]),[
  ['consultas',5,100],['presupuestadas',3,60],['enviadas',2,40],['aceptadas',1,20],['ganadas',1,20]
 ]);
 assert.deepEqual(model.sources.map(source=>[source.label,source.count,source.won]),[
  ['Carga manual',3,0],['Cliente AMC',1,0],['Landing web',1,1]
 ]);
 assert.deepEqual(model.campaigns.map(campaign=>[campaign.label,campaign.count,campaign.won]),[['punilla-septiembre · meta',1,1]]);
 assert.deepEqual(model.followups.map(item=>item.followup.label),['Sin presupuesto','Presupuesto sin entrega','Esperando respuesta','No tomada']);
});

test('filtro temporal toma la fecha original de la oportunidad',()=>{
 const model=buildCommercialModel(state,{period:'7',now});
 assert.equal(model.total,3);
 assert.equal(model.funnel.find(stage=>stage.key==='ganadas').count,1);
 assert.ok(model.followups.every(item=>item.request.id!=='r-lead-quote'&&item.request.id!=='r-no-tomada'));
});

test('pantalla Comercial expone embudo, origen, campañas y enlaces de seguimiento',()=>{
 const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 const ui=createAdminCommercialUI({getState:()=>state,heading:(tag,title,body)=>`<header>${tag}|${title}|${body}</header>`,esc,date:value=>String(value||'')});
 const html=ui.render('comercial/30');
 assert.match(html,/COMERCIAL AMC\|Embudo comercial/);
 assert.match(html,/Consultas/);assert.match(html,/Presupuestadas/);assert.match(html,/Presupuestos enviados/);assert.match(html,/Obras ganadas/);
 assert.match(html,/Landing web/);assert.match(html,/Cliente AMC/);assert.match(html,/Carga manual/);assert.match(html,/punilla-septiembre/);
 assert.match(html,/Seguimiento comercial/);assert.match(html,/#solicitud\/r-manual/);assert.match(html,/#presupuesto-admin\/q-client/);
 assert.match(html,/#comercial\/7/);assert.match(html,/#comercial\/90/);assert.match(html,/#comercial\/todo/);
});
