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

## Requisitos

- Node.js 22, indicado en `.nvmrc`.
- Backend ejecutándose en `http://localhost:3500`.

## Instalación

```bash
npm install
cp .env.example .env
```

Variables disponibles:

| Variable | Descripción | Valor local |
| --- | --- | --- |
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

Vite sirve el frontend en `http://localhost:3000` y genera la versión de
producción en `dist/`.

## Estructura principal

```text
src/
├── App.tsx          # Pantalla y flujo operativo
├── index.css        # Estilos globales y adaptables
├── main.tsx         # Entrada de React
└── vite-env.d.ts    # Tipos de Vite
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
- `GET /locations/current`

Si la API no está disponible, el panel permanece visible e informa que el
backend está desconectado.
