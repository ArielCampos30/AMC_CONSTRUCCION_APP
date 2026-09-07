import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';

test('el cotizador usa el logo oficial como recurso visible',()=>{
  const html=readFileSync(new URL('../private/presupuestos-original.html',import.meta.url),'utf8');
  assert.ok(existsSync(new URL('../public/assets/amc-logo.webp',import.meta.url)));
  assert.match(html,/const LOGO_PNG = '\/assets\/amc-logo\.webp';/);
  assert.doesNotMatch(html,/const LOGO_PNG = "data:image\/png;base64/);
});
