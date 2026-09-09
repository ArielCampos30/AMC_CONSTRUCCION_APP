import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

test('registro cliente confirma clave y 2FA queda oculto hasta que el servidor lo requiera',()=>{
 const here=path.dirname(fileURLToPath(import.meta.url));
 const appJs=readFileSync(path.join(here,'../public/app.js'),'utf8');
 const css=readFileSync(path.join(here,'../public/styles.css'),'utf8');
 assert.match(appJs,/name="passwordConfirm"/);
 assert.match(appJs,/data\.password!==data\.passwordConfirm/);
 assert.match(appJs,/Protección exclusiva de la cuenta Administrador/);
 assert.match(css,/#two-factor-login\[hidden\]\{display:none!important\}/);
});
