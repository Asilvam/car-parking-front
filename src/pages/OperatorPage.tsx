import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import {
  evasionReasonCodes,
  evasionReasonLabels,
  paymentLabels,
} from "../lib/constants";
import { chileDayMonth, clock, durationLabel, money, movementTotal, shortDate } from "../lib/format";
import { elapsedMinutes, getChileLocalMinutes, parseTimeToMinutes } from "../lib/time";
import {
  DialogMode,
  EvasionReasonCode,
  emptySummary,
  ParkingConfig,
  ParkingLocation,
  ParkingRecord,
  PaymentMethod,
  Summary,
} from "../lib/types";

const CONSONANT = "[B-DF-HJ-NP-TV-Z]";
const VEHICLE_FULL_PATTERN = new RegExp(
  `^${CONSONANT}{2}(?:${CONSONANT}{2}|[0-9]{2})[0-9]{2}$`,
);
const VEHICLE_MAX_LENGTH = 6;

function normalizeVehicleInput(value: string): string {
  const source = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const next: string[] = [];

  for (const char of source) {
    const index = next.length;
    if (index >= VEHICLE_MAX_LENGTH) break;

    if (index < 2) {
      if (!/[B-DF-HJ-NP-TV-Z]/.test(char)) continue;
      next.push(char);
      continue;
    }

    if (index < 4) {
      const thirdChar = next[2];
      const thirdIsDigit = /[0-9]/.test(thirdChar);
      const thirdIsConsonant = new RegExp(CONSONANT).test(thirdChar);

      if (index === 2) {
        if (!new RegExp(`${CONSONANT}|[0-9]`).test(char)) continue;
        next.push(char);
        continue;
      }

      if (thirdIsDigit && !/[0-9]/.test(char)) continue;
      if (thirdIsConsonant && !new RegExp(CONSONANT).test(char)) continue;
      if (!thirdIsDigit && !thirdIsConsonant) continue;
      next.push(char);
      continue;
    }

    if (!/[0-9]/.test(char)) continue;
    next.push(char);
  }

  return next.join("");
}

