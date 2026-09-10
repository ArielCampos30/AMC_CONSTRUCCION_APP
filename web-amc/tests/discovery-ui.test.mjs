import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDiscoveryUI} from '../public/discovery-ui.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const heading=(tag,title)=>`<header><b>${tag}</b><h1>${title}</h1></header>`;
const empty=(title,body)=>`<div class="empty">${title}|${body}</div>`;
const post=item=>`<article data-post="${item.id}">${item.title}</article>`;

test('Guardados Servicios e Ideas se renderizan desde discovery-ui',async()=>{
 let admin=false;
 let state={posts:[{id:'p1',title:'Baño'}],favorites:['p1'],services:['Pintura'],requests:[]};
 const ui=createDiscoveryUI({getState:()=>state,isAdmin:()=>admin,heading,post,empty,esc});

 assert.match(ui.favorites(),/Baño/);
 assert.match(ui.services(),/Nuestros servicios/);
 assert.match(ui.services(),/#pedir/);
 assert.match(ui.ideas(),/Ideas para tu casa/);
 assert.match(ui.ideas(),/Planificá antes de renovar/);

 admin=true;
 state.requests=[{id:'r1',service:'Pintura',name:'Ana',status:'Nueva'}];
 const adminServices=ui.services();
 assert.match(adminServices,/PEDIDOS POR SERVICIO/);
 assert.match(adminServices,/Preparar presupuesto/);
 assert.match(adminServices,/data-id="r1"/);

 const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 assert.match(app,/from '.\/discovery-ui\.js'/);
 assert.match(app,/discoveryUI\.favorites\(\)/);
 assert.match(app,/discoveryUI\.services\(\)/);
 assert.match(app,/discoveryUI\.ideas\(\)/);
});
