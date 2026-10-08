import type { CSSProperties, ReactElement } from "react";

import { ProductMark } from "@/components/product-mark";
import { en } from "@/lib/i18n";
import { type Product, productMetaParts } from "@/lib/products";

const plural = new Intl.PluralRules("en");

const headingFor = (count: number): string =>
  (plural.select(count) === "one"
    ? en.products.headingOne
    : en.products.headingOther
  ).replace("{count}", () => String(count));

interface ProductStripProps {
  newTabId: string;
  products: readonly Product[];
}

export const ProductStrip = ({
  newTabId,
  products,
}: ProductStripProps): null | ReactElement => {
  if (products.length === 0) return null;
  return (
    <section
      aria-labelledby="products-heading"
      className="strip"
      data-products=""
    >
      <div className="repo-head text-halo">
        <h2 className="repo-heading type-eyebrow" id="products-heading">
          {headingFor(products.length)}
        </h2>
        <span aria-hidden="true" className="repo-rule" />
      </div>
      <ul className="product-grid">
        {products.map((product) => {
          const [role, period] = productMetaParts(product);
          return (
            <li className="min-w-0" key={product.key}>
              <div
                className="repo-tile product-tile"
                data-pointer-light=""
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
                    {product.line}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
