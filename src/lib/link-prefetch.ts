import { prefersLightLoad } from "./save-data.ts";

const hoverDelayMs = 80;
const fileSuffix = /\.[a-z0-9]+$/i;

export const prefetchUrl = (href: string, current: string): null | string => {
  let target: URL;
  let here: URL;
  try {
    target = new URL(href, current);
    here = new URL(current);
  } catch {
    return null;
  }
  if (target.origin !== here.origin) return null;
  if (target.pathname === here.pathname && target.search === here.search)
    return null;
  return fileSuffix.test(target.pathname)
    ? null
    : `${target.origin}${target.pathname}${target.search}`;
};

const anchorOf = (event: Event): HTMLAnchorElement | null => {
  const { target } = event;
  if (!(target instanceof Element)) return null;
  const anchor = target.closest("a");
  if (
    !anchor ||
    anchor.dataset["astroPrefetch"] === "false" ||
    anchor.hasAttribute("download")
  )
    return null;
  return anchor.target && anchor.target !== "_self" ? null : anchor;
};

const warm = async (url: string): Promise<void> => {
  try {
    await fetch(url, { priority: "low" });
  } catch {}
};

export const startLinkPrefetch = (): void => {
  const seen = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const fetchPage = (event: Event): void => {
    const anchor = anchorOf(event);
    if (!anchor || prefersLightLoad() || !navigator.onLine) return;
    const url = prefetchUrl(anchor.href, location.href);
    if (!url || seen.has(url)) return;
    seen.add(url);
    void warm(url);
  };

  const hoverIn = (event: Event): void => {
    globalThis.clearTimeout(timer);
    timer = globalThis.setTimeout(() => fetchPage(event), hoverDelayMs);
  };

  const hoverOut = (): void => globalThis.clearTimeout(timer);

  document.addEventListener("mouseover", hoverIn, { passive: true });
  document.addEventListener("mouseout", hoverOut, { passive: true });
  document.addEventListener("focusin", fetchPage, { passive: true });
  document.addEventListener("touchstart", fetchPage, { passive: true });
  document.addEventListener("mousedown", fetchPage, { passive: true });
};
