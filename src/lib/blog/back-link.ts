import { en } from "../i18n.ts";

export interface BackLink {
  href: string;
  label: string;
  prefetch: false | null;
}

export const backLink = (pathname: string): BackLink =>
  pathname.replace(/\/+$/, "") === "/blog"
    ? { href: "/", label: en.blog.home, prefetch: false }
    : { href: "/blog", label: en.blog.back, prefetch: null };
