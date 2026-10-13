"use client";

import {
  type ReactElement,
  useEffect,
  useMemo,
  useRef,
  ViewTransition,
} from "react";

import type { MoonBody, MoonLink, MoonScene } from "@/lib/blog/moon-gl";

import { MoonFallback } from "@/components/blog/moon-fallback";
import {
  moonPosition,
  moonRadius,
  moonSide,
  orbitFor,
  sharedTags,
  startAngle,
} from "@/lib/blog/moons";
import { isCoarseDevice, scheduleIdle } from "@/lib/idle";
import { createListeners, type Listeners } from "@/lib/listeners";
import { finePointerQuery } from "@/lib/media";
import { prefersLightLoad } from "@/lib/save-data";
import { setSkyPreset, type SkyPreset } from "@/lib/sky-preset";
import { hasSeenSoftwareRenderer } from "@/lib/webgl";

interface ActiveSources {
  band: null | string;
  focused: null | string;
  hovered: null | string;
}

interface BlogMoonsProps {
  posts: readonly MoonPost[];
}

interface MoonNodes {
  anchors: Array<HTMLElement | null>;
  eclipse: HTMLElement;
  lines: SVGLineElement[];
  rows: Array<HTMLElement | null>;
  stage: HTMLElement;
}

interface MoonPost {
  readingMinutes: number;
  sky: SkyPreset;
  slug: string;
  tags: readonly string[];
}

type Pair = [number, number];

const forcedColorsQuery = "(forced-colors: active)";
const centerBand = "-45% 0px -45% 0px";

const linkPairs = (posts: readonly MoonPost[]): Pair[] =>
  posts.flatMap((post, from) =>
    posts
      .slice(from + 1)
      .flatMap((other, offset): Pair[] =>
        sharedTags(post.tags, other.tags).length > 0
          ? [[from, from + offset + 1]]
          : []
      )
  );

const placeStill = ({ anchors, eclipse, stage }: MoonNodes): void => {
  if (stage.dataset["moons"] === "gl") return;
  const radius = eclipse.offsetWidth / 2;
  const viewport = {
    height: globalThis.innerHeight,
    width: globalThis.innerWidth,
  };
  for (const [index, anchor] of anchors.entries()) {
    if (!anchor) continue;
    const { depth, x, y } = moonPosition(
      orbitFor(index, anchors.length, radius, viewport),
      startAngle(index, anchors.length)
    );
    anchor.style.translate = `${x.toFixed(2)}px ${y.toFixed(2)}px`;
    anchor.dataset["side"] = moonSide(x, depth);
  }
};

const markActive = (
  nodes: MoonNodes,
  pairs: readonly Pair[],
  index: number
): void => {
  for (const [at, anchor] of nodes.anchors.entries()) {
    anchor?.toggleAttribute("data-active", at === index);
    nodes.rows[at]?.toggleAttribute("data-active", at === index);
  }
  for (const [at, [from, to]] of pairs.entries()) {
    nodes.lines[at]?.toggleAttribute(
      "data-on",
      index !== -1 && (from === index || to === index)
    );
  }
};

const watchPointer = (
  listeners: Listeners,
  node: HTMLElement | null,
  slug: string,
  sources: ActiveSources,
  show: () => void
): void => {
  if (!node) return;
  const fine = globalThis.matchMedia(finePointerQuery);
  listeners.on(node, "pointerenter", (event) => {
    if (
      !(event instanceof PointerEvent) ||
      event.pointerType === "touch" ||
      !fine.matches
    )
      return;
    sources.hovered = slug;
    show();
  });
  listeners.on(node, "pointerleave", () => {
    if (sources.hovered !== slug) return;
    sources.hovered = null;
    show();
  });
  listeners.on(node, "focusin", () => {
    sources.focused = slug;
    show();
  });
  listeners.on(node, "focusout", () => {
    if (sources.focused !== slug) return;
    sources.focused = null;
    show();
  });
};

const nearestToCenter = (rows: Iterable<HTMLElement>): null | string => {
  const middle = globalThis.innerHeight / 2;
  let best: null | string = null;
  let bestGap = Infinity;
  for (const row of rows) {
    const box = row.getBoundingClientRect();
    const gap = Math.abs(box.top + box.height / 2 - middle);
    if (gap >= bestGap) continue;
    bestGap = gap;
    best = row.dataset["postSlug"] ?? null;
  }
  return best;
};

const watchCenterBand = (
  listeners: Listeners,
  rows: Array<HTMLElement | null>,
  sources: ActiveSources,
  show: () => void
): void => {
  const inBand = new Set<HTMLElement>();
  let frame = 0;
  const pick = (): void => {
    sources.band = globalThis.scrollY > 0 ? nearestToCenter(inBand) : null;
    show();
  };
  const band = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!(entry.target instanceof HTMLElement)) continue;
        if (entry.isIntersecting) inBand.add(entry.target);
        else inBand.delete(entry.target);
      }
      pick();
    },
    { rootMargin: centerBand }
  );
  for (const row of rows) if (row) band.observe(row);
  listeners.add(() => {
    band.disconnect();
    cancelAnimationFrame(frame);
  });
  listeners.on(globalThis.window, "scroll", () => {
    if (frame !== 0) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (globalThis.scrollY <= 0 || inBand.size > 1 || sources.band === null)
        pick();
    });
  });
};

