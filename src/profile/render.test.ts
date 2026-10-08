import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { fixture } from "./fixtures.ts";
import { renderProfile } from "./render.ts";
import { validateProfile } from "./validate.ts";

const file = (path: string): string => {
  const found = renderProfile(fixture).find((item) => item.path === path);
  assert.ok(found, `${path} was not rendered`);
  return found.contents;
};

const expectedRepos = String.raw`<!-- Generated. Do not edit here. -->
<p align="center">
  <a href="https://example.com"><img src="assets/header.svg" alt="Ada Example, Backend &amp; Systems Engineer"></a>
</p>

<p align="center">
  Hi! I build engines in Vienna <img src="assets/flag-at.svg" height="14" alt="Austria">. I like small teams &amp; clear APIs.
</p>

<p align="center">
  <a href="https://example.com"><img src="assets/icon-website.svg" width="40" height="40" alt="Website"></a>&nbsp;
  <a href="https://www.linkedin.com/in/ada/"><img src="assets/icon-linkedin.svg" width="40" height="40" alt="LinkedIn"></a>&nbsp;
  <a href="https://example.com/resume.pdf"><img src="assets/icon-resume.svg" width="40" height="40" alt="Résumé (PDF)"></a>
</p>

## 2 open source projects

- **[engine\_one](https://github.com/ada/engine_one)** · A small engine. Uses \*stars\* and \<tags\>. · TypeScript, CSS
- **[engine-two](https://github.com/ada/engine-two)** · A second engine.
`;

const expectedReadme = String.raw`${expectedRepos}
## 2 products

- **[trip\_kit](https://tripkit.example)** · Founder · 2026. Plans \*trips\* for you.
- **[Road Works](https://roadworks.example)** · Co-founder & CTO · since 2022. Fleet tools: checks, maps.
`;

describe("renderProfile", () => {
  it("renders the expected files in a stable order", () => {
    assert.deepEqual(
      renderProfile(fixture).map((item) => item.path),
      [
        "CONTRIBUTING.md",
        "README.md",
        "assets/flag-at.svg",
        "assets/header.svg",
        "assets/icon-linkedin.svg",
        "assets/icon-resume.svg",
        "assets/icon-website.svg",
      ]
    );
  });

  it("renders the README exactly", () => {
    assert.equal(file("README.md"), expectedReadme);
  });

  it("leaves the products section out when there are none", () => {
    const readme = renderProfile({ ...fixture, products: [] }).find(
      (item) => item.path === "README.md"
    );
    assert.equal(readme?.contents, expectedRepos);
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

  it("puts the name, the title and all four fonts in the header", () => {
    const header = file("assets/header.svg");
    assert.ok(header.includes(">Ada Example</text>"));
    assert.ok(header.includes(">Backend &amp; Systems Engineer</text>"));
    assert.ok(header.includes("base64,AQID"));
    assert.ok(header.includes("base64,BAUG"));
    assert.ok(header.includes("base64,BwgJ"));
    assert.ok(header.includes("base64,CgsM"));
    assert.ok(header.includes("Parkinsans"));
  });

  it("passes its own validation", () => {
    assert.deepEqual(
      validateProfile(renderProfile(fixture), {
        generated: fixture.strings.profile.generated,
      }),
      []
    );
  });

  it("fails when the summary does not mention the city", () => {
    assert.throws(
      () =>
        renderProfile({
          ...fixture,
          personal: { ...fixture.personal, city: "Graz" },
        }),
      /Graz/
    );
  });

  it("fails on an unknown icon", () => {
    assert.throws(
      () => renderProfile({ ...fixture, icons: {} }),
      /Unknown icon/
    );
  });
});
