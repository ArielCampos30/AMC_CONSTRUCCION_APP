# Landing AMC Construcciones

Landing comercial independiente de AMC Construcciones, servida desde `docs/` y separada del runtime operativo de la app.

## Regla de arquitectura del proyecto

AMC se trabaja en dos frentes diferenciados:

- **Landing**: `docs/` — sitio público/comercial, captación, contenido, campañas y acceso hacia la app.
- **App**: `web-amc/` + Android — operación interna, clientes, presupuestos, obras, empleados, chat y demás funciones del producto.

Cada pedido nuevo debe tratarse sobre el frente que corresponda. No se deben mezclar cambios de landing con cambios de app salvo que el bloque autorizado sea explícitamente una integración entre ambos.

## Estado actual

- Landing pública en `https://amc-construcciones.onrender.com/`.
- HTML, CSS y JavaScript separados bajo `docs/`.
- Logo AMC original, fotografías temporales y diseño responsive.
- Servicios, zonas de cobertura, forma de trabajo y formulario de consulta.
- Botón **Acceso clientes** hacia `https://amc-o0xb.onrender.com/`.
- Formulario conectado con AMC: cada consulta válida crea o reutiliza un prospecto y genera una solicitud nueva para Administración.
- Captura de `utm_source`, `utm_medium`, `utm_campaign` y `utm_content` para atribución comercial.
- Persistencia de campaña durante la sesión para no perder la atribución si la URL deja de mostrar las UTM.
- WhatsApp Business comercial activo mediante `wa.me` con el número AMC en formato internacional.
- Después de enviar el formulario, la persona puede continuar por WhatsApp sin crear una segunda alta en AMC.
- Fotos adjuntas al formulario deliberadamente fuera del alcance actual.

## SEO técnico

La landing incluye:

- `title` y descripción orientados a AMC Construcciones y Punilla;
- URL canónica;
- directivas de indexación;
- Open Graph y Twitter Card para compartir el sitio;
- favicon basado en el logo AMC;
- datos estructurados `GeneralContractor` con servicios y zona de atención;
- `robots.txt`;
- `sitemap.xml`.

Las imágenes actuales son material visual temporal para desarrollo de la landing. No deben presentarse como obras reales de AMC. Cuando exista material propio aprobado, se reemplazan manteniendo la misma estructura de assets.

## Medición comercial

`docs/assets/js/landing.js` publica eventos de primera parte sin enviar datos a terceros por sí solo.

Los eventos se agregan a `window.dataLayer` y también se emiten como `amc:measurement`. Esto permite conectar más adelante Google Tag Manager, GA4, Meta u otra herramienta sin reescribir el flujo comercial.

Eventos actuales:

- `amc_landing_view`;
- navegación y CTA mediante `data-measure`;
- `amc_form_start`;
- `amc_form_submit_attempt`;
- `amc_form_submit_success`;
- `amc_form_submit_error`;
- `amc_whatsapp_after_form`.

Los eventos no incluyen nombre, teléfono ni descripción del prospecto. Sólo conservan contexto de campaña y datos técnicos de conversión.

## WhatsApp

El WhatsApp Business comercial se define en `docs/assets/js/landing.js` con el formato internacional requerido por `wa.me`: código de país + prefijo móvil + característica + número, sin `+`, espacios ni guiones.

La landing ofrece dos recorridos complementarios:

1. El botón flotante abre WhatsApp con un mensaje inicial y conserva el contexto de campaña UTM en el texto.
2. El formulario sigue siendo el alta canónica dentro de AMC. Después de guardarse correctamente, se ofrece **Continuar por WhatsApp** con nombre, localidad y tipo de trabajo ya completados, sin volver a crear otro prospecto ni otra solicitud.

Dentro de Administración, el panel Comercial puede abrir la conversación del prospecto y registra internamente **WhatsApp iniciado**. Ese evento sólo confirma que AMC abrió el enlace de conversación; no implica mensaje enviado, entregado ni leído. Para esos estados sería necesaria una integración futura con la API oficial de Meta.
