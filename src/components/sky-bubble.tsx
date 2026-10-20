import {
  type CSSProperties,
  type ReactElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { Icon } from "@/components/icon";
import { LiveStatus } from "@/components/live-status";
import { isCrawler } from "@/lib/crawler";
import { en } from "@/lib/i18n";
import { prefersLightLoad } from "@/lib/save-data";
import {
  type Arrow,
  askDelayMs,
  askPosition,
  chooseBox,
  currentSpot,
  deniedMs,
  doneMs,
  forcedCity,
  hintLabel,
  markAsked,
  mayAsk,
  parseWhere,
  type Rect,
  type SkySpot,
  spotEvent,
  wasAsked,
  type WhereHint,
} from "@/lib/sky-ask";
import {
  choosePlace,
  placeOverride,
  readPlace,
  type SkyPlace,
} from "@/lib/sky-place";
import { instantOverride } from "@/lib/sky-sun";
import { fillText } from "@/lib/template";
import { weatherOverride, weatherWord } from "@/lib/weather";
import { browserWeatherDeps, loadWeather } from "@/lib/weather-client";

interface Placed {
  arrow: Arrow;
  arrowX: number;
  left: number;
  top: number;
}

type View =
  | { city: null | string; phase: "ask" | "asking" }
  | { line: string; phase: "done" }
  | { phase: "denied" }
  | { phase: "gone" };

const noSpot: SkySpot = { kind: "none", radius: 0, x: 0, y: 0 };
const arrowInset = 18;
const textSelector =
  "[data-card] h1, [data-card] .bio, [data-card] .card-footer .tabular";
const linkSelector = "[data-card] a, [data-card] button";

const cardRects = (): { controls: Rect[]; texts: Rect[] } => {
  const range = document.createRange();
  const texts: Rect[] = [];
  const controls: Rect[] = [];
  for (const node of document.querySelectorAll(textSelector)) {
    range.selectNodeContents(node);
    texts.push(range.getBoundingClientRect());
  }
  for (const node of document.querySelectorAll(linkSelector)) {
    controls.push(node.getBoundingClientRect());
  }
  const shown = (rect: Rect): boolean =>
    rect.right > rect.left && rect.bottom > rect.top;
  return {
    controls: controls.filter((rect) => shown(rect)),
    texts: texts.filter((rect) => shown(rect)),
  };
};

const questionOf = (city: null | string): string =>
  city === null ? en.sky.askPlain : fillText(en.sky.askCity, { city });

export const SkyBubble = (): null | ReactElement => {
  const [view, setView] = useState<View>({ phase: "gone" });
  const [spot, setSpot] = useState<SkySpot | undefined>(currentSpot);
  const [placed, setPlaced] = useState<Placed>();
  const [tick, setTick] = useState(0);
  const node = useRef<HTMLElement>(null);
  const hint = useRef<undefined | WhereHint>(undefined);
  const round = useRef(0);
  const endTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { phase } = view;

  const end = (): void => {
    round.current += 1;
    clearTimeout(endTimer.current);
    markAsked();
    setView({ phase: "gone" });
  };

  const endLater = (ms: number): void => {
    clearTimeout(endTimer.current);
    endTimer.current = setTimeout(end, ms);
  };

  useEffect(() => {
    if (isCrawler(navigator.userAgent)) return;
    const forced = forcedCity(location.search);
    const abort = new AbortController();
    let alive = true;
    let started = false;
    let askTimer: ReturnType<typeof setTimeout> | undefined;

    const decide = async (): Promise<void> => {
      if (forced !== undefined) {
        setView({ city: forced, phase: "ask" });
        return;
      }
      const open = mayAsk({
        asked: wasAsked(),
        crawler: false,
        home: true,
        lightLoad: prefersLightLoad(),
        pinned:
          instantOverride(location.search) !== undefined ||
          weatherOverride(location.search) !== undefined ||
          placeOverride(location.search) !== undefined,
        saved: readPlace() !== undefined,
      });
      if (!open) return;
      try {
        const response = await fetch("/where", { signal: abort.signal });
        if (!response.ok) return;
        const reply = parseWhere(await response.json());
        if (!alive || reply?.far !== true) return;
        hint.current = reply;
        setView({ city: reply.city, phase: "ask" });
      } catch {}
    };

    const begin = (): void => {
      if (started || !alive || currentSpot() === undefined) return;
      started = true;
      askTimer = setTimeout(() => {
        void decide();
      }, askDelayMs);
    };

    const onSpot = (): void => {
      setSpot(currentSpot());
      begin();
    };

    const leave = (): void => {
      alive = false;
      clearTimeout(askTimer);
      abort.abort();
    };

    begin();
    globalThis.addEventListener(spotEvent, onSpot);
    document.addEventListener("astro:before-preparation", leave);
    document.addEventListener("astro:before-swap", leave);
    return () => {
      leave();
      globalThis.removeEventListener(spotEvent, onSpot);
      document.removeEventListener("astro:before-preparation", leave);
      document.removeEventListener("astro:before-swap", leave);
      round.current += 1;
      clearTimeout(endTimer.current);
    };
  }, []);

  useEffect(() => {
    if (phase === "gone") return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") end();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [phase]);

  useEffect(() => {
    if (phase === "gone") return;
    const onResize = (): void => {
      setTick((count) => count + 1);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, [phase]);

  useLayoutEffect(() => {
    if (!node.current) return;
    const { height, width } = node.current.getBoundingClientRect();
    const where = spot ?? noSpot;
    const { controls, texts } = cardRects();
    const box = chooseBox(
      where,
      { height: window.innerHeight, width: window.innerWidth },
      { height, width },
      texts,
      controls
    );
    setPlaced({
      arrow: box.arrow,
      arrowX: Math.min(
        Math.max(where.x - box.left, arrowInset),
        width - arrowInset
      ),
      left: box.left,
      top: box.top,
    });
  }, [view, spot, tick]);

  if (view.phase === "gone") return null;

  const show = async (): Promise<void> => {
    if (view.phase !== "ask") return;
    const mine = round.current + 1;
    round.current = mine;
    markAsked();
    setView({ city: view.city, phase: "asking" });
    const found = await askPosition(navigator.geolocation);
    if (round.current !== mine) return;
    if (!found) {
      setView({ phase: "denied" });
      endLater(deniedMs);
      return;
    }
    const place: SkyPlace = {
      kind: "visitor",
      label: hintLabel(found, hint.current),
      ...found,
    };
    choosePlace(place);
    const report = await loadWeather(place, browserWeatherDeps());
    if (round.current !== mine) return;
    setView({
      line: report
        ? fillText(en.sky.done, {
            place: place.label,
            weather: en.sky.weather[weatherWord(report.code)],
          })
        : fillText(en.sky.doneQuiet, { place: place.label }),
      phase: "done",
    });
    endLater(doneMs);
  };

  const line =
    view.phase === "done"
      ? view.line
      : view.phase === "denied"
        ? en.sky.denied
        : `${en.sky.askLead} ${questionOf(view.city)}`;
  const style: CSSProperties & Record<"--arrow-x", string> = {
    "--arrow-x": `${String(placed?.arrowX ?? 0)}px`,
    left: placed?.left ?? 0,
    top: placed?.top ?? 0,
    visibility: placed ? undefined : "hidden",
  };

  return (
    <aside
      aria-label={en.sky.label}
      className="sky-bubble mat-pop"
      data-arrow={placed?.arrow === "none" ? undefined : placed?.arrow}
      ref={node}
      style={style}
    >
      <LiveStatus text={line} />
      <p aria-hidden="true" className="sky-bubble-line">
        {line}
      </p>
      {view.phase === "done" && (
        <p className="sky-bubble-note">{en.sky.note}</p>
      )}
      {(view.phase === "ask" || view.phase === "asking") && (
        <div className="sky-bubble-actions">
          <button
            className="motion-switch-button focus-ring"
            disabled={view.phase === "asking"}
            onClick={() => {
              void show();
            }}
            type="button"
          >
            <Icon aria-hidden name="lucide:map-pin" />
            {en.sky.show}
          </button>
          <button
            className="motion-switch-button focus-ring"
            onClick={end}
            type="button"
          >
            {en.sky.keep}
          </button>
        </div>
      )}
      {view.phase === "done" && (
        <div className="sky-bubble-actions">
          <button
            className="motion-switch-button focus-ring"
            onClick={() => {
              choosePlace(undefined);
              end();
            }}
            type="button"
          >
            {en.sky.back}
          </button>
        </div>
      )}
    </aside>
  );
};
