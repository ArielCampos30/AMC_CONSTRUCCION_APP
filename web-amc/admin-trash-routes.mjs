const TRASH_PREFIX='trash-';

export function adminTrashRoutes({db,get,put,transaction,requireAdmin,send,fail,now,id}){
 const rows=()=>db.prepare('SELECT id,kind,owner,body FROM docs').all().map(row=>({...row,value:JSON.parse(row.body)}));
 const trashedKind=kind=>TRASH_PREFIX+kind;
 const isTrashed=row=>row.kind==='trashEntry'||row.kind.startsWith(TRASH_PREFIX);
 const linkedToRequest=(row,requestId)=>row.kind==='request'&&row.id===requestId||row.value?.requestId===requestId||row.value?.solicitudId===requestId;
 const linkedToQuote=(row,quoteId)=>row.kind==='quote'&&row.id===quoteId||row.value?.quoteId===quoteId||row.value?.presupuestoId===quoteId;
 const noticesFor=(source,ids)=>source.filter(row=>row.kind==='notice'&&ids.some(value=>String(row.value?.url||'').includes(value)));
 const uniqueRows=list=>[...new Map(list.map(row=>[row.id,row])).values()];
 const ensureSafe=list=>{
  if(list.some(row=>row.kind==='work'))fail(409,'Esta información ya tiene una obra vinculada y no puede enviarse a Papelera.');
  const accepted=list.filter(row=>row.kind==='quote').some(row=>row.value?.status==='Aceptado'||row.value?.obraId);
  if(accepted)fail(409,'Hay un presupuesto aceptado u obra vinculada. Conservá este historial.');
 };
 const move=(list,entry)=>transaction(()=>{
  for(const row of list)db.prepare('UPDATE docs SET kind=? WHERE id=? AND kind=?').run(trashedKind(row.kind),row.id,row.kind);
  put('trashEntry',entry.owner,{...entry,items:list.map(row=>({id:row.id,kind:row.kind,owner:row.owner})),count:list.length});
  return entry;
 });
 const trashRequest=(user,requestId)=>{
  requireAdmin(user);const request=get('request',requestId),source=rows(),related=source.filter(row=>!isTrashed(row)&&linkedToRequest(row,requestId));
  const quoteIds=related.filter(row=>row.kind==='quote').map(row=>row.id),list=uniqueRows([...related,...noticesFor(source,[requestId,...quoteIds])]);
  ensureSafe(list);
  const entry={id:'trash-'+id(),rootType:'request',rootId:request.id,owner:request.userId||'',title:request.name||'Solicitud',subtitle:(request.services||[request.service]).filter(Boolean).join(' · ')||request.description||'',trashedAt:now(),trashedBy:user.id};
  return move(list,entry);
 };
 const trashQuote=(user,quoteId)=>{
  requireAdmin(user);const quote=get('quote',quoteId),source=rows(),related=source.filter(row=>!isTrashed(row)&&linkedToQuote(row,quoteId)&&row.kind!=='request'),list=uniqueRows([...related,...noticesFor(source,[quoteId])]);
  ensureSafe(list);
  const entry={id:'trash-'+id(),rootType:'quote',rootId:quote.id,owner:quote.userId||'',title:quote.number||'Presupuesto',subtitle:quote.items?.[0]?.description||'',trashedAt:now(),trashedBy:user.id};
  return move(list,entry);
 };
 const restore=(user,entryId)=>{
  requireAdmin(user);const entry=get('trashEntry',entryId);
  return transaction(()=>{
   for(const item of entry.items||[])db.prepare('UPDATE docs SET kind=? WHERE id=? AND kind=?').run(item.kind,item.id,trashedKind(item.kind));
   db.prepare("DELETE FROM docs WHERE id=? AND kind='trashEntry'").run(entry.id);
   return entry;
  });
 };
 const remove=(user,entryId)=>{
  requireAdmin(user);const entry=get('trashEntry',entryId);
  return transaction(()=>{
   for(const item of entry.items||[])db.prepare('DELETE FROM docs WHERE id=? AND kind=?').run(item.id,trashedKind(item.kind));
   db.prepare("DELETE FROM docs WHERE id=? AND kind='trashEntry'").run(entry.id);
   return entry;
  });
 };
 return function route({p,method,user,res}){
  let match;if(method!=='POST')return false;
  if((match=p.match(/^\/api\/admin\/trash\/requests\/([^/]+)$/))){send(res,200,trashRequest(user,decodeURIComponent(match[1])));return true;}
  if((match=p.match(/^\/api\/admin\/trash\/quotes\/([^/]+)$/))){send(res,200,trashQuote(user,decodeURIComponent(match[1])));return true;}
  if((match=p.match(/^\/api\/admin\/trash\/([^/]+)\/restore$/))){send(res,200,restore(user,decodeURIComponent(match[1])));return true;}
  if((match=p.match(/^\/api\/admin\/trash\/([^/]+)\/delete$/))){send(res,200,remove(user,decodeURIComponent(match[1])));return true;}
  return false;
 };
}
