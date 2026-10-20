import type { CSSProperties, ReactElement } from "react";

import { CompoundText } from "@/components/compound-text";
import { Icon } from "@/components/icon";
import { ProductMark } from "@/components/product-mark";
import { type Product, productHost } from "@/lib/products";

interface ProductStripProps {
  newTabId: string;
  products: readonly Product[];
}

export const ProductStrip = ({
  newTabId,
  products,
}: ProductStripProps): ReactElement => (
  <ol className="work-products" data-products="">
    {products.map((product) => (
      <li
        className="post-row work-product mat-panel"
        key={product.key}
        style={{ "--lang": product.palette.tint } as CSSProperties}
      >
        <ProductMark productKey={product.key} />
        <div className="work-product-body">
          <h3 className="post-row-title work-card-name">
            <a
              aria-describedby={`${newTabId} product-line-${product.key}`}
              className="post-row-link focus-ring"
              href={product.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              {product.name}
            </a>
          </h3>
          <p className="post-row-text" id={`product-line-${product.key}`}>
            <CompoundText text={product.line} />
          </p>
        </div>
        <div className="work-product-side">
          <span className="work-product-facts">
            <span className="work-product-fact">{product.role}</span>
            <span className="work-product-fact">{product.period}</span>
          </span>
          <span className="work-product-host">
            {productHost(product)}
            <Icon aria-hidden name="lucide:arrow-up-right" size="0.875rem" />
          </span>
        </div>
      </li>
    ))}
  </ol>
);
