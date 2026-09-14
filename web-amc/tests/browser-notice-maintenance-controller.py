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
        const module=await import('/app-shell-notice-click-controller.js');
        const doc=document.implementation.createHTMLDocument('notice-controller-test');
        const app=doc.createElement('div');app.id='app';doc.body.append(app);
        const count=doc.createElement('span');count.id='notice-count';count.textContent='1';doc.body.append(count);
        const toast=doc.createElement('div');toast.id='toast';doc.body.append(toast);
        const card=(id,unread)=>{
          const article=doc.createElement('article');article.dataset.noticeCard=id;article.className='notification'+(unread?' unread':'');app.append(article);return article;
        };
        const read=card('r1',false),unread=card('u1',true);
        const deleteRead=doc.createElement('button');deleteRead.dataset.maintenanceAction='delete-read-notices';doc.body.append(deleteRead);
        const deleteAll=doc.createElement('button');deleteAll.dataset.maintenanceAction='delete-all-notices';doc.body.append(deleteAll);
        const apiCalls=[],toasts=[],confirms=[];
        const runtime=module.createAppShellNoticeClickController({
          documentRef:doc,
          locationRef:{href:BASE+'/#avisos',hash:'#avisos'},
          api:async(path,body)=>{apiCalls.push({path,body});return {};},
          applyNoticeRead:()=>{},
          onError:error=>toasts.push('ERROR:'+error.message),
          onSuccess:text=>toasts.push(text),
          confirmAction:async(message,title,label)=>{confirms.push({message,title,label});return true;},
          createMutationObserver:()=>null,
        });
        const event=target=>({target,preventDefault:()=>{},stopPropagation:()=>{},stopImmediatePropagation:()=>{}});
        await runtime.handleClick(event(deleteRead));
        const afterRead={
          readPresent:!!doc.querySelector('[data-notice-card="r1"]'),
          unreadPresent:!!doc.querySelector('[data-notice-card="u1"]'),
          count:count.textContent,
          hidden:count.hidden,
        };
        await runtime.handleClick(event(deleteAll));
        const afterAll={
          cards:doc.querySelectorAll('[data-notice-card]').length,
          count:count.textContent,
          hidden:count.hidden,
        };
        return {afterRead,afterAll,apiCalls,toasts,confirms,readConnected:read.isConnected,unreadConnected:unread.isConnected};
      })().then(done).catch(error=>done({error:String(error&&error.stack||error)}));
    """.replace("BASE", json.dumps(BASE)))
    assert not result.get("error"), result
    assert result["afterRead"] == {"readPresent": False, "unreadPresent": True, "count": "1", "hidden": False}, result
    assert result["afterAll"] == {"cards": 0, "count": "0", "hidden": True}, result
    assert result["apiCalls"] == [
        {"path": "/api/notices/read", "body": {"deleteScope": "read"}},
        {"path": "/api/notices/read", "body": {"deleteScope": "all"}},
    ], result
    assert result["toasts"] == ["Avisos leídos borrados.", "Bandeja de avisos vaciada."], result
    assert len(result["confirms"]) == 2, result
finally:
    try:
        call("DELETE", prefix)
    except Exception:
        pass

print("Contrato real de mantenimiento de Avisos: OK")
