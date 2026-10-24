import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { brandTitle } from "./format.ts";
import { listMetadata, notFoundMetadata } from "./metadata.ts";

const base = {
  description: "A page",
  title: "Topic · Stevan Pavlović",
  url: "https://stevanpavlovic.com/topic",
};

describe("listMetadata", () => {
  it("defaults the Open Graph type to website", () => {
    assert.equal(listMetadata(base).openGraph.type, "website");
  });
  it("takes the profile type for a person page", () => {
    assert.equal(
      listMetadata({ ...base, type: "profile" }).openGraph.type,
      "profile"
    );
  });
});

describe("brandTitle", () => {
  it("puts the name after the topic", () => {
    assert.equal(brandTitle("Topic"), "Topic · Stevan Pavlović");
  });
  it("brands the 404 title and keeps it out of the index", () => {
    const metadata = notFoundMetadata({
      description: "Gone",
      title: brandTitle("Page not found"),
    });
    assert.equal(metadata.title, "Page not found · Stevan Pavlović");
    assert.equal(metadata.robots.index, false);
  });
});
