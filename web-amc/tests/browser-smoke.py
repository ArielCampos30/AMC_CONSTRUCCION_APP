import json, os, time, urllib.request

DRIVER="http://127.0.0.1:9515"
BASE="http://localhost:4180"

def call(method,path,payload=None):
    data=None if payload is None else json.dumps(payload).encode()
    req=urllib.request.Request(DRIVER+path,data=data,method=method,headers={"Content-Type":"application/json"})
    with urllib.request.urlopen(req,timeout=15) as response:
        body=json.loads(response.read().decode() or "{}")
    return body.get("value",body)

binary=os.environ.get("AMC_CHROME_BINARY")
options={"args":["--headless=new","--no-sandbox","--disable-dev-shm-usage","--window-size=1280,900"]}
if binary: options["binary"]=binary
session=call("POST","/session",{"capabilities":{"alwaysMatch":{"browserName":"chrome","goog:chromeOptions":options}}})
session_id=session.get("sessionId") if isinstance(session,dict) else None
if not session_id:
    raise SystemExit("No se pudo iniciar Chrome: "+repr(session))
prefix="/session/"+session_id

def js(script):
    return call("POST",prefix+"/execute/sync",{"script":script,"args":[]})

def go(url):
    call("POST",prefix+"/url",{"url":url})

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
    raise AssertionError("Tiempo agotado. Último resultado: "+repr(last))

def login(email,password,role_class):
    go(BASE+"/#ingresar")
    wait("return !!document.querySelector('#auth') && !document.querySelector('#boot-loader')")
    assert "Cargando tus espacios" not in js("return document.body.innerText")
    js("const f=document.querySelector('#auth');f.elements.email.value="+json.dumps(email)+";f.elements.password.value="+json.dumps(password)+";f.requestSubmit();return true;")
    wait("return document.body.classList.contains("+json.dumps(role_class)+") && !!document.querySelector('.workspace')")
    assert not js("return !!document.querySelector('#boot-loader')")
    audit=js("""return {
      overflow: document.documentElement.scrollWidth > innerWidth + 2,
      buttons:[...document.querySelectorAll('button')].filter(b=>b.offsetParent!==null&&!((b.textContent||'').trim()||b.getAttribute('aria-label')||b.title)).length,
      images:[...document.images].filter(i=>!i.hasAttribute('alt')).length,
      dialogs:[...document.querySelectorAll('dialog[open]')].filter(d=>!d.getAttribute('aria-label')&&!d.querySelector('h1,h2,[aria-labelledby]')).length
    }""")
    assert audit=={"overflow":False,"buttons":0,"images":0,"dialogs":0},audit

try:
    login("admin@amc.test","AMC-Prueba-2026!","admin-v3")
    go(BASE+"/#mas-admin")
    wait("return document.body.innerText.includes('Estado de AMC')")
    status=js("return document.body.innerText")
    assert "Versión:" in status and "Base:" in status
    go(BASE+"/#perfil")
    wait("return document.body.innerText.includes('Seguridad en dos pasos')")
    assert "seguridad en dos pasos" in js("return document.body.innerText").lower()
    call("DELETE",prefix+"/cookie")
    login("cliente@amc.test","Cliente-Prueba-2026!","client-v5")
    text=js("return document.body.innerText")
    assert "Mis trabajos" in text and "Perfil" in text
    assert not js("return !!document.querySelector('[data-nav=\"chat-cliente\"],.bottom-nav a[href=\"#chat-cliente\"]')")
finally:
    try: call("DELETE",prefix)
    except Exception: pass