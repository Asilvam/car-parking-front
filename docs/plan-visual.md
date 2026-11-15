# Plan visual — Minuto

Este plan es independiente del soporte para varios estacionamientos. Las etapas visuales 1–4 pueden desarrollarse con la API actual; la validación de la etapa 5 corresponde a estos flujos actuales. La interfaz de ubicaciones tendrá su propia validación posterior.

## Etapa 1 — Distribución adaptable (completada)
- Escritorio (>980 px): ingreso y vehículos activos simultáneos, con columna de ingreso de 280 px y lista flexible.
- Tablet (681–980 px): ambos paneles apilados.
- Móvil (hasta 680 px): mantener pestañas Ingreso/Salidas y mostrar el panel seleccionado.
- Ajustar ancho del contenedor, formulario y columnas de vehículos para evitar desbordes.
- Comprobar operador y operación administrativa a 390, 768, 1024 y 1440 px, incluyendo cambio de pestaña y posterior ampliación de pantalla.

## Etapa 2 — Sistema visual (completada)
- Tokens semánticos para paleta verde bosque, superficies blancas y lima como acento.
- Unificar tipografía, espacios, radios, bordes, foco y estados de botones.
- Consolidar estilos repetidos y separar estilos base, operación y administración.

## Etapa 3 — Operación e iconos (completada)
- Compactar cabecera y destacar búsqueda, patente y cobro.
- Diferenciar cobro de evasión; incorporar Lucide con etiquetas accesibles.
- Separar primera carga, datos disponibles y desconexión; no mostrar una tarifa ficticia de cero.
- Extraer componentes conforme se cambian, manteniendo cálculos y solicitudes actuales.

## Etapa 4 — Diálogos y reportes móviles (completada)
- Panel inferior de cobro en móvil, foco controlado y confirmación visible.
- Impedir envíos repetidos y cierres durante el procesamiento.
- Adaptar filtros, historial y reportes; separar filtros editados de aplicados y alinear exportación.

## Etapa 5 — Validación y entrega (completada en entorno local)
- Compilación y comprobación visual de pantallas y flujos actuales.
- Validar entradas, cobros, descuentos, evasiones, errores, teclado y contraste.
- Usar datos locales de prueba sin registrar movimientos reales.
- Revisar resultado antes de un despliegue separado.

## Validación de etapa 1
- `npm run build`: correcto.
- Navegador: operador y operación administrativa revisados a 390, 768, 1024 y 1440 px, sin desborde horizontal de página en estados vacíos.
- Cambio de Salidas en móvil a escritorio: ambos paneles visibles correctamente.
- API desconectada durante la inspección: listas con registros y flujos de cobro quedan para la validación con datos de prueba.
- Capturas de referencia: /private/tmp/minuto-visual-stage1/desktop.jpg y mobile.jpg.

## Implementación y validación de etapa 2
- Paleta semántica verde bosque, fondo neutro, superficies blancas y lima limitado a la marca; bordes/radios y foco compartidos.
- Los controles de operación usan selectores comunes `.app-shell`; los selectores por rol quedan para visibilidad de información.
- Tarifa renderizada por RateDisplay con importe y /min alineados a la izquierda en ambos modos.
- Estilos de informes trasladados de globals.css a admin.css; operator.css contiene las reglas operativas compartidas.
- Métricas administrativas antes de las tareas en móvil, cuadrícula 2 × 2 y texto claro sobre recaudación verde.
- Ingreso cerrado compacto: campo oculto y deshabilitado, aviso separado y botón claramente inactivo. Sin autofocus al abrir la página.
- Vehículos con datos ficticios revisados en ambos modos a 390, 768, 1024 y 1440 px: sin desborde de página ni de lista en escritorio/tablet.
- Tarifas comparadas por estilos calculados: misma alineación y tamaños de 20 px móvil / 28 px escritorio en ambos modos.
- Se verificaron ingreso abierto, ingreso cerrado, lista con vehículos y acceso a informes. Las pruebas visuales usaron una API temporal de solo lectura, sin registros reales.
- `npm run build`: correcto. Iconos y comportamiento de carga siguen previstos en etapa 3; reportes móviles completos, en etapa 4.
- Capturas en la carpeta de visualizaciones de la sesión: minuto-stage2.

