import fs from "node:fs";
import path from "node:path";

import type { Check, Level, Page } from "./types.ts";

import { newResult, note, openPage, pageSlug, pool, settle } from "./lib.ts";

type Dim = [number, number, number];

const homeSizes: Dim[] = [
  [320, 568, 1],
  [360, 740, 1],
  [375, 667, 1],
  [390, 844, 1],
  [414, 896, 1],
  [430, 932, 1],
  [844, 390, 1],
  [932, 430, 1],
  [768, 1024, 1],
  [820, 1180, 1],
  [1024, 768, 1],
  [1024, 720, 0],
  [1280, 720, 0],
  [1366, 768, 0],
  [1440, 900, 0],
  [1920, 1080, 0],
  [2560, 1440, 0],
  [160, 320, 1],
  [195, 422, 1],
  [640, 360, 0],
  [720, 450, 0],
];
const otherSizes: Dim[] = [
  [320, 568, 1],
  [390, 844, 1],
  [195, 422, 1],
  [768, 1024, 1],
  [1280, 720, 0],
  [1440, 900, 0],
];
const spacingSizes: Dim[] = [
  [390, 844, 1],
  [320, 568, 1],
  [1024, 720, 0],
  [1280, 720, 0],
  [1440, 900, 0],
];
const spacingCss =
  "*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}";

interface Box {
  control: boolean;
  deco: boolean;
  el: HTMLElement;
  r: DOMRect;
}

interface Findings {
  clipped: string[];
  covered: string[];
  offscreen: string[];
  overflowX: number;
  overlaps: string[];
  small: string[];
  tiny: string[];
  truncated: string[];
  unreachable: string[];
}

interface MeasureInput {
  H: number;
  touch: boolean;
  W: number;
}

