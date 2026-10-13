import type { ReactElement, ReactNode } from "react";

import { Icon } from "@/components/icon";
import { WeatherBadgeLive } from "@/components/weather-badge-live";
import { type WeatherIconName, weatherIconNames } from "@/lib/weather-report";

const icons = Object.fromEntries(
  weatherIconNames.map((name) => [
    name,
    <Icon aria-hidden key={name} name={name} size="1rem" />,
  ])
) as Record<WeatherIconName, ReactNode>;

export const WeatherBadge = (): ReactElement => (
  <WeatherBadgeLive icons={icons} />
);
