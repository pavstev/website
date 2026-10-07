import type { ReactElement } from "react";

interface ViennaArmsProps {
  className?: string;
  idPrefix: string;
  label?: string;
}

const shield = "M3 3h34v21c0 10.5-7.4 17.4-17 21C10.4 41.4 3 34.5 3 24z";

export const ViennaArms = ({
  className = "",
  idPrefix,
  label,
}: ViennaArmsProps): ReactElement => (
  <svg
    aria-hidden={label ? undefined : true}
    aria-label={label}
    className={`vienna-arms ${className}`.trim()}
    role={label ? "img" : undefined}
    viewBox="0 0 40 48"
  >
    <defs>
      <clipPath id={`${idPrefix}-clip`}>
        <path d={shield} />
      </clipPath>
      <linearGradient id={`${idPrefix}-field`} x1="0" x2="0.35" y1="0" y2="1">
        <stop className="arms-field-light" offset="0" />
        <stop className="arms-field-dark" offset="1" />
      </linearGradient>
      <linearGradient id={`${idPrefix}-cross`} x1="0" x2="1" y1="0" y2="1">
        <stop className="arms-cross-light" offset="0" />
        <stop className="arms-cross-dark" offset="1" />
      </linearGradient>
      <linearGradient id={`${idPrefix}-sheen`} x1="0" x2="1" y1="0" y2="1">
        <stop className="arms-sheen-on" offset="0" />
        <stop className="arms-sheen-off" offset="0.5" />
      </linearGradient>
    </defs>
    <g clipPath={`url(#${idPrefix}-clip)`}>
      <rect fill={`url(#${idPrefix}-field)`} height="48" width="40" />
      <rect
        className="arms-cross-shadow"
        height="48"
        width="7"
        x="17.4"
        y="1.2"
      />
      <rect
        className="arms-cross-shadow"
        height="7"
        width="40"
        x="0.9"
        y="15.2"
      />
      <rect fill={`url(#${idPrefix}-cross)`} height="48" width="7" x="16.5" />
      <rect fill={`url(#${idPrefix}-cross)`} height="7" width="40" y="14" />
      <rect fill={`url(#${idPrefix}-sheen)`} height="48" width="40" />
      <rect className="arms-glint" height="60" width="9" x="-14" y="-6" />
    </g>
    <path className="arms-bevel" d={shield} fill="none" />
  </svg>
);
