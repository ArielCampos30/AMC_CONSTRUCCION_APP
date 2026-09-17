import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createAdminCommercialUI,whatsappTargetFor} from '../public/admin-commercial-ui.js';

const readRepo=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');

test('WhatsApp comercial normaliza celulares argentinos y rechaza destinos incompletos',()=>{
 assert.equal(whatsappTargetFor('3548123456'),'5493548123456');
 assert.equal(whatsappTargetFor('+54 9 3548 123456'),'5493548123456');
 assert.equal(whatsappTargetFor('03548 15 123456'),'5493548123456');
 assert.equal(whatsappTargetFor('1234'),'');
});

test('Comercial muestra WhatsApp contextual sólo cuando la oportunidad tiene un teléfono utilizable',()=>{
 const state={requests:[{id:'r-wa',name:'Cliente Prueba',phone:'3548123456',town:'Valle Hermoso',service:'Pintura',date:'2026-09-17T12:00:00Z',status:'Presupuestada'}],quotes:[{id:'q-wa',requestId:'r-wa',status:'Enviado',date:'2026-09-17T13:00:00Z'}],works:[],commercialFollowups:[{id:'commercial-followup-r-wa',requestId:'r-wa',lastContactAt:'2026-09-17T14:00:00Z',nextAction:'WhatsApp',nextActionDay:'2026-09-18',note:'Seguimiento',history:[{type:'whatsapp_opened',date:'2026-09-17T14:00:00Z'}]}]};
 const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 const ui=createAdminCommercialUI({getState:()=>state,heading:()=>'',esc,date:value=>String(value||'')});
 const html=ui.render('comercial/30');
 assert.match(html,/Abrir WhatsApp/);
 assert.match(html,/https:\/\/wa\.me\/5493548123456\?text=/);
 assert.match(html,/WhatsApp iniciado/);
 assert.match(html,/Esperando respuesta/);
});

test('landing usa el WhatsApp Business real y mantiene el formulario como alta canónica',()=>{
 const landing=readRepo('docs/assets/js/landing.js');
 const html=readRepo('docs/index.html');
 assert.match(landing,/const WHATSAPP_NUMBER = "5493548633464"/);
 assert.match(landing,/https:\/\/wa\.me\/\$\{WHATSAPP_NUMBER\}/);
 assert.match(landing,/Continuar por WhatsApp/);
 assert.match(landing,/fetch\(PROSPECT_API/);
 assert.match(landing,/measure\("whatsapp_after_form"\)/);
 assert.match(landing,/const measurementContext = \{[\s\S]*utm_source:[\s\S]*landing_path:/);
 assert.doesNotMatch(landing,/measurementContext[\s\S]{0,220}(name|phone|description):/);
 assert.match(html,/class="floating js-wa"/);
});
