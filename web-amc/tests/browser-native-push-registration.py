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


def wait(script, seconds=5):
    end = time.time() + seconds
    last = None
    while time.time() < end:
        last = js(script)
        if last:
            return last
        time.sleep(0.05)
    raise AssertionError("Tiempo agotado. Último resultado: " + repr(last))


try:
    call("POST", prefix + "/url", {"url": BASE + "/#inicio"})
    wait("return document.readyState==='complete'")

    result = js_async(
        """
        const done=arguments[arguments.length-1];
        (async()=>{
          const runtime=await import('/native-push-registration-runtime.js');
          window.__pushCalls=[];
          window.AMCNative={refreshPushToken:()=>window.__pushCalls.push(performance.now())};
          runtime.refreshNativePushRegistration();
          return {type:typeof runtime.refreshNativePushRegistration,calls:window.__pushCalls.length};
        })().then(done).catch(error=>done({error:String(error&&error.message||error)}));
        """
    )
    if isinstance(result, dict) and result.get("error"):
        raise AssertionError(result["error"])
    assert result == {"type": "function", "calls": 1}, result

    js("window.dispatchEvent(new HashChangeEvent('hashchange')); return true;")
    wait("return window.__pushCalls.length>=2")

    js("window.dispatchEvent(new PageTransitionEvent('pageshow')); return true;")
    wait("return window.__pushCalls.length>=3")

    js("window.dispatchEvent(new Event('focus')); return true;")
    wait("return window.__pushCalls.length>=4")

    visible = js("return document.hidden===false")
    if visible:
        js("document.dispatchEvent(new Event('visibilitychange')); return true;")
        wait("return window.__pushCalls.length>=5")

    safe = js_async(
        """
        const done=arguments[arguments.length-1];
        (async()=>{
          delete window.AMCNative;
          const runtime=await import('/native-push-registration-runtime.js');
          runtime.refreshNativePushRegistration();
          window.dispatchEvent(new HashChangeEvent('hashchange'));
          await new Promise(resolve=>setTimeout(resolve,160));
          done({ok:true});
        })().catch(error=>done({ok:false,error:String(error&&error.message||error)}));
        """
    )
    assert safe == {"ok": True}, safe
finally:
    try:
        call("DELETE", prefix)
    except Exception:
        pass
