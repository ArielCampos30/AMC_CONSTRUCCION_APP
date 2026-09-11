import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('etapa 3A monta el cotizador en un contenedor de una sola zona desplazable',()=>{
 const index=read('../public/index.html');
 const shell=read('../public/estimator-shell.js');
 assert.match(index,/\/estimator-shell\.js/);
 assert.match(shell,/amc-estimator-active/);
 assert.match(shell,/workspace>main/);
 assert.match(shell,/height:100%!important/);
 assert.match(shell,/min-height:0!important/);
 assert.match(shell,/overflow:hidden!important/);
 assert.match(shell,/data-estimator-close/);
 assert.match(shell,/location\.hash='#presupuestos'/);
});

test('etapa 3A expone tarifario sin cambiar calculos ni enviar operaciones nuevas',()=>{
 const route=read('../estimator-page-routes.mjs');
 const shell=read('../public/estimator-shell.js');
 const inner=read('../public/estimator-shell-inner.js');
 assert.match(route,/\/estimator-shell-inner\.js/);
 assert.match(shell,/data-estimator-view="tariff"/);
 assert.match(shell,/postMessage\(\{type:'amc:estimator-view',view\},location\.origin\)/);
 assert.match(inner,/event\.origin!==location\.origin/);
 assert.match(inner,/event\.source!==parent/);
 assert.match(inner,/view-tariff/);
 assert.match(inner,/tariff-search/);
 assert.match(inner,/window\.nav\?\.\('tariff'\)/);
 assert.doesNotMatch(inner,/fetch\(/);
 assert.doesNotMatch(inner,/\/api\//);
});
