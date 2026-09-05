import {readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
const cache=new Map();
export function staticResponse(req,res,file){
 const stat=statSync(file);let entry=cache.get(file);
 if(!entry||entry.mtime!==stat.mtimeMs){const bytes=readFileSync(file),ext=file.split('.').pop(),mime=({html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',jpg:'image/jpeg',png:'image/png',webp:'image/webp',svg:'image/svg+xml',webmanifest:'application/manifest+json',txt:'text/plain; charset=utf-8',xml:'application/xml'})[ext]||'application/octet-stream';entry={mtime:stat.mtimeMs,bytes,mime,tag:'"'+createHash('sha256').update(bytes).digest('hex')+'"',gzip:/^(text\/|application\/(manifest\+json|xml))/.test(mime)&&bytes.length>1024?gzipSync(bytes):null};if(cache.size>128)cache.clear();cache.set(file,entry);}
 res.setHeader('Content-Type',entry.mime);res.setHeader('Cache-Control','public, max-age=0, must-revalidate');res.setHeader('Vary','Accept-Encoding');res.setHeader('ETag',entry.tag);
 if(req.headers['if-none-match']===entry.tag){res.writeHead(304);return res.end();}
 const zipped=entry.gzip&&/\bgzip\b/.test(req.headers['accept-encoding']||'');const body=zipped?entry.gzip:entry.bytes;if(zipped)res.setHeader('Content-Encoding','gzip');res.setHeader('Content-Length',body.length);res.end(req.method==='HEAD'?undefined:body);
}

