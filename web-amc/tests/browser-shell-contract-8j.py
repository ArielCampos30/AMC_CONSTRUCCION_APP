from pathlib import Path

source_path = Path(__file__).with_name('browser-shell-contract.py')
source = source_path.read_text(encoding='utf-8')
old = '    nav_contract(["Inicio", "Mis trabajos", "Chat", "Perfil"])\n'
new = (
    '    nav_contract(["Inicio", "Mis trabajos", "Perfil"])\n'
    '    assert not js("return !!document.querySelector(\\\'.sidebar a[href=\\\"#chat-equipo\\\"],.bottom-nav a[href=\\\"#chat-equipo\\\"]\\\')")\n'
)
if old not in source:
    raise AssertionError('El contrato base del shell empleado cambió; revisar antes de continuar.')
patched = source.replace(old, new, 1)
exec(compile(patched, str(source_path), 'exec'), {'__name__': '__main__', '__file__': str(source_path)})
