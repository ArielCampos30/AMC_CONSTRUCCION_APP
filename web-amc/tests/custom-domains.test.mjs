import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const readRepo=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const LANDING='https://amcconstrucciones.com.ar';
const APP='https://app.amcconstrucciones.com.ar';
const OLD_LANDING='https://amc-construcciones.onrender.com';
const OLD_APP='https://amc-o0xb.onrender.com';

test('landing pública usa sólo los dominios canónicos de AMC',()=>{
 const index=readRepo('docs/index.html');
 const landing=readRepo('docs/assets/js/landing.js');
 const deletion=readRepo('docs/assets/js/account-deletion.js');
 const privacy=readRepo('docs/privacidad.html');
 const accountDeletion=readRepo('docs/eliminar-cuenta.html');
 const robots=readRepo('docs/robots.txt');
 const sitemap=readRepo('docs/sitemap.xml');
 const publicFiles=[index,landing,deletion,privacy,accountDeletion,robots,sitemap];

 assert.match(index,new RegExp(`canonical" href="${LANDING.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}/`));
 assert.match(index,/href="https:\/\/app\.amcconstrucciones\.com\.ar\/"[^>]*>Acceso clientes/);
 assert.match(landing,/const PROSPECT_API = "https:\/\/app\.amcconstrucciones\.com\.ar\/api\/public\/prospects"/);
 assert.match(deletion,/https:\/\/app\.amcconstrucciones\.com\.ar\/api\/public\/account-deletion/);
 assert.match(robots,/Sitemap: https:\/\/amcconstrucciones\.com\.ar\/sitemap\.xml/);
 assert.match(sitemap,/https:\/\/amcconstrucciones\.com\.ar\/privacidad\.html/);
 for(const content of publicFiles){
  assert.doesNotMatch(content,new RegExp(OLD_LANDING.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.doesNotMatch(content,new RegExp(OLD_APP.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
 }
});

test('app, Android y monitor usan el origen público app.amcconstrucciones.com.ar',()=>{
 const dispatcher=readRepo('web-amc/server-request-dispatcher.mjs');
 const blueprint=readRepo('render.yaml');
 const gradle=readRepo('app/build.gradle');
 const androidWorkflow=readRepo('.github/workflows/build-apk.yml');
 const monitor=readRepo('.github/workflows/production-smoke.yml');

 assert.match(dispatcher,/AMC_LANDING_ORIGIN\|\|'https:\/\/amcconstrucciones\.com\.ar'/);
 assert.match(blueprint,/AMC_ORIGIN[\s\S]*https:\/\/app\.amcconstrucciones\.com\.ar/);
 assert.match(blueprint,/AMC_LANDING_ORIGIN[\s\S]*https:\/\/amcconstrucciones\.com\.ar/);
 assert.match(gradle,/https:\/\/app\.amcconstrucciones\.com\.ar\//);
 assert.match(gradle,/versionCode\s+9/);
 assert.match(gradle,/versionName\s+'1\.0\.2'/);
 assert.match(androidWorkflow,/AMC_BACKEND_URL: https:\/\/app\.amcconstrucciones\.com\.ar\//);
 assert.match(androidWorkflow,/AMC-Construcciones-v1\.0\.2-release/);
 assert.match(monitor,/https:\/\/app\.amcconstrucciones\.com\.ar\/healthz/);
 for(const content of [dispatcher,blueprint,gradle,androidWorkflow,monitor]) assert.doesNotMatch(content,/amc-o0xb\.onrender\.com/);
});