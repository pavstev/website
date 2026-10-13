import { en } from "../i18n.ts";

const dateFormat = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});

export const formatPostDate = (iso: string): string =>
  dateFormat.format(new Date(`${iso}T00:00:00Z`));

export const minutesLabel = (minutes: number): string =>
  en.blog.minutesRead.replace("{n}", () => String(minutes));

export const postTitle = (title: string): string =>
  en.blog.postTitle.replace("{title}", () => title);
