import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('cotizador nativo usa cuatro etapas de página completa sin importmap ni iframe',()=>{
 const index=read('../public/index.html');
 const app=read('../public/app.js');
 const wrapper=read('../public/features-ui.js');
 const legacy=read('../public/features-ui-legacy.js');
 const wizard=read('../public/quote-wizard.js');
 assert.doesNotMatch(index,/type="importmap"/);
 assert.doesNotMatch(index,/\/estimator-shell\.js/);
 assert.match(index,/quote-builder-review\.css/);
 assert.match(app,/import \{createFeatures\} from '\.\/features-ui\.js'/);
 assert.match(wrapper,/features-ui-legacy\.js/);
 assert.match(wrapper,/createQuoteWizard/);
 assert.match(wrapper,/name==='cotizador'\?wizard\.render\(\):legacy\.render\(name\)/);
 assert.match(legacy,/createFloatingChat/);
 assert.doesNotMatch(wizard,/<iframe/i);
 assert.match(wizard,/const PHASES=\['Cliente','Trabajos y precios','Costos y rentabilidad','Revisión'\]/);
 assert.match(wizard,/quote-wizard-page/);
 assert.doesNotMatch(wizard,/aria-modal/);
 assert.match(wizard,/ETAPA 1 DE 4/);
 assert.match(wizard,/ETAPA 2 DE 4/);
});

test('cliente filtra sus solicitudes y admite presupuesto directo o cliente nuevo',()=>{
 const wizard=read('../public/quote-wizard.js');
 assert.match(wizard,/requestClientRef\(request\)===clientRef/);
 assert.match(wizard,/Sin solicitud · presupuesto directo/);
 assert.match(wizard,/\/api\/admin\/clients/);
 assert.match(wizard,/Guardar y usar cliente/);
 assert.match(wizard,/Mostrando sólo solicitudes de/);
 assert.match(wizard,/pendingClientRef/);
});

test('editor usa el scroll natural de la página y evita important y recargas',()=>{
 const css=read('../public/quote-wizard.css');
 const reviewCss=read('../public/quote-builder-review.css');
 const wizard=read('../public/quote-wizard.js');
 const wrapper=read('../public/features-ui.js');
 assert.match(wizard,/preventScroll:true/);
 assert.match(css,/@media\(max-width:800px\)/);
 assert.match(css,/@media\(max-width:600px\)/);
 assert.match(css,/@media\(max-width:390px\)/);
 assert.match(css,/width:min\(100%,1440px\)/);
 assert.doesNotMatch(css,/overflow:auto/);
 for(const source of [css,reviewCss,wizard,wrapper]){
  assert.doesNotMatch(source,/!important/);
  assert.doesNotMatch(source,/(?:window\.)?location\.reload\s*\(/);
 }
 assert.doesNotMatch(wizard,/scrollTo\s*\(\s*0\s*,\s*0/);
});

test('tarifario sigue separado y sólo entrega referencias filtradas al cotizador',()=>{
 const wizard=read('../public/quote-wizard.js');
 assert.doesNotMatch(wizard,/data-estimator-view="tariff"/);
 assert.doesNotMatch(wizard,/estimator-shell\.js/);
 assert.match(wizard,/\/api\/estimator-tariffs/);
 assert.match(wizard,/findTariffMatches\(tariffs,query,5\)/);
});
