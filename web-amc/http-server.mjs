import http from 'node:http';
import {randomBytes} from 'node:crypto';

export function createHttpServer({handle,send,recentServerErrors,recentErrorCount}){
 const server=http.createServer((req,res)=>{const requestId=randomBytes(8).toString('hex'),started=Date.now();req.amcRequestId=requestId;res.setHeader('X-Request-ID',requestId);res.once('finish',()=>{if(process.env.NODE_ENV==='test')return;const pathname=String(req.url||'').split('?')[0];if(res.statusCode>=500){recentServerErrors.push(Date.now());recentErrorCount();}if(pathname==='/healthz'&&res.statusCode<400)return;console.log(JSON.stringify({level:'info',requestId,method:req.method,path:pathname,status:res.statusCode,durationMs:Date.now()-started}));});handle(req,res).catch(error=>{console.error(JSON.stringify({level:'error',requestId,method:req.method,path:String(req.url||'').split('?')[0],status:503,error:error?.code||error?.name||'Unhandled'}));if(!res.headersSent)send(res,503,{error:'No pudimos confirmar la operación. Revisá la conexión y el estado antes de repetirla.'});else res.end();});});
 server.requestTimeout=30000;
 server.headersTimeout=10000;
 return server;
}
