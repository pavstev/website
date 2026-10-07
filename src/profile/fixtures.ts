import type { ProfileInput } from "./types.ts";

export const fixture: ProfileInput = {
  fonts: {
    extra: new Uint8Array([4, 5, 6]),
    latin: new Uint8Array([1, 2, 3]),
    nameExtra: new Uint8Array([10, 11, 12]),
    nameLatin: new Uint8Array([7, 8, 9]),
  },
  icons: {
    "circle-flags:at": {
      body: '<path fill="#d80027" d="M0 0h512v512H0z"/>',
      height: 512,
      width: 512,
    },
    "lucide:download": {
      body: '<path stroke="currentColor" d="M12 15V3"/>',
      height: 24,
      width: 24,
    },
    "lucide:globe": {
      body: '<circle cx="12" cy="12" r="10" stroke="currentColor"/>',
      height: 24,
      width: 24,
    },
    "simple-icons:linkedin": {
      body: '<path fill="currentColor" d="M0 0h24v24H0z"/>',
      height: 24,
      width: 24,
    },
  },
  personal: {
    city: "Vienna",
    country: "Austria",
    linkedin: "https://www.linkedin.com/in/ada/",
    name: "Ada Example",
    summary: "Hi! I build engines in Vienna. I like small teams & clear APIs.",
    title: "Backend & Systems Engineer",
    website: "https://example.com",
  },
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
    repos: {
      headingOne: "{count} open source project",
      headingOther: "{count} open source projects",
    },
  },
};
