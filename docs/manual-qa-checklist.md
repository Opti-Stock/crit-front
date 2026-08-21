# CRIT Assist manual QA checklist

Esta guia cubre el levantamiento local y una pasada manual completa del MVP.
Usala desde Git Bash en `/c/Users/esteb/apps/crit-project` con los tres repos
en `dev`.

## 1. Estado inicial

```bash
cd /c/Users/esteb/apps/crit-project/crit-db
git switch dev
git pull --ff-only origin dev
git status --short --branch

cd ../crit-api
git switch dev
git pull --ff-only origin dev
git status --short --branch

cd ../crit-front
git switch dev
git pull --ff-only origin dev
git status --short --branch
```

Todos deben estar en `dev`. Antes de probar, revisa cambios locales para no
pisar trabajo pendiente.

## 2. Base de datos

```bash
cd /c/Users/esteb/apps/crit-project/crit-db
docker compose up --build --wait
docker compose ps
./scripts/verify-db.sh
```

Si `verify-db.sh` falla por checksum de una migracion ya aplicada en un volumen
local, ese volumen tiene historial viejo. En desarrollo local puedes
reconstruirlo desde cero:

```bash
docker compose down -v
./scripts/verify-db.sh
```

Esto borra los datos locales de `crit-db`. Si no quieres borrar el volumen,
valida al menos los contratos para revisar el estado actual:

```bash
docker exec crit-db psql -v ON_ERROR_STOP=1 -U postgres -d crit_db -f /opt/crit-db/tests/001_schema_contract.sql
docker exec crit-db psql -v ON_ERROR_STOP=1 -U postgres -d crit_db -f /opt/crit-db/tests/002_security_contract.sql
```

No uses `docker compose down -v` salvo que quieras borrar toda la base local.

## 3. API y datos demo

```bash
cd /c/Users/esteb/apps/crit-project/crit-api
npm run db:check
npm run platform:bootstrap-super-admin
npm run admin:bootstrap
npm run demo:seed-smoke
npm run lint
npm test
npm run test:integration
npm run test:outbox-integration
npm run validate:openapi
npm run build
```

El seed imprime la password de todos los usuarios `demo.*@crit.test`.

Usuarios recomendados:

| Flujo | Usuario |
| --- | --- |
| Admin completo | `demo.admin@crit.test` |
| Direccion | `demo.direccion@crit.test` |
| Recepcion general | `demo.recepcion.general@crit.test` |
| Recepcion por clinica | `demo.recepcion.norte@crit.test` |
| Coordinacion | `demo.coordinador.norte@crit.test` |
| Medico | `demo.medico.norte@crit.test` |
| Terapeuta | `demo.terapeuta.sur@crit.test` |
| Acompanamiento | `demo.acompanamiento.norte@crit.test` |

## 4. Frontend

`crit-front/.env` debe usar rutas relativas para que funcionen cookies
HttpOnly bajo Vite:

```txt
VITE_MAIN_API_URL=/api
VITE_ADMIN_API_URL=/admin
VITE_CHECKIN_API_URL=/checkin
VITE_SUPER_ADMIN_API_URL=/super-admin
```

Valida:

```bash
cd /c/Users/esteb/apps/crit-project/crit-front
npm run lint
npm test
npm run build
```

## 5. Levantar servicios

Usa los `docker compose` de cada repo para no abrir una terminal por cada API.
Deja una terminal por proyecto:

Terminal 1, base de datos:

```bash
cd /c/Users/esteb/apps/crit-project/crit-db
git switch dev
git pull --ff-only origin dev
docker compose up --build --wait
```

Terminal 2, las cuatro APIs juntas:

```bash
cd /c/Users/esteb/apps/crit-project/crit-api
git switch dev
git pull --ff-only origin dev
powershell.exe -ExecutionPolicy Bypass -File ./scripts/export-windows-ca-bundle.ps1
docker compose up --build --wait
```

Para probar resúmenes y preguntas IA sin modelos pesados, configura primero
`crit-api/.env` con:

```txt
AI_ENABLED=true
AI_RUNTIME=mock
AI_WORKER_TENANT_IDS=00000000-0000-0000-0000-000000000001
```

Luego deja una terminal extra en Git Bash para el worker mock:

```bash
cd /c/Users/esteb/apps/crit-project/crit-api
AI_ENABLED=true AI_RUNTIME=mock AI_WORKER_TENANT_IDS=00000000-0000-0000-0000-000000000001 npm run worker:ai
```

Si solo quieres procesar una vuelta de la cola:

```bash
AI_ENABLED=true AI_RUNTIME=mock AI_WORKER_TENANT_IDS=00000000-0000-0000-0000-000000000001 npm run worker:ai:once
```

Terminal 3, frontend:

```bash
cd /c/Users/esteb/apps/crit-project/crit-front
git switch dev
git pull --ff-only origin dev
powershell.exe -ExecutionPolicy Bypass -File ./scripts/export-windows-ca-bundle.ps1
docker compose up --build --wait
```

Si el build del frontend falla en `npm ci` con
`UNABLE_TO_VERIFY_LEAF_SIGNATURE`, exporta los certificados locales de Windows
para el build de Docker y vuelve a levantar:

```bash
powershell.exe -ExecutionPolicy Bypass -File ./scripts/export-windows-ca-bundle.ps1
docker compose up --build --wait
```

