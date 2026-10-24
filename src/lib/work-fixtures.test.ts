import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Repo } from "./github.ts";

import { fixtureGuard } from "./blog/build-env.ts";
import { products } from "./products.ts";
import { techTags } from "./tech-logos.ts";
import { withFixtureProducts, withFixtureRepos } from "./work-fixtures.ts";
import { maxProducts, workConfig } from "./work.ts";

const on = { BLOG_FIXTURES: "1" };

const realRepo = (name: string): Repo => ({
  description: "Real.",
  forks: 0,
  languages: [],
  name,
  stars: 0,
  topics: [],
  url: `https://github.com/real/${name}`,
});

describe("work fixtures", () => {
  it("fill products up to the cap with fake ones after the real ones", () => {
    const list = withFixtureProducts(products, on);
    assert.equal(list.length, maxProducts);
    assert.deepEqual(list.slice(0, products.length), [...products]);
    assert.equal(new Set(list.map(({ url }) => url)).size, maxProducts);
  });

  it("fill repos up to the cap, with unique urls and names", () => {
    const list = withFixtureRepos([realRepo("website")], on);
    assert.equal(list.length, workConfig.repos.max);
    assert.equal(list[0]?.description, "Real.");
    assert.equal(new Set(list.map(({ url }) => url)).size, list.length);
    assert.equal(list.filter(({ name }) => name === "website").length, 1);
  });

  it("mix tag counts from none to fourteen", () => {
    const counts = withFixtureRepos([], on).map(
      ({ languages, topics }) => techTags(languages, topics).length
    );
    assert.equal(Math.min(...counts), 0);
    assert.equal(Math.max(...counts), 14);
  });

  it("mix description lengths", () => {
    const lengths = withFixtureRepos([], on).map(
      ({ description }) => description.length
    );
    assert.ok(Math.min(...lengths) < 15);
    assert.ok(Math.max(...lengths) > 200);
  });

  it("change nothing when the flag is off", () => {
    const real = [realRepo("alpha")];
    assert.deepEqual(withFixtureRepos(real, {}), real);
    assert.deepEqual(withFixtureProducts(products, {}), [...products]);
  });

  it("stay off in every environment the guard rejects", () => {
    const real = [realRepo("alpha")];
    const rejected = [
      { ...on, CI: "true" },
      { ...on, WORKERS_CI: "1" },
      { ...on, NODE_ENV: "production" },
      { ...on, BLOG_BUILT_AT: "2026-10-24T10:00:00Z" },
    ];
    for (const env of rejected) {
      assert.ok(fixtureGuard(env));
      assert.deepEqual(withFixtureRepos(real, env), real);
      assert.deepEqual(withFixtureProducts(products, env), [...products]);
    }
  });
});
