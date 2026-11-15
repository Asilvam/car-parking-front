# Plan funcional — Estacionamientos y tarifas administrables

Plan separado del rediseño visual. Estado: planificación; sin implementación. No bloquea la etapa visual 1.

## Fase 1 — Modelo, reglas y migración
- Mantener ParkingLocation y la asociación histórica locationId de cada estadía.
- Configuración por lugar: nombre, código único, dirección, tarifa CLP por minuto, zona horaria, apertura, cierre, cierre automático, descuento y estado.
- Conservar la tarifa de entrada en estadías abiertas; nuevas tarifas aplican solo a nuevos ingresos.
- Crear ubicación inicial desde entorno solo si no existe. No sobrescribir cambios administrativos al reiniciar.
- Copiar horarios/descuento existentes a la ubicación inicial mediante migración idempotente, sin reasignar movimientos con ubicación.

## Fase 2 — API operativa por ubicación
- Listar lugares y consultar su configuración.
- Exigir ubicación explícita en entradas, salidas, evasiones, listados y resumen.
- Validar IDs y aislar todas las consultas por locationId; definir compatibilidad temporal para las rutas actuales durante la transición.
- Desactivar impide nuevas entradas, pero permite finalizar estadías pendientes.
- Ejecutar cierre automático por ubicación y fecha, contemplando estadías pendientes de lugares inactivos.
- Reemplazar caché permanente del lugar único por lecturas actualizadas o invalidación al editar.

## Fase 3 — Administración y auditoría
- GET/POST /admin/locations y PATCH /admin/locations/:id protegidos por AdminGuard.
- Validar tarifa positiva, código único y orden de horarios.
- Auditar creación y cambios, especialmente valor anterior/nuevo de tarifa y ubicación.
- Desactivar en lugar de eliminar ubicaciones con historial.
- Primera versión: sesión administrativa actual con acceso global. Usuarios y permisos por lugar quedan fuera de esta versión.

## Fase 4 — Frontend y reportes
- Agregar listado administrativo y formulario de configuración por lugar.
- Selección operativa explícita mediante URL /locations/:locationId.
- Limpiar diálogos, búsqueda y datos al cambiar de lugar; descartar respuestas antiguas.
- Mostrar lugar y tarifa claramente y explicar que la nueva tarifa afecta próximos ingresos.
- Reportes por locationId o consolidados; incluir ubicación en Excel.

## Fase 5 — Validación y transición
- Probar aislamiento entre lugares y misma patente activa en lugares distintos.
- Probar tarifa histórica, persistencia tras reinicio, desactivación y cierres independientes.
- Validar reportes consolidados, exportaciones y cambio de lugar en móvil/escritorio.
- Coordinar publicación de backend y frontend con compatibilidad de rutas y migración verificada.
