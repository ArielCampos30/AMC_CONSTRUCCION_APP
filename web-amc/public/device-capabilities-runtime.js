const NOTIFICATION_SNOOZE_KEY='amc-notification-onboarding-snooze-until';
const NOTIFICATION_SNOOZE_MS=7*24*60*60*1000;
const NOTIFICATION_ENABLE_RETRY_MS=24*60*60*1000;
let notificationDialog=null,cameraDialog=null;

const roleFromBody=body=>body?.classList?.contains('admin-v3')?'admin':body?.classList?.contains('employee-v4')?'employee':body?.classList?.contains('client-v5')?'client':'';

export function shouldOfferNotificationOnboarding({role='',deviceId='',nativeEnabled=false,permission='default',snoozeUntil=0,now=Date.now(),supported=true}={}){
 if(!['admin','employee','client'].includes(role)||deviceId||nativeEnabled||!supported)return false;
 if(permission==='denied')return false;
 return Number(snoozeUntil||0)<=Number(now||0);
}

export function holdFloatingChatOpen(documentRef=document){
 const chat=documentRef?.getElementById?.('amc-chat-dialog');
 if(!chat?.open||typeof chat.close!=='function')return ()=>{};
 const hadOwnClose=Object.prototype.hasOwnProperty.call(chat,'close'),originalClose=chat.close;
 chat.close=()=>{};
 return ()=>{if(hadOwnClose)chat.close=originalClose;else delete chat.close;};
}

const stopStream=stream=>stream?.getTracks?.().forEach(track=>track.stop());
const cameraErrorMessage=error=>{
 if(error?.name==='NotAllowedError'||error?.name==='SecurityError')return 'No se habilitó la cámara. Podés permitirla desde los permisos del navegador o usar Adjuntar foto.';
 if(error?.name==='NotFoundError'||error?.name==='DevicesNotFoundError')return 'No encontramos una cámara disponible en este dispositivo.';
 if(error?.name==='NotReadableError'||error?.name==='TrackStartError')return 'La cámara está siendo usada por otra aplicación. Cerrala y volvé a intentar.';
 return 'No pudimos abrir la cámara. Podés usar Adjuntar foto como alternativa.';
};

const installStyles=()=>{
 if(document.getElementById('amc-device-capabilities-style'))return;
 const style=document.createElement('style');style.id='amc-device-capabilities-style';style.textContent=`
.amc-device-dialog{border:0;border-radius:20px;padding:0;max-width:calc(100vw - 32px);background:#fff;color:#153c35;box-shadow:0 18px 55px #001f1b55}.amc-device-dialog::backdrop{background:#062d2a99}.amc-notification-dialog{width:min(430px,calc(100vw - 32px))}.amc-device-dialog-card{padding:22px;display:grid;gap:14px}.amc-device-dialog-card h2,.amc-device-dialog-card p{margin:0}.amc-device-dialog-card p{line-height:1.5;color:#4f6f68}.amc-device-dialog-actions{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}.amc-device-dialog-actions button{min-height:44px}.amc-camera-dialog{width:min(760px,calc(100vw - 24px));background:#071b19;color:#fff}.amc-camera-shell{display:grid;gap:12px;padding:14px}.amc-camera-stage{position:relative;min-height:260px;display:grid;place-items:center;overflow:hidden;border-radius:14px;background:#020b0a}.amc-camera-stage video,.amc-camera-stage img{display:block;width:100%;max-height:70dvh;object-fit:contain;background:#000}.amc-camera-toolbar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}.amc-camera-toolbar button{min-height:44px}.amc-camera-error{margin:0;text-align:center;color:#ffe1dc}.amc-camera-hidden{display:none!important}@media(max-width:600px){.amc-camera-dialog{max-width:100vw;width:100vw;height:100dvh;max-height:100dvh;border-radius:0}.amc-camera-shell{height:100%;box-sizing:border-box;grid-template-rows:1fr auto}.amc-camera-stage{min-height:0}.amc-camera-stage video,.amc-camera-stage img{max-height:calc(100dvh - 90px)}}`;
 document.head.append(style);
};

