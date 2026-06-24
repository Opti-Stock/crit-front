# crit-front

Frontend web del sistema de optimización de asistencias para CRIT.

## Propósito

Este repositorio contiene la interfaz web desktop/responsive del sistema. El frontend consume dos APIs:

- `crit-api` para operación principal.
- `crit-api/admin-api` para administración.

## Alcance del MVP

Incluye:

- Login / logout.
- Página de asistencias.
- Captura de nota médica.
- Exportación de nota médica a PDF desde frontend.
- Calendario / agenda.
- Notificaciones internas.
- Notas de enlace.
- Admin Page separada.
- Rutas protegidas por rol.

Fuera de alcance:

- App móvil.
- Modo offline.
- Módulo de pagos.

## Stack inicial

- HTML.
- CSS.
- TypeScript.
- Vite Vanilla TypeScript recomendado.
- Fetch o Axios para consumo de API.
- Librería de PDF por definir: `jsPDF`, `pdf-lib` o `html2pdf.js`.

## Estructura

```txt
crit-front/
├── public/
├── src/
│   ├── apps/
│   │   ├── main/
│   │   └── admin/
│   ├── assets/
│   ├── components/
│   ├── features/
│   ├── services/
│   ├── config/
│   ├── guards/
│   ├── types/
│   └── utils/
├── index.html
├── admin.html
├── .env.example
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## Apps internas

### Main App

Ubicación:

```txt
src/apps/main/
```

Contendrá las pantallas operativas:

- Home.
- Asistencias.
- Calendario.
- Notas médicas.
- Notas de enlace.
- Notificaciones.

### Admin App

Ubicación:

```txt
src/apps/admin/
```

Contendrá las pantallas administrativas:

- Usuarios.
- Roles.
- Permisos.
- Gestión de clínicas.
- Gestión de colaboradores.

## Variables de entorno

Crear un archivo `.env` basado en `.env.example`.

```env
VITE_MAIN_API_URL=http://localhost:3000/api
VITE_ADMIN_API_URL=http://localhost:3001/admin
VITE_APP_NAME=CRIT Assistance
VITE_AUTH_BYPASS_ENABLED=true
```

## Convención de ramas

```txt
main
dev
feat/OPT-00-descripcion
fix/OPT-00-descripcion
chore/OPT-00-descripcion
docs/OPT-00-descripcion
refactor/OPT-00-descripcion
```

## Responsables

Frontend:

- Diego.
- Giselle.
