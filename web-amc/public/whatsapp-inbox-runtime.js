const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const currentRoute=()=>String(globalThis.location?.hash||'').replace(/^#/,'').split('?')[0];
const isCommercial=()=>currentRoute()==='comercial'||currentRoute().startsWith('comercial/');
const formatDate=value=>{if(!value)return '';const date=new Date(value);return Number.isNaN(date.getTime())?'':new Intl.DateTimeFormat('es-AR',{dateStyle:'short',timeStyle:'short'}).format(date);};
const displayPhone=value=>String(value||'').replace(/\D/g,'');
let loading=false,lastLoadedAt=0,data=null;

function statusModel(whatsapp){
 if(!whatsapp?.configured)return {label:'Configuración Meta pendiente',tone:'pending',detail:'La bandeja ya está preparada, pero faltan las credenciales seguras de Meta en el servidor.'};
 if(!whatsapp.verifiedAt)return {label:'Listo para verificar en Meta',tone:'pending',detail:'Las credenciales están cargadas. Falta completar la verificación del webhook desde Meta.'};
 if(!whatsapp.lastEventAt)return {label:'Webhook verificado',tone:'ready',detail:'Meta verificó el endpoint. AMC está esperando el primer mensaje real.'};
 return {label:'Recibiendo mensajes',tone:'live',detail:'Último evento recibido: '+formatDate(whatsapp.lastEventAt)};
}
function conversationHtml(conversation){
 const title=conversation.name||displayPhone(conversation.phone)||conversation.remoteId||'Contacto de WhatsApp';
 const linked=conversation.requestId?`<a href="#solicitud/${encodeURIComponent(conversation.requestId)}">Vinculada a ${esc(conversation.requestName||'consulta AMC')} →</a>`:'<span class="wa-unlinked">Sin consulta AMC vinculada</span>';
 const messages=(conversation.messages||[]).slice().reverse().map(message=>`<li><span>${esc(message.text||message.type||'Mensaje')}</span><time>${esc(formatDate(message.messageAt))}</time></li>`).join('');
 return `<details class="wa-inbox-conversation"><summary><span><strong>${esc(title)}</strong><small>${esc(displayPhone(conversation.phone)||conversation.remoteId||'Identificador Meta')}</small></span><span class="wa-inbox-preview">${esc(conversation.lastText||conversation.lastType||'Mensaje recibido')}</span><time>${esc(formatDate(conversation.lastMessageAt))}</time></summary><div class="wa-inbox-link">${linked}</div>${messages?`<ol>${messages}</ol>`:'<p class="muted">Sin mensajes para mostrar.</p>'}</details>`;
}
function panelHtml(){
 const whatsapp=data?.whatsapp||null,status=statusModel(whatsapp),conversations=whatsapp?.conversations||[],callback=globalThis.location?.origin?globalThis.location.origin+(whatsapp?.callbackPath||'/api/webhooks/whatsapp'):'';
 return `<div class="title-row"><div><h2>WhatsApp Business</h2><p class="muted">Bandeja oficial de Meta · sólo Admin · respuestas automáticas desactivadas en D.5A.</p></div><span class="wa-meta-status" data-tone="${esc(status.tone)}">${esc(status.label)}</span></div><p>${esc(status.detail)}</p>${callback?`<p class="wa-callback"><strong>Webhook:</strong> <code>${esc(callback)}</code></p>`:''}<div class="wa-inbox-list">${conversations.length?conversations.map(conversationHtml).join(''):'<p class="muted">Todavía no hay conversaciones recibidas desde Meta.</p>'}</div>`;
}
function ensurePanel(){
 if(!isCommercial())return null;
 const content=document.getElementById('contenido');if(!content)return null;
 let panel=document.getElementById('commercial-whatsapp-inbox');
 if(!panel){panel=document.createElement('section');panel.id='commercial-whatsapp-inbox';panel.className='panel commercial-whatsapp-inbox';const followup=content.querySelector('.commercial-followup');if(followup)followup.before(panel);else content.append(panel);}
 panel.innerHTML=data?panelHtml():'<div class="title-row"><h2>WhatsApp Business</h2><span class="wa-meta-status" data-tone="pending">Cargando…</span></div><p class="muted">Consultando la bandeja oficial de Meta.</p>';
 return panel;
}
async function load({force=false}={}){
 if(!isCommercial()||loading)return;ensurePanel();
 if(!force&&data&&Date.now()-lastLoadedAt<30000)return;
 loading=true;
 try{const response=await fetch('/api/admin/whatsapp/inbox',{credentials:'same-origin'});if(!response.ok)return;data=await response.json();lastLoadedAt=Date.now();if(isCommercial())ensurePanel();}catch{}finally{loading=false;}
}
function sync(){if(!isCommercial())return;ensurePanel();queueMicrotask(()=>load());}
globalThis.addEventListener('hashchange',sync);
const observer=new MutationObserver(()=>{if(isCommercial()&&!document.getElementById('commercial-whatsapp-inbox'))sync();});
observer.observe(document.documentElement,{childList:true,subtree:true});
sync();
