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

test('migración regional resincroniza identidades después de preservar rowid',async()=>{
 const source=await readFile(new URL('../region-migration.mjs',import.meta.url),'utf8');
 assert.match(source,/OVERRIDING SYSTEM VALUE/);
 assert.match(source,/async function syncIdentitySequence/);
 assert.match(source,/pg_get_serial_sequence/);
 assert.match(source,/SELECT setval\(\$1::regclass,\$2,\$3\)/);
 assert.match(source,/TABLES\.filter\(table=>table\.identity\)/);
 const inserts=source.indexOf('for(const table of TABLES)await insertRows');
 const sequences=source.indexOf('for(const table of TABLES.filter(table=>table.identity))await syncIdentitySequence');
 const verification=source.indexOf('for(const table of TABLES){',sequences);
 const commit=source.indexOf("await target.query('COMMIT')");
 assert.ok(inserts>=0&&inserts<sequences&&sequences<verification&&verification<commit);
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

test('arranque normal no contiene lógica de migración ni corte regional',async()=>{
 const server=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(server,/region-migration/);
 assert.doesNotMatch(server,/AMC_REGION_MIGRATION_/);
 assert.doesNotMatch(server,/AMC_REGION_TARGET_ACTIVE/);
 assert.doesNotMatch(server,/process\.env\.AMC_DATABASE_URL=/);
 assert.match(server,/startServer\(\{createApp,root:ROOT\}\)/);
});

test('migrador regional queda aislado en CLI con confirmación y URLs explícitas',async()=>{
 const cli=await readFile(new URL('../region-migration-cli.mjs',import.meta.url),'utf8');
 assert.match(cli,/AMC_REGION_MIGRATION_CONFIRM!=='MIGRATE'/);
 assert.match(cli,/AMC_REGION_MIGRATION_SOURCE_URL/);
 assert.match(cli,/AMC_REGION_MIGRATION_TARGET_URL/);
 assert.match(cli,/AMC_REGION_MIGRATION_SOURCE_CA_FILE/);
 assert.match(cli,/AMC_REGION_MIGRATION_TARGET_CA_FILE/);
 assert.match(cli,/migrateRegionDatabase\(\{sourceUrl,targetUrl,sourceCaFile,targetCaFile,logger\}\)/);
 assert.doesNotMatch(cli,/env\.AMC_DATABASE_URL/);
});