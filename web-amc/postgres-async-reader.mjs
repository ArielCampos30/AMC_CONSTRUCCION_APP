import {readFileSync} from 'node:fs';
import {postgresSql} from './postgres-sql.mjs';

const connectionError=error=>{
 const code=String(error?.code||'');
 return code.startsWith('08')||['ECONNRESET','ECONNREFUSED','EPIPE','ETIMEDOUT','57P01','57P02','57P03'].includes(code);
};
let pgPromise;
async function loadPg(){
 if(!pgPromise)pgPromise=import('pg').then(imported=>{
  const pg=imported.default;
  pg.types.setTypeParser(20,value=>{const number=Number(value);if(!Number.isSafeInteger(number))throw Error('Entero fuera de rango.');return number;});
  return pg;
 });
 return pgPromise;
}

export class PostgresAsyncReader{
 constructor(url,{schema='amc_data',test=false,caFile}={}){
  const parsed=new URL(url),local=['localhost','127.0.0.1','[::1]'].includes(parsed.hostname);
  if(!['postgres:','postgresql:'].includes(parsed.protocol)||parsed.search)throw Error('Usá la URI PostgreSQL sin opciones SSL en la dirección.');
  if(!/^amc_[a-z0-9_]+$/.test(schema))throw Error('Esquema inválido.');
  this.url=url;this.schema=schema;this.test=test;this.caFile=caFile;this.local=local;this.client=null;this.connecting=null;this.closed=false;
 }
 async connect(){
  if(this.closed)throw Object.assign(Error('Base de datos cerrada.'),{status:503});
  if(this.client)return this.client;
  if(this.connecting)return this.connecting;
  this.connecting=(async()=>{
   const pg=await loadPg();
   const client=new pg.Client({
    connectionString:this.url,
    ssl:this.test&&this.local?false:{rejectUnauthorized:true,...(this.caFile?{ca:readFileSync(this.caFile,'utf8')}:{})},
    connectionTimeoutMillis:10000,
    statement_timeout:15000,
    application_name:'AMC-state-read'
   });
   client.on('error',()=>{if(this.client===client)this.client=null;});
   await client.connect();
   await client.query('SET search_path TO '+this.schema+', pg_catalog');
   if(this.closed){try{await client.end();}catch{}throw Object.assign(Error('Base de datos cerrada.'),{status:503});}
   this.client=client;
   return client;
  })().finally(()=>{this.connecting=null;});
  return this.connecting;
 }
 async reset(){
  const client=this.client;this.client=null;
  if(client)try{await client.end();}catch{}
 }
 async query(sql,params=[]){
  if(!/^\s*(SELECT|WITH)\b/i.test(String(sql||'')))throw Object.assign(Error('El lector asíncrono sólo admite consultas de lectura.'),{code:'AMC_ASYNC_READ_ONLY',status:500});
  for(let attempt=0;attempt<2;attempt++){
   let client;
   try{
    client=await this.connect();
    const result=await client.query(postgresSql(sql),params.map(value=>value instanceof Uint8Array?Buffer.from(value):value));
    return {rows:result.rows||[],changes:result.rowCount||0};
   }catch(error){
    if(connectionError(error)&&attempt===0){await this.reset();continue;}
    throw Object.assign(Error('La lectura no pudo completarse en la base de datos.'),{code:error?.code||'AMC_QUERY',status:503});
   }
  }
  throw Object.assign(Error('La lectura no pudo completarse en la base de datos.'),{code:'AMC_CONNECTION',status:503});
 }
 close(){this.closed=true;const client=this.client;this.client=null;if(client)Promise.resolve(client.end()).catch(()=>{});}
}
