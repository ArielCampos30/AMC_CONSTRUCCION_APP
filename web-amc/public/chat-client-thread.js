export function requestClientKey(request={}){
 return request.leadId||request.userId||((request.name||'')+'|'+(request.phone||''));
}

function latestMessageFor(requestId,messages){
 return messages.filter(message=>message.requestId===requestId).sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0]||null;
}

export function buildClientContacts({requests=[],messages=[],chatUnread={},agendaClients=[],admin=false}){
 if(!requests.length)return [];
 if(!admin){
  const requestIds=requests.map(request=>request.id),all=messages.filter(message=>requestIds.includes(message.requestId)).sort((a,b)=>(b.date||'').localeCompare(a.date||'')),latest=all[0],fallback=requests.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0],replyRequestId=latest?.requestId||fallback?.id||requestIds[0];
  return [{id:'amc-client-thread',kind:'client',clientKey:'amc',name:'AMC',service:requestIds.length>1?requestIds.length+' proyectos · historial completo':'Historial con AMC',unread:requestIds.reduce((sum,id)=>sum+(chatUnread[id]||0),0),last:latest?.text||(latest?.photos?.length?'Foto':'Sin mensajes'),date:latest?.date||fallback?.date||'',requestIds,replyRequestId}];
 }
 const grouped=new Map();
 for(const request of requests){
  const clientKey=requestClientKey(request),profile=agendaClients.find(item=>item.id===clientKey),latest=latestMessageFor(request.id,messages),activityDate=latest?.date||request.date||'',current=grouped.get(clientKey);
  if(!current){
   grouped.set(clientKey,{id:clientKey,kind:'client',clientKey,name:profile?.name||request.name||'Cliente',service:request.service||'Proyecto',unread:chatUnread[request.id]||0,last:latest?.text||(latest?.photos?.length?'Foto':'Sin mensajes'),date:activityDate,requestIds:[request.id],replyRequestId:request.id,conversations:1});
   continue;
  }
  current.requestIds.push(request.id);current.unread+=chatUnread[request.id]||0;current.conversations++;
  if(activityDate>(current.date||'')){current.service=request.service||'Proyecto';current.last=latest?.text||(latest?.photos?.length?'Foto':'Sin mensajes');current.date=activityDate;current.replyRequestId=request.id;}
 }
 return [...grouped.values()].map(contact=>({...contact,service:contact.conversations>1?contact.conversations+' proyectos · '+contact.service:contact.service}));
}

export function contactForRequest(contacts=[],requestId=''){
 return contacts.find(contact=>(contact.requestIds||[]).includes(requestId))||null;
}

export function messagesForContact(contact,messages=[]){
 const ids=new Set(contact?.requestIds||[]);
 return messages.filter(message=>ids.has(message.requestId)).sort((a,b)=>(a.date||'').localeCompare(b.date||'')||(a.id||'').localeCompare(b.id||''));
}
