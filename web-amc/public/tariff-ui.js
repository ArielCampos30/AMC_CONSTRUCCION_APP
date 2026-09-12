export function createTariffUI({isAdmin,heading,esc,money,api}){
 let items=[],query='',loaded=false,loading=false,error='',updatedAt='';
 const clean=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const filtered=()=>{const term=clean(query);if(!term)return items;return items.filter(item=>clean([item.rubro,item.tarea,item.unidad,item.obs].join(' ')).includes(term));};
 const ensureStyle=()=>{if(document.querySelector('link[data-tariff-ui]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href='/tariff-ui.css';link.dataset.tariffUi='1';document.head.append(link);};
 const resultsMarkup=()=>{
  if(loading&&!loaded)return '<section class="panel tariff-state"><p>Cargando Tarifario AMC…</p></section>';
  if(error)return `<section class="panel tariff-state error-box"><h2>No pudimos cargar el Tarifario</h2><p>${esc(error)}</p><button type="button" class="outline" data-tariff-retry>Reintentar</button></section>`;
  const rows=filtered();
  if(!rows.length)return '<section class="panel tariff-state"><h2>Sin coincidencias</h2><p>Probá con otro rubro, trabajo o unidad.</p></section>';
  return `<div class="tariff-results">${rows.map(item=>`<article class="panel tariff-row"><div class="tariff-main"><span class="tariff-rubro">${esc(item.rubro||'Otros')}</span><h2>${esc(item.tarea)}</h2>${item.obs?`<p>${esc(item.obs)}</p>`:''}</div><div class="tariff-unit"><span>Unidad</span><strong>${esc(item.unidad||'unidad')}</strong></div><div class="tariff-price"><span>Referencia</span><strong>${money(Number(item.precio||0))}</strong>${item.custom?'<small>Precio propio</small>':''}</div></article>`).join('')}</div>`;
 };
 const render=()=>heading('HERRAMIENTA INDEPENDIENTE','Tarifario AMC','Consulta las referencias de precio que utiliza AMC. El Cotizador puede tomar estas referencias, pero funciona como una herramienta separada.')+`<section class="panel tariff-toolbar"><label for="amc-tariff-search">Buscar en el Tarifario<input id="amc-tariff-search" type="search" value="${esc(query)}" placeholder="Ej.: revoque, pintura, m²…" autocomplete="off"></label><div class="tariff-toolbar-actions"><span id="amc-tariff-count">${loaded?filtered().length+' de '+items.length+' referencias':'Cargando referencias…'}</span><a class="inline-action" href="#cotizador">Abrir Cotizador →</a></div>${updatedAt?`<small>Última actualización registrada: ${esc(new Date(updatedAt).toLocaleString('es-AR'))}</small>`:''}</section><div id="amc-tariff-results" data-tariff-results>${resultsMarkup()}</div><a class="inline-action tariff-back" href="#mas-admin">← Volver a Más</a>`;
 const paint=()=>{const results=document.querySelector('[data-tariff-results]');if(results)results.innerHTML=resultsMarkup();const count=document.getElementById('amc-tariff-count');if(count)count.textContent=loaded?filtered().length+' de '+items.length+' referencias':'Cargando referencias…';};
 async function load(force=false){
  if(!isAdmin()||loading||(!force&&loaded))return;
  loading=true;error='';paint();
  try{const data=await api('/api/estimator-tariffs',null,'GET');items=Array.isArray(data.items)?data.items:[];updatedAt=data.updatedAt||'';loaded=true;}
  catch(err){error=err?.message||'No se pudieron obtener las referencias.';}
  finally{loading=false;paint();}
 }
 document.addEventListener('input',event=>{if(event.target?.id!=='amc-tariff-search')return;query=event.target.value;paint();event.stopImmediatePropagation();},true);
 document.addEventListener('click',event=>{const retry=event.target.closest?.('[data-tariff-retry]');if(!retry)return;event.preventDefault();load(true);});
 function afterRender(page){
  if(page!=='tarifario'||!isAdmin())return false;
  ensureStyle();
  const main=document.querySelector('.workspace>main');if(!main)return false;
  main.innerHTML=render()+'<p class="footer-note">AMC Construcciones y Arreglos</p>';
  document.querySelector('[data-nav="mas-admin"]')?.classList.add('active');
  document.querySelector('.bottom-nav a[href="#mas-admin"]')?.classList.add('active');
  load();
  return true;
 }
 return {afterRender};
}
