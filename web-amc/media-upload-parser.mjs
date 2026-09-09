export function createMediaUploadParser({readRaw,text,fail}){
 return async function readMultipart(req){
  const type=req.headers['content-type']||'',match=/boundary=(?:"([^"]+)"|([^;]+))/i.exec(type);
  if(!match)fail(400,'Formulario de archivo inválido.');
  const boundary=Buffer.from('--'+(match[1]||match[2])),raw=await readRaw(req,7*1024*1024),parts={};
  let start=raw.indexOf(boundary)+boundary.length;
  while(start>=boundary.length){
   if(raw[start]===45&&raw[start+1]===45)break;
   if(raw[start]===13&&raw[start+1]===10)start+=2;
   const headEnd=raw.indexOf(Buffer.from('\r\n\r\n'),start);
   if(headEnd<0)break;
   const head=raw.subarray(start,headEnd).toString('utf8'),
    name=/name="([^"]+)"/i.exec(head)?.[1],
    mime=/content-type:\s*([^\r\n]+)/i.exec(head)?.[1]?.trim(),
    next=raw.indexOf(boundary,headEnd+4);
   if(next<0)break;
   let end=next;
   if(raw[end-2]===13&&raw[end-1]===10)end-=2;
   if(name)parts[name]={body:raw.subarray(headEnd+4,end),mime};
   start=next+boundary.length;
  }
  if(!parts.file?.body?.length)fail(400,'No se recibió la foto.');
  return {mime:text(parts.file.mime),bytes:parts.file.body,thumbnail:parts.thumbnail?.body||null};
 };
}
