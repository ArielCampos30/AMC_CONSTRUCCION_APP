import {isIP} from 'node:net';

const RATE_WINDOW_MS=15*60*1000;
const normalizeIp=value=>{
 let candidate=String(value||'').split(',')[0].trim();
 if(!candidate)return '';
 if(candidate.startsWith('[')){const end=candidate.indexOf(']');if(end>1)candidate=candidate.slice(1,end);}
 if(candidate.startsWith('::ffff:')&&isIP(candidate.slice(7))===4)candidate=candidate.slice(7);
 if(isIP(candidate))return candidate.toLowerCase();
 const ipv4Port=candidate.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
 if(ipv4Port&&isIP(ipv4Port[1])===4)return ipv4Port[1];
 return '';
};

export const clientIpFromRequest=req=>normalizeIp(req?.headers?.['x-forwarded-for'])||normalizeIp(req?.socket?.remoteAddress)||'unknown';

export function createPersistentRateLimiter({db,fail,clock=Date.now}){
 db.exec('CREATE TABLE IF NOT EXISTS auth_rate_limits(rateKey TEXT PRIMARY KEY,count INTEGER NOT NULL,windowEnd INTEGER NOT NULL)');
 let operations=0;
 const check=(key,limit)=>{
  const t=clock(),end=t+RATE_WINDOW_MS,row=db.prepare(`INSERT INTO auth_rate_limits(rateKey,count,windowEnd) VALUES(?,1,?)
   ON CONFLICT(rateKey) DO UPDATE SET
    count=CASE WHEN auth_rate_limits.windowEnd<=? THEN 1 ELSE auth_rate_limits.count+1 END,
    windowEnd=CASE WHEN auth_rate_limits.windowEnd<=? THEN excluded.windowEnd ELSE auth_rate_limits.windowEnd END
   RETURNING count,windowEnd`).get(key,end,t,t);
  if(++operations%100===0)db.prepare('DELETE FROM auth_rate_limits WHERE windowEnd<=?').run(t);
  if(Number(row?.count||0)>limit)fail(429,'Demasiados intentos. Probá en unos minutos.');
 };
 const clear=key=>db.prepare('DELETE FROM auth_rate_limits WHERE rateKey=?').run(key);
 return {check,clear};
}

export function createRequestRuntime({fail,clock=Date.now}){
 const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
 const readRaw=async(req,limit=7*1024*1024)=>{let chunks=[],size=0;for await(const chunk of req){size+=chunk.length;if(size>limit)fail(413,'El archivo es demasiado grande.');chunks.push(chunk);}return Buffer.concat(chunks);};
 const readBody=async req=>{try{return JSON.parse((await readRaw(req)).toString()||'{}');}catch{fail(400,'Datos inválidos.');}};
 const rate=new Map();
 const checkRate=(key,limit)=>{const t=clock(),r=rate.get(key)||{count:0,end:t+RATE_WINDOW_MS};if(r.end<t){r.count=0;r.end=t+RATE_WINDOW_MS;}r.count++;rate.set(key,r);if(r.count>limit)fail(429,'Demasiados intentos. Probá en unos minutos.');if(rate.size>10000)for(const [k,v]of rate)if(v.end<t)rate.delete(k);};
 return {send,readRaw,readBody,rate,checkRate};
}
