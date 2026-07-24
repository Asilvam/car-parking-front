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
- Comprobante del cobro realizado.
- Resumen diario de vehículos, minutos y recaudación (corte operativo desde 08:00).
- Historial de últimos 10 movimientos en modo operador.
- Identificación del estacionamiento compartido por todos los operadores.
- Modo administrador con clave simple.
- Exportación Excel con filtros por día, semana, mes y rango de fechas.
- Diseño adaptable para escritorio y dispositivos móviles.

### Modo operador

- Flujo enfocado en registrar ingreso y cobrar salida.
- No incluye acciones de evasión manual.
- Encabezado compacto con fecha, locación y tarifa vigente.
- El logo `Minuto` abre el modo administrador.

### Modo administrador

- Acceso por `/admin` con clave simple.
- Tabla completa de movimientos filtrados.
- Exportación Excel respetando filtros activos.

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
├── App.tsx          # Modo operador y acceso a admin
├── AdminApp.tsx     # Modo administrador (login, filtros, exportación)
├── index.css        # Estilos globales y adaptables
├── main.tsx         # Entrada de React
└── vite-env.d.ts    # Tipos de Vite
```

## Integración con el backend

El frontend consume los siguientes endpoints:

### Operador

- `POST /parking/entry`
- `POST /parking/exit`
- `GET /parking?status=active`
- `GET /parking?status=completed`
- `GET /parking/summary/today`
- `GET /parking/config`
- `GET /locations/current`

### Administrador

- `POST /admin/auth/login`
- `POST /admin/auth/logout`
- `GET /admin/reports/parking-summary`
- `GET /admin/reports/parking.xlsx`

Si la API no está disponible, el panel permanece visible e informa que el
backend está desconectado.

## Deploy en Cloudflare Pages

Configuración recomendada para `car-parking-front`:

- Framework preset: `Vite`
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `/`
- Node version: `22`

Variables de entorno de Pages:

- `VITE_API_URL` apuntando al backend publicado en Heroku, por ejemplo:
  - `https://car-parking-backend.herokuapp.com`

Notas:

- Las variables `VITE_*` se inyectan en build, por lo que al cambiar
  `VITE_API_URL` debes disparar un nuevo deploy.
- Si usas dominio propio en Pages, actualiza también `FRONTEND_URL` en Heroku
  para CORS.
