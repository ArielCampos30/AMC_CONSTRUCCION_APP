import json, os, time, urllib.request

DRIVER="http://127.0.0.1:9515"
BASE="http://localhost:4180"

def call(method,path,payload=None):
    data=None if payload is None else json.dumps(payload).encode()
    req=urllib.request.Request(DRIVER+path,data=data,method=method,headers={"Content-Type":"application/json"})
    with urllib.request.urlopen(req,timeout=15) as response:
        body=json.loads(response.read().decode() or "{}")
    return body.get("value",body)

binary=os.environ.get("AMC_CHROME_BINARY")
options={"args":["--headless=new","--no-sandbox","--disable-dev-shm-usage","--window-size=1280,900"]}
if binary: options["binary"]=binary
session=call("POST","/session",{"capabilities":{"alwaysMatch":{"browserName":"chrome","goog:chromeOptions":options}}})
session_id=session.get("sessionId") if isinstance(session,dict) else None
if not session_id:
    raise SystemExit("No se pudo iniciar Chrome: "+repr(session))
prefix="/session/"+session_id

def js(script):
    return call("POST",prefix+"/execute/sync",{"script":script,"args":[]})

def go(url):
    call("POST",prefix+"/url",{"url":url})

def wait(script,seconds=12):
    end=time.time()+seconds
    last=None
    while time.time()<end:
        try:
            last=js(script)
            if last:return last
        except Exception as exc:
            last=str(exc)
        time.sleep(.2)
    raise AssertionError("Tiempo agotado. Último resultado: "+repr(last))

def login(email,password,role_class):
    go(BASE+"/#ingresar")
    wait("return !!document.querySelector('#auth') && !document.querySelector('#boot-loader')")
    assert "Cargando tus espacios" not in js("return document.body.innerText")
    js("const f=document.querySelector('#auth');f.elements.email.value="+json.dumps(email)+";f.elements.password.value="+json.dumps(password)+";f.requestSubmit();return true;")
    wait("return document.body.classList.contains("+json.dumps(role_class)+") && !!document.querySelector('.workspace')")
    assert not js("return !!document.querySelector('#boot-loader')")
    audit=js("""return {
      overflow: document.documentElement.scrollWidth > innerWidth + 2,
      buttons:[...document.querySelectorAll('button')].filter(b=>b.offsetParent!==null&&!((b.textContent||'').trim()||b.getAttribute('aria-label')||b.title)).length,
      images:[...document.images].filter(i=>!i.hasAttribute('alt')).length,
      dialogs:[...document.querySelectorAll('dialog[open]')].filter(d=>!d.getAttribute('aria-label')&&!d.querySelector('h1,h2,[aria-labelledby]')).length
    }""")
    assert audit=={"overflow":False,"buttons":0,"images":0,"dialogs":0},audit

def quote_shell_audit():
    return js("""const host=document.querySelector('.quote-wizard-host'),header=host?.querySelector('.quote-wizard-header'),steps=host?.querySelector('.quote-wizard-steps'),title=host?.querySelector('#quote-wizard-title'),close=host?.querySelector('.quote-wizard-close'),icon=close?.querySelector('svg'),controls=host?.querySelector('.quote-wizard-controls'),main=document.querySelector('.workspace>main'),nav=document.querySelector('.bottom-nav'),bubble=document.querySelector('.floating-chat-button'),pricing=[...host?.querySelectorAll('.quote-pricing-tabs button')||[]],client=host?.querySelector('[data-qw-client]'),addClient=host?.querySelector('[data-qw-new-client]');const rect=n=>n?.getBoundingClientRect(),intersects=(a,b,t=1)=>a&&b&&a.left<b.right-t&&a.right>b.left+t&&a.top<b.bottom-t&&a.bottom>b.top+t,hr=rect(header),sr=rect(steps),tr=rect(title),cr=rect(close),ir=rect(icon),nr=rect(nav),br=rect(controls),navVisible=!!nr&&getComputedStyle(nav).display!=='none',flowSafe=!!controls&&getComputedStyle(controls).position==='static'&&parseFloat(getComputedStyle(main).paddingBottom)>=nr?.height-2,pairOverlap=pricing.some((button,index)=>pricing.slice(index+1).some(other=>intersects(rect(button),rect(other)))),relevamiento=pricing.find(button=>button.textContent.trim()==='Relevamiento'),keyNodes=[header,steps,controls,client,addClient,...pricing].filter(Boolean),outside=keyNodes.filter(node=>{const r=rect(node);return r.left<-2||r.right>innerWidth+2}).map(node=>node.className||node.tagName);return {overflow:document.documentElement.scrollWidth>innerWidth+2,headerFlow:!!hr&&!!sr&&hr.bottom<=sr.top+1,titleCloseOverlap:intersects(tr,cr),closeRound:!!cr&&Math.abs(cr.width-cr.height)<=1,iconCentered:!!cr&&!!ir&&Math.abs((cr.left+cr.right)/2-(ir.left+ir.right)/2)<=1&&Math.abs((cr.top+cr.bottom)/2-(ir.top+ir.bottom)/2)<=1,pricingOverlap:pairOverlap,relevamientoFits:!relevamiento||(relevamiento.scrollWidth<=relevamiento.clientWidth+2&&relevamiento.scrollHeight<=relevamiento.clientHeight+2),controlsClearNav:!navVisible||!br||br.bottom<=nr.top+1||flowSafe,chatVisible:!!bubble&&bubble.offsetParent!==null,outside,clientOverlap:intersects(rect(client),rect(addClient))};""")

