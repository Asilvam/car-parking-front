import test from "node:test";
import assert from "node:assert/strict";
import { createOperationLock } from "../src/lib/operation-lock.ts";
import {
  reportQuery,
  validateReportFilters,
} from "../src/lib/report-filters.ts";

const base = {
  preset: "day",
  date: "2026-11-15",
  from: "2026-11-01",
  to: "2026-11-30",
  status: "all",
  paymentMethod: "all",
  vehicleNumber: "",
};
test("synchronous lock rejects duplicate acquisition and can be released after success or failure", () => {
  const lock = createOperationLock();
  assert.equal(lock.tryAcquire(), true);
  assert.equal(lock.pending, true);
  assert.equal(lock.tryAcquire(), false);
  lock.release();
  assert.equal(lock.pending, false);
  assert.equal(lock.tryAcquire(), true);
});
test("editing draft filters cannot change the query stored with displayed results or export", () => {
  const applied = { ...base };
  const displayedQuery = reportQuery(applied);
  const draft = { ...applied, vehicleNumber: "bc-df 12", status: "completed" };
  assert.notEqual(reportQuery(draft), displayedQuery);
  assert.equal(reportQuery(applied), displayedQuery);
  assert.equal(
    new URLSearchParams(reportQuery(draft)).get("vehicleNumber"),
    "BCDF12",
  );
});
test("only dates relevant to the selected period are sent", () => {
  const day = new URLSearchParams(reportQuery(base));
  assert.equal(day.has("from"), false);
  assert.equal(day.get("date"), base.date);
  const range = new URLSearchParams(reportQuery({ ...base, preset: "range" }));
  assert.equal(range.has("date"), false);
  assert.equal(range.get("from"), base.from);
  assert.equal(range.get("to"), base.to);
});
test("invalid, impossible and reversed date ranges are rejected", () => {
  assert.ok(
    validateReportFilters({
      ...base,
      preset: "range",
      from: "2026-11-30",
      to: "2026-11-01",
    }),
  );
  assert.ok(validateReportFilters({ ...base, date: "2026-02-30" }));
  assert.ok(validateReportFilters({ ...base, date: "2026-99-99" }));
  assert.equal(validateReportFilters(base), null);
  assert.equal(validateReportFilters({ ...base, preset: "range" }), null);
});
