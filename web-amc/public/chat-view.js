let thread='',top=0,follow=true,force=true,resize;
export const chatViewport={
 open(){force=true;},
 capture(id){const log=document.querySelector('.message-log');if(log&&thread===id){top=log.scrollTop;follow=log.scrollHeight-log.clientHeight-top<90;}},
 mount(page,id){resize?.disconnect();if(page!=='mensajes'){force=true;return;}const log=document.querySelector('.message-log');if(!log)return;const opening=force||thread!==id;thread=id;force=false;if(opening)follow=true;
  const bottom=()=>{if(follow)log.scrollTop=log.scrollHeight;};
  log.scrollTop=follow?log.scrollHeight:top;
  log.addEventListener('scroll',()=>{top=log.scrollTop;follow=log.scrollHeight-log.clientHeight-top<90;},{passive:true});
  log.querySelectorAll('img').forEach(img=>img.addEventListener('load',bottom,{once:true}));
  resize=new ResizeObserver(bottom);resize.observe(log);requestAnimationFrame(()=>{bottom();if(opening)log.scrollIntoView({block:'center'});});
 }
};
const previewUrls=new WeakMap();
export function previewChatPhotos(input){
 (previewUrls.get(input)||[]).forEach(URL.revokeObjectURL);const urls=[];previewUrls.set(input,urls);input.parentElement.querySelector('.chat-photo-preview')?.remove();
 const preview=document.createElement('div');preview.className='chat-photo-preview';preview.setAttribute('aria-live','polite');
 const files=[...input.files];if(files.length>4){preview.textContent='Elegí hasta cuatro fotos por mensaje.';input.value='';}else files.forEach((file,index)=>{const item=document.createElement('span'),img=document.createElement('img'),remove=document.createElement('button');img.src=URL.createObjectURL(file);urls.push(img.src);img.alt='Foto adjunta '+(index+1);remove.type='button';remove.textContent='Quitar';remove.onclick=()=>{const transfer=new DataTransfer();files.filter((_,i)=>i!==index).forEach(f=>transfer.items.add(f));input.files=transfer.files;previewChatPhotos(input);};item.append(img,remove);preview.append(item);});
 input.parentElement.append(preview);
}
const style=document.createElement('style');style.textContent='.conversation{max-width:850px;margin-inline:auto}.message-log{height:48dvh;min-height:220px;max-height:550px;overflow-y:auto;overscroll-behavior:contain;overflow-anchor:none;padding:12px;display:flex;flex-direction:column;gap:12px}.message{max-width:88%;overflow-wrap:anywhere;border-radius:16px;padding:12px 16px;background:var(--mint);align-self:flex-start}.message.mine{align-self:flex-end;background:#d8eee9}.message p{white-space:normal;margin:8px 0}.message small{display:block;font-size:11px}.message-form{padding-top:12px}.chat-photo-preview{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}.chat-photo-preview span{display:grid;gap:4px}.chat-photo-preview img{width:76px;height:76px;object-fit:cover;border-radius:8px}.chat-photo-preview button{font-size:12px;padding:6px}.message .mini-photos img{width:110px;height:95px;object-fit:cover}';document.head.append(style);
