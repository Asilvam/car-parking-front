import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3500";
const ADMIN_TOKEN_KEY = "parking_admin_session";

type Preset = "day" | "week" | "month" | "range";
type StatusFilter = "all" | "active" | "completed" | "evaded";
type PaymentFilter = "all" | "cash" | "debit" | "credit" | "transfer";

type SummaryResponse = {
  range: string;
  filters: {
    preset: Preset;
    date: string;
    from: string;
    to: string;
    status: StatusFilter;
    paymentMethod: PaymentFilter;
    vehicleNumber: string;
  };
  totals: {
    movements: number;
    active: number;
    completed: number;
    evaded: number;
    revenue: number;
    debt: number;
  };
  paymentTotals: {
    cash: number;
    debit: number;
    credit: number;
    transfer: number;
  };
  recent: Array<{
    id: string;
    vehicleNumber: string;
    status: "active" | "completed" | "evaded";
    entryTime: string;
    exitTime?: string;
    totalMinutes: number;
    amountPaid: number;
    outstandingAmount: number;
    paymentMethod?: "cash" | "debit" | "credit" | "transfer";
  }>;
};

const money = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const dateTime = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "short",
  timeStyle: "short",
  hour12: false,
  timeZone: "America/Santiago",
});

const todayIso = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "America/Santiago",
}).format(new Date());

function getToken() {
  return window.localStorage.getItem(ADMIN_TOKEN_KEY);
}

function saveToken(token: string) {
  window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

function clearToken() {
  window.localStorage.removeItem(ADMIN_TOKEN_KEY);
}

function buildQuery(params: Record<string, string>) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      query.set(key, value);
    }
  });

  return query.toString();
}

async function adminApi<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-admin-session": token,
      ...init?.headers,
    },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message ?? "No se pudo completar la operación");
  }

  return body as T;
}

function PresetFields({
  preset,
  date,
  from,
  to,
  onDateChange,
  onFromChange,
  onToChange,
}: {
  preset: Preset;
  date: string;
  from: string;
  to: string;
  onDateChange: (value: string) => void;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}) {
  if (preset === "range") {
    return (
      <>
        <label>
          Desde
          <input
            type="date"
            value={from}
            onChange={(event) => onFromChange(event.target.value)}
          />
        </label>
        <label>
          Hasta
          <input
            type="date"
            value={to}
            onChange={(event) => onToChange(event.target.value)}
          />
        </label>
      </>
    );
  }

  return (
    <label>
      Fecha base
      <input
        type="date"
        value={date}
        onChange={(event) => onDateChange(event.target.value)}
      />
    </label>
  );
}

