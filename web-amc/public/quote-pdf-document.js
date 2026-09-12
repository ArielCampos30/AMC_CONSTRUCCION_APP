const money=value=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(Number(value)||0);
const clean=value=>String(value??'').trim();
const number=value=>Number.isFinite(Number(value))?Number(value):0;
let logoPromise;

function bytesFromBinary(value){
 const bytes=new Uint8Array(value.length);
 for(let index=0;index<value.length;index++)bytes[index]=value.charCodeAt(index)&255;
 return bytes;
}
function cp1252Byte(character){
 const code=character.charCodeAt(0);
 if(code<=255)return code;
 const map={'€':128,'‚':130,'ƒ':131,'„':132,'…':133,'†':134,'‡':135,'ˆ':136,'‰':137,'Š':138,'‹':139,'Œ':140,'Ž':142,'‘':145,'’':146,'“':147,'”':148,'•':149,'–':150,'—':151,'˜':152,'™':153,'š':154,'›':155,'œ':156,'ž':158,'Ÿ':159};
 return map[character]||63;
}
function pdfEsc(value){
 let output='';
 for(const character of String(value||'')){
  const byte=cp1252Byte(character),encoded=String.fromCharCode(byte);
  if(encoded==='\\'||encoded==='('||encoded===')')output+='\\'+encoded;
  else if(byte===10||byte===13)output+=' ';
  else output+=encoded;
 }
 return output;
}
async function loadLogo(){
 if(!logoPromise)logoPromise=fetch('/assets/amc-logo-pdf.jpg',{cache:'force-cache'}).then(async response=>{
  if(!response.ok)throw Error('No se pudo cargar el logo oficial de AMC.');
  const bytes=new Uint8Array(await response.arrayBuffer());let binary='';
  for(let index=0;index<bytes.length;index+=0x8000)binary+=String.fromCharCode(...bytes.subarray(index,index+0x8000));
  return binary;
 });
 return logoPromise;
}
function isoDay(value){
 const raw=clean(value);
 if(/^\d{4}-\d{2}-\d{2}/.test(raw))return raw.slice(0,10);
 return new Date().toLocaleDateString('en-CA');
}

export function buildQuotePdfDocument({quote,request={},client={},settings={}}={}){
 const items=(Array.isArray(quote?.items)?quote.items:[]).map(item=>({clientDescription:clean(item?.description||item?.clientDescription)})).filter(item=>item.clientDescription);
 return {
  number:clean(quote?.number)||'Presupuesto AMC',date:isoDay(quote?.date),client:clean(client?.name||request?.name)||'Cliente',
  phone:clean(client?.phone||request?.phone),location:clean(request?.address||client?.address||client?.town||request?.town),items,total:number(quote?.total),
  validity:clean(quote?.validity||settings?.validity)||'10',materialsIncluded:clean(quote?.materialsIncluded)||'No',payment:clean(quote?.payment||settings?.payment)||'A convenir',notes:clean(quote?.notes),
  company:clean(settings?.company)||'AMC Construcciones y Arreglos',advance:number(settings?.advance),conditions:clean(settings?.conditions),contactPhone:clean(settings?.phone)
 };
}

