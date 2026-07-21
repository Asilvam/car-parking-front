# Minuto — Frontend

Panel web de operación para un estacionamiento con cobro por minuto.

## Funciones del MVP

- Registro de entrada por patente.
- Listado de vehículos actualmente estacionados.
- Estimación del cobro en tiempo real.
- Salida con efectivo, débito, crédito o transferencia.
- Resumen de caja e historial reciente.

## Configuración

Requiere Node.js `>=22.13.0`.

```bash
cp .env.example .env.local
npm install
npm run dev
```

El frontend usa `http://localhost:3001` como API por defecto. Puedes cambiarlo
mediante `NEXT_PUBLIC_API_URL`.

## Verificación

```bash
npm run build
npm test
```
