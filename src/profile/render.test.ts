import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { fixture } from "./fixtures.ts";
import { renderProfile } from "./render.ts";
import { type ProfileInput } from "./types.ts";
import { validateProfile } from "./validate.ts";

const readmeOf = (input: ProfileInput): string => {
  const found = renderProfile(input).find((item) => item.path === "README.md");
  assert.ok(found, "README.md was not rendered");
  return found.contents;
};

const readme = (): string => readmeOf(fixture);

const head = `<!-- Generated. Do not edit here. -->
# Ada Example

**Backend & Systems Engineer**

Hi! I build engines in Vienna. I like small teams & clear APIs.

[Website](https://example.com) · [LinkedIn](https://www.linkedin.com/in/ada/) · [Résumé (PDF)](https://example.com/resume.pdf)
`;

const products = String.raw`
## Products

| Product | Role | What it is |
| :-- | :-- | :-- |
| **[trip\_kit](https://tripkit.example)** | Founder · 2026 | Plans \*trips\* for you. |
| **[Road Works](https://roadworks.example)** | Co-founder & CTO · since 2022 | Fleet tools: checks, maps. |
`;

const projects = String.raw`
## Open source projects

| Project | Built with | Stars | What it is |
| :-- | :-- | :-- | :-- |
| **[engine\_one](https://github.com/ada/engine_one)** | TypeScript · CSS | ★ 3 | A small engine. Uses \*stars\* and \<tags\>. |
| **[engine-two](https://github.com/ada/engine-two)** |  | ★ 1 | A second engine. |
`;

describe("renderProfile", () => {
  it("renders the expected files in a stable order", () => {
    assert.deepEqual(
      renderProfile(fixture).map((item) => item.path),
      ["CONTRIBUTING.md", "README.md"]
    );
  });

  it("renders the README exactly, products first", () => {
    assert.equal(readme(), `${head}${products}${projects}`);
  });

  it("leaves the products section out when there are none", () => {
    const found = renderProfile({ ...fixture, products: [] }).find(
      (item) => item.path === "README.md"
    );
    assert.equal(found?.contents, `${head}${projects}`);
  });

  it("leaves the stars column out when no repo has stars", () => {
    const found = readmeOf({
      ...fixture,
      repos: fixture.repos.map((repo) => ({ ...repo, stars: 0 })),
    });
    assert.ok(!found.includes("Stars"));
    assert.ok(found.includes("| Project | Built with | What it is |"));
  });

  it("is deterministic", () => {
    assert.deepEqual(renderProfile(fixture), renderProfile(fixture));
  });

  it("uses LF endings and one final newline in every file", () => {
    for (const item of renderProfile(fixture)) {
      assert.ok(!item.contents.includes("\r"), item.path);
      assert.ok(item.contents.endsWith("\n"), item.path);
      assert.ok(!item.contents.endsWith("\n\n"), item.path);
    }
  });

  it("has no images", () => {
    assert.ok(!readme().includes("<img"));
    assert.ok(!readme().includes("!["));
  });

  it("passes its own validation", () => {
    assert.deepEqual(
      validateProfile(renderProfile(fixture), {
        generated: fixture.strings.profile.generated,
      }),
      []
    );
  });
});
