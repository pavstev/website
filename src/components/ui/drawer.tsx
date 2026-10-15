"use client";

import {
  animate,
  type AnimationPlaybackControls,
  motion,
  type PanInfo,
  useDragControls,
  useMotionValue,
  useTransform,
} from "motion/react";
import {
  type ReactElement,
  type ReactNode,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { CloseGlyph } from "@/components/ui/close-glyph";
import { useStill } from "@/lib/use-still";

interface DrawerProps {
  children: ReactNode;
  className: string;
  closeLabel: string;
  id: string;
  onClosed?: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  sheet?: boolean;
  title: string;
}

const spring = {
  damping: 27,
  mass: 1,
  stiffness: 150,
  type: "spring",
} as const;
const instant = { duration: 0 } as const;
const sheetQuery = "(max-width: 40rem)";
const dismissRatio = 0.38;
const flickSpeed = 520;
const overshoot = 56;
const gutterVar = "--drawer-gutter";
const noRoom = { bottom: 0, left: 0, right: 0, top: 0 } as const;
const followRight = { bottom: 0, left: 0, right: 1, top: 0 } as const;
const followDown = { bottom: 1, left: 0, right: 0, top: 0 } as const;

const subscribeSheet = (callback: () => void): (() => void) => {
  const query = globalThis.matchMedia(sheetQuery);
  query.addEventListener("change", callback);
  return () => {
    query.removeEventListener("change", callback);
  };
};

const readSheet = (): boolean => globalThis.matchMedia(sheetQuery).matches;

export const Drawer = ({
  children,
  className,
  closeLabel,
  id,
  onClosed,
  onOpenChange,
  open,
  sheet = false,
  title,
}: DrawerProps): ReactElement => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const playing = useRef<AnimationPlaybackControls | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const extent = useMotionValue(1);
  const veil = useTransform(
    () =>
      1 -
      Math.min(
        1,
        (Math.abs(x.get()) + Math.abs(y.get())) /
          Math.max(1, extent.get() - overshoot)
      )
  );
  const controls = useDragControls();
  const still = useStill();
  const narrow = useSyncExternalStore(subscribeSheet, readSheet, () => false);
  const vertical = sheet && narrow;
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    const panel = panelRef.current;
    if (!dialog || !panel) return;
    const axis = vertical ? y : x;
    const other = vertical ? x : y;
    const transition = still ? instant : spring;
    const measure = (): number =>
      (vertical ? panel.offsetHeight : panel.offsetWidth) + overshoot;
    if (open) {
      const fresh = !dialog.open;
      if (fresh) {
        const gutter = window.innerWidth - document.documentElement.clientWidth;
        document.documentElement.style.setProperty(
          gutterVar,
          `${String(gutter)}px`
        );
        dialog.showModal();
      }
      extent.set(measure());
      other.set(0);
      if (fresh) {
        axis.set(extent.get());
        panel
          .querySelector<HTMLElement>(".drawer-close")
          ?.focus({ preventScroll: true });
      }
      playing.current = animate(axis, 0, transition);
    } else if (dialog.open) {
      const away = measure();
      extent.set(away);
      let done = false;
      const finish = (): void => {
        if (done) return;
        done = true;
        playing.current?.stop();
        dialog.close();
      };
      playing.current = animate(axis, away, {
        ...transition,
        onComplete: finish,
        onUpdate: (value) => {
          if (value >= away - overshoot / 2) finish();
        },
      });
    }
    return () => {
      playing.current?.stop();
    };
  }, [extent, open, still, vertical, x, y]);

  const onDragStart = (): void => {
    playing.current?.stop();
    setDragging(true);
  };

  const onDragEnd = (_event: unknown, info: PanInfo): void => {
    setDragging(false);
    const travel = vertical ? info.offset.y : info.offset.x;
    const speed = vertical ? info.velocity.y : info.velocity.x;
    if (
      travel > (extent.get() - overshoot) * dismissRatio ||
      speed > flickSpeed
    ) {
      onOpenChange(false);
      return;
    }
    playing.current = animate(vertical ? y : x, 0, still ? instant : spring);
  };

  return (
    <dialog
      aria-labelledby={`${id}-title`}
      className={`drawer ${className}`}
      data-drawer={id}
      id={id}
      onCancel={(event) => {
        event.preventDefault();
        onOpenChange(false);
      }}
      onClose={() => {
        document.documentElement.style.removeProperty(gutterVar);
        if (open) onOpenChange(false);
        onClosed?.();
      }}
      ref={dialogRef}
    >
      <motion.div
        aria-hidden="true"
        className="drawer-scrim"
        onClick={() => {
          onOpenChange(false);
        }}
        style={{ opacity: veil }}
      />
      <motion.div
        className="drawer-panel mat-float"
        data-dragging={dragging ? "" : undefined}
        drag={vertical ? "y" : "x"}
        dragConstraints={noRoom}
        dragControls={controls}
        dragElastic={vertical ? followDown : followRight}
        dragListener={false}
        dragMomentum={false}
        onDragEnd={onDragEnd}
        onDragStart={onDragStart}
        ref={panelRef}
        style={{ x, y }}
      >
        <header
          className="drawer-head"
          onPointerDown={(event) => {
            if (open) controls.start(event);
          }}
        >
          <h2 className="drawer-title" id={`${id}-title`}>
            {title}
          </h2>
          <button
            aria-label={closeLabel}
            className="drawer-close focus-ring"
            onClick={() => {
              onOpenChange(false);
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            type="button"
          >
            <CloseGlyph size={13} />
          </button>
        </header>
        <div className="drawer-body">{children}</div>
      </motion.div>
    </dialog>
  );
};
