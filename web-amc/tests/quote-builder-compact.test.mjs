import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('cliente y solicitud forman un flujo breve, filtrado y opcional',()=>{
 const wizard=read('../public/quote-wizard.js');
 assert.match(wizard,/data-qw-client/);
 assert.match(wizard,/requestClientRef\(request\)===clientRef/);
 assert.match(wizard,/Sin solicitud · presupuesto directo/);
 assert.match(wizard,/\+ Cliente nuevo/);
 assert.match(wizard,/POST|method:'POST'/);
 assert.match(wizard,/\/api\/admin\/clients/);
});

test('presupuesto muestra un solo trabajo editable y mantiene lista y resumen separados',()=>{
 const wizard=read('../public/quote-wizard.js');
 assert.match(wizard,/activeWorkId/);
 assert.match(wizard,/function activeWork\(\)/);
 assert.match(wizard,/quote-builder-sidebar/);
 assert.match(wizard,/quote-builder-detail/);
 assert.match(wizard,/quote-builder-summary/);
 assert.match(wizard,/data-qw-select-work/);
 assert.match(wizard,/data-qw-work-selector/);
 assert.match(wizard,/Referencia acumulada/);
});

test('costos internos son opcionales y no dominan el presupuesto rápido',()=>{
 const wizard=read('../public/quote-wizard.js');
 assert.match(wizard,/<details class="quote-internal-costs"/);
 assert.match(wizard,/Opcional · no se muestran al cliente/);
 assert.match(wizard,/Movilidad general/);
});

test('revisión permite volver al trabajo exacto sin recrear el presupuesto',()=>{
 const wizard=read('../public/quote-wizard.js');
 assert.match(wizard,/ETAPA 3 DE 4/);
 assert.match(wizard,/data-qw-review-work/);
 assert.match(wizard,/activeWorkId=reviewWork\.dataset\.qwReviewWork;stage=2/);
 assert.match(wizard,/Revisar presupuesto →/);
});

test('repintados del editor preservan los scrolls internos y el foco no fuerza desplazamiento',()=>{
 const wizard=read('../public/quote-wizard.js');
 assert.match(wizard,/data-qw-scroll-key/);
 assert.match(wizard,/captureScroll/);
 assert.match(wizard,/restoreScroll/);
 assert.match(wizard,/focus\?\.\(\{preventScroll:true\}\)/);
 assert.doesNotMatch(wizard,/scrollTop\s*=\s*0/);
 assert.doesNotMatch(wizard,/scrollTo\s*\(\s*0/);
});
