import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import AdminApp from "./AdminApp";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3500";

type PaymentMethod = "cash" | "debit" | "credit" | "transfer";
type EvasionReasonCode =
  | "left-without-payment"
  | "payment-refused"
  | "operator-record-correction"
  | "unknown"
  | "other";
type DialogMode = "charge" | "evasion";

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
  evasionReasonCode?: EvasionReasonCode;
  evasionObservation?: string;
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

const evasionReasonLabels: Record<EvasionReasonCode, string> = {
  "left-without-payment": "Se retiró sin pagar",
  "payment-refused": "Rechazó el pago",
  "operator-record-correction": "Corrección del registro",
  unknown: "Motivo desconocido",
  other: "Otro motivo",
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
  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [evasionReason, setEvasionReason] =
    useState<EvasionReasonCode>("left-without-payment");
  const [evasionObservation, setEvasionObservation] = useState("");
  const [busy, setBusy] = useState<"entry" | "exit" | "evasion" | null>(
    null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [connected, setConnected] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  const loadData = useCallback(async () => {
    try {
      const [
        activeRecords,
        completedRecords,
        evadedRecords,
        today,
        currentLocation,
        config,
      ] =
        await Promise.all([
          api<ParkingRecord[]>("/parking?status=active"),
          api<ParkingRecord[]>("/parking?status=completed"),
          api<ParkingRecord[]>("/parking?status=evaded"),
          api<Summary>("/parking/summary/today"),
          api<ParkingLocation>("/locations/current"),
          api<ParkingConfig>("/parking/config"),
        ]);
      const movements = [...completedRecords, ...evadedRecords].sort(
        (left, right) =>
          new Date(right.exitTime ?? right.entryTime).getTime() -
          new Date(left.exitTime ?? left.entryTime).getTime(),
      );
      setActive(activeRecords);
      setHistory(movements);
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
        setDialogMode(null);
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
      setDialogMode(null);
      setReceipt(completed);
      await loadData();
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const registerEvasion = async () => {
    if (!selected) return;
    setBusy("evasion");
    setNotice(null);
    try {
      const evaded = await api<ParkingRecord>("/parking/evasion", {
        method: "POST",
        body: JSON.stringify({
          vehicleNumber: selected.vehicleNumber,
          reasonCode: evasionReason,
          observation: evasionObservation.trim() || undefined,
        }),
      });
      setSelected(null);
      setDialogMode(null);
      setReceipt(evaded);
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
    setDialogMode("charge");
  };

  const openEvasion = (record: ParkingRecord) => {
    setEvasionReason("left-without-payment");
    setEvasionObservation("");
    setReceipt(null);
    setSelected(record);
    setDialogMode("evasion");
  };

  const closeDialog = () => {
    setSelected(null);
    setReceipt(null);
    setDialogMode(null);
    setEvasionObservation("");
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
        <div>
          <p className="eyebrow">Caja de hoy</p>
          <h2>Buenos días, operador.</h2>
          <p>
            {location
              ? `${location.name}${location.address ? ` · ${location.address}` : ""}`
              : "Registra entradas y cobra salidas sin perder tiempo."}
          </p>
        </div>
        <div className="rate-chip">
          <span>Tarifa vigente</span>
          <strong>{money.format(summary.ratePerMinute)}</strong>
          <small>por minuto</small>
        </div>
      </section>

      <section className="summary-grid" aria-label="Resumen del día">
        <article className="metric metric-highlight">
          <span>Recaudación</span>
          <strong>{money.format(summary.revenue)}</strong>
          <small>{summary.completedVehicles} cobros completados</small>
        </article>
        <article className="metric">
          <span>Vehículos dentro</span>
          <strong>{summary.activeVehicles}</strong>
          <small>estacionamientos activos</small>
        </article>
        <article className="metric">
          <span>Minutos cobrados</span>
          <strong>{summary.billedMinutes}</strong>
          <small>acumulado de hoy</small>
        </article>
        <article className="metric metric-evasion">
          <span>Evasiones</span>
          <strong>{money.format(summary.evadedAmount)}</strong>
          <small>{summary.evadedVehicles} salidas sin pago</small>
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
                      <button
                        className="evasion-button"
                        type="button"
                        onClick={() => openEvasion(record)}
                      >
                        Salida sin pago
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
            <h3>Últimos movimientos</h3>
          </div>
          <span className="history-count">{history.length} movimientos</span>
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
                      {record.status === "evaded" ? (
                        <span className="status-badge status-evaded">
                          Evasión
                        </span>
                      ) : record.paymentMethod ? (
                        paymentLabels[record.paymentMethod]
                      ) : (
                        "—"
                      )}
                    </td>
                    <td
                      className={`align-right table-total ${
                        record.status === "evaded" ? "table-debt" : ""
                      }`}
                    >
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
                <div
                  className={`receipt-check ${
                    receipt.status === "evaded" ? "is-evasion" : ""
                  }`}
                  aria-hidden="true"
                >
                  {receipt.status === "evaded" ? "!" : "✓"}
                </div>
                <p className="eyebrow">
                  {receipt.status === "evaded"
                    ? "Evasión registrada"
                    : "Pago registrado"}
                </p>
                <h3 id="charge-title">
                  {receipt.status === "evaded"
                    ? "Salida sin pago"
                    : "Salida completada"}
                </h3>
                <div className="receipt-plate">{receipt.vehicleNumber}</div>
                <div
                  className={`receipt-total ${
                    receipt.status === "evaded" ? "is-evasion" : ""
                  }`}
                >
                  <span>
                    {receipt.status === "evaded"
                      ? "Deuda pendiente"
                      : "Total cobrado"}
                  </span>
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
                <p className="eyebrow">
                  {dialogMode === "evasion"
                    ? "Registrar salida sin pago"
                    : "Cobrar salida"}
                </p>
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
                <div
                  className={`charge-total ${
                    dialogMode === "evasion" ? "is-evasion" : ""
                  }`}
                >
                  <span>
                    {dialogMode === "evasion"
                      ? "Deuda a registrar"
                      : "Total estimado"}
                  </span>
                  <strong>{money.format(estimatedTotal)}</strong>
                </div>
                {dialogMode === "evasion" ? (
                  <>
                    <div className="evasion-warning" role="note">
                      Esta operación cerrará la estadía sin pago y dejará el
                      monto como deuda pendiente. Verifica la patente antes de
                      continuar.
                    </div>
                    <div className="form-field">
                      <label htmlFor="evasion-reason">Motivo</label>
                      <select
                        id="evasion-reason"
                        value={evasionReason}
                        onChange={(event) =>
                          setEvasionReason(
                            event.target.value as EvasionReasonCode,
                          )
                        }
                      >
                        {(
                          Object.keys(
                            evasionReasonLabels,
                          ) as EvasionReasonCode[]
                        ).map((reason) => (
                          <option key={reason} value={reason}>
                            {evasionReasonLabels[reason]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-field">
                      <label htmlFor="evasion-observation">
                        Observación <span>opcional</span>
                      </label>
                      <textarea
                        id="evasion-observation"
                        value={evasionObservation}
                        onChange={(event) =>
                          setEvasionObservation(event.target.value)
                        }
                        maxLength={500}
                        rows={3}
                        placeholder="Agrega un detalle breve de lo ocurrido"
                      />
                      <small>{evasionObservation.length}/500</small>
                    </div>
                    <button
                      className="primary-button danger-button"
                      type="button"
                      onClick={registerEvasion}
                      disabled={busy === "evasion"}
                    >
                      {busy === "evasion"
                        ? "Registrando…"
                        : "Confirmar salida sin pago"}
                    </button>
                    <p className="dialog-note">
                      No se sumará este monto a la recaudación del día.
                    </p>
                  </>
                ) : (
                  <>
                    <fieldset>
                      <legend>Medio de pago</legend>
                      <div className="payment-grid">
                        {(Object.keys(paymentLabels) as PaymentMethod[]).map(
                          (method) => (
                            <label
                              key={method}
                              className={
                                paymentMethod === method ? "is-selected" : ""
                              }
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
                      {busy === "exit"
                        ? "Procesando…"
                        : "Confirmar cobro y salida"}
                    </button>
                    <p className="dialog-note">
                      El total final se calcula al confirmar la salida.
                    </p>
                  </>
                )}
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
