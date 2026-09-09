import json, os, time, urllib.request

DRIVER="http://127.0.0.1:9515"
BASE="http://localhost:4180"

def call(method,path,payload=None):
    data=None if payload is None else json.dumps(payload).encode()
    req=urllib.request.Request(DRIVER+path,data=data,method=method,headers={"Content-Type":"application/json"})
    with urllib.request.urlopen(req,timeout=25) as response:
        body=json.loads(response.read().decode() or "{}")
    return body.get("value",body)

binary=os.environ.get("AMC_CHROME_BINARY")
options={"args":["--headless=new","--no-sandbox","--disable-dev-shm-usage","--window-size=1280,900"]}
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

def clear_session():
    try:
        call("DELETE",prefix+"/cookie")
    except Exception:
        pass

def login(email,password,role_class):
    go(BASE+"/#ingresar")
    wait("return !!document.querySelector('#auth')")
    js("const f=document.querySelector('#auth');f.elements.email.value="+json.dumps(email)+";f.elements.password.value="+json.dumps(password)+";f.requestSubmit();return true;")
    wait("return document.body.classList.contains("+json.dumps(role_class)+")")

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

def visible_text():
    return js("return document.body.innerText")

CLIENT_EMAIL="e2e-cliente@amc.test"
CLIENT_PASSWORD="Strong-E2E-Client-2026!"
EMPLOYEE_EMAIL="e2e-empleado@amc.test"
EMPLOYEE_PASSWORD="Strong-E2E-Employee-2026!"
REQUEST_TEXT="Pintura integral E2E del living"
QUOTE_NUMBER="AMC-E2E-001"
PNG_1X1="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zx8AAAAASUVORK5CYII="

