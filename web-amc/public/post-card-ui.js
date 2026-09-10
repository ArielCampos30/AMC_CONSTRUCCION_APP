export function createPostCardUI({getState,getBefore,isAdmin,esc,date,btn}){
 const render=p=>{
  const state=getState(),before=getBefore();
  const saved=state.favorites?.includes(p.id),showBefore=before.has(p.id);return `<article class="post"><div class="post-head"><div class="mini-logo">AMC</div><div><strong>AMC Construcciones y Arreglos</strong><small>${esc(p.town)} · ${date(p.date)}</small></div></div><div class="post-photo"><a href="${esc(showBefore?p.before:p.image)}"><img src="${esc(showBefore?p.before:p.image)}?thumb=1" alt="${esc(p.title)} · ${showBefore?'antes':'después'}" loading="lazy"></a>${p.demo?'<span class="photo-label">IMAGEN ILUSTRATIVA</span>':''}${p.before?`<div class="comparison">${btn(showBefore?'Ver después':'Ver antes','compare',`data-id="${p.id}"`,'selected')}</div>`:''}</div><div class="post-body"><div class="post-title"><span class="tag">${esc(p.service)}</span>${btn(saved?'♥':'♡','favorite',`data-id="${p.id}" aria-label="Guardar trabajo" aria-pressed="${!!saved}"`,'save '+(saved?'saved':''))}</div><h2>${esc(p.title)}</h2><p>${esc(p.description)}</p>${!isAdmin()?btn('Quiero algo así ↗','inspired',`data-id="${p.id}"`,'outline full'):''}</div></article>`;
 };
 return {render};
}
