export function createRequestRuntime({fail}){
 const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
 const readRaw=async(req,limit=7*1024*1024)=>{let chunks=[],size=0;for await(const chunk of req){size+=chunk.length;if(size>limit)fail(413,'El archivo es demasiado grande.');chunks.push(chunk);}return Buffer.concat(chunks);};
 const readBody=async req=>{try{return JSON.parse((await readRaw(req)).toString()||'{}');}catch{fail(400,'Datos inválidos.');}};
 const rate=new Map();
 const checkRate=(key,limit)=>{const t=Date.now(),r=rate.get(key)||{count:0,end:t+900000};if(r.end<t){r.count=0;r.end=t+900000;}r.count++;rate.set(key,r);if(r.count>limit)fail(429,'Demasiados intentos. Probá en unos minutos.');if(rate.size>10000)for(const [k,v]of rate)if(v.end<t)rate.delete(k);};
 return {send,readRaw,readBody,rate,checkRate};
}
