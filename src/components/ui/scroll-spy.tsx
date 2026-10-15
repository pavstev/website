import { motion, useMotionValue, useSpring } from "motion/react";
import { type ReactElement, useEffect, useRef, useState } from "react";

import { spySection } from "@/lib/blog/toc";
import { useStill } from "@/lib/use-still";

const CELL = { damping: 34, mass: 0.45, stiffness: 520 } as const;
const scrollKeys = new Set([
  " ",
  "ArrowDown",
  "ArrowUp",
  "End",
  "Home",
  "PageDown",
  "PageUp",
]);

interface ScrollSpyOptions {
  headings: string;
  links: string;
  offset: () => number;
}

export const useScrollSpy = ({
  headings,
  links,
  offset,
}: ScrollSpyOptions): string | undefined => {
  const [activeId, setActiveId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const nodes = [...document.querySelectorAll(headings)];
    if (nodes.length === 0) return;
    const ids = nodes.map((node) => node.id);
    let held: string | undefined;
    let frame = 0;

    const measure = (): string | undefined => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const ratio =
        max <= 2 || max - window.scrollY <= 2 ? 1 : window.scrollY / max;
      return ids[
        spySection(
          nodes.map((node) => node.getBoundingClientRect().top),
          offset(),
          window.innerHeight,
          ratio
        )
      ];
    };
    const sync = (): void => {
      frame = 0;
      const next = measure();
      if (held === undefined) setActiveId(next);
      else if (held === next) held = undefined;
    };
    const schedule = (): void => {
      if (frame === 0) frame = requestAnimationFrame(sync);
    };
    const release = (): void => {
      held = undefined;
    };
    const releaseOnKey = (event: KeyboardEvent): void => {
      if (scrollKeys.has(event.key)) release();
    };
    const hold = (event: MouseEvent): void => {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        !(event.target instanceof Element)
      )
        return;
      const hash = event.target.closest(links)?.getAttribute("href");
      const id = hash?.slice(1);
      if (id === undefined || !ids.includes(id)) return;
      held = id;
      setActiveId(id);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(document.documentElement);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("wheel", release, { passive: true });
    globalThis.addEventListener("pointerdown", release, { passive: true });
    globalThis.addEventListener("keydown", releaseOnKey);
    document.addEventListener("click", hold);
    schedule();
    return (): void => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("wheel", release);
      globalThis.removeEventListener("pointerdown", release);
      globalThis.removeEventListener("keydown", releaseOnKey);
      document.removeEventListener("click", hold);
    };
  }, [headings, links, offset]);

  return activeId;
};

interface ScrollSpyThumbProps {
  activeId: string | undefined;
  className: string;
  container: string;
}

export const ScrollSpyThumb = ({
  activeId,
  className,
  container,
}: ScrollSpyThumbProps): ReactElement => {
  const still = useStill();
  const ref = useRef<HTMLSpanElement>(null);
  const placed = useRef(false);
  const top = useMotionValue(0);
  const size = useMotionValue(0);
  const topSpring = useSpring(top, CELL);
  const sizeSpring = useSpring(size, CELL);

  useEffect(() => {
    const parent = ref.current?.closest(container);
    if (!parent) return;
    const place = (): void => {
      const link =
        activeId === undefined
          ? null
          : parent.querySelector<HTMLElement>(
              `a[href="#${CSS.escape(activeId)}"]`
            );
      const box = link?.getBoundingClientRect();
      if (!box || box.height === 0) {
        size.set(0);
        placed.current = false;
        return;
      }
      const next = box.top - parent.getBoundingClientRect().top;
      top.set(next);
      size.set(box.height);
      if (still || !placed.current) {
        topSpring.jump(next);
        sizeSpring.jump(box.height);
      }
      placed.current = true;
    };
    const observer = new ResizeObserver(place);
    observer.observe(parent);
    place();
    return (): void => {
      observer.disconnect();
    };
  }, [activeId, container, size, sizeSpring, still, top, topSpring]);

  return (
    <motion.span
      aria-hidden="true"
      className={className}
      ref={ref}
      style={{ height: sizeSpring, y: topSpring }}
    />
  );
};
