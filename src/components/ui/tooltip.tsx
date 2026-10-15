import { AnimatePresence, motion } from "motion/react";
import {
  cloneElement,
  createContext,
  type FocusEvent,
  type HTMLAttributes,
  type KeyboardEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  type Blocker,
  placeTip,
  type TipAlign,
  type TipSide,
} from "@/lib/tip-place";
import {
  createTooltipStore,
  type TooltipStore,
  type TooltipTiming,
} from "@/lib/tooltip-store";
import { useStill } from "@/lib/use-still";

const timing: TooltipTiming = {
  closeDelay: 120,
  openDelay: 200,
  skipDelay: 400,
};
const leave = [0.4, 0, 1, 1] as const;
const rise = {
  damping: 34,
  mass: 0.6,
  stiffness: 560,
  type: "spring",
} as const;
const warm = {
  damping: 48,
  mass: 0.5,
  stiffness: 900,
  type: "spring",
} as const;
const glideSpring = {
  damping: 40,
  mass: 0.75,
  stiffness: 520,
  type: "spring",
} as const;
const swap = {
  damping: 44,
  mass: 0.5,
  stiffness: 700,
  type: "spring",
} as const;
const instant = { duration: 0 } as const;

const TooltipGroupContext = createContext<null | TooltipStore>(null);

