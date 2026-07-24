import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import AdminApp from "./AdminApp";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3500";

type PaymentMethod = "cash" | "debit" | "credit" | "transfer";

type ParkingRecord = {
  _id: string;
  locationId?: string;
  locationCode?: string;
  vehicleNumber: string;
  entryTime: string;
  exitTime?: string;
  totalMinutes?: number;
  totalCost?: number;
  ratePerMinute: number;
  status: "active" | "completed" | "evaded";
  paymentStatus?: "pending" | "paid" | "evaded";
  exitType?: "paid" | "evasion";
  paymentMethod?: PaymentMethod;
  amountPaid?: number;
  outstandingAmount?: number;
};

type ParkingLocation = {
  id: string;
  code: string;
  name: string;
  address?: string;
  timezone: string;
  currency: string;
  ratePerMinute: number;
};

type ParkingConfig = {
  locationId: string;
  locationCode: string;
  ratePerMinute: number;
  currency: string;
  openTime?: string;
  closeTime?: string;
  autoEvasionTime?: string;
};

type Summary = {
  activeVehicles: number;
  completedVehicles: number;
  revenue: number;
  billedMinutes: number;
  evadedVehicles: number;
  evadedAmount: number;
  ratePerMinute: number;
};

const emptySummary: Summary = {
  activeVehicles: 0,
  completedVehicles: 0,
  revenue: 0,
  billedMinutes: 0,
  evadedVehicles: 0,
  evadedAmount: 0,
  ratePerMinute: 0,
};

const paymentLabels: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  debit: "Débito",
  credit: "Crédito",
  transfer: "Transferencia",
};

const money = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const clock = new Intl.DateTimeFormat("es-CL", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Santiago",
});

const shortDate = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Santiago",
});

function chileDayMonth(dateValue: number): string {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Santiago",
  });
  const parts = formatter.formatToParts(new Date(dateValue));
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.day}-${map.month}`;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message ?? "No se pudo completar la operación");
  }

  return body as T;
}

function elapsedMinutes(entryTime: string, now: number) {
  return Math.max(
    1,
    Math.ceil((now - new Date(entryTime).getTime()) / 60_000),
  );
}

function durationLabel(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours} h ${remainder.toString().padStart(2, "0")} min`;
}

function movementTotal(record: ParkingRecord) {
  if (record.status === "evaded") {
    return record.outstandingAmount ?? record.totalCost ?? 0;
  }

  // Los movimientos creados antes de incorporar amountPaid pueden recibir el
  // valor predeterminado 0 al ser leídos. totalCost conserva el cobro real.
  return record.totalCost ?? record.amountPaid ?? 0;
}

function parseTimeToMinutes(value?: string): number | null {
  if (!value) return null;
  const matched = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!matched) return null;
  return Number(matched[1]) * 60 + Number(matched[2]);
}

function getChileLocalMinutes(nowValue: number): number {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Santiago",
  });
  const parts = formatter.formatToParts(new Date(nowValue));
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Number(map.hour) * 60 + Number(map.minute);
}

