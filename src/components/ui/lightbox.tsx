import { animate, AnimatePresence, motion, useMotionValue } from "motion/react";
import {
  type ReactElement,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

import {
  clamp,
  isSwipe,
  isTap,
  landing,
  nearHome,
  panLimit,
  snapHome,
} from "@/lib/blog/lightbox";
import { useStill } from "@/lib/use-still";

interface Drag {
  from: { x: number; y: number };
  id: number;
  onContent: boolean;
  x: number;
  y: number;
}

interface Flight {
  dx: number;
  dy: number;
  opacity: number;
  radius: number;
  scale: number;
}

interface LightboxProps {
  alt: string;
  caption: string;
  closeLabel: string;
  height: number;
  hint: string;
  onClose: () => void;
  onExited: () => void;
  open: boolean;
  origin: HTMLElement | null;
  src: string;
  width: number;
  zoomInLabel: string;
  zoomOutLabel: string;
  zoomStatus: (zoom: number) => string;
}

interface Spring {
  damping: number;
  mass: number;
  stiffness: number;
  type: "spring";
}

type StageProps = Omit<LightboxProps, "onExited" | "open">;

const CELL: Spring = {
  damping: 34,
  mass: 0.45,
  stiffness: 520,
  type: "spring",
};
const HOME: Spring = { damping: 27, mass: 1, stiffness: 150, type: "spring" };
const VEIL: Spring = { damping: 34, mass: 0.8, stiffness: 260, type: "spring" };
const GLYPH: Spring = {
  damping: 46,
  mass: 0.5,
  stiffness: 700,
  type: "spring",
};
const EASE = [0.23, 1, 0.32, 1] as const;
const EXIT = { duration: 0.2, ease: [0.4, 0, 1, 1] } as const;
const INSTANT = { duration: 0 } as const;
const maxScale = 4;
const TOGGLE = 2.5;
const keyZoom = 1.6;
const keyPan = 56;
const wheelRate = 140;
const FOLLOW = 0.7;
const settleMs = 220;
const drift: Flight = { dx: 0, dy: 10, opacity: 0, radius: 0, scale: 0.97 };
const rest: Flight = { dx: 0, dy: 0, opacity: 1, radius: 0, scale: 1 };
const gutterVar = "--drawer-gutter";
const focusSelector = "[data-lightbox-focus]";

const arrows = new Map<string, readonly [number, number]>([
  ["ArrowDown", [0, -keyPan]],
  ["ArrowLeft", [keyPan, 0]],
  ["ArrowRight", [-keyPan, 0]],
  ["ArrowUp", [0, keyPan]],
]);

const openModal = (dialog: HTMLDialogElement | null): void => {
  if (dialog === null || dialog.open) return;
  const gutter = window.innerWidth - document.documentElement.clientWidth;
  document.documentElement.style.setProperty(gutterVar, `${String(gutter)}px`);
  dialog.showModal();
};

const Stage = ({
  alt,
  caption,
  closeLabel,
  height,
  hint,
  onClose,
  origin,
  src,
  width,
  zoomInLabel,
  zoomOutLabel,
  zoomStatus,
}: StageProps): ReactElement => {
  const still = useStill();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLImageElement>(null);
  const drag = useRef<Drag | null>(null);
  const previous = useRef<HTMLElement | null>(null);
  const timer = useRef<null | ReturnType<typeof setTimeout>>(null);
  const scale = useMotionValue(1);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const fx = useMotionValue(0);
  const fy = useMotionValue(0);
  const fs = useMotionValue(1);
  const fo = useMotionValue(0);
  const fr = useMotionValue(0);
  const [zoomed, setZoomed] = useState(false);
  const [settled, setSettled] = useState(1);

  const mark = useCallback((value: number): void => {
    setZoomed(value > nearHome);
  }, []);

  const settle = useCallback((value: number): void => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setSettled(Math.round(value * 10) / 10);
  }, []);

  const settleSoon = useCallback(
    (value: number): void => {
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        settle(value);
      }, settleMs);
    },
    [settle]
  );

  const limits = useCallback((value: number): { mx: number; my: number } => {
    const frame = frameRef.current;
    const content = contentRef.current;
    if (frame === null || content === null) return { mx: 0, my: 0 };
    return {
      mx: panLimit(content.offsetWidth, frame.clientWidth, value),
      my: panLimit(content.offsetHeight, frame.clientHeight, value),
    };
  }, []);

  const place = useCallback(
    (value: number, nx: number, ny: number): void => {
      const { mx, my } = limits(value);
      scale.set(value);
      x.set(clamp(nx, -mx, mx));
      y.set(clamp(ny, -my, my));
      mark(value);
    },
    [limits, mark, scale, x, y]
  );

  const glide = useCallback(
    (value: number, nx: number, ny: number, spring: Spring = CELL): void => {
      const { mx, my } = limits(value);
      const tx = clamp(nx, -mx, mx);
      const ty = clamp(ny, -my, my);
      if (still) {
        scale.set(value);
        x.set(tx);
        y.set(ty);
      } else {
        animate(scale, value, spring);
        animate(x, tx, spring);
        animate(y, ty, spring);
      }
      mark(value);
      settle(value);
    },
    [limits, mark, scale, settle, still, x, y]
  );

  const reset = useCallback((): void => {
    glide(1, 0, 0, HOME);
  }, [glide]);

  const zoomAt = useCallback(
    (next: number, cx: number, cy: number, animated: boolean): void => {
      const frame = frameRef.current;
      if (frame === null) return;
      const box = frame.getBoundingClientRect();
      const px = cx - (box.left + box.width / 2);
      const py = cy - (box.top + box.height / 2);
      const from = scale.get();
      const ax = (px - x.get()) / from;
      const ay = (py - y.get()) / from;
      const value = clamp(next, 1, maxScale);
      const nx = px - ax * value;
      const ny = py - ay * value;
      if (animated) {
        glide(value, nx, ny, value <= 1 ? HOME : CELL);
        return;
      }
      place(value, nx, ny);
      settleSoon(value);
    },
    [glide, place, scale, settleSoon, x, y]
  );

  const zoomFromCenter = useCallback(
    (value: number): void => {
      const frame = frameRef.current;
      if (frame === null) return;
      const box = frame.getBoundingClientRect();
      zoomAt(value, box.left + box.width / 2, box.top + box.height / 2, true);
    },
    [zoomAt]
  );

  const finish = useCallback((): void => {
    const value = scale.get();
    if (value < snapHome) reset();
    else settle(value);
  }, [reset, scale, settle]);

  const release = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const held = drag.current;
    if (held?.id !== event.pointerId) return;
    drag.current = null;
    const dx = event.clientX - held.from.x;
    const dy = event.clientY - held.from.y;
    const value = scale.get();
    if (
      (isTap(dx, dy) && !held.onContent && value <= nearHome) ||
      isSwipe(dx, dy, value)
    ) {
      onClose();
      return;
    }
    finish();
  };

  const cancel = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    finish();
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const content = contentRef.current;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      from: { x: event.clientX, y: event.clientY },
      id: event.pointerId,
      onContent:
        content !== null &&
        event.target instanceof Node &&
        content.contains(event.target),
      x: x.get(),
      y: y.get(),
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const held = drag.current;
    if (held?.id !== event.pointerId) return;
    const dx = event.clientX - held.from.x;
    const dy = event.clientY - held.from.y;
    const value = scale.get();
    if (value > 1) {
      place(value, held.x + dx, held.y + dy);
      return;
    }
    if (isTap(dx, dy)) return;
    x.set(dx * FOLLOW);
    y.set(dy * FOLLOW);
  };

  const onDoubleClick = (event: ReactMouseEvent<HTMLDivElement>): void => {
    zoomAt(
      scale.get() > snapHome ? 1 : TOGGLE,
      event.clientX,
      event.clientY,
      true
    );
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDialogElement>): void => {
    const value = scale.get();
    if (event.key === "Escape") {
      event.preventDefault();
      if (value > nearHome) reset();
      else onClose();
      return;
    }
    if (event.key === "Tab") {
      const nodes = [
        ...event.currentTarget.querySelectorAll<HTMLElement>(focusSelector),
      ];
      if (nodes.length === 0) return;
      event.preventDefault();
      const here =
        document.activeElement instanceof HTMLElement
          ? nodes.indexOf(document.activeElement)
          : -1;
      const step = event.shiftKey ? -1 : 1;
      const next =
        here === -1 ? 0 : (here + step + nodes.length) % nodes.length;
      nodes[next]?.focus();
      return;
    }
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoomFromCenter(value * keyZoom);
      return;
    }
    if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      zoomFromCenter(value / keyZoom);
      return;
    }
    if (event.key === "0") {
      event.preventDefault();
      reset();
      return;
    }
    const pan = arrows.get(event.key);
    if (pan === undefined || value <= nearHome) return;
    event.preventDefault();
    glide(value, x.get() + pan[0], y.get() + pan[1]);
  };

  const toggleZoom = (): void => {
    if (zoomed) reset();
    else zoomFromCenter(TOGGLE);
  };

  const flight = useCallback((): Flight => {
    const frame = frameRef.current;
    const content = contentRef.current;
    if (frame === null || content === null || origin === null) return drift;
    const found = landing(
      frame.getBoundingClientRect(),
      origin.getBoundingClientRect(),
      content.offsetWidth
    );
    if (found === null) return drift;
    const radius =
      Number(getComputedStyle(origin).borderTopLeftRadius.split("px", 1)[0]) ||
      0;
    return { ...found, opacity: 1, radius: radius / found.scale };
  }, [origin]);

  useLayoutEffect(() => {
    previous.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
  }, []);

  useLayoutEffect(() => {
    openModal(dialogRef.current);
    const start = still ? rest : flight();
    fx.set(start.dx);
    fy.set(start.dy);
    fs.set(start.scale);
    fo.set(start.opacity);
    fr.set(start.radius);
    frameRef.current?.focus({ preventScroll: true });
    const runs = still
      ? []
      : [
          animate(fx, 0, HOME),
          animate(fy, 0, HOME),
          animate(fs, 1, HOME),
          animate(fo, 1, HOME),
          animate(fr, 0, HOME),
        ];
    return (): void => {
      for (const run of runs) run.stop();
    };
  }, [flight, fo, fr, fs, fx, fy, still]);

  useEffect(() => {
    const root = document.documentElement;
    const back = previous;
    const pending = timer;
    return (): void => {
      root.style.removeProperty(gutterVar);
      if (pending.current !== null) clearTimeout(pending.current);
      if (back.current?.isConnected === true) {
        back.current.focus({ preventScroll: true });
      }
    };
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    if (frame === null) return;
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      zoomAt(
        scale.get() * Math.exp(-event.deltaY / wheelRate),
        event.clientX,
        event.clientY,
        false
      );
    };
    const bail = (): void => {
      drag.current = null;
    };
    frame.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("blur", bail);
    return (): void => {
      frame.removeEventListener("wheel", onWheel);
      window.removeEventListener("blur", bail);
    };
  }, [scale, zoomAt]);

  const away = useCallback(() => {
    if (still) return { opacity: 0, transition: { duration: 0.12 } };
    const found = flight();
    animate(fr, found.radius, HOME);
    return {
      filter: "blur(4px)",
      opacity: found.opacity,
      scale: found.scale,
      transition: HOME,
      x: found.dx,
      y: found.dy,
    };
  }, [flight, fr, still]);

  const unwind = useCallback(
    () => ({ scale: 1, transition: still ? INSTANT : HOME, x: 0, y: 0 }),
    [still]
  );

  const fade = still ? INSTANT : VEIL;

  return (
    <dialog
      aria-label={caption}
      className="lightbox"
      onCancel={(event) => {
        event.preventDefault();
      }}
      onKeyDown={onKeyDown}
      ref={dialogRef}
    >
      <motion.div
        animate={{ opacity: 1 }}
        aria-hidden="true"
        className="lightbox-scrim"
        exit={{
          opacity: 0,
          transition: still ? INSTANT : { duration: 0.3, ease: EASE },
        }}
        initial={{ opacity: 0 }}
        transition={fade}
      />
      <div
        className="lightbox-frame"
        data-lightbox-focus=""
        data-zoomed={zoomed ? "" : undefined}
        onDoubleClick={onDoubleClick}
        onLostPointerCapture={cancel}
        onPointerCancel={cancel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={release}
        ref={frameRef}
        role="group"
        tabIndex={-1}
      >
        <motion.div
          animate={{ filter: "blur(0px)" }}
          className="lightbox-stage"
          exit="away"
          initial={still ? false : { filter: "blur(6px)" }}
          style={{ opacity: fo, scale: fs, x: fx, y: fy }}
          transition={
            still ? INSTANT : { filter: { duration: 0.35, ease: EASE } }
          }
          variants={{ away }}
        >
          <motion.img
            alt={alt}
            className="lightbox-image"
            draggable={false}
            exit="away"
            height={height}
            ref={contentRef}
            src={src}
            style={{ borderRadius: fr, scale, x, y }}
            variants={{ away: unwind }}
            width={width}
          />
        </motion.div>
      </div>
      <motion.div
        animate={{ opacity: 1 }}
        className="lightbox-bar"
        exit={{ opacity: 0, transition: still ? INSTANT : EXIT }}
        initial={{ opacity: 0 }}
        transition={fade}
      >
        <p className="lightbox-caption">{caption}</p>
        <div className="lightbox-actions">
          <button
            aria-label={zoomed ? zoomOutLabel : zoomInLabel}
            className="lightbox-button focus-ring"
            data-lightbox-focus=""
            onClick={toggleZoom}
            type="button"
          >
            <svg
              aria-hidden="true"
              fill="none"
              height="16"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="16"
              viewBox="0 0 256 256"
              width="16"
            >
              <circle cx="116" cy="116" r="84" />
              <path d="M175.4 175.4 224 224M84 116h64" />
              <motion.path
                animate={{ opacity: zoomed ? 0 : 1 }}
                d="M116 84v64"
                initial={false}
                transition={still ? INSTANT : GLYPH}
              />
            </svg>
          </button>
          <button
            aria-label={closeLabel}
            className="lightbox-button focus-ring"
            data-lightbox-focus=""
            onClick={onClose}
            type="button"
          >
            <svg
              aria-hidden="true"
              fill="none"
              height="16"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="16"
              viewBox="0 0 256 256"
              width="16"
            >
              <path d="M200 56 56 200M200 200 56 56" />
            </svg>
          </button>
        </div>
      </motion.div>
      <p className="sr-only">{hint}</p>
      <p className="sr-only" role="status">
        {zoomStatus(settled)}
      </p>
    </dialog>
  );
};

const nothing = (): void => undefined;

const subscribeNothing = (): (() => void) => nothing;

export const Lightbox = ({
  onExited,
  open,
  ...stage
}: LightboxProps): null | ReactElement => {
  const mounted = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false
  );
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence onExitComplete={onExited}>
      {open ? <Stage key={stage.src} {...stage} /> : null}
    </AnimatePresence>,
    document.body
  );
};
