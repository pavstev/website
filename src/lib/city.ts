import { en } from "@/lib/i18n";
import { personalData } from "@/lib/personal";

export const cityPanelId = "city-panel";

const cityText = (template: string): string =>
  template
    .replaceAll("{city}", () => personalData.city)
    .replaceAll("{country}", () => personalData.country);

export const cityStrings = {
  armsLabel: cityText(en.city.armsLabel),
  citiesLabel: en.city.citiesLabel,
  citiesSource: en.city.citiesSource,
  close: en.card.close,
  facts: cityText(en.city.facts),
  failed: en.city.failed,
  globeLabel: cityText(en.city.globeLabel),
  hint: en.city.hint,
  hintTouch: en.city.hintTouch,
  launch: en.city.launch,
  loading: en.city.loading,
  percent: en.city.percent,
  reload: en.city.reload,
  reset: cityText(en.city.reset),
  retry: en.city.retry,
  title: cityText(en.city.title),
  unsupported: en.city.unsupported,
  zoomIn: en.city.zoomIn,
  zoomOut: en.city.zoomOut,
} as const;
