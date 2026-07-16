# Seguridad y errores

La sesión se transporta exclusivamente por cookie HttpOnly. No agregar tokens a Web Storage, URLs, logs ni mensajes. Las solicitudes usan `credentials: same-origin` y las APIs validan el origen en operaciones mutables.

Los errores globales navegan a `/error.html` para 401, 403, 503, pérdida de conexión y fallos no controlados. Los errores recuperables de formulario continúan inline. La pantalla puede mostrar el `requestId`, pero nunca detalles internos ni contenido clínico.

La CSP de Nginx permite recursos y conexiones del mismo origen, bloquea objetos, iframes y scripts inline. Todo HTML dinámico debe construirse con APIs DOM o escapar texto con `escapeHtml`.
