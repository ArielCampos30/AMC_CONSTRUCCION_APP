const database=new Promise((resolve,reject)=>{const r=indexedDB.open('AMC-offline-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('records');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
export async function read(key){const db=await database;return new Promise((resolve,reject)=>{const r=db.transaction('records').objectStore('records').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function write(key,value){const db=await database;return new Promise((resolve,reject)=>{const tx=db.transaction('records','readwrite');tx.objectStore('records').put(value,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
export async function clearOffline(){const pending=await read('queue')||[];if(pending.length)throw Error('Tenés informes sin enviar. Entrá a Trabajo sin conexión para enviarlos o descargar una copia antes de borrarlos y cerrar sesión.');await write('snapshot',null);}

export async function cacheEmployeeSnapshot(state){
 const user=state?.user;if(user?.role!=='employee')return false;
 const pending=await read('queue')||[];if(pending.some(q=>q.owner!==user.id))return false;
 const tasks=(state.assignments||[]).map(t=>({id:t.id,clientName:t.clientName,type:t.type,day:t.day,time:t.time,status:t.status,address:t.address,phone:t.phone,instructions:t.instructions,quoteStatus:t.quoteStatus}));
 await write('snapshot',{user:{id:user.id,name:user.name,role:user.role},date:new Date().toISOString(),tasks});
 const sent=await read('sent')||[],cutoff=Date.now()-90*86400000;
 await write('sent',sent.filter(x=>x.owner!==user.id||Date.parse(x.date||0)>=cutoff).slice(0,200));
 return true;
}
