const timeZone = "Europe/Vienna";
const minuteMs = 60_000;
const offsetPattern = /^GMT([+-])(\d{2}):(\d{2})$/u;
const dayPattern = /^(\d{4})-(\d{2})-(\d{2})$/u;

const offsetFormat = new Intl.DateTimeFormat("en", {
  timeZone,
  timeZoneName: "longOffset",
});

const offsetMinutes = (instant: Date): number => {
  const name = offsetFormat
    .formatToParts(instant)
    .find((part) => part.type === "timeZoneName")?.value;
  const match = offsetPattern.exec(name ?? "");
  if (match === null)
    throw new Error(`No Vienna offset for ${String(instant)}`);
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
};

const offsetText = (minutes: number): string => {
  const sign = minutes < 0 ? "-" : "+";
  const hours = String(Math.trunc(Math.abs(minutes) / 60)).padStart(2, "0");
  const rest = String(Math.abs(minutes) % 60).padStart(2, "0");
  return `${sign}${hours}:${rest}`;
};

const midnight = (day: string): { instant: Date; offset: number } => {
  const match = dayPattern.exec(day);
  if (match === null) throw new Error(`"${day}" is not a YYYY-MM-DD date`);
  const wall = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  );
  const found = [120, 60]
    .map((offset) => ({ instant: new Date(wall - offset * minuteMs), offset }))
    .find((candidate) => offsetMinutes(candidate.instant) === candidate.offset);
  if (found === undefined) throw new Error(`No Vienna midnight for ${day}`);
  return found;
};

export const goLiveAt = (day: string): Date => midnight(day).instant;

export const viennaMidnightIso = (day: string): string =>
  `${day}T00:00:00${offsetText(midnight(day).offset)}`;

export const isScheduled = (date: string, now: Date = new Date()): boolean =>
  goLiveAt(date).getTime() > now.getTime();