export default function AdminApp() {
  const [token, setToken] = useState<string | null>(() => getToken());
  const [password, setPassword] = useState("");
  const [busyLogin, setBusyLogin] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [preset, setPreset] = useState<Preset>("day");
  const [date, setDate] = useState(todayIso);
  const [from, setFrom] = useState(todayIso);
  const [to, setTo] = useState(todayIso);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [paymentMethod, setPaymentMethod] = useState<PaymentFilter>("all");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);

  const queryString = useMemo(
    () =>
      buildQuery({
        preset,
        date,
        from,
        to,
        status,
        paymentMethod,
        vehicleNumber: vehicleNumber.toUpperCase().replace(/[^A-Z0-9]/g, ""),
      }),
    [preset, date, from, to, status, paymentMethod, vehicleNumber],
  );

  const loadSummary = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setNotice(null);

    try {
      const data = await adminApi<SummaryResponse>(
        `/admin/reports/parking-summary?${queryString}`,
        token,
      );
      setSummary(data);
    } catch (error) {
      const message = (error as Error).message;
      if (message.toLowerCase().includes("sesión")) {
        clearToken();
        setToken(null);
      }
      setNotice(message);
    } finally {
      setLoading(false);
    }
  }, [token, queryString]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setBusyLogin(true);
    setNotice(null);

    try {
      const response = await fetch(`${API_URL}/admin/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.message ?? "No se pudo iniciar sesión");
      }

      saveToken(body.token);
      setToken(body.token);
      setPassword("");
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setBusyLogin(false);
    }
  };

  const logout = async () => {
    if (token) {
      await adminApi<{ ok: true }>("/admin/auth/logout", token, {
        method: "POST",
      }).catch(() => undefined);
    }

    clearToken();
    setToken(null);
    setSummary(null);
    setNotice(null);
  };

  const exportExcel = async () => {
    if (!token) return;

    setNotice(null);
    try {
      const response = await fetch(
        `${API_URL}/admin/reports/parking.xlsx?${queryString}`,
        {
          headers: {
            "x-admin-session": token,
          },
        },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message ?? "No se pudo exportar el reporte");
      }

      const blob = await response.blob();
      const link = document.createElement("a");
      const url = window.URL.createObjectURL(blob);
      link.href = url;
      link.download = `reporte-parking-${new Date()
        .toISOString()
        .replace(/[:]/g, "-")
        .slice(0, 16)}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setNotice((error as Error).message);
    }
  };

  if (!token) {
    return (
      <main className="admin-shell">
        <header className="topbar admin-topbar">
          <a className="brand-lockup brand-admin-link" href="/">
            <span className="brand-mark" aria-hidden="true">
              M
            </span>
            <div>
              <p className="eyebrow">Modo administrador</p>
              <h1>Minuto</h1>
            </div>
          </a>
          <a className="admin-back-link" href="/">
            Volver
          </a>
        </header>

        <section className="admin-login">
          <h1>Acceso administrador</h1>
          <form onSubmit={login}>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button type="submit" disabled={busyLogin}>
              {busyLogin ? "Validando..." : "Entrar"}
            </button>
          </form>
          {notice && <div className="admin-notice">{notice}</div>}
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="topbar admin-topbar">
        <a className="brand-lockup brand-admin-link" href="/">
          <span className="brand-mark" aria-hidden="true">
            M
          </span>
          <div>
            <p className="eyebrow">Modo administrador</p>
            <h1>Minuto</h1>
          </div>
        </a>
        <a className="admin-back-link" href="/">
          Volver
        </a>
      </header>

      <header className="admin-header">
        <div>
          <p className="admin-overline">Panel administrativo</p>
          <h1>Reportes y exportación</h1>
          <p className="admin-subtle">Semana calculada como Lunes-Domingo.</p>
        </div>
        <button className="admin-logout" onClick={logout}>
          Cerrar sesión
        </button>
      </header>

      <section className="admin-filters">
        <label>
          Filtro rápido
          <select
            value={preset}
            onChange={(event) => setPreset(event.target.value as Preset)}
          >
            <option value="day">Día</option>
            <option value="week">Semana</option>
            <option value="month">Mes</option>
            <option value="range">Rango</option>
          </select>
        </label>

        <PresetFields
          preset={preset}
          date={date}
          from={from}
          to={to}
          onDateChange={setDate}
          onFromChange={setFrom}
          onToChange={setTo}
        />

        <label>
          Estado
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as StatusFilter)}
          >
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="completed">Completados</option>
            <option value="evaded">Evadidos</option>
          </select>
        </label>

        <label>
          Pago
          <select
            value={paymentMethod}
            onChange={(event) =>
              setPaymentMethod(event.target.value as PaymentFilter)
            }
          >
            <option value="all">Todos</option>
            <option value="cash">Efectivo</option>
            <option value="debit">Débito</option>
            <option value="credit">Crédito</option>
            <option value="transfer">Transferencia</option>
          </select>
        </label>

        <label>
          Patente
          <input
            value={vehicleNumber}
            onChange={(event) => setVehicleNumber(event.target.value)}
            placeholder="ABCD12"
          />
        </label>

        <div className="admin-actions">
          <button onClick={() => void loadSummary()} disabled={loading}>
            {loading ? "Actualizando..." : "Aplicar filtros"}
          </button>
          <button className="admin-export" onClick={exportExcel}>
            Exportar Excel
          </button>
        </div>
      </section>

      {notice && <div className="admin-notice">{notice}</div>}

      {summary && (
        <>
          <section className="admin-kpis">
            <article>
              <span>Rango</span>
              <strong>{summary.range}</strong>
            </article>
            <article>
              <span>Movimientos</span>
              <strong>{summary.totals.movements}</strong>
            </article>
            <article>
              <span>Recaudación</span>
              <strong>{money.format(summary.totals.revenue)}</strong>
            </article>
            <article>
              <span>Deuda evasiones</span>
              <strong>{money.format(summary.totals.debt)}</strong>
            </article>
          </section>

          <section className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Patente</th>
                  <th>Estado</th>
                  <th>Entrada</th>
                  <th>Salida</th>
                  <th>Min</th>
                  <th>Pago</th>
                  <th>Total</th>
                  <th>Deuda</th>
                </tr>
              </thead>
              <tbody>
                {summary.recent.length === 0 ? (
                  <tr>
                    <td colSpan={8}>Sin movimientos para el filtro seleccionado.</td>
                  </tr>
                ) : (
                  summary.recent.map((row) => (
                    <tr key={row.id}>
                      <td>{row.vehicleNumber}</td>
                      <td>{row.status}</td>
                      <td>{dateTime.format(new Date(row.entryTime))}</td>
                      <td>
                        {row.exitTime
                          ? dateTime.format(new Date(row.exitTime))
                          : "-"}
                      </td>
                      <td>{row.totalMinutes}</td>
                      <td>{row.paymentMethod ?? "-"}</td>
                      <td>{money.format(row.amountPaid)}</td>
                      <td>{money.format(row.outstandingAmount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        </>
      )}
    </main>
  );
}
