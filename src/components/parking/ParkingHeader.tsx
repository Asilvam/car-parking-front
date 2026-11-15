import {
  CalendarDays,
  ChartNoAxesCombined,
  LoaderCircle,
  LogOut,
  MapPin,
  RefreshCw,
  Settings,
  Wifi,
  WifiOff,
} from "lucide-react";
import RateDisplay from "../RateDisplay";
import { chileDayMonth, clock } from "../../lib/format";
import type { ParkingLocation } from "../../lib/types";
import type { ParkingLoadStatus } from "../../hooks/useParkingData";

type Props = {
  isAdmin: boolean;
  location: ParkingLocation | null;
  ratePerMinute: number | null;
  now: number;
  status: ParkingLoadStatus;
  lastUpdated: number | null;
  refreshing: boolean;
  onRetry: () => void;
};

export default function ParkingHeader({
  isAdmin,
  location,
  ratePerMinute,
  now,
  status,
  lastUpdated,
  refreshing,
  onRetry,
}: Props) {
  const StatusIcon =
    status === "loading" ? LoaderCircle : status === "error" ? WifiOff : Wifi;
  return (
    <>
      <header className="topbar parking-topbar">
        <a
          className="brand-lockup brand-admin-link"
          href="/"
          aria-label="Minuto, modo operador"
        >
          <span className="brand-mark" aria-hidden="true">
            M
          </span>
          <div>
            <p className="eyebrow">
              {isAdmin ? "Modo administrador" : "Control de estacionamiento"}
            </p>
            <h1>Minuto</h1>
          </div>
        </a>
        <nav className="topbar-actions" aria-label="Navegación principal">
          {isAdmin && (
            <a className="admin-back-link" href="/admin/reports">
              <ChartNoAxesCombined size={18} aria-hidden="true" />
              Informes
            </a>
          )}
          <a
            className="admin-back-link mode-link"
            aria-label={
              isAdmin ? "Volver a modo operador" : "Abrir administración"
            }
            title={isAdmin ? "Modo operador" : "Administración"}
            href={isAdmin ? "/" : "/admin"}
          >
            {isAdmin ? (
              <LogOut size={18} aria-hidden="true" />
            ) : (
              <Settings size={18} aria-hidden="true" />
            )}
            <span>{isAdmin ? "Operador" : "Administración"}</span>
          </a>
        </nav>
      </header>
      <section className="parking-context" aria-label="Estacionamiento actual">
        <div className="parking-location">
          <MapPin size={20} aria-hidden="true" />
          <div>
            <span className="context-label">Estacionamiento</span>
            <strong>
              {location?.name ??
                (status === "loading"
                  ? "Cargando ubicación…"
                  : "Ubicación no disponible")}
            </strong>
          </div>
        </div>
        <div className="parking-date">
          <CalendarDays size={18} aria-hidden="true" />
          <span>{chileDayMonth(now)}</span>
        </div>
        <div className="parking-rate">
          <span className="context-label">Tarifa vigente</span>
          <RateDisplay ratePerMinute={ratePerMinute} />
        </div>
        <div
          className={`connection-status connection-status--${status}`}
          role="status"
        >
          <StatusIcon
            size={16}
            className={status === "loading" ? "icon-spin" : undefined}
            aria-hidden="true"
          />
          <span>
            {status === "loading"
              ? "Conectando…"
              : status === "error"
                ? "Sin conexión"
                : "En línea"}
          </span>
          {status === "ready" && (
            <button
              className="refresh-data-button"
              type="button"
              onClick={onRetry}
              disabled={refreshing}
              aria-label="Actualizar datos"
              title="Actualizar datos"
            >
              <RefreshCw
                size={16}
                className={refreshing ? "icon-spin" : undefined}
                aria-hidden="true"
              />
            </button>
          )}
        </div>
      </section>
      {status !== "ready" && (
        <div className={`data-notice data-notice--${status}`} role="status">
          <span>
            {status === "loading"
              ? "Cargando vehículos y configuración…"
              : lastUpdated
                ? `Mostrando datos de las ${clock.format(new Date(lastUpdated))}. No se pueden registrar operaciones hasta recuperar la conexión.`
                : "No pudimos cargar los datos. Reintenta para registrar operaciones."}
          </span>
          {status === "error" && (
            <button
              type="button"
              className="retry-button"
              onClick={onRetry}
              disabled={refreshing}
            >
              <RefreshCw
                size={16}
                className={refreshing ? "icon-spin" : undefined}
                aria-hidden="true"
              />
              {refreshing ? "Reintentando…" : "Reintentar"}
            </button>
          )}
        </div>
      )}
    </>
  );
}
