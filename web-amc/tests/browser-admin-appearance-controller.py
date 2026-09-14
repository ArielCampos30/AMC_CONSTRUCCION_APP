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
        const module=await import('/app-admin-appearance-controller.js');
        const doc=document.implementation.createHTMLDocument('appearance-controller-test');
        const app=doc.createElement('div');app.id='app';doc.body.append(app);
        const toast=doc.createElement('div');toast.id='toast';doc.body.append(toast);
        const form=doc.createElement('form');form.id='appearance-form';
        const list=doc.createElement('div');list.className='appearance-photo-list';
        const card=(id,label)=>{
          const article=doc.createElement('article');article.className='appearance-photo-card';article.dataset.id=id;
          const badge=doc.createElement('strong');badge.dataset.photoRole='';badge.textContent=label;article.append(badge);
          return article;
        };
        const a=card('a','Foto principal'),b=card('b','Galería'),c=card('c','Galería');list.append(a,b,c);form.append(list);doc.body.append(form);
        const main=doc.createElement('button');main.dataset.maintenanceAction='appearance-main-photo';b.append(main);
        const remove=doc.createElement('button');remove.dataset.maintenanceAction='appearance-remove-photo';c.append(remove);
        const clear=doc.createElement('button');clear.dataset.maintenanceAction='appearance-clear-photos';form.append(clear);
        const restore=doc.createElement('button');restore.dataset.maintenanceAction='restore-appearance';restore.dataset.version='2030-02-03T04:05:06.000Z';doc.body.append(restore);
        const apiCalls=[],toasts=[],focus=[];
        const windowRef={location:{hash:'#portada'},AMCConfirm:async()=>true,confirm:()=>true,dispatchEvent:event=>focus.push(event.type),addEventListener:()=>{}};
        const runtime=module.createAdminAppearanceController({
          documentRef:doc,windowRef,
          api:async(path,body)=>{apiCalls.push({path,body});return {};},
          toast:text=>toasts.push(text),
          confirmAction:async()=>true,
          setTimeoutRef:callback=>{callback();return 1;},
          queueMicrotaskRef:callback=>callback(),
          MutationObserverRef:null,
        });
        runtime.refreshAppearanceLabels();
        await runtime.handleClick({target:main});
        const orderAfterMain=[...list.children].map(node=>node.dataset.id);
        const labelsAfterMain=[...list.querySelectorAll('[data-photo-role]')].map(node=>node.textContent);
        await runtime.handleClick({target:remove});
        const countAfterRemove=list.querySelectorAll('.appearance-photo-card').length;
        await runtime.handleClick({target:restore,preventDefault:()=>{},stopImmediatePropagation:()=>{}});
        await runtime.handleClick({target:clear});
        return {orderAfterMain,labelsAfterMain,countAfterRemove,countAfterClear:list.children.length,apiCalls,toasts,focus,restoreDisabled:restore.disabled};
      })().then(done).catch(error=>done({error:String(error&&error.stack||error)}));
    """)
    assert not result.get("error"), result
    assert result["orderAfterMain"] == ["b", "a", "c"], result
    assert result["labelsAfterMain"] == ["Foto principal", "Galería", "Galería"], result
    assert result["countAfterRemove"] == 2, result
    assert result["countAfterClear"] == 0, result
    assert result["apiCalls"] == [{"path": "/api/appearance/restore", "body": {"versionAt": "2030-02-03T04:05:06.000Z"}}], result
    assert result["toasts"] == ["Portada restaurada."], result
    assert result["focus"] == ["focus"], result
    assert result["restoreDisabled"] is False, result
finally:
    try:
        call("DELETE", prefix)
    except Exception:
        pass

print("Contrato real del controlador Admin Apariencia: OK")
