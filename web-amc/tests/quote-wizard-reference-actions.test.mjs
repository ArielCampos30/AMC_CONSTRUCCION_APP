import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('3B.2.2 ofrece una salida concreta cuando no hay referencia segura',()=>{
 const wizard=read('../public/quote-wizard.js');
 assert.match(wizard,/Buscar en Tarifario/);
 assert.match(wizard,/Ingresar referencia manual/);
 assert.match(wizard,/Calcular por jornal/);
 assert.match(wizard,/Requiere visita/);
 assert.match(wizard,/data-qw-reference-action/);
 assert.match(wizard,/Sin referencia automática/);
 assert.match(wizard,/Elegí cómo querés seguir con este trabajo/);
});

test('3B.2.2 no incrusta el Tarifario completo y limita la búsqueda relacionada',()=>{
 const wizard=read('../public/quote-wizard.js');
 assert.match(wizard,/findTariffMatches\(tariffs,query,3\)/);
 assert.match(wizard,/como máximo tres coincidencias/);
 assert.doesNotMatch(wizard,/data-estimator-view="tariff"/);
 assert.doesNotMatch(wizard,/<iframe/i);
});

test('3B.2.2 distingue referencia manual, jornal y visita sin inventar precio',()=>{
 const wizard=read('../public/quote-wizard.js');
 assert.match(wizard,/manual-reference/);
 assert.match(wizard,/visit-pending/);
 assert.match(wizard,/tariffKind='jornal'/);
 assert.match(wizard,/No modifica el Tarifario/);
 assert.match(wizard,/No se inventa un precio de obra/);
 assert.match(wizard,/referencesResolved/);
});

test('3B.2.2 mantiene prohibidos important y reload',()=>{
 const wizard=read('../public/quote-wizard.js');
 assert.doesNotMatch(wizard,/!important/);
 assert.doesNotMatch(wizard,/(?:window\.)?location\.reload\s*\(/);
});