Si algun puerto queda ocupado, detén procesos previos de Node/Vite o ejecuta
`docker compose down` en el repo correspondiente antes de volver a levantar.
Si `crit-front` queda `unhealthy` con logs de `host not found in upstream
"main-api"`, confirma que el compose de `crit-api` ya esta healthy y recrea el
frontend:

```bash
docker compose down
docker compose up --build --wait
```

Health checks:

```bash
curl -fsS http://localhost:3000/health/live
curl -fsS http://localhost:3000/health/ready
curl -fsS http://localhost:3001/health/ready
curl -fsS http://localhost:3002/health/ready
curl -fsS http://localhost:3003/health/ready
curl -fsS http://localhost:5173/health
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

## 6. Main app

Abre `http://localhost:5173/` e inicia sesion.

Con `demo.admin@crit.test`, revisa:

- Dashboard: filtros de periodo/clinica, KPIs, tendencia, asistencia, tabla por
  area y focos operativos.
- Asistencias: busqueda de paciente, rangos `Pasadas`, `Hoy`, `Futuras`,
  paginacion si aparece, botones de asistencia, reagendar, inasistencia y nota.
- Calendario: tabs `Dia`, `Lun-Vie`, `Mes`, `Agenda`; filtros, flechas de
  periodo, estados y seleccion de citas.
- Configurar agenda: selector de clinica y tabs `Horarios`, `Clinica y tipos`,
  `Profesionales`, `Consultorios`, `Bloqueos`, `Preferencias`.
- Notas medicas: lista por paciente, panel de historial, resumen IA y preguntas.
  Si `AI_ENABLED=false`, el panel debe explicar que la asistencia IA esta
  apagada en este entorno y no debe romper el historial.
- Notas de enlace: filtros, lista de pacientes/conversacion, badges de pendientes.
- Notificaciones: bandeja, estados leida/no leida y apertura de conversacion
  cuando exista.

Repite login por rol y confirma que el menu cambia:

- Recepcion general: acceso a escaneo/check-in.
- Coordinador: calendario, asistencia, agenda, notas y notificaciones segun
  alcance.
- Medico/terapeuta: asistencia, notas medicas, notas de enlace y notificaciones.
- Acompanamiento: notas de enlace y notificaciones.

## 7. Admin app

Abre `http://localhost:5173/admin.html` con `demo.admin@crit.test`.

Recorre desde el menu lateral, no solo cambiando el hash:

- Usuarios: listado, crear usuario, roles, acceso a clinicas, mostrar eliminados.
- Roles: listado de roles.
- Clinicas: listado, crear clinica, capacidad, mostrar eliminadas.
- Consultorios: listado, crear consultorio, capacidad, mostrar eliminados.
- Tipos de terapia: listado, duracion, minutos antes/despues, crear tipo.

Para acciones destructivas, el boton pide confirmacion inline y razon opcional.
No borres datos reales; usa solo datos demo o registros temporales.

## 8. Check-in

Abre:

- `http://localhost:5173/checkin.html?mode=reception-checkin`
- `http://localhost:5173/checkin.html?mode=therapeutic-attendance`

Revisa:

- Campo de codigo de gafete.
- Boton manual.
- Boton de camara y fallback si no hay permisos.
- Filtros por fecha y paciente.
- Tabla de citas.
- En modo terapeutico: botones `Asistencia`, `Inasistencia`, `Solicitar reagendar`.

Codigos demo:

| Paciente | Codigo |
| --- | --- |
| Paciente Smoke Norte Asistencia | `7500000000015` |
| Paciente Smoke Norte Inasistencia | `7500000000022` |
| Paciente Smoke Sur Checkin Pendiente Asistencia | `7500000000039` |
| Paciente Smoke Sur Solicitud Reagendar | `7500000000046` |
| Paciente Smoke Infantil Lenguaje | `7500000000053` |
| Paciente Smoke Infantil Futuro | `7500000000060` |
| Paciente Smoke Cita Cancelada | `7500000000077` |
| Paciente Smoke Valido Sin Citas | `7500000000084` |

## 9. Super admin

Abre `http://localhost:5173/super-admin.html`.

Usa el usuario `PLATFORM_BOOTSTRAP_EMAIL` y password
`PLATFORM_BOOTSTRAP_PASSWORD` de `crit-api/.env`.

Revisa:

- Login.
- Lista de centros CRIT.
- Formulario `Crear CRIT`.
- Formulario `Primer admin`.
- Resumen operativo por tenant.

No crees centros reales desde esta pantalla durante QA local salvo que sea un
registro temporal claro.

## 10. Error pages

Abre y verifica el titulo, mensaje y boton:

- `http://localhost:5173/error.html?status=401`
- `http://localhost:5173/error.html?status=403`
- `http://localhost:5173/error.html?status=404`
- `http://localhost:5173/error.html?status=500`
- `http://localhost:5173/error.html?status=503`
- `http://localhost:5173/error.html?status=offline`

## 11. Cierre

Deten frontend, luego APIs y finalmente DB:

```bash
cd /c/Users/esteb/apps/crit-project/crit-front
docker compose down

cd ../crit-api
docker compose down

cd ../crit-db
docker compose down
```

No borres volumenes salvo que quieras reiniciar datos demo desde cero.
