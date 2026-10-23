import type { ReactElement } from "react";

import type { StoryKey } from "@/lib/work";

const SkyMark = (): ReactElement => (
  <svg focusable="false" viewBox="0 0 48 48">
    <defs>
      <clipPath id="work-mark-sky-clip">
        <circle cx="24" cy="24" r="24" />
      </clipPath>
      <linearGradient id="work-mark-day" x1="0" x2="0" y1="0" y2="1">
        <stop className="work-mark-day-hi" offset="0" />
        <stop className="work-mark-day-lo" offset="0.7" />
      </linearGradient>
      <linearGradient id="work-mark-night" x1="0" x2="0" y1="0" y2="1">
        <stop className="work-mark-night-hi" offset="0" />
        <stop className="work-mark-night-lo" offset="0.7" />
      </linearGradient>
    </defs>
    <g clipPath="url(#work-mark-sky-clip)">
      <rect fill="url(#work-mark-day)" height="48" width="48" />
      <g className="work-mark-night">
        <rect fill="url(#work-mark-night)" height="48" width="48" />
        <circle className="work-mark-star" cx="10" cy="11" r="0.8" />
        <circle className="work-mark-star" cx="36" cy="8" r="0.6" />
        <circle className="work-mark-star" cx="40" cy="20" r="0.7" />
        <circle className="work-mark-star" cx="17" cy="21" r="0.5" />
      </g>
      <g className="work-mark-wheel">
        <circle className="work-mark-sun" cx="24" cy="13" r="5.5" />
        <g className="work-mark-moon">
          <circle cx="24" cy="51" r="4.5" />
          <circle
            className="work-mark-moon-shade"
            cx="26.2"
            cy="49.6"
            r="3.8"
          />
        </g>
      </g>
      <rect className="work-mark-ground" height="16" width="48" y="32" />
    </g>
  </svg>
);

const BlueprintMark = (): ReactElement => (
  <svg focusable="false" viewBox="0 0 48 48">
    <circle className="work-mark-paper" cx="24" cy="24" r="24" />
    <g className="work-mark-slabs">
      <path className="work-mark-slab" d="M24 33 L36 27 L24 21 L12 27 Z" />
      <path className="work-mark-slab" d="M24 27 L36 21 L24 15 L12 21 Z" />
      <path
        className="work-mark-slab work-mark-slab-top"
        d="M24 21 L36 15 L24 9 L12 15 Z"
      />
    </g>
    <path className="work-mark-lead" d="M24 33 V40" />
  </svg>
);

export const StoryMark = ({ kind }: { kind: StoryKey }): ReactElement => (
  <span aria-hidden="true" className="work-mark" data-mark={kind}>
    {kind === "website" ? <SkyMark /> : <BlueprintMark />}
  </span>
);
