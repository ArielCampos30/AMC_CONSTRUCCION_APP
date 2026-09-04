// Once per tab session; respects reduced-motion preferences and never blocks loading.
let show=true;
try{show=!sessionStorage.getItem('amc-welcome-v1');sessionStorage.setItem('amc-welcome-v1','1');}catch{}
if(show){
 const intro=document.createElement('div');intro.className='amc-intro';intro.setAttribute('aria-hidden','true');
 intro.innerHTML='<div class="intro-mark"><img src="/assets/amc-logo.webp" alt=""><div class="intro-line"></div><strong>CONSTRUCCIONES Y ARREGLOS</strong><span>Tu casa, en buenas manos.</span></div>';
 document.body.append(intro);
 // Short original three-note signature; never delay the presentation for audio.
 let audio,played=false;
 const play=async()=>{if(played||!intro.isConnected||document.hidden)return;try{
  const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
  audio ||= new Audio();if(audio.state==='suspended')await audio.resume();
  if(played||!intro.isConnected||audio.state!=='running')return;played=true;
  const start=audio.currentTime;
  [523.25,659.25,783.99].forEach((frequency,i)=>{const tone=audio.createOscillator(),gain=audio.createGain(),at=start+i*.16;tone.type='sine';tone.frequency.value=frequency;gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.12,at+.025);gain.gain.exponentialRampToValueAtTime(.001,at+.30);tone.connect(gain);gain.connect(audio.destination);tone.start(at);tone.stop(at+.32);});
 }catch{}};
 play();intro.addEventListener('pointerdown',play,{once:true});
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const close=()=>{intro.classList.add('leaving');setTimeout(()=>{intro.remove();audio?.close().catch(()=>{});},reduced?0:350);};
 setTimeout(close,reduced?200:1500);
 window.addEventListener('keydown',close,{once:true});intro.addEventListener('click',close,{once:true});
}

