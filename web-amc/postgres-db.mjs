import {Worker} from 'node:worker_threads';
// Transitional synchronous contract preserves atomic legacy transactions. Networking
// runs in a worker; the caller waits. Deploy one instance and measure latency before
// expanding beyond the initial pilot. No local fallback and no mutation retry.
const command=sql=>String(sql||'').trim().match(/^([A-Za-z]+)/)?.[1]?.toUpperCase()||'';
export class PostgresDatabase{
 constructor(url,{schema='amc_data',test=false,caFile}={}){
  this.control=new SharedArrayBuffer(8);this.bytes=new SharedArrayBuffer(32*1024*1024);this.state=new Int32Array(this.control);
  this.workerData={url,schema,test,caFile,control:this.control,bytes:this.bytes};this.closed=false;this.failed=false;this.transactionOpen=false;
  this.startWorker();
 }
 startWorker(){
  Atomics.store(this.state,0,0);
  const worker=new Worker(new URL('./postgres-worker.mjs',import.meta.url),{workerData:this.workerData});this.worker=worker;this.failed=false;
  worker.on('error',()=>{if(this.worker===worker&&!this.closed)this.failed=true;});
  worker.on('exit',()=>{if(this.worker===worker&&!this.closed)this.failed=true;});
  worker.unref();
  try{return this.receive();}catch(e){if(this.worker===worker)this.failed=true;worker.terminate();throw e;}
 }
 recoverWorker(){const previous=this.worker;this.worker=null;try{previous?.terminate();}catch{}return this.startWorker();}
 receive(){if(Atomics.wait(this.state,0,0,25000)==='timed-out'){this.failed=true;this.worker?.terminate();throw Object.assign(Error('La base de datos no respondió. No se confirmó el guardado.'),{status:503});}const result=JSON.parse(Buffer.from(this.bytes,0,Atomics.load(this.state,1)).toString(),(_,v)=>v?.type==='Buffer'&&Array.isArray(v.data)?Buffer.from(v.data):v);if(result.error)throw Object.assign(Error(result.error),{code:result.code,status:503});return result;}
 query(sql,params=[]){
  if(this.closed)throw Object.assign(Error('Base de datos cerrada.'),{status:503});
  const op=command(sql),rollback=op==='ROLLBACK',begin=op==='BEGIN',finish=rollback||op==='COMMIT';
  if(this.failed&&this.transactionOpen){
   if(rollback){this.transactionOpen=false;return {rows:[],changes:0};}
   throw Object.assign(Error('La conexión se perdió durante una transacción. La operación fue cancelada para conservar la integridad de los datos.'),{code:'AMC_TRANSACTION_CONNECTION',status:503});
  }
  if(this.failed)this.recoverWorker();
  Atomics.store(this.state,0,0);
  try{this.worker.postMessage({sql,params});}catch{this.failed=true;throw Object.assign(Error('Base de datos sin conexión.'),{status:503});}
  const result=this.receive();
  if(begin)this.transactionOpen=true;else if(finish)this.transactionOpen=false;
  return result;
 }
 exec(sql){return this.query(sql);}
 prepare(sql){return {get:(...p)=>this.query(sql,p).rows[0],all:(...p)=>this.query(sql,p).rows,run:(...p)=>this.query(sql,p)};}
 close(){if(this.closed)return;if(!this.failed){try{this.query('__close');}catch{}}this.closed=true;this.transactionOpen=false;try{this.worker?.terminate();}catch{}}
}
