import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHomeUI} from '../public/home-ui.js';

const esc=value=>String(value??'');
const btn=(label,action,extra='',cls='primary')=>'<button class="'+cls+'" data-action="'+action+'" '+extra+'>'+label+'</button>';
const empty=(title,body)=>'<section>'+title+'|'+body+'</section>';
const post=item=>'<article>'+item.title+'</article>';

test('Inicio público se renderiza desde home-ui y app.js sólo lo orquesta',async()=>{
 const state={
  user:null,
  appearance:{title:'AMC Construcciones',subtitle:'Tu casa en buenas manos',photos:[]},
  posts:[]
 };
 const ui=createHomeUI({
  getState:()=>state,
  isAdmin:()=>false,
  getFilter:()=>'Todos',
  whatsappEnabled:false,
  esc,btn,post,empty
 });
 const html=ui.render();
 assert.match(html,/CONSTRUCCIONES Y ARREGLOS/);
 assert.match(html,/Contanos tu proyecto/);
 assert.match(html,/Nuestros trabajos/);
 assert.match(html,/Próximamente, nuestros trabajos/);

 const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 assert.match(app,/from '.\/home-ui\.js'/);
 assert.match(app,/const home=\(\)=>homeUI\.render\(\)/);
 assert.doesNotMatch(app,/function home\(\)/);
});
