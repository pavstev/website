import type { CSSProperties, ReactElement } from "react";

import { CompoundText } from "@/components/compound-text";
import { ProductMark } from "@/components/product-mark";
import { type Product, productMetaParts } from "@/lib/products";

interface ProductStripProps {
  newTabId: string;
  products: readonly Product[];
}

export const ProductStrip = ({
  newTabId,
  products,
}: ProductStripProps): ReactElement => (
  <ul className="product-grid" data-products="">
    {products.map((product) => {
      const [role, period] = productMetaParts(product);
      return (
        <li className="min-w-0" key={product.key}>
          <div
            className="repo-tile product-tile mat-row"
            style={{ "--lang": product.palette.tint } as CSSProperties}
          >
            <ProductMark productKey={product.key} />
            <div className="repo-body">
              <div className="product-top">
                <a
                  aria-describedby={`${newTabId} product-line-${product.key}`}
                  className="repo-name repo-link"
                  href={product.url}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {product.name}
                </a>
                <span className="product-meta">
                  <span className="whitespace-nowrap">{role}</span>{" "}
                  <span className="whitespace-nowrap">{period}</span>
                </span>
              </div>
              <p
                className="repo-desc product-line"
                id={`product-line-${product.key}`}
              >
                <CompoundText text={product.line} />
              </p>
            </div>
          </div>
        </li>
      );
    })}
  </ul>
);
