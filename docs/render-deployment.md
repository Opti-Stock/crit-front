# Despliegue en Render

Crear un Web Service Docker para `crit-front` y cuatro servicios Docker para los procesos `start:main`, `start:admin`, `start:checkin` y `start:super-admin` de `crit-api`.

En el frontend, configurar `MAIN_API_UPSTREAM`, `ADMIN_API_UPSTREAM`, `CHECKIN_API_UPSTREAM` y `SUPER_ADMIN_API_UPSTREAM` con la URL completa de cada servicio. El único dominio compartido con usuarios es el de `crit-front`; Nginx conserva las rutas originales al hacer proxy.

Usar `.env.render.example` como lista de variables, no como archivo de secretos. Configurar healthcheck del frontend en `/health` y readiness de cada API en `/health/ready`.

Antes de desplegar: migrar la base, ejecutar contratos de `crit-db`, crear respaldo, desplegar APIs y finalmente desplegar el gateway. Validar login, logout, roles, check-in y rechazo de notas médicas para recepción.
