from pathlib import Path

source_path = Path(__file__).with_name('browser-shell-contract.py')
source = source_path.read_text(encoding='utf-8')
if 'nav_contract(["Inicio", "Mis trabajos", "Perfil"])' not in source:
    raise AssertionError('El contrato actualizado del shell empleado no está presente.')
if "#chat-equipo" not in source:
    raise AssertionError('Falta verificar que la ruta histórica del chat no vuelva a la navegación visible.')
exec(compile(source, str(source_path), 'exec'), {'__name__': '__main__', '__file__': str(source_path)})