## Implementación y validación de etapa 3
- Cabecera compartida ParkingHeader: ubicación completa, fecha, tarifa y estado en franja compacta; accesos explícitos a administración, operador e informes.
- Iconos Lucide en navegación, búsqueda, cobro, evasión, comprobante, avisos y acciones de informes.
- ParkingVehicleItem mantiene un único diseño por rol; cobro primario y evasión secundaria, siempre con etiqueta.
- useParkingData concentra lecturas, actualización cada 30 s, foco y actualización manual. Cada consulta nueva cancela la anterior; límite de 15 s para conexión.
- Primera carga y fallo inicial muestran —, sin tarifas/contadores ficticios. Un fallo posterior conserva la última instantánea e indica su hora; entradas/cobros/evasiones se bloquean hasta recuperar conexión.
- Estados distintos para estacionamiento vacío, búsqueda sin coincidencias, carga y datos no disponibles; búsqueda incluye acción para limpiar.
- `npm test`: cuatro pruebas del coordinador de solicitudes (respuesta antigua, error obsoleto, fallo con conservación/recuperación y cancelación al desmontar).
- Navegador con API temporal de solo lectura: carga demorada, fallo inicial, desconexión con datos previos y recuperación mediante Reintentar, búsqueda sin resultados y apertura/cierre del diálogo sin confirmar movimientos.
- Ambos modos comprobados a 360, 390, 768, 1024 y 1440 px sin desborde horizontal. La tarifa conserva formato y alineación compartidos.
- Capturas en minuto-stage3 dentro de las visualizaciones de la sesión. Ningún movimiento real fue registrado.
- Panel inferior, gestión completa del foco y filtros aplicados siguen en etapa 4.

## Implementación y validación de etapa 4
- ParkingModal usa dialog nativo: fondo inerte, bloqueo de scroll, foco inicial, ciclo Tab/Mayús+Tab, Escape y devolución al disparador (o búsqueda si el vehículo ya salió).
- Panel inferior en móvil con encabezado/pie visibles y cuerpo desplazable; VisualViewport ajusta espacio disponible. En escritorio mantiene ventana centrada ajustada al contenido.
- Total y confirmación en pie separado. Campos y cierre bloqueados durante solicitudes; candado síncrono impide envíos simultáneos incluso antes del siguiente render.
- Los errores de cobro/evasión se muestran dentro del panel y permiten un nuevo intento. Cerrar/Escape no descartan una operación pendiente.
- Historial operativo con tarjetas en móvil, incluyendo cobros y evasiones; tabla en escritorio. Reportes usan el mismo lenguaje visual de tarjetas, estados en español y filtros plegables.
- Filtros editados separados de aplicados; consultar requiere Aplicar filtros. Excel usa la consulta de la instantánea mostrada; exportación bloqueada durante carga/otra exportación y abortada al salir de sesión.
- Una actualización fallida conserva el reporte anterior con explicación explícita; 401 elimina sesión y vuelve al acceso. Fechas y rangos se validan antes de consultar.
- Zona horaria: se mantienen conversiones America/Santiago, sin etiqueta de zona horaria en pantalla ni en los nombres de período exportados por el backend.
- Pruebas locales: doble clic generó una sola solicitud; Escape no cerró mientras procesaba; error simulado y reintento exitoso; comprobante devolvió foco a la búsqueda.
- Navegador: panel probado a 390×844 y 390×500, ciclo de foco y cuerpo desplazable; informes a 360, 390, 768, 1024 y 1440 px sin desborde horizontal.
- Exportación simulada comprobada: Excel válido con cuatro movimientos y misma consulta que el resultado visible, aunque había filtros editados sin aplicar. Sesión expirada y error de consulta también comprobados.
- `npm test`: ocho pruebas aprobadas, incluyendo exclusión de envíos y normalización/validación de filtros. Compilación frontend correcta; backend compilado y pruebas de reportes ejecutadas por el cambio de etiquetas.
- Capturas en minuto-stage4 dentro de visualizaciones de esta sesión. Se usó una API temporal aislada con movimientos ficticios; no se registraron operaciones reales.
- La revisión integral de etapa 5 y las pruebas en dispositivos físicos siguen pendientes. La altura reducida simula espacio disponible; no equivale a verificar un teclado móvil real.

## Ajuste posterior — Desplegables
- Se sustituyó el popup nativo por SelectField compartido en Período, Estado, Medio de pago y Motivo de evasión.
- Opciones dentro de la página, texto 16 px y filas mínimas 44 px; ancho anclado al campo y posición ajustada al espacio visible o cuerpo desplazable del diálogo.
- Comprobados selección con flechas/Enter, Escape, clic fuera y opciones con puntero; Escape cierra primero el menú y después el diálogo.
- Revisado a 360, 440 y 1440 px y dentro del panel de evasión de 500 px de alto. Captura en minuto-selects/reports-period.jpg.

## Resultado de etapa 5
- Informe completo: [validacion-visual-etapa-5.md](validacion-visual-etapa-5.md).
- 69 pruebas automatizadas aprobadas tras el complemento de compras: 8 frontend, 48 backend y 13 de flujo HTTP aislado.
- Ambos proyectos compilan; tres rutas revisadas en once anchos entre 320 y 1920 px.
- Ajustados contraste de controles/foco, importes grandes y cierre de desplegables al redimensionar.
- Sin despliegue ni conexión a MongoDB real. Dispositivos físicos y validación en producción quedan como comprobación previa a publicar.
