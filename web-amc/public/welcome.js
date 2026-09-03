// Once per tab session; respects reduced-motion preferences and never blocks loading.
let show=true;
try{show=!sessionStorage.getItem('amc-welcome-v1');sessionStorage.setItem('amc-welcome-v1','1');}catch{}
if(show){
 const intro=document.createElement('div');intro.className='amc-intro';intro.setAttribute('aria-hidden','true');
 intro.innerHTML='<div class="intro-mark"><img src="/assets/amc-logo.webp" alt=""><div class="intro-line"></div><strong>CONSTRUCCIONES Y ARREGLOS</strong><span>Tu casa, en buenas manos.</span></div>';
 document.body.append(intro);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const close=()=>{intro.classList.add('leaving');setTimeout(()=>intro.remove(),reduced?0:350);};
 setTimeout(close,reduced?200:1500);
 window.addEventListener('keydown',close,{once:true});intro.addEventListener('click',close,{once:true});
}
