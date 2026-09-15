import ast
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

DRIVER="http://127.0.0.1:9515"
BASE="http://localhost:4180"
PNG_B64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1cAAAAASUVORK5CYII="

def lifecycle_credentials():
    tree=ast.parse(Path('tests/browser-lifecycle.py').read_text(encoding='utf-8'))
    values={}
    for node in tree.body:
        if isinstance(node,ast.Assign) and len(node.targets)==1 and isinstance(node.targets[0],ast.Name) and node.targets[0].id in {'EMPLOYEE_EMAIL','EMPLOYEE_PASSWORD'} and isinstance(node.value,ast.Constant): values[node.targets[0].id]=node.value.value
    if set(values)!={'EMPLOYEE_EMAIL','EMPLOYEE_PASSWORD'}: raise AssertionError('No se encontraron credenciales E2E del empleado')
    return values['EMPLOYEE_EMAIL'],values['EMPLOYEE_PASSWORD']

def call(method,path,payload=None):
    data=None if payload is None else json.dumps(payload).encode();request=urllib.request.Request(DRIVER+path,data=data,method=method,headers={"Content-Type":"application/json"})
    try:
        with urllib.request.urlopen(request,timeout=30) as response: body=json.loads(response.read().decode() or "{}")
    except urllib.error.HTTPError as exc:
        detail=exc.read().decode(errors='replace')
        raise RuntimeError(f"WebDriver {method} {path} -> HTTP {exc.code}: {detail}") from exc
    return body.get("value",body)

binary=os.environ.get("AMC_CHROME_BINARY");options={"args":["--headless=new","--no-sandbox","--disable-dev-shm-usage","--window-size=390,844"]}
if binary: options["binary"]=binary
session=call("POST","/session",{"capabilities":{"alwaysMatch":{"browserName":"chrome","goog:chromeOptions":options}}});session_id=session.get("sessionId") if isinstance(session,dict) else None
if not session_id: raise SystemExit("No se pudo iniciar Chrome: "+repr(session))
prefix="/session/"+session_id

def js(script): return call("POST",prefix+"/execute/sync",{"script":script,"args":[]})
def js_async(script,args=None):
    value=call("POST",prefix+"/execute/async",{"script":script,"args":args or []})
    if isinstance(value,dict) and value.get("__error"): raise AssertionError(value["__error"])
    return value
def go(url): call("POST",prefix+"/url",{"url":url})
def wait(script,seconds=20):
    end=time.time()+seconds;last=None
    while time.time()<end:
        try:
            last=js(script)
            if last:return last
        except Exception as exc:last=str(exc)
        time.sleep(.2)
    raise AssertionError("Tiempo agotado. Último resultado: "+repr(last))
def login(email,password):
    go(BASE+"/#ingresar");wait("return !!document.querySelector('#auth')");js("const f=document.querySelector('#auth');f.elements.email.value="+json.dumps(email)+";f.elements.password.value="+json.dumps(password)+";f.requestSubmit();return true;");wait("return document.body.classList.contains('employee-v4')")
def api(path,payload=None,method=None,expected=(200,201)):
    method=method or ("GET" if payload is None else "POST")
    script="""const done=arguments[arguments.length-1],path=arguments[0],payload=arguments[1],method=arguments[2];(async()=>{let csrf='';if(method!=='GET'&&method!=='HEAD'){const r=await fetch('/api/state',{credentials:'same-origin'});csrf=(await r.json()).csrf||'';}const init={method,credentials:'same-origin',headers:{'Content-Type':'application/json'}};if(csrf)init.headers['X-CSRF-Token']=csrf;if(payload!==null&&method!=='GET'&&method!=='HEAD')init.body=JSON.stringify(payload);const response=await fetch(path,init),raw=await response.text();let data=raw;try{data=raw?JSON.parse(raw):{};}catch{}return {status:response.status,data};})().then(done).catch(error=>done({__error:String(error&&error.message||error)}));"""
    result=js_async(script,[path,payload,method])
    if result["status"] not in expected: raise AssertionError(path+" devolvió "+str(result["status"])+": "+repr(result["data"]))
    return result["data"]

