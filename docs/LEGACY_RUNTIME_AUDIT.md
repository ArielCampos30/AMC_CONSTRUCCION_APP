# Auditoría de runtime legado AMC

Fecha: 2026-09-11

## Objetivo

Evitar que AMC siga mostrando pantallas o accesos antiguos mientras se conserva sólo la lógica que todavía es necesaria para el flujo actual.

## Chat

- El chat visible oficial es el **chat flotante**.
- Las rutas antiguas `#chat/<id>`, `#chat-admin/<id>`, `#chat-cliente` y `#chat-admin` quedan tratadas sólo como compatibilidad para enlaces y notificaciones históricas.
- Esas rutas ya no deben presentar una pantalla completa independiente.
- El renderizador de mensajes de `features-ui-legacy.js` **no se elimina todavía** porque el chat flotante reutiliza ese motor para mensajes, fotos, estados de lectura y envío.
- La sección de chat del empleado/equipo se conserva por separado mientras siga usando el canal interno de personal.

## Cotizador / presupuestos

- El Cotizador visible oficial es `quote-wizard.js`.
- El estimador antiguo contenido en `features-ui-legacy.js` no debe volver a exponerse como pantalla de cotización.
- Parte del flujo antiguo (`presupuestos-bridge.js` y generación en segundo plano) se mantiene temporalmente porque todavía interviene en la generación/compatibilidad de PDF. Se retirará cuando el PDF migre completamente al flujo nuevo.

## Rentabilidad que se conserva

La lógica comercial útil ya está trasladada al Cotizador nuevo y debe permanecer:

- Costo interno cargado explícitamente.
- Ganancia estimada = precio final - costo interno.
- Margen estimado = ganancia / precio final × 100.
- Precio sugerido para un margen objetivo = costo / (1 - margen objetivo).
- Precio final editable sin perder la referencia comercial original.
- Relevamientos pendientes fuera del precio y de la rentabilidad.

Hay pruebas automáticas específicas para impedir que una futura limpieza quite estas funciones.

## Regla para próximas limpiezas

Antes de borrar código legado se debe clasificar como una de estas categorías:

1. **UI obsoleta**: se elimina del runtime.
2. **Compatibilidad histórica**: se mantiene sólo como adaptador sin pantalla propia.
3. **Motor todavía compartido**: se conserva hasta desacoplar el consumidor actual.
4. **Lógica útil**: se migra al módulo nuevo y luego se elimina la copia antigua.

No se debe borrar un archivo completo sólo por contener una sección antigua si todavía presta servicios al chat flotante, PDF, almacenamiento o sincronización.