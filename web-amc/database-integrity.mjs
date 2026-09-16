const TABLES=[
 {name:'docs',sequence:'docs_rowid_seq'},
 {name:'delivery',sequence:'delivery_rowid_seq'}
];
const numeric=value=>Number.isFinite(Number(value))?Number(value):0;

export function createDatabaseIntegrity({db,remoteUrl}){
 const tableHealth=({name,sequence})=>{
  const stats=db.prepare(`SELECT count(*) AS "rows",coalesce(max(rowid),0) AS "maxRowid",count(*)-count(DISTINCT rowid) AS "duplicateRowids" FROM ${name}`).get()||{};
  const result={
   rows:numeric(stats.rows),
   maxRowid:numeric(stats.maxRowid),
   duplicateRowids:numeric(stats.duplicateRowids),
   sequenceLastValue:null,
   sequenceNextValue:null,
   sequenceBehind:false
  };
  if(!remoteUrl)return result;
  const sequenceState=db.prepare(`SELECT last_value AS "lastValue",is_called AS "isCalled" FROM ${sequence}`).get()||{};
  const lastValue=numeric(sequenceState.lastValue),isCalled=sequenceState.isCalled===true||sequenceState.isCalled===1||sequenceState.isCalled==='t';
  result.sequenceLastValue=lastValue;
  result.sequenceNextValue=isCalled?lastValue+1:lastValue;
  result.sequenceBehind=result.sequenceNextValue<=result.maxRowid;
  return result;
 };
 const health=()=>{
  try{
   const tables={},issues=[];
   for(const table of TABLES){
    const result=tableHealth(table);tables[table.name]=result;
    if(result.duplicateRowids>0)issues.push(`${table.name}:duplicate-rowid`);
    if(result.sequenceBehind)issues.push(`${table.name}:sequence-behind`);
   }
   return {status:issues.length?'failed':'ok',issues,tables};
  }catch{
   return {status:'unknown',issues:['integrity-check-failed'],tables:{}};
  }
 };
 const publicHealth=()=>{
  const result=health();
  return {databaseIntegrityStatus:result.status,databaseIntegrityIssues:result.issues.length};
 };
 return {health,publicHealth};
}
