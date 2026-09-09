# AMC Construcciones y Arreglos

Aplicación conectada para administrar clientes, solicitudes, presupuestos, obras y equipo de AMC desde Web, Android y PWA/iPhone.

## Qué incluye

- Administración: clientes, solicitudes, presupuestos, obras, calendario, empleados, tareas, chat, reseñas y cierre.
- Clientes: solicitud de trabajos y visitas, presupuesto, aceptación/rechazo, seguimiento de obra, pagos, comprobantes, adicionales y chat.
- Equipo: trabajos asignados, chat interno, fotos e informes, con copia offline automática de las asignaciones.
- Presupuestos PDF con descarga y compartir nativo en Android.
- Notificaciones Web Push y Firebase/Android.
- Seguridad por sesión HttpOnly + CSRF, aislamiento por rol y doble factor TOTP opcional para Administrador.
- Respaldo cifrado verificable y restauración en una base vacía.
- Backup externo preparado para Supabase Storage con retención configurable.
- Pruebas automáticas en SQLite y PostgreSQL más recorrido real con Chrome.

## Producción

- Repositorio: `ArielCampos30/AMC_CONSTRUCCION_APP`
- Rama: `main`
- Backend/Web: `web-amc`
- Producción: `https://amc-o0xb.onrender.com`
- Render mantiene el auto-deploy desactivado; sólo se despliega manualmente después de que CI queda verde.

La base de producción es PostgreSQL externa mediante `AMC_DATABASE_URL`. Render no debe usar SQLite local para producción.

## Desarrollo y pruebas

```bash
cd web-amc
npm ci
npm test
npm start
```

Para la suite PostgreSQL, definir `AMC_TEST_DATABASE_URL` apuntando exclusivamente a una base descartable. GitHub Actions ejecuta ambos motores y un smoke test de Chrome.

## Android

- `applicationId`: `com.amc.construcciones`
- Android mínimo: API 29
- Target: API 35
- La WebView de release sólo confía en el origen AMC y los enlaces externos se abren fuera de la app.
- Los datos de WebView no entran en el backup automático de Android.
- La firma release y `google-services.json` se reconstruyen únicamente en CI mediante GitHub Secrets.

Para actualizar sin romper la identidad de Android hay que mantener el mismo `applicationId` y la misma clave de firma.

## Respaldo

Backup cifrado local/verificación:

```bash
cd web-amc
AMC_BACKUP_PASSWORD='...' node backup-cli.mjs export respaldo.amcbak
AMC_BACKUP_PASSWORD='...' node backup-cli.mjs verify respaldo.amcbak
```

Backup externo preparado para Supabase Storage:

```bash
AMC_BACKUP_PASSWORD='...' \
AMC_SUPABASE_URL='https://PROYECTO.supabase.co' \
AMC_SUPABASE_SERVICE_ROLE_KEY='...' \
node backup-supabase.mjs
```

Las contraseñas, claves de servicio y credenciales de base nunca se guardan en Git.
