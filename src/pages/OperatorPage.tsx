import SelectField from "../components/ui/SelectField";
import ParkingModal from "../components/parking/ParkingModal";
import { createOperationLock } from "../lib/operation-lock";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  CarFront,
  CircleCheck,
  CreditCard,
  History,
  LoaderCircle,
  LogIn,
  LogOut,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";
import ParkingHeader from "../components/parking/ParkingHeader";
import ParkingVehicleItem from "../components/parking/ParkingVehicleItem";
import { useParkingData } from "../hooks/useParkingData";
import Toast, { useToast } from "../components/Toast";
import { api } from "../lib/api";
import {
  evasionReasonCodes,
  evasionReasonLabels,
  paymentLabels,
} from "../lib/constants";
import {
  clock,
  durationLabel,
  money,
  movementTotal,
  shortDate,
} from "../lib/format";
import {
  elapsedMinutes,
  getChileLocalMinutes,
  parseTimeToMinutes,
} from "../lib/time";
import {
  DialogMode,
  EvasionReasonCode,
  ParkingRecord,
  PaymentMethod,
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
  const {
    active,
    history,
    summary,
    location,
    parkingConfig,
    status,
    lastUpdated,
    refreshing,
    loadData,
  } = useParkingData(isAdminMode);
  const hasData = lastUpdated !== null;
  const canOperate = status === "ready" && hasData;
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ParkingRecord | null>(null);
  const [receipt, setReceipt] = useState<ParkingRecord | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [receiptDiscountApplied, setReceiptDiscountApplied] = useState(false);
  const [chargeQuoteAt, setChargeQuoteAt] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("debit");
  const [applyPurchaseDiscount, setApplyPurchaseDiscount] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>("charge");
  const [evasionReasonCode, setEvasionReasonCode] = useState<EvasionReasonCode>(
    "left-without-payment",
  );
  const [evasionObservation, setEvasionObservation] = useState("");
  const [busy, setBusy] = useState<"entry" | "exit" | "evasion" | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [mobileTab, setMobileTab] = useState<"entry" | "active">("entry");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const operationLock = useRef(createOperationLock()).current;
  const { toast, showToast, dismissToast } = useToast();

  useEffect(() => {
    if (mobileTab !== "active") return;
    const focusId = window.setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 60);
    return () => window.clearTimeout(focusId);
  }, [mobileTab]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

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
    if (!canOperate || busy) return;
    if (!isEntryAllowedByTime) {
      showToast(
        `Fuera de horario de ingreso (${operatingHoursLabel}).`,
        "warning",
      );
      return;
    }

    if (!VEHICLE_FULL_PATTERN.test(vehicleNumber)) {
      showToast(
        "Patente invalida. Formato: 6 caracteres (2 consonantes, 2 del medio iguales entre si: letras o numeros, y 2 numeros).",
        "warning",
      );
      return;
    }

    if (!operationLock.tryAcquire()) return;
    setBusy("entry");
    dismissToast();
    try {
      const record = await api<ParkingRecord>("/parking/entry", {
        method: "POST",
        body: JSON.stringify({ vehicleNumber }),
      });
      setVehicleNumber("");
      showToast(`Entrada registrada: ${record.vehicleNumber}`, "success");
      await loadData();
    } catch (error) {
      showToast((error as Error).message, "error");
    } finally {
      operationLock.release();
      setBusy(null);
    }
  };

  const registerExit = async () => {
    if (!selected || !canOperate || busy) return;
    if (!operationLock.tryAcquire()) return;
    setOperationError(null);
    setBusy("exit");
    dismissToast();
    try {
      const completed = await api<ParkingRecord>("/parking/exit", {
        method: "POST",
        body: JSON.stringify({
          vehicleNumber: selected.vehicleNumber,
          paymentMethod,
          applyPurchaseDiscount,
          quotedExitTime: new Date(chargeQuoteAt ?? Date.now()).toISOString(),
        }),
      });
      setSelected(null);
      setReceipt(completed);
      setReceiptDiscountApplied(applyPurchaseDiscount);
      await loadData();
    } catch (error) {
      setOperationError((error as Error).message);
    } finally {
      operationLock.release();
      setBusy(null);
    }
  };

  const registerEvasion = async () => {
    if (!selected || !canOperate || busy) return;
    if (!operationLock.tryAcquire()) return;
    setOperationError(null);
    setBusy("evasion");
    dismissToast();
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
      setOperationError((error as Error).message);
    } finally {
      operationLock.release();
      setBusy(null);
    }
  };

  const openCharge = (record: ParkingRecord) => {
    setOperationError(null);
    setPaymentMethod("debit");
    setApplyPurchaseDiscount(false);
    setDialogMode("charge");
    setReceipt(null);
    setReceiptDiscountApplied(false);
    setChargeQuoteAt(Date.now());
    setSelected(record);
  };

  const openEvasion = (record: ParkingRecord) => {
    setOperationError(null);
    setDialogMode("evasion");
    setChargeQuoteAt(null);
    setEvasionReasonCode("left-without-payment");
    setEvasionObservation("");
    setReceipt(null);
    setReceiptDiscountApplied(false);
    setSelected(record);
  };

  const closeDialog = () => {
    if (operationLock.pending) return;
    setOperationError(null);
    setSelected(null);
    setReceipt(null);
    setReceiptDiscountApplied(false);
    setChargeQuoteAt(null);
    setDialogMode("charge");
    setApplyPurchaseDiscount(false);
    setEvasionReasonCode("left-without-payment");
    setEvasionObservation("");
  };

  const quoteClock = chargeQuoteAt ?? now;
  const estimatedMinutes = selected
    ? elapsedMinutes(selected.entryTime, quoteClock)
    : 0;
  const baseEstimatedTotal = selected
    ? estimatedMinutes * (selected.ratePerMinute || summary.ratePerMinute)
    : 0;
  const purchaseDiscountMinutes = Math.max(
    0,
    parkingConfig?.purchaseDiscountMinutes ?? 15,
  );
  const discountMinutes = applyPurchaseDiscount ? purchaseDiscountMinutes : 0;
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
    <main
      className={`app-shell ${isAdminMode ? "is-admin-mode" : "is-operator-mode"}`}
    >
      <Toast toast={toast} onClose={dismissToast} />

      <ParkingHeader
        isAdmin={isAdminMode}
        location={location}
        ratePerMinute={hasData ? summary.ratePerMinute : null}
        now={now}
        status={status}
        lastUpdated={lastUpdated}
        refreshing={refreshing}
        onRetry={() => void loadData()}
      />

      <section
        className={`summary-grid ${isAdminMode ? "summary-grid-admin" : ""}`}
        aria-label="Resumen del dia"
      >
        {isAdminMode && (
          <article className="metric metric-highlight">
            <span>Recaudacion</span>
            <strong
              className={
                summary.revenue >= 1_000_000 ? "metric-value-long" : undefined
              }
            >
              {hasData ? money.format(summary.revenue) : "—"}
            </strong>
            <small>
              {hasData ? summary.completedVehicles : "—"} cobros completados
              desde 08:00
            </small>
          </article>
        )}
        <article className="metric">
          <span>Vehiculos dentro</span>
          <strong>{hasData ? summary.activeVehicles : "—"}</strong>
          <small>ingresados desde 08:00</small>
        </article>
        {isAdminMode && (
          <article className="metric">
            <span>Minutos cobrados</span>
            <strong>{hasData ? summary.billedMinutes : "—"}</strong>
            <small>acumulado desde 08:00</small>
          </article>
        )}
        {isAdminMode && (
          <article className="metric metric-evasion">
            <span>Evasiones</span>
            <strong>{hasData ? summary.evadedVehicles : "—"}</strong>
            <small>
              deuda acumulada{" "}
              {hasData ? money.format(summary.evadedAmount) : "—"}
            </small>
          </article>
        )}
      </section>

      <section className="workspace-grid">
        <nav
          className="mobile-workspace-tabs"
          aria-label="Navegacion operativa"
        >
          <button
            className={mobileTab === "entry" ? "is-active" : ""}
            aria-pressed={mobileTab === "entry"}
            type="button"
            onClick={() => setMobileTab("entry")}
          >
            <LogIn size={18} aria-hidden="true" /> Ingreso
          </button>
          <button
            className={mobileTab === "active" ? "is-active" : ""}
            aria-pressed={mobileTab === "active"}
            type="button"
            onClick={() => setMobileTab("active")}
          >
            <LogOut size={18} aria-hidden="true" /> Salidas (
            {hasData ? active.length : "—"})
          </button>
        </nav>

        <article
          className={`entry-panel panel ${hasData && !isEntryAllowedByTime ? "is-closed" : ""} ${
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
              onChange={(event) =>
                setVehicleNumber(normalizeVehicleInput(event.target.value))
              }
              placeholder="BCDF12"
              minLength={6}
              maxLength={6}
              autoComplete="off"
              disabled={!canOperate || !isEntryAllowedByTime}
              aria-describedby={
                !isEntryAllowedByTime ? "entry-hours-notice" : undefined
              }
            />
            {hasData && !isEntryAllowedByTime && (
              <p
                id="entry-hours-notice"
                className="field-help field-help-warning"
                role="status"
              >
                Ingresos habilitados entre {operatingHoursLabel}. Fuera de ese
                horario solo se permiten cobros y salidas.
              </p>
            )}
            <button
              className={`primary-button ${!isEntryAllowedByTime ? "is-blocked" : ""}`.trim()}
              type="submit"
              disabled={busy !== null || !canOperate || !isEntryAllowedByTime}
              aria-disabled={
                busy !== null || !canOperate || !isEntryAllowedByTime
              }
            >
              {busy === "entry" ? (
                <LoaderCircle
                  size={20}
                  className="icon-spin"
                  aria-hidden="true"
                />
              ) : (
                <LogIn size={20} aria-hidden="true" />
              )}
              {!canOperate
                ? status === "loading"
                  ? "Cargando…"
                  : "Sin conexión"
                : busy === "entry"
                  ? "Registrando..."
                  : !isEntryAllowedByTime
                    ? "Ingresos cerrados"
                    : "Registrar ingreso"}
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
              </div>
              <div className="active-heading-row">
                <div className="exit-search-panel">
                  <label htmlFor="exit-search" className="active-heading-label">
                    <Search size={16} aria-hidden="true" /> Buscar patente
                  </label>
                  <input
                    id="exit-search"
                    ref={searchInputRef}
                    className="plate-input exit-search-input"
                    value={search}
                    onChange={(event) =>
                      setSearch(normalizeVehicleInput(event.target.value))
                    }
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      const query = search
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, "");
                      const exact = filteredActive.find(
                        (record) => record.vehicleNumber === query,
                      );
                      const candidate =
                        exact ??
                        (filteredActive.length === 1
                          ? filteredActive[0]
                          : null);
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
                <div
                  className="active-heading-counter"
                  aria-label="Vehiculos en estacionamiento"
                >
                  <span className="active-heading-label">Vehiculos</span>
                  <strong>{hasData ? active.length : "—"}</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="active-body">
            <div className="active-list-column">
              <div className="vehicle-list">
                <div className="vehicle-inline-head" aria-hidden="true">
                  <span>Patente</span>
                  <span>Entrada</span>
                  <span>Tiempo</span>
                  <span>Estimado</span>
                  <span>Accion</span>
                </div>
                {!hasData ? (
                  <div className="empty-state" role="status">
                    {status === "loading" ? (
                      <LoaderCircle
                        className="icon-spin empty-state-icon"
                        size={32}
                        aria-hidden="true"
                      />
                    ) : (
                      <CarFront
                        className="empty-state-icon"
                        size={32}
                        aria-hidden="true"
                      />
                    )}
                    <strong>
                      {status === "loading"
                        ? "Cargando vehículos…"
                        : "Vehículos no disponibles"}
                    </strong>
                    <p>
                      {status === "loading"
                        ? "Estamos consultando el estacionamiento."
                        : "Recupera la conexión para consultar las estadías."}
                    </p>
                  </div>
                ) : filteredActive.length === 0 ? (
                  <div className="empty-state">
                    <CarFront
                      className="empty-state-icon"
                      size={32}
                      aria-hidden="true"
                    />
                    <strong>
                      {search
                        ? "No encontramos esa patente"
                        : "No hay vehículos dentro"}
                    </strong>
                    <p>
                      {search
                        ? "Prueba con otra patente o borra la búsqueda."
                        : "Los próximos ingresos aparecerán aquí."}
                    </p>
                    {search && (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setSearch("")}
                      >
                        Limpiar búsqueda
                      </button>
                    )}
                  </div>
                ) : (
                  filteredActive.map((record) => (
                    <ParkingVehicleItem
                      key={record._id}
                      record={record}
                      now={now}
                      fallbackRate={summary.ratePerMinute}
                      disabled={!canOperate || busy !== null}
                      onCharge={openCharge}
                      onEvasion={openEvasion}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="history-panel panel">
        <div className="panel-heading history-heading">
          <div>
            <p className="eyebrow with-icon">
              <History size={16} aria-hidden="true" /> Actividad reciente
            </p>
            <h3>
              {isAdminMode ? "Historial completo" : "Ultimos 10 movimientos"}
            </h3>
          </div>
          <span className="history-count">
            {!hasData
              ? "—"
              : isAdminMode
                ? `${history.length} registros`
                : `${history.length} de 10`}
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
                {isAdminMode && <th>Boleta/Desc.</th>}
                <th className="align-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={isAdminMode ? 7 : 6} className="table-empty">
                    {!hasData
                      ? status === "loading"
                        ? "Cargando movimientos…"
                        : "Historial no disponible sin conexión."
                      : "Aún no hay movimientos registrados."}
                  </td>
                </tr>
              ) : (
                history.map((record) => (
                  <tr key={record._id}>
                    <td>
                      <span className="table-plate">
                        {record.vehicleNumber}
                      </span>
                    </td>
                    <td>{shortDate.format(new Date(record.entryTime))}</td>
                    <td>
                      {record.exitTime
                        ? shortDate.format(new Date(record.exitTime))
                        : "-"}
                    </td>
                    <td>{durationLabel(record.totalMinutes ?? 0)}</td>
                    <td>
                      {record.status === "evaded"
                        ? "Evasion"
                        : record.paymentMethod
                          ? paymentLabels[record.paymentMethod]
                          : "-"}
                    </td>
                    {isAdminMode && (
                      <td>
                        {record.status === "completed"
                          ? record.purchaseDiscountApplied === true
                            ? `Si (${record.discountMinutesApplied ?? purchaseDiscountMinutes} min)`
                            : record.purchaseDiscountApplied === false
                              ? "No"
                              : "-"
                          : "-"}
                      </td>
                    )}
                    <td className="align-right table-total">
                      {money.format(movementTotal(record))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="movement-cards" aria-label="Movimientos recientes">
          {history.length === 0 ? (
            <p className="movement-empty">
              {!hasData
                ? "Historial no disponible todavía."
                : "Aún no hay movimientos registrados."}
            </p>
          ) : (
            history.map((record) => (
              <article className="movement-card" key={record._id}>
                <div className="movement-card-heading">
                  <strong className="table-plate">
                    {record.vehicleNumber}
                  </strong>
                  <span
                    className={`movement-status movement-status--${record.status}`}
                  >
                    {record.status === "evaded" ? "Evasión" : "Pagado"}
                  </span>
                </div>
                <dl>
                  <div>
                    <dt>Entrada</dt>
                    <dd>{shortDate.format(new Date(record.entryTime))}</dd>
                  </div>
                  <div>
                    <dt>Salida</dt>
                    <dd>
                      {record.exitTime
                        ? shortDate.format(new Date(record.exitTime))
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>Duración</dt>
                    <dd>{durationLabel(record.totalMinutes ?? 0)}</dd>
                  </div>
                  <div>
                    <dt>Pago</dt>
                    <dd>
                      {record.status === "evaded"
                        ? "Sin pago"
                        : record.paymentMethod
                          ? paymentLabels[record.paymentMethod]
                          : "—"}
                    </dd>
                  </div>
                  {isAdminMode && (
                    <div>
                      <dt>Descuento</dt>
                      <dd>
                        {record.purchaseDiscountApplied
                          ? `${record.discountMinutesApplied ?? purchaseDiscountMinutes} min`
                          : "No"}
                      </dd>
                    </div>
                  )}
                </dl>
                <div className="movement-card-total">
                  <span>
                    {record.status === "evaded" ? "Deuda" : "Total cobrado"}
                  </span>
                  <strong>{money.format(movementTotal(record))}</strong>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      {(selected || receipt) && (
        <ParkingModal busy={busy !== null} onClose={closeDialog}>
          {receipt ? (
            <>
              <h3 id="charge-title" className="receipt-title">
                {receipt.status === "evaded"
                  ? "Evasion registrada"
                  : "Pago registrado"}
              </h3>
              <div className="receipt-plate">{receipt.vehicleNumber}</div>
              <div
                className={`receipt-total ${
                  receipt.status === "evaded" ? "is-evasion" : ""
                } ${receipt.status !== "evaded" ? "has-ticket" : ""}`}
              >
                <div className="receipt-total-main">
                  <span>
                    {receipt.status === "evaded"
                      ? "Deuda registrada"
                      : "Total cobrado"}
                  </span>
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
                    <CircleCheck size={32} aria-hidden="true" />
                  </div>
                )}
              </div>
              <button
                className="primary-button"
                type="button"
                onClick={closeDialog}
                disabled={busy !== null}
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
                disabled={busy !== null}
                aria-label="Cerrar operacion"
              >
                <X size={20} aria-hidden="true" />
              </button>
              <p className="eyebrow">
                {dialogMode === "evasion"
                  ? "Registrar evasion"
                  : "Cobrar salida"}
              </p>
              <h3 id="charge-title">{selected.vehicleNumber}</h3>
              <div className="dialog-scroll-content">
                <div className="charge-breakdown">
                  <div>
                    <span>Entrada</span>
                    <strong>
                      {clock.format(new Date(selected.entryTime))}
                    </strong>
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
                  className={`charge-total ${dialogMode === "evasion" ? "is-evasion" : ""}`}
                >
                  <span>
                    {dialogMode === "evasion"
                      ? "Deuda estimada"
                      : "Total a cobrar"}
                  </span>
                  <strong>{money.format(estimatedTotal)}</strong>
                </div>
                {dialogMode === "charge" ? (
                  <>
                    <label
                      className="discount-check"
                      htmlFor="purchase-discount"
                    >
                      <input
                        id="purchase-discount"
                        type="checkbox"
                        disabled={busy !== null}
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
                                disabled={busy !== null}
                                checked={paymentMethod === method}
                                onChange={() => setPaymentMethod(method)}
                              />
                              {paymentLabels[method]}
                            </label>
                          ),
                        )}
                      </div>
                    </fieldset>
                  </>
                ) : (
                  <>
                    <p className="evasion-warning">
                      Esta accion marcara el movimiento como evasion y
                      registrara la deuda pendiente del ticket.
                    </p>
                    <div className="form-field">
                      <SelectField
                        id="evasion-reason"
                        label="Motivo"
                        value={evasionReasonCode}
                        disabled={busy !== null}
                        onChange={(value) =>
                          setEvasionReasonCode(value as EvasionReasonCode)
                        }
                        options={evasionReasonCodes.map((value) => ({
                          value,
                          label: evasionReasonLabels[value],
                        }))}
                      />
                    </div>
                    <div className="form-field">
                      <label htmlFor="evasion-observation">
                        Observacion <span>opcional</span>
                      </label>
                      <textarea
                        id="evasion-observation"
                        disabled={busy !== null}
                        value={evasionObservation}
                        onChange={(event) =>
                          setEvasionObservation(
                            event.target.value.slice(0, 240),
                          )
                        }
                        placeholder="Detalle breve para auditoria"
                      />
                      <small>{evasionObservation.length}/240</small>
                    </div>
                  </>
                )}
                <p className="dialog-note">
                  {dialogMode === "evasion"
                    ? "La deuda final se calcula al registrar la evasion."
                    : applyPurchaseDiscount
                      ? `Descuento de ${discountMinutes} min aplicado sobre ${money.format(baseEstimatedTotal)}.`
                      : "El total final se calcula al confirmar la salida."}
                </p>
              </div>
              <footer className="dialog-footer">
                {operationError && (
                  <p className="operation-error" role="alert">
                    {operationError}
                  </p>
                )}
                <div className="dialog-footer-total">
                  <span>
                    {dialogMode === "evasion"
                      ? "Deuda estimada"
                      : "Total a cobrar"}
                  </span>
                  <strong>{money.format(estimatedTotal)}</strong>
                </div>
                {!canOperate && (
                  <p role="status">
                    Sin conexión. Recupera la conexión para confirmar.
                  </p>
                )}
                <button
                  className={`primary-button ${dialogMode === "evasion" ? "danger-button" : ""}`}
                  type="button"
                  onClick={
                    dialogMode === "evasion" ? registerEvasion : registerExit
                  }
                  disabled={busy !== null || !canOperate}
                >
                  {busy ? (
                    <LoaderCircle
                      size={20}
                      className="icon-spin"
                      aria-hidden="true"
                    />
                  ) : dialogMode === "evasion" ? (
                    <TriangleAlert size={20} aria-hidden="true" />
                  ) : (
                    <CreditCard size={20} aria-hidden="true" />
                  )}
                  {busy
                    ? "Procesando…"
                    : dialogMode === "evasion"
                      ? "Confirmar evasión"
                      : "Confirmar cobro y salida"}
                </button>
              </footer>
            </>
          ) : null}
        </ParkingModal>
      )}
    </main>
  );
}
