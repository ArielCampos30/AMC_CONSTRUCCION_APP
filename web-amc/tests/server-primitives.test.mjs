import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {now,id,sha,fail} from '../server-primitives.mjs';

test('now conserva fecha ISO UTC',()=>{
 const value=now();
 assert.match(value,/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
 assert.equal(Number.isNaN(Date.parse(value)),false);
});

test('id conserva UUID aleatorio válido',()=>{
 const first=id(),second=id();
 assert.match(first,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
 assert.notEqual(first,second);
});

test('sha conserva SHA-256 hexadecimal',()=>{
 assert.equal(sha('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('fail conserva status y mensaje',()=>{
 assert.throws(()=>fail(418,'prueba'),error=>error.status===418&&error.message==='prueba');
});

test('server delega primitivas base sin duplicarlas',async()=>{
 const server=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
 assert.match(server,/from '.\/server-primitives\.mjs'/);
 assert.doesNotMatch(server,/const now=\(\)=>new Date\(\)\.toISOString\(\)/);
 assert.doesNotMatch(server,/id=\(\)=>randomUUID\(\)/);
 assert.doesNotMatch(server,/createHash\('sha256'\)/);
 assert.doesNotMatch(server,/const fail=\(status,message\)=>/);
 assert.match(server,/import \{randomBytes\} from 'node:crypto'/);
});
