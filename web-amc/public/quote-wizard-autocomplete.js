const OVERLAY_ID='quote-tariff-overlay';
let activeInput=null;

function overlay(){
 let node=document.getElementById(OVERLAY_ID);
 if(node)return node;
 node=document.createElement('div');
 node.id=OVERLAY_ID;
 node.className='quote-tariff-overlay';
 node.hidden=true;
 node.setAttribute('role','listbox');
 document.body.appendChild(node);
 return node;
}

function closeOverlay(){const node=document.getElementById(OVERLAY_ID);if(node)node.hidden=true;activeInput=null;}

function liveSource(input){
 const workId=input?.dataset?.qwWorkId;if(!workId)return null;
 return document.querySelector(`[data-qw-live-tariffs="${CSS.escape(workId)}"] .quote-tariff-results`);
}

function buildOption(sourceButton){
 const button=document.createElement('button');
 button.type='button';
 button.setAttribute('role','option');
 button.dataset.qwSelectTariff=sourceButton.dataset.qwSelectTariff||'';
 button.dataset.qwTariffWork=sourceButton.dataset.qwTariffWork||'';
 const strong=document.createElement('strong');
 strong.textContent=sourceButton.querySelector('strong')?.textContent||'Trabajo';
 const meta=document.createElement('span');
 meta.textContent=sourceButton.querySelector('span')?.textContent||'';
 button.append(strong,meta);
 return button;
}

function fitCount(input,total){
 const rect=input.getBoundingClientRect(),below=window.innerHeight-rect.bottom-12,above=rect.top-12,best=Math.max(below,above);
 const perOption=52,padding=16;
 return Math.max(1,Math.min(total,5,Math.floor(Math.max(60,best-padding)/perOption)));
}

function positionOverlay(input,node){
 const rect=input.getBoundingClientRect();
 const width=Math.min(Math.max(rect.width,320),window.innerWidth-16);
 node.style.width=`${width}px`;
 node.style.left=`${Math.max(8,Math.min(rect.left,window.innerWidth-width-8))}px`;
 node.style.top='0px';
 node.style.visibility='hidden';
 node.hidden=false;
 const height=node.getBoundingClientRect().height;
 const below=window.innerHeight-rect.bottom-8,above=rect.top-8;
 const openBelow=below>=height||below>=above;
 const top=openBelow?Math.min(window.innerHeight-height-8,rect.bottom+6):Math.max(8,rect.top-height-6);
 node.style.top=`${top}px`;
 node.style.visibility='visible';
}

function syncOverlay(input){
 if(!input?.isConnected||!document.querySelector('.quote-wizard-host')){closeOverlay();return;}
 const source=liveSource(input),buttons=[...(source?.querySelectorAll('button[data-qw-select-tariff]')||[])];
 if(!buttons.length){closeOverlay();return;}
 activeInput=input;
 const node=overlay();
 node.replaceChildren(...buttons.slice(0,fitCount(input,buttons.length)).map(buildOption));
 positionOverlay(input,node);
}

function scheduleSync(input){queueMicrotask(()=>syncOverlay(input));}

document.documentElement.classList.add('quote-tariff-overlay-ready');

document.addEventListener('input',event=>{
 const input=event.target.closest?.('[data-qw-work-input][data-qw-key="description"]');
 if(input)scheduleSync(input);
});

document.addEventListener('focusin',event=>{
 const input=event.target.closest?.('[data-qw-work-input][data-qw-key="description"]');
 if(input)scheduleSync(input);
});

document.addEventListener('click',event=>{
 const option=event.target.closest?.(`#${OVERLAY_ID} button[data-qw-select-tariff]`);
 if(option){queueMicrotask(closeOverlay);return;}
 const input=event.target.closest?.('[data-qw-work-input][data-qw-key="description"]');
 if(input){scheduleSync(input);return;}
 if(!event.target.closest?.(`#${OVERLAY_ID}`))closeOverlay();
});

document.addEventListener('keydown',event=>{if(event.key==='Escape')closeOverlay();});
window.addEventListener('resize',()=>{if(activeInput)scheduleSync(activeInput);});
document.addEventListener('scroll',event=>{if(event.target?.closest?.('.quote-builder-summary'))return;if(activeInput)scheduleSync(activeInput);},true);

new MutationObserver(()=>{if(activeInput&&!activeInput.isConnected)closeOverlay();}).observe(document.body,{childList:true,subtree:true});
