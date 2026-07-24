# Agenda

La agenda permite crear y reagendar citas manualmente y consultar hasta cinco
recomendaciones explicables cuando se seleccionan paciente y clínica.

Los filtros de profesional, tipo, sala y fecha reducen progresivamente la
búsqueda. Cambiar un filtro cancela la solicitud anterior y aplica debounce. Una
recomendación llena el formulario, pero nunca guarda automáticamente.

Si el backend responde `APPOINTMENT_RECOMMENDATION_STALE`, el formulario conserva
los datos y vuelve a consultar opciones. La captura manual está disponible, pero
el backend aplica las mismas reglas duras al guardar.
