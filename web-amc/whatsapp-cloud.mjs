import {createHmac,timingSafeEqual} from 'node:crypto';

const STATE_ID='whatsapp-meta-state';
const CALLBACK_PATH='/api/webhooks/whatsapp';
const digits=value=>String(value||'').replace(/\D/g,'');
const normalizePhone=value=>{let phone=digits(value);if(phone.startsWith('54'))phone=phone.slice(2);if(phone.startsWith('9')&&phone.length>=11)phone=phone.slice(1);if(phone.startsWith('0'))phone=phone.slice(1);if(phone.startsWith('15'))phone=phone.slice(2);return phone;};
const asIso=value=>{const seconds=Number(value);if(Number.isFinite(seconds)&&seconds>0)return new Date(seconds*1000).toISOString();return null;};
const messagePreview=message=>{
 const type=String(message?.type||'unknown');
 if(type==='text')return String(message?.text?.body||'').slice(0,4000);
 if(type==='image')return String(message?.image?.caption||'Imagen recibida').slice(0,4000);
 if(type==='video')return String(message?.video?.caption||'Video recibido').slice(0,4000);
 if(type==='document')return String(message?.document?.filename||message?.document?.caption||'Documento recibido').slice(0,4000);
 if(type==='audio')return 'Audio recibido';
 if(type==='sticker')return 'Sticker recibido';
 if(type==='location')return 'Ubicación recibida';
 if(type==='contacts')return 'Contacto recibido';
 if(type==='interactive')return String(message?.interactive?.button_reply?.title||message?.interactive?.list_reply?.title||'Respuesta interactiva').slice(0,4000);
 return 'Mensaje '+type;
};
const secureCompare=(left,right)=>{
 const a=Buffer.from(String(left||'')),b=Buffer.from(String(right||''));
 return a.length===b.length&&a.length>0&&timingSafeEqual(a,b);
};
export const validWhatsAppSignature=(raw,signature,secret)=>{
 if(!secret||!signature)return false;
 const expected='sha256='+createHmac('sha256',secret).update(raw).digest('hex');
 return secureCompare(signature,expected);
};

