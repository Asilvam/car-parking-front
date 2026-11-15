import { money } from "../lib/format";

export default function RateDisplay({
  ratePerMinute,
}: {
  ratePerMinute: number | null;
}) {
  return (
    <div
      className="rate-display"
      aria-label={
        ratePerMinute === null
          ? "Tarifa no disponible"
          : `${money.format(ratePerMinute)} por minuto`
      }
    >
      <strong>
        {ratePerMinute === null ? "—" : money.format(ratePerMinute)}
      </strong>
      <small>/min</small>
    </div>
  );
}
