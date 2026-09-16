import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createQuoteToolsLoader,QUOTE_TOOL_STYLES} from '../public/quote-tools-loader.js';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('loader deduplica runtime, autocomplete y estilos del Cotizador',async()=>{
 const links=[],imports=[];
 const documentRef={
  head:{append(link){links.push(link);queueMicrotask(()=>link.onload?.());}},
  createElement(){return {dataset:{},getAttribute(name){return name==='href'?this.href:'';}};},
  querySelectorAll(selector){return selector==='link[rel="stylesheet"]'?links:[];}
 };
 const importModule=async specifier=>{imports.push(specifier);return specifier.endsWith('quote-tools-runtime.js')?{createQuoteToolsRuntime(){return {};}}:{};};
 const loader=createQuoteToolsLoader({documentRef,locationRef:{origin:'https://amc.test'},importModule,logger:{warn(){}}});
 await Promise.all([loader.preparePage('#cotizador'),loader.preparePage('cotizador')]);
 assert.equal(imports.filter(item=>item==='./quote-tools-runtime.js').length,1);
 assert.equal(imports.filter(item=>item==='./quote-wizard-autocomplete.js').length,1);
 assert.deepEqual(links.map(link=>new URL(link.href,'https://amc.test').pathname),QUOTE_TOOL_STYLES);
 assert.equal(new Set(links.map(link=>link.href)).size,QUOTE_TOOL_STYLES.length);
 await loader.preparePage('tarifario');
 assert.equal(imports.filter(item=>item==='./quote-tools-runtime.js').length,1);
 assert.equal(links.length,QUOTE_TOOL_STYLES.length);
 await loader.preparePage('inicio');
 assert.equal(imports.length,2);
});

test('arranque común no referencia estáticamente el árbol pesado de presupuestos',()=>{
 const features=read('../public/features-ui.js');
 const runtime=read('../public/quote-tools-runtime.js');
 const loader=read('../public/quote-tools-loader.js');
 const index=read('../public/index.html');
 for(const module of ['quote-wizard.js','quote-save-controller.js','quote-client-create-controller.js','quote-pricing-sync-controller.js','tariff-ui.js','quote-pdf-controller.js'])assert.doesNotMatch(features,new RegExp(`from ['\"]\\./${module.replace('.','\\.')}['\"]`));
 assert.match(features,/import\('\.\/quote-pdf-controller\.js'\)/);
 assert.match(features,/prepareQuoteToolsPage/);
 assert.match(runtime,/from '\.\/quote-wizard\.js'/);
 assert.match(runtime,/from '\.\/quote-save-controller\.js'/);
 assert.match(runtime,/from '\.\/quote-client-create-controller\.js'/);
 assert.match(runtime,/from '\.\/quote-pricing-sync-controller\.js'/);
 assert.match(runtime,/from '\.\/tariff-ui\.js'/);
 assert.match(loader,/importModule\('\.\/quote-tools-runtime\.js'\)/);
 assert.doesNotMatch(index,/quote-wizard\.css|quote-builder-review\.css|quote-wizard-autocomplete\.css|quote-wizard-autocomplete\.js/);
});

test('bootstrap prepara ruta directa y hashchange antes del render de app',()=>{
 const bootstrap=read('../public/app-bootstrap.js');
 assert.match(bootstrap,/prepareQuoteToolsPage\(location\.hash\)/);
 assert.match(bootstrap,/type==='hashchange'/);
 assert.match(bootstrap,/pageFromHash\(location\.hash,recoveryRoute\(\)\)/);
 assert.match(bootstrap,/await prepareQuoteToolsPage\(location\.hash\)/);
 assert.match(bootstrap,/await import\('\.\/app\.js'\)/);
});
