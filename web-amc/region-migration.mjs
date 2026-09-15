import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import pg from 'pg';

const TABLES=[
 {name:'users',columns:['id','email','name','phone','town','role','password','sound','active'],order:'id'},
 {name:'sessions',columns:['token','userId','expires','csrf'],order:'token'},
 {name:'docs',columns:['rowid','id','kind','body','owner'],order:'rowid',identity:true},
 {name:'files',columns:['id','owner','mime','body'],order:'id'},
 {name:'devices',columns:['id','userId','kind','body'],order:'id'},
 {name:'delivery',columns:['rowid','id','deviceId','noticeId','body','attempts','nextAt','status','error'],order:'rowid',identity:true},
 {name:'config',columns:['key','value'],order:'key'},
 {name:'password_resets',columns:['token','userId','expires','fingerprint'],order:'token'},
 {name:'recovery_codes',columns:['challenge','userId','codehash','expires','fingerprint','attempts'],order:'challenge'}
];

const q=name=>'"'+String(name).replaceAll('"','""')+'"';
const tableName=name=>'amc_data.'+q(name);
const tlsConfig=caFile=>({rejectUnauthorized:true,...(caFile?{ca:readFileSync(caFile,'utf8')}:{})});
const digestRows=rows=>{
 const hash=createHash('sha256');
 for(const row of rows){
  const normalized={};
  for(const [key,value] of Object.entries(row))normalized[key]=Buffer.isBuffer(value)?{type:'Buffer',data:value.toString('base64')}:value;
  hash.update(JSON.stringify(normalized));hash.update('\n');
 }
 return hash.digest('hex');
};

async function assertTargetSchema(client){
 const result=await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='amc_data'");
 const present=new Set(result.rows.map(row=>row.table_name));
 const missing=TABLES.map(table=>table.name).filter(name=>!present.has(name));
 if(missing.length)throw Error('La base de destino no tiene el esquema AMC completo.');
}

async function readTable(client,table){
 const columns=table.columns.map(q).join(',');
 const result=await client.query(`SELECT ${columns} FROM ${tableName(table.name)} ORDER BY ${q(table.order)}`);
 return result.rows;
}

async function insertRows(client,table,rows){
 if(!rows.length)return;
 const columns=table.columns.map(q).join(','),chunkSize=40;
 for(let offset=0;offset<rows.length;offset+=chunkSize){
  const chunk=rows.slice(offset,offset+chunkSize),params=[];
  const values=chunk.map(row=>'('+table.columns.map(column=>{params.push(row[column]);return '$'+params.length;}).join(',')+')').join(',');
  const identity=table.identity?' OVERRIDING SYSTEM VALUE':'';
  await client.query(`INSERT INTO ${tableName(table.name)} (${columns})${identity} VALUES ${values}`,params);
 }
}

export async function migrateRegionDatabase({sourceUrl,targetUrl,caFile,sourceCaFile=caFile,targetCaFile=caFile,logger=()=>{}}={}){
 if(!sourceUrl||!targetUrl)throw Error('Faltan conexiones para la migración regional.');
 if(sourceUrl===targetUrl)throw Error('Origen y destino no pueden ser la misma base.');
 const source=new pg.Client({connectionString:sourceUrl,ssl:tlsConfig(sourceCaFile),connectionTimeoutMillis:10000,application_name:'AMC region source'});
 const target=new pg.Client({connectionString:targetUrl,ssl:tlsConfig(targetCaFile),connectionTimeoutMillis:10000,application_name:'AMC region target'});
 const copied={};
 try{
  await source.connect();await target.connect();await assertTargetSchema(target);
  const sourceData=new Map();
  for(const table of TABLES){
   const rows=await readTable(source,table);sourceData.set(table.name,rows);
   copied[table.name]={rows:rows.length,hash:digestRows(rows),bytes:table.name==='files'?rows.reduce((sum,row)=>sum+(row.body?.length||0),0):undefined};
  }
  await target.query('BEGIN');
  try{
   for(const table of [...TABLES].reverse())await target.query(`TRUNCATE TABLE ${tableName(table.name)} RESTART IDENTITY`);
   for(const table of TABLES)await insertRows(target,table,sourceData.get(table.name));
   for(const table of TABLES){
    const rows=await readTable(target,table),expected=copied[table.name];
    if(rows.length!==expected.rows||digestRows(rows)!==expected.hash)throw Error('La verificación de datos migrados no coincidió.');
   }
   await target.query('COMMIT');
  }catch(error){await target.query('ROLLBACK');throw error;}
  logger({event:'region-migration-verified',tables:Object.fromEntries(Object.entries(copied).map(([name,value])=>[name,{rows:value.rows,...(value.bytes===undefined?{}:{bytes:value.bytes})}]))});
  return copied;
 }finally{
  await Promise.allSettled([source.end(),target.end()]);
 }
}

export const regionMigrationTables=TABLES.map(({name,columns,order,identity=false})=>({name,columns:[...columns],order,identity}));
