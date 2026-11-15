import { isNoPaymentRequired } from "../lib/parking-payment";
import SelectField from "../components/ui/SelectField";
import {
  Download,
  LoaderCircle,
  LogOut,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Toast, { useToast } from "../components/Toast";
import PresetFields from "../components/admin/PresetFields";
import {
  adminApi,
  ApiError,
  clearAdminToken,
  getAdminToken,
  saveAdminToken,
} from "../lib/api";
import { API_URL, paymentLabels } from "../lib/constants";
import { dateTime, money, todayIso } from "../lib/format";
import { createLatestRequest } from "../lib/latest-request";
import { createOperationLock } from "../lib/operation-lock";
import {
  reportQuery,
  validateReportFilters,
  type ReportFilters,
} from "../lib/report-filters";
import type { SummaryResponse } from "../lib/types";

const statusLabels = {
  active: "Dentro",
  completed: "Pagado",
  evaded: "Evasión",
};
const discountLabel = (row: SummaryResponse["recent"][number]) =>
  row.status !== "completed"
    ? "—"
    : row.purchaseDiscountApplied === true
      ? `Sí (${row.discountMinutesApplied ?? 0} min)`
      : row.purchaseDiscountApplied === false
        ? "No"
        : "—";

export default function AdminReportsPage() {
  const [token, setToken] = useState<string | null>(getAdminToken);
  const [password, setPassword] = useState("");
  const [busyLogin, setBusyLogin] = useState(false);
  const { toast, showToast, dismissToast } = useToast();
  const [draft, setDraft] = useState<ReportFilters>(() => ({
    preset: "day",
    date: todayIso,
    from: todayIso,
    to: todayIso,
    status: "all",
    paymentMethod: "all",
    vehicleNumber: "",
  }));
  const [applied, setApplied] = useState(draft);
  const [revision, setRevision] = useState(0);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    data: SummaryResponse;
    query: string;
  } | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const filterToggleRef = useRef<HTMLButtonElement>(null);
  const exportController = useRef<AbortController | null>(null);
  const exportLock = useRef(createOperationLock()).current;
  const loginLock = useRef(createOperationLock()).current;
  const query = reportQuery(applied);
  const dirty = reportQuery(draft) !== query;
  const summary = result?.data;
  const invalidateSession = () => {
    clearAdminToken();
    setToken(null);
    setResult(null);
  };

  const loader = useMemo(
    () =>
      createLatestRequest(
        async (signal) => {
          const data = await adminApi<SummaryResponse>(
            `/admin/reports/parking-summary?${query}`,
            token!,
            { signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]) },
          );
          return { data, query };
        },
        (snapshot) => {
          setResult(snapshot);
          setLoading(false);
          setReportError(null);
        },
        (error) => {
          setLoading(false);
          if (error instanceof ApiError && error.status === 401) {
            invalidateSession();
            showToast(
              "Sesión administrativa expirada. Ingresa nuevamente.",
              "error",
            );
            return;
          }
          setReportError(
            "No se pudo actualizar el reporte. Reintenta aplicando los filtros.",
          );
        },
      ),
    [token, query, revision, showToast],
  );

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setReportError(null);
    void loader.run();
    return () => loader.cancel();
  }, [token, loader]);
  useEffect(
    () => () => {
      exportController.current?.abort();
    },
    [token],
  );

  const login = async (event: FormEvent) => {
    event.preventDefault();
    if (!loginLock.tryAcquire()) return;
    setBusyLogin(true);
    dismissToast();
    try {
      const response = await fetch(`${API_URL}/admin/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
        signal: AbortSignal.timeout(15_000),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.message ?? "No se pudo iniciar sesión");
      saveAdminToken(body.token);
      setToken(body.token);
      setPassword("");
    } catch (error) {
      showToast((error as Error).message, "error");
    } finally {
      loginLock.release();
      setBusyLogin(false);
    }
  };
  const logout = () => {
    const currentToken = token;
    loader.cancel();
    exportController.current?.abort();
    invalidateSession();
    dismissToast();
    if (currentToken)
      void adminApi("/admin/auth/logout", currentToken, {
        method: "POST",
        signal: AbortSignal.timeout(15_000),
      }).catch(() => undefined);
  };
  const applyFilters = (event: FormEvent) => {
    event.preventDefault();
    const message = validateReportFilters(draft);
    if (message) {
      showToast(message, "warning");
      return;
    }
    setApplied({ ...draft });
    setRevision((value) => value + 1);
    setFiltersExpanded(false);
    if (window.matchMedia("(max-width: 680px)").matches)
      window.requestAnimationFrame(() =>
        filterToggleRef.current?.focus({ preventScroll: true }),
      );
    dismissToast();
  };
  const exportExcel = async () => {
    if (!token || !result || loading || !exportLock.tryAcquire()) return;
    const controller = new AbortController();
    exportController.current = controller;
    setExporting(true);
    setExportError(null);
    dismissToast();
    try {
      // Export the exact snapshot displayed, even if a later filter request failed.
      const response = await fetch(
        `${API_URL}/admin/reports/parking.xlsx?${result.query}`,
        {
          headers: { "x-admin-session": token },
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(30_000),
          ]),
        },
      );
      if (!response.ok) {
        if (response.status === 401) {
          invalidateSession();
          throw new Error("Sesión administrativa expirada.");
        }
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message ?? "No se pudo exportar el reporte");
      }
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      link.download = `reporte-parking-${new Date().toISOString().replace(/:/g, "-").slice(0, 16)}.xlsx`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast("Reporte exportado correctamente.", "success");
    } catch (error) {
      if (!controller.signal.aborted) {
        setExportError((error as Error).message);
        showToast((error as Error).message, "error");
      }
    } finally {
      exportLock.release();
      setExporting(false);
    }
  };
  const update = <K extends keyof ReportFilters>(
    key: K,
    value: ReportFilters[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));

  return (
    <main className="admin-shell">
      <Toast toast={toast} onClose={dismissToast} />
      <header className="topbar admin-topbar">
        <a className="brand-lockup brand-admin-link" href="/admin">
          <span className="brand-mark" aria-hidden="true">
            M
          </span>
          <div>
            <p className="eyebrow">Modo administrador</p>
            <h1>Minuto</h1>
          </div>
        </a>
        <a className="admin-back-link" href="/">
          Operador
        </a>
      </header>
      {!token ? (
        <section className="admin-login">
          <h2>Acceso administrador</h2>
          <form onSubmit={login}>
            <label htmlFor="admin-password">Contraseña</label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              disabled={busyLogin}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button type="submit" disabled={busyLogin}>
              {busyLogin ? "Validando…" : "Entrar"}
            </button>
          </form>
        </section>
      ) : (
        <>
          <header className="admin-header">
            <div>
              <p className="admin-overline">Panel administrativo</p>
              <h2>Reportes y exportación</h2>
              <p className="admin-subtle">Semanas de lunes a domingo.</p>
            </div>
            <button className="admin-logout" onClick={logout}>
              <LogOut size={18} aria-hidden="true" />
              Cerrar sesión
            </button>
          </header>
          <div className="report-toolbar">
            <button
              type="button"
              className="filters-toggle"
              ref={filterToggleRef}
              aria-expanded={filtersExpanded}
              aria-controls="report-filters"
              onClick={() => setFiltersExpanded((value) => !value)}
            >
              <SlidersHorizontal size={18} aria-hidden="true" />
              {filtersExpanded ? "Ocultar filtros" : "Editar filtros"}
              {dirty && (
                <span className="pending-dot" aria-label="Cambios pendientes" />
              )}
            </button>
            <p role="status">
              {dirty
                ? "Hay cambios sin aplicar."
                : result?.query === query
                  ? "Filtros aplicados al reporte."
                  : loading
                    ? "Aplicando filtros…"
                    : reportError
                      ? "Se muestran resultados anteriores."
                      : "Cargando reporte…"}
            </p>
            <button
              type="button"
              className="export-report-button"
              onClick={exportExcel}
              disabled={loading || exporting || !result}
            >
              {exporting ? (
                <LoaderCircle
                  size={18}
                  className="icon-spin"
                  aria-hidden="true"
                />
              ) : (
                <Download size={18} aria-hidden="true" />
              )}
              {exporting ? "Exportando…" : "Exportar Excel"}
            </button>
          </div>
          <form
            id="report-filters"
            className={`admin-filters ${filtersExpanded ? "is-expanded" : ""}`}
            onSubmit={applyFilters}
          >
            <SelectField
              label="Período"
              value={draft.preset}
              onChange={(value) =>
                update("preset", value as ReportFilters["preset"])
              }
              options={[
                { value: "day", label: "Día" },
                { value: "week", label: "Semana" },
                { value: "month", label: "Mes" },
                { value: "range", label: "Rango" },
              ]}
            />
            <PresetFields
              preset={draft.preset}
              date={draft.date}
              from={draft.from}
              to={draft.to}
              onDateChange={(value) => update("date", value)}
              onFromChange={(value) => update("from", value)}
              onToChange={(value) => update("to", value)}
            />
            <SelectField
              label="Estado"
              value={draft.status}
              onChange={(value) =>
                update("status", value as ReportFilters["status"])
              }
              options={[
                { value: "all", label: "Todos" },
                { value: "active", label: "Dentro" },
                { value: "completed", label: "Pagados" },
                { value: "evaded", label: "Evasiones" },
              ]}
            />
            <SelectField
              label="Medio de pago"
              value={draft.paymentMethod}
              onChange={(value) =>
                update("paymentMethod", value as ReportFilters["paymentMethod"])
              }
              options={[
                { value: "all", label: "Todos" },
                ...Object.entries(paymentLabels).map(([value, label]) => ({
                  value,
                  label,
                })),
              ]}
            />
            <label>
              Patente
              <input
                value={draft.vehicleNumber}
                onChange={(event) =>
                  update(
                    "vehicleNumber",
                    event.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, "")
                      .slice(0, 6),
                  )
                }
                placeholder="BCDF12"
                autoComplete="off"
              />
            </label>
            <div className="admin-actions">
              <button type="submit" disabled={loading}>
                <SlidersHorizontal size={18} aria-hidden="true" />
                {loading ? "Actualizando…" : "Aplicar filtros"}
              </button>
            </div>
          </form>
          {loading && (
            <p className="report-notice" role="status">
              Actualizando reporte…
            </p>
          )}
          {reportError && (
            <p className="report-notice report-notice--error" role="alert">
              {reportError}
              {result &&
                " Se conservan los resultados anteriores; el Excel corresponde a esos resultados."}
            </p>
          )}
          {exportError && (
            <p className="report-notice report-notice--error" role="alert">
              {exportError}
            </p>
          )}
          {summary && (
            <section aria-label="Resultados del reporte" aria-busy={loading}>
              <p className="report-range">
                Período mostrado: <strong>{summary.range}</strong>
              </p>
              <section className="admin-kpis">
                <article>
                  <span>Movimientos</span>
                  <strong>{summary.totals.movements}</strong>
                </article>
                <article>
                  <span>Cobros positivos</span>
                  <strong>{summary.totals.paid}</strong>
                </article>
                <article>
                  <span>Recaudación</span>
                  <strong
                    className={
                      summary.totals.revenue >= 1_000_000
                        ? "metric-value-long"
                        : undefined
                    }
                  >
                    {money.format(summary.totals.revenue)}
                  </strong>
                </article>
                <article>
                  <span>Deuda por evasiones</span>
                  <strong>{money.format(summary.totals.debt)}</strong>
                </article>
                <article>
                  <span>Salidas cubiertas por compras</span>
                  <strong>{summary.totals.free}</strong>
                </article>
                <article>
                  <span>Minutos efectivamente cobrados</span>
                  <strong>{summary.totals.billedMinutes}</strong>
                </article>
              </section>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      {[
                        "Patente",
                        "Estado",
                        "Entrada",
                        "Salida",
                        "Minutos calculados",
                        "Minutos cobrados",
                        "Pago",
                        "Descuento",
                        "Total cobrado",
                        "Deuda",
                      ].map((label) => (
                        <th key={label}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {summary.recent.length === 0 ? (
                      <tr>
                        <td colSpan={10}>
                          Sin movimientos para los filtros aplicados.
                        </td>
                      </tr>
                    ) : (
                      summary.recent.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <span className="table-plate">
                              {row.vehicleNumber}
                            </span>
                          </td>
                          <td>
                            {isNoPaymentRequired(row)
                              ? "Cubierto por compras"
                              : statusLabels[row.status]}
                          </td>
                          <td>{dateTime.format(new Date(row.entryTime))}</td>
                          <td>
                            {row.exitTime
                              ? dateTime.format(new Date(row.exitTime))
                              : "—"}
                          </td>
                          <td>{row.totalMinutes}</td>
                          <td>
                            {row.status === "completed"
                              ? (row.minutesCharged ?? "—")
                              : "—"}
                          </td>
                          <td>
                            {isNoPaymentRequired(row)
                              ? "No requerido"
                              : row.paymentMethod
                                ? paymentLabels[row.paymentMethod]
                                : "—"}
                          </td>
                          <td>{discountLabel(row)}</td>
                          <td>{money.format(row.amountPaid)}</td>
                          <td>{money.format(row.outstandingAmount)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="movement-cards report-movement-cards">
                {summary.recent.length === 0 ? (
                  <p className="movement-empty">
                    Sin movimientos para los filtros aplicados.
                  </p>
                ) : (
                  summary.recent.map((row) => (
                    <article className="movement-card" key={row.id}>
                      <div className="movement-card-heading">
                        <strong className="table-plate">
                          {row.vehicleNumber}
                        </strong>
                        <span
                          className={`movement-status movement-status--${row.status}`}
                        >
                          {isNoPaymentRequired(row)
                            ? "Cubierto por compras"
                            : statusLabels[row.status]}
                        </span>
                      </div>
                      <dl>
                        <div>
                          <dt>Entrada</dt>
                          <dd>{dateTime.format(new Date(row.entryTime))}</dd>
                        </div>
                        <div>
                          <dt>Salida</dt>
                          <dd>
                            {row.exitTime
                              ? dateTime.format(new Date(row.exitTime))
                              : "Dentro"}
                          </dd>
                        </div>
                        <div>
                          <dt>Duración</dt>
                          <dd>{row.totalMinutes} min</dd>
                        </div>
                        <div>
                          <dt>Minutos cobrados</dt>
                          <dd>
                            {row.status === "completed"
                              ? (row.minutesCharged ?? "—")
                              : "—"}
                          </dd>
                        </div>
                        <div>
                          <dt>Pago</dt>
                          <dd>
                            {isNoPaymentRequired(row)
                              ? "No requerido"
                              : row.paymentMethod
                                ? paymentLabels[row.paymentMethod]
                                : "—"}
                          </dd>
                        </div>
                        <div>
                          <dt>Descuento</dt>
                          <dd>{discountLabel(row)}</dd>
                        </div>
                      </dl>
                      <div className="movement-card-total">
                        <span>
                          {row.status === "evaded"
                            ? "Deuda"
                            : isNoPaymentRequired(row)
                              ? "Sin cobro"
                              : "Total cobrado"}
                        </span>
                        <strong>
                          {money.format(
                            row.status === "evaded"
                              ? row.outstandingAmount
                              : row.amountPaid,
                          )}
                        </strong>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
