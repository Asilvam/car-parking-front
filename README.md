# Minuto — Frontend

Panel operativo para registrar entradas y cobrar estacionamientos por minuto.
Está construido como una aplicación React tradicional, sin Next.js ni capas de
renderizado del lado del servidor.

## Tecnologías

- React 19
- TypeScript
- Vite
- CSS nativo

## Funcionalidades

- Registro de entrada mediante patente.
- Normalización de patentes a mayúsculas.
- Listado y búsqueda de vehículos activos.
- Duración y valor estimado actualizados en pantalla.
- Cobro de salida con efectivo, débito, crédito o transferencia.
- Registro manual de salida sin pago con motivo y observación.
- Deuda y evasiones separadas de la recaudación diaria.
- Comprobante del cobro realizado.
- Resumen diario de vehículos, minutos y recaudación.
- Historial de movimientos recientes.
- Identificación del estacionamiento compartido por todos los operadores.
- Diseño adaptable para escritorio y dispositivos móviles.

## Operación de cobro y compras

1. Registrar el ingreso guarda la hora y la tarifa de esa estadía.
2. Abrir **Cobrar** solicita una cotización firmada al servidor mediante `POST /parking/quote`. La hora, tarifa y minutos quedan fijados durante **5 minutos**.
3. **Descuento por compras** descuenta 15 minutos (o `purchaseDiscountMinutes` de la cotización).
4. Confirmar envía `quoteToken`, el beneficio y, si hay un importe positivo, el medio de pago. El backend valida la firma, la estadía y el vencimiento.
5. Cuando el beneficio cubre la estadía, se oculta el medio de pago y **Cerrar salida sin cobro** termina la operación en $0, sin deuda. El comprobante indica **Salida cubierta por compras**.
6. Al vencer la cotización se bloquea la confirmación. **Actualizar cotización** obtiene el importe vigente y exige una nueva confirmación; puede pasar de $0 a un importe positivo.

Con $30/min y compras: 12 o 15 minutos cotizados cierran en $0; 15 minutos y 1 milisegundo se redondean a 16 y dejan $30; 20 minutos dejan $150. El precio cotizado se conserva durante su vigencia aunque transcurra otro minuto.

Los informes y Excel distinguen estadías finalizadas, cobros positivos y salidas cubiertas por compras. Los minutos cobrados excluyen el descuento; los minutos calculados conservan la duración hasta la cotización. También se reconocen cierres históricos en $0 registrados como pagados.

### Integración y pendientes

Este cambio requiere desplegar frontend y backend juntos: `/parking/exit` exige `quoteToken` y ya no acepta una hora enviada por el dispositivo como cotización. El backend permite configurar `PARKING_QUOTE_SECRET`; todas sus instancias deben compartir el mismo secreto.

Queda pendiente acreditar la compra con comprobante/autorización, implementar cierre atómico e idempotente entre operadores y definir un control de salida física. La tarifa administrable y varias ubicaciones siguen en [su plan separado](docs/plan-multiubicacion.md).

## Vistas

- `/`: operador.
- `/admin`: operación administrativa con métricas ampliadas.
- `/admin/reports`: informes con sesión, filtros aplicados explícitamente y exportación del resultado mostrado.

## Requisitos

- Node.js 26 LTS, indicado en `.nvmrc`.
- Backend ejecutándose en `http://localhost:3500`.

```bash
nvm install
nvm use
```

## Instalación

```bash
npm install
cp .env.example .env
```

Variables disponibles:

| Variable       | Descripción          | Valor local             |
| -------------- | -------------------- | ----------------------- |
| `VITE_API_URL` | URL base del backend | `http://localhost:3500` |

Las variables `VITE_*` se incorporan durante la compilación del frontend y no
deben contener secretos.

## Ejecución

```bash
# Desarrollo
npm run dev

# Compilación de producción
npm run build

# Vista previa de la compilación
npm run preview

# Pruebas
npm test
```

Vite sirve el frontend en `http://localhost:5173` y genera la versión de
producción en `dist/`.

## Estructura principal

```text
src/
├── App.tsx                  # Selección de vista por URL
├── pages/                   # Operación y reportes
├── components/parking/      # Cabecera, vehículos y diálogo compartidos
├── components/ui/           # Controles accesibles compartidos
├── hooks/                   # Carga y actualización de datos
├── lib/                     # API, tipos, formatos y utilidades
├── styles/                  # Diseño base y flujos adaptables
└── main.tsx                 # Entrada de React
```

## Integración con el backend

El frontend consume los siguientes endpoints:

- `POST /parking/entry`
- `POST /parking/exit`
- `POST /parking/evasion`
- `GET /parking?status=active`
- `GET /parking?status=completed`
- `GET /parking?status=evaded`
- `GET /parking/summary/today`
- `GET /parking/config`
- `GET /locations/current`
- `POST /admin/auth/login`
- `POST /admin/auth/logout`
- `GET /admin/reports/parking-summary`
- `GET /admin/reports/parking.xlsx`

Si la API no está disponible, el panel permanece visible e informa que el
backend está desconectado.

## Validación de interfaz

El informe de la revisión local y sus límites están en [docs/validacion-visual-etapa-5.md](docs/validacion-visual-etapa-5.md).

```bash
npm test
npm run build
```

## Verificación del ajuste de cobro (15-11-2026)

77 pruebas aprobadas: 9 de frontend, 53 unitarias de backend y 15 HTTP con persistencia aislada. Compilación de ambos proyectos aprobada. Se cubren el límite exacto de vencimiento de cinco minutos, firma y asociación de la cotización, renovación de un importe gratuito a uno positivo, cierres en $0 y métricas netas. La revisión visual utilizó datos simulados; no se conectó a MongoDB ni se registraron pagos reales.