export async function capturePhotoFromWebCamera({documentRef=document,navigatorRef=navigator}={}){
 const media=navigatorRef?.mediaDevices;
 if(!media?.getUserMedia)throw Error('Este navegador no permite usar la cámara directamente.');
 installStyles();
 if(cameraDialog){try{cameraDialog.close();}catch{}cameraDialog.remove();cameraDialog=null;}
 const restoreFloatingChat=holdFloatingChatOpen(documentRef);
 const dialog=documentRef.createElement('dialog');dialog.className='amc-device-dialog amc-camera-dialog';dialog.setAttribute('aria-label','Cámara AMC');
 const shell=documentRef.createElement('div');shell.className='amc-camera-shell';
 const stage=documentRef.createElement('div');stage.className='amc-camera-stage';
 const video=documentRef.createElement('video');video.autoplay=true;video.playsInline=true;video.muted=true;
 const preview=documentRef.createElement('img');preview.alt='Foto capturada';preview.className='amc-camera-hidden';
 const errorText=documentRef.createElement('p');errorText.className='amc-camera-error amc-camera-hidden';
 stage.append(video,preview,errorText);
 const toolbar=documentRef.createElement('div');toolbar.className='amc-camera-toolbar';
 const cancel=documentRef.createElement('button');cancel.type='button';cancel.className='outline';cancel.textContent='Cancelar';
 const switchCamera=documentRef.createElement('button');switchCamera.type='button';switchCamera.className='outline';switchCamera.textContent='Cambiar cámara';switchCamera.hidden=true;
 const capture=documentRef.createElement('button');capture.type='button';capture.className='primary';capture.textContent='Capturar foto';
 const retry=documentRef.createElement('button');retry.type='button';retry.className='outline amc-camera-hidden';retry.textContent='Repetir';
 const use=documentRef.createElement('button');use.type='button';use.className='primary amc-camera-hidden';use.textContent='Usar foto';
 toolbar.append(cancel,switchCamera,capture,retry,use);shell.append(stage,toolbar);dialog.append(shell);documentRef.body.append(dialog);cameraDialog=dialog;
 let stream=null,devices=[],deviceIndex=-1,photoFile=null,previewUrl='';
 const cleanup=()=>{stopStream(stream);stream=null;if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl='';dialog.remove();restoreFloatingChat();if(cameraDialog===dialog)cameraDialog=null;};
 const constraintsFor=deviceId=>({audio:false,video:deviceId?{deviceId:{exact:deviceId}}:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}}});
 const start=async deviceId=>{
  stopStream(stream);stream=null;errorText.classList.add('amc-camera-hidden');video.classList.remove('amc-camera-hidden');preview.classList.add('amc-camera-hidden');
  stream=await media.getUserMedia(constraintsFor(deviceId));video.srcObject=stream;await video.play();
  try{devices=(await media.enumerateDevices()).filter(item=>item.kind==='videoinput');const active=stream.getVideoTracks?.()[0]?.getSettings?.().deviceId;if(active){const found=devices.findIndex(item=>item.deviceId===active);if(found>=0)deviceIndex=found;}switchCamera.hidden=devices.length<2;}catch{devices=[];switchCamera.hidden=true;}
 };
 return new Promise(async(resolve,reject)=>{
  const finish=value=>{try{if(dialog.open)dialog.close();}catch{}cleanup();resolve(value);};
  cancel.onclick=()=>finish(null);dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);},{once:true});
  switchCamera.onclick=async()=>{if(devices.length<2)return;switchCamera.disabled=true;try{deviceIndex=(deviceIndex+1+devices.length)%devices.length;await start(devices[deviceIndex].deviceId);}catch(error){errorText.textContent=cameraErrorMessage(error);errorText.classList.remove('amc-camera-hidden');}finally{switchCamera.disabled=false;}};
  capture.onclick=async()=>{const width=video.videoWidth||1280,height=video.videoHeight||720;if(!width||!height)return;const canvas=documentRef.createElement('canvas');canvas.width=width;canvas.height=height;canvas.getContext('2d',{alpha:false}).drawImage(video,0,0,width,height);const blob=await new Promise(done=>canvas.toBlob(done,'image/jpeg',.9));if(!blob){errorText.textContent='No pudimos capturar la foto. Volvé a intentar.';errorText.classList.remove('amc-camera-hidden');return;}photoFile=new File([blob],`foto-amc-${Date.now()}.jpg`,{type:'image/jpeg',lastModified:Date.now()});previewUrl=URL.createObjectURL(blob);preview.src=previewUrl;preview.classList.remove('amc-camera-hidden');video.classList.add('amc-camera-hidden');capture.classList.add('amc-camera-hidden');switchCamera.classList.add('amc-camera-hidden');retry.classList.remove('amc-camera-hidden');use.classList.remove('amc-camera-hidden');};
  retry.onclick=()=>{photoFile=null;if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl='';preview.removeAttribute('src');preview.classList.add('amc-camera-hidden');video.classList.remove('amc-camera-hidden');capture.classList.remove('amc-camera-hidden');switchCamera.classList.toggle('amc-camera-hidden',devices.length<2);retry.classList.add('amc-camera-hidden');use.classList.add('amc-camera-hidden');};
  use.onclick=()=>finish(photoFile);
  try{dialog.showModal();await start();}catch(error){cleanup();reject(Error(cameraErrorMessage(error)));}
 });
}

