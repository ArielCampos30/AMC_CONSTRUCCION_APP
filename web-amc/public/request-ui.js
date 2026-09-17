let requestModeSwitchBound=false;
function bindRequestModeSwitch(){
 if(requestModeSwitchBound||typeof document==='undefined')return;
 requestModeSwitchBound=true;
 document.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-request-mode]'),form=button?.closest?.('#request');
  if(!form)return;
  event.preventDefault();
  const visit=button.dataset.requestMode==='visita';
  form.dataset.type=visit?'visita':'presupuesto';
  form.querySelectorAll('[data-request-mode]').forEach(item=>{const active=item===button;item.classList.toggle('is-active',active);item.setAttribute('aria-pressed',String(active));});
  const budget=form.querySelector('[data-request-budget]'),visitPanel=form.querySelector('[data-request-visit]');
  if(budget){budget.hidden=visit;budget.querySelectorAll('input,select,textarea').forEach(input=>input.disabled=visit);}
  if(visitPanel){visitPanel.hidden=!visit;visitPanel.querySelectorAll('input,select,textarea').forEach(input=>input.disabled=!visit);}
  const title=document.querySelector('.page-heading h1');if(title)title.textContent=visit?'Solicitar una visita':'Solicitar trabajo';
 });
}

export function createRequestUI({getState,getSelectedPost,isAdmin,auth,heading,field,options,esc,empty,today=()=>new Date().toLocaleDateString('en-CA')}){
 bindRequestModeSwitch();
 function render(visit=false){
  const state=getState(),user=state.user;
  if(!user)return auth();
  if(isAdmin())return empty('Esta es tu cuenta de AMC','Para probar un pedido, ingresá con una cuenta de cliente en otra sesión de Chrome.');
  const catalog=state.serviceCatalog||Object.fromEntries((state.services||[]).map(service=>[service,[service]])),
   selectedPost=getSelectedPost(),
   selected=state.posts.find(post=>post.id===selectedPost)?.service,
   mode=visit?'visita':'presupuesto',
   idempotencyKey=globalThis.crypto?.randomUUID?.()||('request-'+Date.now()+'-'+Math.random().toString(36).slice(2));
  return heading('CONTANOS TU IDEA',visit?'Solicitar una visita':'Solicitar trabajo')+`<form id="request" class="panel reader" data-type="${mode}"><input type="hidden" name="idempotencyKey" value="${esc(idempotencyKey)}"><nav class="request-mode-switch" aria-label="Tipo de solicitud"><button type="button" data-request-mode="presupuesto" class="request-mode-option ${visit?'':'is-active'}" aria-pressed="${visit?'false':'true'}">Presupuesto</button><button type="button" data-request-mode="visita" class="request-mode-option ${visit?'is-active':''}" aria-pressed="${visit?'true':'false'}">Visita</button></nav>${selectedPost?`<p>Inspirado en: <strong>${esc(state.posts.find(post=>post.id===selectedPost)?.title)}</strong></p>`:''}<div class="form-grid">${field('Nombre completo','name','text',user.name)}${field('Teléfono','phone','tel',user.phone)}${field('Localidad','town','text',user.town)}</div>${field('Dirección del trabajo','address','text',user.address||'',false)}<fieldset class="service-catalog"><legend>Elegí uno o varios servicios</legend>${Object.entries(catalog).map(([rubric,items])=>`<section><h3>${esc(rubric)}</h3>${items.map(item=>`<label><input type="checkbox" name="services" value="${esc(item)}" ${item===selected?'checked':''}> ${esc(item)}</label>`).join('')}</section>`).join('')}</fieldset><label>Descripción libre<textarea name="description" required rows="4" maxlength="4000"></textarea></label><div data-request-budget ${visit?'hidden':''}><label>Medidas aproximadas (opcional)<input name="dimensions" type="text" ${visit?'disabled':''}></label></div><div data-request-visit ${visit?'':'hidden'}><div class="form-grid"><label>Día preferido<input name="day" type="date" min="${today()}" required ${visit?'':'disabled'}></label><label>Horario<select name="slot" ${visit?'':'disabled'}>${options(['Mañana · 9 a 12','Tarde · 14 a 18'])}</select></label></div><p class="muted">Confirmaremos la dirección indicada arriba.</p><p class="muted">AMC debe confirmar la disponibilidad.</p></div><div class="client-photo-actions"><label>Elegir de galería<input type="file" name="photos" accept="image/*" multiple></label><label>Sacar foto<input type="file" name="camera" accept="image/*" capture="environment"></label></div><div class="mini-photos" id="previews"></div><button type="submit" class="primary full">Enviar solicitud</button></form>`;
 }
 return {render};
}
