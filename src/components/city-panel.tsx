import type { ReactElement } from "react";

import { CityGlobeLauncher } from "@/components/city-globe-launcher";
import { CityHeading } from "@/components/city-heading";
import { Icon } from "@/components/icon";
import { TopicPanel } from "@/components/topic-panel";
import { cityPanelId, cityStrings } from "@/lib/city";

const titleId = "city-title";
const globeTitleId = "city-globe-title";

export const CityPanel = (): ReactElement => (
  <TopicPanel
    heading={<CityHeading idPrefix="arms-panel" titleId={titleId} />}
    id={cityPanelId}
    text={cityStrings.facts}
    titleId={titleId}
    topic="city"
  >
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
  </TopicPanel>
);
