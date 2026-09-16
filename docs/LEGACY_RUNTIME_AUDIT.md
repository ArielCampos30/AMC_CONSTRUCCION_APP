# Auditoría de runtime legado AMC

Fecha original: 2026-09-11  
Actualización de cierre: 2026-09-16

## Objetivo

Evitar que AMC vuelva a exponer pantallas o motores antiguos y conservar únicamente compatibilidad histórica que siga teniendo consumidores reales.

## Estado actual

La limpieza de runtime que estaba pendiente el 11/9 ya fue completada en bloques posteriores. El código vigente no depende de los ejecutables legacy retirados y las pruebas automáticas exigen que no reaparezcan.

Archivos retirados y que deben permanecer ausentes:

- `public/features-ui-legacy.js`;
- `public/presupuestos-bridge.js`;
- `public/estimator-sync.js`;
- `public/estimator-steps.js`;
- `public/estimator-v1.js`;
- `public/estimator-v1.css`;
- `public/pdf-logo.js`;
- `private/presupuestos-original.html`.

`tests/legacy-retirement-final.test.mjs` protege este retiro y comprueba que la ruta histórica del estimador redirija al Cotizador actual.

## Chat

- El chat visible oficial para Administrador/Cliente es el **chat flotante**.
- Las rutas históricas `#chat/<id>`, `#chat-admin/<id>`, `#chat-user/<id>`, `#conversacion/<id>`, `#chat-cliente`, `#chat-admin` y `#chat` se conservan únicamente como compatibilidad para enlaces y notificaciones antiguas.
- `public/chat-route-compat.js` normaliza esas rutas y abre el chat flotante; no debe reintroducirse una pantalla legacy independiente.
- El canal interno Empleado ↔ Administrador continúa separado y conserva su ruta `#chat-equipo` porque es una función actual, no legado descartable.
- El motor visible actual ya no depende de `features-ui-legacy.js`.

## Cotizador / presupuestos

- El Cotizador visible oficial es `public/quote-wizard.js`, cargado por `public/features-ui.js`.
- La lógica útil de presupuesto, persistencia y PDF fue desacoplada del estimador antiguo.
- `presupuestos-bridge.js`, el estimador V1 y `presupuestos-original.html` ya fueron retirados y no deben recuperarse como dependencias.
- Los accesos históricos del estimador deben terminar en `#cotizador` mediante el adaptador de rutas actual.

## Rentabilidad que se conserva

La lógica comercial útil está trasladada al Cotizador actual y debe permanecer:

- Costo interno cargado explícitamente.
- Ganancia estimada = precio final - costo interno.
- Margen estimado = ganancia / precio final × 100.
- Precio sugerido para un margen objetivo = costo / (1 - margen objetivo).
- Precio final editable sin perder la referencia comercial original.
- Relevamientos pendientes fuera del precio y de la rentabilidad.

Las pruebas automáticas de rentabilidad y del Cotizador protegen estas funciones.

## Clasificación vigente para futuras limpiezas

Antes de retirar cualquier pieza se debe clasificar así:

1. **UI obsoleta**: puede eliminarse cuando no tenga rutas ni consumidores.
2. **Compatibilidad histórica**: se conserva como adaptador mínimo mientras existan enlaces/notificaciones antiguas.
3. **Motor compartido actual**: no es legacy aunque tenga origen histórico; sólo se retira después de desacoplar todos sus consumidores.
4. **Lógica útil**: primero se migra y prueba en el módulo vigente; después se elimina la copia antigua.

## Regla de cierre

No borrar un archivo, ruta o rama sólo por antigüedad. Antes debe demostrarse que el runtime actual no lo importa, que las pruebas cubren el reemplazo y que no contiene trabajo único que deba conservarse como referencia.
