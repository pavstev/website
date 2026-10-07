import type { ReactElement } from "react";

import { cityPanelId, cityStrings } from "@/lib/city";
import { personalData } from "@/lib/personal";

export const CityTrigger = (): ReactElement => (
  <button
    aria-haspopup="dialog"
    aria-label={cityStrings.title}
    className="city-trigger focus-ring"
    data-city-trigger=""
    popoverTarget={cityPanelId}
    type="button"
  >
    <span className="city-name">{personalData.city}</span>
  </button>
);
