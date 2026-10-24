import { type Preview } from "./sky-preview.ts";

export type MinePlan = "ask" | "keep" | "restore";

export type SkyTab = "custom" | "mine" | "stevan";

export const skyTabs: readonly SkyTab[] = ["stevan", "mine", "custom"];

export const startTab = (preview: Preview, visitor: boolean): SkyTab => {
  if (preview.time !== undefined || preview.weather !== undefined) {
    return "custom";
  }
  return visitor ? "mine" : "stevan";
};

export const moveTab = (key: string, from: SkyTab): SkyTab | undefined => {
  const last = skyTabs.length - 1;
  const index = skyTabs.indexOf(from);
  const targets: Readonly<Record<string, number>> = {
    ArrowLeft: index === 0 ? last : index - 1,
    ArrowRight: index === last ? 0 : index + 1,
    End: last,
    Home: 0,
  };
  return Object.hasOwn(targets, key) ? skyTabs[targets[key] ?? 0] : undefined;
};

export const minePlan = (visitor: boolean, earlier: boolean): MinePlan => {
  if (visitor) return "keep";
  return earlier ? "restore" : "ask";
};
