import { en } from "@/lib/i18n";
import { personalData } from "@/lib/personal";

export const cityPanelId = "city-panel";

const cityText = (template: string): string =>
  template
    .replaceAll("{city}", () => personalData.city)
    .replaceAll("{country}", () => personalData.country);

export const cityStrings = {
  armsLabel: cityText(en.city.armsLabel),
  close: en.card.close,
  facts: cityText(en.city.facts),
  failed: en.city.failed,
  globeLabel: cityText(en.city.globeLabel),
  hint: en.city.hint,
  hubsLabel: en.city.hubsLabel,
  hubsSource: en.city.hubsSource,
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
