import { ParkingRecord } from "./types";

export const money = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

export const clock = new Intl.DateTimeFormat("es-CL", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Santiago",
});

export const shortDate = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Santiago",
});

export const dateTime = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "short",
  timeStyle: "short",
  hour12: false,
  timeZone: "America/Santiago",
});

export const todayIso = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "America/Santiago",
}).format(new Date());

export function chileDayMonth(dateValue: number): string {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Santiago",
  });
  const parts = formatter.formatToParts(new Date(dateValue));
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.day}-${map.month}`;
}

export function durationLabel(minutes: number) {
  return `${Math.max(0, Math.trunc(minutes))} min`;
}

export function movementTotal(record: ParkingRecord) {
  if (record.status === "evaded") {
    return record.outstandingAmount ?? record.totalCost ?? 0;
  }

  return record.totalCost ?? record.amountPaid ?? 0;
}