const measure = ({ H, touch, W }: MeasureInput): Findings => {
  const nameLimit = 26;
  const visibleCache = new Map<HTMLElement, boolean>();
  const isVisible = (el: HTMLElement): boolean => {
    const cached = visibleCache.get(el);
    if (cached !== undefined) return cached;
    let ok = true;
    for (
      let node: HTMLElement | null = el;
      node && ok;
      node = node.parentElement
    ) {
      if (
        node.hidden ||
        node.inert ||
        (node.matches("[popover]") && !node.matches(":popover-open")) ||
        (node instanceof HTMLDialogElement && !node.open)
      )
        ok = false;
    }
    if (ok) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility !== "visible")
        ok = false;
      let opacity = 1;
      for (
        let node: HTMLElement | null = el;
        node && ok;
        node = node.parentElement
      )
        opacity *= Number(getComputedStyle(node).opacity);
      if (opacity < 0.05) ok = false;
    }
    visibleCache.set(el, ok);
    return ok;
  };
  const readerCache = new Map<HTMLElement, boolean>();
  const readerOnly = (el: HTMLElement): boolean => {
    const cached = readerCache.get(el);
    if (cached !== undefined) return cached;
    let only = false;
    for (
      let node: HTMLElement | null = el;
      node && !only;
      node = node.parentElement
    ) {
      const style = getComputedStyle(node);
      const legacyClip = style.getPropertyValue("clip");
      if (
        ((legacyClip !== "" && legacyClip !== "auto") ||
          style.clipPath.startsWith("inset(50%")) &&
        node.getBoundingClientRect().width <= 2
      )
        only = true;
    }
    readerCache.set(el, only);
    return only;
  };
  const nameOf = (el: Element): string => {
    const text = (el.getAttribute("aria-label") ?? el.textContent ?? "")
      .trim()
      .replaceAll(/\s+/gu, " ")
      .slice(0, nameLimit);
    const first =
      typeof el.className === "string"
        ? el.className.trim().split(/\s+/u, 1)[0]
        : "";
    return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${first ? `.${first}` : ""}${text ? ` "${text}"` : ""}`;
  };
  const html = document.documentElement;
  const noScroll = [html, document.body].some((el) =>
    ["clip", "hidden"].includes(getComputedStyle(el).overflowY)
  );
  const found: Findings = {
    clipped: [],
    covered: [],
    offscreen: [],
    overflowX: Math.max(html.scrollWidth, document.body.scrollWidth) - W,
    overlaps: [],
    small: [],
    tiny: [],
    truncated: [],
    unreachable: [],
  };
  const lines: Box[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let current = walker.nextNode(); current; current = walker.nextNode()) {
    if (!current.textContent?.trim()) continue;
    const el = current.parentElement;
    if (
      !el ||
      el.closest("script,style,noscript,template,svg") ||
      !isVisible(el) ||
      readerOnly(el)
    )
      continue;
    range.selectNodeContents(current);
    for (const r of range.getClientRects())
      if (r.width >= 1 && r.height >= 1)
        lines.push({
          control: false,
          deco: Boolean(el.closest('[aria-hidden="true"]')),
          el,
          r,
        });
  }
  const clipBox = (
    el: HTMLElement
  ): { bottom: number; left: number; right: number; top: number } => {
    const bounds = el.getBoundingClientRect();
    const left = bounds.left + el.clientLeft;
    const top = bounds.top + el.clientTop;
    return {
      bottom: top + el.clientHeight,
      left,
      right: left + el.clientWidth,
      top,
    };
  };
  const stops = new Set<HTMLElement | null>([document.body, html]);
  const inspect = (
    el: HTMLElement,
    r: DOMRect
  ): { clippedBy: HTMLElement | null; scroller: boolean } => {
    let node: HTMLElement | null = el;
    while (node !== null && !stops.has(node)) {
      const style = getComputedStyle(node);
      if (
        ["auto", "scroll"].includes(style.overflowX) ||
        ["auto", "scroll"].includes(style.overflowY)
      )
        return { clippedBy: null, scroller: true };
      const clipX = ["clip", "hidden"].includes(style.overflowX);
      const clipY = ["clip", "hidden"].includes(style.overflowY);
      const bounds = clipBox(node);
      if (
        (clipX && (r.right > bounds.right + 1 || r.left < bounds.left - 1)) ||
        (clipY && (r.bottom > bounds.bottom + 1 || r.top < bounds.top - 1))
      )
        return { clippedBy: node, scroller: false };
      node = node.parentElement;
    }
    return { clippedBy: null, scroller: false };
  };
  for (const { el, r } of lines) {
    const { clippedBy, scroller } = inspect(el, r);
    if (clippedBy) {
      const style = getComputedStyle(clippedBy);
      const bucket =
        style.textOverflow === "ellipsis" || style.webkitLineClamp !== "none"
          ? found.truncated
          : found.clipped;
      bucket.push(`${nameOf(el)} cut by ${nameOf(clippedBy)}`);
      continue;
    }
    if (scroller) continue;
    if (r.right > W + 1 || r.left < -1)
      found.offscreen.push(
        `${nameOf(el)} x ${String(Math.round(r.left))}..${String(Math.round(r.right))}`
      );
    if (noScroll && (r.bottom > H + 1 || r.top < -1))
      found.unreachable.push(
        `${nameOf(el)} y ${String(Math.round(r.top))}..${String(Math.round(r.bottom))}`
      );
  }
  const controls = [
    ...document.querySelectorAll<HTMLElement>(
      'a[href], button, [role="button"], summary, input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])'
    ),
  ].filter((el) => isVisible(el) && !readerOnly(el));
  const boxes: Box[] = [
    ...lines.filter((line) => !line.deco),
    ...controls.flatMap((el) =>
      [...el.getClientRects()]
        .filter((r) => r.width >= 1 && r.height >= 1)
        .map((r) => ({ control: true, deco: false, el, r }))
    ),
  ];
  const pairs = new Set<string>();
  for (const [index, first] of boxes.entries()) {
    const rest = boxes.slice(index + 1);
    for (const second of rest) {
      if (
        first.el === second.el ||
        first.el.contains(second.el) ||
        second.el.contains(first.el)
      )
        continue;
      const width =
        Math.min(first.r.right, second.r.right) -
        Math.max(first.r.left, second.r.left);
      const height =
        Math.min(first.r.bottom, second.r.bottom) -
        Math.max(first.r.top, second.r.top);
      if (width > 2 && height > 0.4 * Math.min(first.r.height, second.r.height))
        pairs.add(`${nameOf(first.el)} x ${nameOf(second.el)}`);
    }
  }
  found.overlaps = [...pairs];
  if (touch) {
    for (const el of controls) {
      const parent = el.parentElement;
      const inline =
        getComputedStyle(el).display === "inline" &&
        parent &&
        [...parent.childNodes].some(
          (child) =>
            child !== el && child.nodeType === 3 && child.textContent?.trim()
        );
      let r = el.getBoundingClientRect();
      if (
        r.bottom > innerHeight ||
        r.top < 0 ||
        r.right > innerWidth ||
        r.left < 0
      ) {
        el.scrollIntoView({ block: "center", inline: "center" });
        r = el.getBoundingClientRect();
      }
      const centerX = r.left + r.width / 2;
      const centerY = r.top + r.height / 2;
      if (
        centerX < 0 ||
        centerY < 0 ||
        centerX > innerWidth ||
        centerY > innerHeight
      )
        continue;
      const hits = (x: number, y: number): boolean => {
        const target = document.elementFromPoint(x, y);
        return target !== null && (target === el || el.contains(target));
      };
      if (!hits(centerX, centerY)) {
        const target = document.elementFromPoint(centerX, centerY);
        found.covered.push(
          `${nameOf(el)} under ${target ? nameOf(target) : "nothing"}`
        );
        continue;
      }
      let left = 0;
      let right = 0;
      let up = 0;
      let down = 0;
      while (right < 30 && hits(centerX + right + 1, centerY)) right += 1;
      while (left < 30 && hits(centerX - left - 1, centerY)) left += 1;
      while (down < 30 && hits(centerX, centerY + down + 1)) down += 1;
      while (up < 30 && hits(centerX, centerY - up - 1)) up += 1;
      const width = left + right + 1;
      const height = up + down + 1;
      const label = `${nameOf(el)} ${String(width)}x${String(height)}`;
      if (width < 24 || height < 24)
        (inline ? found.small : found.tiny).push(
          `${label}${inline ? " (inline)" : ""}`
        );
      else if (width < 44 || height < 44) found.small.push(label);
    }
    scrollTo(0, 0);
  }
  found.clipped = [...new Set(found.clipped)];
  found.covered = [...new Set(found.covered)];
  found.offscreen = [...new Set(found.offscreen)];
  found.overlaps = [...new Set(found.overlaps)];
  found.small = [...new Set(found.small)];
  found.tiny = [...new Set(found.tiny)];
  found.truncated = [...new Set(found.truncated)];
  found.unreachable = [...new Set(found.unreachable)];
  return found;
};

interface Run {
  entry: Page;
  found: Findings;
  size: Dim;
  spacing: boolean;
}

const check: Check = async (audit) => {
  const result = newResult("layout");
  const dir = path.join(audit.out, "layout");
  fs.mkdirSync(dir, { recursive: true });
  const firstPost = audit.pages.find((entry) => entry.kind === "post");
  const spaced = audit.fast ? spacingSizes.slice(0, 3) : spacingSizes;
  const plan: Array<Omit<Run, "found">> = [];
  for (const entry of audit.pages) {
    if (entry !== firstPost && entry.kind === "post") continue;
    const list = entry.kind === "home" && !audit.fast ? homeSizes : otherSizes;
    for (const size of list) plan.push({ entry, size, spacing: false });
    if (entry.kind === "home" || entry.kind === "post")
      for (const size of spaced) plan.push({ entry, size, spacing: true });
  }
  const counts = { fail: 0, warn: 0 };
  const runs = await pool(
    plan,
    async ({ entry, size, spacing }): Promise<Run> => {
      const [W, H, touch] = size;
      const { context, page } = await openPage({
        reducedMotion: "reduce",
        size: {
          deviceScaleFactor: 1,
          hasTouch: Boolean(touch),
          isMobile: Boolean(touch),
          viewport: { height: H, width: W },
        },
        url: entry.url,
      });
      await settle(page, 1000);
      if (spacing) {
        await page.addStyleTag({ content: spacingCss });
        await page.waitForTimeout(700);
      }
      const found = await page.evaluate(measure, {
        H,
        touch: Boolean(touch),
        W,
      });
      const tag = `${pageSlug(entry.url)}-${String(W)}x${String(H)}${spacing ? "-spacing" : ""}`;
      await page.screenshot({ path: path.join(dir, `${tag}.png`) });
      await context.close();
      return { entry, found, size, spacing };
    }
  );
  for (const { entry, found, size, spacing } of runs) {
    const [W, H, touch] = size;
    const where = `${entry.path} ${String(W)}x${String(H)}${touch ? " touch" : ""}${spacing ? " text-spacing" : ""}`;
    const add = (level: Level, what: string, items: string[]): void => {
      if (items.length === 0) return;
      if (level !== "info") counts[level] += 1;
      const more =
        items.length > 5 ? ` (+${String(items.length - 5)} more)` : "";
      note(
        result,
        level,
        `${where}: ${what}: ${items.slice(0, 5).join("; ")}${more}`
      );
    };
    if (found.overflowX > 1)
      add("fail", "page scrolls sideways", [
        `${String(found.overflowX)}px too wide`,
      ]);
    add("fail", "text past the screen edge", found.offscreen);
    add("fail", "text you cannot scroll to", found.unreachable);
    add(spacing ? "fail" : "warn", "text cut off", found.clipped);
    add("info", "text ends in an ellipsis", found.truncated);
    add("warn", "text overlaps", found.overlaps);
    add("warn", "tap target covered", found.covered);
    add("fail", "tap target under 24px", found.tiny);
    add("warn", "tap target under 44px", found.small);
  }
  result.metrics["fail_findings"] = counts.fail;
  result.metrics["warn_findings"] = counts.warn;
  result.summary = `${String(plan.length)} page x size runs (incl. text spacing and 200% zoom sizes): ${String(counts.fail)} failing, ${String(counts.warn)} warning findings; screenshots in layout/`;
  return result;
};

export default check;
