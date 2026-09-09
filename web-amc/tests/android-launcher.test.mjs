import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';

test('launcher Android usa logo visible y nombre corto',async()=>{
  const [foreground,legacy,round,strings]=await Promise.all([
    readFile(new URL('../../app/src/main/res/drawable/ic_launcher_foreground.xml',import.meta.url),'utf8'),
    readFile(new URL('../../app/src/main/res/mipmap-anydpi/ic_launcher.xml',import.meta.url),'utf8'),
    readFile(new URL('../../app/src/main/res/mipmap-anydpi/ic_launcher_round.xml',import.meta.url),'utf8'),
    readFile(new URL('../../app/src/main/res/values/strings.xml',import.meta.url),'utf8')
  ]);
  assert.match(foreground,/android:left="12dp"/);
  assert.match(foreground,/android:right="12dp"/);
  assert.match(legacy,/android:left="8dp"/);
  assert.match(round,/android:left="8dp"/);
  assert.match(strings,/<string name="app_name">AMC<\/string>/);
  assert.match(strings,/<string name="app_name_long">AMC Construcciones y Arreglos<\/string>/);
});