const setChatStatus=(form,text)=>{let status=form?.querySelector('.chat-send-status');if(!status&&form){status=document.createElement('p');status.className='chat-send-status';status.setAttribute('role','status');form.append(status);}if(status)status.textContent=text;};

async function handleWebCameraClick(event){
 const button=event.target?.closest?.('.chat-attach-menu .chat-attach-photo');
 if(!button||!String(button.textContent||'').includes('Sacar foto')||window.AMCNative)return;
 if(!navigator.mediaDevices?.getUserMedia)return;
 const form=button.closest('form'),fileInput=form?.querySelector('input[type="file"]:not([capture])');
 if(!form||!fileInput)return;
 event.preventDefault();event.stopImmediatePropagation();
 const menu=button.closest('.chat-attach-menu');if(menu)menu.hidden=true;form.querySelector('[aria-expanded="true"]')?.setAttribute('aria-expanded','false');
 const existing=[...fileInput.files];if(existing.length>=4){setChatStatus(form,'Podés adjuntar hasta cuatro fotos. Quitá una para agregar otra.');return;}
 try{
  const captured=await capturePhotoFromWebCamera();if(!captured)return;
  const transfer=new DataTransfer();[...existing,captured].slice(0,4).forEach(file=>transfer.items.add(file));fileInput.files=transfer.files;fileInput.dispatchEvent(new Event('change',{bubbles:true}));setChatStatus(form,'');
 }catch(error){setChatStatus(form,error.message||'No pudimos abrir la cámara.');}
}

function notificationSupport(){return !!window.AMCNative||('Notification'in window&&'serviceWorker'in navigator&&'PushManager'in window);}
function notificationPermission(){return 'Notification'in window?Notification.permission:'default';}
function snoozeNotifications(ms){localStorage.setItem(NOTIFICATION_SNOOZE_KEY,String(Date.now()+ms));}

function closeNotificationDialog(){if(!notificationDialog)return;try{if(notificationDialog.open)notificationDialog.close();}catch{}notificationDialog.remove();notificationDialog=null;}

function showNotificationOnboarding(){
 if(notificationDialog||!roleFromBody(document.body))return;
 const supported=notificationSupport(),nativeEnabled=!!window.AMCNative&&localStorage.getItem('amc-push-enabled')==='1';
 if(!shouldOfferNotificationOnboarding({role:roleFromBody(document.body),deviceId:localStorage.getItem('amc-device-id')||'',nativeEnabled,permission:notificationPermission(),snoozeUntil:Number(localStorage.getItem(NOTIFICATION_SNOOZE_KEY)||0),supported}))return;
 installStyles();const dialog=document.createElement('dialog');dialog.className='amc-device-dialog amc-notification-dialog';dialog.setAttribute('aria-label','Activar notificaciones de AMC');
 const card=document.createElement('div');card.className='amc-device-dialog-card';card.innerHTML='<h2>¿Activar notificaciones?</h2><p>Permití que AMC te avise cuando haya mensajes, presupuestos, cambios de obra o novedades importantes en este dispositivo.</p>';
 const actions=document.createElement('div');actions.className='amc-device-dialog-actions';
 const later=document.createElement('button');later.type='button';later.className='outline';later.textContent='Ahora no';later.onclick=()=>{snoozeNotifications(NOTIFICATION_SNOOZE_MS);closeNotificationDialog();};
 const enable=document.createElement('button');enable.type='button';enable.className='primary';enable.dataset.action='enable-push';enable.textContent='Habilitar notificaciones';enable.onclick=()=>{snoozeNotifications(NOTIFICATION_ENABLE_RETRY_MS);setTimeout(closeNotificationDialog,0);};
 actions.append(later,enable);card.append(actions);dialog.append(card);document.body.append(dialog);notificationDialog=dialog;dialog.addEventListener('cancel',event=>{event.preventDefault();snoozeNotifications(NOTIFICATION_SNOOZE_MS);closeNotificationDialog();},{once:true});dialog.showModal();
}

function scheduleNotificationOnboarding(){setTimeout(showNotificationOnboarding,650);}

document.addEventListener('click',handleWebCameraClick,true);
const observer=new MutationObserver(()=>scheduleNotificationOnboarding());observer.observe(document.body,{attributes:true,attributeFilter:['class']});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scheduleNotificationOnboarding,{once:true});else scheduleNotificationOnboarding();
