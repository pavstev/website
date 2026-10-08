import type { CSSProperties, ReactElement } from "react";

import type { Repo } from "@/lib/github";
import type { Product } from "@/lib/products";

import { ProductStrip } from "@/components/product-strip";
import { RepoPlanetsCanvas } from "@/components/repo-planets-canvas";
import { RepoStrip } from "@/components/repo-strip";
import { en } from "@/lib/i18n";

const newTabId = "strips-new-tab";

const stripRows = (repos: number, products: number): CSSProperties =>
  ({
    "--pair-rows": Math.max(1, Math.ceil(products / 2)),
    "--product-rows": Math.max(1, products),
    "--repo-rows": Math.max(1, repos),
    "--rows": Math.max(1, repos, products),
  }) as CSSProperties;

interface CardStripsProps {
  products: readonly Product[];
  repos: Repo[];
}

export const CardStrips = ({
  products,
  repos,
}: CardStripsProps): ReactElement => (
  <div
    className="card-strips fade-up mt-(--card-gap-repos) w-full min-w-0 text-left delay-3"
    data-strips=""
    style={stripRows(repos.length, products.length)}
  >
    <span hidden id={newTabId}>
      {en.repos.newTab}
    </span>
    <RepoStrip newTabId={newTabId} repos={repos} />
    <ProductStrip newTabId={newTabId} products={products} />
    <RepoPlanetsCanvas />
  </div>
);
