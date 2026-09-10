import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createClientQuotesUI} from '../public/client-quotes-ui.js';

const esc=value=>String(value??'');
const heading=(tag,title)=>'<header><b>'+tag+'</b><h1>'+title+'</h1></header>';
const date=value=>value||'';
const money=value=>'$'+Number(value||0);
const empty=(title,body)=>'<section>'+title+'|'+body+'</section>';
const features={
 badge:quote=>quote.status,
 timeline:()=>'<div class="timeline"></div>',
 deadline:()=>'<div class="deadline"></div>'
};

test('Presupuestos del cliente conserva PDF y acciones de respuesta',async()=>{
 const state={quotes:[{
  id:'q1',number:'P-001',status:'Enviado',date:'2026-09-09',
  items:[{description:'Pintura'}],total:150000,payment:'Contado',notes:'Prueba',
  pdf:'/media/pdf1'
 }]};
 const ui=createClientQuotesUI({getState:()=>state,isAdmin:()=>false,heading,esc,features,date,money,empty});
 const html=ui.render();
 assert.match(html,/P-001/);
 assert.match(html,/data-action="download-quote-pdf"/);
 assert.match(html,/Aceptar presupuesto/);
 assert.match(html,/Pedir cambios/);
 assert.match(html,/No aceptar/);

 state.quotes[0].pdf='';
 const pending=ui.render('q1');
 assert.match(pending,/PDF pendiente de generar/);

 const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 assert.match(app,/from '.\/client-quotes-ui\.js'/);
 assert.match(app,/const quotes=selectedId=>clientQuotesUI\.render\(selectedId\)/);
 assert.doesNotMatch(app,/function quotes\(/);
 assert.match(app,/classList\.contains\('quote-reply'\)/);
});
