import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createAdminSystemUI} from '../public/admin-system-ui.js';

test('admin More renders one canonical Portada pública entry without a runtime patch',async()=>{
 const index=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
 const ui=createAdminSystemUI({
  getState:()=>({user:{role:'client'}}),
  getConfig:()=>({}),
  heading:(eyebrow,title,subtitle)=>`<header><small>${eyebrow}</small><h1>${title}</h1><p>${subtitle}</p></header>`,
  esc:value=>String(value),
  date:value=>String(value)
 });
 const html=ui.more();
 assert.doesNotMatch(index,/admin-menu-extras\.js/);
 assert.equal((html.match(/href="#portada"/g)||[]).length,1);
 assert.match(html,/>Portada pública</);
 assert.match(html,/href="#calendario"/);
});

test('admin More owns route deduplication before rendering',async()=>{
 const system=await readFile(new URL('../public/admin-system-ui.js',import.meta.url),'utf8');
 assert.match(system,/const uniqueMoreSections=/);
 assert.match(system,/const routes=new Set\(\)/);
 assert.match(system,/if\(routes\.has\(route\)\)return false/);
 assert.match(system,/uniqueMoreSections\(\)\.map/);
});
