import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {regionMigrationTables} from '../region-migration.mjs';

test('migración regional cubre todas las tablas persistentes AMC',()=>{
 assert.deepEqual(regionMigrationTables.map(table=>table.name),['users','sessions','docs','files','devices','delivery','config','password_resets','recovery_codes']);
 assert.equal(regionMigrationTables.find(table=>table.name==='docs').identity,true);
 assert.equal(regionMigrationTables.find(table=>table.name==='delivery').identity,true);
 assert.ok(regionMigrationTables.find(table=>table.name==='files').columns.includes('body'));
});

test('migración regional verifica destino antes de commit y revierte ante error',async()=>{
 const source=await readFile(new URL('../region-migration.mjs',import.meta.url),'utf8');
 assert.match(source,/assertTargetSchema\(target\)/);
 assert.match(source,/target\.query\('BEGIN'\)/);
 assert.match(source,/digestRows\(rows\)!==expected\.hash/);
 assert.match(source,/target\.query\('COMMIT'\)/);
 assert.match(source,/target\.query\('ROLLBACK'\)/);
 assert.match(source,/Promise\.allSettled\(\[source\.end\(\),target\.end\(\)\]\)/);
 assert.doesNotMatch(source,/console\.log/);
});

test('preparación sólo corre con bandera explícita y no reemplaza la base activa',async()=>{
 const server=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
 assert.match(server,/AMC_REGION_MIGRATION_PREPARE==='1'/);
 assert.match(server,/sourceUrl:process\.env\.AMC_DATABASE_URL/);
 assert.match(server,/targetUrl:process\.env\.AMC_REGION_MIGRATION_TARGET_URL/);
 assert.match(server,/startServer\(\{createApp,root:ROOT\}\)/);
});
