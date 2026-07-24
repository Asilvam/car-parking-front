import { Preset } from "../../lib/types";

export default function PresetFields({
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
