const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
const standalone=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
if(ios&&!standalone&&!localStorage.getItem('amc-ios-install-dismissed')){
 const box=document.createElement('aside');box.className='ios-install';box.setAttribute('role','status');
 box.innerHTML='<button type="button" aria-label="Cerrar ayuda">×</button><strong>Instalar AMC en tu iPhone</strong><span>1. Abrí AMC en Safari. 2. Tocá Compartir. 3. Elegí Agregar a pantalla de inicio.</span>';
 box.querySelector('button').addEventListener('click',()=>{localStorage.setItem('amc-ios-install-dismissed','1');box.remove();});document.body.append(box);
}
