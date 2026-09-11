import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('etapa 3B.1 carga el cotizador nativo sin importmap ni iframe visible',()=>{
 const index=read('../public/index.html');
 const app=read('../public/app.js');
 const wrapper=read('../public/features-ui.js');
 const legacy=read('../public/features-ui-legacy.js');
 const wizard=read('../public/quote-wizard.js');
 assert.doesNotMatch(index,/type="importmap"/);
 assert.doesNotMatch(index,/\/estimator-shell\.js/);
 assert.match(app,/import \{createFeatures\} from '\.\/features-ui\.js'/);
 assert.match(wrapper,/features-ui-legacy\.js/);
 assert.match(wrapper,/createQuoteWizard/);
 assert.match(wrapper,/name==='cotizador'\?wizard\.render\(\):legacy\.render\(name\)/);
 assert.match(legacy,/createFloatingChat/);
 assert.doesNotMatch(wizard,/<iframe/i);
 assert.match(wizard,/PASO 1 DE 7/);
 assert.match(wizard,/PASO 2 DE 7/);
 assert.match(wizard,/Continuar →/);
 assert.match(wizard,/← Volver/);
});

test('etapa 3B conserva precarga cliente y trabajos al navegar entre pasos',()=>{
 const wizard=read('../public/quote-wizard.js');
 assert.match(wizard,/requestId=nextRequest\|\|''/);
 assert.match(wizard,/clientRef=\(lead\?'lead:':'user:'\)\+id/);
 assert.match(wizard,/if\(works&&lastWorkRequest===r\.id\)return works/);
 assert.match(wizard,/if\(step<4\)\{step\+\+;if\(step>=2\)initialiseWorks\(\);paint\(\);\}/);
 assert.match(wizard,/if\(back&&step>1\)\{step--;paint\(\);return;\}/);
});

test('etapa 3B.1 usa responsive propio y evita important y recargas de pagina en codigo nuevo',()=>{
 const css=read('../public/quote-wizard.css');
 const wizard=read('../public/quote-wizard.js');
 const wrapper=read('../public/features-ui.js');
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(css,/@media\(max-width:480px\)/);
 assert.match(css,/@media\(max-width:360px\)/);
 assert.match(css,/width:min\(1120px,94vw\)/);
 assert.doesNotMatch(css,/!important/);
 assert.doesNotMatch(wizard,/!important/);
 assert.doesNotMatch(wrapper,/!important/);
 assert.doesNotMatch(wizard,/(?:window\.)?location\.reload\s*\(/);
 assert.doesNotMatch(wrapper,/(?:window\.)?location\.reload\s*\(/);
});

test('el tarifario no vuelve a incrustarse en el asistente nuevo y el legado queda aislado',()=>{
 const wrapper=read('../public/features-ui.js');
 const wizard=read('../public/quote-wizard.js');
 assert.match(wrapper,/features-ui-legacy\.js/);
 assert.doesNotMatch(wizard,/data-estimator-view="tariff"/);
 assert.doesNotMatch(wizard,/estimator-shell\.js/);
});
