import type { ProfileInput } from "./types.ts";

export const fixture: ProfileInput = {
  personal: {
    linkedin: "https://www.linkedin.com/in/ada/",
    name: "Ada Example",
    summary: "Hi! I build engines in Vienna. I like small teams & clear APIs.",
    title: "Backend & Systems Engineer",
    website: "https://example.com",
  },
  products: [
    {
      line: "Plans *trips* for you.",
      meta: "Founder · 2026",
      name: "trip_kit",
      url: "https://tripkit.example",
    },
    {
      line: "Fleet tools: checks, maps.",
      meta: "Co-founder & CTO · since 2022",
      name: "Road Works",
      url: "https://roadworks.example",
    },
  ],
  repos: [
    {
      description: "A small engine. Uses *stars* and <tags>.",
      forks: 0,
      language: "TypeScript",
      languages: [{ name: "TypeScript" }, { name: "CSS" }],
      name: "engine_one",
      stars: 3,
      topics: [],
      url: "https://github.com/ada/engine_one",
    },
    {
      description: "A second engine.",
      forks: 0,
      languages: [],
      name: "engine-two",
      stars: 1,
      topics: [],
      url: "https://github.com/ada/engine-two",
    },
  ],
  strings: {
    card: { linkedin: "LinkedIn" },
    profile: {
      columnBuiltWith: "Built with",
      columnProduct: "Product",
      columnProject: "Project",
      columnRole: "Role",
      columnStars: "Stars",
      columnWhat: "What it is",
      contributingContent: "Bio: `a`",
      contributingIntro: "Generated. Do not edit.",
      contributingLayout: "Layout: `b`",
      contributingPreview: "Run it.",
      contributingSource: "Edit the source:",
      contributingStrings: "Text: `c`",
      contributingTitle: "Contributing",
      generated: "Generated. Do not edit here.",
      resume: "Résumé (PDF)",
      website: "Website",
    },
    work: {
      productsHeading: "Products",
      projectsHeading: "Open source projects",
    },
  },
};
