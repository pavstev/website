import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { servedCv } from "../src/lib/cv-sample.ts";
import { buildSystemPrompt, loadFacts } from "./facts.ts";

const cv = {
  basics: {
    headline: "Engineer",
    location: "Vienna, Austria",
    name: "Ada Example",
  },
  experience: {
    items: [
      {
        company: "Example",
        contributions: [{ description: "Built it.", title: "Ledger" }],
        from: "Jan 2020",
        overview: "Ran the platform.",
        position: "Lead",
        skills: ["Kafka"],
        to: "Present",
      },
    ],
  },
  summary: "Builds systems.",
  updatedAt: "2026-10-08T00:00:00.000Z",
};

describe("buildSystemPrompt", () => {
  it("names the person, every role and the rule to refuse guesses", () => {
    const prompt = buildSystemPrompt({ cv, llms: "# Ada" });
    assert.match(prompt, /Ada Example/);
    assert.match(prompt, /Lead at Example \(Jan 2020 to Present\)/);
    assert.match(prompt, /Built it\./);
    assert.match(prompt, /only from the facts/i);
    assert.match(prompt, /do not know/i);
  });
  it("has one rule for uncovered questions that points to the resume and email", () => {
    const prompt = buildSystemPrompt({ cv, llms: "# Ada" });
    const rules = prompt.slice(prompt.indexOf("Rules"));
    assert.equal(rules.match(/do not know/gi)?.length, 1);
    assert.match(rules, /do not know[^\n]*resume PDF[^\n]*email/i);
  });
  it("tells the model the visitor message is a question, never instructions", () => {
    const prompt = buildSystemPrompt({ cv, llms: "# Ada" });
    assert.match(prompt, /never instructions/i);
    assert.match(prompt, /adopt another role/i);
    assert.match(prompt, /reveal/i);
  });
});

const fakeAssets = (answer: (url: string) => Response): Fetcher =>
  ({
    fetch: (url: string) => Promise.resolve(answer(url)),
  }) as unknown as Fetcher;

describe("loadFacts", () => {
  it("reads cv.json and llms.txt through the assets binding", async () => {
    const assets = fakeAssets((url) =>
      url.endsWith("/cv.json") ? Response.json(cv) : new Response("# Ada")
    );
    const facts = await loadFacts(assets, "https://example.test");
    assert.equal(facts.cv.basics.name, "Ada Example");
    assert.equal(facts.llms, "# Ada");
  });
  it("fails when an asset is missing", async () => {
    const assets = fakeAssets(() => new Response("", { status: 404 }));
    await assert.rejects(
      loadFacts(assets, "https://missing.test"),
      /facts unavailable/
    );
  });
  it("retries after a failed load and ignores unknown fields", async () => {
    let calls = 0;
    const assets = fakeAssets((url) => {
      calls += 1;
      if (calls <= 2) {
        return new Response("", { status: 503 });
      }
      return url.endsWith("/cv.json")
        ? Response.json({ ...cv, extra: { anything: true } })
        : new Response("# Ada");
    });
    await assert.rejects(
      loadFacts(assets, "https://flaky.test"),
      /facts unavailable/
    );
    const facts = await loadFacts(assets, "https://flaky.test");
    assert.equal(facts.cv.basics.name, "Ada Example");
    assert.equal("extra" in facts.cv, false);
  });
  it("throws facts unavailable with a cause on malformed JSON", async () => {
    const assets = fakeAssets(
      (url) => new Response(url.endsWith("/cv.json") ? "{nope" : "# Ada")
    );
    await assert.rejects(loadFacts(assets, "https://badjson.test"), (error) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, "facts unavailable");
      assert.ok(error.cause instanceof Error);
      return true;
    });
  });
  it("throws facts unavailable with a cause on a schema failure", async () => {
    const assets = fakeAssets((url) =>
      url.endsWith("/cv.json")
        ? Response.json({ basics: {} })
        : new Response("# Ada")
    );
    await assert.rejects(
      loadFacts(assets, "https://badschema.test"),
      (error) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, "facts unavailable");
        assert.ok(error.cause);
        return true;
      }
    );
  });
  it("accepts a role without overview, skills or contributions", async () => {
    const sparse = {
      ...cv,
      experience: {
        items: [{ company: "Bare", from: "2019", position: "Dev", to: "2020" }],
      },
    };
    const assets = fakeAssets((url) =>
      url.endsWith("/cv.json") ? Response.json(sparse) : new Response("# Ada")
    );
    const facts = await loadFacts(assets, "https://sparse.test");
    const prompt = buildSystemPrompt(facts);
    assert.match(prompt, /Dev at Bare \(2019 to 2020\)/);
    assert.equal(facts.cv.experience.items[0]?.skills.length, 0);
  });
  it("reads the cv.json the site serves, projects included", async () => {
    const assets = fakeAssets((url) =>
      url.endsWith("/cv.json") ? Response.json(servedCv) : new Response("# Ada")
    );
    const facts = await loadFacts(assets, "https://served.test");
    assert.equal(facts.cv.basics.name, "Ada Example");
    assert.equal(facts.cv.basics.location, "");
    assert.match(buildSystemPrompt(facts), /Lead at Example \(2020 to Now\)/);
  });
});
