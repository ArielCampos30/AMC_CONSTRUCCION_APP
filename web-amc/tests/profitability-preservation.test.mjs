import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('el Cotizador nuevo conserva costo, ganancia y margen',async()=>{
 const [wizard,model]=await Promise.all([
  source('public/quote-wizard.js'),
  source('public/quote-wizard-model.js')
 ]);
 assert.match(wizard,/RENTABILIDAD INTERNA/);
 assert.match(wizard,/Ganancia estimada/);
 assert.match(wizard,/Margen estimado/);
 assert.match(wizard,/Margen objetivo/);
 assert.match(wizard,/Precio final editable/);
 assert.match(model,/export function profitabilitySnapshot/);
 assert.match(model,/gain=sale-internal/);
 assert.match(model,/margin:sale>0\?gain\/sale\*100:0/);
 assert.match(model,/export function suggestedPriceForMargin/);
});
