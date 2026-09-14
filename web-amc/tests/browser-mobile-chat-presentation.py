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
    loaded = js("return [...document.styleSheets].some(sheet=>sheet.href&&sheet.href.endsWith('/mobile-chat.css'))")
    assert loaded is True

    result = js_async(
        """
        const done=arguments[arguments.length-1];
        (async()=>{
          document.querySelector('#amc-chat-dialog')?.remove();
          document.querySelectorAll('.floating-chat-button').forEach(node=>node.remove());
          const {createFloatingChat}=await import('/floating-chat.js');
          const runtime=createFloatingChat({
            allowed:()=>true,
            renderChat:()=>'<section class="conversation"><div class="message-log"><article class="message"><small class="message-meta upload-state"><span>57%</span><span class="message-upload-spinner"></span></small></article></div><form class="message-form"><textarea name="text"></textarea><button type="submit">Enviar</button></form></section>',
            mounted:()=>{},
            label:()=> 'Chats',
            contacts:()=>[{id:'c1',name:'Cliente',service:'Obra'}],
            current:()=> 'c1',
            select:()=>{},
          });
          runtime.sync('u1');
          runtime.open();
          window.__mobileChatContract=runtime;
          return true;
        })().then(done).catch(error=>done({error:String(error&&error.message||error)}));
        """
    )
    if isinstance(result, dict) and result.get("error"):
        raise AssertionError(result["error"])

    wait("return !!document.querySelector('#amc-chat-dialog[open] .chat-contact')")
    js("document.querySelector('#amc-chat-dialog .chat-contact').click();return true;")
    wait("return !!document.querySelector('#amc-chat-dialog[open] .compact-composer.no-attach')")

    layout = js(
        """
        const dialog=document.querySelector('#amc-chat-dialog');
        const form=dialog.querySelector('.compact-composer.no-attach');
        const textarea=form.querySelector('textarea');
        const send=form.querySelector('.chat-send-icon');
        const hidden=dialog.querySelector('.upload-state>span:not(.message-upload-spinner)');
        const spinner=dialog.querySelector('.message-upload-spinner');
        const rect=dialog.getBoundingClientRect();
        return {
          viewport:[innerWidth,innerHeight],
          dialog:[rect.left,rect.right,rect.width],
          columns:getComputedStyle(form).gridTemplateColumns,
          textareaColumn:getComputedStyle(textarea).gridColumnStart,
          sendColumn:getComputedStyle(send).gridColumnStart,
          sendWidth:getComputedStyle(send).width,
          overflow:document.documentElement.scrollWidth>innerWidth+1,
          hidden:getComputedStyle(hidden).display,
          spinner:getComputedStyle(spinner).display,
          spinnerSize:[getComputedStyle(spinner).width,getComputedStyle(spinner).height],
        };
        """
    )
    assert layout["viewport"][0] <= 560, layout
    assert layout["dialog"][0] >= 11 and layout["dialog"][1] <= layout["viewport"][0] - 11, layout
    assert layout["textareaColumn"] == "1", layout
    assert layout["sendColumn"] == "2", layout
    assert layout["columns"].endswith(" 44px"), layout
    assert layout["sendWidth"] == "44px", layout
    assert layout["overflow"] is False, layout
    assert layout["hidden"] == "none", layout
    assert layout["spinner"] != "none", layout
    assert layout["spinnerSize"] == ["11px", "11px"], layout

    keyboard = js(
        """
        const dialog=document.querySelector('#amc-chat-dialog');
        dialog.style.setProperty('--amc-vv-top','18px');
        dialog.style.setProperty('--amc-vv-height','500px');
        dialog.classList.add('amc-keyboard-open');
        const style=getComputedStyle(dialog),rect=dialog.getBoundingClientRect();
        return {position:style.position,top:style.top,left:style.left,right:style.right,height:style.height,maxHeight:style.maxHeight,margin:style.margin,rect:[rect.left,rect.right,rect.top,rect.bottom]};
        """
    )
    assert keyboard["position"] == "fixed", keyboard
    assert keyboard["top"] == "18px", keyboard
    assert keyboard["left"] == "12px" and keyboard["right"] == "12px", keyboard
    assert keyboard["height"] == "500px" and keyboard["maxHeight"] == "500px", keyboard
    assert keyboard["margin"] == "0px", keyboard
    assert keyboard["rect"][0] >= 11 and keyboard["rect"][1] <= layout["viewport"][0] - 11, keyboard

    closed = js(
        """
        const dialog=document.querySelector('#amc-chat-dialog');
        const rect=dialog.getBoundingClientRect();
        document.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:Math.max(0,rect.left-8),clientY:Math.max(0,rect.top-8)}));
        return !dialog.open;
        """
    )
    assert closed is True
    js("window.__mobileChatContract.open();return true;")
    wait("return !!document.querySelector('#amc-chat-dialog[open]')")
    js("document.querySelector('#amc-chat-dialog .chat-icon-button[aria-label=\"Cerrar conversación\"]')?.click();return true;")
    wait("return !document.querySelector('#amc-chat-dialog[open]')")
finally:
    try:
        call("DELETE", prefix)
    except Exception:
        pass
