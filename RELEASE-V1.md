# AMC Construcciones v1.0

## Ejecutar y probar

- Backend local con SQLite: `cd web-amc`, `npm ci` y `npm test` o `npm start`.
- PostgreSQL de pruebas: definir `AMC_TEST_DATABASE_URL` apuntando exclusivamente a una base descartable y ejecutar `npm test`.
- Producción necesita `AMC_DATABASE_URL`, `AMC_ADMIN_EMAIL`, `AMC_ADMIN_PASSWORD` y las variables privadas de correo/push que se usen. Nunca guardar sus valores en Git.
- Salud: `GET /health` comprueba proceso y base de datos; no devuelve credenciales.

## Android release

El workflow **Compilar APK AMC** genera `AMC_Construcciones_v1.0.0.apk` y `AMC_Construcciones_v1.0.0.aab`, verifica sus firmas y los publica como artifact. Requiere estos GitHub Secrets: `AMC_KEYSTORE_B64`, `AMC_STORE_PASSWORD`, `AMC_KEY_ALIAS`, `AMC_KEY_PASSWORD` y `AMC_GOOGLE_SERVICES_B64`. Este último contiene el `google-services.json` codificado en Base64; el archivo se reconstruye sólo durante CI.

El propietario debe conservar el archivo JKS original y sus contraseñas en dos ubicaciones privadas fuera del repositorio. Obtener el SHA-256 con `keytool -list -v -keystore amc-release.jks -alias ALIAS`. Si la APK de prueba anterior estaba firmada con debug, Android exige una migración única: confirmar primero que los datos importantes están en el servidor, desinstalar la prueba e instalar la release. No se cambia `com.amc.construcciones`.

## Publicación y recuperación

Antes de producción crear un backup de PostgreSQL del proveedor o con `pg_dump`, verificar que el archivo exista y conservar la revisión desplegada anterior. Para volver atrás, desplegar el commit anterior. Restaurar la base sólo si una migración afectó datos y después de detener escrituras; las migraciones de v1.0 son compatibles e idempotentes.

## Instalación

- Android: descargar el artifact del workflow, extraer el ZIP e instalar el APK. Ante una firma debug incompatible, usar la migración única descrita arriba.
- Web: abrir `https://amc-o0xb.onrender.com`.
- iPhone: abrir esa dirección en Safari, tocar **Compartir** y **Agregar a pantalla de inicio**.

Funciones principales: solicitudes, presupuestos, clientes, obras, empleados, chat y fotos, equipos de varios empleados, seguimiento y acceso Android/Web/PWA/iPhone.
