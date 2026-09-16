import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createAppShellSubmitController} from '../public/app-shell-submit-controller.js';

function documentMock(){
 const listeners=[];
 return {listeners,addEventListener(type,handler){listeners.push({type,handler});}};
}
function formMock({valid=true,message=false,id='',register=false}={}){
 const submitButton={disabled:false,textContent:'Enviando…'};
 const otherButton={disabled:false,textContent:'Otro'};
 return {
  id,dataset:register?{register:'true'}:{},submitButton,otherButton,
  reportValidity(){return valid;},
  querySelectorAll(selector){assert.equal(selector,'button');return [submitButton,otherButton];},
  querySelector(selector){assert.equal(selector,'button[type=submit]');return submitButton;},
  classList:{contains(name){return message&&name==='message-form';}}
 };
}

test('attach registra un único listener submit',()=>{
 const documentRef=documentMock();
 const controller=createAppShellSubmitController({documentRef,serializeForm:()=>({}),onSubmit:async()=>{}});
 controller.attach();controller.attach();
 assert.equal(documentRef.listeners.length,1);
 assert.equal(documentRef.listeners[0].type,'submit');
});

test('formulario inválido sólo previene submit y no serializa ni ejecuta',async()=>{
 const form=formMock({valid:false});let prevented=0,serialized=0,submitted=0;
 const controller=createAppShellSubmitController({documentRef:documentMock(),serializeForm:()=>{serialized++;return{};},onSubmit:async()=>{submitted++;}});
 await controller.handler({target:form,submitter:{value:'x'},preventDefault(){prevented++;}});
 assert.equal(prevented,1);assert.equal(serialized,0);assert.equal(submitted,0);
 assert.equal(form.submitButton.disabled,false);assert.equal(form.otherButton.disabled,false);
});

test('preserva datos y submitter y bloquea botones durante la operación',async()=>{
 const form=formMock(),submitter={value:'guardar'},data={name:'AMC'};let release;const wait=new Promise(resolve=>release=resolve);let received;
 const controller=createAppShellSubmitController({documentRef:documentMock(),serializeForm:value=>{assert.equal(value,form);return data;},onSubmit:async(...args)=>{received=args;await wait;}});
 const pending=controller.handler({target:form,submitter,preventDefault(){}});
 await Promise.resolve();
 assert.deepEqual(received,[form,data,submitter]);
 assert.equal(form.submitButton.disabled,true);assert.equal(form.otherButton.disabled,true);
 release();await pending;
 assert.equal(form.submitButton.disabled,false);assert.equal(form.otherButton.disabled,false);
});

test('login exitoso reanuda el deep link protegido que originó Ingresar',async()=>{
 const locationRef={hash:'#obra-admin/work-1'},form=formMock({id:'auth'});
 const controller=createAppShellSubmitController({documentRef:documentMock(),locationRef,serializeForm:()=>({}),onSubmit:async()=>{locationRef.hash='#inicio';}});
 await controller.handler({target:form,preventDefault(){}});
 assert.equal(locationRef.hash,'#obra-admin/work-1');
});

test('primer paso de 2FA conserva el deep link sin forzar una navegación prematura',async()=>{
 const locationRef={hash:'#presupuesto/quote-1'},form=formMock({id:'auth'});
 const controller=createAppShellSubmitController({documentRef:documentMock(),locationRef,serializeForm:()=>({}),onSubmit:async()=>{}});
 await controller.handler({target:form,preventDefault(){}});
 assert.equal(locationRef.hash,'#presupuesto/quote-1');
});

test('login normal y registro no inventan destino protegido',async()=>{
 for(const setup of [{hash:'#ingresar',register:false},{hash:'#registro',register:true}]){
  const locationRef={hash:setup.hash},form=formMock({id:'auth',register:setup.register});
  const controller=createAppShellSubmitController({documentRef:documentMock(),locationRef,serializeForm:()=>({}),onSubmit:async()=>{locationRef.hash='#inicio';}});
  await controller.handler({target:form,preventDefault(){}});
  assert.equal(locationRef.hash,'#inicio');
 }
});

test('error llega al callback y nunca reanuda una ruta antes de autenticar',async()=>{
 const locationRef={hash:'#trabajo/task-1'},form=formMock({id:'auth'}),failure=Error('falló');let captured;
 const controller=createAppShellSubmitController({documentRef:documentMock(),locationRef,serializeForm:()=>({}),onSubmit:async()=>{throw failure;},onError:error=>captured=error});
 await controller.handler({target:form,preventDefault(){}});
 assert.equal(captured,failure);assert.equal(locationRef.hash,'#trabajo/task-1');
 assert.equal(form.submitButton.disabled,false);assert.equal(form.otherButton.disabled,false);
});

test('message-form recupera exactamente el texto Enviar mensaje',async()=>{
 const form=formMock({message:true});
 const controller=createAppShellSubmitController({documentRef:documentMock(),serializeForm:()=>({}),onSubmit:async()=>{}});
 await controller.handler({target:form,preventDefault(){}});
 assert.equal(form.submitButton.textContent,'Enviar mensaje');
});

test('app.js delega la mecánica global de submit y conserva la lógica de negocio',async()=>{
 const [app,controller]=await Promise.all([
  readFile(new URL('../public/app.js',import.meta.url),'utf8'),
  readFile(new URL('../public/app-shell-submit-controller.js',import.meta.url),'utf8')
 ]);
 assert.match(app,/from '.\/app-shell-submit-controller\.js'/);
 assert.match(app,/createAppShellSubmitController\(/);
 assert.match(app,/async function handleShellSubmit\(f,data,submit\)/);
 assert.doesNotMatch(app,/document\.addEventListener\('submit',async e=>/);
 assert.match(app,/f\.id==='twofactor-setup'/);
 assert.match(app,/f\.id==='auth'/);
 assert.match(app,/f\.id==='request'/);
 assert.doesNotMatch(controller,/\/api\/|\bfetch\(|\breload\b|\brender\b|\bnavigate\b/);
 assert.match(controller,/isProtectedPage/);
 assert.match(controller,/form\.reportValidity\(\)/);
 assert.match(controller,/buttons\.forEach\(button=>button\.disabled=true\)/);
 assert.match(controller,/button\[type=submit\]/);
});
