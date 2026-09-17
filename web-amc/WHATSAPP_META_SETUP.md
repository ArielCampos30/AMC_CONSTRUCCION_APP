# WhatsApp Business Cloud — D.5A

D.5A deja AMC preparado para recibir webhooks oficiales de Meta y mostrarlos en la bandeja Admin de Comercial. En este bloque las respuestas automáticas están desactivadas y AMC no envía mensajes por Cloud API.

## Callback de producción

`https://amc-o0xb.onrender.com/api/webhooks/whatsapp`

## Variables privadas de Render

Configurar únicamente como variables de entorno del servicio AMC; no guardarlas en GitHub ni en documentos públicos.

- `AMC_WHATSAPP_VERIFY_TOKEN`: token privado elegido para la verificación del callback.
- `AMC_WHATSAPP_APP_SECRET`: App Secret de la aplicación de Meta. Se usa para validar `X-Hub-Signature-256` sobre el body crudo.
- `AMC_WHATSAPP_PHONE_NUMBER_ID`: identificador del número de WhatsApp en Meta. Opcional para arrancar, recomendado para limitar eventos al número correcto.
- `AMC_WHATSAPP_BUSINESS_ACCOUNT_ID`: WABA ID. Opcional para arrancar, recomendado para limitar eventos a la cuenta correcta.

D.5A no necesita guardar un access token porque todavía no envía mensajes desde AMC.

## Activación en Meta

1. Crear o seleccionar una aplicación Meta con WhatsApp Business Platform habilitada y vincular la cuenta/número de AMC.
2. Cargar en Render el Verify Token y el App Secret; opcionalmente también Phone Number ID y WABA ID.
3. Desplegar nuevamente el mismo SHA de AMC para que el proceso lea las variables.
4. En la configuración de Webhooks de WhatsApp de Meta, usar el callback de producción y el mismo Verify Token.
5. Suscribir el campo de mensajes correspondiente a WhatsApp.
6. Enviar un mensaje real de prueba al número de AMC y comprobar en `Admin → Más → Gestión → Comercial` que el estado pase a “Recibiendo mensajes” y aparezca la conversación.

## Seguridad y alcance

- El GET de verificación sólo devuelve el challenge cuando el Verify Token coincide.
- Cada POST exige firma HMAC SHA-256 válida con el App Secret antes de parsear o persistir el JSON.
- Los mensajes se guardan en el almacenamiento canónico respaldado de AMC, pero quedan excluidos de `/api/state` y se leen únicamente por el endpoint Admin dedicado.
- `/api/admin/whatsapp/inbox` exige rol Admin.
- Los mensajes repetidos por reintentos de Meta se deduplican por `wamid`.
- Mensajes multimedia se registran en D.5A como tipo/caption o descriptor; el archivo no se descarga todavía.
- Un contacto se vincula a una consulta AMC cuando el teléfono normalizado coincide. Los contactos no vinculados se muestran como tales y no crean una oportunidad automáticamente en este bloque.
- No se registra “enviado”, “entregado” o “leído” si Meta no envía ese estado.
- No hay respuestas automáticas ni IA activa en D.5A.

## Evolución posterior

El envío por Cloud API, plantillas, estados de mensajes salientes, descarga segura de multimedia y el asistente comercial con IA pertenecen a bloques posteriores y deben habilitarse explícitamente después de validar D.5A con tráfico real.
