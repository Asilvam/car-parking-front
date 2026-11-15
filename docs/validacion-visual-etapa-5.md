# Validación visual y funcional — etapa 5

Fecha: 15 de noviembre de 2026. Runtime de validación: Node.js 26.13.1.

Resultado: validación local completada. Cambios sin desplegar. El soporte para varios estacionamientos y tarifas administrables sigue en su plan separado.

## Pruebas ejecutadas

| Capa | Resultado | Alcance |
| --- | --- | --- |
| Frontend: `npm test` | 8 aprobadas | Solicitudes concurrentes, cancelación, recuperación, bloqueo de doble envío y filtros/fechas |
| Backend: `npm test -- --runInBand` | 48 aprobadas, 13 suites | Facturación, horarios, configuración, CORS, auditoría, autenticación y reportes |
| Backend: `npm run test:visual-flows` | 13 aprobadas | Controladores y servicios reales vía HTTP con persistencia en memoria |
| Frontend: `npm run build` | Correcto | TypeScript y Vite |
| Backend: `npm run build` | Correcto | NestJS y TypeScript |
| `git diff --check` | Correcto en ambos repositorios | Espacios y formato de diff |

Total actualizado: 69 pruebas automatizadas aprobadas.

La prueba HTTP está en `car-parking-backend/test/visual-flows.e2e-spec.ts`. No importa AppModule ni conecta MongoDB; no lee el entorno ni ejecuta migraciones. El almacenamiento en memoria reproduce solo las operaciones utilizadas por el flujo y no sustituye una prueba de índices, transacciones o persistencia real de MongoDB.

## Flujos comprobados

- Entrada válida y normalización de patente; rechazo de patente inválida y entrada duplicada.
- Cobro exacto con hora cotizada y conservación de la tarifa de ingreso, aunque cambie la tarifa general.
- Descuento de 15 minutos, reingreso después de salida y rechazo de segunda salida.
- Evasión con motivo, observación, importe pendiente y auditoría; deuda separada de recaudación.
- Informes protegidos: contraseña incorrecta, inicio, filtros de estado/pago, exportación real y cierre de sesión.
- Libro Excel real generado por el backend, con hojas Movimientos y Resumen y contenido filtrado; sin etiquetas Chile/Santiago en el período.
- En navegador: ingreso simulado, error de duplicado, cobro con descuento y comprobante coincidente, evasión y comprobante de deuda.
- Doble clic mientras se confirma genera una sola solicitud. Durante el envío se bloquean controles y cierre/Escape y el foco permanece dentro del diálogo.
- Carga lenta, fallo inicial y pérdida de conexión con datos previos: tarifa desconocida como —, acciones bloqueadas, instantánea conservada y recuperación posterior.
- Edición nativa de fecha con teclado marca cambios pendientes; la consulta se realiza solo al aplicar. Selección de estado con teclado y filtro mostrado coinciden.
- Menú con flechas/Enter, Escape y cierre por clic fuera; al redimensionar se cierra para no conservar una posición obsoleta.

Las interacciones visuales usan una API temporal aislada con datos ficticios. La lógica real del backend se verifica por separado en la prueba HTTP persistida. No se registraron movimientos ni se ejecutaron migraciones sobre una base de datos real.

## Pantallas y tamaños

Operador `/`, operación administrativa `/admin` y reportes `/admin/reports` revisados a 320, 360, 390, 680, 681, 768, 980, 981, 1024, 1440 y 1920 px, con altura de 900 px. No se detectó desborde horizontal de página.

- Hasta 680 px: pestañas de operación y tarjetas de movimientos.
- De 681 a 980 px: ambos paneles operativos apilados.
- Desde 981 px: ingreso y vehículos activos en columnas.
- Tablas de reportes conservan desplazamiento interno cuando el ancho lo necesita, sin desbordar la página.
- Catorce vehículos activos y trece cobros de prueba permiten comprobar listas extensas y el límite de diez movimientos del operador.
- Nombre largo de ubicación mostrado completo y recaudación extrema de $1.234.567.890 sin dividir ni desbordar la cifra.
- Paneles con altura reducida de 500 px conservan la confirmación y permiten desplazar el cuerpo.

## Contraste y teclado

Se revisaron colores calculados sobre los fondos de los elementos de texto renderizados, excluyendo controles deshabilitados. Las muestras de operador, administración, diálogo e informes no presentaron fallos en ese chequeo (incluida una muestra de 409 elementos en informes). No es una certificación de accesibilidad ni incluye lectura por un lector de pantalla.

| Elemento | Colores sobre blanco | Relación calculada |
| --- | --- | --- |
| Texto secundario | #5C6C63 | 5,56:1 |
| Acción principal | #16634A | 7,20:1 |
| Borde de campo | #7A8C80 | 3,57:1 |
| Indicador de foco | #357555 | 5,49:1 |
| Placeholder | #65736B | 4,98:1 |

Se comprobó foco inicial, Tab/Mayús+Tab, Escape y devolución al disparador o al buscador si el vehículo ya salió. El fondo del diálogo permanece inerte y el scroll de la página se restaura al cerrar.

## Ajustes realizados durante esta etapa

1. Bordes de campos, placeholders e indicadores de foco más contrastados, incluido el enlace de marca y los grupos de pago/descuento.
2. Tamaño de importes grandes adaptado para conservar la cifra en una línea.
3. Cierre del desplegable al redimensionar la ventana o el viewport visible.
4. Prueba HTTP aislada reproducible y comando `test:visual-flows` en el backend.

## Evidencias y límites

Capturas de esta sesión: carpeta `minuto-stage5` dentro de las visualizaciones; `admin-desktop.jpg` y `reports-mobile.jpg`. Los valores de las capturas son ficticios.

Antes de publicar falta verificar Safari iOS y Chrome Android en dispositivos físicos, incluyendo teclado en pantalla, áreas seguras y lector de pantalla. La reducción del viewport y VisualViewport no equivalen a una prueba física. Tampoco se validó una instalación de producción ni una base MongoDB real.

El despliegue permanece como paso separado; esta etapa no publica cambios.

## Complemento — Compra y cierre en $0

Se añadieron cinco casos HTTP a las ocho pruebas de integración originales: estadía mínima, 12 minutos, 15 minutos exactos, 15 minutos y 1 milisegundo y 15 minutos sin beneficio por compras. Se comprueban importe, minutos cobrados, ausencia de deuda, estado finalizado y rechazo de una segunda salida. El análisis y las mejoras pendientes están en los README; no se implementaron cambios en la política ni en los estados de cobro.