const useResetOnBlur = (store: TooltipStore, enabled: boolean): void => {
  useEffect(() => {
    if (!enabled) return;
    const bail = (): void => {
      store.reset();
    };
    const onVisibility = (): void => {
      if (document.hidden) store.reset();
    };
    globalThis.addEventListener("blur", bail);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      globalThis.removeEventListener("blur", bail);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [store, enabled]);
};

interface TooltipGroupProps {
  children: ReactNode;
}

export const TooltipGroup = ({ children }: TooltipGroupProps): ReactElement => {
  const [store] = useState(() => createTooltipStore(() => timing));
  useEffect(
    () => () => {
      store.dispose();
    },
    [store]
  );
  useResetOnBlur(store, true);
  return (
    <TooltipGroupContext.Provider value={store}>
      {children}
    </TooltipGroupContext.Provider>
  );
};

interface TooltipProps {
  align?: TipAlign;
  avoid?: () => Blocker[];
  children: ReactElement<TriggerProps>;
  className?: string;
  label: ReactNode;
  pinned?: boolean;
  side?: TipSide;
  tipClassName?: string;
}

type TriggerProps = HTMLAttributes<HTMLElement>;

const chain =
  <E,>(theirs: ((event: E) => void) | undefined, ours: (event: E) => void) =>
  (event: E): void => {
    theirs?.(event);
    ours(event);
  };

const isKeyboardFocus = (element: HTMLElement): boolean => {
  try {
    return element.matches(":focus-visible");
  } catch {
    return true;
  }
};

export const Tooltip = ({
  align = "center",
  avoid,
  children,
  className = "",
  label,
  pinned = false,
  side = "top",
  tipClassName = "",
}: TooltipProps): ReactElement => {
  const group = useContext(TooltipGroupContext);
  const [own] = useState(() => createTooltipStore(() => timing));
  const store = group ?? own;
  const tipId = `tt-${useId()}`;
  const still = useStill();
  const rootRef = useRef<HTMLSpanElement>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);

  const open = useSyncExternalStore(
    store.subscribe,
    () => store.getActive() === tipId,
    () => false
  );
  const skipped = useSyncExternalStore(
    store.subscribe,
    store.getSkipped,
    () => false
  );
  const travel = useSyncExternalStore(
    store.subscribe,
    store.getTravel,
    () => 0
  );
  const shown = open || pinned;
  const glide = group !== null && !still;

  useEffect(
    () => () => {
      own.dispose();
    },
    [own]
  );
  useEffect(
    () => () => {
      store.close(tipId, true);
    },
    [store, tipId]
  );
  useResetOnBlur(store, group === null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === "Escape") store.dismiss(tipId);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, store, tipId]);

  useLayoutEffect(() => {
    if (!shown) return;
    const place = (): void => {
      const root = rootRef.current;
      const anchor = anchorRef.current;
      const tip = tipRef.current;
      if (!root || !anchor || !tip) return;
      if (getComputedStyle(tip).position === "fixed") {
        anchor.style.translate = "";
        return;
      }
      const { clientHeight, clientWidth } = document.documentElement;
      const placement = placeTip({
        align,
        anchor: root.getBoundingClientRect(),
        avoid: avoid?.() ?? [],
        height: tip.offsetHeight,
        side,
        viewport: { height: clientHeight, width: clientWidth },
        width: tip.offsetWidth,
      });
      anchor.dataset["side"] = placement.side;
      anchor.style.setProperty("--tip-gap", `${String(placement.gap)}px`);
      anchor.style.translate =
        placement.shift === 0 ? "" : `${String(placement.shift)}px 0`;
    };
    place();
    globalThis.addEventListener("resize", place);
    return () => {
      globalThis.removeEventListener("resize", place);
    };
  }, [align, avoid, shown, side]);

  const described = [children.props["aria-describedby"], shown ? tipId : null]
    .filter(Boolean)
    .join(" ");

  const trigger = cloneElement(children, {
    "aria-describedby": described.length > 0 ? described : undefined,
    onBlur: chain(children.props.onBlur, () => {
      store.unblock(tipId);
      store.close(tipId, true);
    }),
    onFocus: chain(children.props.onFocus, (event: FocusEvent<HTMLElement>) => {
      if (isKeyboardFocus(event.currentTarget)) store.open(tipId, true);
    }),
    onKeyDown: chain(
      children.props.onKeyDown,
      (event: KeyboardEvent<HTMLElement>) => {
        if (event.key === "Escape") store.dismiss(tipId);
      }
    ),
    onPointerCancel: chain(children.props.onPointerCancel, () => {
      store.unblock(tipId);
      store.close(tipId, true);
    }),
    onPointerDown: chain(children.props.onPointerDown, () => {
      store.dismiss(tipId);
    }),
    onPointerEnter: chain(
      children.props.onPointerEnter,
      (event: PointerEvent<HTMLElement>) => {
        if (event.pointerType !== "touch") {
          store.open(tipId, false, event.clientX);
        }
      }
    ),
    onPointerLeave: chain(children.props.onPointerLeave, () => {
      store.unblock(tipId);
      store.close(tipId, false);
    }),
  });

  const lift = side === "top" ? 7 : -7;
  const bodyStart = skipped
    ? { opacity: 0, x: travel * 14, y: 0 }
    : { opacity: 0, x: 0, y: 9 };

  return (
    <span className={`relative inline-flex ${className}`.trim()} ref={rootRef}>
      {trigger}
      <span
        aria-hidden={!shown}
        className="tip-anchor"
        data-align={align}
        data-side={side}
        ref={anchorRef}
      >
        <AnimatePresence>
          {shown ? (
            <motion.span
              animate={{ filter: "blur(0px)", opacity: 1, scale: 1, y: 0 }}
              className={`tip ${tipClassName}`.trim()}
              exit={
                still
                  ? { opacity: 0, transition: instant }
                  : {
                      filter: "blur(2px)",
                      opacity: 0,
                      scale: 0.96,
                      transition: { duration: 0.12, ease: leave },
                      y: lift * 0.35,
                    }
              }
              id={tipId}
              initial={
                still
                  ? false
                  : skipped
                    ? { filter: "blur(0px)", opacity: 0, scale: 1, y: 0 }
                    : { filter: "blur(4px)", opacity: 0, scale: 0.9, y: lift }
              }
              {...(glide ? { layoutId: store.seat } : {})}
              onPointerEnter={() => {
                store.open(tipId, true);
              }}
              onPointerLeave={() => {
                store.close(tipId, false);
              }}
              ref={tipRef}
              role="tooltip"
              style={{
                transformOrigin: side === "top" ? "50% 100%" : "50% 0%",
              }}
              transition={
                still
                  ? instant
                  : { ...(skipped ? warm : rise), layout: glideSpring }
              }
            >
              <motion.span
                aria-hidden="true"
                className="tip-surface mat-tip"
                layout={glide}
                transition={still ? instant : glideSpring}
              />
              <motion.span
                animate={{ opacity: 1, x: 0, y: 0 }}
                className="tip-body"
                initial={still ? false : bodyStart}
                layout={glide ? "position" : false}
                transition={still ? instant : swap}
              >
                {label}
              </motion.span>
            </motion.span>
          ) : null}
        </AnimatePresence>
      </span>
    </span>
  );
};
