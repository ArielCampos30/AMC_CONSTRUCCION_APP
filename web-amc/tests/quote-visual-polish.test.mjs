import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../public/quote-wizard.css',import.meta.url),'utf8');

test('el cierre circular centra la X sin depender del baseline tipográfico del botón',()=>{
 assert.match(css,/\.quote-wizard-close\{[^}]*display:grid;place-items:center[^}]*font-size:0[^}]*line-height:1/);
 assert.match(css,/\.quote-wizard-close::before\{content:"×";display:block;font:400 28px\/1 Arial,sans-serif\}/);
});

test('los modos de precio no desbordan cuando la columna central se estrecha',()=>{
 assert.match(css,/\.quote-pricing-tabs button\{[^}]*min-width:0[^}]*font-size:13px[^}]*overflow-wrap:anywhere/);
 assert.match(css,/@media\(max-width:1100px\)\{[^}]*\.quote-builder-workspace[^}]*\}[^@]*\.quote-pricing-tabs\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/s);
});

test('cliente nuevo y ficha del cliente se apilan correctamente en móvil',()=>{
 assert.match(css,/@media\(max-width:600px\)[\s\S]*\.quote-client-picker\{grid-template-columns:1fr;align-items:stretch\}/);
 assert.match(css,/@media\(max-width:600px\)[\s\S]*\.quote-wizard-client-card\{grid-template-columns:1fr\}/);
 assert.match(css,/@media\(max-width:600px\)[\s\S]*\.quote-new-client-actions\{flex-wrap:wrap\}/);
});

test('la fórmula visible puede envolver sin salirse del panel',()=>{
 assert.match(css,/\.quote-work-total\{[^}]*flex-wrap:wrap[^}]*min-width:0[^}]*line-height:1\.35/);
});
