import test from 'node:test';
import assert from 'node:assert/strict';
import {createTeam} from '../public/team-ui.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const field=(label,name,type='text',value='')=>`<label>${label}<input name="${name}" type="${type}" value="${esc(value)}"></label>`;
const heading=(tag,title,body='')=>`<header><span>${tag}</span><h1>${title}</h1><p>${body}</p></header>`;
const empty=(title,body)=>`<section><h2>${title}</h2><p>${body}</p></section>`;

test('Equipo usa lenguaje de integrantes y no ofrece desactivar el propio Admin',()=>{
 const state={
  user:{id:'admin-self',role:'admin'},
  employees:[
   {id:'admin-self',name:'Admin principal',email:'admin@amc.test',phone:'1',role:'admin',active:true},
   {id:'employee-2',name:'Empleado dos',email:'empleado@amc.test',phone:'2',role:'employee',active:true}
  ],
  requests:[],assignments:[],quotes:[],purchases:[]
 };
 const team=createTeam({getState:()=>state,esc,money:String,date:String,field,heading,empty,api:async()=>({}),upload:async()=>({})});
 const html=team.render('empleados');
 assert.match(html,/Agregar integrante/);
 assert.match(html,/Editar integrante/);
 assert.doesNotMatch(html,/Agregar empleado/);
 assert.doesNotMatch(html,/employee-access" data-id="admin-self"/);
 assert.match(html,/Tu propio acceso de Administrador se gestiona desde tu cuenta/);
 assert.match(html,/employee-access" data-id="employee-2"/);
});

test('cambio de rol desde Equipo llega al endpoint real',async()=>{
 const calls=[];
 const state={user:{id:'admin-self',role:'admin'},employees:[],requests:[],assignments:[],quotes:[],purchases:[]};
 const team=createTeam({getState:()=>state,esc,money:String,date:String,field,heading,empty,api:async(...args)=>{calls.push(args);return {};},upload:async()=>({})});
 const previousWindow=globalThis.window;
 globalThis.window={AMCConfirm:async()=>true};
 try{
  const form={classList:{contains:name=>name==='employee-role'},dataset:{id:'employee-2'}};
  const result=await team.submit(form,{role:'admin'});
  assert.equal(result,true);
  assert.deepEqual(calls,[['/api/employees/employee-2/role',{role:'admin'}]]);
 }finally{
  if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;
 }
});
