import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { iconData } from "./icon-data.ts";
import { languageTech, techLogoNames, techTags } from "./tech-logos.ts";

const names = (tags: ReadonlyArray<{ name: string }>): string[] =>
  tags.map(({ name }) => name);

describe("languageTech", () => {
  it("keeps the Linguist color and picks the logo by name", () => {
    assert.deepEqual(languageTech({ color: "#3178c6", name: "TypeScript" }), {
      color: "#3178c6",
      logo: "simple-icons:typescript",
      name: "TypeScript",
    });
  });
  it("leaves the logo out for a language it does not know", () => {
    assert.equal(languageTech({ name: "Brainfuck" }).logo, undefined);
  });
});

describe("techTags", () => {
  const languages = [
    { color: "#3178c6", name: "TypeScript" },
    { color: "#ff5a03", name: "Astro" },
  ];

  it("lists the languages first, then the technology topics", () => {
    assert.deepEqual(
      names(techTags(languages, ["pnpm", "nextjs", "cloudflare-workers"])),
      ["TypeScript", "Astro", "pnpm", "Next.js", "Cloudflare Workers"]
    );
  });
  it("drops topics that are not technologies", () => {
    assert.deepEqual(
      names(
        techTags(languages, ["portfolio", "personal-website", "dictation"])
      ),
      ["TypeScript", "Astro"]
    );
  });
  it("drops a topic that repeats a language", () => {
    assert.deepEqual(names(techTags(languages, ["typescript", "webgl"])), [
      "TypeScript",
      "Astro",
      "WebGL",
    ]);
  });
  it("shows two Tailwind topics once", () => {
    assert.deepEqual(names(techTags([], ["tailwindcss", "tailwindcss-v4"])), [
      "Tailwind CSS",
    ]);
  });
  it("takes a topic's color from its matching language, else none", () => {
    const tags = techTags(
      [{ color: "#89e051", name: "Shell" }],
      ["zsh", "nextjs"]
    );
    assert.equal(tags[1]?.color, "#89e051");
    assert.equal(tags[2]?.color, undefined);
  });
  it("keeps a technology with no logo", () => {
    assert.deepEqual(techTags([], ["mlx"]), [
      { color: undefined, logo: undefined, name: "MLX" },
    ]);
  });
});

describe("techLogoNames", () => {
  it("are all in the generated icon data", () => {
    for (const name of techLogoNames) {
      assert.ok(Object.keys(iconData).includes(name), `${name} is missing`);
    }
  });
});
