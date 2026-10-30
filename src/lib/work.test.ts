import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { products } from "./products.ts";
import {
  defaultWorkView,
  parseWorkView,
  pickProducts,
  pickRepos,
  sortWork,
  storyEntry,
  updatedTime,
  workConfig,
  workSortKeys,
  type WorkSortKeys,
  workViewSearch,
} from "./work.ts";

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

describe("storyEntry", () => {
  it("gives each story its key and path and nothing for other repos", () => {
    assert.deepEqual(storyEntry("dotfiles"), {
      key: "dotfiles",
      path: "/work/dotfiles",
    });
    assert.deepEqual(storyEntry("website"), {
      key: "website",
      path: "/work/website",
    });
    assert.equal(storyEntry("hirista"), undefined);
  });
  it("reads the picks it is given", () => {
    const picks = {
      hidden: [],
      max: 12,
      pinned: [],
      stories: { alpha: "/work/alpha", website: "/work/site" },
    };
    assert.deepEqual(storyEntry("website", picks), {
      key: "website",
      path: "/work/site",
    });
    assert.equal(storyEntry("alpha", picks), undefined);
    assert.equal(storyEntry("dotfiles", picks), undefined);
  });
  it("ignores names that only exist on the prototype chain", () => {
    assert.equal(storyEntry("constructor"), undefined);
    assert.equal(storyEntry("toString"), undefined);
  });
  it("is undefined when the picks carry no stories", () => {
    assert.equal(
      storyEntry("dotfiles", { hidden: [], max: 12, pinned: [] }),
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

describe("parseWorkView", () => {
  it("falls back to the default view for missing or unknown values", () => {
    assert.deepEqual(parseWorkView(""), defaultWorkView);
    assert.deepEqual(
      parseWorkView("?show=secret&sort=%3Cscript%3E"),
      defaultWorkView
    );
  });
  it("reads a valid filter and sort", () => {
    assert.deepEqual(parseWorkView("?show=products&sort=stars"), {
      filter: "products",
      sort: "stars",
    });
  });
  it("ignores a filter for a group the page does not show", () => {
    assert.equal(
      parseWorkView("?show=products", ["open-source"]).filter,
      "all"
    );
  });
});

describe("workViewSearch", () => {
  it("drops default values and keeps other params", () => {
    assert.equal(
      workViewSearch(defaultWorkView, "?show=products&utm=x"),
      "?utm=x"
    );
  });
  it("writes the changed values", () => {
    assert.equal(
      workViewSearch({ filter: "open-source", sort: "updated" }, ""),
      "?show=open-source&sort=updated"
    );
  });
});

describe("sortWork", () => {
  const items: WorkSortKeys[] = [
    {
      featured: 0,
      group: "open-source",
      name: "website",
      stars: 3,
      updated: 10,
    },
    {
      featured: 1,
      group: "open-source",
      name: "Dotfiles",
      stars: 9,
      updated: 30,
    },
    {
      featured: 0,
      group: "products",
      name: "Safety Real Time",
      stars: 0,
      updated: 0,
    },
    {
      featured: 2,
      group: "open-source",
      name: "cronfluent",
      stars: 3,
      updated: 20,
    },
  ];
  const order = (sort: Parameters<typeof sortWork>[1]): string[] =>
    names(sortWork(items, sort));

  it("puts products first only in the featured order", () => {
    assert.deepEqual(order("featured"), [
      "Safety Real Time",
      "website",
      "Dotfiles",
      "cronfluent",
    ]);
  });
  it("mixes products and open source in the other orders", () => {
    assert.deepEqual(order("stars"), [
      "Dotfiles",
      "website",
      "cronfluent",
      "Safety Real Time",
    ]);
    assert.deepEqual(order("updated"), [
      "Dotfiles",
      "cronfluent",
      "website",
      "Safety Real Time",
    ]);
    assert.deepEqual(order("name"), [
      "cronfluent",
      "Dotfiles",
      "Safety Real Time",
      "website",
    ]);
  });
});

describe("workSortKeys", () => {
  it("turns broken data attributes into safe keys", () => {
    assert.deepEqual(
      workSortKeys({ featured: "x", group: "evil", stars: "NaN" }),
      { featured: 0, group: "open-source", name: "", stars: 0, updated: 0 }
    );
  });
});

describe("updatedTime", () => {
  it("reads an ISO date and returns 0 for a missing or bad one", () => {
    assert.equal(updatedTime("2026-01-02T00:00:00Z"), Date.UTC(2026, 0, 2));
    assert.equal(updatedTime(undefined), 0);
    assert.equal(updatedTime("not a date"), 0);
  });
});
