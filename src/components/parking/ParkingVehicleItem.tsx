import { CreditCard, TriangleAlert } from "lucide-react";
import { clock, durationLabel, money } from "../../lib/format";
import { elapsedMinutes } from "../../lib/time";
import type { ParkingRecord } from "../../lib/types";

type Props = {
  record: ParkingRecord;
  now: number;
  fallbackRate: number;
  disabled: boolean;
  onCharge: (record: ParkingRecord) => void;
  onEvasion: (record: ParkingRecord) => void;
};

export default function ParkingVehicleItem({
  record,
  now,
  fallbackRate,
  disabled,
  onCharge,
  onEvasion,
}: Props) {
  const minutes = elapsedMinutes(record.entryTime, now);
  return (
    <div className="vehicle-card">
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
            {money.format(minutes * (record.ratePerMinute || fallbackRate))}
          </strong>
        </div>
        <div className="vehicle-actions">
          <button
            className="charge-button"
            type="button"
            disabled={disabled}
            onClick={() => onCharge(record)}
            aria-label={`Cobrar salida de ${record.vehicleNumber}`}
          >
            <CreditCard size={18} aria-hidden="true" />
            <span>Cobrar</span>
          </button>
          <button
            className="evasion-button"
            type="button"
            disabled={disabled}
            onClick={() => onEvasion(record)}
            aria-label={`Marcar evasión de ${record.vehicleNumber}`}
          >
            <TriangleAlert size={16} aria-hidden="true" />
            <span>Evasión</span>
          </button>
        </div>
      </div>
    </div>
  );
}
