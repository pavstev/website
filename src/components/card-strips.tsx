import type { ReactElement } from "react";

import type { Repo } from "@/lib/github";
import type { Product } from "@/lib/products";

import { ProductStrip } from "@/components/product-strip";
import { RepoPlanetsCanvas } from "@/components/repo-planets-canvas";
import { RepoStrip } from "@/components/repo-strip";
import { en } from "@/lib/i18n";

const newTabId = "strips-new-tab";

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
  >
    <span hidden id={newTabId}>
      {en.repos.newTab}
    </span>
    <RepoStrip newTabId={newTabId} repos={repos} />
    <ProductStrip newTabId={newTabId} products={products} />
    <RepoPlanetsCanvas />
  </div>
);