export default function OperatorPage({
  mode = "operator",
}: {
  mode?: "operator" | "admin";
}) {
  const isAdminMode = mode === "admin";
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<ParkingRecord[]>([]);
  const [history, setHistory] = useState<ParkingRecord[]>([]);
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [location, setLocation] = useState<ParkingLocation | null>(null);
  const [parkingConfig, setParkingConfig] = useState<ParkingConfig | null>(null);
  const [selected, setSelected] = useState<ParkingRecord | null>(null);
  const [receipt, setReceipt] = useState<ParkingRecord | null>(null);
  const [receiptDiscountApplied, setReceiptDiscountApplied] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("debit");
  const [applyPurchaseDiscount, setApplyPurchaseDiscount] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>("charge");
  const [evasionReasonCode, setEvasionReasonCode] =
    useState<EvasionReasonCode>("left-without-payment");
  const [evasionObservation, setEvasionObservation] = useState("");
  const [busy, setBusy] = useState<"entry" | "exit" | "evasion" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [connected, setConnected] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [mobileTab, setMobileTab] = useState<"entry" | "active">("entry");
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!toastMessage) return;
    const timeoutId = window.setTimeout(() => setToastMessage(null), 2500);
    return () => window.clearTimeout(timeoutId);
  }, [toastMessage]);

  useEffect(() => {
    if (mobileTab !== "active") return;
    const focusId = window.setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 60);
    return () => window.clearTimeout(focusId);
  }, [mobileTab]);

  const loadData = useCallback(async () => {
    try {
      const [activeRecords, completedRecords, today, currentLocation, config, evadedRecords] =
        await Promise.all([
          api<ParkingRecord[]>("/parking?status=active"),
          api<ParkingRecord[]>("/parking?status=completed"),
          api<Summary>("/parking/summary/today"),
          api<ParkingLocation>("/locations/current"),
          api<ParkingConfig>("/parking/config"),
          isAdminMode
            ? api<ParkingRecord[]>("/parking?status=evaded")
            : Promise.resolve([] as ParkingRecord[]),
        ]);
      const movements = [...completedRecords, ...evadedRecords].sort(
        (left, right) =>
          new Date(right.exitTime ?? right.entryTime).getTime() -
          new Date(left.exitTime ?? left.entryTime).getTime(),
      );
      setActive(activeRecords);
      setHistory(isAdminMode ? movements : movements.slice(0, 10));
      setSummary(today);
      setLocation(currentLocation);
      setParkingConfig(config);
      setConnected(true);
    } catch {
      setConnected(false);
    }
  }, [isAdminMode]);

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
    return active
      .filter((record) => record.vehicleNumber.includes(query))
      .sort(
        (left, right) =>
          elapsedMinutes(right.entryTime, now) -
          elapsedMinutes(left.entryTime, now),
      );
  }, [active, search, now]);

  const registerEntry = async (event: FormEvent) => {
    event.preventDefault();
    if (!isEntryAllowedByTime) {
      setNotice(`Fuera de horario de ingreso (${operatingHoursLabel}).`);
      return;
    }

    if (!VEHICLE_FULL_PATTERN.test(vehicleNumber)) {
      setNotice(
        "Patente invalida. Formato: 6 caracteres (2 consonantes, 2 del medio iguales entre si: letras o numeros, y 2 numeros).",
      );
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
      setToastMessage(`Entrada registrada: ${record.vehicleNumber}`);
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
          applyPurchaseDiscount,
        }),
      });
      setSelected(null);
      setReceipt(completed);
      setReceiptDiscountApplied(applyPurchaseDiscount);
      await loadData();
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const registerEvasion = async () => {
    if (!selected || !isAdminMode) return;
    setBusy("evasion");
    setNotice(null);
    try {
      const completed = await api<ParkingRecord>("/parking/evasion", {
        method: "POST",
        body: JSON.stringify({
          vehicleNumber: selected.vehicleNumber,
          reasonCode: evasionReasonCode,
          observation: evasionObservation.trim() || undefined,
        }),
      });
      setSelected(null);
      setReceipt(completed);
      setDialogMode("charge");
      setEvasionReasonCode("left-without-payment");
      setEvasionObservation("");
      await loadData();
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const openCharge = (record: ParkingRecord) => {
    setPaymentMethod("debit");
    setApplyPurchaseDiscount(false);
    setDialogMode("charge");
    setReceipt(null);
    setReceiptDiscountApplied(false);
    setSelected(record);
  };

  const openEvasion = (record: ParkingRecord) => {
    setDialogMode("evasion");
    setEvasionReasonCode("left-without-payment");
    setEvasionObservation("");
    setReceipt(null);
    setReceiptDiscountApplied(false);
    setSelected(record);
  };

  const closeDialog = () => {
    setSelected(null);
    setReceipt(null);
    setReceiptDiscountApplied(false);
    setDialogMode("charge");
    setApplyPurchaseDiscount(false);
    setEvasionReasonCode("left-without-payment");
    setEvasionObservation("");
  };

  const estimatedMinutes = selected ? elapsedMinutes(selected.entryTime, now) : 0;
  const baseEstimatedTotal = selected
    ? estimatedMinutes * (selected.ratePerMinute || summary.ratePerMinute)
    : 0;
  const discountMinutes = applyPurchaseDiscount ? 15 : 0;
  const estimatedTotal = selected
    ? Math.max(estimatedMinutes - discountMinutes, 0) *
      (selected.ratePerMinute || summary.ratePerMinute)
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
    <main className={`app-shell ${isAdminMode ? "is-admin-mode" : "is-operator-mode"}`}>
      <header className="topbar">
        <a
          className="brand-lockup brand-admin-link"
          href={isAdminMode ? "/" : "/admin"}
          aria-label={isAdminMode ? "Volver a modo operador" : "Abrir modo administrador"}
          title={isAdminMode ? "Modo operador" : "Modo administrador"}
        >
          <span className="brand-mark" aria-hidden="true">
            M
          </span>
          <div>
            <p className="eyebrow">
              {isAdminMode
                ? "Modo administrador"
                : location?.name ?? "Control de estacionamiento"}
            </p>
            <h1>Minuto</h1>
          </div>
        </a>
        <div className="topbar-actions">
          {isAdminMode && (
            <a className="admin-back-link" href="/admin/reports">
              Informes
            </a>
          )}
          <div className="topbar-status">
            <span className={`status-dot ${connected ? "is-online" : ""}`} />
            {connected ? "Sistema conectado" : "Backend sin conexion"}
          </div>
        </div>
      </header>

      <section className="dashboard-heading">
        <article className="dash-chip">
          <span>Fecha</span>
          <strong>{chileDayMonth(now)}</strong>
        </article>
        <article className="dash-chip">
          <span>Locacion</span>
          <strong className="chip-location">
            {location?.name ?? "Control de estacionamiento"}
          </strong>
        </article>
        <article className="dash-chip rate-chip">
          <span>Tarifa vigente</span>
          <strong>{money.format(summary.ratePerMinute)}</strong>
          <small>por minuto</small>
        </article>
      </section>

      <section
        className={`summary-grid ${isAdminMode ? "summary-grid-admin" : ""}`}
        aria-label="Resumen del dia"
      >
        {isAdminMode && (
          <article className="metric metric-highlight">
            <span>Recaudacion</span>
            <strong>{money.format(summary.revenue)}</strong>
            <small>{summary.completedVehicles} cobros completados desde 08:00</small>
          </article>
        )}
        <article className="metric">
          <span>Vehiculos dentro</span>
          <strong>{summary.activeVehicles}</strong>
          <small>ingresados desde 08:00</small>
        </article>
        {isAdminMode && (
          <article className="metric">
            <span>Minutos cobrados</span>
            <strong>{summary.billedMinutes}</strong>
            <small>acumulado desde 08:00</small>
          </article>
        )}
        {isAdminMode && (
          <article className="metric metric-evasion">
            <span>Evasiones</span>
            <strong>{summary.evadedVehicles}</strong>
            <small>deuda acumulada {money.format(summary.evadedAmount)}</small>
          </article>
        )}
      </section>

      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)}>
            Cerrar
          </button>
        </div>
      )}

      {toastMessage && (
        <div className="floating-toast" role="status" aria-live="polite">
          {toastMessage}
        </div>
      )}

      <section className="workspace-grid">
        <nav className="mobile-workspace-tabs" aria-label="Navegacion operativa">
          <button
            className={mobileTab === "entry" ? "is-active" : ""}
            type="button"
            onClick={() => setMobileTab("entry")}
          >
            Ingreso
          </button>
          <button
            className={mobileTab === "active" ? "is-active" : ""}
            type="button"
            onClick={() => setMobileTab("active")}
          >
            Salidas ({active.length})
          </button>
        </nav>

        <article
          className={`entry-panel panel ${
            mobileTab === "entry" ? "is-mobile-visible" : "is-mobile-hidden"
          }`}
        >
          <div className="panel-heading">
            <div>
              <p className="eyebrow entry-heading-label">Nuevo ingreso</p>
            </div>
          </div>
          <form onSubmit={registerEntry}>
            <label htmlFor="vehicle-number" className="entry-search-label">
              Patente del vehiculo
            </label>
            <input
              id="vehicle-number"
              className="plate-input"
              value={vehicleNumber}
              onChange={(event) => setVehicleNumber(normalizeVehicleInput(event.target.value))}
              placeholder="BCDF12"
              minLength={6}
              maxLength={6}
              autoComplete="off"
              autoFocus
            />
            <p className="field-help">La hora de entrada se asignara automaticamente.</p>
            {!isEntryAllowedByTime && (
              <p className="field-help field-help-warning">
                Ingresos habilitados entre {operatingHoursLabel}. Fuera de ese horario solo se
                permiten cobros y salidas.
              </p>
            )}
            <button
              className="primary-button"
              type="submit"
              disabled={busy === "entry" || !isEntryAllowedByTime}
            >
              {busy === "entry" ? "Registrando..." : "Registrar entrada"}
            </button>
          </form>
        </article>

        <article
          className={`active-panel panel ${
            mobileTab === "active" ? "is-mobile-visible" : "is-mobile-hidden"
          }`}
        >
          <div className="panel-heading active-heading">
            <div className="active-heading-title">
              <div className="active-heading-top">
                <p className="eyebrow">En estacionamiento</p>
                <div className="active-heading-counter" aria-label="Vehiculos en estacionamiento">
                  <span>Vehiculos</span>
                  <strong>{active.length}</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="active-body">
            <div className="active-search-column">
              <div className="active-heading-row">
                <div className="exit-search-panel">
                  <label htmlFor="exit-search" className="exit-search-label">
                    Busca patente
                  </label>
                  <input
                    id="exit-search"
                    ref={searchInputRef}
                    className="plate-input exit-search-input"
                    value={search}
                    onChange={(event) => setSearch(normalizeVehicleInput(event.target.value))}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      const query = search.toUpperCase().replace(/[^A-Z0-9]/g, "");
                      const exact = filteredActive.find(
                        (record) => record.vehicleNumber === query,
                      );
                      const candidate =
                        exact ?? (filteredActive.length === 1 ? filteredActive[0] : null);
                      if (!candidate) return;
                      event.preventDefault();
                      openCharge(candidate);
                    }}
                    placeholder="BCDF12"
                    autoComplete="off"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </div>
              </div>
            </div>

            <div className="active-list-column">
              <div className="vehicle-list">
                <div className="vehicle-inline-head" aria-hidden="true">
                  <span>Patente</span>
                  <span>Entrada</span>
                  <span>Tiempo</span>
                  <span>Estimado</span>
                  <span>Accion</span>
                </div>
                {filteredActive.length === 0 ? (
                  <div className="empty-state">
                    <span aria-hidden="true">P</span>
                    <strong>No hay vehiculos para mostrar</strong>
                    <p>Los proximos ingresos apareceran aqui.</p>
                  </div>
                ) : (
                  filteredActive.map((record) => {
                    const minutes = elapsedMinutes(record.entryTime, now);
                    return (
                      <div className="vehicle-card" key={record._id}>
                        <div className="vehicle-inline-row">
                          <div className="plate-badge">{record.vehicleNumber}</div>
                          <div className="vehicle-time vehicle-cell-entry">
                            <span>Entrada</span>
                            <strong>{clock.format(new Date(record.entryTime))}</strong>
                          </div>
                          <div className="vehicle-time vehicle-time-elapsed vehicle-cell-time">
                            <span>Tiempo</span>
                            <strong>{durationLabel(minutes)}</strong>
                          </div>
                          <div className="vehicle-estimate vehicle-cell-estimate">
                            <span>Estimado</span>
                            <strong>
                              {money.format(minutes * (record.ratePerMinute || summary.ratePerMinute))}
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
                            {isAdminMode && (
                              <button
                                className="evasion-button"
                                type="button"
                                onClick={() => openEvasion(record)}
                              >
                                Marcar evasion
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="history-panel panel">
        <div className="panel-heading history-heading">
          <div>
            <p className="eyebrow">Actividad reciente</p>
            <h3>{isAdminMode ? "Historial completo" : "Ultimos 10 movimientos"}</h3>
          </div>
          <span className="history-count">
            {isAdminMode ? `${history.length} registros` : `${history.length} de 10`}
          </span>
        </div>
        <div className="history-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Patente</th>
                <th>Entrada</th>
                <th>Salida</th>
                <th>Duracion</th>
                <th>Pago</th>
                <th className="align-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-empty">
                    Aun no hay movimientos registrados.
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
                      {record.exitTime ? shortDate.format(new Date(record.exitTime)) : "-"}
                    </td>
                    <td>{durationLabel(record.totalMinutes ?? 0)}</td>
                    <td>
                      {record.status === "evaded"
                        ? "Evasion"
                        : record.paymentMethod
                          ? paymentLabels[record.paymentMethod]
                          : "-"}
                    </td>
                    <td className="align-right table-total">{money.format(movementTotal(record))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {(selected || receipt) && (
        <div className="dialog-backdrop" role="presentation">
          <section className="charge-dialog" role="dialog" aria-modal="true" aria-labelledby="charge-title">
            {receipt ? (
              <>
                <h3 id="charge-title" className="receipt-title">
                  {receipt.status === "evaded" ? "Evasion registrada" : "Pago registrado"}
                </h3>
                <div className="receipt-plate">{receipt.vehicleNumber}</div>
                <div
                  className={`receipt-total ${
                    receipt.status === "evaded" ? "is-evasion" : ""
                  } ${receipt.status !== "evaded" ? "has-ticket" : ""}`}
                >
                  <div className="receipt-total-main">
                    <span>{receipt.status === "evaded" ? "Deuda registrada" : "Total cobrado"}</span>
                    <strong>{money.format(movementTotal(receipt))}</strong>
                    <small>{durationLabel(receipt.totalMinutes ?? 0)}</small>
                    {receipt.status !== "evaded" && receiptDiscountApplied && (
                      <p className="receipt-discount-note">
                        Descuento por compras aplicado.
                      </p>
                    )}
                  </div>
                  {receipt.status !== "evaded" && (
                    <div className="receipt-total-ticket" aria-hidden="true">
                      ✓
                    </div>
                  )}
                </div>
                <button className="primary-button" type="button" onClick={closeDialog}>
                  Listo
                </button>
              </>
            ) : selected ? (
              <>
                <button className="dialog-close" type="button" onClick={closeDialog} aria-label="Cerrar operacion">
                  ×
                </button>
                <p className="eyebrow">{dialogMode === "evasion" ? "Registrar evasion" : "Cobrar salida"}</p>
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
                    <strong>{money.format(selected.ratePerMinute || summary.ratePerMinute)}/min</strong>
                  </div>
                </div>
                <div className={`charge-total ${dialogMode === "evasion" ? "is-evasion" : ""}`}>
                  <span>{dialogMode === "evasion" ? "Deuda estimada" : "Total estimado"}</span>
                  <strong>{money.format(estimatedTotal)}</strong>
                </div>
                {dialogMode === "charge" ? (
                  <>
                    <label className="discount-check" htmlFor="purchase-discount">
                      <input
                        id="purchase-discount"
                        type="checkbox"
                        checked={applyPurchaseDiscount}
                        onChange={(event) =>
                          setApplyPurchaseDiscount(event.target.checked)
                        }
                      />
                      <span>Descuento por compras</span>
                    </label>
                    <fieldset>
                      <legend>Medio de pago</legend>
                      <div className="payment-grid">
                        {(Object.keys(paymentLabels) as PaymentMethod[]).map((method) => (
                          <label key={method} className={paymentMethod === method ? "is-selected" : ""}>
                            <input
                              type="radio"
                              name="payment"
                              value={method}
                              checked={paymentMethod === method}
                              onChange={() => setPaymentMethod(method)}
                            />
                            {paymentLabels[method]}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <button
                      className="primary-button"
                      type="button"
                      onClick={registerExit}
                      disabled={busy === "exit"}
                    >
                      {busy === "exit" ? "Procesando..." : "Confirmar cobro y salida"}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="evasion-warning">
                      Esta accion marcara el movimiento como evasion y registrara la deuda pendiente del ticket.
                    </p>
                    <div className="form-field">
                      <label htmlFor="evasion-reason">Motivo</label>
                      <select
                        id="evasion-reason"
                        value={evasionReasonCode}
                        onChange={(event) => setEvasionReasonCode(event.target.value as EvasionReasonCode)}
                      >
                        {evasionReasonCodes.map((code) => (
                          <option key={code} value={code}>
                            {evasionReasonLabels[code]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-field">
                      <label htmlFor="evasion-observation">
                        Observacion <span>opcional</span>
                      </label>
                      <textarea
                        id="evasion-observation"
                        value={evasionObservation}
                        onChange={(event) => setEvasionObservation(event.target.value.slice(0, 240))}
                        placeholder="Detalle breve para auditoria"
                      />
                      <small>{evasionObservation.length}/240</small>
                    </div>
                    <button
                      className="primary-button danger-button"
                      type="button"
                      onClick={registerEvasion}
                      disabled={busy === "evasion"}
                    >
                      {busy === "evasion" ? "Registrando..." : "Confirmar evasion"}
                    </button>
                  </>
                )}
                <p className="dialog-note">
                  {dialogMode === "evasion"
                    ? "La deuda final se calcula al registrar la evasion."
                    : applyPurchaseDiscount
                      ? `Descuento aplicado sobre ${money.format(baseEstimatedTotal)}.`
                      : "El total final se calcula al confirmar la salida."}
                </p>
              </>
            ) : null}
          </section>
        </div>
      )}
    </main>
  );
}
