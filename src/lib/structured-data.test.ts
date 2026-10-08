import type { Graph } from "schema-dts";

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";

import type { Contact, Repo } from "./github.ts";

import { products } from "./products.ts";
import { serializeJsonLd, structuredData } from "./structured-data.ts";

const contact: Contact = {
  email: "ada@example.com",
  linkedin: "https://www.linkedin.com/in/ada/",
  linkedinHandle: "ada",
};
const repo: Repo = {
  description: "A fast engine",
  forks: 0,
  languages: [],
  name: "engine",
  stars: 1,
  topics: [],
  url: "https://github.com/ada/engine",
};
const person = "https://stevanpavlovic.com/#person";
const graph = z
  .array(z.looseObject({ "@id": z.string().optional(), "@type": z.string() }))
  .parse(structuredData([repo], contact, new Date(0), products)["@graph"]);

describe("structuredData", () => {
  it("adds one node per product after the repos", () => {
    assert.deepEqual(
      graph.map((node) => node["@type"]),
      [
        "WebSite",
        "ProfilePage",
        "Person",
        "SoftwareSourceCode",
        "WebApplication",
        "SoftwareApplication",
      ]
    );
    assert.deepEqual(graph.slice(4), [
      {
        "@id": "https://stevanpavlovic.com/#product-hirista",
        "@type": "WebApplication",
        applicationCategory: "BusinessApplication",
        creator: { "@id": person },
        description: "Scores your saved jobs and writes the résumé for each.",
        name: "hirista",
        url: "https://hirista.app",
      },
      {
        "@id": "https://stevanpavlovic.com/#product-safety-real-time",
        "@type": "SoftwareApplication",
        applicationCategory: "BusinessApplication",
        creator: { "@id": person },
        description:
          "Fleet software for trucking: pre-trip checks, live dashboards.",
        name: "Safety Real Time",
        url: "https://safetyrealtime.com",
      },
    ]);
  });
  it("credits the person node as the creator", () => {
    assert.equal(graph[2]?.["@id"], person);
  });
  it("never claims an employer", () => {
    assert.doesNotMatch(JSON.stringify(graph), /worksFor/);
  });
});

describe("serializeJsonLd", () => {
  it("escapes < so a string cannot close the script tag", () => {
    const data: Graph = {
      "@context": "https://schema.org",
      "@graph": [{ "@type": "Thing", name: "</script><b>" }],
    };
    const json = serializeJsonLd(data);
    assert.equal(json.includes("<"), false);
    assert.equal(json.includes(String.raw`\u003c/script>`), true);
    assert.deepEqual(JSON.parse(json), data);
  });
});
