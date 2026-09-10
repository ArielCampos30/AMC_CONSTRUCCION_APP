import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createCommunityUI} from '../public/community-ui.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const date=value=>value||'';
const heading=(tag,title,body='')=>`<header><b>${tag}</b><h1>${title}</h1><p>${body}</p></header>`;
const options=(items,value)=>items.map(item=>`<option ${item===value?'selected':''}>${item}</option>`).join('');
const empty=(title,body)=>`<div class="empty">${title}|${body}</div>`;
const btn=(label,action)=>`<button data-action="${action}">${label}</button>`;
const field=(label,name)=>`<label>${label}<input name="${name}"></label>`;

test('reseñas y referidos se renderizan desde el módulo sin mover sus acciones API',async()=>{
 let state={user:{id:'client-1',role:'client'},works:[],reviews:[],referrals:[],myReview:null};
 const ui=createCommunityUI({getState:()=>state,isAdmin:()=>state.user?.role==='admin',heading,options,esc,date,empty,btn,field});

 let html=ui.reviews();
 assert.match(html,/Reseña disponible al finalizar/);
 assert.doesNotMatch(html,/id="review"/);

 state.works=[{id:'work-1',status:'Finalizado'}];
 html=ui.reviews();
 assert.match(html,/id="review"/);
 assert.match(html,/Enviar reseña/);
 assert.match(html,/La reseña se publica después de revisión/);

 state={user:{id:'admin-1',role:'admin'},works:[],reviews:[{id:'r1',name:'Ana',rating:5,text:'Excelente trabajo',date:'2026-09-09'}],referrals:[]};
 html=ui.reviews();
 assert.match(html,/Pendientes de revisión/);
 assert.match(html,/id="pending-reviews-admin"/);
 assert.match(html,/Excelente trabajo/);

 state={user:{id:'client-1',role:'client'},works:[],reviews:[],referrals:[{id:'legacy-ref',name:'No usar estado',note:'',date:'2026-09-09'}]};
 html=ui.referrals();
 assert.match(html,/id="referral"/);
 assert.match(html,/data-action="share"/);
 assert.match(html,/id="referrals-list"/);
 assert.doesNotMatch(html,/No usar estado/);

 const [app,source]=await Promise.all([
  readFile(new URL('../public/app.js',import.meta.url),'utf8'),
  readFile(new URL('../public/community-ui.js',import.meta.url),'utf8')
 ]);
 assert.match(app,/from '.\/community-ui\.js'/);
 assert.match(app,/communityUI\.reviews\(\)/);
 assert.match(app,/communityUI\.referrals\(\)/);
 assert.match(app,/if\(f\.id==='review'\)await api\('\/api\/reviews',data\)/);
 assert.match(app,/if\(f\.id==='referral'\)await api\('\/api\/referrals',data\)/);
 assert.match(app,/case'approve-review':await api\('\/api\/reviews\/'/);
 assert.match(source,/fetch\('\/api\/reviews\/pending'/);
 assert.match(source,/fetch\('\/api\/referrals'/);
 assert.doesNotMatch(source,/state\.pendingReviews/);
 assert.doesNotMatch(source,/state\.referrals/);
 assert.doesNotMatch(app,/function reviews\(\)/);
 assert.doesNotMatch(app,/function referrals\(\)/);
});
