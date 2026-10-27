import { type SkyStorySlide } from "../data/website-story.ts";

const chrome = 0.27;

const hoursOf = (clock: string): number =>
  Number(clock.slice(0, 2)) + Number(clock.slice(3, 5)) / 60;

export const skyDialKeyframes = (slides: readonly SkyStorySlide[]): string => {
  const total = slides.reduce((sum, slide) => sum + slide.screens, 0);
  const span = Math.max(total - 1 + chrome, 1);
  let reach = 0;
  let hours = 0;
  const stops = slides.map((slide) => {
    reach += slide.screens;
    if (slide.clock !== undefined) {
      let next = hoursOf(slide.clock);
      while (next < hours) next += 24;
      hours = next;
    }
    const share = Math.min(Math.max((reach - 1) / span, 0), 1) * 100;
    const tone = slide.lamp === "sun" ? "var(--sky-gold)" : "var(--night-100)";
    const angle = (hours - 12) * 15;
    return `${share.toFixed(2)}%{rotate:${angle.toFixed(2)}deg;color:${tone}}`;
  });
  const closing = stops.at(-1);
  const last =
    closing === undefined ? "" : closing.replace(/^[\d.]+%/u, "100%");
  return `@keyframes sky-dial-orbit{${stops.join("")}${last}}`;
};
