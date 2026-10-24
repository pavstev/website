import { en } from "../i18n.ts";

export const minutesLabel = (minutes: number): string =>
  en.blog.minutesRead.replace("{n}", () => String(minutes));

export const brandTitle = (title: string): string =>
  en.meta.brandTitle.replace("{title}", () => title);
