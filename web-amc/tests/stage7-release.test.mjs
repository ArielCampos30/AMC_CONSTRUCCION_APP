import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createApp} from '../server.mjs';

const root=new URL('../../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');

test('release contracts keep production Android identity, signing and artifacts',()=>{
 const gradle=read('app/build.gradle'),activity=read('app/src/main/java/com/amc/construcciones/MainActivity.java'),workflow=read('.github/workflows/build-apk.yml');
 assert.match(gradle,/applicationId 'com\.amc\.construcciones'/);assert.match(gradle,/versionCode 7/);assert.match(gradle,/signingConfig signingConfigs\.release/);
 assert.match(activity,/BuildConfig\.AMC_BACKEND_URL/);assert.doesNotMatch(activity,/file:\/\/\/android_asset/);assert.match(activity,/onShowFileChooser/);assert.match(activity,/ACTION_IMAGE_CAPTURE/);
 assert.match(activity,/requestNotifications/);assert.match(activity,/FirebaseMessaging/);assert.match(read('app/src/main/java/com/amc/construcciones/PushService.java'),/amc_url/);
 assert.match(workflow,/assembleRelease :app:bundleRelease/);assert.match(workflow,/apksigner verify/);assert.match(workflow,/AMC_KEYSTORE_B64/);assert.match(workflow,/AMC_GOOGLE_SERVICES_B64/);assert.doesNotMatch(workflow,/storePassword\s+['"][^'"]+['"]/);
});

test('PWA release metadata, safe cache and iPhone install help are present',()=>{
 const manifest=JSON.parse(read('web-amc/public/manifest.webmanifest')),html=read('web-amc/public/index.html'),sw=read('web-amc/public/sw.js'),ios=read('web-amc/public/ios-install.js');
 assert.equal(manifest.display,'standalone');assert.equal(manifest.scope,'/');assert.equal(manifest.start_url,'/');assert.ok(manifest.icons.length>=2);
 assert.match(html,/apple-touch-icon/);assert.match(html,/apple-mobile-web-app-capable/);assert.match(html,/ios-install\.js/);
 assert.match(ios,/Agregar a pantalla de inicio/);assert.match(ios,/amc-ios-install-dismissed/);assert.doesNotMatch(sw,/api\//);assert.match(sw,/AMC-offline-shell-v7/);
});

test('health checks the database without exposing internals',async()=>{
 const app=createApp({dbPath:':memory:',origin:'http://localhost'});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 try{const response=await fetch('http://127.0.0.1:'+app.server.address().port+'/health');assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true,database:'available'});}finally{await new Promise(resolve=>app.server.close(resolve));}
});
