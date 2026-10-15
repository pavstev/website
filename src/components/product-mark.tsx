import type { CSSProperties, ReactElement } from "react";

import type { ProductKey } from "@/lib/products";

import { productMarks } from "@/lib/product-marks";
import { productPalette } from "@/lib/theme";

export const ProductMark = ({
  productKey,
}: {
  productKey: ProductKey;
}): ReactElement => {
  const { layers, transform, viewBox } = productMarks[productKey];
  const { accent, disc, mark } = productPalette[productKey];
  return (
    <span
      aria-hidden="true"
      className="logo-planet"
      data-logo={productKey}
      style={
        {
          "--logo-accent": accent,
          "--logo-disc": disc,
          "--logo-mark": mark,
        } as CSSProperties
      }
    >
      <svg focusable="false" viewBox={viewBox}>
        <circle cx="50%" cy="50%" r="50%" />
        <g
          transform={`translate(${String(transform.x)} ${String(transform.y)}) scale(${String(transform.scale)})`}
        >
          {layers.map((layer) => (
            <path d={layer.d} data-ink={layer.ink} key={layer.d} />
          ))}
        </g>
      </svg>
    </span>
  );
};