export async function makeQuotePdf(documentData){
 const q=documentData||{},image=await loadLogo(),logoW=260,logoH=260;
 const W=595,H=842,L=42,R=553,CW=511,BOTTOM=755;
 const blue='0.035 0.40 0.37',ink='0.12 0.18 0.24',muted='0.38 0.44 0.49',rule='0.82 0.87 0.90';
 const pages=[];let commands=[],y=0;
 const measureCanvas=document.createElement('canvas'),measure=measureCanvas.getContext('2d');
 function width(value,size,bold=false){measure.font=(bold?'bold ':'')+size+'px Arial';return measure.measureText(String(value)).width*1.035;}
 function wrap(value,max,size=11,bold=false){
  const result=[];
  for(const paragraph of String(value??'').split(/\r?\n/)){
   if(!paragraph.trim()){result.push('');continue;}
   let line='';
   for(const word of paragraph.trim().split(/\s+/)){
    if(width(word,size,bold)>max){
     if(line){result.push(line);line='';}
     let part='';for(const character of word){if(width(part+character,size,bold)>max&&part){result.push(part);part='';}part+=character;}line=part;
    }else if(width(line?line+' '+word:word,size,bold)>max){result.push(line);line=word;}
    else line+=(line?' ':'')+word;
   }
   if(line)result.push(line);
  }
  return result.length?result:[''];
 }
 function txt(value,x,top,size=11,bold=false,color=ink){commands.push(`BT ${color} rg /F${bold?2:1} ${size} Tf 1 0 0 1 ${x} ${H-top} Tm (${pdfEsc(value)}) Tj ET`);}
 function box(x,top,w,h,fill,stroke=null){commands.push(`q ${fill} rg ${x} ${H-top-h} ${w} ${h} re f Q`);if(stroke)commands.push(`q ${stroke} RG 0.6 w ${x} ${H-top-h} ${w} ${h} re S Q`);}
 function line(x1,top,x2,color=rule){commands.push(`q ${color} RG 0.6 w ${x1} ${H-top} m ${x2} ${H-top} l S Q`);}
 function newPage(){
  if(commands.length)pages.push(commands);commands=[];
  const company=String(q.company||'AMC CONSTRUCCIONES Y ARREGLOS').toUpperCase(),brandLines=wrap(company,414,17,true),brandHeight=brandLines.length*21,headerHeight=Math.max(100,brandHeight+54);
  box(0,0,W,headerHeight,blue);
  const logoSize=62,logoTop=25;commands.push(`q ${logoSize} 0 0 ${logoSize} ${L} ${H-logoTop-logoSize} cm /Im1 Do Q`);
  brandLines.forEach((value,index)=>txt(value,122,43+index*21,17,true,'1 1 1'));
  txt('PRESUPUESTO DE OBRA',122,43+brandHeight+9,10,true,'0.76 0.86 0.94');
  const metadataTop=headerHeight+20;
  txt('NÚMERO DE PRESUPUESTO',L,metadataTop,8.5,true,muted);
  const numberLines=wrap(q.number||'Sin número',325,11,true);numberLines.forEach((value,index)=>txt(value,L,metadataTop+19+index*15,11,true));
  txt('FECHA',435,metadataTop,8.5,true,muted);txt(q.date||'',435,metadataTop+19,11);
  y=metadataTop+19+numberLines.length*15+10;line(L,y,R);y+=24;
 }
 function ensure(height){if(y+height>BOTTOM)newPage();}
 function section(title){ensure(58);txt(title,L,y+12,11,true,blue);y+=28;}
 function paragraph(value,size=10.5,color=ink){for(const row of wrap(value,CW,size)){ensure(17);txt(row,L,y+size,size,false,color);y+=17;}}
 function labeled(label,value){
  const lines=wrap(value||'No informado',CW-26,11);let index=0;
  while(index<lines.length){
   ensure(60);const count=Math.max(1,Math.min(lines.length-index,Math.floor((BOTTOM-y-36)/16))),height=33+count*16;
   box(L,y,CW,height,'0.96 0.975 0.985',rule);txt(label+(index?' (continuación)':''),L+13,y+17,8.5,true,muted);
   for(let offset=0;offset<count;offset++)txt(lines[index+offset],L+13,y+36+offset*16,11);
   y+=height+10;index+=count;
  }
 }
 function tableHeader(){ensure(65);box(L,y,CW,28,'0.90 0.94 0.97');txt('N°',L+12,y+18,9,true,blue);txt('DESCRIPCIÓN DEL TRABAJO',L+49,y+18,9,true,blue);y+=28;}
 newPage();
 labeled('CLIENTE',q.client);
 const town=wrap(q.location||'No informada',305,11),phone=wrap(q.phone||'No informado',153,11),contactHeight=34+Math.max(town.length,phone.length)*16;
 if(contactHeight<200){
  ensure(contactHeight+14);box(L,y,CW,contactHeight,'0.96 0.975 0.985',rule);txt('LOCALIDAD / DIRECCIÓN',L+13,y+17,8.5,true,muted);txt('TELÉFONO',L+344,y+17,8.5,true,muted);
  town.forEach((value,index)=>txt(value,L+13,y+36+index*16,11));phone.forEach((value,index)=>txt(value,L+344,y+36+index*16,11));y+=contactHeight+22;
 }else{labeled('LOCALIDAD / DIRECCIÓN',q.location);labeled('TELÉFONO',q.phone);y+=12;}
 section('TRABAJOS INCLUIDOS');tableHeader();
 const items=q.items||[];
 items.forEach((item,itemIndex)=>{
  const lines=wrap(item.clientDescription||'',CW-65,11);let at=0;
  while(at<lines.length){
   if(BOTTOM-y<44){newPage();section('TRABAJOS INCLUIDOS · CONTINUACIÓN');tableHeader();}
   const count=Math.min(lines.length-at,Math.max(1,Math.floor((BOTTOM-y-24)/16))),height=Math.max(42,count*16+24);
   box(L,y,CW,height,itemIndex%2?'0.966 0.976 0.983':'1 1 1');txt(at?'...':String(itemIndex+1),L+12,y+24,10,true,muted);
   for(let index=0;index<count;index++)txt(lines[at+index],L+49,y+24+index*16,11);
   line(L,y+height,R);y+=height;at+=count;
  }
 });
 if(!items.length)paragraph('Sin trabajos cargados.');
 y+=24;ensure(116);
 const totalText=money(q.total);let totalSize=26;while(width(totalText,totalSize,true)>CW-36&&totalSize>12)totalSize-=1;
 box(L,y,CW,74,blue);txt('TOTAL FINAL',L+18,y+24,10,true,'0.80 0.88 0.94');txt(totalText,L+18,y+55,totalSize,true,'1 1 1');y+=90;
 const advance=number(q.advance);if(advance>0){paragraph(`Anticipo sugerido (${advance}%): ${money(number(q.total)*advance/100)}`,11);y+=12;}
 section('CONDICIONES DEL PRESUPUESTO');paragraph(`Validez: ${q.validity||10} días.    Materiales incluidos: ${q.materialsIncluded||'No'}`);y+=7;paragraph(`Forma de pago: ${q.payment||'A convenir'}`);y+=14;
 if(q.notes){section('OBSERVACIONES');paragraph(q.notes);y+=16;}
 if(q.conditions){section('ACLARACIONES');paragraph(q.conditions,10,muted);y+=16;}
 if(q.contactPhone){ensure(40);paragraph('Contacto AMC: '+q.contactPhone,10.5);}
 pages.push(commands);
 const streams=pages.map((pageCommands,index)=>{commands=pageCommands;line(L,788,R);txt('AMC · Construcciones y Arreglos',L,805,8.5,false,muted);txt(`Página ${index+1} de ${pages.length}`,470,805,8.5,false,muted);return commands.join('\n');});
 const objects=[];objects[1]='<< /Type /Catalog /Pages 2 0 R >>';objects[3]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';objects[4]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';objects[5]=`<< /Type /XObject /Subtype /Image /Width ${logoW} /Height ${logoH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n${image}\nendstream`;
 let next=6;const ids=streams.map(()=>({page:next++,content:next++}));objects[2]=`<< /Type /Pages /Kids [${ids.map(value=>value.page+' 0 R').join(' ')}] /Count ${ids.length} >>`;
 streams.forEach((stream,index)=>{objects[ids[index].page]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << /Im1 5 0 R >> >> /Contents ${ids[index].content} 0 R >>`;objects[ids[index].content]=`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;});
 let pdf='%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';const offsets=[0];
 for(let index=1;index<objects.length;index++){offsets[index]=pdf.length;pdf+=`${index} 0 obj\n${objects[index]}\nendobj\n`;}
 const xref=pdf.length;pdf+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;for(let index=1;index<objects.length;index++)pdf+=String(offsets[index]).padStart(10,'0')+' 00000 n \n';pdf+=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
 return new Blob([bytesFromBinary(pdf)],{type:'application/pdf'});
}

export async function blobToBase64(blob){
 const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';
 for(let index=0;index<bytes.length;index+=0x8000)binary+=String.fromCharCode(...bytes.subarray(index,index+0x8000));
 return btoa(binary);
}
