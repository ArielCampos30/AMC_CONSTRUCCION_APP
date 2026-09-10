import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createClientWorksUI} from '../public/client-works-ui.js';

const heading=(tag,title,body='')=>'<header><b>'+tag+'</b><h1>'+title+'</h1><p>'+body+'</p></header>';
const empty=(title,body)=>'<section>'+title+'|'+body+'</section>';
const esc=value=>String(value??'');
const date=value=>value||'';
const money=value=>'$'+Number(value||0);

test('Mi obra del cliente conserva selector pagos avances y accesos',async()=>{
 let selected='';
 const state={works:[{
  id:'w1',title:'Reforma baño',address:'La Falda',status:'En ejecución',
  start:'2026-09-10',end:'2026-09-15',budget:500000,baseBudget:450000,
  payments:[{amount:100000,description:'Seña',date:'2026-09-09'}],
  updates:[{image:'/media/f1',date:'2026-09-09',text:'Avance inicial'}]
 }]};
 const ui=createClientWorksUI({
  getState:()=>state,
  getWorkId:()=>selected,
  setWorkId:value=>selected=value,
  heading,empty,esc,date,money
 });
 const html=ui.render();
 assert.equal(selected,'w1');
 assert.match(html,/id="work-select"/);
 assert.match(html,/Presupuesto vigente/);
 assert.match(html,/Pagos registrados/);
 assert.match(html,/Saldo/);
 assert.match(html,/Avance inicial/);
 assert.match(html,/data-action="payment-pdf"/);
 assert.match(html,/#cierre/);
 assert.match(html,/#comprobantes/);
 assert.match(html,/#adicionales/);

 const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 assert.match(app,/from '.\/client-works-ui\.js'/);
 assert.match(app,/const works=\(\)=>clientWorksUI\.render\(\)/);
 assert.doesNotMatch(app,/function works\(\)/);
 assert.match(app,/if\(e\.target\.id==='work-select'\)\{workId=e\.target\.value;render\(\);\}/);
 assert.match(app,/case'payment-pdf':/);
});
