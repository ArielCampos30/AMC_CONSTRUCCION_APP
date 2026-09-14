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


def js(script):
    return call("POST", prefix + "/execute/sync", {"script": script, "args": []})


def js_async(script):
    return call("POST", prefix + "/execute/async", {"script": script, "args": []})


def go(url):
    call("POST", prefix + "/url", {"url": url})


try:
    go(BASE + "/#inicio")
    result = js_async("""
      const done=arguments[arguments.length-1];
      (async()=>{
        const module=await import('/app-admin-staff-chat-runtime.js');
        const doc=document.implementation.createHTMLDocument('chat-runtime-test');
        const dialog=doc.createElement('dialog');dialog.id='amc-chat-dialog';dialog.setAttribute('open','');
        const row=doc.createElement('button');row.className='chat-contact';row.dataset.contact='employee-test';
        const thread=doc.createElement('section');thread.className='compact-thread';
        const log=doc.createElement('div');log.className='message-log';
        const optimistic=doc.createElement('article');optimistic.className='message mine optimistic';optimistic.dataset.messageId='local-optimistic';optimistic.textContent='Mensaje optimista';log.append(optimistic);
        const form=doc.createElement('form');form.className='message-form floating-staff-message';
        const textarea=doc.createElement('textarea');textarea.name='text';form.append(textarea);
        thread.append(log,form);dialog.append(row,thread);doc.body.append(dialog);
        let captured=null;
        const runtime=module.createAdminStaffChatRuntime({
          documentRef:doc,
          fetchImpl:async(url,options)=>{captured={url,options};return {ok:true,json:async()=>({readAt:'2030-01-01T10:06:00.000Z',messages:[
            {id:'m2',senderRole:'admin',senderName:'AMC',text:'Segundo',date:'2030-01-01T10:05:00.000Z'},
            {id:'m1',senderRole:'employee',senderName:'Operario',text:'Primero',date:'2030-01-01T10:00:00.000Z'}
          ]})};},
          requestAnimationFrameRef:callback=>callback(),
          setTimeoutRef:callback=>{callback();return 1;},
        });
        runtime.attach();
        row.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
        row.dispatchEvent(new MouseEvent('click',{bubbles:true}));
        await new Promise(resolve=>setTimeout(resolve,20));
        const messages=[...log.querySelectorAll('.message')];
        const empty=doc.createElement('div');empty.className='empty-conversation';thread.insertBefore(empty,form);
        form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
        return {
          employeeId:runtime.getEmployeeId(),
          url:captured?.url||'',
          credentials:captured?.options?.credentials||'',
          ids:messages.map(node=>node.dataset.messageId||''),
          text:log.textContent,
          optimisticPreserved:!!log.querySelector('[data-message-id="local-optimistic"]'),
          readReceipt:!!log.querySelector('[data-message-id="m2"] .message-check.read[title="Leído"]'),
          emptyRemoved:!thread.querySelector('.empty-conversation')
        };
      })().then(done).catch(error=>done({error:String(error&&error.stack||error)}));
    """)
    assert not result.get("error"), result
    assert result["employeeId"] == "employee-test", result
    assert result["url"] == "/api/staff-chat/messages?employeeId=employee-test", result
    assert result["credentials"] == "same-origin", result
    assert result["ids"][:2] == ["m1", "m2"], result
    assert result["optimisticPreserved"], result
    assert result["readReceipt"], result
    assert result["emptyRemoved"], result
    assert "Primero" in result["text"] and "Segundo" in result["text"] and "Mensaje optimista" in result["text"], result
finally:
    try:
        call("DELETE", prefix)
    except Exception:
        pass

print("Contrato real del runtime chat flotante Admin-Equipo: OK")
