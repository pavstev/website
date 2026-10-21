import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { storyGraph, storyPageNode } from "../structured-data.ts";
import { storyMetadata, storyUrl } from "./metadata.ts";

describe("storyMetadata", () => {
  const metadata = storyMetadata();

  it("points the canonical and the og url at the story", () => {
    assert.equal(
      metadata.alternates.canonical,
      "https://stevanpavlovic.com/work/dotfiles"
    );
    assert.equal(metadata.openGraph.url, storyUrl);
  });

  it("has the plain title and no city name", () => {
    assert.equal(metadata.title, "How my dotfiles work");
    const text = JSON.stringify(metadata);
    assert.doesNotMatch(text, /vienna|wien/i);
  });

  it("keeps the description short enough for a snippet", () => {
    assert.ok(metadata.description.length <= 160);
    assert.ok(metadata.description.length >= 70);
  });

  it("uses the dotfiles share image", () => {
    assert.equal(metadata.openGraph.images[0]?.url, "/og-dotfiles.jpg");
    assert.equal(metadata.openGraph.images[0]?.width, 1200);
    assert.equal(metadata.openGraph.images[0]?.height, 630);
    assert.equal(metadata.twitter.images[0]?.url, "/og-dotfiles.jpg");
  });
});

describe("storyPageNode", () => {
  const node = storyPageNode("2026-10-21");

  it("is a WebPage about the dotfiles repo node", () => {
    assert.equal(node["@type"], "WebPage");
    const entity = node.mainEntity;
    assert.ok(typeof entity === "object" && entity !== null);
    assert.ok(
      "@id" in entity &&
        typeof entity["@id"] === "string" &&
        entity["@id"].endsWith("#repo-dotfiles")
    );
  });

  it("carries the story date and sits in the website", () => {
    assert.equal(node.dateModified, "2026-10-21");
    assert.deepEqual(node.isPartOf, {
      "@id": "https://stevanpavlovic.com/#website",
    });
    assert.equal(node.url, storyUrl);
  });
});

describe("storyGraph", () => {
  it("holds the website, the page and the breadcrumb", () => {
    const graph = storyGraph("2026-10-21")["@graph"];
    const types = graph.map((item) =>
      typeof item === "object" && "@type" in item ? item["@type"] : undefined
    );
    assert.deepEqual(types, ["WebSite", "WebPage", "BreadcrumbList"]);
  });
});
