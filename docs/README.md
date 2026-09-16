# Landing AMC — Bloque 15.2A

Rescate selectivo de la landing histórica de `marketing-launch`, recreada sobre el `main` actual sin fusionar la rama vieja.

## Alcance de 15.2A

- Landing estática en `docs/index.html`.
- Servicios, zonas de cobertura, forma de trabajo y CTA de presupuesto.
- Diseño responsive y autocontenido, sin depender del runtime de la app.
- WhatsApp preparado pero **sin número real** por ahora.
- Conservación de `utm_source`, `utm_medium`, `utm_campaign` y `utm_content` dentro del mensaje futuro de WhatsApp.
- Espacios visuales preparados para sumar imágenes en una fase posterior.
- Sin endpoint público de prospectos.
- Sin alta automática de leads en AMC.
- Sin cambios en `web-amc`, Android, base de datos, Render ni flujos de la aplicación.

## Referencia histórica

La rama `marketing-launch` se mantiene intacta como referencia. No debe mergearse sobre `main` porque quedó muy desactualizada respecto del producto actual.

De esa rama se rescató la idea y estructura de `docs/index.html` y la guía mínima de publicación de `docs/README.md`. `marketing/ARRANQUE.md` no se copia en 15.2A porque corresponde al plan comercial general y no es necesario para reconstruir la landing.

## WhatsApp

En `docs/index.html` existe:

```js
const WHATSAPP_NUMBER = "";
```

Mientras siga vacío, los CTA muestran un aviso de modo demo. Cuando se defina el WhatsApp Business comercial, cargar el número completo con código de país, sin `+`, espacios ni guiones.

No hace falta modificar la lógica de campaña: si la visita llega con parámetros UTM, la landing los agrega al mensaje que abrirá WhatsApp.

## Imágenes

15.2A no publica fotos reales ni imágenes que aparenten ser trabajos realizados por AMC. La estructura visual queda lista para incorporar material aprobado más adelante.

## Lo que queda fuera

La captura de prospectos, persistencia en AMC, automatización del seguimiento y cualquier conexión landing → backend pertenecen a un bloque posterior (15.2B) y no forman parte de este rescate.
