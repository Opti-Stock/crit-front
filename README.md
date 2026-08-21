# crit-front

Frontend Vanilla TypeScript/Vite de CRIT Assist. Contiene las aplicaciones operativa, administrativa, check-in y superadministración.

## Inicio local

```powershell
npm ci --legacy-peer-deps
Copy-Item .env.local.example .env.local
npm run dev
```

Vite sirve el frontend en `http://localhost:5173` y enruta `/api`, `/admin`, `/checkin` y `/super-admin` a las APIs locales. Render y producción usan las mismas rutas relativas.

## Seguridad de sesión

El navegador no recibe ni conserva JWT. Las APIs autentican mediante cookies HttpOnly, `Secure` fuera de local y `SameSite=Lax`. `sessionStorage` contiene únicamente el perfil no sensible necesario para navegación. El bypass y los mocks fallan al iniciar si `VITE_APP_ENV` no es `local`.

## Aplicaciones

- `/`: operación, calendario, asistencia, notas y notificaciones.
- `/admin.html`: administración por tenant.
- `/checkin.html`: recepción y lectura de códigos.
- `/super-admin.html`: administración global.
- `/error.html`: errores 401, 403, 404, 500, 503 y sin conexión.

## Validación

```powershell
npm run lint
npm test
npm run test:e2e
npm run build
```

El contenedor compila con Vite y sirve los assets mediante Nginx. Las variables `*_UPSTREAM` apuntan a los cuatro servicios de API.

Si `docker compose up --build` falla en `npm ci` con `UNABLE_TO_VERIFY_LEAF_SIGNATURE`,
genera primero el bundle local de certificados de Windows:

```powershell
.\scripts\export-windows-ca-bundle.ps1
docker compose up --build --wait
```

El archivo generado en `docker/certs/local-ca.crt` es local y no se sube a git.

Consulta [docs/README.md](docs/README.md) para operación, seguridad y despliegue.
