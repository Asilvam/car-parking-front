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
2. Abrir **Cobrar** congela la hora de cotización usando el reloj del dispositivo. El importe no sigue aumentando mientras ese panel permanece abierto.
3. Si corresponde una compra, marcar **Descuento por compras** descuenta 15 minutos (o el valor de `purchaseDiscountMinutes` informado por la API).
4. Confirmar envía la hora cotizada, el beneficio y el medio de pago. El backend calcula y guarda el resultado; el comprobante muestra su respuesta.
5. Si los minutos descontados cubren toda la duración, el importe final es **$0** y confirmar cierra la estadía normalmente, sin deuda ni evasión. No se cierra automáticamente al marcar la casilla ni al transcurrir los primeros 15 minutos.

Con una tarifa de $30/min: 12 o 15 minutos con compras cierran en $0; 15 minutos y 1 milisegundo se redondean a 16 minutos y dejan $30 por pagar; 20 minutos dejan $150. Sin compras, 15 minutos cuestan $450.

### Limitaciones actuales y propuestas

- La cotización no tiene vencimiento y depende del reloj del dispositivo. Abrir a los 14 minutos y confirmar a los 20 puede mantener el importe en $0. Propuesta: cotización creada por el servidor, con vigencia y nueva confirmación si cambia el valor.
- Un total en $0 todavía muestra medio de pago, **Confirmar cobro y salida** y **Pago registrado**. Propuesta: ocultar el medio de pago y usar **Cerrar salida sin cobro** y **Salida cubierta por compras**, conservando confirmación explícita.
- La compra se acredita manualmente mediante la casilla. Falta definir comprobante/referencia y autorización del beneficio.
- Los cierres en $0 se cuentan como cobros completados. **Minutos cobrados** incluye hoy minutos descontados; debe usar los minutos efectivamente cobrados y distinguir cierres gratuitos de pagos positivos.
- El bloqueo de doble envío del frontend no sustituye un cierre atómico e idempotente en el backend para varios operadores.

Estas son propuestas documentadas; no se ha cambiado el contrato de cobro ni se ha implementado la caducidad de cotizaciones. La tarifa administrable y varias ubicaciones están en [su plan separado](docs/plan-multiubicacion.md).

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
