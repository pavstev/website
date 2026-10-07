import type { ReactElement } from "react";

import { iconData } from "@/lib/icon-data";

interface IconProps {
  "aria-hidden"?: boolean;
  "aria-label"?: string;
  className?: string;
  name: string;
  size?: number | string;
}

export const Icon = ({
  "aria-hidden": ariaHidden,
  "aria-label": ariaLabel,
  className = "",
  name,
  size = "1em",
}: IconProps): ReactElement => {
  const data = iconData[name];
  if (!data) throw new Error(`Unknown icon "${name}"`);
  return (
    <svg
      aria-hidden={ariaHidden}
      aria-label={ariaLabel}
      className={`inline-block shrink-0 ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: data.body }}
      height={size}
      viewBox={`0 0 ${data.width} ${data.height}`}
      width={size}
    />
  );
};
