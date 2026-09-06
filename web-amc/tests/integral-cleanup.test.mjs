import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root=new URL('../../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');

test('integral cleanup keeps one AMC identity, theme and admin route',()=>{
  const files=['web-amc/public/index.html','web-amc/public/app.js','web-amc/public/project-hub.js','web-amc/public/presupuestos-bridge.js','app/src/main/AndroidManifest.xml','app/src/main/res/values/strings.xml','app/src/main/assets/index.html'];
  const source=files.map(read).join('\n');
  assert.doesNotMatch(source,/AMC Presupuestos|href=["']#admin|navigate\(["']admin|Panel AMC/);
  assert.match(read('web-amc/public/index.html'),/amc-theme\.css[^]*<\/head>/);
  assert.match(read('web-amc/public/amc-theme.css'),/--green:#0b675f/);
  assert.match(read('web-amc/public/app.js'),/LEGACY_ADMIN_ROUTES[^]*admin/);
});

test('Android camera and web-only branch contracts are explicit',()=>{
  const activity=read('app/src/main/java/com/amc/construcciones/MainActivity.java');
  const workflow=read('.github/workflows/build-apk.yml');
  assert.match(activity,/params\.isCaptureEnabled\(\)[^]*startActivityForResult\(camera/);
  assert.match(activity,/Elegir de galería/);
  assert.match(activity,/if\(result==null\)clearUnusedCameraFile/);
  assert.doesNotMatch(workflow,/branches:\s*\[\s*main,\s*amc-servidor-supabase/);
});
