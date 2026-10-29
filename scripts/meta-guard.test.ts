import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { metaProblems } from "./meta-guard.ts";

const site = "https://example.com";

const page = (head: string): string => `<head>${head}</head>`;

const home = page(
  [
    "<title>Home</title>",
    '<meta name="robots" content="index, follow">',
    '<meta property="og:title" content="Home">',
    '<meta property="og:url" content="https://example.com">',
    '<meta name="twitter:title" content="Home">',
  ].join("")
);

const notFound = page(
  [
    "<title>Page not found</title>",
    '<meta name="robots" content="noindex">',
    '<meta property="og:title" content="Page not found">',
    '<meta name="twitter:title" content="Page not found">',
  ].join("")
);

describe("metaProblems", () => {
  it("accepts a correct home page and 404 page", () => {
    assert.deepEqual(metaProblems(home, "home", site), []);
    assert.deepEqual(metaProblems(notFound, "notFound", site), []);
  });

  it("reports share titles that differ from the title", () => {
    const html = home.replace(
      'og:title" content="Home"',
      'og:title" content="x"'
    );
    assert.deepEqual(metaProblems(html, "home", site), [
      "og:title differs from <title>",
    ]);
  });

  it("reports a home page without its og:url or with noindex", () => {
    const html = home
      .replace('<meta property="og:url" content="https://example.com">', "")
      .replace("index, follow", "noindex");
    assert.deepEqual(metaProblems(html, "home", site), [
      "og:url is not https://example.com",
      "the home page is noindex",
    ]);
  });

  it("reports a 404 page that can be indexed or points at the home url", () => {
    const html = notFound
      .replace("noindex", "index, follow")
      .replace(
        "</head>",
        '<meta property="og:url" content="https://example.com"></head>'
      );
    assert.deepEqual(metaProblems(html, "notFound", site), [
      "the error page is not noindex",
      "the error page has an og:url",
    ]);
  });
});
