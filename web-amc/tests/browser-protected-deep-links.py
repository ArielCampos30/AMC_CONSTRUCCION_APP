import json, os, time, urllib.request

DRIVER='http://127.0.0.1:9515'
BASE='http://localhost:4180'

def call(method,path,payload=None):
    data=None if payload is None else json.dumps(payload).encode()
    req=urllib.request.Request(DRIVER+path,data=data,method=method,headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=15) as response:
        body=json.loads(response.read().decode() or '{}')
    return body.get('value',body)

binary=os.environ.get('AMC_CHROME_BINARY')
options={'args':['--headless=new','--no-sandbox','--disable-dev-shm-usage','--window-size=1280,900']}
if binary: options['binary']=binary
session=call('POST','/session',{'capabilities':{'alwaysMatch':{'browserName':'chrome','goog:chromeOptions':options}}})
session_id=session.get('sessionId') if isinstance(session,dict) else None
if not session_id:
    raise SystemExit('No se pudo iniciar Chrome: '+repr(session))
prefix='/session/'+session_id

def js(script):
    return call('POST',prefix+'/execute/sync',{'script':script,'args':[]})

def go(url):
    call('POST',prefix+'/url',{'url':url})

def wait(script,seconds=12):
    end=time.time()+seconds
    last=None
    while time.time()<end:
        try:
            last=js(script)
            if last:return last
        except Exception as exc:
            last=str(exc)
        time.sleep(.2)
    raise AssertionError('Tiempo agotado. Último resultado: '+repr(last))

def clear_session():
    try: call('DELETE',prefix+'/cookie')
    except Exception: pass

def login_current_route(email,password,role_class,expected_hash):
    wait("return !!document.querySelector('#auth') && !document.querySelector('#boot-loader')")
    assert js('return location.hash')==expected_hash
    js("const f=document.querySelector('#auth');f.elements.email.value="+json.dumps(email)+";f.elements.password.value="+json.dumps(password)+";f.requestSubmit();return true;")
    wait("return document.body.classList.contains("+json.dumps(role_class)+") && location.hash==="+json.dumps(expected_hash))

try:
    # Deep link Admin: sin sesión debe mostrar Ingresar sin perder el hash y volver allí después del login.
    clear_session()
    go(BASE+'/#obra-admin/work-missing')
    login_current_route('admin@amc.test','AMC-Prueba-2026!','admin-v3','#obra-admin/work-missing')
    wait("return document.body.innerText.includes('Obra no disponible')")

    # Simula sesión vencida sobre un deep link de Cliente: cookie eliminada y nueva carga de la misma URL.
    clear_session()
    go(BASE+'/#presupuesto/quote-missing')
    login_current_route('cliente@amc.test','Cliente-Prueba-2026!','client-v5','#presupuesto/quote-missing')
    wait("return location.hash==='#presupuesto/quote-missing' && document.body.classList.contains('client-v5')")

    # Una ruta pública sigue siendo pública y no debe forzar autenticación.
    clear_session()
    go(BASE+'/#servicios')
    wait("return !document.querySelector('#boot-loader') && document.body.innerText.includes('Servicios')")
    assert not js("return !!document.querySelector('#auth')")

    print('PROTECTED_DEEP_LINKS_OK')
finally:
    try: call('DELETE',prefix)
    except Exception: pass
