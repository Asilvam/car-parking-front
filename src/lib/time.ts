export function elapsedMinutes(entryTime: string, now: number) {
  return Math.max(
    1,
    Math.ceil((now - new Date(entryTime).getTime()) / 60_000),
  );
}

export function parseTimeToMinutes(value?: string): number | null {
  if (!value) return null;
  const matched = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!matched) return null;
  return Number(matched[1]) * 60 + Number(matched[2]);
}

export function getChileLocalMinutes(nowValue: number): number {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Santiago",
  });
  const parts = formatter.formatToParts(new Date(nowValue));
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Number(map.hour) * 60 + Number(map.minute);
}
