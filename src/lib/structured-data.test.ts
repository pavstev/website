import type { Graph } from "schema-dts";

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as z from "zod";

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
const modified = "2026-10-12T09:03:17.113Z";
const person = "https://stevanpavlovic.com/#person";
const graph = z
  .array(z.looseObject({ "@id": z.string().optional(), "@type": z.string() }))
  .parse(structuredData([repo], contact, modified, products)["@graph"]);
const credited = z.object({ creator: z.object({ "@id": z.string() }) });

describe("structuredData", () => {
  it("adds one node per product after the repos", () => {
    assert.deepEqual(
      graph.map((node) => node["@type"]),
      [
        "WebSite",
        "ProfilePage",
        "Person",
        "SoftwareSourceCode",
        "SoftwareApplication",
      ]
    );
    assert.deepEqual(graph.slice(4), [
      {
        "@id": "https://stevanpavlovic.com/#product-safety-real-time",
        "@type": "SoftwareApplication",
        applicationCategory: "BusinessApplication",
        creator: { "@id": person },
        description:
          "Keeps trucking fleets inspected, compliant and visible in real time.",
        name: "Safety Real Time",
        url: "https://safetyrealtime.com",
      },
    ]);
  });
  it("credits the person node as the creator", () => {
    const personNode = graph.find((node) => node["@type"] === "Person");
    assert.ok(personNode);
    assert.equal(personNode["@id"], person);
    const made = graph.filter((node) => node["@id"]?.includes("#product-"));
    assert.equal(made.length, products.length);
    for (const node of made) {
      assert.equal(credited.parse(node).creator["@id"], personNode["@id"]);
    }
  });
  it("dates the profile page with the given content date", () => {
    const page = graph.find((node) => node["@type"] === "ProfilePage");
    assert.equal(page?.["dateModified"], modified);
  });
  it("gives each repo a stable id", () => {
    const code = graph.find((node) => node["@type"] === "SoftwareSourceCode");
    assert.equal(code?.["@id"], "https://stevanpavlovic.com/#repo-engine");
  });
  it("uses one page url without a slash for every url field", () => {
    for (const type of ["WebSite", "ProfilePage", "Person"]) {
      const node = graph.find((entry) => entry["@type"] === type);
      assert.equal(node?.["url"], "https://stevanpavlovic.com");
    }
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
