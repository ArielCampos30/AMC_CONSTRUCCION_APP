import ast
import json
import os
import time
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
    with urllib.request.urlopen(request,timeout=30) as response: body=json.loads(response.read().decode() or "{}")
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
    wait("return !!document.querySelector('#amc-chat-dialog .message[data-message-id] .mini-photos img[src*='?thumb=1']')",30)
    messages=api('/api/staff-chat/messages',None,'GET');sent=[m for m in messages.get('messages',[]) if m.get('text')==EMPLOYEE_MESSAGE]
    assert sent and len(sent[-1].get('photos') or [])==1,messages
    js("document.querySelector('#amc-chat-dialog .message[data-message-id] .mini-photos img').click();return true;")
    wait("return !!document.querySelector('.amc-photo-viewer[open] .amc-viewer-stage img')")
    assert js("return !!document.querySelector('.amc-photo-viewer[open] .amc-viewer-stage img').src")
    print('CHAT EMPLEADO FLOTANTE MULTIMEDIA OK:',json.dumps({'messages':len(messages.get('messages',[])),'photos':len(sent[-1].get('photos') or [])}))
finally:
    try: call('DELETE',prefix)
    except Exception: pass
