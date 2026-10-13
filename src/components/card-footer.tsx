import type { ReactElement } from "react";

import { en } from "@/lib/i18n";
import { personalData } from "@/lib/personal";
import { weatherSourceUrl } from "@/lib/weather";

export const CardFooter = (): ReactElement => {
  const year = new Date().getFullYear();
  return (
    <div className="card-footer fade-up mt-(--card-gap-footer) type-chip delay-4">
      <p className="tabular text-sky">
        © {year} <span className="whitespace-nowrap">{personalData.name}</span>
      </p>
      <p className="weather-credit text-sky">
        {en.weather.credit}{" "}
        <a className="focus-ring" href={weatherSourceUrl}>
          {en.weather.source}
        </a>
      </p>
    </div>
  );
};
