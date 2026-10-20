import {
  type ComponentType,
  lazy,
  type ReactElement,
  Suspense,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { flushSync } from "react-dom";

import type { SkyGlobeProps } from "@/components/sky-globe";

import { Icon } from "@/components/icon";
import { MotionSwitch } from "@/components/motion-switch";
import { SkyRange } from "@/components/sky-range";
import { initAnchoredPopovers } from "@/lib/anchored-popovers";
import { isCrawler } from "@/lib/crawler";
import { en } from "@/lib/i18n";
import { countryName } from "@/lib/place-name";
import { placeSource } from "@/lib/place-source";
import {
  askPosition,
  deniedMs,
  fetchWhere,
  placeFromWhere,
} from "@/lib/sky-ask";
import { placeZone } from "@/lib/sky-clock";
import {
  choosePlace,
  chosenPlace,
  coordinateLabel,
  isPlace,
  namePlace,
  placeEvent,
  placeNamedEvent,
  type SkyPlace,
  startPlace,
  viennaPlace,
} from "@/lib/sky-place";
import {
  clockLabel,
  hourLabel,
  liveWeather,
  liveWeatherEvent,
  minutesToStep,
  type Preview,
  previewEvent,
  previewState,
  resetPreview,
  setPreviewTime,
  setPreviewWeather,
  shownTime,
  shownWeather,
  stepToMinutes,
} from "@/lib/sky-preview";
import {
  hourLabelMarks,
  hourTicks,
  plainKey,
  skyRanges,
  snapStop,
  stepCount,
  stopBlend,
  timeKeyStep,
  timePageStep,
  weatherLabelMarks,
  weatherSteps,
  weatherTicks,
} from "@/lib/sky-range";
import { instantOverride } from "@/lib/sky-sun";
import { minePlan, moveTab, type SkyTab, startTab } from "@/lib/sky-tabs";
import { fillText } from "@/lib/template";
import { weatherNameOverride } from "@/lib/weather";

type Notice = "failed" | "precise" | undefined;

const panelId = "sky-panel";

const tabs: ReadonlyArray<{ icon: string; label: string; tab: SkyTab }> = [
  { icon: "lucide:map-pin", label: en.sky.owner, tab: "stevan" },
  { icon: "lucide:globe", label: en.sky.mine, tab: "mine" },
  { icon: "lucide:sliders-horizontal", label: en.sky.custom, tab: "custom" },
];

const idlePreview: Preview = { time: undefined, weather: undefined };

const subscribePreview = (notify: () => void): (() => void) => {
  globalThis.addEventListener(previewEvent, notify);
  return () => {
    globalThis.removeEventListener(previewEvent, notify);
  };
};

const serverPreview = (): Preview => idlePreview;

const subscribeLiveWeather = (notify: () => void): (() => void) => {
  globalThis.addEventListener(liveWeatherEvent, notify);
  return () => {
    globalThis.removeEventListener(liveWeatherEvent, notify);
  };
};

const hourLabels = hourLabelMarks.map(({ mark, value }) => ({
  content: hourLabel(mark),
  value,
}));

const weatherLabels = weatherLabelMarks.map(({ mark, value }) => ({
  content: <Icon aria-hidden name={skyRanges.weather.icons[mark]} />,
  value,
}));

const subscribe = (notify: () => void): (() => void) => {
  globalThis.addEventListener(placeEvent, notify);
  globalThis.addEventListener(placeNamedEvent, notify);
  return () => {
    globalThis.removeEventListener(placeEvent, notify);
    globalThis.removeEventListener(placeNamedEvent, notify);
  };
};

const loadGlobe = async (): Promise<{
  default: ComponentType<SkyGlobeProps>;
}> => {
  const { SkyGlobe: component } = await import("@/components/sky-globe");
  return { default: component };
};

const SkyGlobe = lazy(loadGlobe);

const snapshot = (): string =>
  JSON.stringify(
    chosenPlace() ?? startPlace(location.search, isCrawler(navigator.userAgent))
  );

const serverSnapshot = (): string => JSON.stringify(viennaPlace);

const placeOf = (raw: string): SkyPlace => {
  const data: unknown = JSON.parse(raw);
  return isPlace(data) ? data : viennaPlace;
};

let earlierMine: SkyPlace | undefined;

export const SkyControls = (): ReactElement => {
  const raw = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const place = placeOf(raw);
  const preview = useSyncExternalStore(
    subscribePreview,
    previewState,
    serverPreview
  );
  const liveName = useSyncExternalStore(
    subscribeLiveWeather,
    liveWeather,
    () => undefined
  );
  const [tab, setTab] = useState<SkyTab>("stevan");
  const [focusTab, setFocusTab] = useState<SkyTab>("stevan");
  const [notice, setNotice] = useState<Notice>();
  const [asking, setAsking] = useState(false);
  const [finding, setFinding] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [clock, setClock] = useState({ now: 0, search: "" });
  const { country, kind, lat, lon } = place;
  const alive = useRef(true);
  const round = useRef(0);
  const root = useRef<HTMLSpanElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const tabButtons = useRef<Partial<Record<SkyTab, HTMLButtonElement>>>({});
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const titleId = useId();
  const baseId = useId();
  const timeId = useId();
  const weatherId = useId();

  useEffect(() => {
    alive.current = true;
    const stop = root.current ? initAnchoredPopovers(root.current) : undefined;
    const read = (): void => {
      setClock({ now: Date.now(), search: location.search });
    };
    const open = (): void => {
      const next = startTab(
        previewState(),
        placeOf(snapshot()).kind === "visitor"
      );
      setTab(next);
      setFocusTab(next);
    };
    read();
    open();
    const node = panel.current;
    let tick: ReturnType<typeof setInterval> | undefined;
    const onToggle = (): void => {
      read();
      clearInterval(tick);
      const isOpen = node?.matches(":popover-open") ?? false;
      setPanelOpen(isOpen);
      tick = isOpen ? setInterval(read, 60_000) : undefined;
    };
    const onBefore = (event: Event): void => {
      if ((event as ToggleEvent).newState === "open") flushSync(open);
    };
    node?.addEventListener("beforetoggle", onBefore);
    node?.addEventListener("toggle", onToggle);
    return () => {
      alive.current = false;
      clearTimeout(timer.current);
      clearInterval(tick);
      node?.removeEventListener("beforetoggle", onBefore);
      node?.removeEventListener("toggle", onToggle);
      stop?.();
    };
  }, []);

  useEffect(() => {
    const current = placeOf(raw);
    if (current.kind === "visitor") earlierMine = current;
  }, [raw]);

  useEffect(() => {
    if (kind !== "visitor" || country) return;
    let live = true;
    void placeSource.lookup({ lat, lon }).then((found) => {
      if (live && found) namePlace({ lat, lon }, found);
    });
    return () => {
      live = false;
    };
  }, [country, kind, lat, lon]);

  const flash = (next: Notice): void => {
    setNotice(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setNotice(undefined);
    }, deniedMs);
  };

  const askForPrecise = async (): Promise<void> => {
    const mine = round.current;
    setAsking(true);
    const found = await askPosition(navigator.geolocation);
    if (!alive.current) return;
    setAsking(false);
    if (round.current !== mine) return;
    if (!found) {
      flash("precise");
      return;
    }
    choosePlace({ kind: "visitor", label: coordinateLabel(found), ...found });
  };

  const enterMine = async (mine: number): Promise<void> => {
    const plan = minePlan(kind === "visitor", earlierMine !== undefined);
    if (plan === "keep") return;
    if (plan === "restore") {
      choosePlace(earlierMine);
      return;
    }
    setFinding(true);
    const found = placeFromWhere(await fetchWhere());
    if (!alive.current) return;
    setFinding(false);
    if (round.current !== mine || placeOf(snapshot()).kind === "visitor") {
      return;
    }
    if (found) {
      choosePlace(found);
    } else {
      flash("failed");
    }
  };

  const selectTab = (next: SkyTab): void => {
    setFocusTab(next);
    if (next === tab) {
      if (next === "mine" && kind !== "visitor" && !finding) {
        round.current += 1;
        setNotice(undefined);
        void enterMine(round.current);
      }
      return;
    }
    round.current += 1;
    setTab(next);
    setNotice(undefined);
    if (next === "custom") return;
    resetPreview();
    if (next === "stevan") {
      choosePlace(undefined);
      return;
    }
    void enterMine(round.current);
  };

  const visitor = kind === "visitor";
  const city = country
    ? fillText(en.sky.named, {
        city: place.label,
        country: countryName(country),
      })
    : undefined;
  const shown = shownTime(
    preview.time,
    instantOverride(clock.search),
    clock.now,
    placeZone(place)
  );
  const timeText = clockLabel(shown.minutes);
  const weather = shownWeather(
    preview.weather,
    weatherNameOverride(clock.search),
    liveName
  );
  const blend = stopBlend(weather.stop);
  const weatherName = Number.isSafeInteger(weather.stop)
    ? en.sky.weatherStops[blend.share > 0 ? blend.to : blend.from]
    : fillText(en.sky.weatherBetween, {
        from: en.sky.weatherStops[blend.from],
        to: en.sky.weatherStops[blend.to],
      });
  const noticeText =
    notice === "precise"
      ? en.sky.preciseDenied
      : notice === "failed"
        ? en.sky.whereFailed
        : en.sky.note;

  const readout = (
    <p className="sky-readout">
      <span className="sky-live">{en.sky.live}</span>
      <span>
        {fillText(en.sky.readout, { time: timeText, weather: weatherName })}
      </span>
    </p>
  );

  return (
    <span className="sky-controls" data-nosnippet="" ref={root}>
      <button
        aria-expanded="false"
        aria-haspopup="dialog"
        aria-label={en.sky.pillName}
        className="sky-trigger focus-ring"
        popoverTarget={panelId}
        type="button"
      >
        <span aria-hidden="true" className="sky-trigger-shine" />
        <span aria-hidden="true" className="sky-trigger-icon">
          <Icon aria-hidden name="lucide:sun-moon" />
        </span>
        <span className="sky-trigger-text">{en.sky.pill}</span>
        <Icon
          aria-hidden
          className="sky-trigger-chevron"
          name="lucide:chevron-down"
        />
      </button>
      <div
        aria-labelledby={titleId}
        className="sky-panel mat-pop"
        data-anchored=""
        data-placement="top"
        id={panelId}
        onBlur={(event) => {
          const next = event.relatedTarget;
          if (
            next instanceof Node &&
            !event.currentTarget.contains(next) &&
            !root.current?.querySelector(".sky-trigger")?.contains(next)
          ) {
            event.currentTarget.hidePopover();
          }
        }}
        popover="auto"
        ref={panel}
        role="dialog"
      >
        <p className="sky-panel-title" id={titleId}>
          {en.sky.panelTitle}
        </p>
        <div aria-labelledby={titleId} className="sky-choice" role="tablist">
          {tabs.map((item) => (
            <button
              aria-controls={`${baseId}-panel-${item.tab}`}
              aria-selected={tab === item.tab}
              className="sky-option focus-ring"
              data-initial-focus={tab === item.tab ? "" : undefined}
              id={`${baseId}-tab-${item.tab}`}
              key={item.tab}
              onClick={() => {
                selectTab(item.tab);
              }}
              onFocus={() => {
                setFocusTab(item.tab);
                if (item.tab === "mine") void loadGlobe();
              }}
              onKeyDown={(event) => {
                if (!plainKey(event)) return;
                const next = moveTab(event.key, item.tab);
                if (next === undefined) return;
                event.preventDefault();
                tabButtons.current[next]?.focus();
              }}
              onPointerEnter={() => {
                if (item.tab === "mine") void loadGlobe();
              }}
              ref={(node) => {
                if (node) tabButtons.current[item.tab] = node;
              }}
              role="tab"
              tabIndex={focusTab === item.tab ? 0 : -1}
              type="button"
            >
              <Icon aria-hidden name={item.icon} />
              {item.label}
            </button>
          ))}
        </div>
        <div
          aria-labelledby={`${baseId}-tab-stevan`}
          className="sky-tabpanel focus-ring"
          hidden={tab !== "stevan"}
          id={`${baseId}-panel-stevan`}
          role="tabpanel"
          tabIndex={0}
        >
          {tab === "stevan" && readout}
        </div>
        <div
          aria-labelledby={`${baseId}-tab-mine`}
          className="sky-tabpanel"
          hidden={tab !== "mine"}
          id={`${baseId}-panel-mine`}
          role="tabpanel"
        >
          {tab === "mine" && (
            <>
              {panelOpen && (
                <Suspense
                  fallback={
                    <p aria-busy="true" className="sky-panel-note">
                      {en.sky.globe.loading}
                    </p>
                  }
                >
                  <SkyGlobe
                    label={en.sky.globe.label}
                    onPick={(picked) => {
                      choosePlace({
                        kind: "visitor",
                        label: coordinateLabel(picked),
                        ...picked,
                      });
                    }}
                    spot={{ lat, lon }}
                  />
                </Suspense>
              )}
              <p aria-live="polite" className="sky-panel-place">
                {visitor ? (
                  <>
                    {city && <span className="sky-panel-city">{city}</span>}
                    <span className="sky-panel-coords">
                      {coordinateLabel(place)}
                    </span>
                  </>
                ) : (
                  finding && en.sky.locating
                )}
              </p>
              {visitor && readout}
              <button
                aria-disabled={asking}
                className="sky-precise focus-ring"
                onClick={() => {
                  if (!asking) void askForPrecise();
                }}
                type="button"
              >
                <Icon aria-hidden name="lucide:locate-fixed" />
                {asking ? en.sky.locating : en.sky.precise}
              </button>
              <p aria-live="polite" className="sky-panel-note">
                {noticeText}
              </p>
              {visitor && country && (
                <p className="sky-panel-note">
                  <a
                    className="sky-panel-credit focus-ring"
                    href={en.sky.geonamesUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {en.sky.geonames}
                    <span className="sr-only"> {en.card.newTab}</span>
                  </a>
                </p>
              )}
            </>
          )}
        </div>
        <div
          aria-labelledby={`${baseId}-tab-custom`}
          className="sky-tabpanel"
          hidden={tab !== "custom"}
          id={`${baseId}-panel-custom`}
          role="tabpanel"
        >
          {tab === "custom" && (
            <>
              <p className="sky-panel-note">{en.sky.customNote}</p>
              <div className="sky-row sky-row-time">
                <div className="sky-row-head">
                  <label className="sky-row-label" htmlFor={timeId}>
                    {en.sky.time}
                  </label>
                  <span aria-hidden className="sky-row-value">
                    {timeText}
                  </span>
                </div>
                <SkyRange
                  id={timeId}
                  keyStep={timeKeyStep}
                  labels={hourLabels}
                  max={stepCount}
                  onValue={(step) => {
                    setPreviewTime(stepToMinutes(step));
                  }}
                  pageStep={timePageStep}
                  ticks={hourTicks}
                  value={minutesToStep(shown.minutes)}
                  valueText={
                    shown.live
                      ? fillText(en.sky.timeNowText, { time: timeText })
                      : timeText
                  }
                />
              </div>
              <div className="sky-row">
                <div className="sky-row-head">
                  <label className="sky-row-label" htmlFor={weatherId}>
                    {en.sky.weatherLabel}
                  </label>
                  <span aria-hidden className="sky-row-value">
                    {weatherName}
                  </span>
                </div>
                <SkyRange
                  id={weatherId}
                  keyStep={skyRanges.weather.stepsPerStop}
                  labels={weatherLabels}
                  max={weatherSteps}
                  onValue={(value) => {
                    const stop = snapStop(
                      value / skyRanges.weather.stepsPerStop
                    );
                    if (stop !== weather.stop) setPreviewWeather(stop);
                  }}
                  pageStep={skyRanges.weather.stepsPerStop}
                  ticks={weatherTicks}
                  value={Math.round(
                    weather.stop * skyRanges.weather.stepsPerStop
                  )}
                  valueText={
                    weather.live
                      ? fillText(en.sky.weatherLiveText, {
                          weather: weatherName,
                        })
                      : weatherName
                  }
                />
              </div>
            </>
          )}
        </div>
        <div className="sky-motion">
          <MotionSwitch hint />
        </div>
      </div>
    </span>
  );
};
