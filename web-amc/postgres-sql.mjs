// Compatibility for the finite SQL vocabulary used by the existing domain services.
// Values remain bound parameters; user input must never become SQL source.
export function postgresSql(sql){
 let index=0;
 sql=sql.replace(/PRAGMA\s+[^;]+;/gi,'').replace(/BEGIN IMMEDIATE/gi,'BEGIN').replace(/json_extract\(delivery\.body,'\$\.priority'\)/g,"(delivery.body::jsonb ->> 'priority')");
 return sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|\?|\b[A-Za-z_][A-Za-z_0-9]*\b/g,token=>{
  if(token[0]==="'"||token[0]==='"')return token;
  if(token==='?')return '$'+(++index);
  if(['userId','deviceId','noticeId','nextAt'].includes(token))return '"'+token+'"';
  if(token.toUpperCase()==='INTEGER')return 'BIGINT';
  if(token.toUpperCase()==='BLOB')return 'BYTEA';
  return token;
 }).replace(/CREATE TABLE IF NOT EXISTS (docs|delivery)\(/gi,'CREATE TABLE IF NOT EXISTS $1(rowid BIGINT GENERATED ALWAYS AS IDENTITY,');
}
