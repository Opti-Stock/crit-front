# AP workspace

La pantalla exclusiva de AP se monta dentro de la app principal para el rol
`personal_acompanamiento`. Ese es el identificador real usado por frontend,
API y semillas de base de datos; no se agrega un rol nuevo.

## Rutas

- `#handoff-notes`: notas de enlace.
- `#notifications`: notificaciones.

La navegacion del rol AP solo muestra esas rutas, el usuario autenticado y la
accion de cerrar sesion.

## Servicios usados

- `GET /handoff-notes`
- `POST /handoff-notes`
- `PATCH /handoff-notes/:id/read`
- `GET /notifications`
- `PATCH /notifications/:id/read`
- `PATCH /notifications/:id/unread`

Para AP no se consulta `GET /appointments`, porque la API actual no autoriza
ese rol en el modulo de citas. Tampoco se usa el catalogo completo de pacientes
para crear notas AP; la UI limita la seleccion a pacientes ya visibles por
notas de enlace autorizadas para evitar exponer pacientes fuera de alcance.

## Contratos pendientes

- Tiempo real: exponer SSE o WebSocket autenticado para notas de enlace y
  notificaciones por usuario. Los adaptadores actuales documentan el contrato y
  reportan estado pendiente, sin simular una conexion activa.
- Notificaciones enlazadas: para abrir una conversacion exacta desde una
  notificacion, la API debe devolver `target.patientId` y
  `target.handoffNoteId` o metadatos equivalentes.
- Busqueda autorizada de pacientes AP: si AP debe crear la primera nota de un
  paciente sin historial visible, la API necesita un endpoint o filtro que
  devuelva solo pacientes autorizados por area, cita o permiso.