const moonBodies = (
  posts: readonly MoonPost[],
  anchors: Array<HTMLElement | null>
): MoonBody[] => {
  const bodies: MoonBody[] = [];
  for (const [index, post] of posts.entries()) {
    const node = anchors[index];
    if (!node) continue;
    bodies.push({
      node,
      radius: moonRadius(post.readingMinutes),
      slug: post.slug,
    });
  }
  return bodies;
};

const moonLinks = (
  pairs: readonly Pair[],
  lines: SVGLineElement[]
): MoonLink[] => {
  const links: MoonLink[] = [];
  for (const [index, [from, to]] of pairs.entries()) {
    const node = lines[index];
    if (!node) continue;
    links.push({ from, node, to });
  }
  return links;
};

const findNodes = (
  stage: HTMLElement,
  svg: SVGSVGElement,
  posts: readonly MoonPost[]
): MoonNodes | undefined => {
  const eclipse =
    stage.parentElement?.querySelector<HTMLElement>("[data-eclipse]");
  if (!eclipse) return undefined;
  return {
    anchors: posts.map((post) =>
      stage.querySelector<HTMLElement>(`[data-moon="${CSS.escape(post.slug)}"]`)
    ),
    eclipse,
    lines: [...svg.querySelectorAll<SVGLineElement>("line")],
    rows: posts.map((post) =>
      document.querySelector<HTMLElement>(
        `[data-blog-index] .post-row[data-post-slug="${CSS.escape(post.slug)}"]`
      )
    ),
    stage,
  };
};

export const BlogMoons = ({ posts }: BlogMoonsProps): ReactElement => {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const linesRef = useRef<SVGSVGElement>(null);
  const pairs = useMemo(() => linkPairs(posts), [posts]);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const svg = linesRef.current;
    const nodes = stage && svg ? findNodes(stage, svg, posts) : undefined;
    if (!canvas || !nodes) return;
    const listeners = createListeners();
    const sources: ActiveSources = { band: null, focused: null, hovered: null };
    const forced = globalThis.matchMedia(forcedColorsQuery);
    let scene: MoonScene | undefined;
    let alive = true;
    let active: null | string = null;

    const show = (): void => {
      const next = sources.hovered ?? sources.focused ?? sources.band;
      if (next === active) return;
      active = next;
      const index = posts.findIndex((post) => post.slug === next);
      markActive(nodes, pairs, index);
      scene?.setActive(next);
      setSkyPreset(posts[index]?.sky ?? null);
    };

    const dropScene = (): void => {
      scene?.dispose();
      scene = undefined;
      placeStill(nodes);
    };

    for (const [index, post] of posts.entries()) {
      watchPointer(
        listeners,
        nodes.rows[index] ?? null,
        post.slug,
        sources,
        show
      );
      watchPointer(
        listeners,
        nodes.anchors[index] ?? null,
        post.slug,
        sources,
        show
      );
    }
    if (isCoarseDevice()) watchCenterBand(listeners, nodes.rows, sources, show);

    placeStill(nodes);
    const sizeWatch = new ResizeObserver(() => {
      placeStill(nodes);
    });
    sizeWatch.observe(nodes.stage);
    listeners.add(() => {
      sizeWatch.disconnect();
    });
    listeners.on(forced, "change", () => {
      if (forced.matches) dropScene();
    });

    const boot = async (): Promise<void> => {
      try {
        const { initMoons } = await import("@/lib/blog/moon-gl");
        if (!alive || forced.matches) return;
        scene = initMoons(
          canvas,
          nodes.stage,
          nodes.eclipse,
          moonBodies(posts, nodes.anchors),
          moonLinks(pairs, nodes.lines)
        );
        scene.setActive(active);
      } catch {
        dropScene();
      }
    };
    const canDraw =
      !prefersLightLoad() && !hasSeenSoftwareRenderer() && !forced.matches;
    const cancelBoot = canDraw
      ? scheduleIdle(boot, { fallbackMs: 300, timeout: 1500 })
      : undefined;

    return () => {
      alive = false;
      cancelBoot?.();
      listeners.dispose();
      scene?.dispose();
      markActive(nodes, pairs, -1);
      setSkyPreset(null);
    };
  }, [posts, pairs]);

  return (
    <div className="blog-moons" data-moons="css" ref={stageRef}>
      <svg aria-hidden="true" className="moon-lines" ref={linesRef}>
        {pairs.map(([from, to]) => (
          <line
            className="moon-line"
            key={`${String(from)}-${String(to)}`}
            pathLength={1}
            x1="0"
            x2="0"
            y1="0"
            y2="0"
          />
        ))}
      </svg>
      <canvas aria-hidden="true" className="moon-canvas" ref={canvasRef} />
      {posts.map((post, index) => (
        <ViewTransition
          default="none"
          key={post.slug}
          name={`moon-${post.slug}`}
          share="morph"
        >
          <MoonFallback count={posts.length} index={index} post={post} />
        </ViewTransition>
      ))}
    </div>
  );
};
