import json
import os
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
options = {"args": ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--window-size=1280,900"]}
if binary:
    options["binary"] = binary
session = call("POST", "/session", {"capabilities": {"alwaysMatch": {"browserName": "chrome", "goog:chromeOptions": options}}})
session_id = session.get("sessionId") if isinstance(session, dict) else None
if not session_id:
    raise SystemExit("No se pudo iniciar Chrome: " + repr(session))
prefix = "/session/" + session_id


def js_async(script):
    return call("POST", prefix + "/execute/async", {"script": script, "args": []})


def go(url):
    call("POST", prefix + "/url", {"url": url})


try:
    go(BASE + "/#inicio")
    result = js_async("""
      const done=arguments[arguments.length-1];
      (async()=>{
        const module=await import('/app-admin-quote-maintenance-controller.js');
        const doc=document.implementation.createHTMLDocument('quote-maintenance-test');
        const toast=doc.createElement('div');toast.id='toast';doc.body.append(toast);
        const list=doc.createElement('section');doc.body.append(list);
        const makeCard=(id,action)=>{
          const card=doc.createElement('article');card.className='admin-v3-card';card.dataset.quoteId=id;
          const button=doc.createElement('button');button.dataset.maintenanceAction=action;button.dataset.id=id;card.append(button);list.append(card);
          return {card,button};
        };
        const archived=makeCard('q archive','archive-quote');
        const recovered=makeCard('q-recover','unarchive-quote');
        const deleted=makeCard('q-delete','delete-quote');
        const failed=makeCard('q-fail','unarchive-quote');
        const apiCalls=[],messages=[],errors=[],confirms=[];
        const runtime=module.createAdminQuoteMaintenanceController({
          documentRef:doc,
          api:async(path,body)=>{
            apiCalls.push({path,body});
            if(path.includes('q-fail'))throw new Error('fallo controlado');
            return {};
          },
          onSuccess:text=>messages.push(text),
          onError:error=>errors.push(error.message),
          confirmAction:async(message,title,label)=>{confirms.push({message,title,label});return true;},
        });
        const event=target=>({target,preventDefault:()=>{},stopImmediatePropagation:()=>{}});
        await runtime.handleClick(event(archived.button));
        await runtime.handleClick(event(recovered.button));
        await runtime.handleClick(event(deleted.button));
        await runtime.handleClick(event(failed.button));
        return {
          remaining:[...list.querySelectorAll('.admin-v3-card')].map(card=>card.dataset.quoteId),
          apiCalls,messages,errors,confirms,
          disabled:[archived.button.disabled,recovered.button.disabled,deleted.button.disabled,failed.button.disabled],
        };
      })().then(done).catch(error=>done({error:String(error&&error.stack||error)}));
    """)
    assert not result.get("error"), result
    assert result["remaining"] == ["q-fail"], result
    assert result["apiCalls"] == [
        {"path": "/api/quotes/q%20archive/archive", "body": {}},
        {"path": "/api/quotes/q-recover/unarchive", "body": {}},
        {"path": "/api/quotes/q-delete/delete", "body": {}},
        {"path": "/api/quotes/q-fail/unarchive", "body": {}},
    ], result
    assert result["messages"] == ["Presupuesto archivado.", "Presupuesto recuperado.", "Presupuesto eliminado."], result
    assert result["errors"] == ["fallo controlado"], result
    assert len(result["confirms"]) == 2, result
    assert result["disabled"] == [False, False, False, False], result
finally:
    try:
        call("DELETE", prefix)
    except Exception:
        pass

print("Contrato real del mantenimiento de Presupuestos archivados: OK")
