import {parentPort,workerData} from 'node:worker_threads';
import {readFileSync} from 'node:fs';
import {postgresSql} from './postgres-sql.mjs';
const control=new Int32Array(workerData.control),bytes=new Uint8Array(workerData.bytes);
function reply(value){const data=Buffer.from(JSON.stringify(value));if(data.length>bytes.length)return reply({error:'Respuesta de base de datos demasiado grande.',code:'AMC_LIMIT'});bytes.set(data);Atomics.store(control,1,data.length);Atomics.store(control,0,1);Atomics.notify(control,0);}
const connectionError=e=>{const code=String(e?.code||'');return code.startsWith('08')||['ECONNRESET','ECONNREFUSED','EPIPE','ETIMEDOUT','57P01','57P02','57P03'].includes(code);};
const command=sql=>String(sql||'').trim().match(/^([A-Za-z]+)/)?.[1]?.toUpperCase()||'';
let client,pg,clientConfig,failed=true,closing=false,transactionOpen=false;
async function connectClient(){
 const next=new pg.Client(clientConfig);
 next.on('error',()=>{if(client===next&&!closing)failed=true;});
 await next.connect();
 await next.query('CREATE SCHEMA IF NOT EXISTS '+workerData.schema);
 await next.query('REVOKE ALL ON SCHEMA '+workerData.schema+' FROM PUBLIC');
 await next.query('SET search_path TO '+workerData.schema+', pg_catalog');
 client=next;failed=false;
}
async function restoreConnection(){
 if(!failed)return true;
 try{try{await client?.end();}catch{}client=null;await connectClient();return true;}catch{return false;}
}
try{
 const imported=await import('pg');pg=imported.default;pg.types.setTypeParser(20,v=>{const n=Number(v);if(!Number.isSafeInteger(n))throw Error('Entero fuera de rango.');return n;});
 const url=new URL(workerData.url),local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 if(!['postgres:','postgresql:'].includes(url.protocol)||url.search)throw Error('Usá la URI PostgreSQL sin opciones SSL en la dirección.');
 if(!/^amc_[a-z0-9_]+$/.test(workerData.schema))throw Error('Esquema inválido.');
 clientConfig={connectionString:workerData.url,ssl:workerData.test&&local?false:{rejectUnauthorized:true,...(workerData.caFile?{ca:readFileSync(workerData.caFile,'utf8')}:{})},connectionTimeoutMillis:10000,statement_timeout:15000,application_name:'AMC'};
 await connectClient();
 reply({ok:true});
}catch(e){failed=true;reply({error:'No se pudo conectar a la base de datos. Revisá dirección, contraseña y certificado en el alojamiento.',code:e.code||'AMC_CONNECT'});}
parentPort.on('message',async({sql,params=[]})=>{
 if(sql==='__close'){closing=true;transactionOpen=false;try{await client?.end();}catch{}failed=true;reply({ok:true});parentPort.close();return;}
 const op=command(sql),rollback=op==='ROLLBACK',begin=op==='BEGIN',finish=rollback||op==='COMMIT';
 if(failed&&transactionOpen){
  if(rollback){transactionOpen=false;reply({rows:[],changes:0});return;}
  return reply({error:'La conexión se perdió durante una transacción. La operación fue cancelada para conservar la integridad de los datos.',code:'AMC_TRANSACTION_CONNECTION'});
 }
 if(failed&&!(await restoreConnection()))return reply({error:'No se pudo restablecer la conexión a la base de datos.',code:'AMC_CONNECTION'});
 try{
  if(sql==='PRAGMA table_info(users)'){
   const result=await client.query("SELECT column_name AS name FROM information_schema.columns WHERE table_schema=$1 AND table_name='users'",[workerData.schema]);reply({rows:result.rows});return;
  }
  const result=await client.query(postgresSql(sql),params.map(x=>x instanceof Uint8Array?Buffer.from(x):x));
  if(begin)transactionOpen=true;else if(finish)transactionOpen=false;
  reply({rows:result.rows||[],changes:result.rowCount||0});
 }catch(e){if(connectionError(e))failed=true;reply({error:'La operación no pudo guardarse en la base de datos.',code:e.code||'AMC_QUERY'});}
});
