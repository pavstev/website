import type { ReactElement } from "react";

import { CityGlobeLauncher } from "@/components/city-globe-launcher";
import { CityHeading } from "@/components/city-heading";
import { Icon } from "@/components/icon";
import { cityPanelId, cityStrings } from "@/lib/city";

const titleId = "city-title";
const globeTitleId = "city-globe-title";

export const CityPanel = (): ReactElement => (
  <div
    aria-labelledby={titleId}
    className="city-panel"
    data-anchored=""
    id={cityPanelId}
    popover="auto"
    role="dialog"
  >
    <header className="city-head">
      <CityHeading idPrefix="arms-panel" titleId={titleId} />
      <button
        aria-label={cityStrings.close}
        className="city-close focus-ring"
        popoverTarget={cityPanelId}
        popoverTargetAction="hide"
        type="button"
      >
        <Icon aria-hidden name="lucide:x" size="1rem" />
      </button>
    </header>
    <p className="city-text">{cityStrings.facts}</p>
    <CityGlobeLauncher
      closeIcon={<Icon aria-hidden name="lucide:x" size="1rem" />}
      heading={<CityHeading idPrefix="arms-globe" titleId={globeTitleId} />}
      labels={{
        close: cityStrings.close,
        failed: cityStrings.failed,
        launch: cityStrings.launch,
        loading: cityStrings.loading,
        percent: cityStrings.percent,
        reload: cityStrings.reload,
        retry: cityStrings.retry,
        unsupported: cityStrings.unsupported,
      }}
      launchIcon={<Icon aria-hidden name="lucide:globe" size="1rem" />}
      titleId={globeTitleId}
    />
  </div>
);
