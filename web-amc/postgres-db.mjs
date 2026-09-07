import {Worker} from 'node:worker_threads';
// Transitional synchronous contract preserves atomic legacy transactions. Networking
// runs in a worker; the caller waits. Deploy one instance and measure latency before
// expanding beyond the initial pilot. No local fallback and no mutation retry.
export class PostgresDatabase{
 constructor(url,{schema='amc_data',test=false,caFile}={}){
  this.control=new SharedArrayBuffer(8);this.bytes=new SharedArrayBuffer(32*1024*1024);this.state=new Int32Array(this.control);
  this.worker=new Worker(new URL('./postgres-worker.mjs',import.meta.url),{workerData:{url,schema,test,caFile,control:this.control,bytes:this.bytes}});
  this.worker.on('error',()=>{this.failed=true;});this.worker.unref();
  try{this.receive();}catch(e){this.worker.terminate();throw e;}
 }
 receive(){if(Atomics.wait(this.state,0,0,25000)==='timed-out'){this.failed=true;this.worker.terminate();throw Object.assign(Error('La base de datos no respondió. No se confirmó el guardado.'),{status:503});}const result=JSON.parse(Buffer.from(this.bytes,0,Atomics.load(this.state,1)).toString(),(_,v)=>v?.type==='Buffer'&&Array.isArray(v.data)?Buffer.from(v.data):v);if(result.error)throw Object.assign(Error(result.error),{code:result.code,status:503});return result;}
 query(sql,params=[]){if(this.failed)throw Object.assign(Error('Base de datos sin conexión.'),{status:503});Atomics.store(this.state,0,0);this.worker.postMessage({sql,params});return this.receive();}
 exec(sql){return this.query(sql);}
 prepare(sql){return {get:(...p)=>this.query(sql,p).rows[0],all:(...p)=>this.query(sql,p).rows,run:(...p)=>this.query(sql,p)};}
 close(){if(!this.failed){try{this.query('__close');}catch{}}this.worker.terminate();}
}