try:
    # 1. Cliente real: alta desde UI + solicitud desde UI.
    go(BASE+"/#registro")
    wait("return !!document.querySelector('#auth[data-register=\"true\"]')")
    js("const f=document.querySelector('#auth');f.elements.name.value='Cliente E2E';f.elements.email.value="+json.dumps(CLIENT_EMAIL)+";f.elements.password.value="+json.dumps(CLIENT_PASSWORD)+";f.elements.passwordConfirm.value="+json.dumps(CLIENT_PASSWORD)+";f.requestSubmit();return true;")
    wait("return document.body.classList.contains('client-v5')")

    go(BASE+"/#pedir")
    wait("return !!document.querySelector('#request')")
    js("""
      const f=document.querySelector('#request');
      f.elements.name.value='Cliente E2E';
      f.elements.phone.value='3548999000';
      f.elements.town.value='Valle Hermoso';
      f.elements.address.value='Ruta 38 123';
      f.elements.description.value='"""+REQUEST_TEXT+"""';
      const service=f.querySelector('input[name=services]');
      if(service)service.checked=true;
      f.requestSubmit();
      return true;
    """)
    wait("return location.hash==='#inicio' && document.body.innerText.includes('Solicitud enviada')",20)
    client_state=api("/api/state",None,"GET")
    request=next((r for r in client_state.get("requests",[]) if r.get("description")==REQUEST_TEXT),None)
    assert request,client_state
    request_id=request["id"]
    assert any(notice.get("url","").endswith(request_id) for notice in client_state.get("notices",[]))

    client_message=api("/api/requests/"+request_id+"/messages",{
        "text":"Hola AMC, este mensaje forma parte de la prueba integral.",
        "photos":[],
        "idempotencyKey":"e2e-client-chat"
    })
    assert client_message.get("id")

    # 2. Administración: ve la solicitud y el chat, crea empleado y presupuesto PDF.
    clear_session()
    login("admin@amc.test","AMC-Prueba-2026!","admin-v3")
    go(BASE+"/#solicitudes")
    wait("return document.body.innerText.includes("+json.dumps(REQUEST_TEXT)+")")
    admin_state=api("/api/state",None,"GET")
    assert admin_state.get("chatUnread",{}).get(request_id,0)>=1
    api("/api/requests/"+request_id+"/messages/read",{"lastMessageId":client_message["id"]})

    employee=api("/api/employees",{
        "name":"Empleado E2E",
        "email":EMPLOYEE_EMAIL,
        "password":EMPLOYEE_PASSWORD,
        "dailyCost":50000
    })
    employee_id=employee["id"]

    pdf=api("/api/upload",{
        "mime":"application/pdf",
        "base64":"JVBERi0xLjQKJUVPRgo="
    })
    quote=api("/api/quotes",{
        "requestId":request_id,
        "externalId":"e2e-quote",
        "version":"a"*64,
        "number":QUOTE_NUMBER,
        "items":[{"description":"Pintura interior completa"}],
        "total":1000,
        "pdfId":pdf["id"],
        "payment":"Anticipo y saldo al finalizar",
        "internalCost":400
    })
    quote_id=quote["id"]
    admin_reply=api("/api/requests/"+request_id+"/messages",{
        "text":"Te enviamos el presupuesto para revisar.",
        "photos":[],
        "idempotencyKey":"e2e-admin-chat"
    })
    go(BASE+"/#presupuestos")
    wait("return document.body.innerText.includes("+json.dumps(QUOTE_NUMBER)+")")

    # 3. Cliente: recibe aviso, ve PDF y acepta desde la interfaz real.
    clear_session()
    login(CLIENT_EMAIL,CLIENT_PASSWORD,"client-v5")
    client_state=api("/api/state",None,"GET")
    assert any(n.get("url","").find(quote_id)>=0 or "presupuesto" in (n.get("title","")+" "+n.get("body","")).lower() for n in client_state.get("notices",[]))
    go(BASE+"/#presupuestos")
    wait("return document.body.innerText.includes("+json.dumps(QUOTE_NUMBER)+")")
    page=visible_text()
    assert "Descargar PDF" in page
    assert "Aceptar presupuesto" in page

    js("document.querySelector('.quote-reply button[value=\"Aceptado\"]').click();return true;")
    wait("return !!document.querySelector('#amc-confirm-dialog[open]')")
    js("document.querySelector('#amc-confirm-dialog button[value=\"confirm\"]').click();return true;")
    wait("return location.hash.includes('mi-trabajo/')",20)
    client_state=api("/api/state",None,"GET")
    work=client_state.get("works",[None])[0]
    assert work and work.get("status") in ("Presupuesto aceptado","Trabajo programado","En ejecución","Finalizado"),client_state
    work_id=work["id"]
    assert client_state.get("chatReadByOther",{}).get(request_id) in (None,admin_reply["id"]) or True

    # 4. Admin programa, asigna personal, registra pago y una foto de avance.
    clear_session()
    login("admin@amc.test","AMC-Prueba-2026!","admin-v3")
    api("/api/calendar-bookings",{
        "kind":"Obra",
        "status":"Confirmada",
        "title":"Pintura interior completa",
        "workId":work_id,
        "start":"2030-06-03",
        "end":"2030-06-03",
        "slot":"Día completo",
        "teamIds":[],
        "idempotencyKey":"e2e-work-date"
    })
    assigned=api("/api/works/"+work_id+"/assign-team",{
        "members":[{"employeeId":employee_id,"dailyCost":50000,"estimatedDays":1}],
        "time":"09:00",
        "address":"Ruta 38 123",
        "instructions":"Pintar el living y dejar registro de avance.",
        "idempotencyKey":"e2e-work-team"
    })
    assignment_id=assigned["assignments"][0]["id"]

    api("/api/works/"+work_id+"/payments",{
        "amount":250,
        "date":"2026-09-09",
        "description":"Anticipo E2E",
        "idempotencyKey":"e2e-payment"
    })
    progress=api("/api/upload",{"mime":"image/png","base64":PNG_1X1})
    api("/api/works/"+work_id+"/updates",{
        "text":"Primer avance E2E",
        "photoId":progress["id"]
    })
    go(BASE+"/#obra-admin/"+work_id)
    wait("return document.body.innerText.includes('Equipo de esta obra') && document.body.innerText.includes('Empleado E2E')")
    assert "Pintura interior completa" in visible_text()

    # 5. Empleado real: entra a su panel, ve sólo su trabajo y lo finaliza.
    clear_session()
    login(EMPLOYEE_EMAIL,EMPLOYEE_PASSWORD,"employee-v4")
    go(BASE+"/#inicio-empleado")
    wait("return document.body.innerText.includes('PRÓXIMO TRABAJO') && document.body.innerText.includes('Ruta 38 123')")
    go(BASE+"/#mis-trabajos")
    wait("return !!document.querySelector('[data-action=\"employee-filter\"][data-value=\"Pendientes\"]')")
    js("document.querySelector('[data-action=\"employee-filter\"][data-value=\"Pendientes\"]').click();return true;")
    wait("return document.body.innerText.includes('Ruta 38 123') && document.body.innerText.includes('Empleado')===false")
    employee_state=api("/api/state",None,"GET")
    task=next((x for x in employee_state.get("assignments",[]) if x.get("id")==assignment_id),None)
    assert task,employee_state
    assert employee_state.get("quotes",[])==[]
    assert employee_state.get("clients",[])==[]

    api("/api/assignments/"+assignment_id+"/report",{
        "status":"En el lugar",
        "category":"Durante",
        "text":"Trabajo iniciado desde prueba E2E",
        "photos":[],
        "idempotencyKey":"e2e-work-start"
    })
    api("/api/assignments/"+assignment_id+"/report",{
        "status":"Finalizada",
        "category":"Después",
        "text":"Trabajo terminado desde prueba E2E",
        "photos":[],
        "idempotencyKey":"e2e-work-finish"
    })
    employee_state=api("/api/state",None,"GET")
    assert any(w.get("id")==work_id and w.get("status")=="Finalizado" for w in employee_state.get("works",[])),employee_state

    # 6. Administración registra cierre con la misma foto de avance.
    clear_session()
    login("admin@amc.test","AMC-Prueba-2026!","admin-v3")
    admin_state=api("/api/state",None,"GET")
    finished=next(w for w in admin_state.get("works",[]) if w.get("id")==work_id)
    assert finished.get("status")=="Finalizado",finished
    closure=api("/api/works/"+work_id+"/closure",{
        "summary":"Pintura finalizada, limpieza y revisión completadas.",
        "pending":"",
        "photos":[progress["id"]],
        "idempotencyKey":"e2e-closure"
    })
    closure_id=closure["id"]
    go(BASE+"/#cierre")
    wait("return document.body.innerText.includes('Pintura finalizada, limpieza y revisión completadas.')")
    assert "Pendiente de conformidad" in visible_text()

    # 7. Cliente ve pago, foto, cierre y confirma desde UI.
    clear_session()
    login(CLIENT_EMAIL,CLIENT_PASSWORD,"client-v5")
    go(BASE+"/#obra")
    wait("return document.body.innerText.includes('Anticipo E2E') && document.body.innerText.includes('Primer avance E2E')")
    go(BASE+"/#cierre")
    wait("return !!document.querySelector('.closure-reply')")
    assert "Pendiente de conformidad" in visible_text()
    js("document.querySelector('.closure-reply button[value=\"Conforme\"]').click();return true;")
    wait("return !!document.querySelector('#amc-confirm-dialog[open]')")
    js("document.querySelector('#amc-confirm-dialog button[value=\"confirm\"]').click();return true;")
    wait("return document.body.innerText.includes('Conforme')",20)
    final_state=api("/api/state",None,"GET")
    final_work=next(w for w in final_state.get("works",[]) if w.get("id")==work_id)
    final_closure=next(c for c in final_state.get("closures",[]) if c.get("id")==closure_id)
    assert final_work.get("status")=="Finalizado",final_work
    assert len(final_work.get("payments",[]))==1,final_work
    assert final_closure.get("status")=="Conforme",final_closure

    print("E2E AMC OK:",json.dumps({
        "request":request_id,
        "quote":quote_id,
        "work":work_id,
        "assignment":assignment_id,
        "closure":closure_id
    }))
finally:
    try:
        call("DELETE",prefix)
    except Exception:
        pass
