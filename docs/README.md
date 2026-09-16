# Landing AMC — Bloque 15.2A

Landing comercial independiente de AMC Construcciones, servida desde `docs/` y separada del runtime operativo de la app.

## Regla de arquitectura del proyecto

A partir de este punto AMC se trabaja en dos frentes diferenciados:

- **Landing**: `docs/` — sitio público/comercial, captación, contenido, campañas y acceso hacia la app.
- **App**: `web-amc/` + Android — operación interna, clientes, presupuestos, obras, empleados, chat y demás funciones del producto.

Cada pedido nuevo debe tratarse sobre el frente que corresponda. No se deben mezclar cambios de landing con cambios de app salvo que el bloque autorizado sea explícitamente una integración entre ambos.

## Alcance actual

- Landing estática en `docs/index.html`.
- CSS separado en `docs/assets/css/landing.css`.
- JavaScript separado en `docs/assets/js/landing.js`.
- Assets visuales organizados bajo `docs/assets/`.
- Reutilización del mismo logo de AMC que usa la app, presentado con el amarillo propio de la landing.
- Fotografía visual temporal para dar contexto de obra hasta reemplazarla por material real de AMC.
- Icono de WhatsApp propio en el botón flotante, con animación sutil y respeto por `prefers-reduced-motion`.
- Servicios, zonas de cobertura, forma de trabajo y CTA de presupuesto.
- Diseño responsive sin depender del runtime de `web-amc`.
- Botón **Acceso clientes** hacia `https://amc-o0xb.onrender.com/`.
- WhatsApp preparado pero **sin número real** por ahora.
- Conservación de `utm_source`, `utm_medium`, `utm_campaign` y `utm_content` dentro del mensaje futuro de WhatsApp.
- Sin endpoint público de prospectos.
- Sin alta automática de leads en AMC.

## Imágenes temporales

Las imágenes actuales son material visual temporal para desarrollo de la landing. No deben documentarse ni presentarse internamente como trabajos reales de AMC. Cuando exista material propio aprobado, se reemplazan manteniendo la misma estructura de assets.

## WhatsApp

En `docs/assets/js/landing.js` existe:

```js
const WHATSAPP_NUMBER = "";
```

Mientras siga vacío, los CTA muestran un aviso de modo demo. Cuando se defina el WhatsApp Business comercial, cargar el número completo con código de país, sin `+`, espacios ni guiones.

La lógica UTM permanece centralizada en el mismo módulo JS.

## Lo que queda fuera

La captura de prospectos, persistencia en AMC, automatización del seguimiento y cualquier conexión landing → backend pertenecen al bloque 15.2B y no forman parte de este bloque visual.
