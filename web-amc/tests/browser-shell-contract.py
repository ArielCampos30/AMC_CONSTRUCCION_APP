import json
import os
import time
import urllib.request


DRIVER = "http://127.0.0.1:9515"
BASE = "http://localhost:4180"


def call(method, path, payload=None):
    data = None if payload is None else json.dumps(payload).encode()
    request = urllib.request.Request(
        DRIVER + path,
        data=data,
        method=method,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        body = json.loads(response.read().decode() or "{}")
    return body.get("value", body)


binary = os.environ.get("AMC_CHROME_BINARY")
options = {
    "args": [
        "--headless=new",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--window-size=1280,900",
    ]
}
if binary:
    options["binary"] = binary
session = call(
    "POST",
    "/session",
    {"capabilities": {"alwaysMatch": {"browserName": "chrome", "goog:chromeOptions": options}}},
)
session_id = session.get("sessionId") if isinstance(session, dict) else None
if not session_id:
    raise SystemExit("No se pudo iniciar Chrome: " + repr(session))
prefix = "/session/" + session_id


def js(script):
    return call("POST", prefix + "/execute/sync", {"script": script, "args": []})


def js_async(script, args=None):
    result = call("POST", prefix + "/execute/async", {"script": script, "args": args or []})
    if isinstance(result, dict) and result.get("__error"):
        raise AssertionError(result["__error"])
    return result


def go(url):
    call("POST", prefix + "/url", {"url": url})


def wait(script, seconds=15):
    end = time.time() + seconds
    last = None
    while time.time() < end:
        try:
            last = js(script)
            if last:
                return last
        except Exception as error:
            last = str(error)
        time.sleep(0.15)
    raise AssertionError("Tiempo agotado. Último resultado: " + repr(last))


def clear_session():
    try:
        call("DELETE", prefix + "/cookie")
    except Exception:
        pass


def login(email, password, role_class):
    go(BASE + "/#ingresar")
    wait("return !!document.querySelector('#auth') && !document.querySelector('#boot-loader')")
    js(
        "const f=document.querySelector('#auth');"
        "f.elements.email.value=" + json.dumps(email) + ";"
        "f.elements.password.value=" + json.dumps(password) + ";"
        "f.requestSubmit();return true;"
    )
    wait("return document.body.classList.contains(" + json.dumps(role_class) + ")")


def api(path, payload=None, method=None, expected=(200, 201)):
    method = method or ("GET" if payload is None else "POST")
    script = """
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
    result = js_async(script, [path, payload, method])
    if result["status"] not in expected:
        raise AssertionError(path + " devolvió " + str(result["status"]) + ": " + repr(result["data"]))
    return result["data"]


def nav_contract(expected):
    actual = js(
        "return [...document.querySelectorAll('.bottom-nav a')]"
        ".filter(node=>node.offsetParent!==null).map(node=>(node.textContent||'').trim());"
    )
    for label in expected:
        assert any(label in item for item in actual), (expected, actual)


def open_client_chat():
    wait("return !!document.querySelector('.floating-chat-button')")
    js("document.querySelector('.floating-chat-button').click();return true;")
    wait("return !!document.querySelector('#amc-chat-dialog[open] .chat-contact')")
    js("document.querySelector('#amc-chat-dialog .chat-contact').click();return true;")
    wait("return !!document.querySelector('#amc-chat-dialog[open] .message-form[data-client]')")


def install_chat_delay(delay_ms):
    js(
        """
        window.__shellOriginalFetch=window.__shellOriginalFetch||window.fetch.bind(window);
        window.__shellChatDelay=%d;
        window.fetch=async function(...args){
          const url=String(args[0]?.url||args[0]||'');
          if(url==='/api/client-chat/messages')await new Promise(resolve=>setTimeout(resolve,window.__shellChatDelay));
          return window.__shellOriginalFetch(...args);
        };
        window.__shellSpinnerSeen=false;
        window.__shellBusyOpened=false;
        window.__shellFeedbackObserver?.disconnect();
        window.__shellFeedbackObserver=new MutationObserver(()=>{
          if(document.querySelector('.message-upload-spinner'))window.__shellSpinnerSeen=true;
          if(document.querySelector('#amc-busy-overlay[open]'))window.__shellBusyOpened=true;
        });
        window.__shellFeedbackObserver.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});
        return true;
        """ % delay_ms
    )


def send_chat(text):
    js(
        "const f=document.querySelector('#amc-chat-dialog .message-form');"
        "f.elements.text.value=" + json.dumps(text) + ";"
        "f.requestSubmit();return true;"
    )
    wait(
        "return [...document.querySelectorAll('#amc-chat-dialog .message.optimistic p')]"
        ".some(node=>node.textContent===" + json.dumps(text) + ");"
    )


stamp = str(int(time.time() * 1000))
client_email = "shell-client-" + stamp + "@amc.test"
client_password = "Strong-Shell-Client-2026!"
employee_email = "shell-employee-" + stamp + "@amc.test"
employee_password = "Strong-Shell-Employee-2026!"
client_name = "Cliente Shell " + stamp[-6:]
direct_message = "Mensaje permanente " + stamp
old_message_one = "Histórico albañilería " + stamp
old_message_two = "Histórico pintura " + stamp


try:
    # Navegación pública y protección de rutas privadas.
    go(BASE + "/#inicio")
    wait("return !!document.querySelector('.workspace') && !document.querySelector('#boot-loader')")
    assert not js("return document.body.classList.contains('admin-v3')||document.body.classList.contains('client-v5')||document.body.classList.contains('employee-v4')")
    nav_contract(["Inicio", "Servicios", "Pedir", "Mi obra", "Perfil"])
    go(BASE + "/#servicios")
    wait("return location.hash==='#servicios' && document.body.innerText.includes('Servicios')")
    go(BASE + "/#clientes")
    wait("return !!document.querySelector('#auth')")

    # Cliente: alta real, shell propio y un formulario sucio que sobrevive foco y polling.
    go(BASE + "/#registro")
    wait("return !!document.querySelector('#auth[data-register=\"true\"]')")
    js(
        "const f=document.querySelector('#auth');"
        "f.elements.name.value=" + json.dumps(client_name) + ";"
        "f.elements.email.value=" + json.dumps(client_email) + ";"
        "f.elements.password.value=" + json.dumps(client_password) + ";"
        "f.elements.passwordConfirm.value=" + json.dumps(client_password) + ";"
        "f.requestSubmit();return true;"
    )
    wait("return document.body.classList.contains('client-v5')")
    nav_contract(["Inicio", "Mis trabajos", "Perfil"])
    wait("return !document.querySelector('.bottom-nav a[href=\"#chat-cliente\"]')")

    go(BASE + "/#pedir")
    wait("return !!document.querySelector('#request textarea[name=description]')")
    js(
        """
        const f=document.querySelector('#request'),field=f.elements.description;
        f.dataset.shellMarker='preserve';field.value='Borrador que no debe perderse';
        field.dispatchEvent(new Event('input',{bubbles:true}));
        window.__shellStateFetches=0;
        window.__shellPollingFetch=window.fetch.bind(window);
        window.fetch=(...args)=>{const url=String(args[0]?.url||args[0]||'');if(url==='/api/state')window.__shellStateFetches++;return window.__shellPollingFetch(...args);};
        window.dispatchEvent(new Event('focus'));
        return true;
        """
    )
    wait("return window.__shellStateFetches>=1")
    assert js("return document.querySelector('#request')?.dataset.shellMarker==='preserve' && document.querySelector('#request textarea[name=description]')?.value==='Borrador que no debe perderse'")
    focus_fetches = js("return window.__shellStateFetches")
    wait("return window.__shellStateFetches>" + str(focus_fetches), 17)
    assert js("return document.querySelector('#request')?.dataset.shellMarker==='preserve' && document.querySelector('#request textarea[name=description]')?.value==='Borrador que no debe perderse'")
    js("window.fetch=window.__shellPollingFetch;return true;")

    # Chat rápido y lento: optimismo inmediato, spinner diferido y sin loader global.
    go(BASE + "/#inicio")
    open_client_chat()
    install_chat_delay(1000)
    send_chat(direct_message)
    time.sleep(0.25)
    assert not js("return !!document.querySelector('.message-upload-spinner')")
    assert not js("return !!document.querySelector('#amc-busy-overlay[open]')")
    time.sleep(0.35)
    assert js("return !!document.querySelector('.message-upload-spinner')")
    assert js("return window.__shellSpinnerSeen && !window.__shellBusyOpened")
    wait(
        "return [...document.querySelectorAll('#amc-chat-dialog .message:not(.optimistic) p')]"
        ".some(node=>node.textContent===" + json.dumps(direct_message) + ");",
        5,
    )

    fast_message = "Mensaje rápido " + stamp
    install_chat_delay(90)
    send_chat(fast_message)
    wait(
        "return [...document.querySelectorAll('#amc-chat-dialog .message:not(.optimistic) p')]"
        ".some(node=>node.textContent===" + json.dumps(fast_message) + ");",
        4,
    )
    time.sleep(0.5)
    assert not js("return window.__shellSpinnerSeen||window.__shellBusyOpened")
    js("window.fetch=window.__shellOriginalFetch;window.__shellFeedbackObserver.disconnect();return true;")

    # Dos solicitudes antiguas alimentan la misma conversación permanente.
    request_one = api(
        "/api/requests",
        {"name": client_name, "phone": "3548999101", "town": "La Falda", "address": "San Martín 101", "description": "Contrato histórico uno", "service": "Albañilería", "type": "presupuesto"},
    )
    request_two = api(
        "/api/requests",
        {"name": client_name, "phone": "3548999101", "town": "La Falda", "address": "San Martín 101", "description": "Contrato histórico dos", "service": "Pintura", "type": "presupuesto"},
    )
    api("/api/requests/" + request_one["id"] + "/messages", {"text": old_message_one, "photos": [], "idempotencyKey": "shell-old-message-one"})
    api("/api/requests/" + request_two["id"] + "/messages", {"text": old_message_two, "photos": [], "idempotencyKey": "shell-old-message-two"})
    client_id = api("/api/state", None, "GET")["user"]["id"]

    # Admin: navegación, no leídos, rutas heredadas y un único historial por cliente.
    clear_session()
    login("admin@amc.test", "AMC-Prueba-2026!", "admin-v3")
    nav_contract(["Inicio", "Solicitudes", "Presupuestos", "Obras", "Más"])
    admin_before = api("/api/state", None, "GET")
    assert admin_before.get("clientChatUnread", {}).get(client_id, 0) >= 4, admin_before.get("clientChatUnread")
    unread_notice_ids = {
        notice["id"]
        for notice in admin_before.get("notices", [])
        if not notice.get("read") and "chat" in notice.get("url", "")
    }
    assert unread_notice_ids

    legacy_targets = [
        "chat/" + request_one["id"],
        "chat-admin/" + request_two["id"],
        "chat-user/" + client_id,
        "conversacion/" + request_one["id"],
    ]
    for target in legacy_targets:
        js("document.querySelector('#amc-chat-dialog')?.close();return true;")
        go(BASE + "/#" + target)
        wait("return location.hash==='#inicio' && !!document.querySelector('#amc-chat-dialog[open] .message-log')")
        history = js("return document.querySelector('#amc-chat-dialog .message-log').innerText")
        assert direct_message in history and old_message_one in history and old_message_two in history, (target, history)

    end = time.time() + 8
    admin_after = None
    while time.time() < end:
        admin_after = api("/api/state", None, "GET")
        if admin_after.get("clientChatUnread", {}).get(client_id, 0) == 0:
            break
        time.sleep(0.2)
    assert admin_after.get("clientChatUnread", {}).get(client_id, 0) == 0, admin_after.get("clientChatUnread")
    notices_after = {notice["id"]: notice for notice in admin_after.get("notices", [])}
    assert all(notices_after[notice_id].get("read") for notice_id in unread_notice_ids if notice_id in notices_after)

    # Cotizador oculta/cierra el chat, pero al volver conserva exactamente el historial.
    message_ids_before_quote = {message["id"] for message in admin_after.get("messages", []) if message.get("userId") == client_id or message.get("clientId") == client_id}
    go(BASE + "/#cotizador")
    wait("return document.body.classList.contains('quote-wizard-route')")
    assert not js("return !!document.querySelector('.floating-chat-button') && document.querySelector('.floating-chat-button').offsetParent!==null")
    assert not js("return !!document.querySelector('#amc-chat-dialog[open]')")
    go(BASE + "/#inicio")
    wait("return !document.body.classList.contains('quote-wizard-route') && document.querySelector('.floating-chat-button')?.offsetParent!==null")
    go(BASE + "/#conversacion/" + request_two["id"])
    wait("return location.hash==='#inicio' && !!document.querySelector('#amc-chat-dialog[open] .message-log')")
    history = js("return document.querySelector('#amc-chat-dialog .message-log').innerText")
    assert direct_message in history and old_message_one in history and old_message_two in history
    admin_after_quote = api("/api/state", None, "GET")
    message_ids_after_quote = {message["id"] for message in admin_after_quote.get("messages", []) if message.get("userId") == client_id or message.get("clientId") == client_id}
    assert message_ids_after_quote == message_ids_before_quote

    employee = api(
        "/api/employees",
        {"name": "Empleado Shell", "email": employee_email, "password": employee_password, "dailyCost": 50000},
    )
    assert employee.get("id")

    # Empleado: shell acotado y rechazo visual de una herramienta administrativa.
    clear_session()
    login(employee_email, employee_password, "employee-v4")
    nav_contract(["Inicio", "Mis trabajos", "Chat", "Perfil"])
    go(BASE + "/#cotizador")
    wait("return document.body.innerText.includes('Acceso reservado')")

    # La sesión pública vuelve a su navegación propia al salir del flujo autenticado.
    clear_session()
    go(BASE + "/#inicio")
    wait("return !!document.querySelector('.workspace') && !document.body.classList.contains('employee-v4')")
    nav_contract(["Inicio", "Servicios", "Pedir", "Mi obra", "Perfil"])
finally:
    try:
        call("DELETE", prefix)
    except Exception:
        pass