export function whatsappCloudFeatures({db,all,transaction,requireAdmin,readRaw,send,fail,now,sha,config={}}){
 db.exec('CREATE TABLE IF NOT EXISTS whatsapp_messages(id TEXT PRIMARY KEY,remoteId TEXT NOT NULL DEFAULT \'\',messageAt TEXT NOT NULL,receivedAt TEXT NOT NULL,body TEXT NOT NULL)');
 db.exec('CREATE INDEX IF NOT EXISTS whatsapp_messages_recent ON whatsapp_messages(messageAt)');
 db.exec('CREATE TABLE IF NOT EXISTS whatsapp_statuses(id TEXT PRIMARY KEY,statusAt TEXT NOT NULL,body TEXT NOT NULL)');
 db.exec('CREATE TABLE IF NOT EXISTS whatsapp_meta(id TEXT PRIMARY KEY,body TEXT NOT NULL)');
 const verifyToken=String(config.verifyToken||'');
 const appSecret=String(config.appSecret||'');
 const expectedPhoneNumberId=String(config.phoneNumberId||'');
 const expectedBusinessAccountId=String(config.businessAccountId||'');
 const configured=()=>Boolean(verifyToken&&appSecret);
 const state=()=>{const row=db.prepare('SELECT body FROM whatsapp_meta WHERE id=?').get(STATE_ID);return row?JSON.parse(row.body):null;};
 const saveState=patch=>{const value={id:STATE_ID,...(state()||{}),...patch,updatedAt:now()};db.prepare('INSERT INTO whatsapp_meta(id,body) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body').run(STATE_ID,JSON.stringify(value));return value;};
 const messageId=metaId=>'whatsapp-message-'+sha(String(metaId));
 const statusId=(metaId,status,timestamp)=>'whatsapp-status-'+sha([metaId,status,timestamp].join('|'));
 const contactFor=(value,remoteId)=>{
  const contacts=Array.isArray(value?.contacts)?value.contacts:[];
  return contacts.find(contact=>String(contact?.wa_id||contact?.id||'')===String(remoteId||''))||contacts[0]||{};
 };
 const saveMessage=(entry,value,message)=>{
  const metaId=String(message?.id||'');if(!metaId)return false;
  const docId=messageId(metaId);if(db.prepare('SELECT id FROM whatsapp_messages WHERE id=?').get(docId))return false;
  const contact=contactFor(value,message?.from),remoteId=String(message?.from||contact?.wa_id||contact?.id||''),phoneCandidate=String(contact?.wa_id||message?.from||'');
  const messageAt=asIso(message?.timestamp)||now(),receivedAt=now();
  const body={id:docId,metaMessageId:metaId,direction:'inbound',remoteId,phone:phoneCandidate,name:String(contact?.profile?.name||'').slice(0,160),type:String(message?.type||'unknown').slice(0,80),text:messagePreview(message),messageAt,receivedAt,phoneNumberId:String(value?.metadata?.phone_number_id||''),businessAccountId:String(entry?.id||''),status:'received',source:'meta-webhook'};
  db.prepare('INSERT INTO whatsapp_messages(id,remoteId,messageAt,receivedAt,body) VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING').run(docId,remoteId,messageAt,receivedAt,JSON.stringify(body));return true;
 };
 const saveStatus=status=>{
  const metaId=String(status?.id||'');if(!metaId)return false;
  const statusName=String(status?.status||'unknown').slice(0,80),timestamp=String(status?.timestamp||''),statusAt=asIso(timestamp)||now(),docId=statusId(metaId,statusName,timestamp);
  if(db.prepare('SELECT id FROM whatsapp_statuses WHERE id=?').get(docId))return false;
  const body={id:docId,metaMessageId:metaId,status:statusName,statusAt,recipientId:String(status?.recipient_id||''),conversationId:String(status?.conversation?.id||''),pricingCategory:String(status?.pricing?.category||''),receivedAt:now()};
  db.prepare('INSERT INTO whatsapp_statuses(id,statusAt,body) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING').run(docId,statusAt,JSON.stringify(body));
  const messageRow=db.prepare('SELECT body FROM whatsapp_messages WHERE id=?').get(messageId(metaId));
  if(messageRow){const message=JSON.parse(messageRow.body),next={...message,status:statusName,statusAt};db.prepare('UPDATE whatsapp_messages SET body=? WHERE id=?').run(JSON.stringify(next),messageId(metaId));}
  return true;
 };
 const ingest=payload=>transaction(()=>{
  if(payload?.object!=='whatsapp_business_account')return {messages:0,statuses:0};
  let messages=0,statuses=0;
  for(const entry of Array.isArray(payload.entry)?payload.entry:[]){
   if(expectedBusinessAccountId&&String(entry?.id||'')&&String(entry.id)!==expectedBusinessAccountId)continue;
   for(const change of Array.isArray(entry?.changes)?entry.changes:[]){
    if(change?.field&&change.field!=='messages')continue;
    const value=change?.value||{};
    if(expectedPhoneNumberId&&String(value?.metadata?.phone_number_id||'')&&String(value.metadata.phone_number_id)!==expectedPhoneNumberId)continue;
    for(const message of Array.isArray(value.messages)?value.messages:[])if(saveMessage(entry,value,message))messages++;
    for(const status of Array.isArray(value.statuses)?value.statuses:[])if(saveStatus(status))statuses++;
   }
  }
  saveState({lastEventAt:now(),lastObject:String(payload.object||''),lastMessageCount:messages,lastStatusCount:statuses});
  return {messages,statuses};
 });
 const publicRoute=async({req,res,p,method,url})=>{
  if(p!==CALLBACK_PATH)return false;
  if(method==='GET'){
   if(!verifyToken)fail(503,'WhatsApp todavía no está configurado.');
   const mode=url.searchParams.get('hub.mode')||'',token=url.searchParams.get('hub.verify_token')||'',challenge=url.searchParams.get('hub.challenge')||'';
   if(mode!=='subscribe'||!secureCompare(token,verifyToken))fail(403,'Verificación de webhook rechazada.');
   saveState({verifiedAt:now()});
   res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});res.end(challenge);return true;
  }
  if(method!=='POST')fail(405,'Método no permitido.');
  if(!appSecret)fail(503,'WhatsApp todavía no está configurado.');
  const raw=await readRaw(req,1024*1024),signature=String(req.headers['x-hub-signature-256']||'');
  if(!validWhatsAppSignature(raw,signature,appSecret))fail(403,'Firma de webhook inválida.');
  let payload;try{payload=JSON.parse(raw.toString()||'{}');}catch{fail(400,'Payload de webhook inválido.');}
  ingest(payload);send(res,200,{ok:true});return true;
 };
 const conversations=()=>{
  const rows=db.prepare('SELECT body FROM whatsapp_messages ORDER BY messageAt DESC LIMIT 250').all().map(row=>JSON.parse(row.body));
  const requests=all('request'),leads=all('leadClient'),leadById=new Map(leads.map(lead=>[lead.id,lead]));
  const requestFor=phone=>{const normalized=normalizePhone(phone);if(!normalized)return null;return requests.find(request=>normalizePhone(request.phone||leadById.get(request.leadId)?.phone)===normalized)||null;};
  const grouped=new Map();
  for(const message of rows){const key=message.remoteId||message.phone||message.id;if(!grouped.has(key)){const request=requestFor(message.phone);grouped.set(key,{remoteId:message.remoteId||'',phone:message.phone||'',name:message.name||request?.name||'',requestId:request?.id||null,requestName:request?.name||'',lastMessageAt:message.messageAt||message.receivedAt,lastText:message.text||'',lastType:message.type||'',messages:[]});}const conversation=grouped.get(key);if(conversation.messages.length<12)conversation.messages.push({id:message.metaMessageId||message.id,direction:message.direction,type:message.type,text:message.text,messageAt:message.messageAt,status:message.status});}
  return [...grouped.values()].slice(0,40);
 };
 const adminRoute=({p,method,user,res})=>{
  if(p!=='/api/admin/whatsapp/inbox')return false;requireAdmin(user);if(method!=='GET')fail(405,'Método no permitido.');
  const meta=state()||{};
  send(res,200,{whatsapp:{mode:'receive-only',autoReplies:false,configured:configured(),verifyTokenConfigured:Boolean(verifyToken),appSecretConfigured:Boolean(appSecret),phoneNumberIdConfigured:Boolean(expectedPhoneNumberId),businessAccountIdConfigured:Boolean(expectedBusinessAccountId),verifiedAt:meta.verifiedAt||null,lastEventAt:meta.lastEventAt||null,callbackPath:CALLBACK_PATH,conversations:conversations()}});return true;
 };
 return {publicRoute,adminRoute,configured};
}
