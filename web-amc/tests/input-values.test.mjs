import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createInputValues} from '../input-values.mjs';

const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const values=()=>createInputValues({fail});

test('text conserva recorte, trim y vacío para valores no string',()=>{
 const {text}=values();
 assert.equal(text('  hola  '),'hola');
 assert.equal(text('abcdef',3),'abc');
 assert.equal(text(null),'');
 assert.equal(text(123),'');
});

test('amount conserva validación positiva, límite y redondeo a centavos',()=>{
 const {amount}=values();
 assert.equal(amount('12.345'),12.35);
 assert.equal(amount(1),1);
 for(const value of [0,-1,'abc',Infinity,10000000001])assert.throws(()=>amount(value),error=>error.status===400&&error.message==='Importe inválido.');
});

test('optionalAmount acepta cero o ausencia y rechaza importes inválidos',()=>{
 const {optionalAmount}=values();
 assert.equal(optionalAmount(),0);
 assert.equal(optionalAmount(null),0);
 assert.equal(optionalAmount(0),0);
 assert.equal(optionalAmount('10.126'),10.13);
 for(const value of [-1,'abc',10000000001])assert.throws(()=>optionalAmount(value),error=>error.status===400&&error.message==='Importe inválido.');
});

test('validDate exige fecha ISO real y no acepta desbordes de calendario',()=>{
 const {validDate}=values();
 assert.equal(validDate('2028-02-29'),true);
 assert.equal(validDate('2027-02-29'),false);
 assert.equal(validDate('2026-13-01'),false);
 assert.equal(validDate('2026-01-32'),false);
 assert.equal(validDate('10/09/2026'),false);
 assert.equal(validDate(),false);
});

test('server delega normalización y validación sin duplicar implementaciones',async()=>{
 const server=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
 assert.match(server,/from '.\/input-values\.mjs'/);
 assert.match(server,/const \{text,amount,optionalAmount,validDate\}=createInputValues\(\{fail\}\)/);
 assert.doesNotMatch(server,/const text=\(v,max=200\)=>/);
 assert.doesNotMatch(server,/const amount=v=>/);
 assert.doesNotMatch(server,/const optionalAmount=v=>/);
 assert.doesNotMatch(server,/const validDate=v=>/);
});