export function OperatorApp() {
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<ParkingRecord[]>([]);
  const [history, setHistory] = useState<ParkingRecord[]>([]);
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [location, setLocation] = useState<ParkingLocation | null>(null);
  const [parkingConfig, setParkingConfig] = useState<ParkingConfig | null>(null);
  const [selected, setSelected] = useState<ParkingRecord | null>(null);
  const [receipt, setReceipt] = useState<ParkingRecord | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [busy, setBusy] = useState<"entry" | "exit" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [connected, setConnected] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  const loadData = useCallback(async () => {
    try {
      const [
        activeRecords,
        completedRecords,
        today,
        currentLocation,
        config,
      ] =
        await Promise.all([
          api<ParkingRecord[]>("/parking?status=active"),
          api<ParkingRecord[]>("/parking?status=completed"),
          api<Summary>("/parking/summary/today"),
          api<ParkingLocation>("/locations/current"),
          api<ParkingConfig>("/parking/config"),
        ]);
      const movements = [...completedRecords].sort(
        (left, right) =>
          new Date(right.exitTime ?? right.entryTime).getTime() -
          new Date(left.exitTime ?? left.entryTime).getTime(),
      );
      setActive(activeRecords);
      setHistory(movements.slice(0, 10));
      setSummary(today);
      setLocation(currentLocation);
      setParkingConfig(config);
      setConnected(true);
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
    const refreshApp = window.setInterval(() => {
      setNow(Date.now());
      void loadData();
    }, 30_000);
    const refreshOnFocus = () => void loadData();

    window.addEventListener("focus", refreshOnFocus);
    return () => {
      window.clearInterval(refreshApp);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [loadData]);

  useEffect(() => {
    if (!selected && !receipt) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelected(null);
        setReceipt(null);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selected, receipt]);

  const filteredActive = useMemo(() => {
    const query = search.toUpperCase().replace(/[^A-Z0-9]/g, "");
    return active.filter((record) => record.vehicleNumber.includes(query));
  }, [active, search]);

  const registerEntry = async (event: FormEvent) => {
    event.preventDefault();
    if (!isEntryAllowedByTime) {
      setNotice(`Fuera de horario de ingreso (${operatingHoursLabel}).`);
      return;
    }

    if (vehicleNumber.length < 4) {
      setNotice("Ingresa una patente válida de al menos 4 caracteres.");
      return;
    }

    setBusy("entry");
    setNotice(null);
    try {
      const record = await api<ParkingRecord>("/parking/entry", {
        method: "POST",
        body: JSON.stringify({ vehicleNumber }),
      });
      setVehicleNumber("");
      setNotice(`Entrada registrada: ${record.vehicleNumber}`);
      await loadData();
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const registerExit = async () => {
    if (!selected) return;
    setBusy("exit");
    setNotice(null);
    try {
      const completed = await api<ParkingRecord>("/parking/exit", {
        method: "POST",
        body: JSON.stringify({
          vehicleNumber: selected.vehicleNumber,
          paymentMethod,
        }),
      });
      setSelected(null);
      setReceipt(completed);
      await loadData();
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const openCharge = (record: ParkingRecord) => {
    setPaymentMethod("cash");
    setReceipt(null);
    setSelected(record);
  };

  const closeDialog = () => {
    setSelected(null);
    setReceipt(null);
  };

  const estimatedMinutes = selected
    ? elapsedMinutes(selected.entryTime, now)
    : 0;
  const estimatedTotal = selected
    ? estimatedMinutes * (selected.ratePerMinute || summary.ratePerMinute)
    : 0;
  const openMinutes = parseTimeToMinutes(parkingConfig?.openTime);
  const closeMinutes = parseTimeToMinutes(parkingConfig?.closeTime);
  const chileMinutes = getChileLocalMinutes(now);
  const isEntryAllowedByTime =
    openMinutes === null || closeMinutes === null
      ? true
      : chileMinutes >= openMinutes && chileMinutes < closeMinutes;
  const operatingHoursLabel =
    parkingConfig?.openTime && parkingConfig?.closeTime
      ? `${parkingConfig.openTime} a ${parkingConfig.closeTime}`
      : "horario configurado";

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            M
          </span>
          <div>
            <p className="eyebrow">
              {location?.name ?? "Control de estacionamiento"}
            </p>
            <h1>Minuto</h1>
          </div>
        </div>
        <div className="topbar-status">
          <span className={`status-dot ${connected ? "is-online" : ""}`} />
          {connected ? "Sistema conectado" : "Backend sin conexión"}
        </div>
      </header>

      <section className="dashboard-heading">
        <article className="dash-chip">
          <span>Fecha</span>
          <strong>{chileDayMonth(now)}</strong>
          <small>America/Santiago</small>
        </article>
        <article className="dash-chip">
          <span>Locación</span>
          <strong className="chip-location">
            {location?.name ?? "Control de estacionamiento"}
          </strong>
          <small>{location?.address ?? "Ubicación principal"}</small>
        </article>
        <article className="dash-chip rate-chip">
          <span>Tarifa vigente</span>
          <strong>{money.format(summary.ratePerMinute)}</strong>
          <small>por minuto</small>
        </article>
      </section>

      <section className="summary-grid" aria-label="Resumen del día">
        <article className="metric metric-highlight">
          <span>Recaudación</span>
          <strong>{money.format(summary.revenue)}</strong>
          <small>{summary.completedVehicles} cobros completados desde 08:00</small>
        </article>
        <article className="metric">
          <span>Vehículos dentro</span>
          <strong>{summary.activeVehicles}</strong>
          <small>ingresados desde 08:00</small>
        </article>
        <article className="metric">
          <span>Minutos cobrados</span>
          <strong>{summary.billedMinutes}</strong>
          <small>acumulado desde 08:00</small>
        </article>
      </section>

      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)}>
            Cerrar
          </button>
        </div>
      )}

      <section className="workspace-grid">
        <article className="entry-panel panel">
          <div className="panel-heading">
            <span className="step-number">01</span>
            <div>
              <p className="eyebrow">Nuevo ingreso</p>
              <h3>Registrar patente</h3>
            </div>
          </div>
          <form onSubmit={registerEntry}>
            <label htmlFor="vehicle-number">Patente del vehículo</label>
            <input
              id="vehicle-number"
              className="plate-input"
              value={vehicleNumber}
              onChange={(event) =>
                setVehicleNumber(
                  event.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "")
                    .slice(0, 8),
                )
              }
              placeholder="ABCD12"
              minLength={4}
              maxLength={8}
              autoComplete="off"
              autoFocus
            />
            <p className="field-help">
              La hora de entrada se asignará automáticamente.
            </p>
            {!isEntryAllowedByTime && (
              <p className="field-help field-help-warning">
                Ingresos habilitados entre {operatingHoursLabel}. Fuera de ese
                horario solo se permiten cobros y salidas.
              </p>
            )}
            <button
              className="primary-button"
              type="submit"
              disabled={busy === "entry" || !isEntryAllowedByTime}
            >
              {busy === "entry" ? "Registrando…" : "Registrar entrada"}
              <span aria-hidden="true">→</span>
            </button>
          </form>
        </article>

        <article className="active-panel panel">
          <div className="panel-heading active-heading">
            <div>
              <p className="eyebrow">En estacionamiento</p>
              <h3>{active.length} vehículos activos</h3>
            </div>
            <label className="search-box">
              <span className="sr-only">Buscar patente</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar patente"
              />
            </label>
          </div>

          <div className="vehicle-list">
            {filteredActive.length === 0 ? (
              <div className="empty-state">
                <span aria-hidden="true">P</span>
                <strong>No hay vehículos para mostrar</strong>
                <p>Los próximos ingresos aparecerán aquí.</p>
              </div>
            ) : (
              filteredActive.map((record) => {
                const minutes = elapsedMinutes(record.entryTime, now);
                return (
                  <div className="vehicle-row" key={record._id}>
                    <div className="plate-badge">{record.vehicleNumber}</div>
                    <div className="vehicle-time">
                      <span>Entrada {clock.format(new Date(record.entryTime))}</span>
                      <strong>{durationLabel(minutes)}</strong>
                    </div>
                    <div className="vehicle-estimate">
                      <span>Estimado</span>
                      <strong>
                        {money.format(
                          minutes *
                            (record.ratePerMinute || summary.ratePerMinute),
                        )}
                      </strong>
                    </div>
                    <div className="vehicle-actions">
                      <button
                        className="charge-button"
                        type="button"
                        onClick={() => openCharge(record)}
                      >
                        Cobrar salida
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </article>
      </section>

      <section className="history-panel panel">
        <div className="panel-heading history-heading">
          <div>
            <p className="eyebrow">Actividad reciente</p>
            <h3>Últimos 10 movimientos</h3>
          </div>
          <span className="history-count">{history.length} de 10</span>
        </div>
        <div className="history-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Patente</th>
                <th>Entrada</th>
                <th>Salida</th>
                <th>Duración</th>
                <th>Pago</th>
                <th className="align-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-empty">
                    Aún no hay movimientos registrados.
                  </td>
                </tr>
              ) : (
                history.map((record) => (
                  <tr key={record._id}>
                    <td>
                      <span className="table-plate">{record.vehicleNumber}</span>
                    </td>
                    <td>{shortDate.format(new Date(record.entryTime))}</td>
                    <td>
                      {record.exitTime
                        ? shortDate.format(new Date(record.exitTime))
                        : "—"}
                    </td>
                    <td>{durationLabel(record.totalMinutes ?? 0)}</td>
                    <td>
                      {record.paymentMethod ? paymentLabels[record.paymentMethod] : "—"}
                    </td>
                    <td className="align-right table-total">
                      {money.format(movementTotal(record))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {(selected || receipt) && (
        <div className="dialog-backdrop" role="presentation">
          <section
            className="charge-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="charge-title"
          >
            {receipt ? (
              <>
                <div className="receipt-check" aria-hidden="true">
                  ✓
                </div>
                <p className="eyebrow">Pago registrado</p>
                <h3 id="charge-title">Salida completada</h3>
                <div className="receipt-plate">{receipt.vehicleNumber}</div>
                <div className="receipt-total">
                  <span>Total cobrado</span>
                  <strong>
                    {money.format(movementTotal(receipt))}
                  </strong>
                  <small>{durationLabel(receipt.totalMinutes ?? 0)}</small>
                </div>
                <button
                  className="primary-button"
                  type="button"
                  onClick={closeDialog}
                >
                  Listo
                </button>
              </>
            ) : selected ? (
              <>
                <button
                  className="dialog-close"
                  type="button"
                  onClick={closeDialog}
                  aria-label="Cerrar operación"
                >
                  ×
                </button>
                <p className="eyebrow">Cobrar salida</p>
                <h3 id="charge-title">{selected.vehicleNumber}</h3>
                <div className="charge-breakdown">
                  <div>
                    <span>Entrada</span>
                    <strong>{clock.format(new Date(selected.entryTime))}</strong>
                  </div>
                  <div>
                    <span>Tiempo</span>
                    <strong>{durationLabel(estimatedMinutes)}</strong>
                  </div>
                  <div>
                    <span>Tarifa</span>
                    <strong>
                      {money.format(
                        selected.ratePerMinute || summary.ratePerMinute,
                      )}
                      /min
                    </strong>
                  </div>
                </div>
                <div className="charge-total">
                  <span>Total estimado</span>
                  <strong>{money.format(estimatedTotal)}</strong>
                </div>
                <fieldset>
                  <legend>Medio de pago</legend>
                  <div className="payment-grid">
                    {(Object.keys(paymentLabels) as PaymentMethod[]).map(
                      (method) => (
                        <label
                          key={method}
                          className={paymentMethod === method ? "is-selected" : ""}
                        >
                          <input
                            type="radio"
                            name="payment"
                            value={method}
                            checked={paymentMethod === method}
                            onChange={() => setPaymentMethod(method)}
                          />
                          {paymentLabels[method]}
                        </label>
                      ),
                    )}
                  </div>
                </fieldset>
                <button
                  className="primary-button"
                  type="button"
                  onClick={registerExit}
                  disabled={busy === "exit"}
                >
                  {busy === "exit" ? "Procesando…" : "Confirmar cobro y salida"}
                </button>
                <p className="dialog-note">
                  El total final se calcula al confirmar la salida.
                </p>
              </>
            ) : null}
          </section>
        </div>
      )}
    </main>
  );
}

export default function App() {
  if (window.location.pathname.startsWith("/admin")) {
    return <AdminApp />;
  }

  return <OperatorApp />;
}
