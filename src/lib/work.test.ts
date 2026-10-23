import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { products } from "./products.ts";
import { pickProducts, pickRepos, storyPath, workConfig } from "./work.ts";

const repos = ["alpha", "beta", "gamma", "delta", "website"].map((name) => ({
  name,
}));

const names = (list: ReadonlyArray<{ name: string }>): string[] =>
  list.map(({ name }) => name);

describe("pickRepos", () => {
  it("keeps the order when nothing is pinned or hidden", () => {
    assert.deepEqual(
      names(pickRepos(repos, { hidden: [], max: 12, pinned: [] })),
      ["alpha", "beta", "gamma", "delta", "website"]
    );
  });
  it("puts pinned repos first, in the pinned order", () => {
    assert.deepEqual(
      names(
        pickRepos(repos, { hidden: [], max: 12, pinned: ["website", "gamma"] })
      ),
      ["website", "gamma", "alpha", "beta", "delta"]
    );
  });
  it("skips pinned names that do not exist and pinned repeats", () => {
    assert.deepEqual(
      names(
        pickRepos(repos, {
          hidden: [],
          max: 12,
          pinned: ["missing", "delta", "delta"],
        })
      ),
      ["delta", "alpha", "beta", "gamma", "website"]
    );
  });
  it("drops hidden repos, even a pinned one", () => {
    assert.deepEqual(
      names(
        pickRepos(repos, {
          hidden: ["beta", "website"],
          max: 12,
          pinned: ["website"],
        })
      ),
      ["alpha", "gamma", "delta"]
    );
  });
  it("cuts at max after pinning", () => {
    assert.deepEqual(
      names(pickRepos(repos, { hidden: [], max: 2, pinned: ["website"] })),
      ["website", "alpha"]
    );
    assert.deepEqual(pickRepos(repos, { hidden: [], max: 0, pinned: [] }), []);
  });
  it("does not change the input", () => {
    const copy = [...repos];
    pickRepos(repos, { hidden: ["alpha"], max: 1, pinned: ["website"] });
    assert.deepEqual(repos, copy);
  });
  it("pins the website repo by default", () => {
    assert.deepEqual(workConfig.repos.pinned, ["website"]);
    assert.equal(workConfig.repos.max, 12);
    assert.equal(names(pickRepos(repos))[0], "website");
  });
});

describe("storyPath", () => {
  it("gives each story path and nothing for other repos", () => {
    assert.equal(storyPath("dotfiles"), "/work/dotfiles");
    assert.equal(storyPath("website"), "/work/website");
    assert.equal(storyPath("hirista"), undefined);
  });
  it("reads the picks it is given", () => {
    const picks = {
      hidden: [],
      max: 12,
      pinned: [],
      stories: { alpha: "/work/alpha" },
    };
    assert.equal(storyPath("alpha", picks), "/work/alpha");
    assert.equal(storyPath("dotfiles", picks), undefined);
  });
  it("ignores names that only exist on the prototype chain", () => {
    assert.equal(storyPath("constructor"), undefined);
    assert.equal(storyPath("toString"), undefined);
  });
  it("is undefined when the picks carry no stories", () => {
    assert.equal(
      storyPath("dotfiles", { hidden: [], max: 12, pinned: [] }),
      undefined
    );
  });
});

describe("pickProducts", () => {
  const all = ["a", "b", "c", "d"].map((key) => ({ key }));
  it("follows the order of the keys", () => {
    assert.deepEqual(pickProducts(all, ["c", "a"]), [
      { key: "c" },
      { key: "a" },
    ]);
  });
  it("skips unknown and repeated keys", () => {
    assert.deepEqual(pickProducts(all, ["x", "b", "b"]), [{ key: "b" }]);
  });
  it("shows at most three", () => {
    assert.deepEqual(pickProducts(all, ["d", "c", "b", "a"]), [
      { key: "d" },
      { key: "c" },
      { key: "b" },
    ]);
  });
  it("picks only real products in the default config", () => {
    assert.ok(workConfig.productKeys.length > 0);
    assert.ok(workConfig.productKeys.length <= 3);
    assert.equal(
      pickProducts(products).length,
      new Set(workConfig.productKeys).size
    );
  });
});
