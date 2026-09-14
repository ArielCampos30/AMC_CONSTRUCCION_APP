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


def js_async(script):
    return call("POST", prefix + "/execute/async", {"script": script, "args": []})


def go(url):
    call("POST", prefix + "/url", {"url": url})


def wait(script, seconds=10):
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


try:
    go(BASE + "/#inicio")
    wait("return document.readyState==='complete' && !!document.body")
    result = js_async(
        """
        const done=arguments[arguments.length-1];
        (async()=>{
          document.querySelector('#amc-chat-dialog')?.remove();
          document.querySelectorAll('.floating-chat-button').forEach(node=>node.remove());
          const {createFloatingChat}=await import('/floating-chat.js');
          const runtime=createFloatingChat({
            allowed:()=>true,
            renderChat:()=>'<section class="conversation"><div class="message-log"></div><form class="message-form"><textarea name="text"></textarea><input name="photos" type="file"><button type="submit">Enviar</button></form></section>',
            mounted:()=>{},
            label:()=> 'Chats',
            contacts:()=>[{id:'c1',name:'Cliente',service:'Obra'}],
            current:()=> 'c1',
            select:()=>{},
          });
          runtime.sync('u1');
          runtime.open();
          window.__floatingChatContract=runtime;
          return true;
        })().then(done).catch(error=>done({error:String(error&&error.message||error)}));
        """
    )
    if isinstance(result, dict) and result.get("error"):
        raise AssertionError(result["error"])

    wait("return !!document.querySelector('#amc-chat-dialog[open] .chat-contact')")
    js("document.querySelector('#amc-chat-dialog .chat-contact').click();return true;")
    wait("return !!document.querySelector('#amc-chat-dialog[open] .compact-composer')")

    layout = js(
        """
        const form=document.querySelector('#amc-chat-dialog .compact-composer');
        const textarea=form.querySelector('textarea');
        const attach=form.querySelector('.chat-icon-button:not(.chat-send-icon)');
        const send=form.querySelector('.chat-send-icon');
        return {
          columns:getComputedStyle(form).gridTemplateColumns,
          textarea:getComputedStyle(textarea).gridColumnStart,
          attach:getComputedStyle(attach).gridColumnStart,
          send:getComputedStyle(send).gridColumnStart,
        };
        """
    )
    assert layout["textarea"] == "2", layout
    assert layout["attach"] == "1", layout
    assert layout["send"] == "3", layout
    assert layout["columns"].startswith("40px ") and layout["columns"].endswith(" 44px"), layout

    closed = js(
        """
        const dialog=document.querySelector('#amc-chat-dialog');
        const rect=dialog.getBoundingClientRect();
        document.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:Math.max(0,rect.left-8),clientY:Math.max(0,rect.top-8)}));
        return !dialog.open;
        """
    )
    assert closed is True

    js("window.__floatingChatContract.open();return true;")
    wait("return !!document.querySelector('#amc-chat-dialog[open]')")
    js("document.querySelector('#amc-chat-dialog .chat-icon-button[aria-label=\"Cerrar conversación\"]')?.click();return true;")
    wait("return !document.querySelector('#amc-chat-dialog[open]')")
finally:
    try:
        call("DELETE", prefix)
    except Exception:
        pass
