import json, os, time, urllib.request

DRIVER="http://127.0.0.1:9515"
BASE="http://localhost:4180"

CLIENT_EMAIL="piloto-cliente@amc.test"
CLIENT_PASSWORD="Strong-Piloto-Client-2026!"
EMPLOYEE_EMAIL="piloto-empleado@amc.test"
EMPLOYEE_PASSWORD="Strong-Piloto-Employee-2026!"
REQUEST_TEXT="Revoque y pintura integral piloto comercial"
CHAT_TEXT="Avance piloto: trabajo iniciado y foto enviada a Administración."
CLOSURE_TEXT="Piloto comercial finalizado, limpieza y revisión completadas."
PNG_1X1="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zx8AAAAASUVORK5CYII="


def call(method,path,payload=None):
    data=None if payload is None else json.dumps(payload).encode()
    req=urllib.request.Request(DRIVER+path,data=data,method=method,headers={"Content-Type":"application/json"})
    with urllib.request.urlopen(req,timeout=30) as response:
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


def js(script,args=None):
    return call("POST",prefix+"/execute/sync",{"script":script,"args":args or []})


def js_async(script,args=None):
    value=call("POST",prefix+"/execute/async",{"script":script,"args":args or []})
    if isinstance(value,dict) and value.get("__error"):
        raise AssertionError(value["__error"])
    return value


def go(url):
    call("POST",prefix+"/url",{"url":url})


def wait(script,seconds=20):
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
    js("const f=document.querySelector('#auth');f.elements.email.value=arguments[0];f.elements.password.value=arguments[1];f.requestSubmit();return true;",[email,password])
    wait("return document.body.classList.contains("+json.dumps(role_class)+")",20)


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


def set_value(selector,value,change=True):
    result=js("""
      const el=document.querySelector(arguments[0]);
      if(!el)return false;
      el.value=arguments[1];
      el.dispatchEvent(new Event('input',{bubbles:true}));
      if(arguments[2])el.dispatchEvent(new Event('change',{bubbles:true}));
      return true;
    """,[selector,str(value),change])
    assert result,"No se encontró "+selector


def set_if_exists(selector,value):
    return js("""
      const el=document.querySelector(arguments[0]);if(!el)return false;
      el.value=arguments[1];el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return true;
    """,[selector,str(value)])


def click(selector):
    result=js("const el=document.querySelector(arguments[0]);if(!el)return false;el.click();return true;",[selector])
    assert result,"No se encontró "+selector


def submit(selector):
    result=js("const f=document.querySelector(arguments[0]);if(!f)return false;f.requestSubmit();return true;",[selector])
    assert result,"No se encontró "+selector


def confirm_dialog():
    wait("return !!document.querySelector('#amc-confirm-dialog[open] button[value=\"confirm\"]')")
    click('#amc-confirm-dialog button[value="confirm"]')


def attach_png(selector,name="piloto.png"):
    count=js("""
      const input=document.querySelector(arguments[0]);if(!input)return -1;
      const raw=atob(arguments[2]),bytes=new Uint8Array(raw.length);
      for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
      const file=new File([bytes],arguments[1],{type:'image/png'}),dt=new DataTransfer();dt.items.add(file);input.files=dt.files;
      input.dispatchEvent(new Event('change',{bubbles:true}));return input.files.length;
    """,[selector,name,PNG_1X1])
    assert count==1,(selector,count)


def state_until(predicate,seconds=30):
    end=time.time()+seconds
    last=None
    while time.time()<end:
        last=api('/api/state',None,'GET')
        if predicate(last):
            return last
        time.sleep(.35)
    raise AssertionError("Estado no alcanzado: "+repr(last))


