import type { PaymentFilter, Preset, StatusFilter } from "./types";

export type ReportFilters = {
  preset: Preset;
  date: string;
  from: string;
  to: string;
  status: StatusFilter;
  paymentMethod: PaymentFilter;
  vehicleNumber: string;
};

export function reportQuery(filters: ReportFilters): string {
  const { preset, date, from, to, status, paymentMethod, vehicleNumber } =
    filters;
  return new URLSearchParams({
    preset,
    ...(preset === "range" ? { from, to } : { date }),
    status,
    paymentMethod,
    vehicleNumber: vehicleNumber.toUpperCase().replace(/[^A-Z0-9]/g, ""),
  }).toString();
}

export function validateReportFilters(filters: ReportFilters): string | null {
  const isDate = (value: string) => {
    const parsed = new Date(`${value}T12:00:00Z`);
    return (
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  };
  if (filters.preset === "range") {
    if (!isDate(filters.from) || !isDate(filters.to))
      return "Selecciona fechas válidas para el rango.";
    if (filters.from > filters.to)
      return "La fecha inicial debe ser anterior o igual a la final.";
  } else if (!isDate(filters.date)) return "Selecciona una fecha válida.";
  return null;
}
