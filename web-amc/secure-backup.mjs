import {openSync,closeSync,readSync,writeSync,unlinkSync} from 'node:fs';
import {randomBytes,scryptSync,createCipheriv,createDecipheriv} from 'node:crypto';

const MAGIC=Buffer.from('AMCBAK01');
const tables={users:['id','email','name','phone','town','role','password','sound','active'],docs:['id','kind','owner','body'],files:['id','owner','mime','body'],config:['key','value']};
function keyFor(password,salt){if(typeof password!=='string'||password.length<16||password.length>200)throw Error('La clave del respaldo debe tener entre 16 y 200 caracteres.');return scryptSync(password,salt,32);}
function aad(header,index){return Buffer.concat([header,Buffer.from(String(index))]);}
function writeAll(fd,buffer){let offset=0;while(offset<buffer.length)offset+=writeSync(fd,buffer,offset,buffer.length-offset);}
function exact(fd,n){const b=Buffer.alloc(n);let offset=0;while(offset<n){const count=readSync(fd,b,offset,n-offset);if(!count)throw Error('Respaldo incompleto.');offset+=count;}return b;}
function validate(record){if(!record||!Object.hasOwn(tables,record.table)||!record.row||Object.keys(record.row).length!==tables[record.table].length||tables[record.table].some(k=>!Object.hasOwn(record.row,k)))throw Error('Contenido de respaldo inválido.');if(record.table==='files'&&(typeof record.row.body!=='string'||record.row.body.length>9e6))throw Error('Archivo de respaldo inválido.');}

// A framed authenticated stream keeps memory bounded even when photos are numerous.
// Each frame authenticates its position; the final frame detects truncation.
export function exportBackup(db,file,password){
 const header=Buffer.concat([MAGIC,randomBytes(16)]),key=keyFor(password,header.subarray(8));
 const fd=openSync(file,'wx',0o600);let count=0,begun=false,done=false;
 function frame(record){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(aad(header,count));const encrypted=Buffer.concat([cipher.update(JSON.stringify(record),'utf8'),cipher.final()]),size=Buffer.alloc(4);size.writeUInt32BE(encrypted.length);writeAll(fd,Buffer.concat([size,iv,cipher.getAuthTag(),encrypted]));count++;}
 try{writeAll(fd,header);db.exec(typeof db.query==='function'?'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY':'BEGIN IMMEDIATE');begun=true;
  for(const [table,columns] of Object.entries(tables)){
   // Fetch each photo separately: the PostgreSQL bridge has a bounded response buffer.
   if(table==='files'){for(const {id} of db.prepare('SELECT id FROM files').all()){const row=db.prepare('SELECT id,owner,mime,body FROM files WHERE id=?').get(id);frame({table,row:{...row,body:Buffer.from(row.body).toString('base64')}});}}
   else for(const row of db.prepare('SELECT '+columns.join(',')+' FROM '+table+(table==='docs'?' ORDER BY rowid ASC':'')).all())frame({table,row});
  }
  db.exec('COMMIT');begun=false;frame({end:true,count});done=true;return {records:count-1};
 }finally{if(begun)db.exec('ROLLBACK');closeSync(fd);key.fill(0);if(!done)unlinkSync(file);}
}

function scan(fd,password,consume=()=>{}){
 const header=exact(fd,24);if(!header.subarray(0,8).equals(MAGIC))throw Error('Formato de respaldo desconocido.');const key=keyFor(password,header.subarray(8));let count=0;
 try{while(true){const size=exact(fd,4).readUInt32BE();if(size<1||size>10*1024*1024)throw Error('Tamaño de respaldo inválido.');const iv=exact(fd,12),tag=exact(fd,16),encrypted=exact(fd,size),decipher=createDecipheriv('aes-256-gcm',key,iv);decipher.setAAD(aad(header,count));decipher.setAuthTag(tag);const record=JSON.parse(Buffer.concat([decipher.update(encrypted),decipher.final()]).toString('utf8'));
   if(record.end===true){if(record.count!==count||readSync(fd,Buffer.alloc(1),0,1)!==0)throw Error('Respaldo incompleto o alterado.');return {records:count};}
   validate(record);consume(record);count++;
  }}catch{throw Error('No se pudo validar el respaldo: clave incorrecta, archivo incompleto o alterado.');}finally{key.fill(0);}
}
export function verifyBackup(file,password){const fd=openSync(file,'r');try{return scan(fd,password);}finally{closeSync(fd);}}
export function restoreBackup(db,file,password){
 // No overwrite mode: production data cannot be replaced by this recovery tool.
 verifyBackup(file,password);db.exec('BEGIN IMMEDIATE');let done=false;
 try{for(const table of ['users','docs','files','sessions','devices','delivery','password_resets'])if(db.prepare('SELECT count(*) AS n FROM '+table).get().n)throw Error('La restauración requiere una base vacía. No se modificaron los datos existentes.');
  db.exec('DELETE FROM config');const fd=openSync(file,'r');let result;
  try{result=scan(fd,password,({table,row})=>{const columns=tables[table],values=columns.map(k=>table==='files'&&k==='body'?Buffer.from(row[k],'base64'):row[k]);db.prepare('INSERT INTO '+table+'('+columns.join(',')+') VALUES('+columns.map(()=>'?').join(',')+')').run(...values);});}finally{closeSync(fd);}
  db.exec('COMMIT');done=true;return result;
 }finally{if(!done)db.exec('ROLLBACK');}
}
