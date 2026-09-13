import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

test('AMC usa el logo oficial en la aplicación y en el PDF canónico',()=>{
 const index=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 const pdf=readFileSync(new URL('../public/quote-pdf-document.js',import.meta.url),'utf8');
 assert.ok(existsSync(new URL('../public/assets/amc-logo.webp',import.meta.url)));
 assert.ok(existsSync(new URL('../public/assets/amc-logo-pdf.jpg',import.meta.url)));
 assert.match(index,/\/assets\/amc-logo\.webp/);
 assert.match(pdf,/fetch\('\/assets\/amc-logo-pdf\.jpg'/);
 assert.doesNotMatch(pdf,/LOGO_JPG_B64|data:image|base64,/);
});
