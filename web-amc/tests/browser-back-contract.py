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
options = {"args": ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--window-size=1280,900"]}
if binary:
    options["binary"] = binary
session = call("POST", "/session", {"capabilities": {"alwaysMatch": {"browserName": "chrome", "goog:chromeOptions": options}}})
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
      let value=raw;
      try{value=raw?JSON.parse(raw):{};}catch{}
      return {status:response.status,data:value};
    })().then(done).catch(error=>done({__error:String(error&&error.message||error)}));
    """
    result = js_async(script, [path, payload, method])
    if result["status"] not in expected:
        raise AssertionError(path + " devolvió " + str(result["status"]) + ": " + repr(result["data"]))
    return result["data"]


def assert_one_global_back():
    wait("return document.querySelectorAll('[data-global-back]').length===1")
    assert js("return document.querySelectorAll('[data-global-back]').length") == 1


def click_global_back(expected_hash):
    assert_one_global_back()
    js("document.querySelector('[data-global-back]').click();return true;")
    wait("return location.hash===" + json.dumps(expected_hash))


stamp = str(int(time.time() * 1000))
client_email = "back-client-" + stamp + "@amc.test"
client_password = "Strong-Back-Client-2026!"
employee_email = "back-employee-" + stamp + "@amc.test"
employee_password = "Strong-Back-Employee-2026!"

try:
    # Público: nunca agrega el Volver global.
    go(BASE + "/#servicios")
    wait("return !!document.querySelector('.workspace') && !document.querySelector('#boot-loader')")
    time.sleep(0.2)
    assert not js("return !!document.querySelector('[data-global-back]')")

    # Cliente: una pantalla sin Volver propio recibe uno y vuelve a su raíz.
    go(BASE + "/#registro")
    wait("return !!document.querySelector('#auth[data-register=\"true\"]')")
    js(
        "const f=document.querySelector('#auth');"
        "f.elements.name.value='Cliente Back';"
        "f.elements.email.value=" + json.dumps(client_email) + ";"
        "f.elements.password.value=" + json.dumps(client_password) + ";"
        "f.elements.passwordConfirm.value=" + json.dumps(client_password) + ";"
        "f.requestSubmit();return true;"
    )
    wait("return document.body.classList.contains('client-v5')")
    go(BASE + "/#pedir")
    wait("return document.body.classList.contains('client-v5') && !!document.querySelector('#request')")
    click_global_back("#inicio")
    wait("return !document.querySelector('[data-global-back]')")

    # Admin: fallback general y una ruta detalle con Volver propio no se duplican.
    clear_session()
    login("admin@amc.test", "AMC-Prueba-2026!", "admin-v3")
    go(BASE + "/#presupuestos")
    wait("return document.body.classList.contains('admin-v3')")
    click_global_back("#inicio")
    go(BASE + "/#cliente/no-existe")
    wait("return document.body.classList.contains('admin-v3') && !!document.querySelector('[data-action=\"back\"]')")
    time.sleep(0.2)
    assert not js("return !!document.querySelector('[data-global-back]')")

    employee = api(
        "/api/employees",
        {"name": "Empleado Back", "email": employee_email, "password": employee_password, "dailyCost": 50000},
    )
    assert employee.get("id")

    # Empleado: una herramienta restringida vuelve a inicio-empleado.
    clear_session()
    login(employee_email, employee_password, "employee-v4")
    go(BASE + "/#cotizador")
    wait("return document.body.classList.contains('employee-v4') && document.body.innerText.includes('Acceso reservado')")
    click_global_back("#inicio-empleado")
    wait("return !document.querySelector('[data-global-back]')")
finally:
    try:
        call("DELETE", prefix)
    except Exception:
        pass
