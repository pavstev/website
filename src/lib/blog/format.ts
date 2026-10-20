import { en } from "../i18n.ts";

export const minutesLabel = (minutes: number): string =>
  en.blog.minutesRead.replace("{n}", () => String(minutes));

export const postTitle = (title: string): string =>
  en.blog.postTitle.replace("{title}", () => title);
