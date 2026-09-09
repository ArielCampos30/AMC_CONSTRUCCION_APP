from pathlib import Path

path=Path(__file__).with_name("browser-lifecycle.py")
source=path.read_text(encoding="utf-8")
source=source.replace(
    "wait(\"return document.body.innerText.includes('Ruta 38 123') && document.body.innerText.includes('Empleado')===false\")",
    "wait(\"return document.body.innerText.includes('Ruta 38 123')\")"
)
exec(compile(source,str(path),"exec"),{"__name__":"__main__","__file__":str(path)})
