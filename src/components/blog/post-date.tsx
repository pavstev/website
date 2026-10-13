"use client";

import {
  type ReactElement,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  dateLabel,
  fullDateTime,
  viennaClock,
  viennaDate,
  viennaZone,
} from "@/lib/blog/dates";
import { en } from "@/lib/i18n";

interface PostDateProps {
  iso: string;
}

const tickMs = 60_000;
const listeners = new Set<() => void>();
let clockNow = Date.now();
let timer: ReturnType<typeof setInterval> | undefined;

const notify = (): void => {
  clockNow = Date.now();
  for (const listener of listeners) listener();
};

const stopTimer = (): void => {
  if (timer !== undefined) clearInterval(timer);
  timer = undefined;
};

const onVisibility = (): void => {
  stopTimer();
  if (document.visibilityState !== "visible") return;
  notify();
  timer = setInterval(notify, tickMs);
};

const subscribeClock = (listener: () => void): (() => void) => {
  listeners.add(listener);
  if (listeners.size === 1) {
    document.addEventListener("visibilitychange", onVisibility);
    onVisibility();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    document.removeEventListener("visibilitychange", onVisibility);
    stopTimer();
  };
};

const unsubscribeNever = (): undefined => undefined;

const subscribeNever = (): (() => void) => unsubscribeNever;

const readerZone = (): string =>
  new Intl.DateTimeFormat().resolvedOptions().timeZone;

const viennaLine = (iso: string): string =>
  en.blog.viennaTime.replace("{time}", () => viennaClock(iso));

const tipLines = (iso: string, zone: string): string =>
  zone === viennaZone
    ? fullDateTime(iso, zone)
    : `${fullDateTime(iso, zone)}\n${viennaLine(iso)}`;

export const PostDate = ({ iso }: PostDateProps): ReactElement => {
  const tipId = useId();
  const label = useSyncExternalStore(
    subscribeClock,
    () => dateLabel(iso, new Date(clockNow), readerZone()),
    () => viennaDate(iso)
  );
  const tip = useSyncExternalStore(
    subscribeNever,
    () => tipLines(iso, readerZone()),
    () => tipLines(iso, viennaZone)
  );
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [pinned, setPinned] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const open = hover || focus || pinned;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      setHover(false);
      setFocus(false);
      setPinned(false);
    };
    const onPointerDown = (event: PointerEvent): void => {
      if (
        event.target instanceof Node &&
        rootRef.current?.contains(event.target)
      ) {
        return;
      }
      setHover(false);
      setPinned(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <span
      className="post-date"
      data-open={open ? "" : undefined}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHover(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setHover(false);
      }}
      ref={rootRef}
    >
      <button
        aria-describedby={tipId}
        className="post-date-trigger focus-ring"
        onBlur={() => {
          setFocus(false);
        }}
        onClick={() => {
          setPinned((value) => !value);
        }}
        onFocus={(event) => {
          if (event.currentTarget.matches(":focus-visible")) setFocus(true);
        }}
        type="button"
      >
        <time dateTime={iso}>{label}</time>
      </button>
      <span className="contact-tip post-date-tip" id={tipId} role="tooltip">
        {tip}
      </span>
    </span>
  );
};
