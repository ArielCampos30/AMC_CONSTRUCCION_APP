# AMC Construcciones y Arreglos

Aplicación conectada para administrar clientes, solicitudes, presupuestos, obras y equipo de AMC desde Web, Android y PWA/iPhone.

## Frentes del proyecto

AMC se mantiene en dos superficies independientes que comparten identidad pero no deben mezclarse por defecto:

- **Landing comercial**: `docs/` — sitio público, presentación, campañas, captación y acceso hacia la app.
- **App AMC**: `web-amc/` + Android — clientes, administración, presupuestos, obras, empleados, chat y operación.

Cada bloque nuevo debe ejecutarse sobre **Landing** o **App** según el pedido. Sólo se modifican ambos frentes cuando el alcance autorizado sea explícitamente una integración entre ellos.

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
- Landing pública: `https://amcconstrucciones.com.ar`
- App/API pública: `https://app.amcconstrucciones.com.ar`
- Render mantiene el auto-deploy desactivado para la app; sólo se despliega manualmente después de que CI queda verde.

La base canónica de producción es PostgreSQL en Supabase Virginia y se configura directamente mediante `AMC_DATABASE_URL`. El arranque normal de `server.mjs` no ejecuta migraciones regionales ni cambia la URL de base en memoria. Render no debe usar SQLite local para producción.

## Desarrollo y pruebas

```bash
cd web-amc
npm ci
npm test
npm start
```

Para la suite PostgreSQL, definir `AMC_TEST_DATABASE_URL` apuntando exclusivamente a una base descartable. GitHub Actions ejecuta ambos motores y un smoke test de Chrome.

## Migración regional de emergencia

El migrador regional está separado del servidor y sólo se ejecuta de forma explícita:

```bash
cd web-amc
AMC_REGION_MIGRATION_CONFIRM=MIGRATE \
AMC_REGION_MIGRATION_SOURCE_URL='postgresql://...' \
AMC_REGION_MIGRATION_TARGET_URL='postgresql://...' \
npm run migrate:region
```

El comando exige origen y destino separados, verifica tablas, conteos y hashes antes del `COMMIT`, y hace `ROLLBACK` ante una diferencia. Nunca debe formar parte del comando normal de arranque de producción.

## Android

- `applicationId`: `com.amc.construcciones`
- Android mínimo: API 29
- Target: API 36
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

El servicio web y el cron `AMC Backup` deben apuntar a la misma base canónica mediante `AMC_DATABASE_URL`.

Las contraseñas, claves de servicio y credenciales de base nunca se guardan en Git.
