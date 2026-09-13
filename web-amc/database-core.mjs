import {PostgresDatabase} from './postgres-db.mjs';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import path from 'node:path';

const schema=`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT,phone TEXT,town TEXT,role TEXT NOT NULL,password TEXT NOT NULL,sound INTEGER DEFAULT 1);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,userId TEXT NOT NULL,expires INTEGER NOT NULL,csrf TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS docs(id TEXT PRIMARY KEY,kind TEXT NOT NULL,owner TEXT NOT NULL DEFAULT '',body TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS docs_scope ON docs(kind,owner);
 CREATE TABLE IF NOT EXISTS files(id TEXT PRIMARY KEY,owner TEXT NOT NULL,mime TEXT NOT NULL,body BLOB NOT NULL);
 CREATE TABLE IF NOT EXISTS devices(id TEXT PRIMARY KEY,userId TEXT NOT NULL,kind TEXT NOT NULL,body TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS delivery(id TEXT PRIMARY KEY,deviceId TEXT NOT NULL,noticeId TEXT NOT NULL,body TEXT NOT NULL,attempts INTEGER DEFAULT 0,nextAt INTEGER DEFAULT 0,status TEXT DEFAULT 'pending',error TEXT DEFAULT '');
 CREATE TABLE IF NOT EXISTS config(key TEXT PRIMARY KEY,value TEXT NOT NULL);`;