REMOTE_MESSAGE="Mensaje previo del contrato flotante"
EMPLOYEE_MESSAGE="Foto desde chat flotante E2E"
try:
    email,password=lifecycle_credentials();login(email,password)
    api('/api/staff-chat/messages',{'text':REMOTE_MESSAGE,'photos':[],'idempotencyKey':'runtime-floating-remote-001'})
    assert not js("return [...document.querySelectorAll('nav a')].some(a=>a.getAttribute('href')==='#chat-equipo'&&a.textContent.includes('Chat'))")
    go(BASE+'/#chat-equipo')
    wait("return location.hash==='#inicio-empleado'")
    wait("return !!document.querySelector('#amc-chat-dialog[open] .floating-staff-message')")
    wait("return document.querySelector('#amc-chat-dialog .message-log').innerText.includes("+json.dumps(REMOTE_MESSAGE)+")")
    assert js("return !!document.querySelector('#amc-chat-dialog .floating-staff-message input[name=photos]')")
    assert js("return !!document.querySelector('#amc-chat-dialog .floating-staff-message input[capture=environment]')")
    js("""
      const form=document.querySelector('#amc-chat-dialog .floating-staff-message'),bytes=Uint8Array.from(atob('"""+PNG_B64+"""'),c=>c.charCodeAt(0)),file=new File([bytes],'chat-e2e.png',{type:'image/png'}),dt=new DataTransfer();dt.items.add(file);form.elements.photos.files=dt.files;form.elements.photos.dispatchEvent(new Event('change',{bubbles:true}));form.elements.text.value="""+json.dumps(EMPLOYEE_MESSAGE)+""";form.requestSubmit();return true;
    """)
    wait("return document.querySelector('#amc-chat-dialog .message-log').innerText.includes("+json.dumps(EMPLOYEE_MESSAGE)+")")
    wait("return !!document.querySelector('#amc-chat-dialog .message[data-message-id] .mini-photos img[src*=\"?thumb=1\"]')",30)
    messages=api('/api/staff-chat/messages',None,'GET');sent=[m for m in messages.get('messages',[]) if m.get('text')==EMPLOYEE_MESSAGE]
    assert sent and len(sent[-1].get('photos') or [])==1,messages
    js("""window.__amcViewerFlightAdds=0;window.__amcViewerFlightObserver?.disconnect?.();window.__amcViewerFlightObserver=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1&&(node.matches?.('.amc-viewer-flight')||node.querySelector?.('.amc-viewer-flight')))window.__amcViewerFlightAdds++;});window.__amcViewerFlightObserver.observe(document.body,{childList:true,subtree:true});return true;""")
    shared_open=js_async("""const done=arguments[arguments.length-1],thumb=document.querySelector('#amc-chat-dialog .message[data-message-id] .mini-photos img');thumb.click();const started=performance.now(),timer=setInterval(()=>{if(document.querySelector('.amc-photo-viewer[open] .amc-viewer-flight')){clearInterval(timer);done(true);}else if(performance.now()-started>700){clearInterval(timer);done(false);}},10);""")
    assert shared_open,'No se observó la transición compartida miniatura→visor'
    wait("return !!document.querySelector('.amc-photo-viewer[open] .amc-viewer-stage img.amc-viewer-image')")
    time.sleep(.45)
    assert js("return window.__amcViewerFlightAdds===1"),js("return window.__amcViewerFlightAdds")
    assert js("return !!document.querySelector('.amc-photo-viewer[open] button[aria-label=\"Cerrar foto\"] svg')")
    assert js("return !!document.querySelector('.amc-photo-viewer[open] button[aria-label=\"Compartir foto\"]')")
    assert js("return !!document.querySelector('.amc-photo-viewer[open] button[aria-label=\"Guardar foto\"]')")
    responsive=js("""const dialog=document.querySelector('.amc-photo-viewer[open]'),bar=dialog.querySelector('.amc-viewer-bar'),r=dialog.getBoundingClientRect();return {width:r.width,height:r.height,top:r.top,left:r.left,viewportWidth:innerWidth,viewportHeight:innerHeight,barHeight:bar.getBoundingClientRect().height};""")
    assert responsive['width']<responsive['viewportWidth'] and responsive['height']<responsive['viewportHeight'],responsive
    assert responsive['top']>0 and responsive['left']>0,responsive
    assert responsive['barHeight']<=58,responsive
    js("""const stage=document.querySelector('.amc-photo-viewer[open] .amc-viewer-stage'),r=stage.getBoundingClientRect();stage.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true,clientX:r.left+r.width*.72,clientY:r.top+r.height*.35}));return true;""")
    wait("return document.querySelector('.amc-photo-viewer[open] .amc-viewer-image').style.transform.includes('scale(2.6)')")
    transform=js("return document.querySelector('.amc-photo-viewer[open] .amc-viewer-image').style.transform")
    assert 'translate3d(0px,0px,0)' not in transform,transform
    assert js("return !!document.querySelector('.amc-photo-viewer[open] button[aria-label=\"Cerrar foto\"]')")
    pointer_result=js("""const button=document.querySelector('.amc-photo-viewer[open] button[aria-label=\"Cerrar foto\"]'),r=button.getBoundingClientRect();button.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2}));return {chatOpen:!!document.querySelector('#amc-chat-dialog[open] .floating-staff-message'),viewerOpen:!!document.querySelector('.amc-photo-viewer[open]')};""")
    assert pointer_result['chatOpen'] and pointer_result['viewerOpen'],pointer_result
    js("document.querySelector('.amc-photo-viewer[open] button[aria-label=\"Cerrar foto\"]').click();return true;")
    wait("return window.__amcViewerFlightAdds>=2",3)
    wait("return !document.querySelector('.amc-photo-viewer[open]')",3)
    assert js("return !!document.querySelector('#amc-chat-dialog[open] .floating-staff-message')"),'Cerrar la foto no debe cerrar el chat flotante'
    assert js("return window.__amcViewerFlightAdds===2"),js("return window.__amcViewerFlightAdds")
    js("window.__amcViewerFlightObserver?.disconnect?.();return true;")
    print('CHAT EMPLEADO FLOTANTE MULTIMEDIA OK:',json.dumps({'messages':len(messages.get('messages',[])),'photos':len(sent[-1].get('photos') or []),'sharedTransition':True,'singleOpenTransition':True,'chatStaysOpen':True,'responsive':responsive,'zoomTransform':transform}))
finally:
    try: call('DELETE',prefix)
    except Exception: pass