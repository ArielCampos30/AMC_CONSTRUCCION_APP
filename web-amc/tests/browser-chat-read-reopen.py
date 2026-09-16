import json
import os
import time
import urllib.request

DRIVER='http://127.0.0.1:9515'
BASE='http://localhost:4180'

def call(method,path,payload=None):
    data=None if payload is None else json.dumps(payload).encode()
    req=urllib.request.Request(DRIVER+path,data=data,method=method,headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=30) as response:
        body=json.loads(response.read().decode() or '{}')
    return body.get('value',body)

binary=os.environ.get('AMC_CHROME_BINARY')
options={'args':['--headless=new','--no-sandbox','--disable-dev-shm-usage','--window-size=390,844']}
if binary: options['binary']=binary
session=call('POST','/session',{'capabilities':{'alwaysMatch':{'browserName':'chrome','goog:chromeOptions':options}}})
session_id=session.get('sessionId') if isinstance(session,dict) else None
if not session_id: raise SystemExit('No se pudo iniciar Chrome: '+repr(session))
prefix='/session/'+session_id

def js(script): return call('POST',prefix+'/execute/sync',{'script':script,'args':[]})
def js_async(script,args=None):
    value=call('POST',prefix+'/execute/async',{'script':script,'args':args or []})
    if isinstance(value,dict) and value.get('__error'): raise AssertionError(value['__error'])
    return value

def go(url): call('POST',prefix+'/url',{'url':url})
def wait(script,seconds=15):
    end=time.time()+seconds
    last=None
    while time.time()<end:
        try:
            last=js(script)
            if last: return last
        except Exception as error: last=str(error)
        time.sleep(.15)
    raise AssertionError('Tiempo agotado. Último resultado: '+repr(last))

def clear_session():
    try: call('DELETE',prefix+'/cookie')
    except Exception: pass

def login(email,password,role_class):
    go(BASE+'/#ingresar')
    wait("return !!document.querySelector('#auth') && !document.querySelector('#boot-loader')")
    js("const f=document.querySelector('#auth');f.elements.email.value="+json.dumps(email)+";f.elements.password.value="+json.dumps(password)+";f.requestSubmit();return true;")
    wait('return document.body.classList.contains('+json.dumps(role_class)+')')

def api(path,payload=None,method=None,expected=(200,201)):
    method=method or ('GET' if payload is None else 'POST')
    script="""
    const done=arguments[arguments.length-1],path=arguments[0],payload=arguments[1],method=arguments[2];
    (async()=>{let csrf='';if(method!=='GET'&&method!=='HEAD'){const s=await (await fetch('/api/state',{credentials:'same-origin'})).json();csrf=s.csrf||'';}const init={method,credentials:'same-origin',headers:{'Content-Type':'application/json'}};if(csrf)init.headers['X-CSRF-Token']=csrf;if(payload!==null&&method!=='GET'&&method!=='HEAD')init.body=JSON.stringify(payload);const response=await fetch(path,init);const raw=await response.text();let data=raw;try{data=raw?JSON.parse(raw):{};}catch{}return {status:response.status,data};})().then(done).catch(error=>done({__error:String(error&&error.message||error)}));
    """
    result=js_async(script,[path,payload,method])
    if result['status'] not in expected: raise AssertionError(path+' devolvió '+str(result['status'])+': '+repr(result['data']))
    return result['data']

stamp=str(int(time.time()*1000))
email='read-reopen-'+stamp+'@amc.test'
password='Strong-Read-Reopen-2026!'
message='Lectura persistente '+stamp

try:
    go(BASE+'/#registro')
    wait("return !!document.querySelector('#auth[data-register=\"true\"]')")
    js("const f=document.querySelector('#auth');f.elements.name.value='Cliente Read Reopen';f.elements.email.value="+json.dumps(email)+";f.elements.password.value="+json.dumps(password)+";f.elements.passwordConfirm.value="+json.dumps(password)+";f.requestSubmit();return true;")
    wait("return document.body.classList.contains('client-v5')")
    client_state=api('/api/state')
    client_id=client_state['user']['id']
    api('/api/client-chat/messages',{'text':message,'photos':[],'idempotencyKey':'read-reopen-'+stamp})

    clear_session()
    login('admin@amc.test','AMC-Prueba-2026!','admin-v3')
    before=api('/api/state')
    assert before.get('clientChatUnread',{}).get(client_id,0)==1,before.get('clientChatUnread')

    go(BASE+'/#chat-user/'+client_id)
    wait("return location.hash==='#inicio' && !!document.querySelector('#amc-chat-dialog[open] .message-log')")
    wait("return document.querySelector('#amc-chat-dialog .message-log').innerText.includes("+json.dumps(message)+")")

    end=time.time()+8
    after=None
    while time.time()<end:
        after=api('/api/state')
        if after.get('clientChatUnread',{}).get(client_id,0)==0: break
        time.sleep(.2)
    assert after.get('clientChatUnread',{}).get(client_id,0)==0,after.get('clientChatUnread')

    call('POST',prefix+'/refresh',{})
    wait("return document.body.classList.contains('admin-v3') && !document.querySelector('#boot-loader')")
    reopened=api('/api/state')
    assert reopened.get('clientChatUnread',{}).get(client_id,0)==0,reopened.get('clientChatUnread')
finally:
    try: call('DELETE',prefix)
    except Exception: pass
