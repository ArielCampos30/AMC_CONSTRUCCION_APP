const clientIdOf=message=>message.clientId||message.userId||'';

export function buildClientContacts({clients=[],messages=[],clientChatUnread={},admin=false,self=null}){
 if(admin){
  return clients.map(client=>{
   const rows=messages.filter(message=>clientIdOf(message)===client.id).sort((a,b)=>(b.date||'').localeCompare(a.date||'')),latest=rows[0];
   return {id:client.id,kind:'client',name:client.name||client.email||'Cliente',service:'Chat permanente',unread:clientChatUnread[client.id]||0,last:latest?.text||(latest?.photos?.length?'Foto':'Sin mensajes'),date:latest?.date||''};
  });
 }
 if(!self?.id)return [];
 const rows=messages.filter(message=>clientIdOf(message)===self.id).sort((a,b)=>(b.date||'').localeCompare(a.date||'')),latest=rows[0];
 return [{id:self.id,kind:'client',name:'AMC',service:'Chat permanente',unread:clientChatUnread[self.id]||0,last:latest?.text||(latest?.photos?.length?'Foto':'Sin mensajes'),date:latest?.date||''}];
}

export function contactForReference({contacts=[],reference='',requests=[],self=null}){
 if(!reference)return self?.id?contacts.find(contact=>contact.id===self.id)||null:null;
 const direct=contacts.find(contact=>contact.id===reference);if(direct)return direct;
 const request=requests.find(item=>item.id===reference),clientId=request?.userId;
 return clientId?contacts.find(contact=>contact.id===clientId)||null:null;
}

export function messagesForContact(contact,messages=[]){
 if(!contact?.id)return [];
 return messages.filter(message=>clientIdOf(message)===contact.id).sort((a,b)=>(a.date||'').localeCompare(b.date||'')||(a.id||'').localeCompare(b.id||''));
}
