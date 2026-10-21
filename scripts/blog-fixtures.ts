import { copyFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { fixtureGuard, fixturesEnabled } from "../src/lib/blog/build-env.ts";
import {
  fixtureImageSource,
  fixturePosts,
  fixtureRoot,
} from "../src/lib/blog/fixture-posts.ts";

export const writeFixtures = (root: string, imagesFrom = root): number => {
  const base = path.join(root, fixtureRoot, "content/blog");
  rmSync(path.join(root, fixtureRoot), { force: true, recursive: true });
  const posts = fixturePosts();
  for (const post of posts) {
    const dir = path.join(base, post.slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "index.mdx"), post.mdx);
    copyFileSync(
      path.join(imagesFrom, fixtureImageSource, post.cover),
      path.join(dir, "cover.webp")
    );
    if (post.chart !== undefined) {
      mkdirSync(path.join(dir, "data"), { recursive: true });
      writeFileSync(path.join(dir, "data/speed.json"), post.chart);
    }
    if (post.image !== undefined) {
      copyFileSync(
        path.join(imagesFrom, fixtureImageSource, post.image),
        path.join(dir, post.image)
      );
    }
  }
  return posts.length;
};

if (import.meta.main) {
  const guard = fixtureGuard(process.env);
  if (guard !== undefined) throw new Error(guard);
  if (fixturesEnabled()) {
    const count = writeFixtures(process.cwd());
    console.warn(`blog: ${String(count)} test posts`);
  } else {
    rmSync(fixtureRoot, { force: true, recursive: true });
  }
}
