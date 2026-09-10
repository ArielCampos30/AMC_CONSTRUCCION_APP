export function createDiscoveryUI({getState,isAdmin,heading,post,empty,esc}){
 const favorites=()=>{
  const state=getState();
  return heading('TUS IDEAS','Trabajos guardados')+`<div class="post-grid">${state.posts.filter(item=>state.favorites.includes(item.id)).map(post).join('')||empty('Guardá tus ideas favoritas','Tocá el corazón de una publicación.')}</div>`;
 };
 const services=()=>{
  const state=getState();
  if(isAdmin())return heading('PEDIDOS POR SERVICIO','Solicitudes de clientes')+state.services.map(service=>'<section class="panel"><h2>'+esc(service)+'</h2>'+state.requests.filter(request=>request.service===service).map(request=>'<p>'+esc(request.name)+' · '+esc(request.status)+'</p><button data-action="editor" data-id="'+request.id+'">Preparar presupuesto</button>').join('')+'</section>').join('');
  return heading('AMC','Nuestros servicios')+`<div class="service-grid">${state.services.map((service,index)=>`<section class="panel"><span class="service-number">0${index+1}</span><h2>${esc(service)}</h2><a class="inline-action" href="#pedir">Consultar →</a></section>`).join('')}</div>`;
 };
 const ideas=()=>heading('INSPIRACIÓN','Ideas para tu casa')+'<section class="panel idea"><h2>Planificá antes de renovar</h2><p>Tomá medidas, elegí fotos de referencia y contanos qué querés conservar. Un presupuesto claro empieza con una idea bien compartida.</p></section><section class="panel idea"><h2>La luz cambia los espacios</h2><p>Probá muestras de pintura a distintas horas del día y tené en cuenta la iluminación natural al elegir los colores.</p></section><section class="panel idea"><h2>Una cocina más cómoda</h2><p>Revisá las medidas de los electrodomésticos y los espacios de circulación antes de elegir muebles.</p></section><a class="inline-action" href="#pedir">Consultar mi idea</a>';
 return {favorites,services,ideas};
}
