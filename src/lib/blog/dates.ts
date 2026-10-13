import { en } from "../i18n.ts";

export const viennaZone = "Europe/Vienna";
const relativeWindowMs = 7 * 86_400_000;

const minuteMs = 60_000;
const hourMs = 60 * minuteMs;
const locale = "en";
const zoneLocales = ["en-GB", "en-US"] as const;
const gmtPattern = /^(?:GMT|UTC)(?:[+-]|$)/u;

const formatters = new Map<string, Intl.DateTimeFormat>();

const formatter = (
  key: string,
  build: () => Intl.DateTimeFormat
): Intl.DateTimeFormat => {
  const known = formatters.get(key);
  if (known !== undefined) return known;
  const made = build();
  formatters.set(key, made);
  return made;
};

const partsOf = (
  format: Intl.DateTimeFormat,
  instant: Date
): Map<Intl.DateTimeFormatPartTypes, string> =>
  new Map(format.formatToParts(instant).map((part) => [part.type, part.value]));

const dayParts = (
  instant: Date,
  timeZone: string
): Map<Intl.DateTimeFormatPartTypes, string> =>
  partsOf(
    formatter(
      `day:${timeZone}`,
      () =>
        new Intl.DateTimeFormat(locale, {
          day: "numeric",
          month: "short",
          timeZone,
          year: "numeric",
        })
    ),
    instant
  );

export const shortDate = (iso: string, timeZone: string): string => {
  const parts = dayParts(new Date(iso), timeZone);
  return `${parts.get("day") ?? ""} ${parts.get("month") ?? ""} ${parts.get("year") ?? ""}`;
};

export const viennaDate = (iso: string): string => shortDate(iso, viennaZone);

const clock = (instant: Date, timeZone: string): string => {
  const parts = partsOf(
    formatter(
      `clock:${timeZone}`,
      () =>
        new Intl.DateTimeFormat(locale, {
          hour: "2-digit",
          hourCycle: "h23",
          minute: "2-digit",
          timeZone,
        })
    ),
    instant
  );
  return `${parts.get("hour") ?? ""}:${parts.get("minute") ?? ""}`;
};

export const zoneName = (instant: Date, timeZone: string): string => {
  let fallback = "";
  for (const zoneLocale of zoneLocales) {
    const name =
      partsOf(
        formatter(
          `zone:${zoneLocale}:${timeZone}`,
          () =>
            new Intl.DateTimeFormat(zoneLocale, {
              timeZone,
              timeZoneName: "short",
            })
        ),
        instant
      ).get("timeZoneName") ?? "";
    if (!gmtPattern.test(name)) return name;
    if (fallback === "") fallback = name;
  }
  return fallback;
};

export const fullDateTime = (iso: string, timeZone: string): string => {
  const instant = new Date(iso);
  const parts = partsOf(
    formatter(
      `full:${timeZone}`,
      () =>
        new Intl.DateTimeFormat(locale, {
          day: "numeric",
          month: "long",
          timeZone,
          weekday: "long",
          year: "numeric",
        })
    ),
    instant
  );
  return `${parts.get("weekday") ?? ""}, ${parts.get("day") ?? ""} ${parts.get("month") ?? ""} ${parts.get("year") ?? ""}, ${clock(instant, timeZone)} ${zoneName(instant, timeZone)}`;
};

export const viennaClock = (iso: string): string =>
  clock(new Date(iso), viennaZone);

const calendarDay = (instant: Date, timeZone: string): number => {
  const parts = partsOf(
    formatter(
      `numeric:${timeZone}`,
      () =>
        new Intl.DateTimeFormat(locale, {
          day: "numeric",
          month: "numeric",
          timeZone,
          year: "numeric",
        })
    ),
    instant
  );
  return Date.UTC(
    Number(parts.get("year")),
    Number(parts.get("month")) - 1,
    Number(parts.get("day"))
  );
};

export interface RelativeBucket {
  unit: "day" | "hour" | "minute" | "now";
  value: number;
}

export const relativeBucket = (
  iso: string,
  now: Date,
  timeZone: string
): RelativeBucket | undefined => {
  const then = new Date(iso);
  const diff = then.getTime() - now.getTime();
  const size = Math.abs(diff);
  if (size >= relativeWindowMs) return undefined;
  if (size < minuteMs) return { unit: "now", value: 0 };
  const sign = diff < 0 ? -1 : 1;
  if (size < hourMs) {
    return { unit: "minute", value: sign * Math.floor(size / minuteMs) };
  }
  if (size < 24 * hourMs) {
    return { unit: "hour", value: sign * Math.floor(size / hourMs) };
  }
  const days = Math.round(
    (calendarDay(then, timeZone) - calendarDay(now, timeZone)) / 86_400_000
  );
  return { unit: "day", value: days === 0 ? sign : days };
};

const relativeFormat = new Intl.RelativeTimeFormat(locale, {
  numeric: "auto",
});

export const relativeLabel = (
  iso: string,
  now: Date,
  timeZone: string
): string | undefined => {
  const bucket = relativeBucket(iso, now, timeZone);
  if (bucket === undefined) return undefined;
  return bucket.unit === "now"
    ? en.blog.justNow
    : relativeFormat.format(bucket.value, bucket.unit);
};

export const dateLabel = (iso: string, now: Date, timeZone: string): string =>
  relativeLabel(iso, now, timeZone) ?? shortDate(iso, timeZone);
