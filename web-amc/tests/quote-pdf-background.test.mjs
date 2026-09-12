import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createQuotePdfBackground} from '../public/quote-pdf-background.js';

test('generador PDF usa iframe oculto transitorio sin busy ni refresh y actualiza estado local',()=>{
 const source=readFileSync(new URL('../public/quote-pdf-background.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/AMCBusy|refresh\s*\(/);
 assert.match(source,/frame\.hidden=true/);
 assert.match(source,/data-quote-pdf-actions/);
 assert.match(source,/pdf-failed/);
 const previous={document:globalThis.document,window:globalThis.window,location:globalThis.location,CSS:globalThis.CSS};
 let listener=null,appended=null,removed=false;
 const actions={dataset:{requestId:'r-1'},innerHTML:''};
 const frame={hidden:false,tabIndex:0,dataset:{},contentWindow:{},setAttribute(){},remove(){removed=true;}};
 const state={csrf:'csrf',quotes:[{id:'q-1',requestId:'r-1',pdf:'',pdfPending:true}]};
 const messages=[];
 try{
  globalThis.CSS={escape:value=>String(value)};
  globalThis.location={origin:'http://localhost'};
  globalThis.document={createElement(tag){assert.equal(tag,'iframe');return frame;},body:{append(node){appended=node;}},querySelectorAll(){return [actions];}};
  globalThis.window={addEventListener(type,callback){if(type==='message')listener=callback;},removeEventListener(){}};
  const pdf=createQuotePdfBackground({getState:()=>state,toast:text=>messages.push(text),timeoutMs:5000});
  assert.equal(pdf.generatePdf('r-1','q-1'),true);
  assert.equal(appended,frame);
  assert.equal(frame.hidden,true);
  assert.equal(frame.dataset.amcPdfBackground,'1');
  assert.match(frame.src,/generatePdf=1/);
  assert.match(actions.innerHTML,/Preparando PDF/);
  listener({origin:'http://localhost',source:frame.contentWindow,data:{type:'amc:pdf-ready',quoteId:'q-1',pdf:'/files/q-1.pdf'}});
  assert.equal(removed,true);
  assert.equal(state.quotes[0].pdf,'/files/q-1.pdf');
  assert.equal(state.quotes[0].pdfPending,false);
  assert.match(actions.innerHTML,/Descargar PDF/);
  assert.match(actions.innerHTML,/Compartir PDF/);
  assert.match(messages.at(-1),/PDF generado y listo/);
  pdf.dispose();
 }finally{
  for(const [key,value] of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
 }
});
