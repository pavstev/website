import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";

import { aboutSchema } from "./lib/blog/about.ts";
import { fixtureGuard, fixturesEnabled } from "./lib/blog/build-env.ts";
import { fixtureRoot } from "./lib/blog/fixture-posts.ts";
import { frontmatterSchema } from "./lib/blog/schema.ts";

const guard = fixtureGuard(process.env);
if (guard !== undefined) throw new Error(guard);

const blog = defineCollection({
  loader: glob({
    base: ".",
    generateId: ({ entry }) => entry.split("/").at(-2) ?? entry,
    pattern: [
      "content/blog/*/index.mdx",
      ...(fixturesEnabled() ? [`${fixtureRoot}/content/blog/*/index.mdx`] : []),
    ],
  }),
  schema: frontmatterSchema,
});

const about = defineCollection({
  loader: glob({ base: "./content/about", pattern: "index.mdx" }),
  schema: aboutSchema,
});

export const collections = { about, blog };
