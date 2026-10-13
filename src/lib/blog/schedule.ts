const timeZone = "Europe/Vienna";

const dayFormat = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone,
  year: "numeric",
});

export const viennaDay = (now: Date = new Date()): string => {
  const parts = new Map(
    dayFormat.formatToParts(now).map((part) => [part.type, part.value])
  );
  return `${parts.get("year") ?? ""}-${parts.get("month") ?? ""}-${parts.get("day") ?? ""}`;
};

export const isScheduled = (date: string, now: Date = new Date()): boolean =>
  date > viennaDay(now);
