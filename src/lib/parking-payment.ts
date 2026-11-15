/** Includes legacy completed zero tickets that were stored as paid. */
export function isNoPaymentRequired(record: {
  status: string;
  amountPaid?: number;
  totalCost?: number;
  noPaymentRequired?: boolean;
}): boolean {
  return (
    record.status === "completed" &&
    (record.noPaymentRequired === true ||
      (record.amountPaid ?? record.totalCost) === 0)
  );
}
