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
 assert.doesNotMatch(source,/rejectUnauthorized:false/);
 assert.doesNotMatch(source,/console\.log/);
});

test('migración regional valida TLS y admite CA por origen y destino',async()=>{
 const source=await readFile(new URL('../region-migration.mjs',import.meta.url),'utf8');
 assert.match(source,/readFileSync\(caFile,'utf8'\)/);
 assert.match(source,/rejectUnauthorized:true/);
 assert.match(source,/sourceCaFile=caFile/);
 assert.match(source,/targetCaFile=caFile/);
 assert.match(source,/ssl:tlsConfig\(sourceCaFile\)/);
 assert.match(source,/ssl:tlsConfig\(targetCaFile\)/);
});

test('preparación regional conserva origen y destino antes del corte',async()=>{
 const server=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
 assert.match(server,/const sourceUrl=process\.env\.AMC_DATABASE_URL/);
 assert.match(server,/const targetUrl=process\.env\.AMC_REGION_MIGRATION_TARGET_URL/);
 assert.match(server,/AMC_REGION_MIGRATION_PREPARE==='1'/);
 assert.match(server,/sourceUrl,/);
 assert.match(server,/targetUrl,/);
 assert.match(server,/sourceCaFile,/);
 assert.match(server,/targetCaFile,/);
});

test('corte a Virginia sólo ocurre con bandera explícita y es reversible por entorno',async()=>{
 const server=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
 assert.match(server,/AMC_REGION_TARGET_ACTIVE==='1'/);
 assert.match(server,/if\(!targetUrl\)throw Error/);
 assert.match(server,/process\.env\.AMC_DATABASE_URL=targetUrl/);
 assert.match(server,/process\.env\.AMC_DATABASE_CA_FILE=targetCaFile/);
 assert.match(server,/region-database-target-active/);
 assert.match(server,/startServer\(\{createApp,root:ROOT\}\)/);
 const migrationIndex=server.indexOf("AMC_REGION_MIGRATION_PREPARE==='1'");
 const cutoverIndex=server.indexOf("AMC_REGION_TARGET_ACTIVE==='1'");
 assert.ok(migrationIndex>=0&&cutoverIndex>migrationIndex,'la sincronización final debe ocurrir antes del corte');
});
