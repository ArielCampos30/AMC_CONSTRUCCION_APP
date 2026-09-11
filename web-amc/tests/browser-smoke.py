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

    # Cotizador en una ventana baja de escritorio: las opciones del Tarifario deben
    # abrir como desplegable flotante, sin crear scroll en el detalle central.
    call("POST",prefix+"/window/rect",{"width":1280,"height":600})
    go(BASE+"/#cotizador")
    wait("return !!document.querySelector('.quote-wizard-dialog') && !!document.querySelector('[data-qw-client]')")
    wait("return document.querySelectorAll('[data-qw-client] option').length > 1")
    js("""const s=document.querySelector('[data-qw-client]');const option=[...s.options].find(o=>o.value);if(!option)return false;s.value=option.value;s.dispatchEvent(new Event('change',{bubbles:true}));return true;""")
    wait("return !!document.querySelector('[data-qw-next]:not([disabled])')")
    js("document.querySelector('[data-qw-next]').click();return true;")
    wait("return !!document.querySelector('[data-qw-work-input][data-qw-key=\"description\"]')")
    js("""const input=document.querySelector('[data-qw-work-input][data-qw-key="description"]');input.value='revo';input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();return true;""")
    wait("return !!document.querySelector('#quote-tariff-overlay:not([hidden]) button[data-qw-select-tariff]')")
    layout=js("""const detail=document.querySelector('.quote-builder-detail'),summary=document.querySelector('.quote-builder-summary'),overlay=document.querySelector('#quote-tariff-overlay'),close=document.querySelector('.quote-wizard-close'),r=overlay.getBoundingClientRect(),cs=getComputedStyle(close),input=document.querySelector('[data-qw-work-input][data-qw-key="description"]'),id=input.dataset.qwWorkId;return {detailOverflow:getComputedStyle(detail).overflowY,detailFits:detail.scrollHeight<=detail.clientHeight+4,summaryOverflow:getComputedStyle(summary).overflowY,overlayTop:r.top,overlayBottom:r.bottom,height:innerHeight,closeBorder:cs.borderTopWidth,closeBackground:cs.backgroundColor,closeDisplay:cs.display,sidebar:[...document.querySelectorAll(`button[data-qw-select-work="${CSS.escape(id)}"] .quote-builder-work-copy strong`)].map(n=>n.textContent),summaryNames:[...document.querySelectorAll(`.quote-summary-rows button[data-qw-select-work="${CSS.escape(id)}"] span`)].map(n=>n.textContent)};""")
    assert layout["detailOverflow"] in ("visible","hidden","clip"),layout
    assert layout["detailFits"],layout
    assert layout["summaryOverflow"]=="auto",layout
    assert layout["overlayTop"]>=0 and layout["overlayBottom"]<=layout["height"]+1,layout
    assert layout["closeBorder"]=="0px" and layout["closeDisplay"]=="grid",layout
    assert all(name=="revo" for name in layout["sidebar"]+layout["summaryNames"]),layout
    js("document.querySelector('#quote-tariff-overlay button[data-qw-select-tariff]').click();return true;")
    wait("return !!document.querySelector('.quote-selected-tariff')")
    selected_layout=js("""const detail=document.querySelector('.quote-builder-detail'),summary=document.querySelector('.quote-builder-summary');return {detailOverflow:getComputedStyle(detail).overflowY,detailFits:detail.scrollHeight<=detail.clientHeight+4,summaryOverflow:getComputedStyle(summary).overflowY,quantity:!!document.querySelector('[data-qw-work-input][data-qw-key="quantity"]')};""")
    assert selected_layout["detailOverflow"] in ("visible","hidden","clip"),selected_layout
    assert selected_layout["detailFits"],selected_layout
    assert selected_layout["summaryOverflow"]=="auto" and selected_layout["quantity"],selected_layout

    call("POST",prefix+"/window/rect",{"width":1280,"height":900})
    call("DELETE",prefix+"/cookie")
    login("cliente@amc.test","Cliente-Prueba-2026!","client-v5")
    text=js("return document.body.innerText")
    assert "Mis trabajos" in text and "Perfil" in text
    assert not js("return !!document.querySelector('[data-nav=\"chat-cliente\"],.bottom-nav a[href=\"#chat-cliente\"]')")
finally:
    try: call("DELETE",prefix)
    except Exception: pass