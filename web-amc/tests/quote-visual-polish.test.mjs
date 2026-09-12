import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../public/quote-wizard.css',import.meta.url),'utf8');
const reviewCss=readFileSync(new URL('../public/quote-builder-review.css',import.meta.url),'utf8');
const wizard=readFileSync(new URL('../public/quote-wizard.js',import.meta.url),'utf8');
const legacy=readFileSync(new URL('../public/features-ui-legacy.js',import.meta.url),'utf8');
const chat=readFileSync(new URL('../public/floating-chat.js',import.meta.url),'utf8');
const shell=readFileSync(new URL('../public/styles.css',import.meta.url),'utf8');
const theme=readFileSync(new URL('../public/amc-theme.css',import.meta.url),'utf8');

test('el cierre circular usa una X vectorial sin depender del baseline tipográfico',()=>{
 assert.match(wizard,/class="quote-wizard-close"[^>]*><svg viewBox="0 0 24 24"/);
 assert.match(css,/\.quote-wizard-close\{[^}]*display:grid;place-items:center[^}]*width:44px;height:44px;min-height:44px/);
 assert.match(css,/\.quote-wizard-close svg\{[^}]*width:20px;height:20px[^}]*stroke-linecap:round/);
 assert.doesNotMatch(css,/quote-wizard-close::before/);
});

test('los modos de precio no desbordan cuando la columna central se estrecha',()=>{
 assert.match(css,/\.quote-pricing-tabs button\{[^}]*min-width:0[^}]*min-height:44px[^}]*white-space:normal;overflow-wrap:break-word/);
 assert.match(css,/\.quote-pricing-tabs\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
});

test('cliente nuevo y ficha del cliente se apilan correctamente en móvil',()=>{
 assert.match(css,/@media\(max-width:600px\)[\s\S]*\.quote-client-picker\{grid-template-columns:1fr;align-items:stretch\}/);
 assert.match(css,/@media\(max-width:600px\)[\s\S]*\.quote-wizard-client-card\{grid-template-columns:1fr\}/);
 assert.match(css,/@media\(max-width:600px\)[\s\S]*\.quote-new-client-actions\{flex-wrap:wrap\}/);
});

test('la fórmula visible puede envolver sin salirse del panel',()=>{
 assert.match(css,/\.quote-work-total\{[^}]*flex-wrap:wrap[^}]*min-width:0[^}]*line-height:1\.35/);
});

test('el shell entrega toda su zona útil y oculta el chat únicamente durante el Cotizador',()=>{
 assert.match(legacy,/classList\.toggle\('quote-wizard-route',quotePage\)/);
 assert.match(legacy,/fullPageChat\|\|quotePage\)floating\.close/);
 assert.match(chat,/body\.quote-wizard-route \.floating-chat-button\{display:none!important\}/);
 assert.match(shell,/body\.quote-wizard-route \.workspace>main\{width:100%;max-width:none;margin:0;padding:0\}/);
});

test('los headers internos vuelven al flujo natural y sticky no supone un header de 84px',()=>{
 assert.match(css,/\.quote-wizard-header\{position:static;height:auto;min-height:0/);
 assert.match(css,/\.quote-wizard-page header:not\(\.quote-wizard-header\)\{height:auto;min-height:0/);
 assert.doesNotMatch(css,/top:84px/);
 assert.match(css,/@media\(max-width:800px\)[^\n]*\.quote-wizard-controls\{position:static/);
 assert.match(theme,/\.workspace>header\{position:sticky/);
 assert.doesNotMatch(theme,/\.workspace header\{position:sticky/);
});

test('el foco de página no dibuja un marco y los labels no desplazan sus botones',()=>{
 assert.match(css,/\.quote-wizard-page\{[^}]*outline:none/);
 assert.match(css,/\.quote-wizard-page label\{margin:0\}/);
 assert.match(css,/\.quote-wizard-page button:disabled\{cursor:not-allowed\}/);
});

test('rentabilidad tiene un único propietario CSS y conserva textos completos',()=>{
 assert.match(css,/\.quote-profitability-card\{/);
 assert.doesNotMatch(reviewCss,/\.quote-profitability-card\{/);
 assert.doesNotMatch(reviewCss,/\.quote-final-price-row\{/);
 assert.doesNotMatch(css,/\.quote-summary-rows span\{[^}]*text-overflow:ellipsis/);
 assert.doesNotMatch(reviewCss,/\.quote-review-context>div:first-child small\{[^}]*text-overflow:ellipsis/);
});
