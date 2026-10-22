import { smoothstep } from "../math.ts";
import { storyPalette } from "../theme.ts";

export const dotPitch = 0.125;
export const dotRadius = 0.8;
export const dotFadeFrom = 4;
export const dotFadeTo = 7;
export const dotDepthMin = 0.6;
export const dotDepthSpan = 0.08;
export const dotGain = storyPalette.dot / storyPalette.face;

export const dotSpacingFade = (spacing: number): number =>
  smoothstep(dotFadeFrom, dotFadeTo, spacing);

export const dotDepthFade = (clipZ: number): number =>
  dotDepthMin +
  (1 - dotDepthMin) * (1 - smoothstep(-dotDepthSpan, dotDepthSpan, clipZ));
