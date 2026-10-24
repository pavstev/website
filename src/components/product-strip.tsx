import type { CSSProperties, ReactElement } from "react";

import { CompoundText } from "@/components/compound-text";
import { Icon } from "@/components/icon";
import { ProductMark } from "@/components/product-mark";
import { type Product, productHost, productMeta } from "@/lib/products";

interface ProductStripProps {
  newTabId: string;
  products: readonly Product[];
}

export const ProductStrip = ({
  newTabId,
  products,
}: ProductStripProps): ReactElement => (
  <ol className="work-products" data-products="">
    {products.map((product, index) => (
      <li
        className="post-row work-product mat-panel"
        key={product.url}
        style={{ "--lang": product.palette.tint } as CSSProperties}
      >
        <h3 className="post-row-title work-card-name">
          <a
            aria-describedby={`${newTabId} product-line-${String(index)}`}
            className="post-row-link focus-ring"
            href={product.url}
            rel="noopener noreferrer"
            target="_blank"
          >
            {product.name}
          </a>
        </h3>
        <ProductMark productKey={product.key} />
        <p className="post-row-text" id={`product-line-${String(index)}`}>
          <CompoundText text={product.line} />
        </p>
        <p className="work-product-facts">
          {productMeta(product)} · {product.platform}
        </p>
        <p className="work-product-host">
          {productHost(product)}
          <Icon aria-hidden name="lucide:arrow-up-right" size="0.875rem" />
        </p>
      </li>
    ))}
  </ol>
);