try:
    print("[1/7] Cliente: registro y solicitud desde UI")
    go(BASE+"/#registro")
    wait("return !!document.querySelector('#auth[data-register=\"true\"]')")
    js("""
      const f=document.querySelector('#auth');
      f.elements.name.value='Cliente Piloto';
      f.elements.email.value=arguments[0];
      f.elements.password.value=arguments[1];
      f.elements.passwordConfirm.value=arguments[1];
      f.requestSubmit();return true;
    """,[CLIENT_EMAIL,CLIENT_PASSWORD])
    wait("return document.body.classList.contains('client-v5')",20)

    go(BASE+"/#pedir")
    wait("return !!document.querySelector('#request')")
    js("""
      const f=document.querySelector('#request');
      f.elements.name.value='Cliente Piloto';
      f.elements.phone.value='3548999111';
      f.elements.town.value='Valle Hermoso';
      f.elements.address.value='Ruta 38 321';
      f.elements.description.value=arguments[0];
      const service=f.querySelector('input[name=services]');if(service)service.checked=true;
      f.requestSubmit();return true;
    """,[REQUEST_TEXT])
    wait("return location.hash==='#inicio' && document.body.innerText.includes('Solicitud enviada')",20)
    client_state=api('/api/state',None,'GET')
    request=next((row for row in client_state.get('requests',[]) if row.get('description')==REQUEST_TEXT),None)
    assert request,client_state
    request_id=request['id']
    client_id=client_state['user']['id']

    print("[2/7] Admin: Cotizador real, guardado/envío y PDF automático")
    clear_session()
    login('admin@amc.test','AMC-Prueba-2026!','admin-v3')
    employee=api('/api/employees',{
        'name':'Empleado Piloto','email':EMPLOYEE_EMAIL,'password':EMPLOYEE_PASSWORD,'phone':'3548999222','specialty':'Albañilería','dailyCost':50000
    })
    employee_id=employee['id']

    go(BASE+"/#cotizador")
    wait("return !!document.querySelector('.quote-wizard-page') && !!document.querySelector('[data-qw-client]')")
    wait("return [...document.querySelectorAll('[data-qw-client] option')].some(o=>o.value===arguments[0])".replace('arguments[0]',json.dumps('user:'+client_id)),20)
    set_value('[data-qw-client]','user:'+client_id)
    wait("return !!document.querySelector('[data-qw-request]')")
    set_value('[data-qw-request]',request_id)
    click('[data-qw-next]')
    wait("return !!document.querySelector('[data-qw-work-input][data-qw-key=\"description\"]')")
    set_value('[data-qw-work-input][data-qw-key="description"]','Revoque fino piloto')
    click('[data-qw-pricing-mode="manual"]')
    wait("return !!document.querySelector('[data-qw-work-input][data-qw-key=\"unitPrice\"]')")
    set_value('[data-qw-work-input][data-qw-key="quantity"]',1)
    set_value('[data-qw-work-input][data-qw-key="unitPrice"]',955000)
    wait("return !!document.querySelector('[data-qw-next]:not([disabled])')")
    click('[data-qw-next]')
    wait("return !!document.querySelector('.quote-wizard-stage-3 .quote-cost-stage')")
    set_if_exists('[data-qw-employee-day]',25000)
    set_if_exists('[data-qw-travel]',30000)
    for key,value in [('materials',100000),('tools',20000),('other',10000),('labor',0),('workers',2),('days',3)]:
        set_if_exists('[data-qw-work-input][data-qw-key="'+key+'"]',value)
    set_value('[data-qw-final-price]',955000)
    js("const c=document.querySelector('[data-qw-cost-confirm]');if(c){c.checked=true;c.dispatchEvent(new Event('change',{bubbles:true}));}return true;")
    click('[data-qw-next]')
    wait("return !!document.querySelector('.quote-wizard-stage-4')")
    wait("return !!document.querySelector('[data-qw-save-quote=\"1\"]:not([disabled])')",20)
    click('[data-qw-save-quote="1"]')
    confirm_dialog()
    wait("return location.hash.startsWith('#presupuesto-admin/')",25)
    admin_state=state_until(lambda s:any(q.get('requestId')==request_id for q in s.get('quotes',[])),20)
    quote=next(q for q in admin_state['quotes'] if q.get('requestId')==request_id)
    quote_id=quote['id']
    assert quote.get('status')=='Enviado',quote
    admin_state=state_until(lambda s:any(q.get('id')==quote_id and q.get('pdf') for q in s.get('quotes',[])),35)
    quote=next(q for q in admin_state['quotes'] if q.get('id')==quote_id)
    assert quote.get('pdf'),quote

    print("[3/7] Cliente: recibe PDF y acepta presupuesto desde UI")
    clear_session()
    login(CLIENT_EMAIL,CLIENT_PASSWORD,'client-v5')
    go(BASE+"/#presupuestos")
    wait("return !!document.querySelector('[data-quote-id="+json.dumps(quote_id)+"] .quote-reply')",20)
    assert js("return !!document.querySelector('[data-quote-id="+json.dumps(quote_id)+"] [data-action=\"download-quote-pdf\"]')")
    click('[data-quote-id="'+quote_id+'"] .quote-reply button[value="Aceptado"]')
    confirm_dialog()
    wait("return location.hash.includes('mi-trabajo/')",25)
    client_state=state_until(lambda s:len(s.get('works',[]))>0,20)
    work=next((w for w in client_state['works'] if w.get('requestId')==request_id or w.get('solicitudId')==request_id),None)
    assert work,client_state
    work_id=work['id']

    print("[4/7] Admin: programa, asigna equipo; cliente sube comprobante y Admin lo confirma")
    clear_session()
    login('admin@amc.test','AMC-Prueba-2026!','admin-v3')
    go(BASE+"/#obra-admin/"+work_id)
    wait("return !!document.querySelector('[data-action=\"program-admin\"][data-id="+json.dumps(work_id)+"]')")
    click('[data-action="program-admin"][data-id="'+work_id+'"]')
    wait("return !!document.querySelector('#calendar-form') && location.hash==='#calendario'",20)
    set_value('#calendar-form [name="status"]','Confirmada')
    set_value('#calendar-form [name="slot"]','Día completo')
    set_value('#calendar-form [name="start"]','2030-06-03')
    set_value('#calendar-form [name="end"]','2030-06-03')
    submit('#calendar-form')
    wait("return location.hash==="+json.dumps('#obra-admin/'+work_id)+" && document.body.innerText.includes('Fecha confirmada')",25)
    wait("return !!document.querySelector('[data-action=\"assign-team-admin\"][data-id="+json.dumps(work_id)+"]')")
    click('[data-action="assign-team-admin"][data-id="'+work_id+'"]')
    wait("return !!document.querySelector('#assign-team-form')")
    member='[data-team-member="'+employee_id+'"]'
    js("""
      const row=document.querySelector(arguments[0]),check=row?.querySelector('input[type=checkbox]');
      if(!row||!check)return false;check.checked=true;check.dispatchEvent(new Event('change',{bubbles:true}));
      row.querySelector('[name=dailyCost]').value='50000';row.querySelector('[name=estimatedDays]').value='1';return true;
    """,[member])
    set_value('#assign-team-form [name="time"]','09:00')
    set_value('#assign-team-form [name="address"]','Ruta 38 321')
    set_value('#assign-team-form [name="instructions"]','Realizar revoque y pintura; documentar antes, durante y después.')
    submit('#assign-team-form')
    wait("return !document.querySelector('#assign-team-dialog[open]') && document.body.innerText.includes('Empleado Piloto')",25)
    admin_state=state_until(lambda s:any(a.get('workId')==work_id and a.get('employeeId')==employee_id for a in s.get('assignments',[])),20)
    assignment=next(a for a in admin_state['assignments'] if a.get('workId')==work_id and a.get('employeeId')==employee_id)
    assignment_id=assignment['id']

    clear_session()
    login(CLIENT_EMAIL,CLIENT_PASSWORD,'client-v5')
    go(BASE+"/#comprobantes")
    wait("return !!document.querySelector('.receipt-form')")
    set_value('.receipt-form [name="workId"]',work_id)
    set_value('.receipt-form [name="amount"]','250')
    set_value('.receipt-form [name="day"]','2026-09-16')
    set_value('.receipt-form [name="reference"]','transferencia-piloto-001')
    attach_png('.receipt-form [name="file"]','comprobante-piloto.png')
    submit('.receipt-form')
    wait("return document.body.innerText.includes('transferencia-piloto-001') && document.body.innerText.includes('Pendiente')",25)
    client_state=api('/api/state',None,'GET')
    receipt=next((r for r in client_state.get('receipts',[]) if r.get('reference')=='transferencia-piloto-001'),None)
    assert receipt,client_state
    receipt_id=receipt['id']

    clear_session()
    login('admin@amc.test','AMC-Prueba-2026!','admin-v3')
    go(BASE+"/#comprobantes")
    wait("return !!document.querySelector('.receipt-review[data-id="+json.dumps(receipt_id)+"]')",20)
    click('.receipt-review[data-id="'+receipt_id+'"] button[value="Confirmado"]')
    confirm_dialog()
    wait("return document.body.innerText.includes('transferencia-piloto-001') && document.body.innerText.includes('Confirmado')",25)
    admin_state=api('/api/state',None,'GET')
    paid_work=next(w for w in admin_state['works'] if w['id']==work_id)
    assert any(abs(float(p.get('amount',0))-250)<0.01 for p in paid_work.get('payments',[])),paid_work

    print("[5/7] Empleado: inicia, adjunta foto, usa chat con Admin y finaliza por UI")
    clear_session()
    login(EMPLOYEE_EMAIL,EMPLOYEE_PASSWORD,'employee-v4')
    go(BASE+"/#trabajo/"+assignment_id)
    wait("return !!document.querySelector('.task-report') && document.body.innerText.includes('Iniciar trabajo')",20)
    set_value('.task-report [name="category"]','Durante')
    set_value('.task-report [name="text"]','Inicio del trabajo piloto con registro fotográfico.')
    attach_png('.task-report [name="photos"]','avance-piloto.png')
    submit('.task-report')
    wait("return !!document.querySelector('.task-report') && document.body.innerText.includes('Finalizar trabajo')",25)
    employee_state=api('/api/state',None,'GET')
    task=next(a for a in employee_state['assignments'] if a['id']==assignment_id)
    assert task.get('status')=='En el lugar',task
    assert any(r.get('photos') for r in task.get('reports',[])),task

    go(BASE+"/#chat-equipo")
    wait("return !!document.querySelector('.staff-message')")
    set_value('.staff-message textarea[name="text"]',CHAT_TEXT)
    attach_png('.staff-message input[name="photos"]','chat-avance-piloto.png')
    submit('.staff-message')
    wait("return document.body.innerText.includes("+json.dumps(CHAT_TEXT)+")",25)
    employee_state=api('/api/state',None,'GET')
    assert any(m.get('text')==CHAT_TEXT and m.get('photos') for m in employee_state.get('staffMessages',[])),employee_state.get('staffMessages',[])

    go(BASE+"/#trabajo/"+assignment_id)
    wait("return !!document.querySelector('.task-report') && document.body.innerText.includes('Finalizar trabajo')")
    set_value('.task-report [name="category"]','Después')
    set_value('.task-report [name="text"]','Trabajo piloto terminado y sector limpio.')
    attach_png('.task-report [name="photos"]','final-piloto.png')
    submit('.task-report')
    wait("return !document.querySelector('.task-report') && document.body.innerText.includes('Finalizado')",25)
    employee_state=api('/api/state',None,'GET')
    task=next(a for a in employee_state['assignments'] if a['id']==assignment_id)
    assert task.get('status')=='Finalizada',task
    assert len(task.get('reports',[]))>=2,task

    print("[6/7] Admin: verifica informe/fotos y registra cierre desde UI")
    clear_session()
    login('admin@amc.test','AMC-Prueba-2026!','admin-v3')
    go(BASE+"/#tareas")
    wait("return document.body.innerText.includes('Empleado Piloto') && document.body.innerText.includes('Trabajo piloto terminado')",20)
    assert js("return document.querySelectorAll('.task-report-item img').length>=2")
    go(BASE+"/#obra-admin/"+work_id)
    wait("return document.body.innerText.includes('Finalizada') && !!document.querySelector('[data-action=\"close-work-admin\"]')",20)
    click('[data-action="close-work-admin"][data-id="'+work_id+'"]')
    wait("return location.hash==='#cierre' && !!document.querySelector('.closure-form')")
    set_value('.closure-form [name="workId"]',work_id)
    set_value('.closure-form [name="summary"]',CLOSURE_TEXT)
    set_value('.closure-form [name="pending"]','Sin pendientes; cliente puede revisar el cierre.')
    attach_png('.closure-form [name="photos"]','cierre-piloto.png')
    submit('.closure-form')
    wait("return document.body.innerText.includes("+json.dumps(CLOSURE_TEXT)+") && document.body.innerText.includes('Pendiente de conformidad')",25)
    admin_state=api('/api/state',None,'GET')
    closure=next((c for c in admin_state.get('closures',[]) if c.get('workId')==work_id and c.get('summary')==CLOSURE_TEXT),None)
    assert closure,admin_state.get('closures',[])
    closure_id=closure['id']
    final_admin_work=next(w for w in admin_state['works'] if w['id']==work_id)
    assert final_admin_work.get('status')=='Finalizado',final_admin_work

    print("[7/7] Cliente: ve pago/cierre y da conformidad desde UI")
    clear_session()
    login(CLIENT_EMAIL,CLIENT_PASSWORD,'client-v5')
    go(BASE+"/#mi-trabajo/"+request_id)
    wait("return document.body.innerText.includes('Pagos registrados') && document.body.innerText.includes('Saldo')",20)
    go(BASE+"/#cierre")
    wait("return !!document.querySelector('.closure-reply[data-id="+json.dumps(closure_id)+"]')",20)
    assert CLOSURE_TEXT in visible_text()
    click('.closure-reply[data-id="'+closure_id+'"] button[value="Conforme"]')
    confirm_dialog()
    wait("return document.body.innerText.includes('Conforme')",25)
    final_state=api('/api/state',None,'GET')
    final_closure=next(c for c in final_state['closures'] if c['id']==closure_id)
    final_work=next(w for w in final_state['works'] if w['id']==work_id)
    assert final_closure.get('status')=='Conforme',final_closure
    assert final_work.get('status')=='Finalizado',final_work
    assert any(abs(float(p.get('amount',0))-250)<0.01 for p in final_work.get('payments',[])),final_work

    print('PILOTO_COMERCIAL_UI_OK')
finally:
    try:
        call('DELETE',prefix)
    except Exception:
        pass