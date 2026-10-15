import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as z from "zod";

import { personalData } from "../personal.ts";
import { postGraph } from "../structured-data.ts";
import {
  crumbIsLink,
  crumbTrail,
  listingCrumbs,
  postCrumbs,
} from "./crumbs.ts";
import { postMeta } from "./post-fixture.ts";

const rows = (
  crumbs: ReturnType<typeof crumbTrail>
): Array<[string, string, boolean]> =>
  crumbs.map(({ current, label, path }) => [label, path, current]);

describe("crumbTrail", () => {
  it("is Home and Blog with Blog current", () => {
    assert.deepEqual(rows(crumbTrail()), [
      ["Home", "/", false],
      ["Blog", "/blog", true],
    ]);
  });

  it("marks only the last item as current", () => {
    const trail = crumbTrail({ label: "Here", path: "/blog/here" });
    assert.deepEqual(
      trail.map((crumb) => crumb.current),
      [false, false, true]
    );
  });
});

describe("postCrumbs", () => {
  it("is Home, Blog and the post title", () => {
    assert.deepEqual(
      rows(postCrumbs({ slug: "one", title: "One long title" })),
      [
        ["Home", "/", false],
        ["Blog", "/blog", false],
        ["One long title", "/blog/one", true],
      ]
    );
  });

  it("keeps the title as written", () => {
    const last = postCrumbs({ slug: "q", title: 'A <b> & "q"' })[2];
    assert.equal(last?.label, 'A <b> & "q"');
  });

  it("matches the paths of the JSON-LD breadcrumb", () => {
    const post = postMeta({
      slug: "one",
      title: "One",
      url: "https://stevanpavlovic.com/blog/one",
    });
    const graph = z
      .array(z.looseObject({ "@type": z.string() }))
      .parse(postGraph(post, [])["@graph"]);
    const list = graph.find((node) => node["@type"] === "BreadcrumbList");
    const items = z
      .array(z.object({ item: z.string(), position: z.number() }))
      .parse(list?.["itemListElement"]);
    const trail = postCrumbs(post);
    assert.equal(items.length, trail.length);
    for (const [index, crumb] of trail.entries()) {
      const expected =
        crumb.path === "/"
          ? personalData.website
          : `${personalData.website}${crumb.path}`;
      assert.equal(items[index]?.item, expected);
      assert.equal(items[index]?.position, index + 1);
    }
  });
});

describe("listingCrumbs", () => {
  it("shows Blog as the current page on the index", () => {
    assert.deepEqual(
      rows(listingCrumbs("Blog", "https://stevanpavlovic.com/blog")),
      [
        ["Home", "/", false],
        ["Blog", "/blog", true],
      ]
    );
  });

  it("adds the heading on a later page and a tag page", () => {
    assert.deepEqual(
      rows(
        listingCrumbs("Blog, page 2", "https://stevanpavlovic.com/blog/page/2")
      ),
      [
        ["Home", "/", false],
        ["Blog", "/blog", false],
        ["Blog, page 2", "/blog/page/2", true],
      ]
    );
    const tag = listingCrumbs(
      "Posts tagged WebGL",
      "https://stevanpavlovic.com/blog/tag/webgl"
    );
    assert.equal(tag.at(-1)?.path, "/blog/tag/webgl");
  });
});

describe("crumbIsLink", () => {
  it("links every crumb except a current page that is not the Blog index", () => {
    const [home, blog, here] = postCrumbs({ slug: "one", title: "One" });
    assert.ok(home !== undefined && crumbIsLink(home));
    assert.ok(blog !== undefined && crumbIsLink(blog));
    assert.ok(here !== undefined && !crumbIsLink(here));
    const [, index] = crumbTrail();
    assert.ok(index !== undefined && crumbIsLink(index));
  });
});
