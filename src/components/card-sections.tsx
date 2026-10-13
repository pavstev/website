import type { ReactElement } from "react";

import Link from "next/link";

import type { Repo } from "@/lib/github";
import type { Product } from "@/lib/products";

import { CardDrawer } from "@/components/card-drawer";
import { Icon } from "@/components/icon";
import { ProductMark } from "@/components/product-mark";
import { ProductStrip } from "@/components/product-strip";
import { RepoStrip } from "@/components/repo-strip";
import { en } from "@/lib/i18n";
import { personalData } from "@/lib/personal";
import { countHeading } from "@/lib/template";

interface CardSectionsProps {
  products: readonly Product[];
  repos: Repo[];
}

const closeIcon = <Icon aria-hidden name="lucide:x" size="1.125rem" />;

export const CardSections = ({
  products,
  repos,
}: CardSectionsProps): ReactElement => {
  const projectsTitle = countHeading(repos.length, en.repos);
  const productsTitle = countHeading(products.length, en.products);
  return (
    <>
      <ul
        aria-label={en.card.sections}
        className="section-row fade-up relative z-1 mt-(--card-gap-sections) delay-3"
        data-proximity=""
        data-sections=""
      >
        {repos.length > 0 ? (
          <li className="section-item" data-tone="purple">
            <a
              aria-haspopup="dialog"
              className="section-link contact-link focus-ring"
              href="#projects"
            >
              <span aria-hidden="true" className="section-icon">
                <span className="section-planet" />
              </span>
              <span className="section-label">{projectsTitle}</span>
            </a>
          </li>
        ) : null}
        {products.length > 0 ? (
          <li className="section-item" data-tone="green">
            <a
              aria-haspopup="dialog"
              className="section-link contact-link focus-ring"
              href="#products"
            >
              <span aria-hidden="true" className="section-icon section-marks">
                {products.slice(0, 2).map((product) => (
                  <ProductMark key={product.key} productKey={product.key} />
                ))}
              </span>
              <span className="section-label">{productsTitle}</span>
            </a>
          </li>
        ) : null}
        <li className="section-item" data-tone="gold">
          <Link
            className="section-link contact-link focus-ring"
            href="/blog"
            prefetch={false}
          >
            <span aria-hidden="true" className="section-icon contact-icon">
              <Icon name="lucide:notebook-pen" size="1.125rem" />
            </span>
            <span className="section-label">{en.card.blog}</span>
          </Link>
        </li>
      </ul>
      {repos.length > 0 ? (
        <CardDrawer
          closeIcon={closeIcon}
          closeLabel={en.repos.close}
          id="projects"
          title={projectsTitle}
        >
          <span hidden id="projects-new-tab">
            {en.repos.newTab}
          </span>
          <RepoStrip
            allUrl={`${personalData.github}?tab=repositories`}
            newTabId="projects-new-tab"
            repos={repos}
          />
        </CardDrawer>
      ) : null}
      {products.length > 0 ? (
        <CardDrawer
          closeIcon={closeIcon}
          closeLabel={en.products.close}
          id="products"
          title={productsTitle}
        >
          <span hidden id="products-new-tab">
            {en.repos.newTab}
          </span>
          <ProductStrip newTabId="products-new-tab" products={products} />
        </CardDrawer>
      ) : null}
    </>
  );
};
