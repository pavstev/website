"use client";

import {
  type ReactElement,
  type ReactNode,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { en } from "@/lib/i18n";
import { skyPhase } from "@/lib/sky-clock";
import {
  currentWeather,
  isWeatherState,
  subscribeWeather,
  weatherLicenseUrl,
  weatherSourceUrl,
} from "@/lib/weather";
import {
  conditionOfCode,
  conditionOfState,
  iconOf,
  reportOf,
  type WeatherCondition,
  type WeatherIconName,
} from "@/lib/weather-report";

const unsubscribe = (): void => undefined;

const subscribeNothing = (): (() => void) => unsubscribe;

const presetOf = (): undefined | WeatherCondition => {
  const state = new URLSearchParams(globalThis.location.search).get("weather");
  return state !== null && isWeatherState(state)
    ? conditionOfState(state)
    : undefined;
};

const noPreset = (): undefined => undefined;

const isDay = (): boolean => skyPhase(new Date()).day >= 0.5;

const alwaysDay = (): boolean => true;

interface WeatherBadgeLiveProps {
  icons: Record<WeatherIconName, ReactNode>;
}

const tipId = "weather-tip";

const noWeather = (): undefined => undefined;

export const WeatherBadgeLive = ({
  icons,
}: WeatherBadgeLiveProps): ReactElement => {
  const live = useSyncExternalStore(
    subscribeWeather,
    currentWeather,
    noWeather
  );
  const preset = useSyncExternalStore(subscribeNothing, presetOf, noPreset);
  const day = useSyncExternalStore(subscribeNothing, isDay, alwaysDay);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const itemRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      const item = itemRef.current;
      if (!item) return;
      if (!(open || item.matches(":hover") || item.matches(":focus-within"))) {
        return;
      }

      setOpen(false);
      setDismissed(true);
    };
    const onPointerDown = (event: PointerEvent): void => {
      if (
        open &&
        event.target instanceof Node &&
        !itemRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const report = live && !preset ? reportOf(live) : undefined;
  const condition: WeatherCondition =
    preset ?? (live ? conditionOfCode(live.code) : undefined) ?? "partly";
  const temperature = report?.temperature;

  return (
    <span
      className="weather-item"
      data-dismissed={dismissed ? "" : undefined}
      data-open={open ? "" : undefined}
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget)) {
          return;
        }

        setDismissed(false);
        setOpen(false);
      }}
      onPointerLeave={() => {
        setDismissed(false);
      }}
      ref={itemRef}
    >
      <button
        aria-controls={tipId}
        aria-describedby={tipId}
        aria-expanded={open}
        className="weather-now focus-ring"
        onClick={() => {
          setDismissed(false);
          setOpen((value) => !value);
        }}
        type="button"
      >
        <span aria-hidden="true" className="weather-icon">
          {icons[iconOf(condition, day)]}
        </span>
        <span className="sr-only">{en.weather.badge} </span>
        {temperature ? (
          <span className="weather-temp tabular">{temperature}</span>
        ) : null}
      </button>
      <a
        className="weather-source focus-ring"
        href={weatherSourceUrl}
        rel="nofollow noopener noreferrer"
        target="_blank"
      >
        {en.weather.sourceShort}
        <span className="sr-only"> {en.card.newTab}</span>
      </a>
      <span className="contact-tip weather-tip" id={tipId} role="tooltip">
        <span className="weather-tip-title">{en.weather.now}</span>
        <span className="weather-tip-line">
          {en.weather.conditions[condition]}
          {temperature ? `, ${temperature}` : ""}
        </span>
        {report ? (
          <span className="weather-tip-line">
            {en.weather.wind
              .replace("{speed}", () => report.wind.speed)
              .replace("{from}", () => report.wind.from)}
          </span>
        ) : null}
        {report?.precipitation ? (
          <span className="weather-tip-line">
            {en.weather[report.precipitation.kind].replace(
              "{amount}",
              () => report.precipitation?.amount ?? ""
            )}
          </span>
        ) : null}
        <span className="weather-tip-credit">
          {en.weather.credit} {en.weather.source}
          <span aria-hidden="true"> · </span>
          <a
            className="focus-ring"
            href={weatherLicenseUrl}
            rel="license nofollow noopener noreferrer"
            target="_blank"
          >
            {en.weather.license}
            <span className="sr-only"> {en.card.newTab}</span>
          </a>
        </span>
      </span>
    </span>
  );
};
