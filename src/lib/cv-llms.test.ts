import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { cvLlmsSections } from "./cv-llms.ts";
import { cvSchema } from "./cv.ts";

const full = cvSchema.parse({
  basics: { name: "Ada Example" },
  education: {
    items: [
      {
        area: "Computer Science",
        degree: "BSc",
        from: "2010",
        school: "TU Wien",
        to: "2014",
      },
    ],
  },
  experience: {
    items: [
      {
        company: "Example",
        from: "Jan 2020",
        overview: "Ran the\nplatform.",
        position: "Lead",
        to: "Present",
      },
      { company: "Bare", from: "2019", position: "Dev", to: "2020" },
    ],
  },
  projects: {
    items: [
      {
        name: "Ledger",
        overview: "A double-entry ledger.",
        websiteUrl: "https://example.com/ledger",
      },
      { name: "Notes", overview: "Plain notes." },
    ],
  },
  skills: {
    items: [
      { keywords: ["Go", "TypeScript"], name: "Languages" },
      { keywords: [], name: "Empty" },
    ],
  },
  updatedAt: "2026-10-08T00:00:00.000Z",
});

describe("cvLlmsSections", () => {
  it("lists experience, skills, education and résumé projects in order", () => {
    assert.deepEqual(cvLlmsSections(full), [
      "## Experience",
      "",
      "- Lead at Example (Jan 2020 to Present): Ran the platform.",
      "- Dev at Bare (2019 to 2020)",
      "",
      "## Skills",
      "",
      "- Languages: Go, TypeScript",
      "",
      "## Education",
      "",
      "- BSc, Computer Science at TU Wien (2010 to 2014)",
      "",
      "## Projects from the résumé",
      "",
      "- [Ledger](https://example.com/ledger): A double-entry ledger.",
      "- Notes: Plain notes.",
      "",
    ]);
  });
  it("leaves out sections without items", () => {
    const bare = cvSchema.parse({
      experience: {
        items: [{ company: "Bare", from: "2019", position: "Dev", to: "2020" }],
      },
      updatedAt: "2026-10-08T00:00:00.000Z",
    });
    const lines = cvLlmsSections(bare);
    assert.deepEqual(lines, [
      "## Experience",
      "",
      "- Dev at Bare (2019 to 2020)",
      "",
    ]);
  });
  it("drops rows without a name or a heading", () => {
    const gaps = cvSchema.parse({
      education: {
        items: [
          { from: "2010", to: "2014" },
          { area: "CS", from: "2010" },
          { degree: "BSc", from: "2010" },
          { school: "TU Wien" },
        ],
      },
      experience: {
        items: [
          { from: "2019", overview: "Nothing else.", to: "2020" },
          { company: "Solo" },
          { position: "Freelance" },
        ],
      },
      projects: {
        items: [
          { overview: "No name.", websiteUrl: "https://example.com/x" },
          { name: "  " },
        ],
      },
      updatedAt: "2026-10-08T00:00:00.000Z",
    });
    assert.deepEqual(cvLlmsSections(gaps), [
      "## Experience",
      "",
      "- Solo",
      "- Freelance",
      "",
      "## Education",
      "",
      "- CS (2010)",
      "- BSc (2010)",
      "- TU Wien",
      "",
    ]);
  });
});
