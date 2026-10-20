import { en } from "./i18n.ts";

export interface NavItem {
  label: string;
  path: string;
}

export const navItems: NavItem[] = [
  { label: en.nav.about, path: "/about" },
  { label: en.nav.work, path: "/work" },
  { label: en.nav.blog, path: "/blog" },
];

export const navFor = (blogLive: boolean): NavItem[] =>
  blogLive ? navItems : navItems.filter((item) => item.path !== "/blog");

const clean = (pathname: string): string => {
  const trimmed = pathname.replace(/\.html$/u, "").replace(/\/+$/u, "");
  return trimmed === "" ? "/" : trimmed;
};

export const navCurrent = (
  pathname: string,
  path: string
): "page" | "true" | undefined => {
  const here = clean(pathname);
  if (here === path) return "page";
  return here.startsWith(`${path}/`) ? "true" : undefined;
};

export const navOthers = (pathname: string, blogLive: boolean): NavItem[] =>
  navFor(blogLive).filter(
    (item) => navCurrent(pathname, item.path) === undefined
  );
