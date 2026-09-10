import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPostCardUI} from '../public/post-card-ui.js';

const esc=value=>String(value??'');
const date=value=>value||'';
const btn=(label,action,extra='',cls='primary')=>'<button class="'+cls+'" data-action="'+action+'" '+extra+'>'+label+'</button>';

test('tarjeta de publicación conserva favorito comparación e inspiración',async()=>{
 const state={favorites:['p1']};
 const before=new Set(['p1']);
 const ui=createPostCardUI({
  getState:()=>state,
  getBefore:()=>before,
  isAdmin:()=>false,
  esc,date,btn
 });
 const html=ui.render({
  id:'p1',town:'La Falda',date:'2026-09-09',title:'Baño renovado',
  description:'Trabajo completo',service:'Reformas',
  image:'/media/despues',before:'/media/antes',demo:true
 });
 assert.match(html,/IMAGEN ILUSTRATIVA/);
 assert.match(html,/Ver después/);
 assert.match(html,/data-action="compare"/);
 assert.match(html,/data-action="favorite"/);
 assert.match(html,/♥/);
 assert.match(html,/Quiero algo así/);
 assert.match(html,/data-action="inspired"/);

 const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 assert.match(app,/from '.\/post-card-ui\.js'/);
 assert.match(app,/const post=p=>postCardUI\.render\(p\)/);
 assert.doesNotMatch(app,/function post\(p\)/);
 assert.match(app,/case'compare':/);
 assert.match(app,/case'favorite':/);
 assert.match(app,/case'inspired':/);
});
