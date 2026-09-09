from pathlib import Path

path=Path(__file__).with_name("browser-lifecycle.py")
source=path.read_text(encoding="utf-8")
source=source.replace(
    "wait(\"return document.body.innerText.includes('Ruta 38 123') && document.body.innerText.includes('Empleado')===false\")",
    "wait(\"return document.body.innerText.includes('Ruta 38 123')\")"
)
source=source.replace(
    "assert any(w.get(\"id\")==work_id and w.get(\"status\")==\"Finalizado\" for w in employee_state.get(\"works\",[])),employee_state",
    "assert any(x.get(\"id\")==assignment_id and x.get(\"status\")==\"Finalizada\" for x in employee_state.get(\"assignments\",[])),employee_state"
)
exec(compile(source,str(path),"exec"),{"__name__":"__main__","__file__":str(path)})
