import {
  type ReactElement,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import placesUrl from "@/assets/places.txt?url";
import { Icon } from "@/components/icon";
import { MotionSwitch } from "@/components/motion-switch";
import { SkyRange } from "@/components/sky-range";
import { initAnchoredPopovers } from "@/lib/anchored-popovers";
import { isCrawler } from "@/lib/crawler";
import { en } from "@/lib/i18n";
import { createPlaceLookup } from "@/lib/place-lookup";
import { countryName } from "@/lib/place-name";
import { askPosition, deniedMs } from "@/lib/sky-ask";
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
  setPreviewTime,
  setPreviewWeather,
  shownTime,
  shownWeather,
  stepToMinutes,
} from "@/lib/sky-preview";
import {
  hourLabelMarks,
  hourTicks,
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
import { fillText } from "@/lib/template";
import { weatherNameOverride } from "@/lib/weather";

const panelId = "sky-panel";

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

const lookupPlace = createPlaceLookup(async () => {
  const response = await fetch(placesUrl);
  if (!response.ok) throw new Error(String(response.status));
  return response.text();
});

const snapshot = (): string =>
  JSON.stringify(
    chosenPlace() ?? startPlace(location.search, isCrawler(navigator.userAgent))
  );

const serverSnapshot = (): string => JSON.stringify(viennaPlace);

const placeOf = (raw: string): SkyPlace => {
  const data: unknown = JSON.parse(raw);
  return isPlace(data) ? data : viennaPlace;
};

export const SkyControls = (): ReactElement => {
  const place = placeOf(
    useSyncExternalStore(subscribe, snapshot, serverSnapshot)
  );
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
  const [denied, setDenied] = useState(false);
  const [asking, setAsking] = useState(false);
  const [clock, setClock] = useState({ now: 0, search: "" });
  const { country, kind, lat, lon } = place;
  const alive = useRef(true);
  const root = useRef<HTMLSpanElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const titleId = useId();
  const timeId = useId();
  const weatherId = useId();

  useEffect(() => {
    alive.current = true;
    const stop = root.current ? initAnchoredPopovers(root.current) : undefined;
    const read = (): void => {
      setClock({ now: Date.now(), search: location.search });
    };
    read();
    const node = panel.current;
    let tick: ReturnType<typeof setInterval> | undefined;
    const onToggle = (): void => {
      read();
      clearInterval(tick);
      tick = node?.matches(":popover-open")
        ? setInterval(read, 60_000)
        : undefined;
    };
    node?.addEventListener("toggle", onToggle);
    return () => {
      alive.current = false;
      clearTimeout(timer.current);
      clearInterval(tick);
      node?.removeEventListener("toggle", onToggle);
      stop?.();
    };
  }, []);

  useEffect(() => {
    if (kind !== "visitor" || country) return;
    let live = true;
    void lookupPlace({ lat, lon }).then((found) => {
      if (live && found) namePlace({ lat, lon }, found);
    });
    return () => {
      live = false;
    };
  }, [country, kind, lat, lon]);

  const askForMine = async (): Promise<void> => {
    setAsking(true);
    const found = await askPosition(navigator.geolocation);
    if (!alive.current) return;
    setAsking(false);
    if (!found) {
      setDenied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setDenied(false);
      }, deniedMs);
      return;
    }
    choosePlace({ kind: "visitor", label: coordinateLabel(found), ...found });
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
        <div aria-labelledby={titleId} className="sky-choice" role="group">
          <button
            aria-pressed={!visitor}
            className="sky-option focus-ring"
            data-initial-focus=""
            onClick={() => {
              choosePlace(undefined);
            }}
            type="button"
          >
            <Icon aria-hidden name="lucide:map-pin" />
            {en.sky.owner}
          </button>
          <button
            aria-pressed={visitor}
            className="sky-option focus-ring"
            disabled={asking}
            onClick={() => {
              if (!visitor) void askForMine();
            }}
            type="button"
          >
            <Icon aria-hidden name="lucide:locate-fixed" />
            {asking ? en.sky.locating : en.sky.mine}
          </button>
        </div>
        {visitor && (
          <p className="sky-panel-place">
            {city && <span className="sky-panel-city">{city}</span>}
            <span className="sky-panel-coords">{coordinateLabel(place)}</span>
          </p>
        )}
        <p aria-live="polite" className="sky-panel-note">
          {denied ? en.sky.denied : en.sky.note}
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
            thumb="large"
            ticks={hourTicks}
            tickStyle="ruler"
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
          </div>
          <SkyRange
            id={weatherId}
            keyStep={skyRanges.weather.stepsPerStop}
            labels={weatherLabels}
            max={weatherSteps}
            onValue={(value) => {
              const stop = snapStop(value / skyRanges.weather.stepsPerStop);
              if (stop !== weather.stop) setPreviewWeather(stop);
            }}
            pageStep={skyRanges.weather.stepsPerStop}
            tag={weatherName}
            thumb="small"
            ticks={weatherTicks}
            tickStyle="stop"
            value={Math.round(weather.stop * skyRanges.weather.stepsPerStop)}
            valueText={
              weather.live
                ? fillText(en.sky.weatherLiveText, { weather: weatherName })
                : weatherName
            }
          />
        </div>

        <div className="sky-motion">
          <MotionSwitch hint />
        </div>
      </div>
    </span>
  );
};
