import json
import os
import time
import urllib.request

DRIVER = "http://127.0.0.1:9515"
BASE = "http://localhost:4180"


def call(method, path, payload=None):
    data = None if payload is None else json.dumps(payload).encode()
    request = urllib.request.Request(DRIVER + path, data=data, method=method, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=30) as response:
        body = json.loads(response.read().decode() or "{}")
    return body.get("value", body)


binary = os.environ.get("AMC_CHROME_BINARY")
options = {"args": ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--window-size=390,844"]}
if binary:
    options["binary"] = binary
session = call("POST", "/session", {"capabilities": {"alwaysMatch": {"browserName": "chrome", "goog:chromeOptions": options}}})
session_id = session.get("sessionId") if isinstance(session, dict) else None
if not session_id:
    raise SystemExit("No se pudo iniciar Chrome móvil: " + repr(session))
prefix = "/session/" + session_id


def js(script):
    return call("POST", prefix + "/execute/sync", {"script": script, "args": []})


def js_async(script):
    return call("POST", prefix + "/execute/async", {"script": script, "args": []})


def wait(script, seconds=10):
    end = time.time() + seconds
    last = None
    while time.time() < end:
        try:
            last = js(script)
            if last:
                return last
        except Exception as error:
            last = str(error)
        time.sleep(0.1)
    raise AssertionError("Tiempo agotado. Último resultado: " + repr(last))


try:
    call("POST", prefix + "/url", {"url": BASE + "/#inicio"})
    wait("return document.readyState==='complete' && !!document.body")
    js("""
      window.__routeCalls=[];
      window.__routeEvents=[];
      window.AMCNative={setActiveChatRoute:route=>window.__routeCalls.push(route)};
      window.addEventListener('amc-active-chat-change',event=>window.__routeEvents.push(event.detail.route));
      return true;
    """)

    created = js_async("""
      const done=arguments[arguments.length-1];
      (async()=>{
        const {createFloatingChat}=await import('/floating-chat.js');
        const routeRuntime=await import('/active-chat-route-runtime.js');
        window.__createRouteChat=(kind,id)=>{
          document.querySelector('#amc-chat-dialog')?.remove();
          document.querySelectorAll('.floating-chat-button').forEach(node=>node.remove());
          document.body.classList.toggle('admin-v3',kind==='admin');
          const contact={id,name:'Contacto',service:'Obra',kind:kind==='employee'?'employee':'client'};
          const attribute=kind==='client'?'data-client':kind==='admin'?'data-request':'';
          const thread=()=>`<section class="${kind==='employee'?'floating-staff-message':''}"><div class="message-log"></div><form class="message-form" ${attribute}="${id}"><textarea name="text"></textarea><button type="submit">Enviar</button></form></section>`;
          const runtime=createFloatingChat({allowed:()=>true,renderChat:thread,mounted:()=>{},label:()=> 'Chats',contacts:()=>[contact],current:()=>id,select:()=>{},customThread:thread,submitCustom:async()=>({})});
          runtime.sync('u-'+kind);
          runtime.open();
          const row=document.querySelector('#amc-chat-dialog .chat-contact');
          const rect=row.getBoundingClientRect();
          row.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:rect.left+rect.width/2,clientY:rect.top+rect.height/2}));
          row.click();
          window.__currentRouteChat=runtime;
          const route=routeRuntime.publishActiveChatRoute();
          return {route,dataset:document.documentElement.dataset.amcActiveChatRoute,native:window.__routeCalls.at(-1),event:window.__routeEvents.at(-1)};
        };
        return true;
      })().then(done).catch(error=>done({error:String(error&&error.message||error)}));
    """)
    if isinstance(created, dict) and created.get("error"):
        raise AssertionError(created["error"])

    cases = [
        ("client", "client-1", "/#chat-user/client-1"),
        ("admin", "request-1", "/#chat-admin/request-1"),
        ("employee", "employee-1", "/#chat-equipo/employee-1"),
    ]
    for kind, identity, expected in cases:
        published = js("return window.__createRouteChat(%s,%s);" % (json.dumps(kind), json.dumps(identity)))
        assert published == {"route": expected, "dataset": expected, "native": expected, "event": expected}, {"kind": kind, "published": published}
        closed = js("document.querySelector('#amc-chat-dialog .chat-icon-button[aria-label=\"Cerrar conversación\"]').click();return !('amcActiveChatRoute' in document.documentElement.dataset) && window.__routeCalls.at(-1)==='' && window.__routeEvents.at(-1)==='';")
        assert closed is True, {"kind": kind, "closed": closed}

    safe = js_async("""
      const done=arguments[arguments.length-1];
      delete window.AMCNative;
      import('/active-chat-route-runtime.js').then(module=>done({route:module.publishActiveChatRoute(),ok:true})).catch(error=>done({ok:false,error:String(error)}));
    """)
    assert safe == {"route": "", "ok": True}, safe
finally:
    try:
        call("DELETE", prefix)
    except Exception:
        pass
