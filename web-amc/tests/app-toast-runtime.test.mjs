import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {TRANSIENT_MS,createAppToastRuntime} from '../public/app-toast-runtime.js';

function fakeToast(text='Guardado.',shown=true){
 const values=new Set(shown?['show']:[]);
 return {
  textContent:text,
  classList:{
   contains:value=>values.has(value),
   remove:value=>values.delete(value),
   add:value=>values.add(value),
  },
  shown:()=>values.has('show'),
 };
}

const documentFor=toast=>({querySelector:selector=>selector==='#toast'?toast:null});

test('la política oficial de toast conserva tres segundos',()=>{
 assert.equal(TRANSIENT_MS,3000);
 const toast=fakeToast(),scheduled=[],cleared=[];
 const runtime=createAppToastRuntime({
  documentRef:documentFor(toast),
  createMutationObserver:()=>null,
  setTimeoutRef:(callback,delay)=>{scheduled.push({callback,delay});return scheduled.length;},
  clearTimeoutRef:id=>cleared.push(id),
 });
 runtime.scheduleToastHide();
 assert.equal(scheduled.length,1);
 assert.equal(scheduled[0].delay,3000);
 assert.deepEqual(cleared,[0]);
 assert.equal(toast.shown(),true);
 scheduled[0].callback();
 assert.equal(toast.shown(),false);
});

test('un nuevo toast normal reinicia el temporizador',()=>{
 const toast=fakeToast('Primero'),scheduled=[],cleared=[];
 const runtime=createAppToastRuntime({
  documentRef:documentFor(toast),
  createMutationObserver:()=>null,
  setTimeoutRef:(callback,delay)=>{scheduled.push({callback,delay});return scheduled.length;},
  clearTimeoutRef:id=>cleared.push(id),
 });
 runtime.scheduleToastHide();
 toast.textContent='Segundo';
 runtime.scheduleToastHide();
 assert.equal(scheduled.length,2);
 assert.deepEqual(scheduled.map(item=>item.delay),[3000,3000]);
 assert.deepEqual(cleared,[0,1]);
});

test('éxitos de borrar eliminar o vaciar se ocultan inmediatamente sin programar otro timer',()=>{
 for(const text of ['Avisos leídos borrados.','Presupuesto eliminado.','Bandeja de avisos vaciada.']){
  const toast=fakeToast(text),scheduled=[];
  const runtime=createAppToastRuntime({
   documentRef:documentFor(toast),
   createMutationObserver:()=>null,
   setTimeoutRef:(callback,delay)=>{scheduled.push({callback,delay});return scheduled.length;},
   clearTimeoutRef:()=>{},
  });
  runtime.scheduleToastHide();
  assert.equal(toast.shown(),false,text);
  assert.equal(scheduled.length,0,text);
 }
});

test('attach observa sólo clase e hijos y aplica la política si el toast ya está visible',()=>{
 const toast=fakeToast('Visible al cargar'),observed=[],scheduled=[];
 const runtime=createAppToastRuntime({
  documentRef:documentFor(toast),
  createMutationObserver:callback=>({observe:(node,options)=>observed.push({node,options,callback})}),
  setTimeoutRef:(callback,delay)=>{scheduled.push({callback,delay});return 1;},
  clearTimeoutRef:()=>{},
 });
 runtime.attach();
 assert.equal(observed.length,1);
 assert.equal(observed[0].node,toast);
 assert.deepEqual(observed[0].options,{attributes:true,attributeFilter:['class'],childList:true});
 assert.equal(scheduled[0].delay,3000);
});

test('el índice carga el runtime oficial y ya no carga el patch UX',async()=>{
 const index=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
 assert.match(index,/app-shell-back-controller\.js[\s\S]*app-toast-runtime\.js/);
 assert.doesNotMatch(index,/ux-runtime-fixes\.js/);
});
