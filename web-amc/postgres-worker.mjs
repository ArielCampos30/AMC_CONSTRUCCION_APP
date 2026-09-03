import {parentPort,workerData} from 'node:worker_threads';
import {readFileSync} from 'node:fs';
import {postgresSql} from './postgres-sql.mjs';
const control=new Int32Array(workerData.control),bytes=new Uint8Array(workerData.bytes);
function reply(value){const data=Buffer.from(JSON.stringify(value));if(data.length>bytes.length)return reply({error:'Respuesta de base de datos demasiado grande.',code:'AMC_LIMIT'});bytes.set(data);Atomics.store(control,1,data.length);Atomics.store(control,0,1);Atomics.notify(control,0);}
let client,failed;
try{
 const {default:pg}=await import('pg');pg.types.setTypeParser(20,v=>{const n=Number(v);if(!Number.isSafeInteger(n))throw Error('Entero fuera de rango.');return n;});
 const url=new URL(workerData.url),local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 if(!['postgres:','postgresql:'].includes(url.protocol)||url.search)throw Error('Usá la URI PostgreSQL sin opciones SSL en la dirección.');
 if(!/^amc_[a-z0-9_]+$/.test(workerData.schema))throw Error('Esquema inválido.');
 client=new pg.Client({connectionString:workerData.url,ssl:workerData.test&&local?false:{rejectUnauthorized:true,...(workerData.caFile?{ca:readFileSync(workerData.caFile,'utf8')}:{})},connectionTimeoutMillis:10000,statement_timeout:15000,application_name:'AMC'});
 client.on('error',()=>{failed=true;});await client.connect();
 await client.query('CREATE SCHEMA IF NOT EXISTS '+workerData.schema);
 await client.query('REVOKE ALL ON SCHEMA '+workerData.schema+' FROM PUBLIC');
 await client.query('SET search_path TO '+workerData.schema+', pg_catalog');
 reply({ok:true});
}catch(e){failed=true;reply({error:'No se pudo conectar a la base de datos. Revisá dirección, contraseña y certificado en el alojamiento.',code:e.code||'AMC_CONNECT'});}
parentPort.on('message',async({sql,params=[]})=>{
 if(failed)return reply({error:'La conexión a la base de datos se interrumpió. Reiniciá el servicio.',code:'AMC_CONNECTION'});
 try{
  if(sql==='__close'){await client.end();reply({ok:true});parentPort.close();return;}
  if(sql==='PRAGMA table_info(users)'){
   const result=await client.query("SELECT column_name AS name FROM information_schema.columns WHERE table_schema=$1 AND table_name='users'",[workerData.schema]);reply({rows:result.rows});return;
  }
  const result=await client.query(postgresSql(sql),params.map(x=>x instanceof Uint8Array?Buffer.from(x):x));
  reply({rows:result.rows||[],changes:result.rowCount||0});
 }catch(e){reply({error:'La operación no pudo guardarse en la base de datos.',code:e.code||'AMC_QUERY'});}
});
