import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { storyGraph, storyPageNode } from "../structured-data.ts";
import {
  skyStoryMetadata,
  skyStoryUrl,
  storyMetadata,
  storyUrl,
} from "./metadata.ts";

describe("storyMetadata", () => {
  const metadata = storyMetadata();

  it("points the canonical and the og url at the story", () => {
    assert.equal(
      metadata.alternates.canonical,
      "https://stevanpavlovic.com/work/dotfiles"
    );
    assert.equal(metadata.openGraph.url, storyUrl);
  });

  it("has the branded title and no city name", () => {
    assert.equal(metadata.title, "How my dotfiles work · Stevan Pavlović");
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

describe("skyStoryMetadata", () => {
  const metadata = skyStoryMetadata();

  it("points the canonical and the og url at the sky story", () => {
    assert.equal(
      metadata.alternates.canonical,
      "https://stevanpavlovic.com/work/website"
    );
    assert.equal(metadata.openGraph.url, skyStoryUrl);
  });

  it("has the branded title, a short description and no city name", () => {
    assert.equal(metadata.title, "A real sky, painted · Stevan Pavlović");
    assert.ok(metadata.description.length >= 70);
    assert.ok(metadata.description.length <= 160);
    assert.doesNotMatch(JSON.stringify(metadata), /vienna|wien/i);
  });

  it("uses its own share image", () => {
    assert.equal(metadata.openGraph.images[0]?.url, "/og-sky-story.jpg");
    assert.equal(metadata.openGraph.images[0]?.width, 1200);
    assert.equal(metadata.openGraph.images[0]?.height, 630);
    assert.equal(metadata.twitter.images[0]?.url, "/og-sky-story.jpg");
    assert.equal(
      metadata.twitter.images[0]?.alt,
      metadata.openGraph.images[0]?.alt
    );
  });
});

describe("the sky story graph", () => {
  it("is a WebPage about the website repo node", () => {
    const node = storyPageNode("2026-10-24", "website");
    assert.equal(node.url, skyStoryUrl);
    assert.equal(node.name, "A real sky, painted");
    assert.equal(node.dateModified, "2026-10-24");
    const entity = node.mainEntity;
    assert.ok(
      typeof entity === "object" &&
        entity !== null &&
        "@id" in entity &&
        typeof entity["@id"] === "string" &&
        entity["@id"].endsWith("#repo-website")
    );
  });

  it("ends the breadcrumb on the website crumb", () => {
    const graph = storyGraph("2026-10-24", "website")["@graph"];
    const text = JSON.stringify(graph);
    assert.match(text, /"name":"website"/u);
    assert.match(text, /\/work\/website/u);
    assert.doesNotMatch(text, /vienna|wien/iu);
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
