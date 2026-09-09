import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';

test('launcher Android usa logo oficial limpio y nombre corto',async()=>{
  const [foreground,legacy,round,background,strings]=await Promise.all([
    readFile(new URL('../../app/src/main/res/drawable/ic_launcher_foreground.xml',import.meta.url),'utf8'),
    readFile(new URL('../../app/src/main/res/mipmap-anydpi/ic_launcher.xml',import.meta.url),'utf8'),
    readFile(new URL('../../app/src/main/res/mipmap-anydpi/ic_launcher_round.xml',import.meta.url),'utf8'),
    readFile(new URL('../../app/src/main/res/drawable/ic_launcher_background.xml',import.meta.url),'utf8'),
    readFile(new URL('../../app/src/main/res/values/strings.xml',import.meta.url),'utf8')
  ]);
  assert.match(foreground,/@drawable\/amc_logo_brand/);
  assert.match(legacy,/@drawable\/amc_logo_brand/);
  assert.match(round,/@drawable\/amc_logo_brand/);
  assert.match(foreground,/android:gravity="right" android:width="3dp"/);
  assert.match(foreground,/android:gravity="bottom" android:height="3dp"/);
  assert.match(background,/#050807/);
  assert.ok(existsSync(new URL('../../app/src/main/res/drawable/amc_logo_brand.webp',import.meta.url)));
  assert.match(strings,/<string name="app_name">AMC<\/string>/);
  assert.match(strings,/<string name="app_name_long">AMC Construcciones y Arreglos<\/string>/);
});

test('Android no duplica insets y las barras acompañan el fondo AMC',async()=>{
  const [activity,theme]=await Promise.all([
    readFile(new URL('../../app/src/main/java/com/amc/construcciones/MainActivity.java',import.meta.url),'utf8'),
    readFile(new URL('../../app/src/main/res/values/themes.xml',import.meta.url),'utf8')
  ]);
  assert.doesNotMatch(activity,/setOnApplyWindowInsetsListener/);
  assert.doesNotMatch(activity,/WindowInsetsCompat/);
  assert.match(theme,/android:navigationBarColor">#F3F8F6/);
  assert.match(theme,/android:statusBarColor">#F3F8F6/);
  assert.match(theme,/android:windowLightStatusBar">true/);
  assert.match(theme,/android:windowLightNavigationBar">true/);
});
