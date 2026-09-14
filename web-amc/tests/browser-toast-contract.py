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
        time.sleep(0.1)
    raise AssertionError("Tiempo agotado. Último resultado: " + repr(last))


def show_toast(text):
    js(
        "const toast=document.querySelector('#toast');"
        "toast.textContent=" + json.dumps(text) + ";"
        "toast.classList.add('show');return true;"
    )


try:
    go(BASE + "/#inicio")
    wait("return !!document.querySelector('#toast') && !document.querySelector('#boot-loader')")

    show_toast("Toast normal de contrato")
    time.sleep(0.25)
    assert js("return document.querySelector('#toast').classList.contains('show')")
    time.sleep(2.35)
    assert js("return document.querySelector('#toast').classList.contains('show')")
    wait("return !document.querySelector('#toast').classList.contains('show')", 1.2)

    show_toast("Primer mensaje")
    time.sleep(2.0)
    js("document.querySelector('#toast').textContent='Segundo mensaje';return true;")
    time.sleep(1.3)
    assert js("return document.querySelector('#toast').classList.contains('show')")
    wait("return !document.querySelector('#toast').classList.contains('show')", 2.2)

    show_toast("Avisos leídos borrados.")
    wait("return !document.querySelector('#toast').classList.contains('show')", 1.0)

finally:
    try:
        call("DELETE", prefix)
    except Exception:
        pass

print("Contrato real de toast: OK")