try:
    login("admin@amc.test","AMC-Prueba-2026!","admin-v3")
    go(BASE+"/#mas-admin")
    wait("return document.body.innerText.includes('Estado de AMC')")
    status=js("return document.body.innerText")
    assert "Versión:" in status and "Base:" in status
    go(BASE+"/#perfil")
    wait("return document.body.innerText.includes('Seguridad en dos pasos')")
    assert "seguridad en dos pasos" in js("return document.body.innerText").lower()

    # Cotizador de página completa: selección canónica, economía A/B y responsive.
    call("POST",prefix+"/window/rect",{"width":1366,"height":768})
    bubble_before_quote=js("return !!document.querySelector('.floating-chat-button') && document.querySelector('.floating-chat-button').offsetParent!==null")
    go(BASE+"/#cotizador")
    wait("return !!document.querySelector('.quote-wizard-page') && !!document.querySelector('[data-qw-client]')")
    assert not js("return !!document.querySelector('.quote-wizard-page[role=dialog],.quote-wizard-page[aria-modal=true]')")
    wait("return document.querySelectorAll('[data-qw-client] option').length > 1")
    for viewport in [(1440,900),(1366,768),(1024,768),(768,1024),(412,915),(390,844),(360,800)]:
        call("POST",prefix+"/window/rect",{"width":viewport[0],"height":viewport[1]})
        stage_one=quote_shell_audit()
        assert not stage_one["overflow"] and stage_one["headerFlow"] and not stage_one["titleCloseOverlap"],(viewport,stage_one)
        assert stage_one["closeRound"] and stage_one["iconCentered"] and stage_one["controlsClearNav"],(viewport,stage_one)
        assert not stage_one["chatVisible"] and not stage_one["outside"] and not stage_one["clientOverlap"],(viewport,stage_one)
        structure=js("""const page=document.querySelector('.quote-wizard-page'),quoteHeader=page.querySelector('.quote-wizard-header'),internal=[...page.querySelectorAll('header:not(.quote-wizard-header)')],select=page.querySelector('[data-qw-client]'),add=page.querySelector('[data-qw-new-client]'),sr=select.getBoundingClientRect(),ar=add.getBoundingClientRect();return {outline:getComputedStyle(page).outlineStyle,quoteHeaderPosition:getComputedStyle(quoteHeader).position,stickyInternal:internal.filter(node=>['sticky','fixed'].includes(getComputedStyle(node).position)).length,clientBottomDelta:Math.abs(sr.bottom-ar.bottom),clientGrid:getComputedStyle(page.querySelector('.quote-client-picker')).gridTemplateColumns};""")
        assert structure["outline"]=="none" and structure["quoteHeaderPosition"]=="static" and structure["stickyInternal"]==0,(viewport,structure)
        if viewport[0]>600: assert structure["clientBottomDelta"]<=2,(viewport,structure)
    call("POST",prefix+"/window/rect",{"width":1366,"height":768})
    js("""const s=document.querySelector('[data-qw-client]');const option=[...s.options].find(o=>o.value);if(!option)return false;s.value=option.value;s.dispatchEvent(new Event('change',{bubbles:true}));return true;""")
    wait("return !!document.querySelector('[data-qw-next]:not([disabled])')")
    js("document.querySelector('[data-qw-next]').click();return true;")
    wait("return !!document.querySelector('[data-qw-work-input][data-qw-key=\"description\"]')")
    js("""const input=document.querySelector('[data-qw-work-input][data-qw-key="description"]');input.value='revo';input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();return true;""")
    wait("return !!document.querySelector('#quote-tariff-overlay:not([hidden]) button[data-qw-select-tariff]')")
    layout=js("""const detail=document.querySelector('.quote-builder-detail'),summary=document.querySelector('.quote-builder-summary'),overlay=document.querySelector('#quote-tariff-overlay'),close=document.querySelector('.quote-wizard-close'),r=overlay.getBoundingClientRect(),cs=getComputedStyle(close),input=document.querySelector('[data-qw-work-input][data-qw-key="description"]'),id=input.dataset.qwWorkId;return {detailOverflow:getComputedStyle(detail).overflowY,summaryOverflow:getComputedStyle(summary).overflowY,overlayTop:r.top,overlayBottom:r.bottom,height:innerHeight,closeBorder:cs.borderTopWidth,closeDisplay:cs.display,sidebar:[...document.querySelectorAll(`button[data-qw-select-work="${CSS.escape(id)}"] .quote-builder-work-copy strong`)].map(n=>n.textContent),summaryNames:[...document.querySelectorAll(`.quote-summary-rows button[data-qw-select-work="${CSS.escape(id)}"] span`)].map(n=>n.textContent)};""")
    assert layout["detailOverflow"] not in ("auto","scroll"),layout
    assert layout["summaryOverflow"] not in ("auto","scroll"),layout
    assert layout["overlayTop"]>=0 and layout["overlayBottom"]<=layout["height"]+1,layout
    assert layout["closeBorder"]=="0px" and layout["closeDisplay"]=="grid",layout
    assert all(name=="revo" for name in layout["sidebar"]+layout["summaryNames"]),layout
    canonical_name=js("return document.querySelector('#quote-tariff-overlay button[data-qw-select-tariff] strong').textContent.trim()")
    js("document.querySelector('#quote-tariff-overlay button[data-qw-select-tariff]').click();return true;")
    wait("return !!document.querySelector('.quote-selected-tariff') && document.querySelector('[data-qw-work-input][data-qw-key=\"description\"]').value!==\"revo\"")
    selected_layout=js("""const detail=document.querySelector('.quote-builder-detail'),summary=document.querySelector('.quote-builder-summary'),input=document.querySelector('[data-qw-work-input][data-qw-key="description"]'),id=input.dataset.qwWorkId;return {detailOverflow:getComputedStyle(detail).overflowY,summaryOverflow:getComputedStyle(summary).overflowY,quantity:!!document.querySelector('[data-qw-work-input][data-qw-key="quantity"]'),input:input.value,selected:document.querySelector('.quote-selected-tariff strong').textContent.trim(),sidebar:[...document.querySelectorAll(`button[data-qw-select-work="${CSS.escape(id)}"] .quote-builder-work-copy strong`)].map(n=>n.textContent),summaryNames:[...document.querySelectorAll(`.quote-summary-rows button[data-qw-select-work="${CSS.escape(id)}"] span`)].map(n=>n.textContent)};""")
    assert selected_layout["detailOverflow"] not in ("auto","scroll"),selected_layout
    assert selected_layout["summaryOverflow"] not in ("auto","scroll") and selected_layout["quantity"],selected_layout
    assert selected_layout["input"]==canonical_name,selected_layout
    assert selected_layout["selected"]==canonical_name,selected_layout
    assert all(name==canonical_name for name in selected_layout["sidebar"]+selected_layout["summaryNames"]),selected_layout

    # Completar la medida y entrar a Costos y rentabilidad.
    js("""const q=document.querySelector('[data-qw-work-input][data-qw-key="quantity"]');q.value='10';q.dispatchEvent(new Event('input',{bubbles:true}));q.dispatchEvent(new Event('change',{bubbles:true}));return true;""")
    wait("return !!document.querySelector('[data-qw-next]:not([disabled])')")
    for viewport in [(1440,900),(1366,768),(1024,768),(768,1024),(412,915),(390,844),(360,800)]:
        call("POST",prefix+"/window/rect",{"width":viewport[0],"height":viewport[1]})
        stage_two=quote_shell_audit()
        assert not stage_two["overflow"] and stage_two["headerFlow"] and not stage_two["titleCloseOverlap"],(viewport,stage_two)
        assert stage_two["closeRound"] and stage_two["iconCentered"] and not stage_two["pricingOverlap"],(viewport,stage_two)
        assert stage_two["relevamientoFits"] and stage_two["controlsClearNav"] and not stage_two["chatVisible"],(viewport,stage_two)
        assert not stage_two["outside"],(viewport,stage_two)
        pricing_modes=js("return [...document.querySelectorAll('[data-qw-pricing-mode]')].map(button=>button.textContent.trim())")
        assert pricing_modes==["Tarifario","Manual","Jornal"],(viewport,pricing_modes)
    call("POST",prefix+"/window/rect",{"width":1366,"height":768})
    js("document.querySelector('[data-qw-next]').click();return true;")
    wait("return !!document.querySelector('.quote-wizard-stage-3 .quote-cost-stage')")
    assert js("return document.querySelector('[data-qw-profit-status]').textContent.trim()") == "Rentabilidad estimada: faltan costos por confirmar."

    def set_input(selector,value):
        js("""const input=document.querySelector(arguments[0]);input.value=arguments[1];input.dispatchEvent(new Event('input',{bubbles:true}));return true;""".replace("arguments[0]",json.dumps(selector)).replace("arguments[1]",json.dumps(str(value))))

    set_input('[data-qw-employee-day]',25000)
    set_input('[data-qw-travel]',30000)
    for key,value in [('materials',100000),('tools',20000),('other',10000),('labor',0),('workers',2),('days',3)]:
        set_input('[data-qw-work-input][data-qw-key="'+key+'"]',value)
    set_input('[data-qw-final-price]',955000)
    reference_action=js("""const button=document.querySelector('[data-qw-reset-final-price]'),input=document.querySelector('[data-qw-final-price]');return {disabled:button.disabled,text:button.textContent.trim(),cursor:getComputedStyle(button).cursor,input:Number(input.value)};""")
    assert reference_action=={"disabled":False,"text":"Usar referencia","cursor":"pointer","input":955000},reference_action
    js("document.querySelector('[data-qw-reset-final-price]').click();return true;")
    wait("return document.querySelector('[data-qw-reset-final-price]').textContent.trim()==='Referencia aplicada'")
    applied_reference=js("""const button=document.querySelector('[data-qw-reset-final-price]'),input=document.querySelector('[data-qw-final-price]');return {disabled:button.disabled,text:button.textContent.trim(),cursor:getComputedStyle(button).cursor,input:Number(input.value)};""")
    assert applied_reference["disabled"] and applied_reference["text"]=="Referencia aplicada" and applied_reference["cursor"]=="not-allowed" and applied_reference["input"]>0,applied_reference
    set_input('[data-qw-final-price]',955000)
    js("const c=document.querySelector('[data-qw-cost-confirm]');c.checked=true;c.dispatchEvent(new Event('change',{bubbles:true}));return true;")
    wait("return document.querySelector('[data-qw-profit-margin]').textContent.includes('67.5')")
    case_a=js(r"""const n=s=>Number((document.querySelector(s)?.textContent||'').replace(/\D/g,''));return {cost:n('[data-qw-profit-cost]'),gain:n('[data-qw-profit-gain]'),margin:document.querySelector('[data-qw-profit-margin]').textContent.trim(),floor:n('[data-qw-suggested-price]'),warning:document.querySelector('[data-qw-profit-status]').textContent.trim()};""")
    assert case_a["cost"]==310000 and case_a["gain"]==645000,case_a
    assert case_a["margin"]=="67.5 %" and case_a["floor"]==442857,case_a
    assert case_a["warning"].startswith("✓"),case_a

    set_input('[data-qw-work-input][data-qw-key="labor"]',180000)
    js("const c=document.querySelector('[data-qw-cost-confirm]');c.checked=true;c.dispatchEvent(new Event('change',{bubbles:true}));return true;")
    wait("return document.querySelector('[data-qw-profit-margin]').textContent.includes('64.4')")
    case_b=js(r"""const n=s=>Number((document.querySelector(s)?.textContent||'').replace(/\D/g,''));return {cost:n('[data-qw-profit-cost]'),gain:n('[data-qw-profit-gain]'),margin:document.querySelector('[data-qw-profit-margin]').textContent.trim(),floor:n('[data-qw-suggested-price]')};""")
    assert case_b=={"cost":340000,"gain":615000,"margin":"64.4 %","floor":485714},case_b

    def responsive_audit(width,height):
        call("POST",prefix+"/window/rect",{"width":width,"height":height})
        time.sleep(.15)
        return js("""const host=document.querySelector('.quote-wizard-host'),nodes=[...host.querySelectorAll('.quote-wizard-content,.quote-builder-detail,.quote-builder-summary,.quote-cost-list,.quote-review-stage')];const internal=nodes.filter(n=>{const s=getComputedStyle(n);return ['auto','scroll'].includes(s.overflowY)&&n.scrollHeight>n.clientHeight+2}).map(n=>n.className);const outside=[...host.querySelectorAll('input,select,button,.quote-profitability-card,.quote-cost-work-card')].filter(n=>{const r=n.getBoundingClientRect();return r.left<-2||r.right>innerWidth+2}).length;const cards=[...host.querySelectorAll('.quote-profitability-card')];const overlaps=cards.some(card=>{const parts=[...card.children].filter(n=>n.offsetParent!==null),rects=parts.map(n=>n.getBoundingClientRect());return rects.some((r,i)=>i&&r.top<rects[i-1].bottom-1)});const tolerance=1;const profit=host.querySelector('.quote-profitability-card:not(.quote-final-price)'),profitDescription=profit?.querySelector(':scope>header p'),stats=profit?.querySelector(':scope>.quote-profitability-stats'),final=host.querySelector('.quote-final-price'),finalDescription=final?.querySelector(':scope>header p'),finalLabel=final?.querySelector('.quote-final-price-row label'),input=finalLabel?.querySelector('input'),button=final?.querySelector('.quote-final-price-row button');const textRange=finalLabel?.firstChild&&document.createRange();if(textRange){textRange.selectNode(finalLabel.firstChild)}const labelText=textRange?.getBoundingClientRect();const intersects=(a,b)=>a&&b&&a.left<b.right-tolerance&&a.right>b.left+tolerance&&a.top<b.bottom-tolerance&&a.bottom>b.top+tolerance;return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+2,internal,outside,overlaps,profitFlow:!!profitDescription&&!!stats&&profitDescription.getBoundingClientRect().bottom<=stats.getBoundingClientRect().top+tolerance,finalFlow:!!finalDescription&&!!finalLabel&&finalDescription.getBoundingClientRect().bottom<=finalLabel.getBoundingClientRect().top+tolerance,labelFlow:!!labelText&&!!input&&labelText.bottom<=input.getBoundingClientRect().top+tolerance,inputButtonOverlap:intersects(input?.getBoundingClientRect(),button?.getBoundingClientRect())};""")

    for viewport in [(1440,900),(1366,768),(1024,768),(768,1024),(412,915),(390,844),(360,800)]:
        responsive=responsive_audit(*viewport)
        assert not responsive["overflow"] and not responsive["internal"] and responsive["outside"]==0 and not responsive["overlaps"],responsive
        assert responsive["profitFlow"] and responsive["finalFlow"] and responsive["labelFlow"] and not responsive["inputButtonOverlap"],responsive
        shell_layout=quote_shell_audit()
        assert shell_layout["headerFlow"] and shell_layout["iconCentered"] and shell_layout["controlsClearNav"] and not shell_layout["chatVisible"],(viewport,shell_layout)

    js("document.querySelector('[data-qw-next]').click();return true;")
    wait("return !!document.querySelector('.quote-wizard-stage-4 .quote-review-stage')")
    assert canonical_name in js("return document.querySelector('.quote-review-list').innerText"),canonical_name
    assert "64.4 %" in js("return document.querySelector('.quote-review-side').innerText")
    for viewport in [(1440,900),(1366,768),(1024,768),(768,1024),(412,915),(390,844),(360,800)]:
        responsive=responsive_audit(*viewport)
        assert not responsive["overflow"] and not responsive["internal"] and responsive["outside"]==0 and not responsive["overlaps"],responsive
        shell_layout=quote_shell_audit()
        assert shell_layout["headerFlow"] and shell_layout["iconCentered"] and shell_layout["controlsClearNav"] and not shell_layout["chatVisible"],(viewport,shell_layout)

    call("POST",prefix+"/window/rect",{"width":1280,"height":900})
    go(BASE+"/#presupuestos")
    wait("return !document.body.classList.contains('quote-wizard-route')")
    bubble_after_quote=js("return !!document.querySelector('.floating-chat-button') && document.querySelector('.floating-chat-button').offsetParent!==null")
    assert bubble_after_quote==bubble_before_quote,(bubble_before_quote,bubble_after_quote)
    call("DELETE",prefix+"/cookie")
    login("cliente@amc.test","Cliente-Prueba-2026!","client-v5")
    text=js("return document.body.innerText")
    assert "Mis trabajos" in text and "Perfil" in text
    assert "Costo interno total" not in text and "Margen objetivo" not in text and "Costo diario por empleado" not in text
    assert not js("return !!document.querySelector('[data-nav=\"chat-cliente\"],.bottom-nav a[href=\"#chat-cliente\"]')")
finally:
    try: call("DELETE",prefix)
    except Exception: pass
