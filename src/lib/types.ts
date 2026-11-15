export type PaymentMethod = "cash" | "debit" | "credit" | "transfer";

export type EvasionReasonCode =
  | "left-without-payment"
  | "payment-refused"
  | "operator-record-correction"
  | "unknown"
  | "other";

export type DialogMode = "charge" | "evasion";

export type ParkingRecord = {
  _id: string;
  locationId?: string;
  locationCode?: string;
  vehicleNumber: string;
  entryTime: string;
  exitTime?: string;
  closedAt?: string;
  paidAt?: string;
  totalMinutes?: number;
  totalCost?: number;
  ratePerMinute: number;
  status: "active" | "completed" | "evaded";
  paymentStatus?: "pending" | "paid" | "not_required" | "evaded";
  exitType?: "paid" | "purchase-discount" | "evasion";
  paymentMethod?: PaymentMethod;
  amountPaid?: number;
  outstandingAmount?: number;
  purchaseDiscountApplied?: boolean;
  discountMinutesApplied?: number;
  minutesCharged?: number;
  evasionReasonCode?: EvasionReasonCode;
  evasionObservation?: string;
};

export type ParkingLocation = {
  id: string;
  code: string;
  name: string;
  address?: string;
  timezone: string;
  currency: string;
  ratePerMinute: number;
};

export type ParkingConfig = {
  locationId: string;
  locationCode: string;
  ratePerMinute: number;
  currency: string;
  openTime?: string;
  closeTime?: string;
  autoEvasionTime?: string;
  purchaseDiscountMinutes?: number;
};

export type Summary = {
  activeVehicles: number;
  completedVehicles: number;
  paidVehicles: number;
  freeVehicles: number;
  stayMinutes: number;
  revenue: number;
  billedMinutes: number;
  evadedVehicles: number;
  evadedAmount: number;
  ratePerMinute: number;
};

export const emptySummary: Summary = {
  activeVehicles: 0,
  completedVehicles: 0,
  paidVehicles: 0,
  freeVehicles: 0,
  stayMinutes: 0,
  revenue: 0,
  billedMinutes: 0,
  evadedVehicles: 0,
  evadedAmount: 0,
  ratePerMinute: 0,
};

export type Preset = "day" | "week" | "month" | "range";
export type StatusFilter = "all" | "active" | "completed" | "evaded";
export type PaymentFilter = "all" | PaymentMethod;

export type SummaryResponse = {
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
    paid: number;
    free: number;
    billedMinutes: number;
    stayMinutes: number;
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
    paymentMethod?: PaymentMethod;
    noPaymentRequired?: boolean;
    paymentStatus?: string;
    purchaseDiscountApplied?: boolean;
    discountMinutesApplied?: number;
    minutesCharged?: number;
  }>;
};

export type ParkingQuote = {
  quoteToken: string;
  parkingId: string;
  locationId: string;
  quotedAt: string;
  serverTime: string;
  expiresAt: string;
  totalMinutes: number;
  ratePerMinute: number;
  purchaseDiscountMinutes: number;
};
