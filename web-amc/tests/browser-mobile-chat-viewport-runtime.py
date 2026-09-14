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
    call("POST", prefix + "/url", {"url": BASE + "/#inicio"})
    wait("return document.readyState==='complete' && !!document.body")

    result = js_async(
        """
        const done=arguments[arguments.length-1];
        (async()=>{
          document.querySelector('#amc-chat-dialog')?.remove();
          document.querySelectorAll('.floating-chat-button').forEach(node=>node.remove());
          const [{createFloatingChat},viewport]=await Promise.all([
            import('/floating-chat.js'),
            import('/mobile-chat-viewport-runtime.js')
          ]);
          const runtime=createFloatingChat({
            allowed:()=>true,
            renderChat:()=>'<section class="conversation"><div class="message-log"></div><form class="message-form"><textarea name="text"></textarea><button type="submit">Enviar</button></form></section>',
            mounted:()=>{},
            label:()=> 'Chats',
            contacts:()=>[{id:'c1',name:'Cliente',service:'Obra'}],
            current:()=> 'c1',
            select:()=>{},
          });
          runtime.sync('u1');
          runtime.open();
          window.__viewportContract={runtime,viewport};
          return {fit:typeof viewport.fitChatToViewport,dismiss:typeof viewport.dismissComposerAfterSend};
        })().then(done).catch(error=>done({error:String(error&&error.message||error)}));
        """
    )
    if isinstance(result, dict) and result.get("error"):
        raise AssertionError(result["error"])
    assert result == {"fit": "function", "dismiss": "function"}, result

    wait("return !!document.querySelector('#amc-chat-dialog[open] .chat-contact')")
    js("document.querySelector('#amc-chat-dialog .chat-contact').click();return true;")
    wait("return !!document.querySelector('#amc-chat-dialog[open] .compact-composer textarea')")

    baseline = js(
        """
        const dialog=document.querySelector('#amc-chat-dialog');
        const textarea=dialog.querySelector('.compact-composer textarea');
        textarea.focus();
        window.__viewportContract.viewport.fitChatToViewport();
        return {
          narrow:matchMedia('(max-width:560px)').matches,
          active:document.activeElement===textarea,
          keyboard:dialog.classList.contains('amc-keyboard-open'),
          top:dialog.style.getPropertyValue('--amc-vv-top'),
          height:dialog.style.getPropertyValue('--amc-vv-height')
        };
        """
    )
    assert baseline["narrow"] is True, baseline
    assert baseline["active"] is True, baseline
    assert baseline["keyboard"] is False, baseline
    assert baseline["top"] == "" and baseline["height"] == "", baseline

    js(
        """
        const form=document.querySelector('#amc-chat-dialog .compact-composer');
        form.addEventListener('submit',event=>event.preventDefault(),{once:true});
        form.dispatchEvent(new SubmitEvent('submit',{bubbles:true,cancelable:true}));
        return true;
        """
    )
    wait("return document.activeElement!==document.querySelector('#amc-chat-dialog .compact-composer textarea')")

    js(
        """
        const dialog=document.querySelector('#amc-chat-dialog');
        dialog.classList.add('amc-keyboard-open');
        dialog.style.setProperty('--amc-vv-top','18px');
        dialog.style.setProperty('--amc-vv-height','500px');
        window.dispatchEvent(new Event('orientationchange'));
        return true;
        """
    )
    wait(
        """
        const dialog=document.querySelector('#amc-chat-dialog');
        return !dialog.classList.contains('amc-keyboard-open') && !dialog.style.getPropertyValue('--amc-vv-top') && !dialog.style.getPropertyValue('--amc-vv-height');
        """,
        seconds=4,
    )
finally:
    try:
        call("DELETE", prefix)
    except Exception:
        pass
