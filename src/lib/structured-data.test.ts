import type { Graph } from "schema-dts";

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as z from "zod";

import type { Contact, Repo } from "./github.ts";

import { products } from "./products.ts";
import {
  aboutGraph,
  serializeJsonLd,
  structuredData,
  workGraph,
} from "./structured-data.ts";

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
  .parse(structuredData([repo], contact, modified)["@graph"]);
const credited = z.object({ creator: z.object({ "@id": z.string() }) });

const aboutDoc = z
  .array(z.looseObject({ "@id": z.string().optional(), "@type": z.string() }))
  .parse(aboutGraph(contact, "About text", modified)["@graph"]);
const workDoc = z
  .array(z.looseObject({ "@id": z.string().optional(), "@type": z.string() }))
  .parse(workGraph(products)["@graph"]);

const crumbsOf = (list: unknown): string[] =>
  z
    .array(z.object({ item: z.string() }))
    .parse(list)
    .map((entry) => entry.item);

describe("structuredData", () => {
  it("holds the site, profile, person and repos only", () => {
    assert.deepEqual(
      graph.map((node) => node["@type"]),
      ["WebSite", "ProfilePage", "Person", "SoftwareSourceCode"]
    );
  });
});

describe("workGraph", () => {
  it("adds one web application node per product", () => {
    assert.deepEqual(
      workDoc.map((node) => node["@type"]),
      ["WebSite", "WebPage", "BreadcrumbList", "WebApplication"]
    );
    assert.deepEqual(workDoc[3], {
      "@id": "https://stevanpavlovic.com/#product-safety-real-time",
      "@type": "WebApplication",
      applicationCategory: "BusinessApplication",
      creator: { "@id": person },
      description:
        "Keeps trucking fleets inspected, compliant and visible in real time.",
      name: "Safety Real Time",
      operatingSystem: "Web",
      url: "https://safetyrealtime.com",
    });
  });
  it("lists the home and work pages in the breadcrumb", () => {
    const crumbs = workDoc.find((node) => node["@type"] === "BreadcrumbList");
    assert.deepEqual(crumbsOf(crumbs?.["itemListElement"]), [
      "https://stevanpavlovic.com",
      "https://stevanpavlovic.com/work",
    ]);
  });
  it("credits the person node as the creator", () => {
    const made = workDoc.filter((node) => node["@id"]?.includes("#product-"));
    assert.equal(made.length, products.length);
    for (const node of made) {
      assert.equal(credited.parse(node).creator["@id"], person);
    }
  });
});

describe("aboutGraph", () => {
  it("is a profile page about the same person", () => {
    assert.deepEqual(
      aboutDoc.map((node) => node["@type"]),
      ["WebSite", "ProfilePage", "Person", "BreadcrumbList"]
    );
    const page = aboutDoc.find((node) => node["@type"] === "ProfilePage");
    assert.equal(page?.["@id"], "https://stevanpavlovic.com/about#profile");
    assert.equal(page?.["url"], "https://stevanpavlovic.com/about");
    assert.deepEqual(page?.["mainEntity"], { "@id": person });
    assert.equal(page?.["dateModified"], modified);
    assert.equal(page?.["description"], "About text");
    const crumbs = aboutDoc.find((node) => node["@type"] === "BreadcrumbList");
    assert.deepEqual(crumbsOf(crumbs?.["itemListElement"]), [
      "https://stevanpavlovic.com",
      "https://stevanpavlovic.com/about",
    ]);
  });
  it("carries the person node the page points at", () => {
    assert.ok(aboutDoc.some((node) => node["@id"] === person));
  });
});

describe("structuredData details", () => {
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
    assert.doesNotMatch(JSON.stringify([graph, workDoc, aboutDoc]), /worksFor/);
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
