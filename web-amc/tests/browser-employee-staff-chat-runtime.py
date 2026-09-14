import ast
import json
import os
import time
import urllib.request
from pathlib import Path

DRIVER="http://127.0.0.1:9515"
BASE="http://localhost:4180"


def lifecycle_credentials():
    tree=ast.parse(Path('tests/browser-lifecycle.py').read_text(encoding='utf-8'))
    values={}
    for node in tree.body:
        if not isinstance(node,ast.Assign) or len(node.targets)!=1 or not isinstance(node.targets[0],ast.Name):
            continue
        if node.targets[0].id in {'EMPLOYEE_EMAIL','EMPLOYEE_PASSWORD'} and isinstance(node.value,ast.Constant):
            values[node.targets[0].id]=node.value.value
    if set(values)!={'EMPLOYEE_EMAIL','EMPLOYEE_PASSWORD'}:
        raise AssertionError('No se encontraron las credenciales E2E del empleado ya creado por browser-lifecycle.py')
    return values['EMPLOYEE_EMAIL'],values['EMPLOYEE_PASSWORD']


def call(method,path,payload=None):
    data=None if payload is None else json.dumps(payload).encode()
    request=urllib.request.Request(DRIVER+path,data=data,method=method,headers={"Content-Type":"application/json"})
    with urllib.request.urlopen(request,timeout=30) as response:
        body=json.loads(response.read().decode() or "{}")
    return body.get("value",body)


binary=os.environ.get("AMC_CHROME_BINARY")
options={"args":["--headless=new","--no-sandbox","--disable-dev-shm-usage","--window-size=390,844"]}
if binary:
    options["binary"]=binary
session=call("POST","/session",{"capabilities":{"alwaysMatch":{"browserName":"chrome","goog:chromeOptions":options}}})
session_id=session.get("sessionId") if isinstance(session,dict) else None
if not session_id:
    raise SystemExit("No se pudo iniciar Chrome: "+repr(session))
prefix="/session/"+session_id


def js(script):
    return call("POST",prefix+"/execute/sync",{"script":script,"args":[]})


def js_async(script,args=None):
    value=call("POST",prefix+"/execute/async",{"script":script,"args":args or []})
    if isinstance(value,dict) and value.get("__error"):
        raise AssertionError(value["__error"])
    return value


def go(url):
    call("POST",prefix+"/url",{"url":url})


def wait(script,seconds=15):
    end=time.time()+seconds
    last=None
    while time.time()<end:
        try:
            last=js(script)
            if last:
                return last
        except Exception as exc:
            last=str(exc)
        time.sleep(.2)
    raise AssertionError("Tiempo agotado. Último resultado: "+repr(last))


def login(email,password):
    go(BASE+"/#ingresar")
    wait("return !!document.querySelector('#auth')")
    js("const f=document.querySelector('#auth');f.elements.email.value="+json.dumps(email)+";f.elements.password.value="+json.dumps(password)+";f.requestSubmit();return true;")
    wait("return document.body.classList.contains('employee-v4')")


def api(path,payload=None,method=None,expected=(200,201)):
    method=method or ("GET" if payload is None else "POST")
    script="""
    const done=arguments[arguments.length-1],path=arguments[0],payload=arguments[1],method=arguments[2];
    (async()=>{
      let csrf='';
      if(method!=='GET'&&method!=='HEAD'){
        const stateResponse=await fetch('/api/state',{credentials:'same-origin'});
        const state=await stateResponse.json();
        csrf=state.csrf||'';
      }
      const init={method,credentials:'same-origin',headers:{'Content-Type':'application/json'}};
      if(csrf)init.headers['X-CSRF-Token']=csrf;
      if(payload!==null&&method!=='GET'&&method!=='HEAD')init.body=JSON.stringify(payload);
      const response=await fetch(path,init);
      const raw=await response.text();
      let data=raw;
      try{data=raw?JSON.parse(raw):{};}catch{}
      return {status:response.status,data};
    })().then(done).catch(error=>done({__error:String(error&&error.message||error)}));
    """
    result=js_async(script,[path,payload,method])
    if result["status"] not in expected:
        raise AssertionError(path+" devolvió "+str(result["status"])+": "+repr(result["data"]))
    return result["data"]


REMOTE_MESSAGE="Mensaje previo del contrato runtime"
EMPLOYEE_MESSAGE="Respuesta runtime E2E"
DRAFT="Borrador persistente del empleado"

try:
    email,password=lifecycle_credentials()
    login(email,password)
    api('/api/staff-chat/messages',{
        'text':REMOTE_MESSAGE,
        'photos':[],
        'idempotencyKey':'runtime-chat-remote-001'
    })

    go(BASE+'/#chat-equipo')
    wait("return !!document.querySelector('.employee-staff-chat .employee-message-log')")
    wait("return document.querySelector('.employee-message-log').innerText.includes("+json.dumps(REMOTE_MESSAGE)+")")
    wait("return !document.querySelector('.employee-staff-chat').dataset.staffChatLoading")
    assert js("return [...document.querySelectorAll('style')].some(s=>s.textContent.includes('employee-send-spinner'))")

    js("""
      const textarea=document.querySelector('.employee-staff-chat .staff-message textarea[name="text"]');
      textarea.focus();
      textarea.value="""+json.dumps(DRAFT)+""";
      textarea.dispatchEvent(new Event('input',{bubbles:true}));
      location.hash='#inicio-empleado';
      return true;
    """)
    wait("return location.hash==='#inicio-empleado' && !document.querySelector('.employee-staff-chat')")
    js("location.hash='#chat-equipo';return true;")
    wait("return !!document.querySelector('.employee-staff-chat .staff-message textarea[name=\"text\"]')")
    wait("return document.querySelector('.employee-staff-chat .staff-message textarea[name=\"text\"]').value==="+json.dumps(DRAFT))

    js("""
      const form=document.querySelector('.employee-staff-chat .staff-message');
      const textarea=form.elements.text;
      textarea.value="""+json.dumps(EMPLOYEE_MESSAGE)+""";
      textarea.dispatchEvent(new Event('input',{bubbles:true}));
      form.requestSubmit();
      return true;
    """)
    wait("return document.querySelector('.employee-message-log').innerText.includes("+json.dumps(EMPLOYEE_MESSAGE)+")",20)
    messages=api('/api/staff-chat/messages',None,'GET')
    assert any(message.get('text')==EMPLOYEE_MESSAGE and message.get('senderRole')=='employee' for message in messages.get('messages',[])),messages
    wait("return document.querySelector('.employee-staff-chat .staff-message button').textContent.trim()==='Enviar'",15)

    print('CHAT EMPLEADO RUNTIME OK:',json.dumps({'messages':len(messages.get('messages',[]))}))
finally:
    try:
        call('DELETE',prefix)
    except Exception:
        pass
