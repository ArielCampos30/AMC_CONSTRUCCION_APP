import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createResourceViews} from '../resource-views.mjs';

const hiddenWork=['internalNotes','cost','internalCost','grossMargin','margin','journal','mobility','tools','contingency','calculations','estimatedTeam','personnelCost','actualPersonnelCost','actualOtherCosts','finalCost','realProfit'];
const hiddenQuote=['cost','internalCost','grossMargin','margin','journal','mobility','tools','contingency','calculations','internalNotes','estimatedTeam','personnelCost'];
const sample={id:'w1',title:'Trabajo',userId:'u1',budget:120000,payments:[1],baseBudget:100000,internalNotes:'privado',cost:1,internalCost:2,grossMargin:3,margin:4,journal:5,mobility:6,tools:7,contingency:8,calculations:{a:1},estimatedTeam:2,personnelCost:9,actualPersonnelCost:10,actualOtherCosts:11,finalCost:12,realProfit:13,visible:'sí'};

test('publicWork oculta todos los datos internos y conserva los públicos',()=>{
 const {publicWork}=createResourceViews();
 const original=structuredClone(sample),safe=publicWork(sample);
 for(const key of hiddenWork)assert.equal(key in safe,false,key);
 assert.equal(safe.id,'w1');
 assert.equal(safe.visible,'sí');
 assert.equal(safe.budget,120000);
 assert.deepEqual(sample,original);
});

test('publicQuote oculta costos, margen, notas y cálculo interno',()=>{
 const {publicQuote}=createResourceViews();
 const safe=publicQuote(sample);
 for(const key of hiddenQuote)assert.equal(key in safe,false,key);
 assert.equal(safe.id,'w1');
 assert.equal(safe.visible,'sí');
});

test('employeeWork parte de publicWork y además oculta datos comerciales y del cliente',()=>{
 const {employeeWork}=createResourceViews();
 const safe=employeeWork(sample);
 for(const key of [...hiddenWork,'budget','payments','baseBudget','userId'])assert.equal(key in safe,false,key);
 assert.equal(safe.id,'w1');
 assert.equal(safe.title,'Trabajo');
 assert.equal(safe.visible,'sí');
});

test('server delega las vistas de recursos sin duplicar filtros sensibles',async()=>{
 const server=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
 assert.match(server,/from '.\/resource-views\.mjs'/);
 assert.match(server,/createResourceViews\(\)/);
 assert.match(server,/const \{publicWork,publicQuote,employeeWork\}=createResourceViews\(\)/);
 assert.doesNotMatch(server,/const publicWork=w=>/);
 assert.doesNotMatch(server,/const publicQuote=q=>/);
 assert.doesNotMatch(server,/const employeeWork=w=>/);
});
