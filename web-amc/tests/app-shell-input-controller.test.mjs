import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createAppShellInputController} from '../public/app-shell-input-controller.js';

const documentStub=()=>({
 listeners:[],
 addEventListener(type,handler){this.listeners.push([type,handler]);},
});

function setup(overrides={}){
 const documentRef=documentStub(),calls=[];
 const controller=createAppShellInputController({
  documentRef,
  onClientSearch:(value,target)=>calls.push(['client',value,target.id]),
  onBudgetClientSearch:target=>calls.push(['budget',target.id]),
  setDirty:value=>calls.push(['dirty',value]),
  ...overrides,
 });
 return {controller,documentRef,calls};
}

test('attach registra una sola vez el listener global input',()=>{
 const {controller,documentRef}=setup();
 controller.attach();
 controller.attach();
 assert.equal(documentRef.listeners.length,1);
 assert.equal(documentRef.listeners[0][0],'input');
 assert.equal(documentRef.listeners[0][1],controller.handleInput);
});

test('búsqueda de clientes actualiza resultados sin marcar el shell como sucio',()=>{
 const {controller,calls}=setup();
 controller.handleInput({target:{id:'client-search-input',value:'Ariel'}});
 assert.deepEqual(calls,[['client','Ariel','client-search-input'],['dirty',false]]);
});

test('búsqueda de cliente del Cotizador conserva delegación y dirty=false',()=>{
 const {controller,calls}=setup();
 controller.handleInput({target:{id:'budget-client-search',value:'Ariel'}});
 assert.deepEqual(calls,[['budget','budget-client-search'],['dirty',false]]);
});

test('cualquier otro input marca la edición como sucia',()=>{
 const {controller,calls}=setup();
 controller.handleInput({target:{id:'description',value:'Cambio'}});
 assert.deepEqual(calls,[['dirty',true]]);
});

test('app.js delega input al controlador y conserva change fuera de este bloque',async()=>{
 const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 assert.match(app,/createAppShellInputController/);
 assert.match(app,/shellInputController\.attach\(\)/);
 assert.doesNotMatch(app,/document\.addEventListener\('input'/);
 assert.match(app,/document\.addEventListener\('change'/);
 assert.match(app,/planning\.change\(e\.target\)/);
});
