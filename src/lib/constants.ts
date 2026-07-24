import { EvasionReasonCode, PaymentMethod } from "./types";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3500";

export const paymentLabels: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  debit: "Débito",
  credit: "Crédito",
  transfer: "Transferencia",
};

export const evasionReasonLabels: Record<EvasionReasonCode, string> = {
  "left-without-payment": "Se retiró sin pagar",
  "payment-refused": "Rechazó el pago",
  "operator-record-correction": "Corrección del registro",
  unknown: "Motivo desconocido",
  other: "Otro motivo",
};

export const evasionReasonCodes = Object.keys(
  evasionReasonLabels,
) as EvasionReasonCode[];

export const ADMIN_TOKEN_KEY = "parking_admin_session";
