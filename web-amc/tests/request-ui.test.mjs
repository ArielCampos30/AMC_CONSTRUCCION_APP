import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequestUI} from '../public/request-ui.js';

const esc=value=>String(value??'');
const heading=(tag,title)=>`<h1>${tag}|${title}</h1>`;
const field=(label,name,type='text',value='',required=true)=>`<label>${label}<input name="${name}" type="${type}" value="${value}" ${required?'required':''}></label>`;
const options=items=>items.map(item=>`<option>${item}</option>`).join('');
const empty=(title,body)=>`<div class="empty">${title}|${body}</div>`;

test('solicitud y visita se renderizan desde request-ui sin mover el submit',async()=>{
 let selectedPost='post-1';
 let state={user:null,posts:[],services:['Pintura'],serviceCatalog:{Pintura:['Interior','Exterior']}};
 const ui=createRequestUI({getState:()=>state,getSelectedPost:()=>selectedPost,isAdmin:()=>state.user?.role==='admin',auth:()=>'<form id="login"></form>',heading,field,options,esc,empty,today:()=>'2026-09-09'});

 assert.match(ui.render(),/id="login"/);

 state={user:{id:'admin',role:'admin'},posts:[],services:[],serviceCatalog:{}};
 assert.match(ui.render(),/Esta es tu cuenta de AMC/);

 state={user:{id:'client',role:'client',name:'Ana',phone:'3510000000',town:'Valle Hermoso',address:'Ruta 38'},posts:[{id:'post-1',title:'Living renovado',service:'Interior'}],services:['Pintura'],serviceCatalog:{Pintura:['Interior','Exterior']}};
 let html=ui.render();
 assert.match(html,/Solicitar trabajo/);
 assert.match(html,/id="request"/);
 assert.match(html,/data-type="presupuesto"/);
 assert.match(html,/Living renovado/);
 assert.match(html,/value="Interior" checked/);
 assert.match(html,/name="photos"/);
 assert.match(html,/name="camera"/);
 assert.match(html,/Medidas aproximadas/);

 html=ui.render(true);
 assert.match(html,/Solicitar una visita/);
 assert.match(html,/data-type="visita"/);
 assert.match(html,/name="day" type="date" min="2026-09-09"/);
 assert.match(html,/Mañana · 9 a 12/);
 assert.match(html,/AMC debe confirmar la disponibilidad/);

 const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 assert.match(app,/from '.\/request-ui\.js'/);
 assert.match(app,/requestUI\.render\(visit\)/);
 assert.match(app,/if\(f\.id==='request'\)/);
 assert.match(app,/files\.length>4/);
 assert.match(app,/input\[name=services\]:checked/);
 assert.match(app,/api\('\/api\/requests',\{\.\.\.data,services,photos,type:f\.dataset\.type,postId:selectedPost\}\)/);
 assert.match(app,/selectedPost=''/);
 assert.doesNotMatch(app,/function requestForm\(/);
});
