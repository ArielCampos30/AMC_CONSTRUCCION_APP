import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('etapa 3B.1 reemplaza el cotizador embebido por un asistente nativo',()=>{
 const index=read('../public/index.html');
 const wrapper=read('../public/features-ui-v2.js');
 const wizard=read('../public/quote-wizard.js');
 assert.match(index,/type="importmap"/);
 assert.match(index,/"\/features-ui\.js":"\/features-ui-v2\.js"/);
 assert.doesNotMatch(index,/\/estimator-shell\.js/);
 assert.match(wrapper,/name==='cotizador'\?wizard\.render\(\):legacy\.render\(name\)/);
 assert.match(wrapper,/wizard\.open\(requestId,quoteId,mode\)/);
 assert.doesNotMatch(wizard,/<iframe/i);
 assert.match(wizard,/PASO 1 DE 7/);
 assert.match(wizard,/PASO 2 DE 7/);
 assert.match(wizard,/Continuar →/);
 assert.match(wizard,/← Volver/);
});

test('etapa 3B.1 precarga cliente y conserva trabajos al volver dentro del asistente',()=>{
 const wizard=read('../public/quote-wizard.js');
 assert.match(wizard,/requestId=nextRequest\|\|''/);
 assert.match(wizard,/clientRef=\(lead\?'lead:':'user:'\)\+id/);
 assert.match(wizard,/if\(works&&lastWorkRequest===r\.id\)return works/);
 assert.match(wizard,/step=2;initialiseWorks\(\);paint\(\)/);
 assert.match(wizard,/if\(back&&step>1\)\{step--;paint\(\);return;\}/);
});

test('etapa 3B.1 usa responsive propio y no agrega important',()=>{
 const css=read('../public/quote-wizard.css');
 const wizard=read('../public/quote-wizard.js');
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(css,/@media\(max-width:480px\)/);
 assert.match(css,/@media\(max-width:360px\)/);
 assert.match(css,/width:min\(1120px,94vw\)/);
 assert.doesNotMatch(css,/!important/);
 assert.doesNotMatch(wizard,/!important/);
});

test('el tarifario queda fuera del asistente nuevo y el legado sigue aislado para cortes posteriores',()=>{
 const wrapper=read('../public/features-ui-v2.js');
 const wizard=read('../public/quote-wizard.js');
 assert.match(wrapper,/features-ui\.js\?legacy=1/);
 assert.doesNotMatch(wizard,/data-estimator-view="tariff"/);
 assert.match(wizard,/Tarifario independiente/);
});