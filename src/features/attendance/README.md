# Registro de asistencias

Pagina clinica para que medico o terapeuta registre la asistencia final de sus citas del dia. Es independiente del check-in general de llegada al CRIT.

## Endpoints usados

- `GET /appointments`: obtiene citas por rango de fecha y, cuando la sesion incluye `user.id`, por `collaboratorId`.
- `GET /attendance`: obtiene registros de asistencia del rango visible.
- `POST /attendance`: crea el registro con estatus `present`, `rescheduled` o `absent`.
- `GET /medical-notes`: consulta notas para marcar si la cita ya tiene nota.
- `POST /medical-notes`: guarda la nota medica rapida asociada a la cita.

## Contratos pendientes

- Sesion: `GET /auth/login` debe entregar `user.id`, `user.fullName`, `user.email` y `user.area` para filtrar pacientes asignados y area de coordinacion sin inventar datos en frontend.
- Permisos backend: validar que terapeuta/medico solo acceda a sus citas, coordinador solo a su area, recepcion no registre asistencia clinica, y admin/direccion sean solo lectura.
- Actualizacion de asistencia: exponer `PATCH /attendance/:id` o equivalente para cambiar estado con trazabilidad.
- Reagendamiento: definir endpoint de reagendamiento de cita desde este flujo o confirmar si `POST /attendance` con `rescheduled` es suficiente para el MVP.
- Inasistencia automatica: job/backend configurable por tolerancia que marque `absent`, guarde origen automatico, fecha, usuario sistema y motivo.
- Nota pendiente: endpoint para crear notificacion `pending_note` dirigida solo al terapeuta responsable y endpoint para resolverla cuando se guarde la nota.
- Tiempo real: SSE, WebSocket o suscripciones autenticadas para `appointment_changed`, `attendance_changed` y `reception_checkin_registered`, con scope por usuario/area.
- Escaneo terapeutico: `apps/checkin/` debe aceptar `mode=therapeutic-attendance`, identificar paciente y devolver la cita terapeutica mas cercana del area del usuario. La tecnologia de gafete queda abierta.

## Validacion manual

- Entrar como `medico` o `terapeuta` con sesion que incluya `user.id`; verificar que solo aparezcan citas del dia asignadas y que no exista selector de fecha.
- Registrar `Asistio`, `Reagendar` y `No asistio`; confirmar cambio visual inmediato y apertura del formulario de nota.
- Guardar una nota rapida con resumen obligatorio; confirmar que la tarjeta queda como nota registrada.
- Usar `Capturar despues`; debe mostrarse el contrato pendiente de notificacion hasta que exista backend.
- Entrar como `coordinador`, `admin` o `direccion`; confirmar selector de fecha y vista de solo lectura.
- Probar el boton `Escanear gafete`; debe navegar a `/apps/checkin/?mode=therapeutic-attendance`.