export function createDatabaseCore({dbPath,id,sha,now,fail}){
 if(dbPath!==':memory:')mkdirSync(path.dirname(dbPath),{recursive:true});
 const testUrl=process.env.NODE_ENV==='test'?process.env.AMC_TEST_DATABASE_URL:null;
 const remoteUrl=testUrl||process.env.AMC_DATABASE_URL;
 const db=remoteUrl?new PostgresDatabase(remoteUrl,{schema:testUrl?'amc_test_'+(dbPath===':memory:'?id().replaceAll('-',''):sha(dbPath).slice(0,24)):'amc_data',test:!!testUrl,caFile:process.env.AMC_DATABASE_CA_FILE}):new DatabaseSync(dbPath);
 db.exec(schema);
 if(!db.prepare('PRAGMA table_info(users)').all().some(c=>c.name==='active'))db.exec('ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1');
 let stateRows=null,statePositions=null,stateUsers=null;
 const all=(kind,owner)=>stateRows?(stateRows.get(kind)||[]).filter(r=>owner===undefined||r.owner===owner).map(r=>r.value):db.prepare('SELECT body FROM docs WHERE kind=?'+(owner===undefined?'':' AND owner=?')+' ORDER BY rowid DESC').all(...(owner===undefined?[kind]:[kind,owner])).map(r=>JSON.parse(r.body));
 const activeUsers=role=>stateUsers?stateUsers.filter(user=>!role||user.role===role):db.prepare('SELECT id,name,email,phone,town,role,active FROM users WHERE active=1'+(role?' AND role=?':'')+' ORDER BY name').all(...(role?[role]:[]));
 const docPosition=key=>statePositions?.get(key)||db.prepare('SELECT rowid FROM docs WHERE id=?').get(key)?.rowid||0;
 const get=(kind,key)=>{const r=db.prepare('SELECT body FROM docs WHERE kind=? AND id=?').get(kind,key);if(!r)fail(404,'No encontrado.');return JSON.parse(r.body);};
 const put=(kind,owner,body)=>{db.prepare('INSERT INTO docs(id,kind,owner,body) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body,owner=excluded.owner').run(body.id,kind,owner,JSON.stringify(body));return body;};
 const transaction=fn=>{db.exec('BEGIN IMMEDIATE');try{const value=fn();db.exec('COMMIT');return value;}catch(e){db.exec('ROLLBACK');throw e;}};
 const migrateRelations=()=>transaction(()=>{
  const requests=all('request'),quotes=all('quote'),works=all('work'),quoteById=new Map(quotes.map(q=>[q.id,q]));
  const workByQuote=new Map(works.filter(w=>w.quoteId||w.presupuestoId).map(w=>[w.presupuestoId||w.quoteId,w]));
  for(const quote of quotes){const solicitudId=quote.solicitudId||quote.requestId||null,work=workByQuote.get(quote.id);const next={...quote,presupuestoId:quote.presupuestoId||quote.id,solicitudId,requestId:quote.requestId||solicitudId,obraId:quote.obraId||work?.id||null,schemaVersion:2};if(JSON.stringify(next)!==JSON.stringify(quote))put('quote',quote.userId,next);}
  for(const work of works){const presupuestoId=work.presupuestoId||work.quoteId||null,quote=presupuestoId?quoteById.get(presupuestoId):null,solicitudId=work.solicitudId||work.requestId||quote?.solicitudId||quote?.requestId||null;if(!presupuestoId&&!solicitudId)continue;const next={...work,obraId:work.obraId||work.id,presupuestoId,quoteId:work.quoteId||presupuestoId,solicitudId,requestId:work.requestId||solicitudId,schemaVersion:2};if(JSON.stringify(next)!==JSON.stringify(work))put('work',work.userId,next);}
  const migratedQuotes=all('quote'),migratedWorks=all('work');
  for(const request of requests){const presupuestoIds=migratedQuotes.filter(q=>(q.solicitudId||q.requestId)===request.id).map(q=>q.id),obraIds=migratedWorks.filter(w=>(w.solicitudId||w.requestId)===request.id).map(w=>w.id),next={...request,solicitudId:request.solicitudId||request.id,presupuestoIds:[...new Set([...(request.presupuestoIds||[]),...presupuestoIds])],obraIds:[...new Set([...(request.obraIds||[]),...obraIds])],schemaVersion:2};if(JSON.stringify(next)!==JSON.stringify(request))put('request',request.userId,next);}
 });
 const migrateCompletion=()=>transaction(()=>{for(const work of all('work').filter(w=>['Pendiente de cierre','Pendiente de conformidad'].includes(w.status))){const closure=all('closure').filter(c=>c.workId===work.id).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')))[0],closureStatus=closure?.status||(work.status==='Pendiente de conformidad'?'Pendiente de conformidad':'Pendiente');put('work',work.userId,{...work,status:'Finalizado',closureStatus,completedAt:work.completedAt||work.updatedAt||now()});if(work.requestId){const request=all('request').find(r=>r.id===work.requestId);if(request)put('request',request.userId,{...request,status:'Cerrada',statusUpdatedAt:request.statusUpdatedAt||now()});}if(work.calendarBookingId){const booking=all('calendarBooking').find(b=>b.id===work.calendarBookingId);if(booking&&booking.status!=='Cancelada'&&booking.status!=='Finalizada')put('calendarBooking','',{...booking,status:'Finalizada',completedAt:booking.completedAt||now(),updatedAt:now()});}}});
 const runMigrations=()=>{migrateRelations();migrateCompletion();};
 const beginStateSnapshot=()=>{
  const rows=db.prepare("SELECT 'doc' AS source,CAST(rowid AS TEXT) AS position,id,kind,owner,body,NULL AS email,NULL AS name,NULL AS phone,NULL AS town,NULL AS role,NULL AS active FROM docs WHERE kind!='estimator' UNION ALL SELECT 'user' AS source,NULL AS position,id,NULL AS kind,NULL AS owner,NULL AS body,email,name,phone,town,role,active FROM users WHERE active=1").all();
  stateRows=new Map();statePositions=new Map();stateUsers=[];
  const docs=rows.filter(row=>row.source==='doc').sort((a,b)=>Number(b.position)-Number(a.position));
  for(const row of docs){if(!stateRows.has(row.kind))stateRows.set(row.kind,[]);stateRows.get(row.kind).push({owner:row.owner,value:JSON.parse(row.body)});statePositions.set(row.id,Number(row.position)||0);}
  for(const row of rows)if(row.source==='user')stateUsers.push({id:row.id,name:row.name,email:row.email,phone:row.phone,town:row.town,role:row.role,active:Number(row.active)!==0});
  return stateRows;
 };
 const endStateSnapshot=()=>{stateRows=null;statePositions=null;stateUsers=null;};
 runMigrations();
 return {db,remoteUrl,all,activeUsers,docPosition,get,put,transaction,runMigrations,beginStateSnapshot,endStateSnapshot};
}
